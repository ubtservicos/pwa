-- Create table for declared prices history
CREATE TABLE IF NOT EXISTS diarista_materiais_precos_declarados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id uuid NOT NULL,
  material_id text NOT NULL,
  preco numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE diarista_materiais_precos_declarados ENABLE ROW LEVEL SECURITY;

-- Allow insert by authenticated users
CREATE POLICY "Prestadores podem inserir seus proprios precos" ON diarista_materiais_precos_declarados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow select by anyone (to calculate averages)
CREATE POLICY "Qualquer um pode ler historico de precos" ON diarista_materiais_precos_declarados
  FOR SELECT USING (true);

-- Create a view for the 7-day average
CREATE OR REPLACE VIEW vw_diarista_materiais_media_7d AS
SELECT 
  material_id,
  AVG(preco) as preco_medio,
  COUNT(*) as total_declaracoes
FROM diarista_materiais_precos_declarados
WHERE created_at >= now() - interval '7 days'
GROUP BY material_id;

-- Insert some dummy data for the last 7 days so there's an immediate average
INSERT INTO diarista_materiais_precos_declarados (prestador_id, material_id, preco, created_at)
VALUES
  -- Sabão em Pó (id: sabao_po)
  ('00000000-0000-0000-0000-000000000000', 'sabao_po', 12.50, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'sabao_po', 14.00, now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000002', 'sabao_po', 13.00, now() - interval '5 days'),
  
  -- Água Sanitária (id: agua_sanitaria)
  ('00000000-0000-0000-0000-000000000000', 'agua_sanitaria', 5.50, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'agua_sanitaria', 6.00, now() - interval '4 days'),
  
  -- Desinfetante (id: desinfetante)
  ('00000000-0000-0000-0000-000000000000', 'desinfetante', 8.90, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'desinfetante', 9.50, now() - interval '6 days'),
  
  -- Limpa Vidros (id: limpa_vidros)
  ('00000000-0000-0000-0000-000000000000', 'limpa_vidros', 10.00, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'limpa_vidros', 11.50, now() - interval '4 days'),
  
  -- Detergente (id: detergente)
  ('00000000-0000-0000-0000-000000000000', 'detergente', 3.00, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'detergente', 3.50, now() - interval '3 days'),
  
  -- Esponja (id: esponja)
  ('00000000-0000-0000-0000-000000000000', 'esponja', 2.50, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'esponja', 2.00, now() - interval '5 days'),
  
  -- Panos de Chão (id: pano_chao)
  ('00000000-0000-0000-0000-000000000000', 'pano_chao', 15.00, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'pano_chao', 18.00, now() - interval '6 days'),
  
  -- Saco de Lixo (id: saco_lixo)
  ('00000000-0000-0000-0000-000000000000', 'saco_lixo', 8.00, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'saco_lixo', 9.00, now() - interval '4 days');
