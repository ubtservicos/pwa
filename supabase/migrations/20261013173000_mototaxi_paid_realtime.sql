-- Align the operational ride lifecycle with the unified payment flow.
-- `paid` is terminal and is written only after the gateway confirms payment.

BEGIN;

ALTER TABLE public.mototaxi_corridas
  DROP CONSTRAINT IF EXISTS mototaxi_corridas_status_check;

ALTER TABLE public.mototaxi_corridas
  ADD CONSTRAINT mototaxi_corridas_status_check
  CHECK (status IN (
    'searching',
    'pending',
    'buscando',
    'solicitado',
    'accepted',
    'arriving',
    'in_progress',
    'completed',
    'paid',
    'cancelled'
  ));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mototaxi_corridas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mototaxi_corridas;
  END IF;
END $$;

COMMENT ON COLUMN public.mototaxi_corridas.status IS
  'Ride lifecycle; paid is the terminal financial state confirmed by the payment gateway.';

COMMIT;
