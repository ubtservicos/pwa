-- Migration: 20261125120000_fix_mototaxi_kyc_submission.sql
-- Purpose:
--   1. Add missing UNIQUE(user_id) and brand_model column on public.prestador_mototaxi (idempotent).
--   2. Add helper public.is_current_usuario(uuid) for legacy accounts (auth.users.id != public.usuarios.id).
--   3. Update RLS policies on public.prestador_mototaxi and public.mototaxi_sessoes to support legacy accounts.
--   4. Create SECURITY DEFINER RPCs public.get_my_mototaxi_profile() and public.submit_mototaxi_kyc(...)
--      so Mototaxista KYC submission works reliably for both standard and legacy accounts and populates
--      the exact table/status read by /admin/kyc-pendentes.

-- 1. Ensure brand_model column exists
ALTER TABLE public.prestador_mototaxi
  ADD COLUMN IF NOT EXISTS brand_model text;

-- 2. Deduplicate any repeated user_id rows (keep most recent) and enforce UNIQUE(user_id)
DELETE FROM public.prestador_mototaxi a
USING public.prestador_mototaxi b
WHERE a.user_id = b.user_id
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.id < b.id)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.prestador_mototaxi'::regclass
      AND conname = 'prestador_mototaxi_user_id_key'
  ) THEN
    ALTER TABLE public.prestador_mototaxi
      ADD CONSTRAINT prestador_mototaxi_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Helper to match authenticated user against public.usuarios.id (including legacy UUID mismatch)
