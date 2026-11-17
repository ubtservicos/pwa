-- Migração: 20261117185000_fix_admin_rls_and_sync_waitlist.sql
-- Objetivo: Equalizar funções de admin, políticas RLS em usuarios e waitlist, e tornar a sincronização de waitlist -> usuarios à prova de falhas por conflito de dados.

-- 1. Equalização das funções de identificação de Administrador (SECURITY DEFINER para prevenir recursão 42P17)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_role text;
    v_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 1.1 Verificação rápida por email administrativo no JWT
    v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_email IN ('ubt.servicos@gmail.com', 'admin@ubt.app') THEN
        RETURN true;
    END IF;

    -- 1.2 Verificação por role em public.usuarios (cobre admin, superadmin, super_admin)
    SELECT role INTO v_role 
    FROM public.usuarios 
    WHERE id = auth.uid();
    
    IF v_role IN ('admin', 'superadmin', 'super_admin', 'operator', 'financeiro', 'moderador') THEN
        RETURN true;
    END IF;

    -- 1.3 Fallback em auth.users se email não constava no JWT
    IF v_email = '' THEN
        SELECT LOWER(email) INTO v_email FROM auth.users WHERE id = auth.uid();
        IF v_email IN ('ubt.servicos@gmail.com', 'admin@ubt.app') THEN
            RETURN true;
        END IF;
    END IF;

    -- 1.4 Fallback em public.profiles
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role IN ('admin', 'superadmin', 'super_admin') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT public.is_admin();
$$;

-- 2. Equalização da check constraint de roles em public.usuarios
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check 
  CHECK (role = ANY (ARRAY['tomador'::text, 'prestador'::text, 'admin'::text, 'superadmin'::text, 'super_admin'::text, 'cocoecia'::text, 'associacao'::text, 'user'::text]));

-- 3. Políticas RLS explícitas para Administradores em public.usuarios e public.waitlist
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_usuarios" ON public.usuarios;
CREATE POLICY "admin_manage_usuarios" ON public.usuarios
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_manage_waitlist" ON public.waitlist;
CREATE POLICY "admin_manage_waitlist" ON public.waitlist
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Função robusta e resiliente para propagar aprovação da waitlist para public.usuarios
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
  v_existing_id uuid;
  v_target_id uuid;
  v_auth_user_id uuid;
BEGIN
  -- Auto-confirmação de email em auth.users
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE LOWER(email) = LOWER(NEW.email) AND email_confirmed_at IS NULL;
  END IF;

  -- Se o waitlist ainda não tiver user_id, tenta localizar por auth.users
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_auth_user_id FROM auth.users WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    IF v_auth_user_id IS NOT NULL THEN
      NEW.user_id := v_auth_user_id;
    END IF;
  END IF;

  -- Identificação de PJ
  v_is_pj := (
    NEW.tipo_cadastro IN ('pj', 'associacao', 'PJ')
    OR NEW.cnpj IS NOT NULL
    OR NEW.razao_social IS NOT NULL
  );

  IF v_is_pj THEN
    v_role := 'associacao';
  ELSIF NEW.role IN ('prestador', 'trabalhador') THEN
    v_role := 'prestador';
  ELSIF NEW.role IN ('admin', 'superadmin', 'super_admin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'tomador';
  END IF;

  IF NEW.cadastro_completo = true OR NEW.status IN ('aprovado', 'approved', 'completo') THEN
    -- Resolução de duplicidade: localiza se o usuário já existe em public.usuarios
    v_existing_id := NULL;
    
    IF NEW.user_id IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE id = NEW.user_id;
    END IF;

    IF v_existing_id IS NULL AND NEW.telefone IS NOT NULL AND NEW.telefone != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE telefone = NEW.telefone;
    END IF;

    IF v_existing_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE LOWER(email) = LOWER(NEW.email);
    END IF;

    v_target_id := COALESCE(v_existing_id, NEW.user_id, gen_random_uuid());

    IF v_existing_id IS NOT NULL THEN
      -- Atualiza registro preservando roles administrativas se já existirem
      UPDATE public.usuarios SET
        nome = COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, public.usuarios.nome),
        email = COALESCE(NEW.email, public.usuarios.email),
        telefone = COALESCE(NEW.telefone, public.usuarios.telefone),
        role = CASE WHEN public.usuarios.role IN ('admin', 'superadmin', 'super_admin') THEN public.usuarios.role ELSE v_role END,
        status = 'ativo',
        cpf = COALESCE(NEW.cpf, NEW.responsavel_cpf, public.usuarios.cpf),
        cnpj = COALESCE(NEW.cnpj, public.usuarios.cnpj),
        razao_social = COALESCE(NEW.razao_social, public.usuarios.razao_social),
        padrinho_id = COALESCE(public.usuarios.padrinho_id, NEW.padrinho_id),
        metadata = COALESCE(public.usuarios.metadata, '{}'::jsonb) || jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', NEW.cadastro_completo
        ),
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      -- Insere novo registro em usuarios
      INSERT INTO public.usuarios (
        id,
        nome,
        email,
        telefone,
        role,
        status,
        cpf,
        cnpj,
        razao_social,
        padrinho_id,
        metadata
      ) VALUES (
        v_target_id,
        COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, 'Novo Usuário'),
        NEW.email,
        NEW.telefone,
        v_role,
        'ativo',
        COALESCE(NEW.cpf, NEW.responsavel_cpf),
        NEW.cnpj,
        NEW.razao_social,
        NEW.padrinho_id,
        jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', NEW.cadastro_completo
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Sincronização segura de user_id na waitlist a partir de auth.users (respeitando FK waitlist_user_id_fkey)
UPDATE public.waitlist w
SET user_id = au.id
FROM auth.users au
WHERE w.user_id IS NULL
  AND w.email IS NOT NULL
  AND LOWER(w.email) = LOWER(au.email);

