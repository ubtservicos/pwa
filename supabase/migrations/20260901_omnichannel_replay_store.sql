-- ==============================================================================
-- MIGRATION: 20260901_omnichannel_replay_store.sql
-- DESCRIPTION: Atomic Replay Store for omnichannel.answer-engine.v1
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.omnichannel_replay_store (
  request_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient cleanup of expired replay records
CREATE INDEX IF NOT EXISTS idx_omnichannel_replay_expires_at 
  ON public.omnichannel_replay_store (expires_at);

-- Enable Row Level Security
ALTER TABLE public.omnichannel_replay_store ENABLE ROW LEVEL SECURITY;

-- Restrict all operations exclusively to service_role / backend functions
DROP POLICY IF EXISTS "Service Role Full Access Replay Store" ON public.omnichannel_replay_store;
CREATE POLICY "Service Role Full Access Replay Store"
  ON public.omnichannel_replay_store
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Maintenance Function to purge expired records periodically
CREATE OR REPLACE FUNCTION public.cleanup_expired_omnichannel_replays()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.omnichannel_replay_store
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;
