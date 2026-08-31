-- ============================================================
-- MIGRATION: IN-APP NOTIFICATIONS SYSTEM (Substituto Push)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read_status boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO service_role;

-- RLS
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users_Can_Read_Own_Notifications" ON public.in_app_notifications;
CREATE POLICY "Users_Can_Read_Own_Notifications"
  ON public.in_app_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users_Can_Update_Own_Notifications" ON public.in_app_notifications;
CREATE POLICY "Users_Can_Update_Own_Notifications"
  ON public.in_app_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated_Can_Insert_Notifications" ON public.in_app_notifications;
CREATE POLICY "Authenticated_Can_Insert_Notifications"
  ON public.in_app_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'in_app_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
  END IF;
END $$;
