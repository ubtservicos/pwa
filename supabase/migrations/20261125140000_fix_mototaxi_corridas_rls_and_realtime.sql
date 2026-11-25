-- Migration: 20261125140000_fix_mototaxi_corridas_rls_and_realtime.sql
-- Purpose:
--   1. Update public.mototaxi_corridas RLS policies to use public.is_current_usuario(...)
--      so both standard and legacy accounts (auth.users.id != public.usuarios.id) can
--      create, view, accept, and progress rides reliably.
--   2. Add public.mototaxi_sessoes to supabase_realtime publication (idempotently) so
--      the Tomador map receives live driver GPS updates.
--   3. Reload PostgREST schema cache.

DROP POLICY IF EXISTS "mototaxi_corridas_insert_policy" ON public.mototaxi_corridas;
CREATE POLICY "mototaxi_corridas_insert_policy"
  ON public.mototaxi_corridas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_current_usuario(tomador_id) OR is_admin())
    AND status = 'searching'
  );

DROP POLICY IF EXISTS "mototaxi_corridas_select_policy" ON public.mototaxi_corridas;
CREATE POLICY "mototaxi_corridas_select_policy"
  ON public.mototaxi_corridas
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR status IN ('searching', 'pending', 'buscando', 'solicitado')
    OR is_admin()
  );

DROP POLICY IF EXISTS "mototaxi_corridas_update_policy" ON public.mototaxi_corridas;
CREATE POLICY "mototaxi_corridas_update_policy"
  ON public.mototaxi_corridas
  FOR UPDATE
  TO authenticated
  USING (
    (status IN ('searching', 'pending', 'buscando', 'solicitado') AND prestador_id IS NULL)
    OR public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR is_admin()
  )
  WITH CHECK (
    (
      public.is_current_usuario(tomador_id)
      OR public.is_current_usuario(prestador_id)
      OR is_admin()
    )
    AND status <> 'paid'
  );

-- Ensure mototaxi_sessoes is in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mototaxi_sessoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mototaxi_sessoes;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
