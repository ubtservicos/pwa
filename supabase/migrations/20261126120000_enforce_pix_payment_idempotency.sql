-- Migration: 20261126120000_enforce_pix_payment_idempotency.sql
-- Purpose:
--   1. Enforce DB-level idempotency: at most ONE approved/paid/confirmed payment per (service_type, service_id)
--      in public.pagamentos_split and public.payments, plus unique gateway_payment_id.
--   2. Enforce DB-level idempotency on public.payment_splits and public.payouts.
--   3. Fix public.get_user_payment_history() to exclude rejected/failed/cancelled/expired attempts
--      and support legacy accounts via public.is_current_usuario(...).

-- 1. Unique partial indexes on public.pagamentos_split
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_split_one_approved_per_service
  ON public.pagamentos_split (service_type, service_id)
  WHERE status IN ('approved', 'paid', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_split_gateway_payment_id
  ON public.pagamentos_split (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

-- 2. Unique partial indexes on public.payments (status is enum payment_status)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_one_approved_per_service
  ON public.payments (service_type, service_id)
  WHERE status = 'captured';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gateway_payment_id
  ON public.payments (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

-- 3. Unique indexes on public.payment_splits and public.payouts
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_splits_payment_recipient
  ON public.payment_splits (payment_id, recipient_role, recipient_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payouts_gateway_payout_id
  ON public.payouts (gateway_payout_id)
  WHERE gateway_payout_id IS NOT NULL;

-- 4. Update public.get_user_payment_history() to exclude failed/rejected/cancelled/expired attempts
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
AS $$
  SELECT
    ps.id,
    ps.transaction_id,
    ps.status,
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
    ps.updated_at,
    CASE WHEN public.is_current_usuario(c.prestador_id) THEN 'prestador' ELSE 'tomador' END,
    c.origin,
    c.destination,
    c.distance_km,
    c.duration_min,
    c.type,
    c.status,
    c.payment_method
  FROM public.pagamentos_split ps
  JOIN public.mototaxi_corridas c
    ON ps.service_type = 'mototaxi' AND c.id = ps.service_id
  WHERE auth.uid() IS NOT NULL
    AND (public.is_current_usuario(c.tomador_id) OR public.is_current_usuario(c.prestador_id))
    AND ps.status IN ('approved', 'paid', 'confirmed', 'pending')
    AND (ps.status <> 'pending' OR ps.gateway_payment_id IS NOT NULL)
  ORDER BY ps.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_payment_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_payment_history() TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
