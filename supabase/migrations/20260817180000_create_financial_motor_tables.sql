-- =============================================================================
-- Migration: 20260817180000_create_financial_motor_tables
-- Release 2.0 — Motor Financeiro UBT
--
-- Creates all tables required by the payment-gateway and payment-webhook
-- Edge Functions. Fully idempotent (uses IF NOT EXISTS / ON CONFLICT).
--
-- Tables created:
--   1. public.split_config              — Singleton row with live split percentages
--   2. public.pagamentos_split          — Per-transaction split ledger
--   3. public.marketplace_webhook_events — Idempotency guard for MP webhooks
--
-- NOTE: financial_audit_logs is already handled by migration 20260815142500.
--       This migration purposely skips it to avoid duplication.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. split_config — Singleton table (id always = 1)
--    Stores the live regulatory split percentages read by payment-gateway.
--    Only a single row (id=1) is allowed via CHECK constraint.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.split_config (
  id                      integer     PRIMARY KEY DEFAULT 1
                                      CHECK (id = 1),          -- Enforces singleton
  prestador_pct           numeric     NOT NULL DEFAULT 90.000,  -- Service provider share
  ubt_pct                 numeric     NOT NULL DEFAULT  5.000,  -- UBT platform cut
  comunidade_pct          numeric     NOT NULL DEFAULT  2.000,  -- Community fund
  premio_trabalhador_pct  numeric     NOT NULL DEFAULT  1.000,  -- Worker lottery pool
  premio_consumidor_pct   numeric     NOT NULL DEFAULT  1.000,  -- Consumer loyalty pool
  padrinho_pct            numeric     NOT NULL DEFAULT  1.000,  -- Godparent referral (residual bucket)
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.split_config IS 'Singleton row (id=1) holding live split percentages for all financial transactions. Read by payment-gateway Edge Function.';
COMMENT ON COLUMN public.split_config.prestador_pct          IS 'Percentage allocated to the service provider (e.g. 90%).';
COMMENT ON COLUMN public.split_config.ubt_pct                IS 'Percentage retained by UBT as marketplace fee (e.g. 5%).';
COMMENT ON COLUMN public.split_config.comunidade_pct         IS 'Percentage directed to the neighborhood community fund (e.g. 2%).';
COMMENT ON COLUMN public.split_config.premio_trabalhador_pct IS 'Percentage directed to the worker lottery prize pool (e.g. 1%).';
COMMENT ON COLUMN public.split_config.premio_consumidor_pct  IS 'Percentage directed to the consumer loyalty prize pool (e.g. 1%).';
COMMENT ON COLUMN public.split_config.padrinho_pct           IS 'Percentage for godparent referral. Also serves as residual bucket absorbing floating-point rounding drift (e.g. 1%).';

-- Seed the canonical regulatory defaults (upsert: idempotent on re-runs)
INSERT INTO public.split_config
  (id, prestador_pct, ubt_pct, comunidade_pct, premio_trabalhador_pct, premio_consumidor_pct, padrinho_pct)
VALUES
  (1, 90.000, 5.000, 2.000, 1.000, 1.000, 1.000)
ON CONFLICT (id) DO UPDATE
  SET prestador_pct          = EXCLUDED.prestador_pct,
      ubt_pct                = EXCLUDED.ubt_pct,
      comunidade_pct         = EXCLUDED.comunidade_pct,
      premio_trabalhador_pct = EXCLUDED.premio_trabalhador_pct,
      premio_consumidor_pct  = EXCLUDED.premio_consumidor_pct,
      padrinho_pct           = EXCLUDED.padrinho_pct,
      updated_at             = now();

-- RLS
ALTER TABLE public.split_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read the split config (needed by the PWA to display fees)
DROP POLICY IF EXISTS "Authenticated read split_config" ON public.split_config;
CREATE POLICY "Authenticated read split_config"
  ON public.split_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role (Edge Functions) may update split percentages
DROP POLICY IF EXISTS "service_role: all split_config" ON public.split_config;
CREATE POLICY "service_role: all split_config"
  ON public.split_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 2. pagamentos_split — Per-transaction split ledger
--    One row per payment, recording how the total was split across all buckets.
--    Written by payment-gateway (status=pending), updated by payment-webhook
--    (status=approved) when Mercado Pago confirms payment.
--    transaction_id UNIQUE enforces idempotency on upsert.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pagamentos_split (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        TEXT          UNIQUE NOT NULL,           -- external_reference from MP / internal key
  status                TEXT          NOT NULL
                                      DEFAULT 'pending'
                                      CHECK (status IN (
                                        'pending', 'approved', 'in_mediation',
                                        'rejected', 'refunded', 'charged_back'
                                      )),
  service_type          TEXT          NOT NULL
                                      CHECK (service_type IN ('mototaxi', 'diarista', 'ambulante')),
  service_id            UUID          NOT NULL,                  -- FK to mototaxi_corridas / diarista_agendamentos / pedidos
  total_amount          NUMERIC(10,2) NOT NULL,
  provider_amount       NUMERIC(10,2) NOT NULL,                  -- prestador_pct portion
  ubt_amount            NUMERIC(10,2) NOT NULL,                  -- ubt_pct portion
  entity_amount         NUMERIC(10,2) NOT NULL,                  -- comunidade_pct portion
  entity_id             UUID          REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prize_worker_amount   NUMERIC(10,2) NOT NULL,                  -- premio_trabalhador_pct portion
  prize_consumer_amount NUMERIC(10,2) NOT NULL,                  -- premio_consumidor_pct portion
  godparent_amount      NUMERIC(10,2) NOT NULL,                  -- padrinho_pct / residual portion
  godparent_id          UUID          REFERENCES public.usuarios(id) ON DELETE SET NULL,
  refunded_amount       NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.pagamentos_split IS 'Per-transaction split ledger. Written by payment-gateway (status=pending) and updated by payment-webhook (status=approved) upon MP confirmation.';
COMMENT ON COLUMN public.pagamentos_split.transaction_id   IS 'Primary deduplication key. Matches external_reference sent to Mercado Pago. Falls back to mp_{id} when no external_reference is provided.';
COMMENT ON COLUMN public.pagamentos_split.status           IS 'Mirrors Mercado Pago payment status lifecycle.';
COMMENT ON COLUMN public.pagamentos_split.entity_amount    IS 'Share allocated to the community/neighborhood association (comunidade_pct).';
COMMENT ON COLUMN public.pagamentos_split.godparent_amount IS 'Share allocated to the referral godparent. Also absorbs floating-point rounding residual.';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pagamentos_split_transaction_id
  ON public.pagamentos_split (transaction_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_status
  ON public.pagamentos_split (status);

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_service
  ON public.pagamentos_split (service_type, service_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_godparent
  ON public.pagamentos_split (godparent_id)
  WHERE godparent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_created_at
  ON public.pagamentos_split (created_at DESC);

-- RLS
ALTER TABLE public.pagamentos_split ENABLE ROW LEVEL SECURITY;

-- Participants (payer/provider/godparent) may read their own split records
DROP POLICY IF EXISTS "Participants read own pagamentos_split" ON public.pagamentos_split;
CREATE POLICY "Participants read own pagamentos_split"
  ON public.pagamentos_split
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = godparent_id
    -- Service-level participant access delegated to service table joins (handled by API layer)
  );

-- service_role (Edge Functions) has full access — bypasses RLS entirely
-- (service_role always bypasses RLS, policy below is explicit for documentation)
DROP POLICY IF EXISTS "service_role: all pagamentos_split" ON public.pagamentos_split;
CREATE POLICY "service_role: all pagamentos_split"
  ON public.pagamentos_split
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 3. marketplace_webhook_events — Idempotency guard for Mercado Pago webhooks
--    The UNIQUE constraint on event_id is the core of the idempotency strategy:
--    a second INSERT for the same event_id fails with code 23505 (unique_violation),
--    which payment-webhook catches to return 200 without double-processing.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_webhook_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           TEXT        UNIQUE NOT NULL,  -- MP notification id — idempotency key
  event_type         TEXT        NOT NULL,          -- 'payment', 'subscription', etc.
  external_id        TEXT        NOT NULL,          -- MP payment id referenced by the event
  environment        TEXT        NOT NULL
                                 CHECK (environment IN ('sandbox', 'production')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ,
  processing_status  TEXT        NOT NULL
                                 DEFAULT 'pending'
                                 CHECK (processing_status IN (
                                   'pending', 'processing', 'completed', 'failed', 'ignored'
                                 )),
  attempts           INTEGER     NOT NULL DEFAULT 0,
  error_message      TEXT,
  payload_hash       TEXT        NOT NULL,         -- SHA-256 of external_id (anti-spoofing trace)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.marketplace_webhook_events IS 'Idempotency guard for Mercado Pago webhook events. UNIQUE(event_id) prevents double-processing. Written exclusively by payment-webhook Edge Function.';
COMMENT ON COLUMN public.marketplace_webhook_events.event_id      IS 'MP notification.id — used as the deduplication key. A 23505 error on INSERT means the event was already claimed.';
COMMENT ON COLUMN public.marketplace_webhook_events.payload_hash  IS 'SHA-256 of external_id for anti-spoofing audit trail.';
COMMENT ON COLUMN public.marketplace_webhook_events.attempts      IS 'Number of processing attempts. Incremented by retry logic if implemented.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mwe_event_id
  ON public.marketplace_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_mwe_external_id
  ON public.marketplace_webhook_events (external_id);

CREATE INDEX IF NOT EXISTS idx_mwe_status
  ON public.marketplace_webhook_events (processing_status);

CREATE INDEX IF NOT EXISTS idx_mwe_received_at
  ON public.marketplace_webhook_events (received_at DESC);

-- RLS
ALTER TABLE public.marketplace_webhook_events ENABLE ROW LEVEL SECURITY;

-- No public access — only service_role and admins
DROP POLICY IF EXISTS "service_role: all marketplace_webhook_events" ON public.marketplace_webhook_events;
CREATE POLICY "service_role: all marketplace_webhook_events"
  ON public.marketplace_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins may read for audit/debugging via Supabase Studio or admin API
DROP POLICY IF EXISTS "Admin read marketplace_webhook_events" ON public.marketplace_webhook_events;
CREATE POLICY "Admin read marketplace_webhook_events"
  ON public.marketplace_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    )
  );


-- =============================================================================
-- Finalize
-- =============================================================================
-- Reload PostgREST schema cache so new tables are immediately queryable via API
NOTIFY pgrst, 'reload schema';

COMMIT;
