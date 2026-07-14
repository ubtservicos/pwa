-- setup_coco.sql
-- Migration to support Côco & Cia ONG feature implementation

-- 1. Update check constraints on public.usuarios and public.profiles to allow 'cocoecia' role
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('tomador', 'prestador', 'admin', 'cocoecia'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('tomador', 'prestador', 'admin', 'client', 'provider', 'user', 'authenticated', 'cocoecia'));

-- 2. Create the trucks table (coco_caminhoes)
DROP TABLE IF EXISTS public.coco_pontos CASCADE;
DROP TABLE IF EXISTS public.coco_caminhoes CASCADE;

CREATE TABLE public.coco_caminhoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  plate text NOT NULL UNIQUE,
  apelido text NOT NULL,
  is_online boolean DEFAULT false,
  lat numeric(10,6),
  lng numeric(10,6),
  collections_today integer DEFAULT 0,
  total_collections integer DEFAULT 0,
  areas_atendidas text[] DEFAULT ARRAY['Centro']::text[],
  pix_key text,
  status_aprovacao text DEFAULT 'pending' CHECK (status_aprovacao IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone DEFAULT now()
);


-- 3. Create the collection points table (coco_pontos)
CREATE TABLE public.coco_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  address text NOT NULL,
  material text NOT NULL,
  foto_url text, -- holds standard packaging presets or custom uploaded base64 data
  status text DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'confirmado', 'coletado', 'recusado')),
  caminhao_id uuid REFERENCES public.coco_caminhoes(id) ON DELETE SET NULL,
  horario_previsto text,
  created_at timestamp with time zone DEFAULT now(),
  coletado_at timestamp with time zone
);

-- 4. Enable Row Level Security (RLS) for public development access
ALTER TABLE public.coco_caminhoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_pontos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors during re-runs
DROP POLICY IF EXISTS "Allow All coco_caminhoes" ON public.coco_caminhoes;
DROP POLICY IF EXISTS "Allow All coco_pontos" ON public.coco_pontos;

-- Create permissive development policies
CREATE POLICY "Allow All coco_caminhoes" ON public.coco_caminhoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All coco_pontos" ON public.coco_pontos FOR ALL USING (true) WITH CHECK (true);

-- 5. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
