-- ============================================================================
-- UBT: Extensao da Resolucao de Login Cadastral (PF/PJ + p_email + has_password
-- + auth_provider) e Vinculo Seguro de Cadastros Legados sem Duplicacao
-- ============================================================================

DROP FUNCTION IF EXISTS public.resolve_cadastral_login_email(text, text);

CREATE OR REPLACE FUNCTION public.resolve_cadastral_login_email(
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_input_email text := lower(trim(coalesce(p_email, '')));
  v_last8 text := '';
  v_email text := NULL;
  v_tipo_pessoa text := NULL;
  v_has_auth boolean := false;
  v_has_password boolean := false;
  v_auth_provider text := NULL;
  v_has_legacy_profile boolean := false;
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

    -- Fallback: public.waitlist por CNPJ
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

  -- 2. Resolucao direta por E-mail (Pessoa Fisica ou PJ)
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
      v_has_auth := coalesce(v_row.has_auth, false);
      v_has_password := coalesce(v_row.has_pwd, false);
      v_auth_provider := v_row.provider;
      v_has_legacy_profile := true;
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
        'has_auth_account', v_has_auth,
        'has_password', v_has_password,
        'auth_provider', v_auth_provider,
        'has_legacy_profile', v_has_legacy_profile
      );
    END IF;

    -- Verifica diretamente em auth.users (caso exista no Auth sem linha em usuarios)
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

    -- Fallback: public.waitlist por e-mail
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

  -- 3. Resolucao por Telefone (pre-preenchimento de e-mail e deteccao PF/PJ)
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

    -- Fallback: public.waitlist por telefone
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

GRANT EXECUTE ON FUNCTION public.resolve_cadastral_login_email(text, text, text) TO anon, authenticated;

-- RPC segura para carregar o perfil cadastral do usuario autenticado,
-- vinculando automaticamente cadastros legados por e-mail sem duplicar public.usuarios
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_row
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF FOUND THEN
    RETURN to_jsonb(v_row);
  END IF;

  IF v_email <> '' THEN
    SELECT *
      INTO v_row
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;

    IF FOUND THEN
      RETURN to_jsonb(v_row);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_cadastral_profile() TO authenticated;

-- RPC segura para atualizar o perfil cadastral do usuario autenticado
-- (inclusive contas legadas cujo usuarios.id difere de auth.uid()) sem duplicar registros
CREATE OR REPLACE FUNCTION public.save_my_cadastral_profile(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_target_id uuid;
  v_existing_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria.' USING ERRCODE = '42501';
  END IF;

  SELECT id, coalesce(metadata, '{}'::jsonb)
    INTO v_target_id, v_existing_meta
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF v_target_id IS NULL AND v_email <> '' THEN
    SELECT id, coalesce(metadata, '{}'::jsonb)
      INTO v_target_id, v_existing_meta
      FROM public.usuarios
     WHERE lower(trim(coalesce(email, ''))) = v_email
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
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
         referral_code = COALESCE(NULLIF(trim(p_data ->> 'referral_code'), ''), referral_code),
         chave_pix = CASE WHEN p_data ? 'chave_pix' THEN NULLIF(trim(p_data ->> 'chave_pix'), '') ELSE chave_pix END,
         tipo_chave_pix = CASE WHEN p_data ? 'tipo_chave_pix' THEN NULLIF(trim(p_data ->> 'tipo_chave_pix'), '') ELSE tipo_chave_pix END,
         possui_mercadopago = CASE WHEN p_data ? 'possui_mercadopago' THEN (p_data ->> 'possui_mercadopago')::boolean ELSE possui_mercadopago END,
         metadata = v_existing_meta || COALESCE(p_data -> 'metadata', '{}'::jsonb) || jsonb_build_object('auth_user_id', v_uid::text),
         updated_at = now()
   WHERE id = v_target_id;

  RETURN jsonb_build_object('success', true, 'usuario_id', v_target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_cadastral_profile(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
