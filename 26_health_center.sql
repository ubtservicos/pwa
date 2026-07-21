-- Migration: 26_health_center.sql
-- Description: Health Center schema, RPCs, and automated alert evaluation for UBT BackOffice

-- 1. Create health_alerts table
CREATE TABLE IF NOT EXISTS public.health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  categoria text NOT NULL,
  criticidade text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  acao_recomendada text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_health_alerts_status ON public.health_alerts(status);
CREATE INDEX IF NOT EXISTS idx_health_alerts_categoria ON public.health_alerts(categoria);
CREATE INDEX IF NOT EXISTS idx_health_alerts_criticidade ON public.health_alerts(criticidade);
CREATE INDEX IF NOT EXISTS idx_health_alerts_created ON public.health_alerts(created_at DESC);

-- 3. RLS
ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for admin and operations roles" ON public.health_alerts;
CREATE POLICY "Enable read access for admin and operations roles"
  ON public.health_alerts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable update access for admin and operations roles" ON public.health_alerts;
CREATE POLICY "Enable update access for admin and operations roles"
  ON public.health_alerts FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated" ON public.health_alerts;
CREATE POLICY "Enable insert access for authenticated"
  ON public.health_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. RPC to evaluate system health anomalies and insert alerts
CREATE OR REPLACE FUNCTION evaluate_system_health_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := NOW();
  v_today_start timestamptz := date_trunc('day', NOW());
  v_hour_ago timestamptz := NOW() - INTERVAL '1 hour';
  
  v_recusados_today integer;
  v_pix_pendentes integer;
  v_payouts_parados integer;
  v_disputas_abertas integer;
  v_motoristas_online integer;
  v_corridas_buscando integer;
  v_cancelamentos_today integer;
  v_erros_1h integer;
  v_fila_notif integer;
  v_kyc_pendentes integer;
  v_lgpd_pendente integer;
BEGIN

  -- A) Financeiro: Pagamentos recusados hoje
  SELECT COUNT(*) INTO v_recusados_today
    FROM public.payments
   WHERE status::text IN ('failed', 'refused', 'cancelled', 'rejected')
     AND created_at >= v_today_start;

  IF v_recusados_today >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'fin_high_refusal' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'fin_high_refusal', 'Financeiro', 'ALTA',
        'Taxa de recusa de pagamento elevada',
        FORMAT('Ocorreram %s recusas/falhas de pagamento no dia de hoje.', v_recusados_today),
        'Verificar credenciais do Gateway Mercado Pago e saldo de pagadores.',
        jsonb_build_object('count', v_recusados_today)
      );
    END IF;
  END IF;

  -- B) Financeiro: Pix pendentes
  SELECT COUNT(*) INTO v_pix_pendentes
    FROM public.payments
   WHERE payment_method = 'pix' AND status::text = 'pending';

  IF v_pix_pendentes >= 5 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'fin_pix_pending' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'fin_pix_pending', 'Financeiro', 'MEDIA',
        'Aumento em transações Pix pendentes',
        FORMAT('Existem %s pagamentos Pix aguardando confirmação do webhook.', v_pix_pendentes),
        'Conferir o serviço de recepção de Webhooks do Mercado Pago.',
        jsonb_build_object('count', v_pix_pendentes)
      );
    END IF;
  END IF;

  -- C) Financeiro: Payouts parados
  SELECT COUNT(*) INTO v_payouts_parados
    FROM public.payouts
   WHERE status::text IN ('pending', 'processing');

  IF v_payouts_parados >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'fin_payout_stuck' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'fin_payout_stuck', 'Financeiro', 'ALTA',
        'Fila de saques / payouts represada',
        FORMAT('Existem %s saques em processamento aguardando envio bancário.', v_payouts_parados),
        'Acessar a tela de Payouts no BackOffice para liberação manual.',
        jsonb_build_object('count', v_payouts_parados)
      );
    END IF;
  END IF;

  -- D) Marketplace: Poucos prestadores online
  SELECT (
    (SELECT COUNT(*) FROM public.coco_caminhoes WHERE is_online = true) +
    (SELECT COUNT(*) FROM public.ambulante_sessions WHERE is_online = true)
  ) INTO v_motoristas_online;

  IF v_motoristas_online < 2 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'mkt_low_drivers' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'mkt_low_drivers', 'Marketplace', 'MEDIA',
        'Baixa oferta de prestadores online',
        'Apenas ' || v_motoristas_online || ' prestadores estão marcados como online no momento em Ubatuba.',
        'Enviar notificação Push incentivo para os prestadores cadastrados.',
        jsonb_build_object('online_count', v_motoristas_online)
      );
    END IF;
  END IF;

  -- E) Marketplace: Corridas sem aceite
  SELECT COUNT(*) INTO v_corridas_buscando
    FROM public.mototaxi_corridas
   WHERE status = 'searching';

  IF v_corridas_buscando >= 2 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'mkt_unmatched_rides' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'mkt_unmatched_rides', 'Marketplace', 'ALTA',
        'Pedidos de corrida aguardando motorista',
        FORMAT('Existem %s corridas de mototáxi em busca de motorista sem aceite.', v_corridas_buscando),
        'Notificar mototaxistas mais próximos da região do cliente.',
        jsonb_build_object('count', v_corridas_buscando)
      );
    END IF;
  END IF;

  -- F) Tecnologia: Erros de sistema na última hora
  SELECT COUNT(*) INTO v_erros_1h
    FROM public.system_logs
   WHERE severity = 'ERROR' AND created_at >= v_hour_ago;

  IF v_erros_1h >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'tech_high_errors' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'tech_high_errors', 'Tecnologia', 'CRITICA',
        'Erros de sistema detectados na última hora',
        FORMAT('Foram registrados %s logs de erro na plataforma na última hora.', v_erros_1h),
        'Inspecionar os registros detalhados na tela de Auditoria / Logs.',
        jsonb_build_object('error_count', v_erros_1h)
      );
    END IF;
  END IF;

  -- G) KYC: Acúmulo de cadastros para validação
  SELECT COUNT(*) INTO v_kyc_pendentes
    FROM public.usuarios
   WHERE under_review = true OR role = 'tomador_kyc_pending';

  IF v_kyc_pendentes >= 5 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'kyc_queue_high' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'kyc_queue_high', 'KYC', 'MEDIA',
        'Fila de aprovação de KYC acumulada',
        FORMAT('Existem %s cadastros de prestadores aguardando verificação documental.', v_kyc_pendentes),
        'Acessar o painel de KYCs Pendentes para aprovação rápida.',
        jsonb_build_object('pending', v_kyc_pendentes)
      );
    END IF;
  END IF;

  -- H) LGPD: Solicitação de exclusão pendente
  SELECT COUNT(*) INTO v_lgpd_pendente
    FROM public.usuarios
   WHERE deleted_at IS NOT NULL AND anonymized_at IS NULL;

  IF v_lgpd_pendente > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.health_alerts WHERE tipo = 'lgpd_deletion_pending' AND status = 'active') THEN
      INSERT INTO public.health_alerts (tipo, categoria, criticidade, titulo, descricao, acao_recomendada, metadata)
      VALUES (
        'lgpd_deletion_pending', 'LGPD', 'ALTA',
        'Solicitação de exclusão de dados (LGPD) pendente',
        FORMAT('Existe %s solicitação de exclusão definitiva de conta no prazo regulatório.', v_lgpd_pendente),
        'Acessar o módulo de Privacidade / LGPD para efetuar o expurgo de PII.',
        jsonb_build_object('count', v_lgpd_pendente)
      );
    END IF;
  END IF;

