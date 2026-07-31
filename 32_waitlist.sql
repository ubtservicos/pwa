-- Migration: 32_waitlist.sql
-- Description: Create public.waitlist table, indexes, and RLS policies

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at_utc timestamptz DEFAULT now(),
  created_at_local text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cidade text NOT NULL,
  perfil text NOT NULL, -- 'morador' | 'prestador' | 'visitante'
  origem text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referer text,
  device_type text,
  browser text,
  os text,
  ip_hash text NOT NULL, -- IP anonymized using sha256
  consentimento_lgpd boolean DEFAULT false,
  status text DEFAULT 'novo', -- 'novo' | 'contatado' | 'arquivado'
  observacoes text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_telefone ON public.waitlist(telefone);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_cidade ON public.waitlist(cidade);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist(status);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable insert for anyone on waitlist" ON public.waitlist;
CREATE POLICY "Enable insert for anyone on waitlist"
  ON public.waitlist FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for admins on waitlist" ON public.waitlist;
CREATE POLICY "Enable read access for admins on waitlist"
  ON public.waitlist FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'marketing')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

DROP POLICY IF EXISTS "Enable write access for admins on waitlist" ON public.waitlist;
CREATE POLICY "Enable write access for admins on waitlist"
  ON public.waitlist FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'marketing')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );
