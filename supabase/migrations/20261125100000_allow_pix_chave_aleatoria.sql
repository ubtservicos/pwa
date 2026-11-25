-- ============================================================================
-- UBT: Liberacao Explicita e Normalizacao de Chave PIX Aleatoria (EVP)
-- Idempotent migration (DDL/RPC only — zero data modification)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.salvar_chave_pix_usuario(
  p_user_id uuid,
  p_chave_pix text,
  p_tipo_chave_pix text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_clean_pix text := NULLIF(trim(coalesce(p_chave_pix, '')), '');
  v_raw_tipo text := lower(trim(coalesce(p_tipo_chave_pix, '')));
  v_clean_tipo text;
  v_target_usuario_id uuid;
  v_liberados int := 0;
  v_count_tom int := 0;
  v_count_prest int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para atualizar chave PIX.';
  END IF;

  IF v_uid <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar chave PIX de outro usuário.';
  END IF;

  IF v_clean_pix IS NULL THEN
    RAISE EXCEPTION 'Chave PIX inválida ou vazia.';
  END IF;

  -- Normaliza aliases legados (evp, random, chave_aleatoria, aleatória) para 'aleatoria'
  v_clean_tipo := CASE
    WHEN v_raw_tipo IN ('aleatoria', 'aleatória', 'evp', 'random', 'chave_aleatoria', 'chave aleatoria') THEN 'aleatoria'
    WHEN v_raw_tipo IN ('cpf') THEN 'cpf'
    WHEN v_raw_tipo IN ('cnpj') THEN 'cnpj'
    WHEN v_raw_tipo IN ('email', 'e-mail') THEN 'email'
    WHEN v_raw_tipo IN ('telefone', 'celular', 'phone') THEN 'telefone'
    WHEN v_raw_tipo = '' THEN NULL
    ELSE NULL
  END;

  IF v_raw_tipo <> '' AND v_clean_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo de chave PIX inválido. Use: cpf, cnpj, email, telefone ou aleatoria.'
      USING ERRCODE = '22023';
  END IF;

  -- Localiza registro em public.usuarios por id ou fallback por e-mail autenticado (contas legadas)
  SELECT id
    INTO v_target_usuario_id
    FROM public.usuarios
   WHERE id = p_user_id
   LIMIT 1;

  IF v_target_usuario_id IS NULL AND v_uid = p_user_id AND v_email <> '' THEN
    SELECT id
      INTO v_target_usuario_id
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  v_target_usuario_id := COALESCE(v_target_usuario_id, p_user_id);

  -- Conta quantos repasses contingenciados serão liberados
  SELECT count(*) INTO v_count_tom
    FROM public.pagamentos_split
   WHERE godparent_tomador_id IN (p_user_id, v_target_usuario_id)
     AND status_repasse_godparent_tomador = 'contingenciado';

  SELECT count(*) INTO v_count_prest
    FROM public.pagamentos_split
   WHERE godparent_prestador_id IN (p_user_id, v_target_usuario_id)
     AND status_repasse_godparent_prestador = 'contingenciado';

  v_liberados := v_count_tom + v_count_prest;

  -- Atualiza public.usuarios (dispara trigger de liberação de contingenciamento se existir)
  UPDATE public.usuarios
     SET chave_pix = v_clean_pix,
         tipo_chave_pix = COALESCE(v_clean_tipo, tipo_chave_pix, 'aleatoria'),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'chave_pix', v_clean_pix,
           'tipo_chave_pix', COALESCE(v_clean_tipo, tipo_chave_pix, 'aleatoria')
         ),
         updated_at = now()
   WHERE id = v_target_usuario_id;

  -- Espelha em public.waitlist quando existir vínculo
  UPDATE public.waitlist
     SET chave_pix = v_clean_pix,
         tipo_chave_pix = COALESCE(v_clean_tipo, tipo_chave_pix, 'aleatoria'),
         updated_at = now()
   WHERE user_id IN (p_user_id, v_target_usuario_id);

  -- Espelha em public.profiles quando existir vínculo
  UPDATE public.profiles
     SET pix_key = v_clean_pix,
         updated_at = now()
   WHERE id IN (p_user_id, v_target_usuario_id);

  RETURN jsonb_build_object(
    'success', true,
    'usuario_id', v_target_usuario_id,
    'chave_pix', v_clean_pix,
    'tipo_chave_pix', COALESCE(v_clean_tipo, 'aleatoria'),
    'repasses_liberados', v_liberados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_chave_pix_usuario(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
