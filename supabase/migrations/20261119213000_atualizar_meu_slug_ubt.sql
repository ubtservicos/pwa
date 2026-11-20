-- ============================================================================
-- MIGRATION: RPC para edição segura e única do Slug / ID UBT pelo usuário
-- AMBIENTE: Homologação (xqujubbqcfqxkfczbidq) — Idempotente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atualizar_meu_slug_ubt(p_novo_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_slug := lower(trim(COALESCE(p_novo_slug, '')));

  IF length(v_slug) < 3 OR length(v_slug) > 30 THEN
    RAISE EXCEPTION 'O ID/Slug deve ter entre 3 e 30 caracteres.';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Use apenas letras minúsculas, números e hífen (sem espaços ou hífens no início/fim).';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE lower(trim(COALESCE(u.referral_code, ''))) = v_slug
      AND u.id <> v_uid
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Este ID/Slug já está em uso por outro usuário. Escolha outro identificador.';
  END IF;

  UPDATE public.usuarios
  SET
    referral_code = v_slug,
    updated_at = now()
  WHERE id = v_uid;

  -- Mantém ubt_slug sincronizado caso o usuário possua vínculo em coco_colaboradores
  UPDATE public.coco_colaboradores
  SET
    ubt_slug = v_slug,
    updated_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_meu_slug_ubt(text) TO authenticated;

NOTIFY pgrst, 'reload config';
