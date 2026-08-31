-- ============================================================
-- MIGRATION: COCO & CIA V2 (Logística, Agenda & Dicas)
-- ============================================================

-- 1. Novas colunas em coco_pontos
ALTER TABLE public.coco_pontos 
ADD COLUMN IF NOT EXISTS quantidade_estimada text,
ADD COLUMN IF NOT EXISTS local_armazenamento text;

-- 2. Tabela de dicas e manuais educativos dos materiais
CREATE TABLE IF NOT EXISTS public.coco_dicas_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id text NOT NULL,
  titulo text,
  conteudo_html text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Tabela de agenda de coleta por bairro
CREATE TABLE IF NOT EXISTS public.coco_agenda_bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro_nome text NOT NULL,
  dia_semana text NOT NULL,
  horario_inicio text NOT NULL,
  horario_fim text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Grants e RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_dicas_materiais TO authenticated;
GRANT SELECT ON public.coco_dicas_materiais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_agenda_bairros TO authenticated;
GRANT SELECT ON public.coco_agenda_bairros TO anon;

ALTER TABLE public.coco_dicas_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_agenda_bairros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public_Read_Dicas_Materiais" ON public.coco_dicas_materiais;
CREATE POLICY "Public_Read_Dicas_Materiais" ON public.coco_dicas_materiais FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public_Read_Agenda_Bairros" ON public.coco_agenda_bairros;
CREATE POLICY "Public_Read_Agenda_Bairros" ON public.coco_agenda_bairros FOR SELECT USING (true);

-- 5. Seed inicial de dicas educativas de descarte
INSERT INTO public.coco_dicas_materiais (material_id, titulo, conteudo_html)
VALUES 
  ('plastico', 'Como descartar Plásticos', '<p>Lave e seque as garrafas PET e embalagens plásticas. Amasse-as para reduzir o volume e facilitar o transporte nos caminhões da Côco & Cia.</p>'),
  ('vidro', 'Como descartar Vidros', '<p>Guarde garrafas e potes inteiros. Se houver cacos, embale em caixa de papelão ou garrafa PET cortada para proteger os coletores da nossa equipe.</p>'),
  ('oleo', 'Como descartar Óleo Usado', '<p>Espere o óleo de cozinha esfriar e armazene em garrafas PET transparentes bem fechadas. Nunca despeje no ralo ou na areia da praia!</p>'),
  ('papelao', 'Como descartar Papelão e Papel', '<p>Desmonte as caixas de papelão e mantenha-as secas e amarradas. Evite misturar papel engordurado ou plastificado.</p>'),
  ('latinhas', 'Como descartar Alumínio / Latinhas', '<p>Esvazie o líquido restante e amasse as latinhas para otimizar espaço de carga dos nossos coletores parceiros.</p>'),
  ('coco', 'Como descartar Cascas de Coco', '<p>Separe as cascas de coco inteiras ou partidas em sacos resistentes ou caixas. A Côco & Cia encaminha para trituração e compostagem ecológica.</p>')
ON CONFLICT DO NOTHING;

-- 6. Seed inicial de agenda por bairros de Ubatuba
INSERT INTO public.coco_agenda_bairros (bairro_nome, dia_semana, horario_inicio, horario_fim, is_active)
VALUES
  ('Centro', 'Segunda-feira', '08:00', '12:00', true),
  ('Itaguá', 'Segunda-feira', '13:30', '17:30', true),
  ('Praia Grande', 'Terça-feira', '08:00', '13:00', true),
  ('Tenório', 'Terça-feira', '14:00', '17:30', true),
  ('Perequê-Açu', 'Quarta-feira', '08:00', '12:00', true),
  ('Toninhas', 'Quarta-feira', '13:30', '17:30', true),
  ('Enseada', 'Quinta-feira', '08:30', '13:00', true),
  ('Itamambuca', 'Sexta-feira', '09:00', '14:00', true)
ON CONFLICT DO NOTHING;
