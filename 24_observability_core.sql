-- migration: 24_observability_core.sql
-- Infraestrutura de Observabilidade do UBT SuperApp

BEGIN;

DROP TABLE IF EXISTS public.system_logs CASCADE;

CREATE TABLE public.system_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    severity text NOT NULL CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    module text NOT NULL, -- 'AUTH', 'PWA', 'CHECKOUT', 'PAYMENTS', etc.
    service text,
    operation text,
    status text NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'started', 'timeout')),
    execution_time_ms integer,
    user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    request_id text NOT NULL,
    correlation_id text NOT NULL,
    error_code text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- Índices estratégicos para performance absoluta nas consultas do Dashboard
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.system_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON public.system_logs (severity);
CREATE INDEX IF NOT EXISTS idx_logs_module ON public.system_logs (module);
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.system_logs (status);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON public.system_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_logs_correlation_id ON public.system_logs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.system_logs (user_id);

-- Habilitar RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir inserções públicas em system_logs" ON public.system_logs;
CREATE POLICY "Permitir inserções públicas em system_logs" ON public.system_logs
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de logs restrita apenas a administradores" ON public.system_logs;
CREATE POLICY "Leitura de logs restrita apenas a administradores" ON public.system_logs
    FOR SELECT USING (public.is_admin());

-- Função de Purga automática baseada na política de retenção
CREATE OR REPLACE FUNCTION public.purge_system_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.system_logs
    WHERE (severity = 'DEBUG' AND created_at < now() - interval '30 days')
       OR (severity = 'INFO' AND created_at < now() - interval '90 days')
       OR (severity = 'WARNING' AND created_at < now() - interval '180 days')
       OR (severity = 'ERROR' AND created_at < now() - interval '730 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
