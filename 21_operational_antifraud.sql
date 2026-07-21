-- migration: 21_operational_antifraud.sql
-- Mecanismo Antifraude para Abuso Operacional (Uso de Mototáxi, Diaristas e Ambulantes)

BEGIN;

-- 1. Criar Tabela public.operational_flags
CREATE TABLE IF NOT EXISTS public.operational_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    flag_type text NOT NULL, -- 'mototaxi_excessive_cancellations', 'diarista_no_show', 'ambulante_successive_refusals'
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS para a nova tabela
ALTER TABLE public.operational_flags ENABLE ROW LEVEL SECURITY;

-- Politicas de RLS para operational_flags
DROP POLICY IF EXISTS "Leitura de flags operacionais por envolvidos ou admin" ON public.operational_flags;
CREATE POLICY "Leitura de flags operacionais por envolvidos ou admin" ON public.operational_flags
    FOR SELECT USING (
        auth.uid() = user_id 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Escrita de flags operacionais restrita a admin" ON public.operational_flags;
CREATE POLICY "Escrita de flags operacionais restrita a admin" ON public.operational_flags
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Criar indices de performance
CREATE INDEX IF NOT EXISTS idx_operational_flags_user ON public.operational_flags (user_id);
CREATE INDEX IF NOT EXISTS idx_operational_flags_type ON public.operational_flags (flag_type);

-- 2. Enriquecer Tabela public.usuarios com colunas de controle antifraude
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS blocked_until timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS under_review boolean DEFAULT false;

-- 3. Função Dinâmica de Desbloqueio e Verificação de Status
CREATE OR REPLACE FUNCTION public.check_and_unblock_user(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    v_blocked_until timestamp with time zone;
    v_status text;
BEGIN
    SELECT blocked_until, status INTO v_blocked_until, v_status
    FROM public.usuarios
    WHERE id = p_user_id;

    IF v_blocked_until IS NOT NULL THEN
        IF v_blocked_until <= now() THEN
            -- Desbloqueio automático (fim do prazo de 60 minutos)
            UPDATE public.usuarios
            SET blocked_until = NULL,
                status = 'active'
            WHERE id = p_user_id;
            
            -- Registrar evento de desbloqueio automatico
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (p_user_id, 'auto_unblocked', 'low', jsonb_build_object('reason', 'Temporary block expired'));
            
            RETURN false; -- Nao bloqueado
        ELSE
            RETURN true; -- Continua bloqueado
        END IF;
    END IF;
    
    RETURN false; -- Nao bloqueado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função Principal de Avaliação Antifraude Operacional
CREATE OR REPLACE FUNCTION public.evaluate_operational_antifraud()
RETURNS trigger AS $$
DECLARE
    v_user_id uuid;
    v_mototaxi_cancel_count integer := 0;
    v_diarista_noshow_count integer := 0;
    v_ambulante_refusal_count integer := 0;
    v_reason_text text;
    v_service_type text;
BEGIN
    -- Determinar o user_id e service_type dependendo de qual tabela disparou
    IF TG_TABLE_NAME = 'cancellations' THEN
        v_user_id := NEW.cancelled_by;
        v_service_type := NEW.service_type;
        v_reason_text := NEW.reason;
    ELSIF TG_TABLE_NAME = 'disputes' THEN
        -- Em disputas, buscar o comprador/cliente pelo pagamento associado
        SELECT customer_id, service_type INTO v_user_id, v_service_type
        FROM public.payments
        WHERE id = NEW.payment_id;
        v_reason_text := NEW.reason;
    END IF;

    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- REGRA 1: Mototáxi - 3 cancelamentos fora da carência em 1 hora -> Bloqueio de 60 minutos
    IF v_service_type = 'mototaxi' THEN
        -- Cancelamentos com multa/taxa ou elegibilidade zero (fora de carência) nas últimas 1 hora
        SELECT count(*) INTO v_mototaxi_cancel_count
        FROM public.cancellations
        WHERE cancelled_by = v_user_id
          AND service_type = 'mototaxi'
          AND created_at >= now() - interval '1 hour'
          AND (cancellation_fee > 0 OR eligible_for_refund = false);

        IF v_mototaxi_cancel_count >= 3 THEN
            -- Inserir flag
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (
                v_user_id, 
                'mototaxi_excessive_cancellations', 
                'high', 
                jsonb_build_object('cancellations_count', v_mototaxi_cancel_count, 'blocked_duration_minutes', 60)
            );

            -- Bloquear usuário temporariamente por 60 minutos
            UPDATE public.usuarios
            SET blocked_until = now() + interval '60 minutes',
                status = 'suspended'
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- REGRA 2: Diaristas - 3 no-shows em 30 dias -> Revisão manual obrigatória
    -- Conta tanto cancelamentos com motivo de no-show quanto disputas relacionadas a isso
    IF v_service_type = 'diarista' THEN
        -- Cancelamentos por no-show (ex: 'não compareceu', 'no-show', 'ausente') nos últimos 30 dias
        SELECT count(*) INTO v_diarista_noshow_count
        FROM (
            SELECT id FROM public.cancellations
            WHERE cancelled_by = v_user_id 
              AND service_type = 'diarista'
              AND created_at >= now() - interval '30 days'
              AND (reason ILIKE '%no-show%' OR reason ILIKE '%compareceu%' OR reason ILIKE '%ausente%')
            UNION ALL
            SELECT d.id FROM public.disputes d
            JOIN public.payments p ON p.id = d.payment_id
            WHERE p.customer_id = v_user_id
              AND d.service_type = 'diarista'
              AND d.created_at >= now() - interval '30 days'
              AND (d.reason ILIKE '%no-show%' OR d.reason ILIKE '%compareceu%' OR d.reason ILIKE '%ausente%')
        ) AS noshows;

        IF v_diarista_noshow_count >= 3 THEN
            -- Inserir flag
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (
                v_user_id, 
                'diarista_no_show', 
                'high', 
                jsonb_build_object('no_shows_count', v_diarista_noshow_count)
            );

            -- Enviar para revisão manual obrigatória
            UPDATE public.usuarios
            SET under_review = true,
                status = 'under_review'
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- REGRA 3: Ambulantes - Recusas sucessivas do cliente -> Monitoramento automático (Severity: Medium)
    IF v_service_type = 'ambulante' THEN
        -- Conta cancelamentos sucessivos do cliente nos últimos 2 horas
        SELECT count(*) INTO v_ambulante_refusal_count
        FROM public.cancellations
        WHERE cancelled_by = v_user_id
          AND service_type = 'ambulante'
          AND created_at >= now() - interval '2 hours';

        IF v_ambulante_refusal_count >= 3 THEN
            -- Inserir flag de monitoramento automático
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (
                v_user_id, 
                'ambulante_successive_refusals', 
                'medium', 
                jsonb_build_object('cancellations_count', v_ambulante_refusal_count, 'monitored_at', now())
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Vincular Triggers de Auditoria/Avaliação Antifraude
DROP TRIGGER IF EXISTS evaluate_cancellations_antifraud_trigger ON public.cancellations;
CREATE TRIGGER evaluate_cancellations_antifraud_trigger 
AFTER INSERT OR UPDATE ON public.cancellations
FOR EACH ROW EXECUTE FUNCTION public.evaluate_operational_antifraud();

DROP TRIGGER IF EXISTS evaluate_disputes_antifraud_trigger ON public.disputes;
CREATE TRIGGER evaluate_disputes_antifraud_trigger 
AFTER INSERT OR UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.evaluate_operational_antifraud();

COMMIT;
