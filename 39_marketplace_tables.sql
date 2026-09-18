-- migration: 39_marketplace_tables.sql
-- UBT SuperApp — Preparing database schema for Mercado Pago 1:N Marketplace Integration

-- 1. Create marketplace_accounts table
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
  access_token_encrypted text, -- Encrypted access token (never exposed to frontend)
  refresh_token_encrypted text, -- Encrypted refresh token (never exposed to frontend)
  token_expiration timestamptz,
  last_refresh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ambiente)
);

-- 2. Create marketplace_oauth_connections table
CREATE TABLE IF NOT EXISTS public.marketplace_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  marketplace text NOT NULL DEFAULT 'mercado_pago',
  provider text,
  state_reference text NOT NULL, -- Used to verify CSRF during OAuth flow redirect
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

-- 3. Create marketplace_payment_links table
CREATE TABLE IF NOT EXISTS public.marketplace_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL, -- References internal payment
  mercado_pago_preference_id text, -- ID of Checkout Pro preference
  marketplace_account_id uuid REFERENCES public.marketplace_accounts(id) ON DELETE SET NULL,
  ambiente text NOT NULL CHECK (ambiente IN ('sandbox', 'production')),
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create marketplace_recipient_allocations table
CREATE TABLE IF NOT EXISTS public.marketplace_recipient_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  recipient_reference text NOT NULL, -- E.g. 'prestador', 'ubt', 'associacao', etc.
  recipient_type text NOT NULL, -- E.g. 'seller', 'marketplace', 'partner'
  percentage numeric NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'allocated', 'released', 'refunded', 'failed'
  )),
  external_reference text,
  external_recipient_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create marketplace_webhook_events table
CREATE TABLE IF NOT EXISTS public.marketplace_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL, -- Used to guarantee idempotency and avoid duplicate processing
  event_type text NOT NULL,
  external_id text NOT NULL,
  environment text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'ignored'
  )),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  payload_hash text NOT NULL, -- MD5/SHA256 of payload to ensure data integrity
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (Row Level Security) on all new tables
ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_recipient_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_webhook_events ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS Policies
-- Profiles / Accounts: Read is allowed for owner, write is restricted to owner or system (admin role)
DROP POLICY IF EXISTS "Allow owner read marketplace_accounts" ON public.marketplace_accounts;
CREATE POLICY "Allow owner read marketplace_accounts" 
  ON public.marketplace_accounts 
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow owner read marketplace_oauth_connections" ON public.marketplace_oauth_connections;
CREATE POLICY "Allow owner read marketplace_oauth_connections" 
  ON public.marketplace_oauth_connections 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Rest of the tables are audit/webhook/payout control tables: only readable by admins
DROP POLICY IF EXISTS "Admin only select marketplace_payment_links" ON public.marketplace_payment_links;
CREATE POLICY "Admin only select marketplace_payment_links" 
  ON public.marketplace_payment_links 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admin only select marketplace_recipient_allocations" ON public.marketplace_recipient_allocations;
CREATE POLICY "Admin only select marketplace_recipient_allocations" 
  ON public.marketplace_recipient_allocations 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admin only select marketplace_webhook_events" ON public.marketplace_webhook_events;
CREATE POLICY "Admin only select marketplace_webhook_events" 
  ON public.marketplace_webhook_events 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Notify PostgREST to reload cache
NOTIFY pgrst, 'reload schema';
