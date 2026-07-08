-- setup_ceps.sql
-- Create table for Ubatuba CEPs and addresses geocoded for Leaflet integration

DROP TABLE IF EXISTS public.ceps_ubatuba CASCADE;

CREATE TABLE public.ceps_ubatuba (
  cep text PRIMARY KEY,
  logradouro text NOT NULL,
  bairro text NOT NULL,
  lat numeric(10,6),
  lng numeric(10,6),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for development
ALTER TABLE public.ceps_ubatuba ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All ceps_ubatuba" ON public.ceps_ubatuba;
CREATE POLICY "Allow All ceps_ubatuba" ON public.ceps_ubatuba FOR ALL USING (true) WITH CHECK (true);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
