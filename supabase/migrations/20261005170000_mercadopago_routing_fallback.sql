-- Mercado Pago 1:1 routing and auditable platform fallback.
-- Physical split: Seller OAuth receives the charge and MP applies application_fee.
-- Fallback: platform receives 100% and provider payout remains pending in the ledger.

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  provider_id text,
  mercado_pago_user_id text,
  status text NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN (
    'NOT_CONNECTED', 'CONNECTED', 'ERROR', 'TOKEN_EXPIRING', 'REVOKED', 'REFRESH_REQUIRED'
  )),
  ambiente text NOT NULL CHECK (ambiente IN ('sandbox', 'production')),
  oauth_status text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  token_metadata jsonb,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiration timestamptz,
  last_refresh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ambiente)
);

CREATE TABLE IF NOT EXISTS public.marketplace_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  marketplace text NOT NULL DEFAULT 'mercado_pago',
  provider text,
  state_reference text NOT NULL,
  authorization_status text NOT NULL DEFAULT 'started' CHECK (authorization_status IN (
    'started', 'authorized', 'exchanged', 'failed', 'revoked'
  )),
  granted_scopes text[] DEFAULT '{}'::text[],
  marketplace_account_id uuid REFERENCES public.marketplace_accounts(id) ON DELETE SET NULL,
  connected_at timestamptz,
  expires_at timestamptz,
  refresh_status text,
  revoked_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_oauth_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner read marketplace_accounts" ON public.marketplace_accounts;
CREATE POLICY "Allow owner read marketplace_accounts"
  ON public.marketplace_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow owner read marketplace_oauth_connections" ON public.marketplace_oauth_connections;
CREATE POLICY "Allow owner read marketplace_oauth_connections"
  ON public.marketplace_oauth_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS limits rows, while column grants prevent an owner from selecting OAuth secrets.
REVOKE SELECT ON public.marketplace_accounts FROM authenticated;
GRANT SELECT (
  id, user_id, provider_id, mercado_pago_user_id, status, ambiente, oauth_status,
  connected_at, disconnected_at, token_expiration, last_refresh_at, created_at, updated_at
) ON public.marketplace_accounts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_routing
  ON public.marketplace_accounts (user_id, ambiente, status, connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_state
  ON public.marketplace_oauth_connections (state_reference, user_id, authorization_status);

ALTER TABLE public.pagamentos_split
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS gateway_payment_id text,
  ADD COLUMN IF NOT EXISTS gateway_status text,
  ADD COLUMN IF NOT EXISTS gateway_status_detail text,
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_route text,
  ADD COLUMN IF NOT EXISTS provider_payout_status text,
  ADD COLUMN IF NOT EXISTS provider_payout_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_collected_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS marketplace_account_id uuid REFERENCES public.marketplace_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS routing_reason text,
  ADD COLUMN IF NOT EXISTS last_error jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_split_payment_route_check'
      AND conrelid = 'public.pagamentos_split'::regclass
  ) THEN
    ALTER TABLE public.pagamentos_split
      ADD CONSTRAINT pagamentos_split_payment_route_check
      CHECK (payment_route IS NULL OR payment_route IN ('seller_oauth_split', 'platform_fallback'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_split_payout_status_check'
      AND conrelid = 'public.pagamentos_split'::regclass
  ) THEN
    ALTER TABLE public.pagamentos_split
      ADD CONSTRAINT pagamentos_split_payout_status_check
      CHECK (provider_payout_status IS NULL OR provider_payout_status IN (
        'not_required', 'pending', 'processing', 'paid', 'failed', 'cancelled'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_split_environment_check'
      AND conrelid = 'public.pagamentos_split'::regclass
  ) THEN
    ALTER TABLE public.pagamentos_split
      ADD CONSTRAINT pagamentos_split_environment_check
      CHECK (environment IS NULL OR environment IN ('sandbox', 'production'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_split_idempotency_key
  ON public.pagamentos_split (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_split_gateway_payment_id
  ON public.pagamentos_split (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_split_pending_payout
  ON public.pagamentos_split (provider_payout_status, created_at)
  WHERE provider_payout_status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_pagamentos_split_provider
  ON public.pagamentos_split (provider_id, created_at DESC)
  WHERE provider_id IS NOT NULL;

COMMENT ON COLUMN public.pagamentos_split.payment_route IS
  'seller_oauth_split sends application_fee using Seller OAuth; platform_fallback charges the platform without application_fee.';
COMMENT ON COLUMN public.pagamentos_split.provider_payout_status IS
  'In platform_fallback, tracks the later provider payout. In Seller OAuth split it is not_required.';
COMMENT ON COLUMN public.pagamentos_split.application_fee_amount IS
  'Physical application_fee sent to Mercado Pago; always zero for platform_fallback.';
COMMENT ON COLUMN public.pagamentos_split.platform_collected_amount IS
  'Amount physically collected by the platform: fee on OAuth route, total on fallback route.';
COMMENT ON COLUMN public.marketplace_accounts.access_token_encrypted IS
  'AES-256-GCM envelope v1:<iv>:<cipher>. plain: is accepted only in sandbox for local/manual testing.';

NOTIFY pgrst, 'reload schema';

COMMIT;
