-- migration: 10_production_financial_core.sql
-- UBT SuperApp — Unified Production Financial Module

BEGIN;

-- 1. Definição de Tipos e Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'charged_back', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'split_status') THEN
        CREATE TYPE split_status AS ENUM ('pending', 'approved', 'released', 'refunded', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE dispute_status AS ENUM ('opened', 'in_mediation', 'resolved_customer', 'resolved_provider', 'closed');
    END IF;
END$$;

-- 2. Tabela public.payments
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type text NOT NULL,
    service_id uuid NOT NULL,
    customer_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    provider_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    gateway text NOT NULL DEFAULT 'mercado_pago',
    gateway_payment_id text UNIQUE,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    currency text NOT NULL DEFAULT 'BRL',
    payment_method text NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
    status payment_status NOT NULL DEFAULT 'pending',
    idempotency_key text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Tabela public.payment_splits
CREATE TABLE IF NOT EXISTS public.payment_splits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    recipient_role text NOT NULL CHECK (recipient_role IN ('provider', 'ubt', 'godparent', 'comunidade', 'prize_worker', 'prize_consumer')),
    amount numeric(10,2) NOT NULL CHECK (amount >= 0),
    status split_status NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. Tabela public.payouts (Repasses consolidados)
CREATE TABLE IF NOT EXISTS public.payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    status payout_status NOT NULL DEFAULT 'pending',
    gateway_payout_id text,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);

-- 5. Tabela public.disputes (Contestações e Mediações)
CREATE TABLE IF NOT EXISTS public.disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    reason text NOT NULL,
    status dispute_status NOT NULL DEFAULT 'opened',
    amount numeric(10,2) NOT NULL CHECK (amount >= 0),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. Habilitar RLS (Row Level Security)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- 7. Limpeza de políticas anteriores para idempotência da migration
DROP POLICY IF EXISTS "Leitura de pagamentos por participantes ou admin" ON public.payments;
DROP POLICY IF EXISTS "Modificações restritas a admin para pagamentos" ON public.payments;
DROP POLICY IF EXISTS "Leitura de splits por participantes ou admin" ON public.payment_splits;
DROP POLICY IF EXISTS "Modificações restritas a admin para splits" ON public.payment_splits;
DROP POLICY IF EXISTS "Leitura de payouts por favorecido ou admin" ON public.payouts;
DROP POLICY IF EXISTS "Modificações restritas a admin para payouts" ON public.payouts;
DROP POLICY IF EXISTS "Leitura de disputas por envolvidos ou admin" ON public.disputes;
DROP POLICY IF EXISTS "Modificações restritas a admin para disputas" ON public.disputes;

-- 8. Políticas RLS de Produção (Hardened)

-- Tabela: payments
CREATE POLICY "Leitura de pagamentos por participantes ou admin" ON public.payments
    FOR SELECT USING (
        auth.uid() = customer_id 
        OR auth.uid() = provider_id 
        OR public.is_admin()
    );
CREATE POLICY "Modificações restritas a admin para pagamentos" ON public.payments
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tabela: payment_splits
CREATE POLICY "Leitura de splits por participantes ou admin" ON public.payment_splits
    FOR SELECT USING (
        auth.uid() = recipient_id 
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.payments 
            WHERE id = payment_id AND (customer_id = auth.uid() OR provider_id = auth.uid())
        )
    );
CREATE POLICY "Modificações restritas a admin para splits" ON public.payment_splits
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tabela: payouts
CREATE POLICY "Leitura de payouts por favorecido ou admin" ON public.payouts
    FOR SELECT USING (auth.uid() = recipient_id OR public.is_admin());
CREATE POLICY "Modificações restritas a admin para payouts" ON public.payouts
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tabela: disputes
CREATE POLICY "Leitura de disputas por envolvidos ou admin" ON public.disputes
    FOR SELECT USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.payments 
            WHERE id = payment_id AND (customer_id = auth.uid() OR provider_id = auth.uid())
        )
    );
CREATE POLICY "Modificações restritas a admin para disputas" ON public.disputes
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. Criação de Índices para Otimização de Consultas (Performance)
CREATE INDEX IF NOT EXISTS idx_payments_service ON public.payments (service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON public.payments (gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment ON public.payment_splits (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_recipient ON public.payment_splits (recipient_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON public.payouts (recipient_id);
CREATE INDEX IF NOT EXISTS idx_disputes_payment ON public.disputes (payment_id);

-- 10. Triggers de Auditoria para histórico de updates (pg_audit compatível)
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

CREATE TRIGGER audit_payments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();
CREATE TRIGGER audit_splits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payment_splits
    FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();
CREATE TRIGGER audit_payouts_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payouts
    FOR EACH ROW EXECUTE FUNCTION public.log_financial_audit();

COMMIT;