CREATE OR REPLACE FUNCTION public.is_current_usuario(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      p_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = p_user_id
          AND coalesce(auth.jwt() ->> 'email', '') <> ''
          AND lower(coalesce(u.email, '')) = lower(auth.jwt() ->> 'email')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_current_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_usuario(uuid) TO authenticated;

-- 4. Update RLS policies on public.prestador_mototaxi and public.mototaxi_sessoes
DROP POLICY IF EXISTS "moto_insert" ON public.prestador_mototaxi;
CREATE POLICY "moto_insert"
  ON public.prestador_mototaxi
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "moto_update" ON public.prestador_mototaxi;
CREATE POLICY "moto_update"
  ON public.prestador_mototaxi
  FOR UPDATE
  TO authenticated
  USING (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin())
  WITH CHECK (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "moto_delete" ON public.prestador_mototaxi;
CREATE POLICY "moto_delete"
  ON public.prestador_mototaxi
  FOR DELETE
  TO authenticated
  USING (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "Modificação própria ou admin para mototaxi_sessoes" ON public.mototaxi_sessoes;
CREATE POLICY "Modificação própria ou admin para mototaxi_sessoes"
  ON public.mototaxi_sessoes
  FOR ALL
  TO authenticated
  USING (public.is_current_usuario(prestador_id) OR is_admin())
  WITH CHECK (public.is_current_usuario(prestador_id) OR is_admin());

-- 5. RPC: get_my_mototaxi_profile()
CREATE OR REPLACE FUNCTION public.get_my_mototaxi_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_usuario public.usuarios%ROWTYPE;
  v_moto public.prestador_mototaxi%ROWTYPE;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT * INTO v_usuario
  FROM public.usuarios
  WHERE id = v_auth_uid
  LIMIT 1;

  IF v_usuario.id IS NULL AND v_jwt_email <> '' THEN
    SELECT * INTO v_usuario
    FROM public.usuarios
    WHERE lower(trim(coalesce(email, ''))) = v_jwt_email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_usuario.id IS NOT NULL THEN
    SELECT * INTO v_moto
    FROM public.prestador_mototaxi
    WHERE user_id = v_usuario.id
    LIMIT 1;
  END IF;

  IF v_moto.id IS NULL THEN
    SELECT * INTO v_moto
    FROM public.prestador_mototaxi
    WHERE user_id = v_auth_uid
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', coalesce(v_usuario.id, v_auth_uid),
    'usuario', CASE WHEN v_usuario.id IS NOT NULL THEN jsonb_build_object(
      'id', v_usuario.id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'role', v_usuario.role,
      'status', v_usuario.status,
      'under_review', v_usuario.under_review,
      'cpf', v_usuario.cpf,
      'telefone', v_usuario.telefone
    ) ELSE NULL END,
    'mototaxi', CASE WHEN v_moto.id IS NOT NULL THEN to_jsonb(v_moto) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_mototaxi_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_mototaxi_profile() TO authenticated;

-- 6. RPC: submit_mototaxi_kyc(...)
CREATE OR REPLACE FUNCTION public.submit_mototaxi_kyc(
  p_cpf text,
  p_plate text,
  p_brand_model text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_modalidade text DEFAULT 'carona_entrega',
  p_cnh_frente_url text DEFAULT NULL,
  p_cnh_verso_url text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_crlv_url text DEFAULT NULL,
  p_moto_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_usuario_id uuid;
  v_cpf_clean text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_cpf_formatted text;
  v_plate_clean text := upper(trim(coalesce(p_plate, '')));
  v_brand_clean text := nullif(trim(coalesce(p_brand_model, '')), '');
  v_gender_norm text;
  v_modalidade_norm text := lower(trim(coalesce(p_modalidade, 'carona_entrega')));
  v_existing_status text;
  v_next_status text;
  v_conflict_user uuid;
  v_result public.prestador_mototaxi%ROWTYPE;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sessão expirada. Faça login novamente.');
  END IF;

  IF length(v_cpf_clean) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido. Informe os 11 dígitos na aba Pessoal.');
  END IF;

  v_cpf_formatted := substr(v_cpf_clean, 1, 3) || '.' || substr(v_cpf_clean, 4, 3) || '.' || substr(v_cpf_clean, 7, 3) || '-' || substr(v_cpf_clean, 10, 2);

  IF length(regexp_replace(v_plate_clean, '[^A-Z0-9]', '', 'g')) < 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Placa da moto inválida. Informe a placa completa na aba Dados Veículo.');
  END IF;

  IF v_modalidade_norm NOT IN ('carona_entrega', 'so_entrega', 'so_carona') THEN
    v_modalidade_norm := 'carona_entrega';
  END IF;

  IF lower(coalesce(p_gender, '')) IN ('f', 'feminino') THEN
    v_gender_norm := 'feminino';
  ELSIF lower(coalesce(p_gender, '')) IN ('m', 'masculino') THEN
    v_gender_norm := 'masculino';
  ELSE
    v_gender_norm := NULL;
  END IF;

  -- Resolve usuario_id (direct auth.uid() or legacy email fallback)
  SELECT id INTO v_usuario_id
  FROM public.usuarios
  WHERE id = v_auth_uid
  LIMIT 1;

  IF v_usuario_id IS NULL AND v_jwt_email <> '' THEN
    SELECT id INTO v_usuario_id
    FROM public.usuarios
    WHERE lower(trim(coalesce(email, ''))) = v_jwt_email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_usuario_id IS NULL THEN
    INSERT INTO public.usuarios (id, email, nome, role, status, under_review, cpf)
    VALUES (
      v_auth_uid,
      nullif(v_jwt_email, ''),
      coalesce(nullif(split_part(v_jwt_email, '@', 1), ''), 'Mototaxista'),
      'tomador',
      'ativo',
      true,
      v_cpf_clean
    )
    ON CONFLICT (id) DO NOTHING;
    v_usuario_id := v_auth_uid;
  END IF;

  -- Check if CPF is already bound to a different mototaxi user
  SELECT user_id INTO v_conflict_user
  FROM public.prestador_mototaxi
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_clean
    AND user_id <> v_usuario_id
  LIMIT 1;

  IF v_conflict_user IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este CPF já está cadastrado em outra conta de Mototaxista.');
  END IF;

  SELECT kyc_status INTO v_existing_status
  FROM public.prestador_mototaxi
  WHERE user_id = v_usuario_id
  LIMIT 1;

  v_next_status := CASE WHEN v_existing_status = 'approved' THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.prestador_mototaxi (
    user_id,
    cpf,
    plate,
    brand_model,
    gender,
    modalidade,
    kyc_status,
    is_online,
    cnh_frente_url,
    cnh_verso_url,
    cnh_photo_url,
    crlv_url,
    moto_photo_url,
    selfie_url,
    updated_at
  )
  VALUES (
    v_usuario_id,
    v_cpf_formatted,
    v_plate_clean,
    v_brand_clean,
    v_gender_norm,
    v_modalidade_norm,
    v_next_status,
    false,
    nullif(trim(coalesce(p_cnh_frente_url, '')), ''),
    nullif(trim(coalesce(p_cnh_verso_url, '')), ''),
    nullif(trim(coalesce(p_cnh_frente_url, '')), ''),
    nullif(trim(coalesce(p_crlv_url, '')), ''),
    nullif(trim(coalesce(p_moto_photo_url, '')), ''),
    nullif(trim(coalesce(p_selfie_url, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cpf = EXCLUDED.cpf,
    plate = EXCLUDED.plate,
    brand_model = COALESCE(EXCLUDED.brand_model, public.prestador_mototaxi.brand_model),
    gender = COALESCE(EXCLUDED.gender, public.prestador_mototaxi.gender),
    modalidade = EXCLUDED.modalidade,
    kyc_status = v_next_status,
    cnh_frente_url = COALESCE(EXCLUDED.cnh_frente_url, public.prestador_mototaxi.cnh_frente_url),
    cnh_verso_url = COALESCE(EXCLUDED.cnh_verso_url, public.prestador_mototaxi.cnh_verso_url),
    cnh_photo_url = COALESCE(EXCLUDED.cnh_photo_url, public.prestador_mototaxi.cnh_photo_url),
    crlv_url = COALESCE(EXCLUDED.crlv_url, public.prestador_mototaxi.crlv_url),
    moto_photo_url = COALESCE(EXCLUDED.moto_photo_url, public.prestador_mototaxi.moto_photo_url),
    selfie_url = COALESCE(EXCLUDED.selfie_url, public.prestador_mototaxi.selfie_url),
    updated_at = now()
  RETURNING * INTO v_result;

  -- Mark user as under_review when pending approval, and fill CPF if empty
  UPDATE public.usuarios
  SET
    under_review = CASE WHEN v_next_status = 'approved' THEN false ELSE true END,
    cpf = COALESCE(NULLIF(trim(coalesce(cpf, '')), ''), v_cpf_clean)
  WHERE id = v_usuario_id;

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', v_usuario_id,
    'kyc_status', v_result.kyc_status,
    'record', to_jsonb(v_result)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_mototaxi_kyc(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_mototaxi_kyc(text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- 7. Reload PostgREST schema & config cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
