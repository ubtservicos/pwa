-- ============================================================================
-- UBT LGPD: Resolucao Segura por p_user_id (ZERO PII pre-login) e Verificacao
-- de Titularidade Pos-Login para /atualizacao-cadastral?id=<uuid>
-- ============================================================================

DROP FUNCTION IF EXISTS public.resolve_cadastral_login_email(text, text, text, text);

CREATE OR REPLACE FUNCTION public.resolve_cadastral_login_email(
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
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

  -- 0. Deteccao LGPD apenas por p_user_id (quando nenhuma credencial foi enviada):
  -- Retorna ESTRITAMENTE metadados nao-sensiveis (email = NULL, zero PII!)
  IF p_user_id IS NOT NULL
     AND length(v_cnpj) < 14
     AND length(v_cpf) <> 11
     AND v_input_email = ''
     AND length(v_tel) < 8 THEN
    SELECT
      u.id,
      u.tipo_pessoa,
      u.role,
      u.cnpj,
      u.metadata,
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
    WHERE u.id = p_user_id
    ORDER BY (au.id = u.id) DESC NULLS LAST, (au.id IS NOT NULL) DESC
    LIMIT 1;

    IF FOUND THEN
      v_tipo_pessoa := CASE
        WHEN upper(coalesce(v_row.tipo_pessoa, '')) = 'PJ'
          OR lower(coalesce(v_row.role, '')) = 'associacao'
          OR lower(coalesce(v_row.metadata ->> 'tipo_cadastro', '')) IN ('pj', 'associacao')
          OR nullif(regexp_replace(coalesce(v_row.cnpj, ''), '\D', '', 'g'), '') IS NOT NULL
        THEN 'PJ'
        ELSE 'PF'
      END;

      RETURN jsonb_build_object(
        'email', NULL,
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

  -- 4. Resolucao por Telefone (durante submissao de login)
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

GRANT EXECUTE ON FUNCTION public.resolve_cadastral_login_email(text, text, text, text, uuid) TO anon, authenticated;

-- Verificacao pos-login de titularidade do link ?id=<uuid> (impede acesso cruzado)
CREATE OR REPLACE FUNCTION public.verify_my_cadastral_link_owner(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_matches boolean := false;
BEGIN
  IF v_uid IS NULL OR p_target_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_uid = p_target_user_id THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios u
     WHERE u.id = p_target_user_id
       AND (
         u.id = v_uid
         OR (v_email <> '' AND lower(trim(coalesce(u.email, ''))) = v_email)
         OR lower(trim(coalesce(u.metadata ->> 'auth_user_id', ''))) = lower(v_uid::text)
       )
  ) INTO v_matches;

  RETURN coalesce(v_matches, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_my_cadastral_link_owner(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
