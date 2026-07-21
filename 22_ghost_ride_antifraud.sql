-- migration: 22_ghost_ride_antifraud.sql
-- Mecanismo Antifraude de Ghost Ride para Corridas de Mototáxi

BEGIN;

-- 1. Enriquecer public.mototaxi_corridas com colunas de telemetria e analise de risco
ALTER TABLE public.mototaxi_corridas
ADD COLUMN IF NOT EXISTS real_distance_km numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS real_duration_min integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trajectory_polyline text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS average_speed_kmh numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS risk_level text CHECK (risk_level IN ('risk_low', 'risk_medium', 'risk_high')) DEFAULT 'risk_low',
ADD COLUMN IF NOT EXISTS antifraud_flags text[] DEFAULT '{}'::text[];

-- Criar índices de performance para busca rápida de fraudes
CREATE INDEX IF NOT EXISTS idx_mototaxi_corridas_risk ON public.mototaxi_corridas (risk_level);
CREATE INDEX IF NOT EXISTS idx_mototaxi_corridas_completed ON public.mototaxi_corridas (status) WHERE status = 'completed';

-- 2. Função Trigger para avaliar Ghost Ride e comportamento anômalo
CREATE OR REPLACE FUNCTION public.evaluate_ghost_ride_rules()
RETURNS trigger AS $$
DECLARE
    v_flags text[] := '{}'::text[];
    v_risk text := 'risk_low';
    v_estimated_distance numeric;
    v_real_distance numeric;
    v_real_duration numeric;
    v_avg_speed numeric := 0;
BEGIN
    -- Só processamos quando a corrida mudar de status para 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        
        -- Fallbacks caso distâncias ou durações reais não venham preenchidas
        NEW.real_distance_km := COALESCE(NEW.real_distance_km, NEW.distance_km, 0);
        NEW.real_duration_min := COALESCE(NEW.real_duration_min, NEW.duration_min, 0);
        
        v_estimated_distance := COALESCE(NEW.distance_km, 0);
        v_real_distance := NEW.real_distance_km;
        v_real_duration := NEW.real_duration_min;
        
        -- Calcular velocidade média real em km/h
        IF v_real_duration > 0 THEN
            v_avg_speed := (v_real_distance / (v_real_duration::numeric / 60.0));
            NEW.average_speed_kmh := round(v_avg_speed, 2);
        ELSE
            NEW.average_speed_kmh := 0;
        END IF;

        -- Regra 1: Velocidade absurda/impossível (> 120 km/h)
        IF NEW.average_speed_kmh > 120 THEN
            v_flags := array_append(v_flags, 'SPEED_LIMIT_EXCEEDED');
        END IF;

        -- Regra 2: Distância incompatível (Diferença de mais de 5km ou desvio drástico da estimativa)
        IF abs(v_estimated_distance - v_real_distance) > 5.0 
           OR (v_estimated_distance > 0 AND v_real_distance < v_estimated_distance * 0.3) 
           OR (v_estimated_distance > 0 AND v_real_distance > v_estimated_distance * 2.5) THEN
            v_flags := array_append(v_flags, 'INCOMPATIBLE_DISTANCE');
        END IF;

        -- Regra 3: Ausência de deslocamento (Corrida de "fantasma" sem sair do lugar)
        IF v_real_distance < 0.1 AND v_real_duration > 2 THEN
            v_flags := array_append(v_flags, 'NO_DISPLACEMENT');
        END IF;

        -- 3. Calcular Nível de Risco (Sem nunca bloquear pagamentos automaticamente)
        IF 'SPEED_LIMIT_EXCEEDED' = ANY(v_flags) THEN
            v_risk := 'risk_high';
        ELSIF 'NO_DISPLACEMENT' = ANY(v_flags) THEN
            v_risk := 'risk_high';
        ELSIF 'INCOMPATIBLE_DISTANCE' = ANY(v_flags) THEN
            v_risk := 'risk_medium';
        ELSE
            v_risk := 'risk_low';
        END IF;

        NEW.risk_level := v_risk;
        NEW.antifraud_flags := v_flags;

        -- 4. Registrar em operational_flags caso o risco seja médio ou alto para alertar no backoffice
        IF v_risk IN ('risk_medium', 'risk_high') THEN
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (
                NEW.tomador_id,
                'ghost_ride_alert',
                CASE WHEN v_risk = 'risk_high' THEN 'high' ELSE 'medium' END,
                jsonb_build_object(
                    'ride_id', NEW.id,
                    'provider_id', NEW.prestador_id,
                    'estimated_distance_km', v_estimated_distance,
                    'real_distance_km', v_real_distance,
                    'average_speed_kmh', NEW.average_speed_kmh,
                    'flags', v_flags
                )
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Vincular trigger à tabela public.mototaxi_corridas
DROP TRIGGER IF EXISTS evaluate_ghost_ride_trigger ON public.mototaxi_corridas;
CREATE TRIGGER evaluate_ghost_ride_trigger
BEFORE UPDATE ON public.mototaxi_corridas
FOR EACH ROW EXECUTE FUNCTION public.evaluate_ghost_ride_rules();

COMMIT;
