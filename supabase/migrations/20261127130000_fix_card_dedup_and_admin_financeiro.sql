-- ============================================================================
-- Migration: 20261127130000_fix_card_dedup_and_admin_financeiro.sql
-- Version: v1.8.10-fix-card-dedup-and-admin-financeiro-prod
-- Goals:
--   0) Allow 'cancelled' and 'expired' in pagamentos_split_status_check so
--      superseded pending attempts can be cleanly cancelled.
--   1) Harden get_user_payment_history() so pending attempts for a service
--      that already has a settled payment are NEVER returned.
--   2) Provide canonical SECURITY DEFINER RPC admin_list_financial_transactions()
--      consolidating real PIX + Card transactions from pagamentos_split
--      (and deduplicated legacy payments) for /admin/financeiro and /admin/payments.
-- ============================================================================

ALTER TABLE public.pagamentos_split
  DROP CONSTRAINT IF EXISTS pagamentos_split_status_check;

ALTER TABLE public.pagamentos_split
  ADD CONSTRAINT pagamentos_split_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'approved'::text,
    'in_mediation'::text,
    'rejected'::text,
    'refunded'::text,
    'charged_back'::text,
    'cancelled'::text,
    'expired'::text
  ]));

CREATE OR REPLACE FUNCTION public.get_user_payment_history()
RETURNS TABLE(
  payment_id uuid,
  transaction_id text,
  payment_status text,
  service_id uuid,
  service_type text,
  total_amount numeric,
  provider_amount numeric,
  ubt_amount numeric,
  entity_amount numeric,
  prize_worker_amount numeric,
  prize_consumer_amount numeric,
  godparent_amount numeric,
  payment_route text,
  paid_at timestamp with time zone,
  participant_role text,
  origin jsonb,
  destination jsonb,
  distance_km numeric,
  duration_min integer,
  ride_type text,
  ride_status text,
  payment_method text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    ps.id AS payment_id,
    ps.transaction_id,
    ps.status AS payment_status,
    ps.service_id,
    ps.service_type,
    ps.total_amount,
    ps.provider_amount,
    ps.ubt_amount,
    ps.entity_amount,
    ps.prize_worker_amount,
    ps.prize_consumer_amount,
    ps.godparent_amount,
    ps.payment_route,
    ps.updated_at AS paid_at,
    CASE WHEN public.is_current_usuario(c.prestador_id) THEN 'prestador' ELSE 'tomador' END AS participant_role,
    c.origin,
    c.destination,
    c.distance_km,
    c.duration_min,
    c.type AS ride_type,
    c.status AS ride_status,
    COALESCE(NULLIF(BTRIM(ps.payment_method), ''), c.payment_method) AS payment_method
  FROM public.pagamentos_split ps
  JOIN public.mototaxi_corridas c
    ON ps.service_type = 'mototaxi' AND c.id = ps.service_id
  WHERE auth.uid() IS NOT NULL
    AND (public.is_current_usuario(c.tomador_id) OR public.is_current_usuario(c.prestador_id))
    AND ps.status IN ('approved', 'paid', 'confirmed', 'captured', 'pending')
    AND (ps.status <> 'pending' OR ps.gateway_payment_id IS NOT NULL)
    AND (
      ps.status <> 'pending'
      OR NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_split settled
        WHERE settled.service_type = ps.service_type
          AND settled.service_id = ps.service_id
          AND settled.status IN ('approved', 'paid', 'confirmed', 'captured')
      )
    )
  ORDER BY ps.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_payment_history() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_financial_transactions()
RETURNS TABLE(
  id uuid,
  transaction_id text,
  gateway_payment_id text,
  service_id uuid,
  service_type text,
  payment_method text,
  status text,
  total_amount numeric,
  base_amount numeric,
  provider_amount numeric,
  ubt_amount numeric,
  entity_amount numeric,
  prize_worker_amount numeric,
  prize_consumer_amount numeric,
  godparent_amount numeric,
  godparent_tomador_amount numeric,
  godparent_prestador_amount numeric,
  payment_route text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT lower(coalesce(u.role, '')) INTO v_caller_role
  FROM public.usuarios u
  WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role NOT IN ('super_admin', 'admin', 'financeiro') THEN
    SELECT lower(coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role', ''))
      INTO v_caller_role
    FROM auth.users
    WHERE auth.users.id = auth.uid();
  END IF;

  IF v_caller_role NOT IN ('super_admin', 'admin', 'financeiro') THEN
    RAISE EXCEPTION 'Permissão insuficiente para consultar transações financeiras.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.transaction_id,
    ps.gateway_payment_id,
    ps.service_id,
    COALESCE(NULLIF(BTRIM(ps.service_type), ''), 'mototaxi') AS service_type,
    COALESCE(
      NULLIF(BTRIM(ps.payment_method), ''),
      NULLIF(BTRIM(mc.payment_method), ''),
      'unknown'
    ) AS payment_method,
    ps.status,
    COALESCE(ps.total_amount, 0)::numeric AS total_amount,
    COALESCE(ps.base_amount, ps.total_amount, 0)::numeric AS base_amount,
    COALESCE(ps.provider_amount, 0)::numeric AS provider_amount,
    COALESCE(ps.ubt_amount, 0)::numeric AS ubt_amount,
    COALESCE(ps.entity_amount, 0)::numeric AS entity_amount,
    COALESCE(ps.prize_worker_amount, 0)::numeric AS prize_worker_amount,
    COALESCE(ps.prize_consumer_amount, 0)::numeric AS prize_consumer_amount,
    COALESCE(ps.godparent_amount, 0)::numeric AS godparent_amount,
    COALESCE(ps.godparent_tomador_amount, 0)::numeric AS godparent_tomador_amount,
    COALESCE(ps.godparent_prestador_amount, 0)::numeric AS godparent_prestador_amount,
    ps.payment_route,
    ps.created_at,
    ps.updated_at
  FROM public.pagamentos_split ps
  LEFT JOIN public.mototaxi_corridas mc
    ON ps.service_type = 'mototaxi' AND mc.id = ps.service_id
  WHERE (
    ps.status <> 'pending'
    OR NOT EXISTS (
      SELECT 1
      FROM public.pagamentos_split settled
      WHERE settled.service_type = ps.service_type
        AND settled.service_id = ps.service_id
        AND settled.status IN ('approved', 'paid', 'confirmed', 'captured')
    )
  )
  ORDER BY ps.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_financial_transactions() TO authenticated;

NOTIFY pgrst, 'reload schema';
