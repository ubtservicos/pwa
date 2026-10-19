-- Migration: Allow admin/superadmin access to prestador_mototaxi and fix is_superadmin function

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'operator', 'financeiro', 'moderador')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "moto_select" ON public.prestador_mototaxi;
CREATE POLICY "moto_select" ON public.prestador_mototaxi
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "moto_update" ON public.prestador_mototaxi;
CREATE POLICY "moto_update" ON public.prestador_mototaxi
FOR UPDATE TO public
USING (user_id = auth.uid() OR is_admin() OR is_superadmin())
WITH CHECK (user_id = auth.uid() OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "moto_insert" ON public.prestador_mototaxi;
CREATE POLICY "moto_insert" ON public.prestador_mototaxi
FOR INSERT TO public
WITH CHECK (user_id = auth.uid() OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "moto_delete" ON public.prestador_mototaxi;
CREATE POLICY "moto_delete" ON public.prestador_mototaxi
FOR DELETE TO public
USING (user_id = auth.uid() OR is_admin() OR is_superadmin());
