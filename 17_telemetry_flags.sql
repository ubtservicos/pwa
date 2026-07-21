-- migration: 17_telemetry_flags.sql
-- Criacao do esquema de antifraude e telemetria para Mototaxi

-- 1. Helper: Calculo de Distancia Haversine em Metros
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) RETURNS double precision AS $$
DECLARE
  R double precision := 6371000; -- Raio da Terra em metros
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Tabela de Alertas de Antifraude e Telemetria
CREATE TABLE IF NOT EXISTS public.telemetry_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.mototaxi_corridas(id) ON DELETE CASCADE,
  flag_type text NOT NULL, -- 'driver_client_distance', 'overspeed', 'short_displacement', 'route_divergence'
  severity text NOT NULL,  -- 'warning', 'critical'
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.usuarios(id),
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Habilitar RLS e Politicas
ALTER TABLE public.telemetry_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read telemetry_flags" 
ON public.telemetry_flags 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can update telemetry_flags" 
ON public.telemetry_flags 
FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- Permitir insercoes via gatilhos de sistema (triggers)
CREATE POLICY "Triggers can insert telemetry_flags" 
ON public.telemetry_flags 
FOR INSERT 
WITH CHECK (true);

-- 4. Trigger de Validacao ao Finalizar a Corrida
CREATE OR REPLACE FUNCTION public.check_mototaxi_fraud_on_complete()
RETURNS trigger AS $$
DECLARE
  origin_lat double precision;
  origin_lng double precision;
  dest_lat double precision;
  dest_lng double precision;
  straight_line_dist double precision;
  actual_dist double precision;
  speed_kmh double precision;
  dur_hours double precision;
BEGIN
  -- Apenas quando o status muda para 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    
    -- Extrair coordenadas de origem e destino
    origin_lat := (NEW.origin->>'lat')::double precision;
    origin_lng := (NEW.origin->>'lng')::double precision;
    dest_lat := (NEW.destination->>'lat')::double precision;
    dest_lng := (NEW.destination->>'lng')::double precision;
    
    -- Calcular a distancia retilinea teorica (Haversine)
    straight_line_dist := public.haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng);
    actual_dist := NEW.distance_km * 1000.0; -- em metros
    
    -- Regra 3: Corrida encerrada sem deslocamento minimo (ex: menor que 100 metros)
    IF straight_line_dist < 100.0 THEN
      INSERT INTO public.telemetry_flags (ride_id, flag_type, severity, metadata)
      VALUES (
        NEW.id,
        'short_displacement',
        'critical',
        jsonb_build_object(
          'straight_line_meters', straight_line_dist,
          'message', 'Corrida encerrada sem deslocamento mínimo do passageiro (menor que 100 metros).'
        )
      );
    END IF;

    -- Regra 2: Velocidade superior a 120 km/h
    IF NEW.duration_min > 0 THEN
      dur_hours := NEW.duration_min::double precision / 60.0;
      speed_kmh := NEW.distance_km / dur_hours;
      
      IF speed_kmh > 120.0 THEN
        INSERT INTO public.telemetry_flags (ride_id, flag_type, severity, metadata)
        VALUES (
          NEW.id,
          'overspeed',
          'critical',
          jsonb_build_object(
            'calculated_speed_kmh', speed_kmh,
            'duration_min', NEW.duration_min,
            'distance_km', NEW.distance_km,
            'message', 'Velocidade calculada excede o limite tolerado de 120 km/h.'
          )
        );
      END IF;
    END IF;

    -- Regra 4: Divergência entre GPS e rota estimada (desvio superior a 50%)
    IF straight_line_dist > 0.0 AND ABS(actual_dist - straight_line_dist) / straight_line_dist > 0.50 THEN
      INSERT INTO public.telemetry_flags (ride_id, flag_type, severity, metadata)
      VALUES (
        NEW.id,
        'route_divergence',
        'warning',
        jsonb_build_object(
          'straight_line_meters', straight_line_dist,
          'logged_distance_meters', actual_dist,
          'divergence_ratio', (ABS(actual_dist - straight_line_dist) / straight_line_dist),
          'message', 'Desvio significativo entre a rota traçada e a distância retilínea estimada.'
        )
      );
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_mototaxi_fraud_check
  AFTER UPDATE OF status ON public.mototaxi_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mototaxi_fraud_on_complete();
