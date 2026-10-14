-- The provider-created Pix flow updates mototaxi_corridas.updated_at after the
-- Mercado Pago charge is created. Older environments never had this column,
-- causing PostgREST to reject the entire persistence update with PGRST204.
BEGIN;

ALTER TABLE public.mototaxi_corridas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.mototaxi_corridas.updated_at IS
  'Last state or payment synchronization timestamp for the Mototaxi ride.';

NOTIFY pgrst, 'reload schema';

COMMIT;
