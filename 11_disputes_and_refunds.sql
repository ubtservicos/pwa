-- migration: 11_disputes_and_refunds.sql
-- UBT SuperApp — Disputes & Refunds Architecture v1.0

BEGIN;

-- 1. Tabela public.cancellations (Registro de Cancelamentos)
CREATE TABLE IF NOT EXISTS public.cancellations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type text NOT NULL,
    service_id uuid NOT NULL,
    cancelled_by uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    reason text NOT NULL,
    eligible_for_refund boolean NOT NULL DEFAULT true,
    cancellation_fee numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (cancellation_fee >= 0),
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabela public.refunds (Registro de Estornos/Reversões)
CREATE TABLE IF NOT EXISTS public.refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    reason text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
    gateway_refund_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Alterações/Enriquecimento na Tabela public.disputes
ALTER TABLE public.disputes 
ADD COLUMN IF NOT EXISTS evidence jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS service_type text,
ADD COLUMN IF NOT EXISTS service_id uuid,
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 5. Limpeza de políticas antigas
DROP POLICY IF EXISTS "Leitura de cancelamentos por envolvidos ou admin" ON public.cancellations;
DROP POLICY IF EXISTS "Modificações restritas a admin para cancelamentos" ON public.cancellations;
DROP POLICY IF EXISTS "Leitura de estornos por envolvidos ou admin" ON public.refunds;
DROP POLICY IF EXISTS "Modificações restritas a admin para estornos" ON public.refunds;

-- 6. Políticas RLS
-- Cancellations
CREATE POLICY "Leitura de cancelamentos por envolvidos ou admin" ON public.cancellations
    FOR SELECT USING (
        auth.uid() = cancelled_by 
        OR public.is_admin()
    );
CREATE POLICY "Modificações restritas a admin para cancelamentos" ON public.cancellations
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Refunds
CREATE POLICY "Leitura de estornos por envolvidos ou admin" ON public.refunds
    FOR SELECT USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.payments 
            WHERE id = payment_id AND (customer_id = auth.uid() OR provider_id = auth.uid())
        )
    );
CREATE POLICY "Modificações restritas a admin para estornos" ON public.refunds
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Índices de Otimização
CREATE INDEX IF NOT EXISTS idx_cancellations_service ON public.cancellations (service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_operator ON public.disputes (operator_id);

-- 8. Trigger de Auditoria para as novas tabelas
CREATE OR REPLACE FUNCTION public.log_financial_audit()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_events (event_type, table_name, record_id, payload, created_by)
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        row_to_json(COALESCE(NEW, OLD)),
        auth.uid()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_cancellations_trigger ON public.cancellations;
CREATE TRIGGER audit_cancellations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.cancellations
    FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

DROP TRIGGER IF EXISTS audit_refunds_trigger ON public.refunds;
CREATE TRIGGER audit_refunds_trigger AFTER INSERT OR UPDATE OR DELETE ON public.refunds
    FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

COMMIT;
