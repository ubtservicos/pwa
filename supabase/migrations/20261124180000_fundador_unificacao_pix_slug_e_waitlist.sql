-- ============================================================================
-- UBT: Unificacao /sou-fundador, Persistencia Definitiva da Chave PIX,
-- Login Flexivel (Telefone/Email/CPF/CNPJ), Customizacao de Slug e Garantia
-- de Slug na Aprovacao da Waitlist
-- Idempotent migration (DDL/RPC only — zero data transfer)
-- ============================================================================

-- 1. Coluna cadastro_completo em public.usuarios (fonte unica de verdade)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS cadastro_completo boolean NOT NULL DEFAULT false;

UPDATE public.usuarios
   SET cadastro_completo = true
 WHERE cadastro_completo = false
   AND lower(coalesce(metadata ->> 'cadastro_completo', '')) = 'true';

-- 2. Helper interno para normalizar e garantir referral_code unico (nunca membro-722)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_slug(
  p_base_name text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_candidate text;
  v_suffix text;
  v_exists boolean;
  v_attempt int := 0;
BEGIN
  v_clean := lower(trim(coalesce(p_base_name, '')));
  v_clean := translate(
    v_clean,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  v_clean := regexp_replace(v_clean, '[^a-z0-9]+', '-', 'g');
  v_clean := regexp_replace(v_clean, '-+', '-', 'g');
  v_clean := trim(both '-' from v_clean);
  v_clean := left(v_clean, 28);
  v_clean := trim(both '-' from v_clean);

  IF length(v_clean) < 3 THEN
    v_clean := 'ubt-' || substr(md5(coalesce(p_exclude_user_id::text, gen_random_uuid()::text)), 1, 6);
  END IF;

  v_candidate := v_clean;

  LOOP
    SELECT EXISTS (
      SELECT 1
        FROM public.usuarios u
       WHERE lower(trim(coalesce(u.referral_code, ''))) = v_candidate
         AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;

    v_attempt := v_attempt + 1;
    v_suffix := substr(md5(v_clean || '-' || v_attempt::text || '-' || coalesce(p_exclude_user_id::text, clock_timestamp()::text)), 1, 4);
    v_candidate := left(v_clean, 34) || '-' || v_suffix;

    IF v_attempt >= 25 THEN
      v_candidate := 'ubt-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- 3. Estender resolve_cadastral_login_email com suporte a p_cpf (mantendo 100% retrocompatibilidade)
DROP FUNCTION IF EXISTS public.resolve_cadastral_login_email(text, text, text);
DROP FUNCTION IF EXISTS public.resolve_cadastral_login_email(text, text);

CREATE OR REPLACE FUNCTION public.resolve_cadastral_login_email(
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_input_email text := lower(trim(coalesce(p_email, '')));
  v_last8 text := '';
  v_email text := NULL;
  v_tipo_pessoa text := NULL;
  v_row record;
BEGIN
  IF length(v_tel) > 10 AND v_tel LIKE '55%' THEN
    v_tel := substr(v_tel, 3);
  END IF;
  IF length(v_tel) >= 8 THEN
    v_last8 := right(v_tel, 8);
  END IF;

  -- 1. Resolucao prioritaria por CNPJ (Entidade / PJ)
  IF length(v_cnpj) >= 14 THEN
    SELECT
      u.id,
      u.email AS user_email,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.usuarios u
    LEFT JOIN auth.users au
      ON au.id = u.id
      OR (u.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(u.email)))
    WHERE regexp_replace(coalesce(u.cnpj, ''), '\D', '', 'g') = v_cnpj
    ORDER BY
      (au.id = u.id) DESC NULLS LAST,
      (au.id IS NOT NULL) DESC,
      u.updated_at DESC NULLS LAST,
      u.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'email', coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.user_email), '')),
        'tipo_pessoa', 'PJ',
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    SELECT
      w.email AS wl_email,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.waitlist w
    LEFT JOIN auth.users au
      ON w.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(w.email))
    WHERE regexp_replace(coalesce(w.cnpj, ''), '\D', '', 'g') = v_cnpj
    ORDER BY
      (au.id IS NOT NULL) DESC,
      w.created_at_utc DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'email', coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.wl_email), '')),
        'tipo_pessoa', 'PJ',
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    RETURN jsonb_build_object(
      'email', NULL,
      'tipo_pessoa', NULL,
      'has_auth_account', false,
      'has_password', false,
      'auth_provider', NULL,
      'has_legacy_profile', false
    );
  END IF;

  -- 2. Resolucao por CPF (Pessoa Fisica ou responsavel)
  IF length(v_cpf) = 11 THEN
    SELECT
      u.id,
      u.email AS user_email,
      u.tipo_pessoa,
      u.role,
      u.cnpj,
      u.metadata,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.usuarios u
    LEFT JOIN auth.users au
      ON au.id = u.id
      OR (u.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(u.email)))
    WHERE regexp_replace(coalesce(u.cpf, ''), '\D', '', 'g') = v_cpf
       OR regexp_replace(coalesce(u.cpf_responsavel, ''), '\D', '', 'g') = v_cpf
    ORDER BY
      (regexp_replace(coalesce(u.cpf, ''), '\D', '', 'g') = v_cpf) DESC,
      (au.id = u.id) DESC NULLS LAST,
      (au.id IS NOT NULL) DESC,
      u.updated_at DESC NULLS LAST,
      u.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.user_email), ''));
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.role, '')) = 'associacao'
          OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    SELECT
      w.email AS wl_email,
      w.tipo_pessoa,
      w.tipo_cadastro,
      w.cnpj,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.waitlist w
    LEFT JOIN auth.users au
      ON w.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(w.email))
    WHERE regexp_replace(coalesce(w.cpf, ''), '\D', '', 'g') = v_cpf
       OR regexp_replace(coalesce(w.cpf_responsavel, ''), '\D', '', 'g') = v_cpf
       OR regexp_replace(coalesce(w.responsavel_cpf, ''), '\D', '', 'g') = v_cpf
    ORDER BY
      (au.id IS NOT NULL) DESC,
      w.created_at_utc DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.wl_email), ''));
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.tipo_cadastro, '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    RETURN jsonb_build_object(
      'email', NULL,
      'tipo_pessoa', NULL,
      'has_auth_account', false,
      'has_password', false,
      'auth_provider', NULL,
      'has_legacy_profile', false
    );
  END IF;

  -- 3. Resolucao direta por E-mail
  IF v_input_email <> '' AND position('@' in v_input_email) > 1 THEN
    SELECT
      u.id AS usuario_id,
      u.email AS user_email,
      u.tipo_pessoa,
      u.role,
      u.cnpj,
      u.metadata,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.usuarios u
    LEFT JOIN auth.users au
      ON au.id = u.id
      OR lower(trim(au.email)) = lower(trim(u.email))
    WHERE lower(trim(coalesce(u.email, ''))) = v_input_email
    ORDER BY
      (au.id = u.id) DESC NULLS LAST,
      (au.id IS NOT NULL) DESC,
      u.updated_at DESC NULLS LAST,
      u.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.user_email), ''));
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.role, '')) = 'associacao'
          OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    SELECT
      au.id AS auth_id,
      au.email AS auth_email,
      (au.encrypted_password IS NOT NULL AND au.encrypted_password <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM auth.users au
    WHERE lower(trim(coalesce(au.email, ''))) = v_input_email
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'email', trim(v_row.auth_email),
        'tipo_pessoa', 'PF',
        'has_auth_account', true,
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', false
      );
    END IF;

    SELECT
      w.email AS wl_email,
      w.tipo_pessoa,
      w.tipo_cadastro,
      w.cnpj,
      w.razao_social
    INTO v_row
    FROM public.waitlist w
    WHERE lower(trim(coalesce(w.email, ''))) = v_input_email
    ORDER BY w.created_at_utc DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.tipo_cadastro, '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
          OR nullif(trim(coalesce(v_row.razao_social, '')), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', trim(v_row.wl_email),
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', false,
        'has_password', false,
        'auth_provider', NULL,
        'has_legacy_profile', true
      );
    END IF;

    RETURN jsonb_build_object(
      'email', NULL,
      'tipo_pessoa', NULL,
      'has_auth_account', false,
      'has_password', false,
      'auth_provider', NULL,
      'has_legacy_profile', false
    );
  END IF;

  -- 4. Resolucao por Telefone
  IF length(v_tel) >= 8 THEN
    SELECT
      u.id,
      u.email AS user_email,
      u.tipo_pessoa,
      u.role,
      u.cnpj,
      u.metadata,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.usuarios u
    LEFT JOIN auth.users au
      ON au.id = u.id
      OR (u.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(u.email)))
    WHERE regexp_replace(coalesce(u.telefone, ''), '\D', '', 'g') = v_tel
       OR (
         length(regexp_replace(coalesce(u.telefone, ''), '\D', '', 'g')) >= 8
         AND right(regexp_replace(coalesce(u.telefone, ''), '\D', '', 'g'), 8) = v_last8
       )
    ORDER BY
      (regexp_replace(coalesce(u.telefone, ''), '\D', '', 'g') = v_tel) DESC,
      (au.id = u.id) DESC NULLS LAST,
      (au.id IS NOT NULL) DESC,
      u.updated_at DESC NULLS LAST,
      u.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.user_email), ''));
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.role, '')) = 'associacao'
          OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;

    SELECT
      w.email AS wl_email,
      w.tipo_pessoa,
      w.tipo_cadastro,
      w.cnpj,
      w.razao_social,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL) AS has_auth,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd,
      coalesce(
        (SELECT i.provider FROM auth.identities i WHERE i.user_id = au.id ORDER BY (i.provider = 'google') DESC, i.created_at ASC LIMIT 1),
        au.raw_app_meta_data ->> 'provider'
      ) AS provider
    INTO v_row
    FROM public.waitlist w
    LEFT JOIN auth.users au
      ON w.email IS NOT NULL AND lower(trim(au.email)) = lower(trim(w.email))
    WHERE regexp_replace(coalesce(w.telefone, ''), '\D', '', 'g') = v_tel
       OR (
         length(regexp_replace(coalesce(w.telefone, ''), '\D', '', 'g')) >= 8
         AND right(regexp_replace(coalesce(w.telefone, ''), '\D', '', 'g'), 8) = v_last8
       )
    ORDER BY
      (regexp_replace(coalesce(w.telefone, ''), '\D', '', 'g') = v_tel) DESC,
      (au.id IS NOT NULL) DESC,
      w.created_at_utc DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.wl_email), ''));
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.tipo_cadastro, '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
          OR nullif(trim(coalesce(v_row.razao_social, '')), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', coalesce(v_row.has_auth, false),
        'has_password', coalesce(v_row.has_pwd, false),
        'auth_provider', v_row.provider,
        'has_legacy_profile', true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'email', NULL,
    'tipo_pessoa', NULL,
    'has_auth_account', false,
    'has_password', false,
    'auth_provider', NULL,
    'has_legacy_profile', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_cadastral_login_email(text, text, text, text) TO anon, authenticated;

-- 4. Fonte unica de verdade para leitura do perfil autenticado (public.usuarios)
CREATE OR REPLACE FUNCTION public.get_my_cadastral_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_row public.usuarios%ROWTYPE;
  v_tipo_pessoa text;
  v_cadastro_completo boolean;
  v_slug text;
  v_pix_key text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_row
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF NOT FOUND AND v_email <> '' THEN
    SELECT *
      INTO v_row
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_tipo_pessoa := CASE
    WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
      OR lower(coalesce(v_row.role, '')) = 'associacao'
      OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
      OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
    THEN 'PJ'
    ELSE 'PF'
  END;

  v_cadastro_completo :=
    coalesce(v_row.cadastro_completo, false)
    OR lower(coalesce(v_row.metadata ->> 'cadastro_completo', '')) = 'true';

  v_slug := nullif(trim(coalesce(v_row.referral_code, '')), '');
  IF v_slug IS NULL THEN
    v_slug := public.generate_unique_referral_slug(
      coalesce(nullif(trim(v_row.razao_social), ''), nullif(trim(v_row.nome), ''), split_part(coalesce(v_row.email, v_email), '@', 1)),
      v_row.id
    );
    UPDATE public.usuarios
       SET referral_code = v_slug,
           updated_at = now()
     WHERE id = v_row.id;
    v_row.referral_code := v_slug;
  END IF;

  v_pix_key := nullif(trim(coalesce(v_row.chave_pix, '')), '');

  RETURN to_jsonb(v_row) || jsonb_build_object(
    'tipo_pessoa', v_tipo_pessoa,
    'cadastro_completo', v_cadastro_completo,
    'referral_code', v_slug,
    'chave_pix', v_pix_key,
    'tipo_chave_pix', nullif(trim(coalesce(v_row.tipo_chave_pix, '')), ''),
    'possui_chave_pix', (v_pix_key IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_cadastral_profile() TO authenticated;

-- 5. Persistencia definitiva da Chave PIX, cadastro_completo e slug unico
CREATE OR REPLACE FUNCTION public.save_my_cadastral_profile(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_row public.usuarios%ROWTYPE;
  v_existing_meta jsonb;
  v_pix_key text;
  v_pix_type text;
  v_req_slug text;
  v_final_slug text;
  v_slug_taken boolean := false;
  v_tipo_pessoa text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_row
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF NOT FOUND AND v_email <> '' THEN
    SELECT *
      INTO v_row
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  v_existing_meta := coalesce(v_row.metadata, '{}'::jsonb);

  -- Normalizacao explicita da Chave PIX (aceita chave_pix ou pix_key)
  IF p_data ? 'chave_pix' OR p_data ? 'pix_key' THEN
    v_pix_key := nullif(trim(coalesce(p_data ->> 'chave_pix', p_data ->> 'pix_key', '')), '');
  ELSE
    v_pix_key := nullif(trim(coalesce(v_row.chave_pix, '')), '');
  END IF;

  IF p_data ? 'tipo_chave_pix' OR p_data ? 'pix_key_type' THEN
    v_pix_type := nullif(trim(coalesce(p_data ->> 'tipo_chave_pix', p_data ->> 'pix_key_type', '')), '');
  ELSE
    v_pix_type := nullif(trim(coalesce(v_row.tipo_chave_pix, '')), '');
  END IF;

  -- Resolucao segura do referral_code (garante unico e nunca nulo)
  v_req_slug := lower(trim(coalesce(p_data ->> 'referral_code', '')));
  v_req_slug := translate(
    v_req_slug,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  v_req_slug := trim(both '-' from regexp_replace(regexp_replace(v_req_slug, '[^a-z0-9-]+', '-', 'g'), '-+', '-', 'g'));

  IF length(v_req_slug) >= 3 AND length(v_req_slug) <= 40 THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.usuarios u
       WHERE lower(trim(coalesce(u.referral_code, ''))) = v_req_slug
         AND u.id <> v_row.id
    ) INTO v_slug_taken;
  ELSE
    v_req_slug := '';
  END IF;

  IF v_req_slug <> '' AND NOT v_slug_taken THEN
    v_final_slug := v_req_slug;
  ELSIF nullif(trim(coalesce(v_row.referral_code, '')), '') IS NOT NULL THEN
    v_final_slug := trim(v_row.referral_code);
  ELSE
    v_final_slug := public.generate_unique_referral_slug(
      coalesce(
        nullif(trim(p_data ->> 'razao_social'), ''),
        nullif(trim(p_data ->> 'nome'), ''),
        nullif(trim(v_row.razao_social), ''),
        nullif(trim(v_row.nome), ''),
        split_part(coalesce(v_row.email, v_email), '@', 1)
      ),
      v_row.id
    );
  END IF;

  UPDATE public.usuarios
     SET nome = COALESCE(NULLIF(trim(p_data ->> 'nome'), ''), nome),
         razao_social = COALESCE(NULLIF(trim(p_data ->> 'razao_social'), ''), razao_social),
         cpf = COALESCE(NULLIF(trim(p_data ->> 'cpf'), ''), cpf),
         cnpj = COALESCE(NULLIF(trim(p_data ->> 'cnpj'), ''), cnpj),
         responsavel_legal = COALESCE(NULLIF(trim(p_data ->> 'responsavel_legal'), ''), responsavel_legal),
         cpf_responsavel = COALESCE(NULLIF(trim(p_data ->> 'cpf_responsavel'), ''), cpf_responsavel),
         telefone = COALESCE(NULLIF(trim(p_data ->> 'telefone'), ''), telefone),
         bairro_residencia = COALESCE(NULLIF(trim(p_data ->> 'bairro_residencia'), ''), bairro_residencia),
         bairro_moradia = COALESCE(NULLIF(trim(p_data ->> 'bairro_moradia'), ''), bairro_moradia),
         bairro_trabalho = COALESCE(p_data ->> 'bairro_trabalho', bairro_trabalho),
         bairros_atuacao = CASE
           WHEN p_data ? 'bairros_atuacao' AND jsonb_typeof(p_data -> 'bairros_atuacao') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_data -> 'bairros_atuacao'))
           ELSE bairros_atuacao
         END,
         praias = CASE
           WHEN p_data ? 'praias' AND jsonb_typeof(p_data -> 'praias') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_data -> 'praias'))
           ELSE praias
         END,
         praias_frequenta = COALESCE(p_data ->> 'praias_frequenta', praias_frequenta),
         regioes = CASE
           WHEN p_data ? 'regioes' AND jsonb_typeof(p_data -> 'regioes') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_data -> 'regioes'))
           ELSE regioes
         END,
         referral_code = v_final_slug,
         chave_pix = v_pix_key,
         tipo_chave_pix = v_pix_type,
         possui_mercadopago = CASE WHEN p_data ? 'possui_mercadopago' THEN (p_data ->> 'possui_mercadopago')::boolean ELSE possui_mercadopago END,
         cadastro_completo = true,
         metadata = v_existing_meta
           || COALESCE(p_data -> 'metadata', '{}'::jsonb)
           || jsonb_build_object(
                'auth_user_id', v_uid::text,
                'cadastro_completo', true,
                'referral_code', v_final_slug,
                'chave_pix', v_pix_key,
                'tipo_chave_pix', v_pix_type,
                'atualizado_em', now()
              ),
         updated_at = now()
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  -- Sincronizacao defensiva com public.profiles (pix_key + referral_code)
  UPDATE public.profiles
     SET pix_key = COALESCE(v_pix_key, pix_key),
         referral_code = v_final_slug
   WHERE id IN (v_uid, v_row.id);

  v_tipo_pessoa := CASE
    WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
      OR lower(coalesce(v_row.role, '')) = 'associacao'
      OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
      OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
    THEN 'PJ'
    ELSE 'PF'
  END;

  RETURN jsonb_build_object(
    'success', true,
    'usuario_id', v_row.id,
    'nome', v_row.nome,
    'razao_social', v_row.razao_social,
    'tipo_pessoa', v_tipo_pessoa,
    'referral_code', v_row.referral_code,
    'cadastro_completo', v_row.cadastro_completo,
    'chave_pix', v_row.chave_pix,
    'tipo_chave_pix', v_row.tipo_chave_pix,
    'possui_chave_pix', (nullif(trim(coalesce(v_row.chave_pix, '')), '') IS NOT NULL),
    'possui_mercadopago', coalesce(v_row.possui_mercadopago, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_cadastral_profile(jsonb) TO authenticated;

-- 6. RPC dedicada para customizacao segura do slug pelo proprio usuario
CREATE OR REPLACE FUNCTION public.update_my_referral_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_target_id uuid;
  v_target_email text;
  v_slug text;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada. Faça login novamente.');
  END IF;

  v_slug := lower(trim(coalesce(p_slug, '')));
  v_slug := translate(
    v_slug,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  IF length(v_slug) < 3 OR length(v_slug) > 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O slug deve ter entre 3 e 40 caracteres.');
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use apenas letras minúsculas, números e hífens.');
  END IF;

  SELECT id, email
    INTO v_target_id, v_target_email
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF v_target_id IS NULL AND v_email <> '' THEN
    SELECT id, email
      INTO v_target_id, v_target_email
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cadastro de usuário não localizado.');
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios u
     WHERE lower(trim(coalesce(u.referral_code, ''))) = v_slug
       AND u.id <> v_target_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este slug já está em uso por outro membro. Escolha outro.');
  END IF;

  UPDATE public.usuarios
     SET referral_code = v_slug,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('referral_code', v_slug),
         updated_at = now()
   WHERE id = v_target_id;

  UPDATE public.profiles
     SET referral_code = v_slug
   WHERE id IN (v_uid, v_target_id);

  IF coalesce(v_target_email, v_email) <> '' THEN
    UPDATE public.waitlist
       SET referral_code = v_slug
     WHERE user_id IN (v_uid, v_target_id)
        OR lower(trim(coalesce(email, ''))) = lower(trim(coalesce(v_target_email, v_email)));
  END IF;

  -- Sincroniza ubt_slug em coco_colaboradores se tabela/vinculo existir
  IF to_regclass('public.coco_colaboradores') IS NOT NULL THEN
    UPDATE public.coco_colaboradores
       SET ubt_slug = v_slug,
           updated_at = now()
     WHERE user_id IN (v_uid, v_target_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_referral_slug(text) TO authenticated;

-- 7. Garantir referral_code unico na aprovacao/sincronizacao da Waitlist -> public.usuarios
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
  v_existing_id uuid;
  v_existing_slug text;
  v_target_id uuid;
  v_auth_user_id uuid;
  v_final_slug text;
  v_slug_conflict boolean;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE LOWER(email) = LOWER(NEW.email) AND email_confirmed_at IS NULL;
  END IF;

  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_auth_user_id FROM auth.users WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    IF v_auth_user_id IS NOT NULL THEN
      NEW.user_id := v_auth_user_id;
    END IF;
  END IF;

  v_is_pj := (
    NEW.tipo_cadastro IN ('pj', 'associacao', 'PJ')
    OR upper(coalesce(NEW.tipo_pessoa, '')) = 'PJ'
    OR nullif(regexp_replace(coalesce(NEW.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
    OR nullif(trim(coalesce(NEW.razao_social, '')), '') IS NOT NULL
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
    v_existing_id := NULL;
    IF NEW.user_id IS NOT NULL THEN
      SELECT id, referral_code INTO v_existing_id, v_existing_slug FROM public.usuarios WHERE id = NEW.user_id;
    END IF;
    IF v_existing_id IS NULL AND NEW.telefone IS NOT NULL AND NEW.telefone != '' THEN
      SELECT id, referral_code INTO v_existing_id, v_existing_slug FROM public.usuarios WHERE telefone = NEW.telefone LIMIT 1;
    END IF;
    IF v_existing_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
      SELECT id, referral_code INTO v_existing_id, v_existing_slug FROM public.usuarios WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    END IF;

    v_target_id := COALESCE(v_existing_id, NEW.user_id, gen_random_uuid());

    -- Garante slug unico real (sem nunca ficar nulo ou cair em membro-722)
    v_final_slug := nullif(trim(coalesce(v_existing_slug, NEW.referral_code, '')), '');
    IF v_final_slug IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
         WHERE lower(trim(coalesce(u.referral_code, ''))) = lower(v_final_slug)
           AND u.id <> v_target_id
      ) INTO v_slug_conflict;
      IF v_slug_conflict THEN
        v_final_slug := NULL;
      END IF;
    END IF;

    IF v_final_slug IS NULL THEN
      v_final_slug := public.generate_unique_referral_slug(
        COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, split_part(coalesce(NEW.email, ''), '@', 1)),
        v_target_id
      );
    END IF;

    IF nullif(trim(coalesce(NEW.referral_code, '')), '') IS NULL THEN
      NEW.referral_code := v_final_slug;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.usuarios SET
        nome = COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, public.usuarios.nome),
        email = COALESCE(NEW.email, public.usuarios.email),
        telefone = COALESCE(NEW.telefone, public.usuarios.telefone),
        role = CASE WHEN public.usuarios.role IN ('admin', 'superadmin', 'super_admin') THEN public.usuarios.role ELSE v_role END,
        tipo_pessoa = CASE WHEN v_is_pj THEN 'PJ' ELSE COALESCE(NULLIF(public.usuarios.tipo_pessoa, ''), 'PF') END,
        status = 'ativo',
        cpf = COALESCE(NEW.cpf, NEW.responsavel_cpf, public.usuarios.cpf),
        cnpj = COALESCE(NEW.cnpj, public.usuarios.cnpj),
        razao_social = COALESCE(NEW.razao_social, public.usuarios.razao_social),
        padrinho_id = COALESCE(public.usuarios.padrinho_id, NEW.padrinho_id),
        referral_code = COALESCE(NULLIF(trim(public.usuarios.referral_code), ''), v_final_slug),
        chave_pix = COALESCE(NULLIF(trim(NEW.chave_pix), ''), public.usuarios.chave_pix),
        tipo_chave_pix = COALESCE(NULLIF(trim(NEW.tipo_chave_pix), ''), public.usuarios.tipo_chave_pix),
        possui_mercadopago = COALESCE(public.usuarios.possui_mercadopago, false) OR COALESCE(NEW.possui_mercado_pago, false),
        cadastro_completo = COALESCE(public.usuarios.cadastro_completo, false) OR COALESCE(NEW.cadastro_completo, false),
        metadata = COALESCE(public.usuarios.metadata, '{}'::jsonb) || jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'referral_code', COALESCE(NULLIF(trim(public.usuarios.referral_code), ''), v_final_slug),
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', COALESCE(public.usuarios.cadastro_completo, false) OR COALESCE(NEW.cadastro_completo, false)
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
        tipo_pessoa,
        status,
        cpf,
        cnpj,
        razao_social,
        padrinho_id,
        referral_code,
        chave_pix,
        tipo_chave_pix,
        possui_mercadopago,
        cadastro_completo,
        metadata
      ) VALUES (
        v_target_id,
        COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, 'Novo Usuário'),
        NEW.email,
        NEW.telefone,
        v_role,
        CASE WHEN v_is_pj THEN 'PJ' ELSE 'PF' END,
        'ativo',
        COALESCE(NEW.cpf, NEW.responsavel_cpf),
        NEW.cnpj,
        NEW.razao_social,
        NEW.padrinho_id,
        v_final_slug,
        NULLIF(trim(NEW.chave_pix), ''),
        NULLIF(trim(NEW.tipo_chave_pix), ''),
        COALESCE(NEW.possui_mercado_pago, false),
        COALESCE(NEW.cadastro_completo, false),
        jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'referral_code', v_final_slug,
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', COALESCE(NEW.cadastro_completo, false)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill seguro de referral_code para qualquer registro em public.usuarios sem slug
DO $$
DECLARE
  r record;
  v_new_slug text;
BEGIN
  FOR r IN
    SELECT id, nome, razao_social, email
      FROM public.usuarios
     WHERE nullif(trim(coalesce(referral_code, '')), '') IS NULL
  LOOP
    v_new_slug := public.generate_unique_referral_slug(
      coalesce(nullif(trim(r.razao_social), ''), nullif(trim(r.nome), ''), split_part(coalesce(r.email, ''), '@', 1)),
      r.id
    );
    UPDATE public.usuarios
       SET referral_code = v_new_slug,
           updated_at = now()
     WHERE id = r.id;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
