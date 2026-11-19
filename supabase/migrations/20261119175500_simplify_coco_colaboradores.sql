-- Migração: 20261119175500_simplify_coco_colaboradores.sql
-- Fase 3 Plano Côco & Cia: Simplifica persistência de public.coco_colaboradores para Nome e Telefone/WhatsApp
-- Ambiente Alvo: Homologação (xqujubbqcfqxkfczbidq)

-- 1. Garante colunas opcionais e coluna booleana is_ativo sincronizada com status
ALTER TABLE public.coco_colaboradores
  ALTER COLUMN veiculo DROP NOT NULL,
  ALTER COLUMN bairro_atuacao DROP NOT NULL;

ALTER TABLE public.coco_colaboradores
  ADD COLUMN IF NOT EXISTS is_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.coco_colaboradores
SET is_ativo = (LOWER(COALESCE(status, 'ativo')) <> 'inativo')
WHERE status IS NOT NULL;

-- 2. Garante RLS e Grants para gestão de colaboradores Côco & Cia
ALTER TABLE public.coco_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coco_colaboradores_manage_policy" ON public.coco_colaboradores;
CREATE POLICY "coco_colaboradores_manage_policy" ON public.coco_colaboradores
  FOR ALL
  TO authenticated
  USING (public.can_manage_coco_manuais())
  WITH CHECK (public.can_manage_coco_manuais());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_colaboradores TO authenticated;

NOTIFY pgrst, 'reload config';
