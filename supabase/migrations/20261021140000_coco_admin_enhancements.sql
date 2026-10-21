-- ============================================================
-- MIGRATION: COCO & CIA ADMIN ENHANCEMENTS (Etapa 2)
-- UTF-8 encoding estrito, suporte a status ativo em manuais,
-- vanity_slug e logo_url em coco_config, e suporte a storage.
-- ============================================================

-- 1. coco_dicas_materiais: Adicionar is_active e normalizar UTF-8
ALTER TABLE public.coco_dicas_materiais 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. coco_agenda_bairros: Garantir integridade de colunas
ALTER TABLE public.coco_agenda_bairros
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. coco_config: Criar se não existir com ID integer (singleton 1) e adicionar vanity_slug e logo_url
CREATE TABLE IF NOT EXISTS public.coco_config (
  id integer PRIMARY KEY DEFAULT 1,
  pix_key text,
  descricao text,
  missao text,
  vanity_slug text DEFAULT 'cocoecia',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.coco_config
ADD COLUMN IF NOT EXISTS vanity_slug text DEFAULT 'cocoecia',
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Inserir ou atualizar registro singleton na coco_config
INSERT INTO public.coco_config (id, pix_key, descricao, missao, vanity_slug)
VALUES (
  1,
  'cocoecia@ubatuba.sp.gov.br',
  'Braço ecológico e social da UBT para reciclagem em Ubatuba',
  'Promover a sustentabilidade e economia circular em nossas praias',
  'cocoecia'
)
ON CONFLICT (id) DO UPDATE SET
  vanity_slug = COALESCE(public.coco_config.vanity_slug, EXCLUDED.vanity_slug);

-- 4. coco_caminhoes: Garantir colunas completas
CREATE TABLE IF NOT EXISTS public.coco_caminhoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  apelido text NOT NULL,
  prestador_id uuid,
  pix_key text,
  areas_atendidas text[] DEFAULT ARRAY['Centro', 'Itaguá']::text[],
  status_aprovacao text DEFAULT 'approved',
  role_solicitada text DEFAULT 'cocoecia-colaborador',
  is_online boolean DEFAULT false,
  collections_today integer DEFAULT 0,
  total_collections integer DEFAULT 0,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.coco_caminhoes
ADD COLUMN IF NOT EXISTS prestador_id uuid,
ADD COLUMN IF NOT EXISTS status_aprovacao text DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS role_solicitada text DEFAULT 'cocoecia-colaborador',
ADD COLUMN IF NOT EXISTS collections_today integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_collections integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5. RLS e Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_config TO authenticated;
GRANT SELECT ON public.coco_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coco_caminhoes TO authenticated;
GRANT SELECT ON public.coco_caminhoes TO anon;

ALTER TABLE public.coco_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_caminhoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public_Read_Coco_Config" ON public.coco_config;
CREATE POLICY "Public_Read_Coco_Config" ON public.coco_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth_Write_Coco_Config" ON public.coco_config;
CREATE POLICY "Auth_Write_Coco_Config" ON public.coco_config FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Public_Read_Coco_Caminhoes" ON public.coco_caminhoes;
CREATE POLICY "Public_Read_Coco_Caminhoes" ON public.coco_caminhoes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth_Write_Coco_Caminhoes" ON public.coco_caminhoes;
CREATE POLICY "Auth_Write_Coco_Caminhoes" ON public.coco_caminhoes FOR ALL TO authenticated USING (true);

-- 6. Storage Bucket para 'entidades' (execução protegida)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('entidades', 'entidades', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Public_Read_Entidades_Bucket" ON storage.objects;
    CREATE POLICY "Public_Read_Entidades_Bucket" ON storage.objects
      FOR SELECT USING (bucket_id = 'entidades');

    DROP POLICY IF EXISTS "Auth_Insert_Entidades_Bucket" ON storage.objects;
    CREATE POLICY "Auth_Insert_Entidades_Bucket" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'entidades');

    DROP POLICY IF EXISTS "Auth_Update_Entidades_Bucket" ON storage.objects;
    CREATE POLICY "Auth_Update_Entidades_Bucket" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'entidades');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 7. Atualização UTF-8 das Dicas Educativas
UPDATE public.coco_dicas_materiais
SET 
  titulo = CASE material_id
    WHEN 'plastico' THEN 'Como descartar Plásticos'
    WHEN 'vidro' THEN 'Como descartar Vidros'
    WHEN 'oleo' THEN 'Como descartar Óleo Usado'
    WHEN 'papelao' THEN 'Como descartar Papelão e Papel'
    WHEN 'latinhas' THEN 'Como descartar Alumínio / Latinhas'
    WHEN 'coco' THEN 'Como descartar Cascas de Coco'
    ELSE titulo
  END,
  conteudo_html = CASE material_id
    WHEN 'plastico' THEN '<p>Lave e seque as garrafas PET e embalagens plásticas. Amasse-as para reduzir o volume e facilitar o transporte nos caminhões da Côco & Cia.</p>'
    WHEN 'vidro' THEN '<p>Guarde garrafas e potes inteiros. Se houver cacos, embale em caixa de papelão ou garrafa PET cortada para proteger os coletores da nossa equipe.</p>'
    WHEN 'oleo' THEN '<p>Espere o óleo de cozinha esfriar e armazene em garrafas PET transparentes bem fechadas. Nunca despeje no ralo ou na areia da praia!</p>'
    WHEN 'papelao' THEN '<p>Desmonte as caixas de papelão e mantenha-as secas e amarradas. Evite misturar papel engordurado ou plastificado.</p>'
    WHEN 'latinhas' THEN '<p>Esvazie o líquido restante e amasse as latinhas para otimizar espaço de carga dos nossos coletores parceiros.</p>'
    WHEN 'coco' THEN '<p>Separe as cascas de coco inteiras ou partidas em sacos resistentes ou caixas. A Côco & Cia encaminha para trituração e compostagem ecológica.</p>'
    ELSE conteudo_html
  END,
  is_active = COALESCE(is_active, true)
WHERE material_id IN ('plastico', 'vidro', 'oleo', 'papelao', 'latinhas', 'coco');
