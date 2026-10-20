-- ==============================================================================
-- MIGRATION: 20261020170000_referral_code_customization.sql
-- Descrição:
--   1. Adiciona coluna referral_code (texto, único) em usuarios, waitlist e profiles.
--   2. Gatilhos para gerar automaticamente código curto (6 caracteres alfanuméricos)
--      em novas inserções caso não informado.
--   3. Script para popular utilizadores existentes que não possuam código.
--   4. Índices parciais de unicidade (case-insensitive).
--   5. Funções RPC para validação de disponibilidade (check_referral_code_available),
--      alteração segura (set_user_referral_code) e busca de fundador (buscar_fundador_identificador).
-- ==============================================================================

BEGIN;

-- 1. Colunas de referral_code
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS referral_code text;

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS referral_code text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
  END IF;
END $$;

-- 2. Função geradora de código curto único (6 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text AS $$
DECLARE
  new_code text;
  done bool := false;
  attempts int := 0;
BEGIN
  WHILE NOT done AND attempts < 100 LOOP
    attempts := attempts + 1;
    -- Gera 6 caracteres hex/alfanuméricos minúsculos
    new_code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    
    -- Verifica ausência em usuarios e waitlist
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE lower(referral_code) = new_code)
       AND NOT EXISTS (SELECT 1 FROM public.waitlist WHERE lower(referral_code) = new_code) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Gatilho para preencher automaticamente em novos cadastros
CREATE OR REPLACE FUNCTION public.trg_set_default_referral_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_unique_referral_code();
  ELSE
    -- Garante formato sanitizado: minúsculas e sem espaços
    NEW.referral_code := lower(trim(NEW.referral_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_set_referral_code ON public.usuarios;
CREATE TRIGGER trg_usuarios_set_referral_code
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_default_referral_code();

DROP TRIGGER IF EXISTS trg_waitlist_set_referral_code ON public.waitlist;
CREATE TRIGGER trg_waitlist_set_referral_code
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_default_referral_code();

-- 4. Script de preenchimento para utilizadores existentes sem código
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.usuarios WHERE referral_code IS NULL OR trim(referral_code) = '' LOOP
    UPDATE public.usuarios SET referral_code = public.generate_unique_referral_code() WHERE id = rec.id;
  END LOOP;

  FOR rec IN SELECT id FROM public.waitlist WHERE referral_code IS NULL OR trim(referral_code) = '' LOOP
    UPDATE public.waitlist SET referral_code = public.generate_unique_referral_code() WHERE id = rec.id;
  END LOOP;
END $$;

-- 5. Criação de índices parciais de unicidade
DROP INDEX IF EXISTS public.usuarios_referral_code_unique_idx;
CREATE UNIQUE INDEX usuarios_referral_code_unique_idx
  ON public.usuarios (lower(trim(referral_code)))
  WHERE referral_code IS NOT NULL AND trim(referral_code) <> '';

DROP INDEX IF EXISTS public.waitlist_referral_code_unique_idx;
CREATE UNIQUE INDEX waitlist_referral_code_unique_idx
  ON public.waitlist (lower(trim(referral_code)))
  WHERE referral_code IS NOT NULL AND trim(referral_code) <> '';

-- 6. RPC para validação de disponibilidade de código
CREATE OR REPLACE FUNCTION public.check_referral_code_available(p_code text, p_exclude_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  clean_code text := lower(trim(p_code));
BEGIN
  -- Regra: apenas letras minúsculas, números e hífens (entre 3 e 40 caracteres)
  IF clean_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(clean_code) < 3 OR length(clean_code) > 40 THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE lower(referral_code) = clean_code
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.waitlist
    WHERE lower(referral_code) = clean_code
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC para alteração segura de código de indicação
CREATE OR REPLACE FUNCTION public.set_user_referral_code(
  p_user_id uuid,
  p_code text
)
RETURNS jsonb AS $$
DECLARE
  clean_code text := lower(trim(p_code));
  is_admin boolean := false;
  current_uid uuid := auth.uid();
  target_email text;
BEGIN
  -- Validação estrita do formato
  IF clean_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(clean_code) < 3 OR length(clean_code) > 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O código deve conter apenas letras minúsculas, números e hífens (entre 3 e 40 caracteres).');
  END IF;

  -- Checagem de permissão administrativa
  IF current_uid IS NOT NULL THEN
    SELECT (role IN ('super_admin', 'admin', 'operator') OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com')
      INTO is_admin
      FROM public.usuarios
     WHERE id = current_uid;
  END IF;

  -- Se não for admin, só pode alterar o próprio código
  IF current_uid IS NOT NULL AND current_uid <> p_user_id AND NOT COALESCE(is_admin, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada para alterar este código.');
  END IF;

  -- Validação de disponibilidade
  IF NOT public.check_referral_code_available(clean_code, p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código de indicação já está em uso.');
  END IF;

  -- Atualiza em usuarios
  UPDATE public.usuarios
     SET referral_code = clean_code
   WHERE id = p_user_id;

  SELECT email INTO target_email FROM public.usuarios WHERE id = p_user_id;

  -- Atualiza em waitlist por id ou por e-mail correspondente
  UPDATE public.waitlist
     SET referral_code = clean_code
   WHERE id = p_user_id
      OR (target_email IS NOT NULL AND lower(email) = lower(target_email));

  RETURN jsonb_build_object('success', true, 'referral_code', clean_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC para localização de fundador (E-mail, CPF ou Telefone)
CREATE OR REPLACE FUNCTION public.buscar_fundador_identificador(p_identificador text)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  referral_code text
) AS $$
DECLARE
  clean_doc text := regexp_replace(p_identificador, '\D', '', 'g');
  clean_email text := lower(trim(p_identificador));
BEGIN
  -- Busca por E-mail
  IF clean_email LIKE '%@%' THEN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.telefone, u.referral_code
    FROM public.usuarios u
    WHERE lower(u.email) = clean_email
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    RETURN QUERY
    SELECT w.id, w.nome, w.email, w.telefone, w.referral_code
    FROM public.waitlist w
    WHERE lower(w.email) = clean_email
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Busca por CPF
  IF length(clean_doc) >= 11 THEN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.telefone, u.referral_code
    FROM public.usuarios u
    WHERE regexp_replace(COALESCE(u.cpf, ''), '\D', '', 'g') = clean_doc
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    RETURN QUERY
    SELECT w.id, w.nome, w.email, w.telefone, w.referral_code
    FROM public.waitlist w
    WHERE regexp_replace(COALESCE(w.cpf, ''), '\D', '', 'g') = clean_doc
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Busca por Telefone
  IF length(clean_doc) >= 8 THEN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.telefone, u.referral_code
    FROM public.usuarios u
    WHERE regexp_replace(COALESCE(u.telefone, ''), '\D', '', 'g') LIKE '%' || clean_doc || '%'
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    RETURN QUERY
    SELECT w.id, w.nome, w.email, w.telefone, w.referral_code
    FROM public.waitlist w
    WHERE regexp_replace(COALESCE(w.telefone, ''), '\D', '', 'g') LIKE '%' || clean_doc || '%'
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Concessão de permissões de execução
GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_referral_code_available(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_referral_code(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_fundador_identificador(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
