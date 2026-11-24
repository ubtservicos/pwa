-- ============================================================================
-- UBT: Resolucao Segura de E-mail de Login para Atualizacao Cadastral (PF e PJ)
-- RPC SECURITY DEFINER (anon + authenticated) retornando estritamente:
-- { email, tipo_pessoa, has_auth_account }
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_cadastral_login_email(
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_last8 text := '';
  v_email text := NULL;
  v_tipo_pessoa text := NULL;
  v_has_auth boolean := false;
  v_row record;
  v_auth record;
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
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd
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
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.user_email), ''));
      v_tipo_pessoa := 'PJ';
      v_has_auth := coalesce(v_row.has_pwd, false);

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', v_has_auth
      );
    END IF;

    -- Fallback: public.waitlist por CNPJ cruzando com auth.users
    SELECT
      w.email AS wl_email,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd
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
      v_email := coalesce(nullif(trim(v_row.auth_email), ''), nullif(trim(v_row.wl_email), ''));
      v_tipo_pessoa := 'PJ';
      v_has_auth := coalesce(v_row.has_pwd, false);

      RETURN jsonb_build_object(
        'email', v_email,
        'tipo_pessoa', v_tipo_pessoa,
        'has_auth_account', v_has_auth
      );
    END IF;

    RETURN jsonb_build_object(
      'email', NULL,
      'tipo_pessoa', NULL,
      'has_auth_account', false
    );
  END IF;

  -- 2. Resolucao por Telefone (pre-preenchimento de e-mail e deteccao PF/PJ)
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
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd
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
      v_has_auth := coalesce(v_row.has_pwd, false);
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
        'has_auth_account', v_has_auth
      );
    END IF;

    -- Fallback: public.waitlist por telefone cruzando com auth.users
    SELECT
      w.email AS wl_email,
      w.tipo_pessoa,
      w.tipo_cadastro,
      w.cnpj,
      w.razao_social,
      au.id AS auth_id,
      au.email AS auth_email,
      (au.id IS NOT NULL AND coalesce(au.encrypted_password, '') <> '') AS has_pwd
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
      v_has_auth := coalesce(v_row.has_pwd, false);
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
        'has_auth_account', v_has_auth
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'email', NULL,
    'tipo_pessoa', NULL,
    'has_auth_account', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_cadastral_login_email(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
