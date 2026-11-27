-- ============================================================================
-- Migration: 20261127190000_carros_vertical_foundation.sql
-- Release: v1.9.0-carros-core-db-and-edge-functions (Fase 1 de 3 — Carros)
-- Goals:
--   1) Create 5 isolated core tables for Carros mirroring Mototaxi:
--      carro_corridas, prestador_carro, carro_sessoes, carro_pricing_config,
--      carro_mensagens — with RLS, indexes, Realtime and triggers.
--   2) Expand pagamentos_split_service_type_check to accept 'carro' and update
--      get_user_payment_history() & admin_list_financial_transactions() with
--      zero regression for existing Mototaxi records.
--   3) Create SECURITY DEFINER RPCs for Carros KYC, Profile, Pricing and
--      Association management isolated by categoria = 'carro', plus
--      _resolve_caller_assoc_context() and get_my_association_scope().
-- ============================================================================

-- ============================================================================
-- A) 5 TABELAS CORE ISOLADAS DE CARROS
-- ============================================================================

-- 1. public.carro_corridas
CREATE TABLE IF NOT EXISTS public.carro_corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'searching',
  type text NOT NULL DEFAULT 'corrida',
  vehicle_subtype text NOT NULL DEFAULT 'padrao',
  vehicle_snapshot jsonb,
  origin jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  distance_km numeric,
  duration_min integer,
  estimated_price numeric,
  final_price numeric,
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  real_distance_km numeric,
  real_duration_min integer,
  trajectory_polyline text,
  average_speed_kmh numeric,
  risk_level text DEFAULT 'risk_low',
  antifraud_flags text[] DEFAULT '{}'::text[],
  pix_payment_id text,
  pix_transaction_id uuid,
  pix_copy_paste text,
  pix_charge_status text,
  pix_charge_created_at timestamp with time zone,
  pix_charge_expires_at timestamp with time zone,
  pix_qr_code_base64 text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT carro_corridas_status_check CHECK (
    status = ANY (ARRAY[
      'searching'::text, 'pending'::text, 'buscando'::text, 'solicitado'::text,
      'accepted'::text, 'arriving'::text, 'in_progress'::text,
      'completed'::text, 'paid'::text, 'cancelled'::text
    ])
  ),
  CONSTRAINT carro_corridas_type_check CHECK (
    type = ANY (ARRAY['carona'::text, 'entrega'::text, 'corrida'::text])
  ),
  CONSTRAINT carro_corridas_payment_method_check CHECK (
    payment_method IS NULL OR payment_method = ANY (ARRAY['pix'::text, 'card'::text])
  ),
  CONSTRAINT carro_corridas_risk_level_check CHECK (
    risk_level IS NULL OR risk_level = ANY (ARRAY['risk_low'::text, 'risk_medium'::text, 'risk_high'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_carro_corridas_status_created
  ON public.carro_corridas (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carro_corridas_tomador
  ON public.carro_corridas (tomador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carro_corridas_prestador
  ON public.carro_corridas (prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carro_corridas_subtype
  ON public.carro_corridas (vehicle_subtype);

ALTER TABLE public.carro_corridas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carro_corridas_select_policy" ON public.carro_corridas;
CREATE POLICY "carro_corridas_select_policy"
  ON public.carro_corridas
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR (status = ANY (ARRAY['searching'::text, 'pending'::text, 'buscando'::text, 'solicitado'::text]))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "carro_corridas_insert_policy" ON public.carro_corridas;
CREATE POLICY "carro_corridas_insert_policy"
  ON public.carro_corridas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_current_usuario(tomador_id) OR public.is_admin())
    AND (status = 'searching'::text)
  );

DROP POLICY IF EXISTS "carro_corridas_update_policy" ON public.carro_corridas;
CREATE POLICY "carro_corridas_update_policy"
  ON public.carro_corridas
  FOR UPDATE
  TO authenticated
  USING (
    ((status = ANY (ARRAY['searching'::text, 'pending'::text, 'buscando'::text, 'solicitado'::text])) AND prestador_id IS NULL)
    OR public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR public.is_admin()
  )
  WITH CHECK (
    (public.is_current_usuario(tomador_id) OR public.is_current_usuario(prestador_id) OR public.is_admin())
    AND (status <> 'paid'::text)
  );

DROP POLICY IF EXISTS "carro_corridas_service_role_all" ON public.carro_corridas;
CREATE POLICY "carro_corridas_service_role_all"
  ON public.carro_corridas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. public.prestador_carro
CREATE TABLE IF NOT EXISTS public.prestador_carro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cpf text,
  cnh text,
  cnh_photo_url text,
  plate text,
  brand_model text,
  gender text,
  modalidade text NOT NULL DEFAULT 'carona_entrega',
  kyc_status text NOT NULL DEFAULT 'pending',
  kyc_notes text,
  is_online boolean NOT NULL DEFAULT false,
  location jsonb,
  crlv_url text,
  carro_photo_url text,
  carro_interno_photo_url text,
  selfie_url text,
  cnh_frente_url text,
  cnh_verso_url text,
  -- Atributos descritivos opcionais (NÃO impeditivos) + subtipo
  vehicle_subtype text NOT NULL DEFAULT 'padrao',
  cor text,
  ano integer,
  portas integer,
  ar_condicionado boolean DEFAULT false,
  cnh_categoria text,
  possui_ear boolean DEFAULT false,
  alvara_municipal text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prestador_carro_gender_check CHECK (
    gender IS NULL OR gender = ANY (ARRAY['masculino'::text, 'feminino'::text])
  ),
  CONSTRAINT prestador_carro_kyc_status_check CHECK (
    kyc_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])
  ),
  CONSTRAINT prestador_carro_modalidade_check CHECK (
    modalidade = ANY (ARRAY['carona_entrega'::text, 'so_entrega'::text, 'so_carona'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_prestador_carro_kyc_status
  ON public.prestador_carro (kyc_status);
CREATE INDEX IF NOT EXISTS idx_prestador_carro_online
  ON public.prestador_carro (is_online)
  WHERE is_online = true;

ALTER TABLE public.prestador_carro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carro_select" ON public.prestador_carro;
CREATE POLICY "carro_select"
  ON public.prestador_carro
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "carro_insert" ON public.prestador_carro;
CREATE POLICY "carro_insert"
  ON public.prestador_carro
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_usuario(user_id) OR public.is_admin() OR public.is_superadmin());

DROP POLICY IF EXISTS "carro_update" ON public.prestador_carro;
CREATE POLICY "carro_update"
  ON public.prestador_carro
  FOR UPDATE
  TO authenticated
  USING (public.is_current_usuario(user_id) OR public.is_admin() OR public.is_superadmin())
  WITH CHECK (public.is_current_usuario(user_id) OR public.is_admin() OR public.is_superadmin());

DROP POLICY IF EXISTS "carro_delete" ON public.prestador_carro;
CREATE POLICY "carro_delete"
  ON public.prestador_carro
  FOR DELETE
  TO authenticated
  USING (public.is_current_usuario(user_id) OR public.is_admin() OR public.is_superadmin());

-- 3. public.carro_sessoes
CREATE TABLE IF NOT EXISTS public.carro_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carro_sessoes_online
  ON public.carro_sessoes (is_online)
  WHERE is_online = true;

ALTER TABLE public.carro_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública para carro_sessoes" ON public.carro_sessoes;
CREATE POLICY "Leitura pública para carro_sessoes"
  ON public.carro_sessoes
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Modificação própria ou admin para carro_sessoes" ON public.carro_sessoes;
CREATE POLICY "Modificação própria ou admin para carro_sessoes"
  ON public.carro_sessoes
  FOR ALL
  TO authenticated
  USING (public.is_current_usuario(prestador_id) OR public.is_admin())
  WITH CHECK (public.is_current_usuario(prestador_id) OR public.is_admin());

-- 4. public.carro_pricing_config
CREATE TABLE IF NOT EXISTS public.carro_pricing_config (
  id text PRIMARY KEY,
  taxa_unica numeric(10,2) NOT NULL DEFAULT 6.00,
  valor_por_km numeric(10,2) NOT NULL DEFAULT 2.00,
  km_gatilho_ida_volta numeric(10,2) DEFAULT 3.00,
  fator_demanda numeric(5,2) NOT NULL DEFAULT 1.00,
  fator_horario numeric(5,2) NOT NULL DEFAULT 1.00,
  fator_clima numeric(5,2) NOT NULL DEFAULT 1.00,
  subtype_multipliers jsonb NOT NULL DEFAULT '{"padrao": 1.0}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT carro_pricing_config_taxa_unica_check CHECK (taxa_unica >= 0::numeric),
  CONSTRAINT carro_pricing_config_valor_por_km_check CHECK (valor_por_km >= 0::numeric),
  CONSTRAINT carro_pricing_config_km_gatilho_ida_volta_check CHECK (km_gatilho_ida_volta IS NULL OR km_gatilho_ida_volta >= 0::numeric),
  CONSTRAINT carro_pricing_config_fator_demanda_check CHECK (fator_demanda >= 0.50 AND fator_demanda <= 5.00),
  CONSTRAINT carro_pricing_config_fator_horario_check CHECK (fator_horario >= 0.50 AND fator_horario <= 5.00),
  CONSTRAINT carro_pricing_config_fator_clima_check CHECK (fator_clima >= 0.50 AND fator_clima <= 5.00)
);

ALTER TABLE public.carro_pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carro_pricing_config_select_public" ON public.carro_pricing_config;
CREATE POLICY "carro_pricing_config_select_public"
  ON public.carro_pricing_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "carro_pricing_config_admin_write" ON public.carro_pricing_config;
CREATE POLICY "carro_pricing_config_admin_write"
  ON public.carro_pricing_config
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed idempotente copiando os valores ativos de mototaxi_pricing_config (com fallback seguro)
INSERT INTO public.carro_pricing_config (
  id,
  taxa_unica,
  valor_por_km,
  km_gatilho_ida_volta,
  fator_demanda,
  fator_horario,
  fator_clima,
  subtype_multipliers,
  updated_at
)
SELECT
  'default',
  COALESCE(m.taxa_unica, 6.00),
  COALESCE(m.valor_por_km, 2.00),
  COALESCE(m.km_gatilho_ida_volta, 3.00),
  COALESCE(m.fator_demanda, 1.00),
  COALESCE(m.fator_horario, 1.00),
  COALESCE(m.fator_clima, 1.00),
  '{"padrao": 1.0}'::jsonb,
  now()
FROM (SELECT 1) AS dummy
LEFT JOIN public.mototaxi_pricing_config m ON m.id = 'default'
WHERE NOT EXISTS (SELECT 1 FROM public.carro_pricing_config WHERE id = 'default');

-- 5. public.carro_mensagens
CREATE TABLE IF NOT EXISTS public.carro_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.carro_corridas(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  message_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carro_mensagens_corrida_created
  ON public.carro_mensagens (corrida_id, created_at ASC);

ALTER TABLE public.carro_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Carro participants read messages" ON public.carro_mensagens;
CREATE POLICY "Carro participants read messages"
  ON public.carro_mensagens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carro_corridas corrida
      WHERE corrida.id = carro_mensagens.corrida_id
        AND (auth.uid() = corrida.tomador_id OR auth.uid() = corrida.prestador_id)
    )
  );

DROP POLICY IF EXISTS "Carro participants send own messages" ON public.carro_mensagens;
CREATE POLICY "Carro participants send own messages"
  ON public.carro_mensagens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.carro_corridas corrida
      WHERE corrida.id = carro_mensagens.corrida_id
        AND corrida.status = ANY (ARRAY['accepted'::text, 'arriving'::text, 'in_progress'::text])
        AND (
          (carro_mensagens.sender_role = 'tomador'::text AND corrida.tomador_id = auth.uid())
          OR (carro_mensagens.sender_role = 'prestador'::text AND corrida.prestador_id = auth.uid())
        )
    )
  );

-- Publicação idempotente no Realtime (supabase_realtime)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'carro_corridas') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_corridas;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'carro_sessoes') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_sessoes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'carro_mensagens') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_mensagens;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- B) TRIGGERS DE ANTIFRAUDE, ANALYTICS E SYNC DE KYC PARA CARROS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_carro_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
      VALUES (
        NEW.tomador_id,
        'request_created',
        'operational',
        'db_trigger_session',
        'db_trigger_device',
        'carro',
        jsonb_build_object('ride_id', NEW.id, 'estimated_price', NEW.estimated_price, 'distance_km', NEW.distance_km, 'vehicle_subtype', NEW.vehicle_subtype)
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'accepted' THEN
        INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
        VALUES (
          NEW.tomador_id, 'request_accepted', 'operational', 'db_trigger_session', 'db_trigger_device', 'carro',
          jsonb_build_object('ride_id', NEW.id, 'prestador_id', NEW.prestador_id, 'vehicle_subtype', NEW.vehicle_subtype)
        );
      ELSIF NEW.status = 'in_progress' THEN
        INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
        VALUES (
          NEW.tomador_id, 'payment_started', 'operational', 'db_trigger_session', 'db_trigger_device', 'carro',
          jsonb_build_object('ride_id', NEW.id, 'payment_method', NEW.payment_method)
        );
      ELSIF NEW.status = 'completed' THEN
        INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
        VALUES (
          NEW.tomador_id, 'payment_success', 'operational', 'db_trigger_session', 'db_trigger_device', 'carro',
          jsonb_build_object('ride_id', NEW.id, 'final_price', NEW.final_price)
        );
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO public.analytics_events (user_id, event_name, event_category, session_id, device_id, vertical, properties)
        VALUES (
          NEW.tomador_id, 'request_cancelled', 'operational', 'db_trigger_session', 'db_trigger_device', 'carro',
          jsonb_build_object('ride_id', NEW.id)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_carro_fraud_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    BEGIN
      origin_lat := NULLIF(NEW.origin->>'lat', '')::double precision;
      origin_lng := NULLIF(NEW.origin->>'lng', '')::double precision;
      dest_lat := NULLIF(NEW.destination->>'lat', '')::double precision;
      dest_lng := NULLIF(NEW.destination->>'lng', '')::double precision;

      IF origin_lat IS NOT NULL AND origin_lng IS NOT NULL AND dest_lat IS NOT NULL AND dest_lng IS NOT NULL THEN
        straight_line_dist := public.haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng);
        actual_dist := COALESCE(NEW.distance_km, 0) * 1000.0;

        IF straight_line_dist < 100.0 THEN
          INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
          VALUES (
            NEW.tomador_id,
            'carro_short_displacement',
            'high',
            jsonb_build_object('vertical', 'carro', 'ride_id', NEW.id, 'straight_line_meters', straight_line_dist)
          );
        END IF;

        IF COALESCE(NEW.duration_min, 0) > 0 THEN
          dur_hours := NEW.duration_min::double precision / 60.0;
          speed_kmh := COALESCE(NEW.distance_km, 0) / dur_hours;
          IF speed_kmh > 140.0 THEN
            INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
            VALUES (
              NEW.tomador_id,
              'carro_overspeed',
              'high',
              jsonb_build_object('vertical', 'carro', 'ride_id', NEW.id, 'calculated_speed_kmh', speed_kmh)
            );
          END IF;
        END IF;

        IF straight_line_dist > 0.0 AND ABS(actual_dist - straight_line_dist) / straight_line_dist > 0.50 THEN
          INSERT INTO public.operational_flags (user_id, flag_type, severity, details)
          VALUES (
            NEW.tomador_id,
            'carro_route_divergence',
            'medium',
            jsonb_build_object('vertical', 'carro', 'ride_id', NEW.id, 'straight_line_meters', straight_line_dist, 'logged_distance_meters', actual_dist)
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_carro_kyc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.usuarios
    SET under_review = false
    WHERE id = OLD.user_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.kyc_status = 'pending' THEN
      UPDATE public.usuarios
      SET under_review = true
      WHERE id = NEW.user_id;
    ELSIF NEW.kyc_status = 'approved' THEN
      UPDATE public.usuarios
      SET role = 'prestador', status = 'active', under_review = false
      WHERE id = NEW.user_id;
      UPDATE public.profiles
      SET role = 'prestador', is_active = true
      WHERE id = NEW.user_id;
    ELSIF NEW.kyc_status = 'rejected' THEN
      UPDATE public.usuarios
      SET under_review = false
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS evaluate_carro_ghost_ride_trigger ON public.carro_corridas;
CREATE TRIGGER evaluate_carro_ghost_ride_trigger
  BEFORE INSERT OR UPDATE ON public.carro_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_ghost_ride_rules();

DROP TRIGGER IF EXISTS trigger_carro_analytics ON public.carro_corridas;
CREATE TRIGGER trigger_carro_analytics
  AFTER INSERT OR UPDATE ON public.carro_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_carro_analytics();

DROP TRIGGER IF EXISTS trigger_carro_fraud_check ON public.carro_corridas;
CREATE TRIGGER trigger_carro_fraud_check
  AFTER UPDATE ON public.carro_corridas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_carro_fraud_on_complete();

DROP TRIGGER IF EXISTS on_carro_updated ON public.prestador_carro;
CREATE TRIGGER on_carro_updated
  BEFORE UPDATE ON public.prestador_carro
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_sync_carro_kyc ON public.prestador_carro;
CREATE TRIGGER trg_sync_carro_kyc
  AFTER INSERT OR UPDATE OR DELETE ON public.prestador_carro
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_carro_kyc_status();

-- ============================================================================
-- C) AMPLIAÇÃO FINANCEIRA & RPCS TRANSVERSAIS (ZERO REGRESSÃO EM MOTOTÁXI)
-- ============================================================================

-- 1. Ampliar pagamentos_split_service_type_check para aceitar 'carro'
ALTER TABLE public.pagamentos_split
  DROP CONSTRAINT IF EXISTS pagamentos_split_service_type_check;

ALTER TABLE public.pagamentos_split
  ADD CONSTRAINT pagamentos_split_service_type_check
  CHECK (service_type = ANY (ARRAY['mototaxi'::text, 'carro'::text, 'diarista'::text, 'ambulante'::text, 'coco'::text]));

-- 2. Atualizar get_user_payment_history() suportando mototaxi + carro (mesma assinatura!)
CREATE OR REPLACE FUNCTION public.get_user_payment_history()
RETURNS TABLE(
  payment_id uuid,
  transaction_id text,
  payment_status text,
  service_id uuid,
  service_type text,
  total_amount numeric,
  provider_amount numeric,
  ubt_amount numeric,
  entity_amount numeric,
  prize_worker_amount numeric,
  prize_consumer_amount numeric,
  godparent_amount numeric,
  payment_route text,
  paid_at timestamp with time zone,
  participant_role text,
  origin jsonb,
  destination jsonb,
  distance_km numeric,
  duration_min integer,
  ride_type text,
  ride_status text,
  payment_method text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    ps.id AS payment_id,
    ps.transaction_id,
    ps.status AS payment_status,
    ps.service_id,
    ps.service_type,
    ps.total_amount,
    ps.provider_amount,
    ps.ubt_amount,
    ps.entity_amount,
    ps.prize_worker_amount,
    ps.prize_consumer_amount,
    ps.godparent_amount,
    ps.payment_route,
    ps.updated_at AS paid_at,
    CASE
      WHEN public.is_current_usuario(COALESCE(mc.prestador_id, cc.prestador_id, ps.provider_id))
        THEN 'prestador'
      ELSE 'tomador'
    END AS participant_role,
    COALESCE(mc.origin, cc.origin) AS origin,
    COALESCE(mc.destination, cc.destination) AS destination,
    COALESCE(mc.distance_km, cc.distance_km) AS distance_km,
    COALESCE(mc.duration_min, cc.duration_min) AS duration_min,
    COALESCE(mc.type, cc.type) AS ride_type,
    COALESCE(mc.status, cc.status) AS ride_status,
    COALESCE(
      NULLIF(BTRIM(ps.payment_method), ''),
      NULLIF(BTRIM(mc.payment_method), ''),
      NULLIF(BTRIM(cc.payment_method), '')
    ) AS payment_method
  FROM public.pagamentos_split ps
  LEFT JOIN public.mototaxi_corridas mc
    ON ps.service_type = 'mototaxi' AND mc.id = ps.service_id
  LEFT JOIN public.carro_corridas cc
    ON ps.service_type = 'carro' AND cc.id = ps.service_id
  WHERE auth.uid() IS NOT NULL
    AND (mc.id IS NOT NULL OR cc.id IS NOT NULL)
    AND (
      public.is_current_usuario(COALESCE(mc.tomador_id, cc.tomador_id, ps.tomador_id))
      OR public.is_current_usuario(COALESCE(mc.prestador_id, cc.prestador_id, ps.provider_id))
    )
    AND ps.status IN ('approved', 'paid', 'confirmed', 'captured', 'pending')
    AND (ps.status <> 'pending' OR ps.gateway_payment_id IS NOT NULL)
    AND (
      ps.status <> 'pending'
      OR NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_split settled
        WHERE settled.service_type = ps.service_type
          AND settled.service_id = ps.service_id
          AND settled.status IN ('approved', 'paid', 'confirmed', 'captured')
      )
    )
  ORDER BY ps.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_payment_history() TO authenticated;

-- 3. Atualizar admin_list_financial_transactions() suportando carro_corridas (mesma assinatura!)
CREATE OR REPLACE FUNCTION public.admin_list_financial_transactions()
RETURNS TABLE(
  id uuid,
  transaction_id text,
  gateway_payment_id text,
  service_id uuid,
  service_type text,
  payment_method text,
  status text,
  total_amount numeric,
  base_amount numeric,
  provider_amount numeric,
  ubt_amount numeric,
  entity_amount numeric,
  prize_worker_amount numeric,
  prize_consumer_amount numeric,
  godparent_amount numeric,
  godparent_tomador_amount numeric,
  godparent_prestador_amount numeric,
  payment_route text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_admin() THEN
    SELECT lower(coalesce(u.role, '')) INTO v_caller_role
    FROM public.usuarios u
    WHERE u.id = auth.uid()
    LIMIT 1;

    IF v_caller_role NOT IN ('super_admin', 'superadmin', 'admin', 'financeiro') THEN
      SELECT lower(coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role', ''))
        INTO v_caller_role
      FROM auth.users
      WHERE auth.users.id = auth.uid();
    END IF;

    IF v_caller_role NOT IN ('super_admin', 'superadmin', 'admin', 'financeiro') THEN
      RAISE EXCEPTION 'Permissão insuficiente para consultar transações financeiras.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.transaction_id,
    ps.gateway_payment_id,
    ps.service_id,
    COALESCE(NULLIF(BTRIM(ps.service_type), ''), 'mototaxi') AS service_type,
    COALESCE(
      NULLIF(BTRIM(ps.payment_method), ''),
      NULLIF(BTRIM(mc.payment_method), ''),
      NULLIF(BTRIM(cc.payment_method), ''),
      'unknown'
    ) AS payment_method,
    ps.status,
    COALESCE(ps.total_amount, 0)::numeric AS total_amount,
    COALESCE(ps.base_amount, ps.total_amount, 0)::numeric AS base_amount,
    COALESCE(ps.provider_amount, 0)::numeric AS provider_amount,
    COALESCE(ps.ubt_amount, 0)::numeric AS ubt_amount,
    COALESCE(ps.entity_amount, 0)::numeric AS entity_amount,
    COALESCE(ps.prize_worker_amount, 0)::numeric AS prize_worker_amount,
    COALESCE(ps.prize_consumer_amount, 0)::numeric AS prize_consumer_amount,
    COALESCE(ps.godparent_amount, 0)::numeric AS godparent_amount,
    COALESCE(ps.godparent_tomador_amount, 0)::numeric AS godparent_tomador_amount,
    COALESCE(ps.godparent_prestador_amount, 0)::numeric AS godparent_prestador_amount,
    ps.payment_route,
    ps.created_at,
    ps.updated_at
  FROM public.pagamentos_split ps
  LEFT JOIN public.mototaxi_corridas mc
    ON ps.service_type = 'mototaxi' AND mc.id = ps.service_id
  LEFT JOIN public.carro_corridas cc
    ON ps.service_type = 'carro' AND cc.id = ps.service_id
  WHERE (
    ps.status <> 'pending'
    OR NOT EXISTS (
      SELECT 1
      FROM public.pagamentos_split settled
      WHERE settled.service_type = ps.service_type
        AND settled.service_id = ps.service_id
        AND settled.status IN ('approved', 'paid', 'confirmed', 'captured')
    )
  )
  ORDER BY ps.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_financial_transactions() TO authenticated;

-- ============================================================================
-- D) RPCS DE KYC, PERFIL E PRICING DE CARROS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_carro_kyc(
  p_cpf text,
  p_plate text,
  p_brand_model text,
  p_gender text,
  p_modalidade text DEFAULT 'carona_entrega',
  p_cnh_frente_url text DEFAULT NULL,
  p_cnh_verso_url text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_crlv_url text DEFAULT NULL,
  p_carro_photo_url text DEFAULT NULL,
  p_carro_interno_photo_url text DEFAULT NULL,
  p_vehicle_subtype text DEFAULT 'padrao',
  p_cor text DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_portas integer DEFAULT NULL,
  p_ar_condicionado boolean DEFAULT false,
  p_cnh_categoria text DEFAULT NULL,
  p_possui_ear boolean DEFAULT false,
  p_alvara_municipal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_usuario_id uuid;
  v_cpf_clean text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_cpf_formatted text;
  v_plate_clean text := upper(regexp_replace(coalesce(p_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  v_brand_clean text := nullif(trim(coalesce(p_brand_model, '')), '');
  v_gender_norm text;
  v_modalidade_norm text;
  v_subtype_norm text := coalesce(nullif(lower(trim(coalesce(p_vehicle_subtype, ''))), ''), 'padrao');
  v_conflict_user uuid;
  v_existing_status text;
  v_next_status text;
  v_result public.prestador_carro%ROWTYPE;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sessão expirada. Faça login novamente.');
  END IF;

  IF length(v_cpf_clean) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido. Informe os 11 dígitos.');
  END IF;
  v_cpf_formatted := substr(v_cpf_clean, 1, 3) || '.' || substr(v_cpf_clean, 4, 3) || '.' || substr(v_cpf_clean, 7, 3) || '-' || substr(v_cpf_clean, 10, 2);

  IF length(v_plate_clean) < 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Placa do veículo inválida.');
  END IF;

  v_gender_norm := CASE
    WHEN lower(coalesce(p_gender, '')) IN ('f', 'feminino') THEN 'feminino'
    WHEN lower(coalesce(p_gender, '')) IN ('m', 'masculino') THEN 'masculino'
    ELSE NULL
  END;

  v_modalidade_norm := CASE
    WHEN lower(coalesce(p_modalidade, '')) IN ('carona_entrega', 'so_entrega', 'so_carona') THEN lower(p_modalidade)
    ELSE 'carona_entrega'
  END;

  SELECT id INTO v_usuario_id FROM public.usuarios WHERE id = v_auth_uid LIMIT 1;
  IF v_usuario_id IS NULL AND v_jwt_email <> '' THEN
    SELECT id INTO v_usuario_id
    FROM public.usuarios
    WHERE lower(trim(coalesce(email, ''))) = v_jwt_email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_usuario_id IS NULL THEN
    INSERT INTO public.usuarios (id, email, nome, role, status, under_review, cpf)
    VALUES (
      v_auth_uid,
      nullif(v_jwt_email, ''),
      coalesce(nullif(split_part(v_jwt_email, '@', 1), ''), 'Motorista'),
      'tomador',
      'ativo',
      true,
      v_cpf_clean
    )
    ON CONFLICT (id) DO NOTHING;
    v_usuario_id := v_auth_uid;
  END IF;

  SELECT user_id INTO v_conflict_user
  FROM public.prestador_carro
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf_clean
    AND user_id <> v_usuario_id
  LIMIT 1;

  IF v_conflict_user IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este CPF já está cadastrado em outra conta de Motorista de Carro.');
  END IF;

  SELECT kyc_status INTO v_existing_status
  FROM public.prestador_carro
  WHERE user_id = v_usuario_id
  LIMIT 1;

  v_next_status := CASE WHEN v_existing_status = 'approved' THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.prestador_carro (
    user_id,
    cpf,
    plate,
    brand_model,
    gender,
    modalidade,
    kyc_status,
    is_online,
    cnh_frente_url,
    cnh_verso_url,
    cnh_photo_url,
    crlv_url,
    carro_photo_url,
    carro_interno_photo_url,
    selfie_url,
    vehicle_subtype,
    cor,
    ano,
    portas,
    ar_condicionado,
    cnh_categoria,
    possui_ear,
    alvara_municipal,
    updated_at
  )
  VALUES (
    v_usuario_id,
    v_cpf_formatted,
    v_plate_clean,
    v_brand_clean,
    v_gender_norm,
    v_modalidade_norm,
    v_next_status,
    false,
    nullif(trim(coalesce(p_cnh_frente_url, '')), ''),
    nullif(trim(coalesce(p_cnh_verso_url, '')), ''),
    nullif(trim(coalesce(p_cnh_frente_url, '')), ''),
    nullif(trim(coalesce(p_crlv_url, '')), ''),
    nullif(trim(coalesce(p_carro_photo_url, '')), ''),
    nullif(trim(coalesce(p_carro_interno_photo_url, '')), ''),
    nullif(trim(coalesce(p_selfie_url, '')), ''),
    v_subtype_norm,
    nullif(trim(coalesce(p_cor, '')), ''),
    p_ano,
    p_portas,
    COALESCE(p_ar_condicionado, false),
    nullif(upper(trim(coalesce(p_cnh_categoria, ''))), ''),
    COALESCE(p_possui_ear, false),
    nullif(trim(coalesce(p_alvara_municipal, '')), ''),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cpf = EXCLUDED.cpf,
    plate = EXCLUDED.plate,
    brand_model = COALESCE(EXCLUDED.brand_model, public.prestador_carro.brand_model),
    gender = COALESCE(EXCLUDED.gender, public.prestador_carro.gender),
    modalidade = EXCLUDED.modalidade,
    kyc_status = v_next_status,
    cnh_frente_url = COALESCE(EXCLUDED.cnh_frente_url, public.prestador_carro.cnh_frente_url),
    cnh_verso_url = COALESCE(EXCLUDED.cnh_verso_url, public.prestador_carro.cnh_verso_url),
    cnh_photo_url = COALESCE(EXCLUDED.cnh_photo_url, public.prestador_carro.cnh_photo_url),
    crlv_url = COALESCE(EXCLUDED.crlv_url, public.prestador_carro.crlv_url),
    carro_photo_url = COALESCE(EXCLUDED.carro_photo_url, public.prestador_carro.carro_photo_url),
    carro_interno_photo_url = COALESCE(EXCLUDED.carro_interno_photo_url, public.prestador_carro.carro_interno_photo_url),
    selfie_url = COALESCE(EXCLUDED.selfie_url, public.prestador_carro.selfie_url),
    vehicle_subtype = COALESCE(EXCLUDED.vehicle_subtype, public.prestador_carro.vehicle_subtype),
    cor = COALESCE(EXCLUDED.cor, public.prestador_carro.cor),
    ano = COALESCE(EXCLUDED.ano, public.prestador_carro.ano),
    portas = COALESCE(EXCLUDED.portas, public.prestador_carro.portas),
    ar_condicionado = COALESCE(EXCLUDED.ar_condicionado, public.prestador_carro.ar_condicionado),
    cnh_categoria = COALESCE(EXCLUDED.cnh_categoria, public.prestador_carro.cnh_categoria),
    possui_ear = COALESCE(EXCLUDED.possui_ear, public.prestador_carro.possui_ear),
    alvara_municipal = COALESCE(EXCLUDED.alvara_municipal, public.prestador_carro.alvara_municipal),
    updated_at = now()
  RETURNING * INTO v_result;

  UPDATE public.usuarios
  SET
    under_review = CASE WHEN v_next_status = 'approved' THEN false ELSE true END,
    cpf = COALESCE(NULLIF(trim(coalesce(cpf, '')), ''), v_cpf_clean)
  WHERE id = v_usuario_id;

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', v_usuario_id,
    'kyc_status', v_result.kyc_status,
    'record', to_jsonb(v_result)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_carro_kyc(text, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, boolean, text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_carro_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_record public.prestador_carro%ROWTYPE;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_record
  FROM public.prestador_carro
  WHERE user_id = v_auth_uid
  LIMIT 1;

  IF NOT FOUND AND v_jwt_email <> '' THEN
    SELECT pc.* INTO v_record
    FROM public.prestador_carro pc
    JOIN public.usuarios u ON u.id = pc.user_id
    WHERE lower(trim(coalesce(u.email, ''))) = v_jwt_email
    ORDER BY pc.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_record);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_carro_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_carro_pricing_config(
  p_taxa_unica numeric,
  p_valor_por_km numeric,
  p_km_gatilho_ida_volta numeric,
  p_fator_demanda numeric,
  p_fator_horario numeric,
  p_fator_clima numeric,
  p_subtype_multipliers jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin_email text;
  v_admin_nome text;
  v_admin_role text;
  v_before jsonb;
  v_after public.carro_pricing_config%ROWTYPE;
  v_km_gatilho numeric(10,2);
  v_multipliers jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT email, nome, lower(coalesce(role, ''))
    INTO v_admin_email, v_admin_nome, v_admin_role
    FROM public.usuarios
   WHERE id = v_uid
   LIMIT 1;

  IF NOT (
    public.is_admin()
    OR v_admin_role IN ('operator', 'admin', 'super_admin', 'superadmin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'ubt.servicos@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar tarifas de Carros.'
      USING ERRCODE = '42501';
  END IF;

  IF p_taxa_unica IS NULL OR p_taxa_unica < 0 THEN
    RAISE EXCEPTION 'Taxa única deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_valor_por_km IS NULL OR p_valor_por_km < 0 THEN
    RAISE EXCEPTION 'Valor por km deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_km_gatilho_ida_volta IS NOT NULL AND p_km_gatilho_ida_volta < 0 THEN
    RAISE EXCEPTION 'Gatilho de ida e volta deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_demanda IS NULL OR p_fator_demanda < 0.5 OR p_fator_demanda > 5.0 THEN
    RAISE EXCEPTION 'Fator de demanda inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_horario IS NULL OR p_fator_horario < 0.5 OR p_fator_horario > 5.0 THEN
    RAISE EXCEPTION 'Fator de horário inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_clima IS NULL OR p_fator_clima < 0.5 OR p_fator_clima > 5.0 THEN
    RAISE EXCEPTION 'Fator de clima inválido.' USING ERRCODE = '22023';
  END IF;

  v_km_gatilho := CASE
    WHEN p_km_gatilho_ida_volta IS NULL OR p_km_gatilho_ida_volta <= 0 THEN 0
    ELSE round(p_km_gatilho_ida_volta::numeric, 2)
  END;

  SELECT to_jsonb(c), c.subtype_multipliers
    INTO v_before, v_multipliers
    FROM public.carro_pricing_config c
   WHERE c.id = 'default';

  v_multipliers := COALESCE(p_subtype_multipliers, v_multipliers, '{"padrao": 1.0}'::jsonb);

  INSERT INTO public.carro_pricing_config (
    id,
    taxa_unica,
    valor_por_km,
    km_gatilho_ida_volta,
    fator_demanda,
    fator_horario,
    fator_clima,
    subtype_multipliers,
    updated_by,
    updated_at
  ) VALUES (
    'default',
    round(p_taxa_unica::numeric, 2),
    round(p_valor_por_km::numeric, 2),
    v_km_gatilho,
    round(p_fator_demanda::numeric, 2),
    round(p_fator_horario::numeric, 2),
    round(p_fator_clima::numeric, 2),
    v_multipliers,
    v_uid,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    taxa_unica = EXCLUDED.taxa_unica,
    valor_por_km = EXCLUDED.valor_por_km,
    km_gatilho_ida_volta = EXCLUDED.km_gatilho_ida_volta,
    fator_demanda = EXCLUDED.fator_demanda,
    fator_horario = EXCLUDED.fator_horario,
    fator_clima = EXCLUDED.fator_clima,
    subtype_multipliers = EXCLUDED.subtype_multipliers,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_after;

  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id,
      admin_nome,
      admin_email,
      acao,
      categoria,
      modulo,
      entidade,
      registro_id,
      valor_anterior,
      valor_novo,
      motivo,
      resultado,
      criticidade
    ) VALUES (
      v_uid,
      coalesce(v_admin_nome, 'Admin UBT'),
      coalesce(v_admin_email, auth.jwt() ->> 'email', 'admin@ubt.app'),
      'atualizar_preco_dinamico_carro',
      'tarifacao',
      'carros',
      'carro_pricing_config',
      'default',
      v_before,
      to_jsonb(v_after),
      'Atualização de tarifas base, gatilho ida e volta e multiplicadores dinâmicos de Carros',
      'sucesso',
      'media'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN to_jsonb(v_after);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_carro_pricing_config(numeric, numeric, numeric, numeric, numeric, numeric, jsonb) TO authenticated;

-- ============================================================================
-- E) CONTEXTO DE ASSOCIAÇÃO POR CATEGORIA & RPCS DE ASSOCIAÇÃO DE CARROS
-- ============================================================================

CREATE OR REPLACE FUNCTION public._resolve_caller_assoc_context()
RETURNS TABLE(
  caller_id uuid,
  caller_role text,
  caller_associacao_id uuid,
  caller_associacao_categoria text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_base record;
  v_cat text := NULL;
BEGIN
  SELECT * INTO v_base FROM public._resolve_caller_mototaxi_assoc_context() LIMIT 1;
  IF v_base.caller_id IS NULL THEN
    RETURN;
  END IF;

  IF v_base.caller_associacao_id IS NOT NULL THEN
    SELECT lower(coalesce(a.categoria, 'mototaxi'))
      INTO v_cat
      FROM public.associations a
     WHERE a.id = v_base.caller_associacao_id
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_base.caller_id, v_base.caller_role, v_base.caller_associacao_id, v_cat;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_my_association_scope()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_ctx record;
  v_assoc_nome text := NULL;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_assoc_context() LIMIT 1;
  IF v_ctx.caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'role', NULL,
      'associacao_id', NULL,
      'associacao_categoria', NULL,
      'associacao_nome', NULL
    );
  END IF;

  IF v_ctx.caller_associacao_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(a.nome), ''), a.name)
      INTO v_assoc_nome
      FROM public.associations a
     WHERE a.id = v_ctx.caller_associacao_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'role', v_ctx.caller_role,
    'associacao_id', v_ctx.caller_associacao_id,
    'associacao_categoria', v_ctx.caller_associacao_categoria,
    'associacao_nome', v_assoc_nome
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_my_association_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_carro_associacao_overview(
  p_associacao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_ctx record;
  v_effective_assoc_id uuid;
  v_associacoes jsonb;
  v_motoristas jsonb;
  v_mensagens jsonb;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para acessar o módulo de Associação de Carros.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' THEN
    IF v_ctx.caller_associacao_id IS NULL OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'carro' THEN
      RAISE EXCEPTION 'Acesso negado: perfil Associação não pertence à vertical de Carros.' USING ERRCODE = '42501';
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: perfil Associação só pode consultar sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  WITH driver_links AS (
    SELECT
      u.id AS driver_id,
      COALESCE(NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Motorista') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(m.associacao_id, NULLIF(to_jsonb(m)->>'association_id', '')::uuid) AS assoc_id, m.created_at
      FROM public.associacao_membros m
      WHERE m.prestador_id = u.id
        AND COALESCE(m.status, 'active') NOT IN ('removed', 'cancelled', 'rejected')
      ORDER BY m.created_at ASC
      LIMIT 1
    ) am ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.association_id, p.created_at
      FROM public.provider_associations p
      WHERE p.provider_id = u.id
      ORDER BY p.created_at ASC
      LIMIT 1
    ) pa ON TRUE
    WHERE COALESCE(u.associacao_id, am.assoc_id, pa.association_id) IS NOT NULL
  ),
  scoped_assocs AS (
    SELECT a.*
    FROM public.associations a
    WHERE lower(coalesce(a.categoria, '')) = 'carro'
      AND (
        v_ctx.caller_role IN ('super_admin', 'admin')
        OR a.id = v_ctx.caller_associacao_id
      )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sa.id,
        'cnpj', COALESCE(sa.cnpj, ''),
        'nome', COALESCE(NULLIF(BTRIM(sa.nome), ''), sa.name, 'Associação sem nome'),
        'endereco_sede', COALESCE(sa.endereco_sede, ''),
        'presidente_nome', COALESCE(sa.presidente_nome, ''),
        'presidente_cpf', COALESCE(sa.presidente_cpf, ''),
        'email_oficial', COALESCE(sa.email_oficial, ''),
        'telefone_responsavel', COALESCE(sa.telefone_responsavel, ''),
        'categoria', 'carro',
        'total_motoristas', (
          SELECT count(*) FROM driver_links dl WHERE dl.associacao_id = sa.id
        )
      )
      ORDER BY COALESCE(NULLIF(BTRIM(sa.nome), ''), sa.name) ASC
    ),
    '[]'::jsonb
  )
  INTO v_associacoes
  FROM scoped_assocs sa;

  WITH driver_links AS (
    SELECT
      u.id AS driver_id,
      COALESCE(NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Motorista') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(m.associacao_id, NULLIF(to_jsonb(m)->>'association_id', '')::uuid) AS assoc_id, m.created_at
      FROM public.associacao_membros m
      WHERE m.prestador_id = u.id
        AND COALESCE(m.status, 'active') NOT IN ('removed', 'cancelled', 'rejected')
      ORDER BY m.created_at ASC
      LIMIT 1
    ) am ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.association_id, p.created_at
      FROM public.provider_associations p
      WHERE p.provider_id = u.id
      ORDER BY p.created_at ASC
      LIMIT 1
    ) pa ON TRUE
    WHERE COALESCE(u.associacao_id, am.assoc_id, pa.association_id) IS NOT NULL
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', dl.driver_id,
        'nome', dl.nome,
        'email', COALESCE(dl.email, ''),
        'telefone', dl.telefone,
        'status', dl.status,
        'associacao_id', dl.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Associação'),
        'data_filiacao', dl.data_filiacao
      )
      ORDER BY dl.nome ASC
    ),
    '[]'::jsonb
  )
  INTO v_motoristas
  FROM driver_links dl
  JOIN public.associations a ON a.id = dl.associacao_id
  WHERE lower(coalesce(a.categoria, '')) = 'carro'
    AND (v_effective_assoc_id IS NULL OR dl.associacao_id = v_effective_assoc_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'associacao_id', m.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Todas as Associações de Carros'),
        'titulo', m.titulo,
        'conteudo', m.conteudo,
        'total_destinatarios', m.total_destinatarios,
        'created_at', m.created_at
      )
      ORDER BY m.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_mensagens
  FROM (
    SELECT amsg.*
    FROM public.associacao_mensagens amsg
    LEFT JOIN public.associations a_chk ON a_chk.id = amsg.associacao_id
    WHERE (
      v_ctx.caller_role IN ('super_admin', 'admin')
      AND lower(coalesce(a_chk.categoria, '')) = 'carro'
      AND (v_effective_assoc_id IS NULL OR amsg.associacao_id = v_effective_assoc_id)
    ) OR (
      v_ctx.caller_role = 'associacao'
      AND amsg.associacao_id = v_ctx.caller_associacao_id
    )
    ORDER BY amsg.created_at DESC
    LIMIT 20
  ) m
  LEFT JOIN public.associations a ON a.id = m.associacao_id;

  RETURN jsonb_build_object(
    'caller_role', v_ctx.caller_role,
    'caller_associacao_id', v_ctx.caller_associacao_id,
    'caller_associacao_categoria', v_ctx.caller_associacao_categoria,
    'associacoes', v_associacoes,
    'motoristas', v_motoristas,
    'mensagens_recentes', v_mensagens
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_get_carro_associacao_overview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_carro_associacao_dados(
  p_associacao_id uuid,
  p_cnpj text,
  p_nome text,
  p_endereco_sede text,
  p_presidente_nome text,
  p_presidente_cpf text,
  p_email_oficial text,
  p_telefone_responsavel text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_ctx record;
  v_updated public.associations%ROWTYPE;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para editar dados da associação de Carros.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' AND (
    v_ctx.caller_associacao_id IS NULL
    OR v_ctx.caller_associacao_id <> p_associacao_id
    OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'carro'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você só pode editar dados da sua própria associação de Carros.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'O nome da associação é obrigatório.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.associations
  SET
    cnpj = NULLIF(BTRIM(p_cnpj), ''),
    name = BTRIM(p_nome),
    nome = BTRIM(p_nome),
    endereco_sede = NULLIF(BTRIM(p_endereco_sede), ''),
    presidente_nome = NULLIF(BTRIM(p_presidente_nome), ''),
    presidente_cpf = NULLIF(BTRIM(p_presidente_cpf), ''),
    email_oficial = NULLIF(BTRIM(p_email_oficial), ''),
    telefone_responsavel = NULLIF(BTRIM(p_telefone_responsavel), ''),
    updated_at = now()
  WHERE id = p_associacao_id
    AND lower(coalesce(categoria, '')) = 'carro'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associação de Carros não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'update_carro_associacao_dados',
      'associations',
      p_associacao_id::text,
      jsonb_build_object('nome', v_updated.nome, 'cnpj', v_updated.cnpj, 'categoria', 'carro', 'caller_role', v_ctx.caller_role)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'cnpj', COALESCE(v_updated.cnpj, ''),
    'nome', COALESCE(v_updated.nome, v_updated.name, ''),
    'endereco_sede', COALESCE(v_updated.endereco_sede, ''),
    'presidente_nome', COALESCE(v_updated.presidente_nome, ''),
    'presidente_cpf', COALESCE(v_updated.presidente_cpf, ''),
    'email_oficial', COALESCE(v_updated.email_oficial, ''),
    'telefone_responsavel', COALESCE(v_updated.telefone_responsavel, ''),
    'categoria', 'carro'
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_update_carro_associacao_dados(uuid, text, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_carro_associacao_mass_message(
  p_associacao_id uuid,
  p_titulo text,
  p_conteudo text,
  p_destinatario_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_ctx record;
  v_effective_assoc_id uuid;
  v_target_ids uuid[];
  v_msg_id uuid;
  v_assoc_nome text;
  v_total integer := 0;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para disparar comunicado em massa.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_titulo), '') IS NULL OR NULLIF(BTRIM(p_conteudo), '') IS NULL THEN
    RAISE EXCEPTION 'Título e conteúdo do comunicado são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  IF v_ctx.caller_role = 'associacao' THEN
    IF v_ctx.caller_associacao_id IS NULL OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'carro' THEN
      RAISE EXCEPTION 'Acesso negado: sua associação não pertence à vertical de Carros.' USING ERRCODE = '42501';
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: você só pode enviar mensagens para motoristas da sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(nome), ''), name, 'Associação Carros UBT')
    INTO v_assoc_nome
  FROM public.associations
  WHERE id = v_effective_assoc_id AND lower(coalesce(categoria, '')) = 'carro';

  WITH eligible_drivers AS (
    SELECT DISTINCT u.id AS driver_id
    FROM public.usuarios u
    LEFT JOIN public.associacao_membros am
      ON am.prestador_id = u.id
      AND COALESCE(am.status, 'active') NOT IN ('removed', 'cancelled', 'rejected')
    LEFT JOIN public.provider_associations pa
      ON pa.provider_id = u.id
    JOIN public.associations a
      ON a.id = COALESCE(u.associacao_id, am.associacao_id, NULLIF(to_jsonb(am)->>'association_id', '')::uuid, pa.association_id)
    WHERE lower(coalesce(a.categoria, '')) = 'carro'
      AND (v_effective_assoc_id IS NULL OR a.id = v_effective_assoc_id)
  )
  SELECT COALESCE(array_agg(ed.driver_id), ARRAY[]::uuid[])
    INTO v_target_ids
  FROM eligible_drivers ed
  WHERE p_destinatario_ids IS NULL
     OR array_length(p_destinatario_ids, 1) IS NULL
     OR ed.driver_id = ANY(p_destinatario_ids);

  v_total := COALESCE(array_length(v_target_ids, 1), 0);

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhum motorista de Carro elegível encontrado para este disparo.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.associacao_mensagens (associacao_id, remetente_id, titulo, conteudo, total_destinatarios)
  VALUES (v_effective_assoc_id, v_ctx.caller_id, BTRIM(p_titulo), BTRIM(p_conteudo), v_total)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.associacao_mensagens_destinatarios (mensagem_id, destinatario_id)
  SELECT v_msg_id, unnest(v_target_ids)
  ON CONFLICT (mensagem_id, destinatario_id) DO NOTHING;

  INSERT INTO public.in_app_notifications (user_id, title, message, read_status, link)
  SELECT
    dest_id,
    '[' || COALESCE(v_assoc_nome, 'Associação Carros') || '] ' || BTRIM(p_titulo),
    BTRIM(p_conteudo),
    false,
    '/app/home'
  FROM unnest(v_target_ids) AS dest_id;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'send_carro_associacao_mass_message',
      'associacao_mensagens',
      v_msg_id::text,
      jsonb_build_object(
        'associacao_id', v_effective_assoc_id,
        'categoria', 'carro',
        'titulo', BTRIM(p_titulo),
        'total_destinatarios', v_total,
        'caller_role', v_ctx.caller_role
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'id', v_msg_id,
    'associacao_id', v_effective_assoc_id,
    'titulo', BTRIM(p_titulo),
    'total_destinatarios', v_total
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_send_carro_associacao_mass_message(uuid, text, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
