-- migration: 20_payment_security_metadata.sql
-- Preparacao da Arquitetura Financeira e Antifraude para Integracao com Mercado Pago Producao

BEGIN;

-- 1. Enriquecer Tabela payments com coluna metadata
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Enriquecer Tabela refunds com coluna metadata
ALTER TABLE public.refunds 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Criar Tabela chargebacks
CREATE TABLE IF NOT EXISTS public.chargebacks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    gateway_chargeback_id text,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    reason text,
    status text NOT NULL CHECK (status IN ('received', 'under_review', 'won', 'lost')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS para chargebacks
ALTER TABLE public.chargebacks ENABLE ROW LEVEL SECURITY;

-- Politicas de RLS para chargebacks
DROP POLICY IF EXISTS "Leitura de chargebacks restrita a admin" ON public.chargebacks;
CREATE POLICY "Leitura de chargebacks restrita a admin" ON public.chargebacks
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Escrita de chargebacks restrita a admin" ON public.chargebacks;
CREATE POLICY "Escrita de chargebacks restrita a admin" ON public.chargebacks
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Criar indice de performance
CREATE INDEX IF NOT EXISTS idx_chargebacks_payment ON public.chargebacks (payment_id);

-- 4. Função Antifraude Core (Cálculo de Score Antifraude Inicial)
CREATE OR REPLACE FUNCTION public.calculate_antifraud_score(
    p_user_id uuid,
    p_device_fingerprint text,
    p_card_hash text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_score integer := 0;
    v_flags text[] := ARRAY[]::text[];
    v_device_count integer := 0;
    v_card_count integer := 0;
    v_cancel_count integer := 0;
    v_distinct_logins integer := 0;
    v_result jsonb;
BEGIN
    -- REGRA 1: Dispositivo Novo
    IF p_device_fingerprint IS NOT NULL AND p_device_fingerprint <> '' THEN
        -- Conta quantos pagamentos aprovados o usuario ja fez com este fingerprint
        SELECT COALESCE(count(*), 0) INTO v_device_count
        FROM public.payments
        WHERE customer_id = p_user_id
          AND metadata->>'device_fingerprint' = p_device_fingerprint;

        IF v_device_count = 0 THEN
            v_score := v_score + 20;
            v_flags := array_append(v_flags, 'NEW_DEVICE');
        END IF;
    END IF;

    -- REGRA 2: Múltiplos Cartões nos últimos 7 dias
    IF p_card_hash IS NOT NULL AND p_card_hash <> '' THEN
        SELECT COALESCE(count(distinct metadata->>'card_hash'), 0) INTO v_card_count
        FROM public.payments
        WHERE customer_id = p_user_id
          AND created_at >= now() - interval '7 days';

        -- Se ja usou mais de 2 cartoes distintos nos ultimos 7 dias
        IF v_card_count > 2 THEN
            v_score := v_score + 30;
            v_flags := array_append(v_flags, 'MULTIPLE_CARDS');
        END IF;
    END IF;

    -- REGRA 3: Múltiplos Cancelamentos nos últimos 7 dias
    SELECT COALESCE(count(*), 0) INTO v_cancel_count
    FROM public.cancellations
    WHERE cancelled_by = p_user_id
      AND created_at >= now() - interval '7 days';

    IF v_cancel_count > 3 THEN
        v_score := v_score + 25;
        v_flags := array_append(v_flags, 'EXCESSIVE_CANCELLATIONS');
    END IF;

    -- REGRA 4: Múltiplos Logins / Dispositivos únicos nas últimas 24 horas (via analytics_events)
    SELECT COALESCE(count(distinct device_info->>'screenResolution'), 0) INTO v_distinct_logins
    FROM public.analytics_events
    WHERE user_id = p_user_id
      AND created_at >= now() - interval '24 hours';

    IF v_distinct_logins > 3 THEN
        v_score := v_score + 25;
        v_flags := array_append(v_flags, 'MULTIPLE_DEVICES_LOGIN');
    END IF;

    -- Garantir limite maximo do score em 100
    IF v_score > 100 THEN
        v_score := 100;
    END IF;

    -- Montar payload de resposta
    v_result := jsonb_build_object(
        'score', v_score,
        'flags', to_jsonb(v_flags),
        'analyzed_at', now(),
        'metrics', jsonb_build_object(
            'previous_payments_on_device', v_device_count,
            'recent_cards_count', v_card_count,
            'recent_cancellations_count', v_cancel_count,
            'recent_distinct_devices', v_distinct_logins
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
