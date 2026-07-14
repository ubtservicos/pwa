-- 02_audit_tables.sql
-- UBT SuperApp — Tabelas de Auditoria e Logs Administrativos

-- 1. Criação da tabela admin_logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity text NOT NULL,
  record_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Criação da tabela audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  actor_role text,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Habilitação de RLS para ambas as tabelas
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 4. Limpeza de Políticas antigas
DROP POLICY IF EXISTS "Apenas admins leem admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Apenas admins inserem admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Apenas admins leem audit_events" ON public.audit_events;
DROP POLICY IF EXISTS "Qualquer um insere audit_events" ON public.audit_events;

-- 5. Definição das Políticas RLS de Segurança

-- admin_logs (Imutável: Sem UPDATE ou DELETE)
CREATE POLICY "Apenas admins leem admin_logs" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Apenas admins inserem admin_logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_admin());

-- audit_events (Imutável: Sem UPDATE ou DELETE)
CREATE POLICY "Apenas admins leem audit_events" ON public.audit_events
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Qualquer um insere audit_events" ON public.audit_events
  FOR INSERT WITH CHECK (true);

-- Recarregar cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
