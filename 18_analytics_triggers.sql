-- SQL Triggers for Automatic Analytics Events Logging

-- 1. Function for Mototaxi Corridas Analytics
CREATE OR REPLACE FUNCTION public.log_mototaxi_analytics()
RETURNS trigger AS $$
BEGIN
  -- Evento: Criação da corrida
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_type, metadata)
    VALUES (
      NEW.tomador_id,
      'order_created',
      jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'estimated_price', NEW.estimated_price, 'distance_km', NEW.distance_km)
    );
  
  -- Evento: Mudanças de Status
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_accepted',
        jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'in_progress' THEN
      -- Início da corrida / início do processo de pagamento
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'payment_started',
        jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'payment_method', NEW.payment_method)
      );
      
    ELSIF NEW.status = 'completed' THEN
      -- Sucesso da corrida e aprovação do pagamento
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'payment_approved',
        jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'final_price', NEW.final_price)
      );
      
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'service_completed',
        jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_cancelled',
        jsonb_build_object('vertical', 'mototaxi', 'ride_id', NEW.id, 'cancelled_by', 'system_or_user')
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de mototaxi
DROP TRIGGER IF EXISTS trigger_mototaxi_analytics ON public.mototaxi_corridas;
CREATE TRIGGER trigger_mototaxi_analytics
  AFTER INSERT OR UPDATE ON public.mototaxi_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_mototaxi_analytics();


-- 2. Function for Pedidos (Ambulantes) Analytics
CREATE OR REPLACE FUNCTION public.log_pedidos_analytics()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_type, metadata)
    VALUES (
      NEW.tomador_id,
      'order_created',
      jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id, 'total', NEW.total, 'modalidade', NEW.modalidade)
    );
    
    -- Para ambulantes, o início de checkout/payment acontece junto com o envio do pedido pendente
    INSERT INTO public.analytics_events (user_id, event_type, metadata)
    VALUES (
      NEW.tomador_id,
      'payment_started',
      jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id, 'total', NEW.total)
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_accepted',
        jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'completed' THEN
      -- Pagamento aprovado na conclusão
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'payment_approved',
        jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id, 'total', NEW.total)
      );
      
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'service_completed',
        jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_cancelled',
        jsonb_build_object('vertical', 'ambulantes', 'order_id', NEW.id)
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de pedidos
DROP TRIGGER IF EXISTS trigger_pedidos_analytics ON public.pedidos;
CREATE TRIGGER trigger_pedidos_analytics
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pedidos_analytics();


-- 3. Function for Diaristas Analytics
CREATE OR REPLACE FUNCTION public.log_diaristas_analytics()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.analytics_events (user_id, event_type, metadata)
    VALUES (
      NEW.tomador_id,
      'order_created',
      jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id, 'preco_total', NEW.preco_total)
    );
    
    INSERT INTO public.analytics_events (user_id, event_type, metadata)
    VALUES (
      NEW.tomador_id,
      'payment_started',
      jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id, 'preco_total', NEW.preco_total)
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_accepted',
        jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'payment_approved',
        jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id, 'preco_total', NEW.preco_total)
      );
      
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'service_completed',
        jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id, 'prestador_id', NEW.prestador_id)
      );
      
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.analytics_events (user_id, event_type, metadata)
      VALUES (
        NEW.tomador_id,
        'order_cancelled',
        jsonb_build_object('vertical', 'diaristas', 'agendamento_id', NEW.id)
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de diaristas
DROP TRIGGER IF EXISTS trigger_diaristas_analytics ON public.diarista_agendamentos;
CREATE TRIGGER trigger_diaristas_analytics
  AFTER INSERT OR UPDATE ON public.diarista_agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_diaristas_analytics();
