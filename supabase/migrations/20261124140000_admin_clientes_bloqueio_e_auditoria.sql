-- ============================================================================
-- UBT Homologacao: Controle de Bloqueio de Clientes e Auditoria Administrativa
-- Idempotent migration for project xqujubbqcfqxkfczbidq
-- ============================================================================

-- 1. Colunas de controle de bloqueio em public.usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS block_duration_label text NULL,
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL,
  ADD COLUMN IF NOT EXISTS blocked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_is_blocked
  ON public.usuarios (is_blocked)
  WHERE is_blocked = true;

-- 2. RPC SECURITY DEFINER para bloquear (24h, 1_semana, 1_mes, indefinido) ou desbloquear cliente
CREATE OR REPLACE FUNCTION public.admin_bloquear_desbloquear_cliente(
  p_user_id uuid,
  p_action text,
  p_duration text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_admin_nome text;
  v_target record;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_duration text := lower(trim(coalesce(p_duration, '')));
  v_blocked_until timestamptz := NULL;
  v_duration_label text := NULL;
  v_reason text := NULLIF(trim(coalesce(p_reason, '')), '');
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerenciar bloqueios.'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID do cliente e obrigatorio.' USING ERRCODE = '22023';
  END IF;

  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'Nao e permitido bloquear a propria conta administrativa.' USING ERRCODE = '22023';
  END IF;

  SELECT id, nome, email, role, status, is_blocked, blocked_until, block_duration_label, blocked_reason
    INTO v_target
    FROM public.usuarios
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT email, nome
    INTO v_admin_email, v_admin_nome
    FROM public.usuarios
   WHERE id = v_admin_id;

  v_admin_email := coalesce(v_admin_email, auth.jwt() ->> 'email', 'admin@ubt.app');
  v_admin_nome := coalesce(v_admin_nome, 'Superadmin UBT');

  v_before := jsonb_build_object(
    'status', v_target.status,
    'is_blocked', v_target.is_blocked,
    'blocked_until', v_target.blocked_until,
    'block_duration_label', v_target.block_duration_label,
    'blocked_reason', v_target.blocked_reason
  );

  IF v_action = 'block' THEN
    IF v_duration IN ('24h', '24_horas', '1_dia') THEN
      v_blocked_until := now() + interval '24 hours';
      v_duration_label := '24 horas';
    ELSIF v_duration IN ('1_semana', '7d', 'semana') THEN
      v_blocked_until := now() + interval '7 days';
      v_duration_label := '1 semana';
    ELSIF v_duration IN ('1_mes', '30d', 'mes') THEN
      v_blocked_until := now() + interval '1 month';
      v_duration_label := '1 mês';
    ELSIF v_duration IN ('indefinido', 'tempo_indefinido', 'permanente') THEN
      v_blocked_until := NULL;
      v_duration_label := 'Tempo indefinido';
    ELSE
      RAISE EXCEPTION 'Duracao de bloqueio invalida. Use: 24h, 1_semana, 1_mes ou indefinido.'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.usuarios
       SET is_blocked = true,
           blocked_until = v_blocked_until,
           block_duration_label = v_duration_label,
           blocked_reason = v_reason,
           blocked_by = v_admin_id,
           blocked_at = now(),
           status = 'blocked',
           updated_at = now()
     WHERE id = p_user_id;

    v_after := jsonb_build_object(
      'status', 'blocked',
      'is_blocked', true,
      'blocked_until', v_blocked_until,
      'block_duration_label', v_duration_label,
      'blocked_reason', v_reason
    );

    INSERT INTO public.admin_audit_logs (
      admin_id,
      admin_nome,
      admin_email,
      acao,
      categoria,
      modulo,
      entidade,
      registro_id,
      valor_anterior,
      valor_novo,
      motivo,
      resultado,
      criticidade,
      metadata
    ) VALUES (
      v_admin_id,
      v_admin_nome,
      v_admin_email,
      'bloquear_cliente',
      'usuarios',
      'admin_clientes',
      'usuarios',
      p_user_id::text,
      v_before,
      v_after,
      coalesce(v_reason, 'Bloqueio administrativo (' || v_duration_label || ')'),
      'sucesso',
      'alta',
      jsonb_build_object('duration', v_duration, 'duration_label', v_duration_label, 'target_email', v_target.email)
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'block',
      'user_id', p_user_id,
      'is_blocked', true,
      'blocked_until', v_blocked_until,
      'block_duration_label', v_duration_label,
      'blocked_reason', v_reason
    );

  ELSIF v_action = 'unblock' THEN
    UPDATE public.usuarios
       SET is_blocked = false,
           blocked_until = NULL,
           block_duration_label = NULL,
           blocked_reason = NULL,
           blocked_by = NULL,
           blocked_at = NULL,
           status = CASE WHEN status = 'blocked' THEN 'active' ELSE status END,
           updated_at = now()
     WHERE id = p_user_id;

    v_after := jsonb_build_object(
      'status', CASE WHEN v_target.status = 'blocked' THEN 'active' ELSE v_target.status END,
      'is_blocked', false,
      'blocked_until', NULL,
      'block_duration_label', NULL,
      'blocked_reason', NULL
    );

    INSERT INTO public.admin_audit_logs (
      admin_id,
      admin_nome,
      admin_email,
      acao,
      categoria,
      modulo,
      entidade,
      registro_id,
      valor_anterior,
      valor_novo,
      motivo,
      resultado,
      criticidade,
      metadata
    ) VALUES (
      v_admin_id,
      v_admin_nome,
      v_admin_email,
      'desbloquear_cliente',
      'usuarios',
      'admin_clientes',
      'usuarios',
      p_user_id::text,
      v_before,
      v_after,
      coalesce(v_reason, 'Desbloqueio administrativo'),
      'sucesso',
      'media',
      jsonb_build_object('target_email', v_target.email)
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'unblock',
      'user_id', p_user_id,
      'is_blocked', false,
      'blocked_until', NULL,
      'block_duration_label', NULL,
      'blocked_reason', NULL
    );
  ELSE
    RAISE EXCEPTION 'Acao invalida. Use block ou unblock.' USING ERRCODE = '22023';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bloquear_desbloquear_cliente(uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
