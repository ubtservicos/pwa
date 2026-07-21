-- Migration: 27_admin_audit_logs.sql
-- Description: Immutable Admin Audit Log schema, indexes, RLS, and RPCs for UBT BackOffice

-- 1. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  admin_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  admin_nome text,
  admin_email text,
  acao text NOT NULL,
  categoria text NOT NULL,
  modulo text,
  entidade text,
  registro_id text,
  valor_anterior jsonb,
  valor_novo jsonb,
  motivo text,
  ip text,
  user_agent text,
  session_id text,
  resultado text DEFAULT 'sucesso',
  criticidade text NOT NULL DEFAULT 'INFO',
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_categoria ON public.admin_audit_logs(categoria);
CREATE INDEX IF NOT EXISTS idx_admin_audit_criticidade ON public.admin_audit_logs(criticidade);
CREATE INDEX IF NOT EXISTS idx_admin_audit_acao ON public.admin_audit_logs(acao);

-- 3. RLS - Immutability Enforcement (No UPDATE/DELETE policies)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authorized admin roles" ON public.admin_audit_logs;
CREATE POLICY "Enable read access for authorized admin roles"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin')
    OR
    (
      (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('operations_manager', 'operator', 'financeiro', 'moderador')
      AND criticidade IN ('INFO', 'BAIXA', 'MEDIA')
    )
    OR
    (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.admin_audit_logs;
CREATE POLICY "Enable insert for authenticated users"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. RPC to log administrative actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id uuid DEFAULT NULL,
  p_admin_nome text DEFAULT NULL,
  p_admin_email text DEFAULT NULL,
  p_acao text DEFAULT 'acao_administrativa',
  p_categoria text DEFAULT 'Sistema',
  p_modulo text DEFAULT NULL,
  p_entidade text DEFAULT NULL,
  p_registro_id text DEFAULT NULL,
  p_valor_anterior jsonb DEFAULT NULL,
  p_valor_novo jsonb DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_resultado text DEFAULT 'sucesso',
  p_criticidade text DEFAULT 'INFO',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
  v_real_admin_id uuid := COALESCE(p_admin_id, auth.uid());
  v_admin_nome text := p_admin_nome;
  v_admin_email text := p_admin_email;
BEGIN

  IF (v_admin_nome IS NULL OR v_admin_email IS NULL) AND v_real_admin_id IS NOT NULL THEN
    SELECT nome, email INTO v_admin_nome, v_admin_email
      FROM public.usuarios
     WHERE id = v_real_admin_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, admin_nome, admin_email, acao, categoria, modulo, entidade,
    registro_id, valor_anterior, valor_novo, motivo, ip, user_agent,
    session_id, resultado, criticidade, metadata
  ) VALUES (
    v_real_admin_id,
    COALESCE(v_admin_nome, 'Operador Admin'),
    COALESCE(v_admin_email, 'admin@ubtsuperapp.com.br'),
    p_acao, p_categoria, p_modulo, p_entidade, p_registro_id,
    p_valor_anterior, p_valor_novo, p_motivo, p_ip, p_user_agent,
    p_session_id, p_resultado, p_criticidade, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 5. RPC to get Audit Summary KPIs
CREATE OR REPLACE FUNCTION get_admin_audit_logs_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', NOW());
  v_hour_ago timestamptz := NOW() - INTERVAL '1 hour';
  
  v_total_hoje integer;
  v_ultima_hora integer;
  v_criticas integer;
  v_falhas integer;
BEGIN

  SELECT COUNT(*) INTO v_total_hoje FROM public.admin_audit_logs WHERE created_at >= v_today_start;
  SELECT COUNT(*) INTO v_ultima_hora FROM public.admin_audit_logs WHERE created_at >= v_hour_ago;
  SELECT COUNT(*) INTO v_criticas FROM public.admin_audit_logs WHERE criticidade IN ('ALTA', 'CRITICA');
  SELECT COUNT(*) INTO v_falhas FROM public.admin_audit_logs WHERE resultado = 'falha';

  RETURN jsonb_build_object(
    'total_hoje', v_total_hoje,
    'ultima_hora', v_ultima_hora,
    'criticas', v_criticas,
    'falhas', v_falhas
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs_summary() TO authenticated, service_role, anon;
