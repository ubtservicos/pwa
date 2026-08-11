-- migration: 40_dynamic_split_rules.sql
-- UBT SuperApp — Dynamic split configs, provider custom configurations, and associations mapping

-- 1. Create associations table
CREATE TABLE IF NOT EXISTS public.associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text UNIQUE,
  bairros text[] DEFAULT '{}'::text[],
  pix_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed initial default associations for Ubatuba neighborhoods
INSERT INTO public.associations (name, cnpj, bairros, pix_key) VALUES
  ('Associação de Moradores do Itaguá', '12.345.678/0001-01', '{"Itaguá", "Tenório"}', 'itagua@pix.org.br'),
  ('Associação de Moradores do Perequê-Açu', '12.345.678/0001-02', '{"Perequê-Açu", "Usina"}', 'pereque@pix.org.br'),
  ('Associação Protetora de Ubatuba Centro', '12.345.678/0001-03', '{"Centro", "Barra da Lagoa"}', 'centro@pix.org.br')
ON CONFLICT (cnpj) DO NOTHING;

-- 2. Create provider_associations table
CREATE TABLE IF NOT EXISTS public.provider_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  service_type text NOT NULL, -- e.g., 'mototaxi', 'diarista', 'cocoecia', 'ambulante'
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, service_type)
);

-- 3. Create association_change_requests table
CREATE TABLE IF NOT EXISTS public.association_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  current_association_id uuid REFERENCES public.associations(id) ON DELETE SET NULL,
  requested_association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  admin_notes text,
  resolved_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create provider_split_settings table (stores custom allocations of the benefits pool)
CREATE TABLE IF NOT EXISTS public.provider_split_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE UNIQUE,
  comunidade_pct numeric NOT NULL,
  premio_trabalhador_pct numeric NOT NULL,
  premio_consumidor_pct numeric NOT NULL,
  padrinho_pct numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_minimum_percentages CHECK (
    comunidade_pct >= 0.5 AND
    premio_trabalhador_pct >= 0.5 AND
    premio_consumidor_pct >= 0.5 AND
    padrinho_pct >= 0.5
  )
);

-- 5. Create provider_split_settings_audit table
CREATE TABLE IF NOT EXISTS public.provider_split_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  changed_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  old_distribution jsonb,
  new_distribution jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_split_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_split_settings_audit ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies
-- Associations: public select, write restricted to admins
CREATE POLICY "Public read associations" ON public.associations FOR SELECT USING (true);
CREATE POLICY "Admin write associations" ON public.associations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Provider Associations: read by owner and admin, write by owner and admin
CREATE POLICY "Owner/Admin read provider_associations" ON public.provider_associations FOR SELECT TO authenticated
  USING (auth.uid() = provider_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Owner/Admin write provider_associations" ON public.provider_associations FOR ALL TO authenticated
  USING (auth.uid() = provider_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Association Change Requests: read/write by owner, manage by admins
CREATE POLICY "Owner read/write change requests" ON public.association_change_requests FOR ALL TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Admin manage change requests" ON public.association_change_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Provider Split Settings: read and write by owner, read by admins
CREATE POLICY "Owner manage split settings" ON public.provider_split_settings FOR ALL TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Admin read split settings" ON public.provider_split_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Provider Split Settings Audit: read by admin, write by system/authenticated
CREATE POLICY "Admin read audit settings" ON public.provider_split_settings_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Allow authenticated insert audit settings" ON public.provider_split_settings_audit FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = provider_id);

-- 8. Create trigger for automatic audit logging on provider_split_settings
CREATE OR REPLACE FUNCTION public.audit_provider_split_settings()
RETURNS trigger AS $$
begin
  insert into public.provider_split_settings_audit (provider_id, changed_by, old_distribution, new_distribution)
  values (
    coalesce(new.provider_id, old.provider_id),
    auth.uid(),
    case when TG_OP = 'UPDATE' or TG_OP = 'DELETE' then
      jsonb_build_object(
        'comunidade_pct', old.comunidade_pct,
        'premio_trabalhador_pct', old.premio_trabalhador_pct,
        'premio_consumidor_pct', old.premio_consumidor_pct,
        'padrinho_pct', old.padrinho_pct
      )
    else null end,
    case when TG_OP = 'UPDATE' or TG_OP = 'INSERT' then
      jsonb_build_object(
        'comunidade_pct', new.comunidade_pct,
        'premio_trabalhador_pct', new.premio_trabalhador_pct,
        'premio_consumidor_pct', new.premio_consumidor_pct,
        'padrinho_pct', new.padrinho_pct
      )
    else null end
  );
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_provider_split_settings_change ON public.provider_split_settings;
CREATE TRIGGER on_provider_split_settings_change
  AFTER INSERT OR UPDATE OR DELETE ON public.provider_split_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_provider_split_settings();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
