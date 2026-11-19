-- Migração: 20261119181000_restructure_coco_frota.sql
-- Fase 4 Plano Côco & Cia: Reestrutura gestão de frota (colaboradores vinculados, rotas ordenadas e horários de saída/retorno)
-- Ambiente Alvo: Homologação (xqujubbqcfqxkfczbidq)

ALTER TABLE public.coco_caminhoes
  ADD COLUMN IF NOT EXISTS colaboradores_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS hora_saida text,
  ADD COLUMN IF NOT EXISTS expectativa_retorno text;

-- Garante que dirigentes/colaboradores da Côco & Cia e admins gerenciem coco_caminhoes via RLS
ALTER TABLE public.coco_caminhoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coco_caminhoes_manage_policy" ON public.coco_caminhoes;
CREATE POLICY "coco_caminhoes_manage_policy" ON public.coco_caminhoes
  FOR ALL
  TO authenticated
  USING (public.can_manage_coco_manuais() OR auth.uid() = prestador_id)
  WITH CHECK (public.can_manage_coco_manuais() OR auth.uid() = prestador_id);

GRANT SELECT ON public.coco_caminhoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_caminhoes TO authenticated;

NOTIFY pgrst, 'reload config';
