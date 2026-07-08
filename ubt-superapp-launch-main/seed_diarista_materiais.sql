-- Criação da tabela de materiais de limpeza padrão da plataforma
CREATE TABLE IF NOT EXISTS public.diarista_materiais_padrao (
    id text PRIMARY KEY,
    nome text NOT NULL,
    emoji text NOT NULL,
    categoria text NOT NULL,
    preco_medio numeric NOT NULL
);

-- Ativa RLS (opcional)
ALTER TABLE public.diarista_materiais_padrao ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (qualquer um pode ler a lista de materiais)
CREATE POLICY "Leitura pública para diarista_materiais_padrao" 
ON public.diarista_materiais_padrao FOR SELECT 
USING (true);

-- Inserindo os dados de Produtos Químicos e Utensílios
INSERT INTO public.diarista_materiais_padrao (id, nome, emoji, categoria, preco_medio) VALUES
('detergente', 'Detergente Neutro (500ml)', '🧴', 'quimicos', 2.65),
('agua_sanitaria', 'Água Sanitária (1L)', '💧', 'quimicos', 3.50),
('desinfetante', 'Desinfetante (1L)', '🌸', 'quimicos', 6.00),
('multiuso', 'Limpador Multiuso (500ml)', '✨', 'quimicos', 5.75),
('desengordurante', 'Desengordurante (500ml)', '🧽', 'quimicos', 10.50),
('alcool', 'Álcool 70% (1L)', '⚕️', 'quimicos', 7.50),
('sabao_po', 'Sabão em Pó (1kg)', '🫧', 'quimicos', 13.50),
('limpa_vidros', 'Limpa-vidros (500ml)', '🪟', 'quimicos', 8.00),

('pano_microfibra', 'Kit Pano Microfibra (3un)', '🧻', 'utensilios', 12.50),
('pano_chao', 'Pano de Chão Alvejado (1un)', '🧶', 'utensilios', 4.75),
('esponja', 'Esponja Dupla Face (Pct 4)', '🧽', 'utensilios', 4.00),
('vassoura', 'Vassoura com cabo', '🧹', 'utensilios', 16.00),
('rodo', 'Rodo com cabo', '🧹', 'utensilios', 14.00),
('pa_lixo', 'Pá de Lixo', '🗑️', 'utensilios', 6.00),
('balde', 'Balde Plástico 10L', '🪣', 'utensilios', 11.00),
('luvas', 'Luvas de Borracha (1 par)', '🧤', 'utensilios', 7.00),
('escova_sanitaria', 'Escova Sanitária', '🚽', 'utensilios', 11.50)
ON CONFLICT (id) DO UPDATE SET 
    nome = EXCLUDED.nome,
    emoji = EXCLUDED.emoji,
    categoria = EXCLUDED.categoria,
    preco_medio = EXCLUDED.preco_medio;
