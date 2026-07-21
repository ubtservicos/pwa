-- Migration: 31_security_center.sql
-- Description: Security Center findings schema, security audit engine, classification score, and RPCs

-- 1. Create security_findings table
CREATE TABLE IF NOT EXISTS public.security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  criticidade text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  impacto text,
  probabilidade text DEFAULT 'MEDIA',
  risco text DEFAULT 'MEDIO',
  acao text,
  status text NOT NULL DEFAULT 'open',
  responsavel uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_security_findings_status ON public.security_findings(status);
CREATE INDEX IF NOT EXISTS idx_security_findings_categoria ON public.security_findings(categoria);
CREATE INDEX IF NOT EXISTS idx_security_findings_criticidade ON public.security_findings(criticidade);

-- 3. RLS
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated on security_findings" ON public.security_findings;
CREATE POLICY "Enable read access for authenticated on security_findings"
  ON public.security_findings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable write access for authorized admins on security_findings" ON public.security_findings;
CREATE POLICY "Enable write access for authorized admins on security_findings"
  ON public.security_findings FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'auditoria')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

-- 4. Seed RBAC Permissions
INSERT INTO public.permissions (codigo, nome, descricao, categoria) VALUES
  ('security.view', 'Visualizar Security Center', 'Acesso ao Centro de Segurança e Superfície de Ataque', 'Sistema'),
  ('security.resolve', 'Resolver Riscos de Segurança', 'Marcar e mitigar ocorrências de segurança', 'Sistema'),
  ('security.export', 'Exportar Relatórios de Segurança', 'Download de relatórios de segurança em CSV/JSON', 'Sistema')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

-- Map to Super Admin, Admin & Auditoria roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.codigo IN ('super_admin', 'admin', 'auditoria')
   AND p.codigo IN ('security.view', 'security.resolve', 'security.export')
ON CONFLICT DO NOTHING;

-- 5. RPC run_security_audit
CREATE OR REPLACE FUNCTION run_security_audit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lgpd_pending integer;
  v_pix_pending integer;
  v_payout_stuck integer;
  v_disputes_open integer;
  v_kyc_pending integer;
  v_errors_24h integer;
BEGIN

  -- A) LGPD: Pending deletion requests
  SELECT COUNT(*) INTO v_lgpd_pending
    FROM public.usuarios
   WHERE deleted_at IS NOT NULL AND anonymized_at IS NULL;

  IF v_lgpd_pending > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%LGPD%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'LGPD', 'ALTA',
        'Pendência de Expurgo de Dados LGPD',
        FORMAT('Existem %s contas solicitando exclusão de PII sem anonimização efetuada.', v_lgpd_pending),
        'Risco de descumprimento de prazos regulatórios da ANPD.',
        'ALTA', 'ALTO',
        'Executar a rotina de anonimização no módulo Privacidade / LGPD.',
        jsonb_build_object('pending_count', v_lgpd_pending)
      );
    END IF;
  END IF;

  -- B) Financeiro: Unconfirmed Pix payments older than 1h
  SELECT COUNT(*) INTO v_pix_pending
    FROM public.payments
   WHERE payment_method = 'pix' AND status::text = 'pending' AND created_at < NOW() - INTERVAL '1 hour';

  IF v_pix_pending >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%Pix%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'Financeiro', 'MEDIA',
        'Transações Pix Pendentes sem Webhook de Retorno',
        FORMAT('Existem %s cobranças Pix pendentes com mais de 1 hora de criação.', v_pix_pending),
        'Perda de sincronia entre Gateway Mercado Pago e saldo UBT.',
        'MEDIA', 'MEDIO',
        'Validar a URL e assinatura X-Signature do Webhook Mercado Pago.',
        jsonb_build_object('pix_count', v_pix_pending)
      );
    END IF;
  END IF;

  -- C) Financeiro: Stuck Payouts
  SELECT COUNT(*) INTO v_payout_stuck
    FROM public.payouts
   WHERE status::text IN ('pending', 'processing') AND created_at < NOW() - INTERVAL '6 hours';

  IF v_payout_stuck >= 2 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%Saque%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'Financeiro', 'ALTA',
        'Repasse Financeiro / Payout Represado',
        FORMAT('Existem %s solicitações de saque em processamento há mais de 6 horas.', v_payout_stuck),
        'Atraso na liquidação de valores a trabalhadores e mototaxistas.',
        'MEDIA', 'ALTO',
        'Efetuar a liberação manual ou conferir a credencial bancária.',
        jsonb_build_object('stuck_count', v_payout_stuck)
      );
    END IF;
  END IF;

  -- D) Marketplace: Open Disputes
  SELECT COUNT(*) INTO v_disputes_open
    FROM public.disputes
   WHERE status::text IN ('open', 'opened', 'in_review');

  IF v_disputes_open >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%Disputa%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'Marketplace', 'MEDIA',
        'Disputas de Pedidos sem Mediação',
        FORMAT('Existem %s disputas operacionais em aberto aguardando moderador.', v_disputes_open),
        'Insatisfação do cliente e risco de chargeback no cartão de crédito.',
        'ALTA', 'MEDIO',
        'Acessar o painel de Mediações para análise de histórico e reembolso.',
        jsonb_build_object('disputes_count', v_disputes_open)
      );
    END IF;
  END IF;

  -- E) KYC: Unreviewed Documents Queue
  SELECT COUNT(*) INTO v_kyc_pending
    FROM public.usuarios
   WHERE under_review = true OR role = 'tomador_kyc_pending';

  IF v_kyc_pending >= 5 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%KYC%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'Autorizacao', 'MEDIA',
        'Acúmulo de Validações de Documento KYC',
        FORMAT('Existem %s prestadores aguardando aprovação documental de CNH/veículo.', v_kyc_pending),
        'Atraso no onboarding de motoristas e diaristas em Ubatuba.',
        'MEDIA', 'MEDIO',
        'Validar antecedentes e fotos no painel de KYCs Pendentes.',
        jsonb_build_object('kyc_pending', v_kyc_pending)
      );
    END IF;
  END IF;

  -- F) Infraestrutura & Logs: High error rate in 24h
  SELECT COUNT(*) INTO v_errors_24h
    FROM public.system_logs
   WHERE severity = 'ERROR' AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_errors_24h >= 5 THEN
    IF NOT EXISTS (SELECT 1 FROM public.security_findings WHERE titulo ILIKE '%Erros%' AND status = 'open') THEN
      INSERT INTO public.security_findings (categoria, criticidade, titulo, descricao, impacto, probabilidade, risco, acao, metadata)
      VALUES (
        'Infraestrutura', 'CRITICA',
        'Volume Elevado de Erros em Produção',
        FORMAT('Foram registrados %s logs de exceção/erro na plataforma nas últimas 24h.', v_erros_24h),
        'Possível falha em Edge Functions, banco de dados ou chamadas externas.',
        'ALTA', 'EXTREMO',
        'Inspecionar os rastros e stacks na tela de Auditoria / Logs.',
        jsonb_build_object('errors_24h', v_errors_24h)
      );
    END IF;
  END IF;

