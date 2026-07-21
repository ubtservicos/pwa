-- migration: 23_analytics_core.sql
-- Infraestrutura Definitiva de Analytics do UBT SuperApp

BEGIN;

DROP TABLE IF EXISTS public.analytics_events CASCADE;

CREATE TABLE public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name text NOT NULL,
    event_category text NOT NULL,
    created_at_utc timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    timezone text DEFAULT 'UTC' NOT NULL,
    session_id text NOT NULL,
    device_id text NOT NULL,
    user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    anonymous_id text,
    platform text,
    app_version text,
    origin text,
    vertical text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- Índices de performance absoluta
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events (created_at_utc);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON public.analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_origin ON public.analytics_events (origin);
CREATE INDEX IF NOT EXISTS idx_analytics_vertical ON public.analytics_events (vertical);

-- Habilitar RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir inserções públicas no analytics" ON public.analytics_events;
CREATE POLICY "Permitir inserções públicas no analytics" ON public.analytics_events
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de analytics restrita a proprietário e admin" ON public.analytics_events;
CREATE POLICY "Leitura de analytics restrita a proprietário e admin" ON public.analytics_events
    FOR SELECT USING (
        auth.uid() = user_id 
        OR public.is_admin()
    );

-- 6. Recriar Triggers Legados com o Novo Schema
-- Trigger Mototáxi
CREATE OR REPLACE FUNCTION public.log_mototaxi_analytics()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
    VALUES (
      NEW.tomador_id,
      'request_created',
      'operational',
      'db_trigger_session',
      'db_trigger_device',
      'mototaxi',
      jsonb_build_object('ride_id', NEW.id, 'estimated_price', NEW.estimated_price, 'distance_km', NEW.distance_km)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_accepted',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'mototaxi',
        jsonb_build_object('ride_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
    ELSIF NEW.status = 'in_progress' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'payment_started',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'mototaxi',
        jsonb_build_object('ride_id', NEW.id, 'payment_method', NEW.payment_method)
      );
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'payment_success',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'mototaxi',
        jsonb_build_object('ride_id', NEW.id, 'final_price', NEW.final_price)
      );
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_cancelled',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'mototaxi',
        jsonb_build_object('ride_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Pedidos (Ambulantes)
CREATE OR REPLACE FUNCTION public.log_pedidos_analytics()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
    VALUES (
      NEW.tomador_id,
      'request_created',
      'operational',
      'db_trigger_session',
      'db_trigger_device',
      'ambulantes',
      jsonb_build_object('order_id', NEW.id, 'total', NEW.total, 'modalidade', NEW.modalidade)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_accepted',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'ambulantes',
        jsonb_build_object('order_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'payment_success',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'ambulantes',
        jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
      );
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_cancelled',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'ambulantes',
        jsonb_build_object('order_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Diaristas
CREATE OR REPLACE FUNCTION public.log_diaristas_analytics()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
    VALUES (
      NEW.tomador_id,
      'request_created',
      'operational',
      'db_trigger_session',
      'db_trigger_device',
      'diaristas',
      jsonb_build_object('agendamento_id', NEW.id, 'preco_total', NEW.preco_total)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_accepted',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'diaristas',
        jsonb_build_object('agendamento_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'payment_success',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'diaristas',
        jsonb_build_object('agendamento_id', NEW.id, 'preco_total', NEW.preco_total)
      );
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_cancelled',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'diaristas',
        jsonb_build_object('agendamento_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular Triggers de Volta
DROP TRIGGER IF EXISTS trigger_mototaxi_analytics ON public.mototaxi_corridas;
CREATE TRIGGER trigger_mototaxi_analytics
  AFTER INSERT OR UPDATE ON public.mototaxi_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_mototaxi_analytics();

DROP TRIGGER IF EXISTS trigger_pedidos_analytics ON public.pedidos;
CREATE TRIGGER trigger_pedidos_analytics
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pedidos_analytics();

DROP TRIGGER IF EXISTS trigger_diaristas_analytics ON public.diarista_agendamentos;
CREATE TRIGGER trigger_diaristas_analytics
  AFTER INSERT OR UPDATE ON public.diarista_agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_diaristas_analytics();

COMMIT;
