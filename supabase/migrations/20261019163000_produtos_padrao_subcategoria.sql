-- ==============================================================================
-- MIGRATION: Adiciona coluna subcategoria em produtos_padrao
-- Permite hierarquia: Categoria Macro > (Opcional: Marca) > Sub-categoria > Produto
-- ==============================================================================

ALTER TABLE public.produtos_padrao 
ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100) DEFAULT 'Geral';

CREATE INDEX IF NOT EXISTS idx_produtos_padrao_subcategoria 
ON public.produtos_padrao(subcategoria);

CREATE INDEX IF NOT EXISTS idx_produtos_padrao_macro_sub 
ON public.produtos_padrao(categoria, subcategoria);
