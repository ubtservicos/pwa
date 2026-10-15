-- Durable, participant-only quick messages for active Mototaxi rides.
BEGIN;

CREATE TABLE IF NOT EXISTS public.mototaxi_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.mototaxi_corridas(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('tomador', 'prestador')),
  message_text text NOT NULL CHECK (
    char_length(btrim(message_text)) BETWEEN 1 AND 160
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mototaxi_mensagens_corrida_created
  ON public.mototaxi_mensagens (corrida_id, created_at, id);

ALTER TABLE public.mototaxi_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mototaxi participants read messages" ON public.mototaxi_mensagens;
CREATE POLICY "Mototaxi participants read messages"
  ON public.mototaxi_mensagens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.mototaxi_corridas corrida
      WHERE corrida.id = mototaxi_mensagens.corrida_id
        AND auth.uid() IN (corrida.tomador_id, corrida.prestador_id)
    )
  );

DROP POLICY IF EXISTS "Mototaxi participants send own messages" ON public.mototaxi_mensagens;
CREATE POLICY "Mototaxi participants send own messages"
  ON public.mototaxi_mensagens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.mototaxi_corridas corrida
      WHERE corrida.id = mototaxi_mensagens.corrida_id
        AND corrida.status IN ('accepted', 'arriving', 'in_progress')
        AND (
          (mototaxi_mensagens.sender_role = 'tomador' AND corrida.tomador_id = auth.uid())
          OR
          (mototaxi_mensagens.sender_role = 'prestador' AND corrida.prestador_id = auth.uid())
        )
    )
  );

REVOKE ALL ON public.mototaxi_mensagens FROM anon;
REVOKE UPDATE, DELETE ON public.mototaxi_mensagens FROM authenticated;
GRANT SELECT, INSERT ON public.mototaxi_mensagens TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mototaxi_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mototaxi_mensagens;
  END IF;
END $$;

COMMENT ON TABLE public.mototaxi_mensagens IS
  'Participant-only durable quick messages exchanged during an active Mototaxi ride.';

COMMIT;
