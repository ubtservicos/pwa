-- Migration: 20260815142500_create_financial_audit_logs
-- Release 2.0 - Financial Motor Infrastructure
-- Creates an immutable audit log table for all financial transaction attempts.
-- Security: RLS enabled. Only service_role (Edge Functions) may insert/select.

-- ============================================================
-- TABLE CREATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_type  TEXT        NOT NULL,  -- e.g. 'payment_intent', 'refund', 'split_transfer'
  status            TEXT        NOT NULL,  -- e.g. 'pending', 'success', 'failed', 'rejected'
  payload           JSONB,                 -- Full API response payload (MP or internal)
  error_details     TEXT                   -- Stack trace or error message on failure
);

-- ============================================================
-- COMMENTS (for documentation / supabase studio)
-- ============================================================
COMMENT ON TABLE  public.financial_audit_logs IS 'Immutable audit trail for all financial operations. Written by Edge Functions only via service_role.';
COMMENT ON COLUMN public.financial_audit_logs.transaction_type IS 'Type of financial operation: payment_intent, refund, split_transfer, payout, etc.';
COMMENT ON COLUMN public.financial_audit_logs.status           IS 'Outcome of the operation: pending, success, failed, rejected, timeout.';
COMMENT ON COLUMN public.financial_audit_logs.payload          IS 'Full JSON payload from the external API or internal system (non-PII).';
COMMENT ON COLUMN public.financial_audit_logs.error_details    IS 'Human-readable error message or stack trace for debugging.';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny ALL by default (no permissive policy for anon or authenticated roles)
-- This is the secure default: if no policy matches, access is denied.

-- Allow service_role to INSERT audit logs (called from Edge Functions)
CREATE POLICY "service_role: insert financial_audit_logs"
  ON public.financial_audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service_role to SELECT audit logs (for internal admin queries)
CREATE POLICY "service_role: select financial_audit_logs"
  ON public.financial_audit_logs
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX idx_financial_audit_logs_created_at
  ON public.financial_audit_logs (created_at DESC);

CREATE INDEX idx_financial_audit_logs_status
  ON public.financial_audit_logs (status);

CREATE INDEX idx_financial_audit_logs_type_status
  ON public.financial_audit_logs (transaction_type, status);
