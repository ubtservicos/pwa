-- setup_mototaxi.sql
-- Migration script to support Mototaxi and Rides feature in Supabase with Realtime syncing

-- 1. Create Mototaxi Active Sessions table (mototaxi_sessoes)
DROP TABLE IF EXISTS public.mototaxi_sessoes CASCADE;
CREATE TABLE public.mototaxi_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  is_online boolean DEFAULT true,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (prestador_id)
);

-- 2. Create Mototaxi Rides table (mototaxi_corridas)
DROP TABLE IF EXISTS public.mototaxi_corridas CASCADE;
CREATE TABLE public.mototaxi_corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('searching', 'accepted', 'in_progress', 'completed', 'cancelled')),
  type text NOT NULL CHECK (type IN ('carona', 'entrega')),
  origin jsonb NOT NULL, -- { lat, lng, address }
  destination jsonb NOT NULL, -- { lat, lng, address }
  distance_km numeric(5,2) NOT NULL,
  duration_min integer NOT NULL,
  estimated_price numeric(10,2) NOT NULL,
  final_price numeric(10,2),
  payment_method text CHECK (payment_method IN ('pix', 'card')),
  created_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone
);

-- 3. Enable Row Level Security (RLS) for public development access
ALTER TABLE public.mototaxi_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mototaxi_corridas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow All mototaxi_sessoes" ON public.mototaxi_sessoes;
DROP POLICY IF EXISTS "Allow All mototaxi_corridas" ON public.mototaxi_corridas;

-- Create permissive development policies (Allow All)
CREATE POLICY "Allow All mototaxi_sessoes" ON public.mototaxi_sessoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All mototaxi_corridas" ON public.mototaxi_corridas FOR ALL USING (true) WITH CHECK (true);

-- 4. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