END;
$$;

-- 5. RPC to get aggregated Health Center summary and active alerts
CREATE OR REPLACE FUNCTION get_health_center_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := NOW();
  v_today_start timestamptz := date_trunc('day', NOW());

  v_criticos integer;
  v_ativos integer;
  v_resolvidos_hoje integer;
  v_tempo_medio_min numeric;
  v_alerts_list jsonb;
BEGIN
  -- Evaluate latest system condition first
  PERFORM evaluate_system_health_alerts();

  -- Active counts
  SELECT COUNT(*) FILTER (WHERE criticidade IN ('CRITICA', 'ALTA')),
         COUNT(*)
    INTO v_criticos, v_ativos
    FROM public.health_alerts
   WHERE status = 'active';

  -- Resolved today count
  SELECT COUNT(*)
    INTO v_resolvidos_hoje
    FROM public.health_alerts
   WHERE status = 'resolved'
     AND resolved_at >= v_today_start;

  -- Avg resolution time
  SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)), 0)
    INTO v_tempo_medio_min
    FROM public.health_alerts
   WHERE status = 'resolved'
     AND resolved_at IS NOT NULL;

  -- Full alerts array
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'tipo', a.tipo,
      'categoria', a.categoria,
      'criticidade', a.criticidade,
      'titulo', a.titulo,
      'descricao', a.descricao,
      'acao_recomendada', a.acao_recomendada,
      'status', a.status,
      'created_at', a.created_at,
      'resolved_at', a.resolved_at,
      'resolved_by', a.resolved_by,
      'metadata', a.metadata
    ) ORDER BY 
        CASE a.status WHEN 'active' THEN 1 WHEN 'resolving' THEN 2 ELSE 3 END,
        CASE a.criticidade WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5 END,
        a.created_at DESC
  )
    INTO v_alerts_list
    FROM public.health_alerts a;

  RETURN jsonb_build_object(
    'alertas_criticos', v_criticos,
    'alertas_ativos', v_ativos,
    'alertas_resolvidos_hoje', v_resolvidos_hoje,
    'tempo_medio_resolucao_min', v_tempo_medio_min,
    'alertas', COALESCE(v_alerts_list, '[]'::jsonb)
  );
END;
$$;

-- 6. RPC to resolve a health alert
CREATE OR REPLACE FUNCTION resolve_health_alert(p_alert_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.health_alerts
     SET status = 'resolved',
         resolved_at = NOW(),
         resolved_by = p_user_id
   WHERE id = p_alert_id;

  RETURN FOUND;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION evaluate_system_health_alerts() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION get_health_center_summary() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION resolve_health_alert(uuid, uuid) TO authenticated, service_role, anon;
