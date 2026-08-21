-- Fix RLS policies for pagamentos_split to allow Admins and Associations to view their data

DROP POLICY IF EXISTS "Admin select pagamentos_split" ON public.pagamentos_split;
CREATE POLICY "Admin select pagamentos_split" 
  ON public.pagamentos_split 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Association read pagamentos_split" ON public.pagamentos_split;
CREATE POLICY "Association read pagamentos_split" 
  ON public.pagamentos_split 
  FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = entity_id OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'associacao'
    )
  );