END;
$$;

-- 6. RPC get_security_summary
CREATE OR REPLACE FUNCTION get_security_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_criticos integer;
  v_medios integer;
  v_baixos integer;
  v_resolvidos integer;
  v_open_total integer;
  v_score integer;
  v_selo text;
  v_findings_list jsonb;
BEGIN

  PERFORM run_security_audit();

  SELECT COUNT(*) FILTER (WHERE criticidade IN ('CRITICA', 'ALTA') AND status = 'open'),
         COUNT(*) FILTER (WHERE criticidade = 'MEDIA' AND status = 'open'),
         COUNT(*) FILTER (WHERE criticidade IN ('BAIXA', 'INFO') AND status = 'open'),
         COUNT(*) FILTER (WHERE status = 'resolved'),
         COUNT(*) FILTER (WHERE status = 'open')
    INTO v_criticos, v_medios, v_baixos, v_resolvidos, v_open_total
    FROM public.security_findings;

  -- Calculate Score (100 - penalties)
  v_score := 100 - (v_criticos * 15 + v_medios * 5 + v_baixos * 2);
  IF v_score < 0 THEN v_score := 0; END IF;

  IF v_score >= 95 AND v_criticos = 0 THEN
    v_selo := 'Production Secure';
  ELSIF v_score >= 85 AND v_criticos <= 1 THEN
    v_selo := 'Pilot Secure';
  ELSIF v_score >= 70 THEN
    v_selo := 'Attention Required';
  ELSE
    v_selo := 'Critical Risk';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'categoria', f.categoria,
      'criticidade', f.criticidade,
      'titulo', f.titulo,
      'descricao', f.descricao,
      'impacto', f.impacto,
      'probabilidade', f.probabilidade,
      'risco', f.risco,
      'acao', f.acao,
      'status', f.status,
      'responsavel', f.responsavel,
      'created_at', f.created_at,
      'resolved_at', f.resolved_at,
      'metadata', f.metadata
    ) ORDER BY
        CASE f.status WHEN 'open' THEN 1 WHEN 'resolving' THEN 2 ELSE 3 END,
        CASE f.criticidade WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5 END,
        f.created_at DESC
  ) INTO v_findings_list
    FROM public.security_findings f;

  RETURN jsonb_build_object(
    'score', v_score,
    'selo', v_selo,
    'riscos_criticos', v_criticos,
    'riscos_medios', v_medios,
    'riscos_baixos', v_baixos,
    'riscos_resolvidos', v_resolvidos,
    'riscos_abertos', v_open_total,
    'findings', COALESCE(v_findings_list, '[]'::jsonb)
  );
END;
$$;

-- 7. RPC resolve_security_finding
CREATE OR REPLACE FUNCTION resolve_security_finding(
  p_finding_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_finding public.security_findings%ROWTYPE;
  v_real_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN

  SELECT * INTO v_finding FROM public.security_findings WHERE id = p_finding_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ocorrência de segurança com ID % não encontrada.', p_finding_id;
  END IF;

  UPDATE public.security_findings
     SET status = 'resolved',
         resolved_at = NOW(),
         responsavel = v_real_user_id
   WHERE id = p_finding_id;

  -- Audit log integration
  PERFORM log_admin_action(
    p_admin_id => v_real_user_id,
    p_acao => 'security_finding_resolved',
    p_categoria => 'Segurança',
    p_modulo => 'Security Center',
    p_entidade => 'security_findings',
    p_registro_id => p_finding_id::text,
    p_motivo => COALESCE(p_motivo, 'Resolução de risco de segurança confirmada'),
    p_criticidade => 'MEDIA',
    p_metadata => jsonb_build_object('titulo', v_finding.titulo, 'criticidade', v_finding.criticidade)
  );

  RETURN true;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION run_security_audit() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION get_security_summary() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION resolve_security_finding(uuid, uuid, text) TO authenticated, service_role, anon;
