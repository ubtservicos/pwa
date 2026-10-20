-- ==============================================================================
-- MIGRATION: 20261020180000_update_referral_generation_logic.sql
-- Descrição:
--   1. Atualiza a regra padrão de geração do referral_code no INSERT:
--      Padrão: [primeiro_nome_higienizado]-[3_primeiros_digitos_cpf] (ex: felipe-123).
--   2. Higienização de nome: primeira palavra, sem acentos, letras minúsculas.
--   3. Extração dos 3 primeiros dígitos numéricos do CPF.
--   4. Tratamento robusto de colisão: tenta nome-123; se já existir, tenta
--      nome-123-a, nome-123-b, ..., nome-123-z, e finalmente sufixos aleatórios curtos.
--   5. Fallback automático: caso o cadastro não possua Nome ou CPF válidos,
--      gera código aleatório de 6 caracteres alfanuméricos.
--   6. Atualiza os Triggers BEFORE INSERT em usuarios e waitlist.
-- ==============================================================================

BEGIN;

-- 1. Função pura para remover acentos (sem dependência de extensões externas)
CREATE OR REPLACE FUNCTION public.sanitize_unaccent(p_text text)
RETURNS text AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;
  RETURN translate(
    p_text,
    'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïīĭįİÍÌÎÏĪĬĮIóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćčÇĆČñńňÑŃŇýÿÝ',
    'aaaaaaaaaAAAAAAAAAeeeeeeeeeEEEEEEEEEiiiiiiiiIIIIIIIIoooooooooOOOOOOOOOuuuuuuuuuuUUUUUUUUUUcccCCCnnnNNNyyY'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Função para higienizar o primeiro nome
CREATE OR REPLACE FUNCTION public.clean_first_name(p_name text)
RETURNS text AS $$
DECLARE
  v_first_word text;
  v_cleaned text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN '';
  END IF;

  -- Extrai apenas a primeira palavra considerando espaços ou hífens
  v_first_word := (regexp_split_to_array(trim(p_name), '[\s\-_]+'))[1];
  -- Remove acentos
  v_cleaned := public.sanitize_unaccent(v_first_word);
  -- Converte para minúsculas e remove qualquer caractere não alfanumérico
  v_cleaned := lower(regexp_replace(v_cleaned, '[^a-zA-Z0-9]', '', 'g'));

  RETURN v_cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Função geradora dinâmica com tratamento rigoroso de colisão
CREATE OR REPLACE FUNCTION public.generate_referral_code_for_user(
  p_nome text,
  p_cpf text
)
RETURNS text AS $$
DECLARE
  v_first_name text;
  v_cpf_digits text;
  v_cpf_prefix text;
  v_base_code text;
  v_candidate text;
  v_suffix_code int;
  v_exists bool;
BEGIN
  -- Extração e higienização do primeiro nome
  v_first_name := public.clean_first_name(p_nome);

  -- Extração dos 3 primeiros dígitos do CPF
  v_cpf_digits := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF length(v_cpf_digits) >= 3 THEN
    v_cpf_prefix := substr(v_cpf_digits, 1, 3);
  ELSE
    v_cpf_prefix := '';
  END IF;

  -- Montagem da base ou acionamento do fallback aleatório
  IF v_first_name <> '' AND v_cpf_prefix <> '' THEN
    v_base_code := v_first_name || '-' || v_cpf_prefix;
  ELSE
    -- Fallback: código aleatório de 6 caracteres caso falte Nome ou CPF
    LOOP
      v_base_code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      SELECT (
        EXISTS (SELECT 1 FROM public.usuarios WHERE lower(referral_code) = v_base_code)
        OR EXISTS (SELECT 1 FROM public.waitlist WHERE lower(referral_code) = v_base_code)
      ) INTO v_exists;
      IF NOT v_exists THEN
        RETURN v_base_code;
      END IF;
    END LOOP;
  END IF;

  -- Tentativa 1: O código base exato (ex: felipe-123)
  v_candidate := v_base_code;
  SELECT (
    EXISTS (SELECT 1 FROM public.usuarios WHERE lower(referral_code) = v_candidate)
    OR EXISTS (SELECT 1 FROM public.waitlist WHERE lower(referral_code) = v_candidate)
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN v_candidate;
  END IF;

  -- Tentativa 2: Sufixos alfabéticos sequenciais (-a até -z: felipe-123-a, felipe-123-b, ...)
  FOR v_suffix_code IN 97..122 LOOP
    v_candidate := v_base_code || '-' || chr(v_suffix_code);
    SELECT (
      EXISTS (SELECT 1 FROM public.usuarios WHERE lower(referral_code) = v_candidate)
      OR EXISTS (SELECT 1 FROM public.waitlist WHERE lower(referral_code) = v_candidate)
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;

  -- Tentativa 3: Fallback de colisão extrema com sufixo aleatório curto (3 caracteres)
  LOOP
    v_candidate := v_base_code || '-' || lower(substr(md5(random()::text || clock_timestamp()::text), 1, 3));
    SELECT (
      EXISTS (SELECT 1 FROM public.usuarios WHERE lower(referral_code) = v_candidate)
      OR EXISTS (SELECT 1 FROM public.waitlist WHERE lower(referral_code) = v_candidate)
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 4. Mantém compatibilidade com chamadas sem argumentos
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text AS $$
BEGIN
  RETURN public.generate_referral_code_for_user(NULL, NULL);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 5. Atualização da Função de Trigger para capturar NEW.nome e NEW.cpf
CREATE OR REPLACE FUNCTION public.trg_set_default_referral_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_referral_code_for_user(NEW.nome, NEW.cpf);
  ELSE
    -- Higienização básica caso já venha preenchido
    NEW.referral_code := lower(trim(NEW.referral_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Recriação dos Triggers BEFORE INSERT
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

-- 7. Concessão de permissões de execução
GRANT EXECUTE ON FUNCTION public.sanitize_unaccent(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clean_first_name(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_referral_code_for_user(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
