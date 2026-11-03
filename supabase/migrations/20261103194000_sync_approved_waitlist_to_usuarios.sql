-- ==============================================================================
-- MIGRATION: 20261103194000_sync_approved_waitlist_to_usuarios.sql
-- Descrição:
--   1. Garante compatibilidade de colunas na waitlist (tipo_cadastro, responsavel_cpf).
--   2. Garante constraint formal UNIQUE em telefone em public.usuarios para viabilizar ON CONFLICT (telefone).
--   3. Atualiza trigger sync_waitlist_to_usuarios para sincronizar quando cadastro_completo = true
--      OU quando status IN ('aprovado', 'approved'), vinculando dados de PF/PJ.
--   4. Sincroniza retroativamente os leads já aprovados que ainda não estavam em usuarios.
-- ==============================================================================

BEGIN;

-- 1. Remove temporariamente o trigger para não disparar durante updates estruturais
DROP TRIGGER IF EXISTS trg_sync_waitlist_usuarios ON public.waitlist;

-- 2. Garante compatibilidade de colunas na waitlist
ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS tipo_cadastro text,
  ADD COLUMN IF NOT EXISTS responsavel_cpf text;

UPDATE public.waitlist 
SET tipo_cadastro = COALESCE(tipo_cadastro, tipo_pessoa),
    responsavel_cpf = COALESCE(responsavel_cpf, cpf_responsavel);

-- 3. Garante constraint formal UNIQUE em telefone em public.usuarios para suportar ON CONFLICT (telefone)
ALTER TABLE public.usuarios 
  DROP CONSTRAINT IF EXISTS usuarios_telefone_key;

DELETE FROM public.usuarios a USING public.usuarios b
WHERE a.id < b.id 
  AND a.telefone = b.telefone 
  AND a.telefone IS NOT NULL;

ALTER TABLE public.usuarios 
  ADD CONSTRAINT usuarios_telefone_key UNIQUE (telefone);

-- 4. Cria a nova função trigger de sincronização atualizada e blindada
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_role text := CASE 
    WHEN NEW.role IN ('tomador', 'prestador', 'admin', 'associacao') THEN NEW.role
    WHEN NEW.perfil IS NOT NULL AND 'prestador' = ANY(NEW.perfil) THEN 'prestador'
    WHEN NEW.perfil IS NOT NULL AND 'associacao' = ANY(NEW.perfil) THEN 'associacao'
    ELSE 'tomador'
  END;
  v_nome text := COALESCE(NEW.nome, NEW.razao_social, NEW.responsavel_nome, 'Novo Usuário');
  v_cpf text := COALESCE(NEW.cpf, NEW.responsavel_cpf, NEW.cpf_responsavel);
  v_tipo text := COALESCE(NEW.tipo_cadastro, NEW.tipo_pessoa, 'PF');
  v_user_found boolean := false;
BEGIN
  -- Sincroniza se o cadastro foi marcado como completo OU se foi aprovado pela administração
  IF NEW.cadastro_completo = true OR NEW.status IN ('aprovado', 'approved') THEN
    
    -- Primeiro tenta atualizar usuário existente por telefone, e-mail ou user_id
    UPDATE public.usuarios
    SET nome = COALESCE(v_nome, public.usuarios.nome),
        telefone = COALESCE(NEW.telefone, public.usuarios.telefone),
        email = COALESCE(NEW.email, public.usuarios.email),
        status = 'ativo',
        cpf = COALESCE(public.usuarios.cpf, v_cpf),
        metadata = COALESCE(public.usuarios.metadata, '{}'::jsonb) || jsonb_build_object(
          'origem', 'waitlist_founder',
          'tipo_cadastro', v_tipo,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status
        ),
        updated_at = now()
    WHERE (NEW.telefone IS NOT NULL AND public.usuarios.telefone = NEW.telefone)
       OR (NEW.email IS NOT NULL AND lower(trim(public.usuarios.email)) = lower(trim(NEW.email)))
       OR (NEW.user_id IS NOT NULL AND public.usuarios.id = NEW.user_id);

    GET DIAGNOSTICS v_user_found = ROW_COUNT;

    -- Se não encontrou usuário existente, insere novo registro com fallback ON CONFLICT (telefone)
    IF v_user_found = false OR v_user_found IS NULL THEN
      INSERT INTO public.usuarios (
        id, nome, email, telefone, role, status, cpf, metadata
      ) VALUES (
        COALESCE(NEW.user_id, gen_random_uuid()),
        v_nome,
        NEW.email,
        NEW.telefone,
        v_role,
        'ativo',
        v_cpf,
        jsonb_build_object(
          'origem', 'waitlist_founder',
          'tipo_cadastro', v_tipo,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status
        )
      )
      ON CONFLICT (telefone) DO UPDATE SET 
        nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
        email = COALESCE(EXCLUDED.email, public.usuarios.email),
        status = 'ativo',
        metadata = public.usuarios.metadata || EXCLUDED.metadata,
        updated_at = now();
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- 5. Reativa o trigger na tabela waitlist
CREATE TRIGGER trg_sync_waitlist_usuarios
AFTER INSERT OR UPDATE ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.sync_waitlist_to_usuarios();

