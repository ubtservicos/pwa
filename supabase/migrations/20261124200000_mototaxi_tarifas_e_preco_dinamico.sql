-- ============================================================================
-- UBT Mototaxistas: Tabela e RPC de Tarifas Base, Gatilho Ida e Volta e
-- Multiplicadores de Preco Dinamico (BRL)
-- Idempotent migration (DDL + default config ON CONFLICT DO NOTHING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mototaxi_pricing_config (
  id text PRIMARY KEY DEFAULT 'default',
  taxa_unica numeric(10,2) NOT NULL DEFAULT 4.00 CHECK (taxa_unica >= 0),
  valor_por_km numeric(10,2) NOT NULL DEFAULT 2.50 CHECK (valor_por_km >= 0),
  km_gatilho_ida_volta numeric(10,2) NULL DEFAULT 8.00 CHECK (km_gatilho_ida_volta IS NULL OR km_gatilho_ida_volta >= 0),
  fator_demanda numeric(6,2) NOT NULL DEFAULT 1.00 CHECK (fator_demanda >= 0.50 AND fator_demanda <= 5.00),
  fator_horario numeric(6,2) NOT NULL DEFAULT 1.00 CHECK (fator_horario >= 0.50 AND fator_horario <= 5.00),
  fator_clima numeric(6,2) NOT NULL DEFAULT 1.00 CHECK (fator_clima >= 0.50 AND fator_clima <= 5.00),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.mototaxi_pricing_config (
  id,
  taxa_unica,
  valor_por_km,
  km_gatilho_ida_volta,
  fator_demanda,
  fator_horario,
  fator_clima
) VALUES (
  'default',
  4.00,
  2.50,
  8.00,
  1.00,
  1.00,
  1.00
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mototaxi_pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mototaxi_pricing_config_select_public" ON public.mototaxi_pricing_config;
CREATE POLICY "mototaxi_pricing_config_select_public"
  ON public.mototaxi_pricing_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "mototaxi_pricing_config_admin_write" ON public.mototaxi_pricing_config;
CREATE POLICY "mototaxi_pricing_config_admin_write"
  ON public.mototaxi_pricing_config
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.mototaxi_pricing_config TO anon, authenticated;
GRANT INSERT, UPDATE ON public.mototaxi_pricing_config TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_mototaxi_pricing_config(
  p_taxa_unica numeric,
  p_valor_por_km numeric,
  p_km_gatilho_ida_volta numeric,
  p_fator_demanda numeric,
  p_fator_horario numeric,
  p_fator_clima numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin_email text;
  v_admin_nome text;
  v_admin_role text;
  v_before jsonb;
  v_after public.mototaxi_pricing_config%ROWTYPE;
  v_km_gatilho numeric(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria.' USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar tarifas de mototaxi.'
      USING ERRCODE = '42501';
  END IF;

  IF p_taxa_unica IS NULL OR p_taxa_unica < 0 THEN
    RAISE EXCEPTION 'Taxa unica deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_valor_por_km IS NULL OR p_valor_por_km < 0 THEN
    RAISE EXCEPTION 'Valor por km deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_km_gatilho_ida_volta IS NOT NULL AND p_km_gatilho_ida_volta < 0 THEN
    RAISE EXCEPTION 'Gatilho de ida e volta deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_demanda IS NULL OR p_fator_demanda < 0.5 OR p_fator_demanda > 5.0 THEN
    RAISE EXCEPTION 'Fator de demanda invalido.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_horario IS NULL OR p_fator_horario < 0.5 OR p_fator_horario > 5.0 THEN
    RAISE EXCEPTION 'Fator de horario invalido.' USING ERRCODE = '22023';
  END IF;
  IF p_fator_clima IS NULL OR p_fator_clima < 0.5 OR p_fator_clima > 5.0 THEN
    RAISE EXCEPTION 'Fator de clima invalido.' USING ERRCODE = '22023';
  END IF;

  v_km_gatilho := CASE
    WHEN p_km_gatilho_ida_volta IS NULL OR p_km_gatilho_ida_volta <= 0 THEN 0
    ELSE round(p_km_gatilho_ida_volta::numeric, 2)
  END;

  SELECT to_jsonb(c)
    INTO v_before
    FROM public.mototaxi_pricing_config c
   WHERE c.id = 'default';

  INSERT INTO public.mototaxi_pricing_config (
    id,
    taxa_unica,
    valor_por_km,
    km_gatilho_ida_volta,
    fator_demanda,
    fator_horario,
    fator_clima,
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
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_after;

  -- Trilha de auditoria administrativa
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
    'atualizar_preco_dinamico_mototaxi',
    'tarifacao',
    'mototaxistas',
    'mototaxi_pricing_config',
    'default',
    v_before,
    to_jsonb(v_after),
    'Atualização de tarifas base, gatilho ida e volta e multiplicadores dinâmicos de Mototáxi',
    'sucesso',
    'media'
  );

  RETURN to_jsonb(v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_mototaxi_pricing_config(numeric, numeric, numeric, numeric, numeric, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