-- 6. Garantir que todos os leads aprovados/completos constem sincronizados em public.usuarios
DO $$
DECLARE
  rec RECORD;
  v_is_pj boolean;
  v_role text;
  v_existing_id uuid;
  v_target_id uuid;
BEGIN
  FOR rec IN 
    SELECT * FROM public.waitlist 
    WHERE status IN ('aprovado', 'approved', 'completo') OR cadastro_completo = true
  LOOP
    v_is_pj := (
      rec.tipo_cadastro IN ('pj', 'associacao', 'PJ')
      OR rec.cnpj IS NOT NULL
      OR rec.razao_social IS NOT NULL
    );

    IF v_is_pj THEN
      v_role := 'associacao';
    ELSIF rec.role IN ('prestador', 'trabalhador') THEN
      v_role := 'prestador';
    ELSIF rec.role IN ('admin', 'superadmin', 'super_admin') THEN
      v_role := 'admin';
    ELSE
      v_role := 'tomador';
    END IF;

    v_existing_id := NULL;
    IF rec.user_id IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE id = rec.user_id;
    END IF;
    IF v_existing_id IS NULL AND rec.telefone IS NOT NULL AND rec.telefone != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE telefone = rec.telefone;
    END IF;
    IF v_existing_id IS NULL AND rec.email IS NOT NULL AND rec.email != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE LOWER(email) = LOWER(rec.email);
    END IF;

    v_target_id := COALESCE(v_existing_id, rec.user_id, gen_random_uuid());

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.usuarios SET
        nome = COALESCE(rec.razao_social, rec.nome, rec.responsavel_nome, public.usuarios.nome),
        email = COALESCE(rec.email, public.usuarios.email),
        telefone = COALESCE(rec.telefone, public.usuarios.telefone),
        role = CASE WHEN public.usuarios.role IN ('admin', 'superadmin', 'super_admin') THEN public.usuarios.role ELSE v_role END,
        status = 'ativo',
        cpf = COALESCE(rec.cpf, rec.responsavel_cpf, public.usuarios.cpf),
        cnpj = COALESCE(rec.cnpj, public.usuarios.cnpj),
        razao_social = COALESCE(rec.razao_social, public.usuarios.razao_social),
        padrinho_id = COALESCE(public.usuarios.padrinho_id, rec.padrinho_id),
        metadata = COALESCE(public.usuarios.metadata, '{}'::jsonb) || jsonb_build_object(
          'origem', CASE WHEN rec.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', rec.razao_social,
          'cnpj', rec.cnpj,
          'status_waitlist', rec.status,
          'role_waitlist', rec.role,
          'cadastro_completo', rec.cadastro_completo
        ),
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.usuarios (
        id,
        nome,
        email,
        telefone,
        role,
        status,
        cpf,
        cnpj,
        razao_social,
        padrinho_id,
        metadata
      ) VALUES (
        v_target_id,
        COALESCE(rec.razao_social, rec.nome, rec.responsavel_nome, 'Novo Usuário'),
        rec.email,
        rec.telefone,
        v_role,
        'ativo',
        COALESCE(rec.cpf, rec.responsavel_cpf),
        rec.cnpj,
        rec.razao_social,
        rec.padrinho_id,
        jsonb_build_object(
          'origem', CASE WHEN rec.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', rec.razao_social,
          'cnpj', rec.cnpj,
          'status_waitlist', rec.status,
          'role_waitlist', rec.role,
          'cadastro_completo', rec.cadastro_completo
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- 7. Recarregar configuração do PostgREST
NOTIFY pgrst, 'reload config';
