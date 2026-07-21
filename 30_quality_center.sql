-- Migration: 30_quality_center.sql
-- Description: Quality Center schema, test results persistence, certification seals, and RPCs

-- 1. Create quality_runs table
CREATE TABLE IF NOT EXISTS public.quality_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score integer NOT NULL,
  status text NOT NULL,
  selo text NOT NULL,
  total_tests integer NOT NULL,
  passed_tests integer NOT NULL,
  failed_tests integer NOT NULL,
  warning_tests integer NOT NULL,
  duration_ms integer NOT NULL,
  executed_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Create quality_test_results table
CREATE TABLE IF NOT EXISTS public.quality_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.quality_runs(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL,
  status text NOT NULL,
  mensagem text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_quality_runs_created_at ON public.quality_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_test_results_run ON public.quality_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_quality_test_results_cat ON public.quality_test_results(categoria);

-- 4. RLS
ALTER TABLE public.quality_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated on quality_runs" ON public.quality_runs;
CREATE POLICY "Enable read access for authenticated on quality_runs" ON public.quality_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated on quality_runs" ON public.quality_runs;
CREATE POLICY "Enable insert access for authenticated on quality_runs" ON public.quality_runs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for authenticated on quality_test_results" ON public.quality_test_results;
CREATE POLICY "Enable read access for authenticated on quality_test_results" ON public.quality_test_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated on quality_test_results" ON public.quality_test_results;
CREATE POLICY "Enable insert access for authenticated on quality_test_results" ON public.quality_test_results FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Seed RBAC Permissions for Quality Center
INSERT INTO public.permissions (codigo, nome, descricao, categoria) VALUES
  ('quality.view', 'Visualizar Quality Center', 'Acesso ao painel oficial de certificação de qualidade', 'Sistema'),
  ('quality.execute', 'Executar Suíte de Testes', 'Disparar diagnósticos automatizados de plataforma', 'Sistema'),
  ('quality.export', 'Exportar Relatórios de Qualidade', 'Download de relatórios de testes em CSV/JSON', 'Sistema')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

-- Map to Super Admin & Admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
 CROSS JOIN public.permissions p
 WHERE r.codigo IN ('super_admin', 'admin', 'auditoria', 'operations_manager')
   AND p.codigo IN ('quality.view', 'quality.execute', 'quality.export')
ON CONFLICT DO NOTHING;

-- 6. RPC get_latest_quality_summary
CREATE OR REPLACE FUNCTION get_latest_quality_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run public.quality_runs%ROWTYPE;
  v_results jsonb;
BEGIN

  SELECT * INTO v_run
    FROM public.quality_runs
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_run', false,
      'run', null,
      'tests', '[]'::jsonb
    );
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'codigo', r.codigo,
      'nome', r.nome,
      'categoria', r.categoria,
      'status', r.status,
      'mensagem', r.mensagem,
      'detalhes', r.detalhes,
      'duration_ms', r.duration_ms
    ) ORDER BY r.status DESC, r.categoria, r.nome
  ) INTO v_results
    FROM public.quality_test_results r
   WHERE r.run_id = v_run.id;

  RETURN jsonb_build_object(
    'has_run', true,
    'run', jsonb_build_object(
      'id', v_run.id,
      'score', v_run.score,
      'status', v_run.status,
      'selo', v_run.selo,
      'total_tests', v_run.total_tests,
      'passed_tests', v_run.passed_tests,
      'failed_tests', v_run.failed_tests,
      'warning_tests', v_run.warning_tests,
      'duration_ms', v_run.duration_ms,
      'executed_by', v_run.executed_by,
      'created_at', v_run.created_at
    ),
    'tests', COALESCE(v_results, '[]'::jsonb)
  );
END;
$$;

-- 7. RPC save_quality_run
CREATE OR REPLACE FUNCTION save_quality_run(
  p_score integer,
  p_status text,
  p_selo text,
  p_total integer,
  p_passed integer,
  p_failed integer,
  p_warning integer,
  p_duration_ms integer,
  p_results jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id uuid;
  v_real_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_item jsonb;
BEGIN

  INSERT INTO public.quality_runs (
    score, status, selo, total_tests, passed_tests, failed_tests,
    warning_tests, duration_ms, executed_by
  ) VALUES (
    p_score, p_status, p_selo, p_total, p_passed, p_failed,
    p_warning, p_duration_ms, v_real_user_id
  )
  RETURNING id INTO v_run_id;

  -- Insert test results
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    INSERT INTO public.quality_test_results (
      run_id, codigo, nome, categoria, status, mensagem, detalhes, duration_ms
    ) VALUES (
      v_run_id,
      v_item ->> 'codigo',
      v_item ->> 'nome',
      v_item ->> 'categoria',
      v_item ->> 'status',
      v_item ->> 'mensagem',
      COALESCE(v_item -> 'detalhes', '{}'::jsonb),
      COALESCE((v_item ->> 'duration_ms')::integer, 0)
    );
  END LOOP;

  -- Audit log integration
  PERFORM log_admin_action(
    p_admin_id => v_real_user_id,
    p_acao => 'quality_run_executed',
    p_categoria => 'Sistema',
    p_modulo => 'Quality Center',
    p_entidade => 'quality_runs',
    p_registro_id => v_run_id::text,
    p_criticidade => CASE WHEN p_score < 70 THEN 'ALTA' ELSE 'INFO' END,
    p_metadata => jsonb_build_object(
      'score', p_score,
      'selo', p_selo,
      'total', p_total,
      'passed', p_passed,
      'failed', p_failed
    )
  );

  RETURN v_run_id;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION get_latest_quality_summary() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION save_quality_run(integer, text, text, integer, integer, integer, integer, integer, jsonb, uuid) TO authenticated, service_role, anon;
