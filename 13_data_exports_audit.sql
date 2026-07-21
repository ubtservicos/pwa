-- migration: 13_data_exports_audit.sql
-- Tabela de Auditoria de Exportacao de Dados (LGPD)

CREATE TABLE IF NOT EXISTS public.data_exports_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    exported_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address inet,
    user_agent text,
    volume_bytes integer NOT NULL DEFAULT 0
);

-- Habilitar RLS
ALTER TABLE public.data_exports_audit ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- 1. Usuário autenticado lê apenas seus próprios registros de exportação
CREATE POLICY "Usuarios leem seus proprios logs de exportacao" ON public.data_exports_audit
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- 2. Inserção permitida apenas por usuários autenticados (para seus próprios registros) ou service role
CREATE POLICY "Usuarios inserem seus proprios logs de exportacao" ON public.data_exports_audit
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_data_exports_audit_user ON public.data_exports_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_audit_date ON public.data_exports_audit(exported_at);