-- 6. Sincroniza retroativamente os leads já aprovados atualizando primeiro existentes por e-mail/user_id
UPDATE public.usuarios u
SET telefone = COALESCE(w.telefone, u.telefone),
    nome = COALESCE(w.nome, w.razao_social, w.responsavel_nome, u.nome),
    status = 'ativo',
    cpf = COALESCE(u.cpf, w.cpf, w.responsavel_cpf, w.cpf_responsavel),
    metadata = COALESCE(u.metadata, '{}'::jsonb) || jsonb_build_object(
      'origem', 'waitlist_founder',
      'tipo_cadastro', COALESCE(w.tipo_cadastro, w.tipo_pessoa, 'PF'),
      'razao_social', w.razao_social,
      'cnpj', w.cnpj,
      'status_waitlist', w.status
    ),
    updated_at = now()
FROM public.waitlist w
WHERE (w.status IN ('aprovado', 'approved') OR w.cadastro_completo = true)
  AND (
    (w.telefone IS NOT NULL AND u.telefone = w.telefone)
    OR (w.email IS NOT NULL AND lower(trim(u.email)) = lower(trim(w.email)))
    OR (w.user_id IS NOT NULL AND u.id = w.user_id)
  );

-- 7. Insere os aprovados que ainda não estão em usuarios
INSERT INTO public.usuarios (id, nome, email, telefone, role, status, cpf, metadata)
SELECT 
  COALESCE(w.user_id, gen_random_uuid()),
  COALESCE(w.nome, w.razao_social, w.responsavel_nome, 'Novo Usuário'),
  w.email,
  w.telefone,
  CASE 
    WHEN w.role IN ('tomador', 'prestador', 'admin', 'associacao') THEN w.role
    WHEN w.perfil IS NOT NULL AND 'prestador' = ANY(w.perfil) THEN 'prestador'
    WHEN w.perfil IS NOT NULL AND 'associacao' = ANY(w.perfil) THEN 'associacao'
    ELSE 'tomador'
  END,
  'ativo',
  COALESCE(w.cpf, w.responsavel_cpf, w.cpf_responsavel),
  jsonb_build_object(
    'origem', 'waitlist_founder',
    'tipo_cadastro', COALESCE(w.tipo_cadastro, w.tipo_pessoa, 'PF'),
    'razao_social', w.razao_social,
    'cnpj', w.cnpj,
    'status_waitlist', w.status
  )
FROM public.waitlist w
WHERE (w.status IN ('aprovado', 'approved') OR w.cadastro_completo = true)
  AND w.telefone IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios u 
    WHERE (u.telefone = w.telefone)
       OR (w.email IS NOT NULL AND lower(trim(u.email)) = lower(trim(w.email)))
       OR (w.user_id IS NOT NULL AND u.id = w.user_id)
  )
ON CONFLICT (telefone) DO UPDATE
SET 
  nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
  email = COALESCE(EXCLUDED.email, public.usuarios.email),
  status = 'ativo',
  updated_at = now();

COMMIT;

NOTIFY pgrst, 'reload config';
