-- Migração: 20261119171000_fix_coco_dicas_materiais_rls.sql
-- Fase 2 Plano Côco & Cia: Libera CRUD completo (INSERT, UPDATE, DELETE) em public.coco_dicas_materiais
-- para administradores e dirigentes/colaboradores da Côco & Cia.
-- Ambiente Alvo: Homologação (xqujubbqcfqxkfczbidq)

-- 1. Garante colunas auxiliares
ALTER TABLE public.coco_dicas_materiais
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Função SECURITY DEFINER para checar permissão de gestão de manuais Côco & Cia
CREATE OR REPLACE FUNCTION public.can_manage_coco_manuais()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
  FROM public.usuarios
  WHERE id = auth.uid();

  RETURN v_role IN (
    'associacao',
    'associacao_lider',
    'cocoecia',
    'cocoecia-dirigentes',
    'cocoecia-colaborador'
  );
END;
$$;

-- 3. Políticas RLS e Grants em public.coco_dicas_materiais
ALTER TABLE public.coco_dicas_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public_Read_Dicas_Materiais" ON public.coco_dicas_materiais;
CREATE POLICY "Public_Read_Dicas_Materiais" ON public.coco_dicas_materiais
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "coco_dicas_materiais_manage_policy" ON public.coco_dicas_materiais;
CREATE POLICY "coco_dicas_materiais_manage_policy" ON public.coco_dicas_materiais
  FOR ALL
  TO authenticated
  USING (public.can_manage_coco_manuais())
  WITH CHECK (public.can_manage_coco_manuais());

GRANT SELECT ON public.coco_dicas_materiais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_dicas_materiais TO authenticated;

NOTIFY pgrst, 'reload config';
