-- Follow-up for environments where the provider-created Pix migration has
-- already run: persist Mercado Pago's PNG so reconnecting providers can render
-- the physical QR code without depending on an ephemeral function response.
BEGIN;

ALTER TABLE public.mototaxi_corridas
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text;

COMMENT ON COLUMN public.mototaxi_corridas.pix_qr_code_base64 IS
  'Base64 PNG returned by Mercado Pago for the active in-person Pix charge; protected by ride participant RLS.';

COMMIT;
