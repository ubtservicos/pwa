-- Participant-safe financial history enriched with mototaxi route data.
CREATE OR REPLACE FUNCTION public.get_user_payment_history()
RETURNS TABLE (
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
  paid_at timestamptz,
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
SET search_path = public, pg_temp
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
    CASE WHEN c.prestador_id = auth.uid() THEN 'prestador' ELSE 'tomador' END,
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
    AND (c.tomador_id = auth.uid() OR c.prestador_id = auth.uid())
  ORDER BY ps.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_payment_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_payment_history() TO authenticated;

COMMENT ON FUNCTION public.get_user_payment_history() IS
  'Participant-scoped payment ledger joined to mototaxi route details for app history and receipts.';

NOTIFY pgrst, 'reload schema';
