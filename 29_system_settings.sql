-- Migration: 29_system_settings.sql
-- Description: Centralized system_settings schema, versioning, audit integration, and RPCs

-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  chave text UNIQUE NOT NULL,
  valor jsonb NOT NULL,
  tipo text NOT NULL,
  descricao text,
  valor_padrao jsonb,
  editavel boolean DEFAULT true,
  sensivel boolean DEFAULT false,
  versao integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- 2. Create system_setting_versions table
CREATE TABLE IF NOT EXISTS public.system_setting_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_id uuid REFERENCES public.system_settings(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor jsonb NOT NULL,
  versao integer NOT NULL,
  updated_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  motivo text
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_categoria ON public.system_settings(categoria);
CREATE INDEX IF NOT EXISTS idx_system_settings_chave ON public.system_settings(chave);
CREATE INDEX IF NOT EXISTS idx_setting_versions_setting ON public.system_setting_versions(setting_id, versao DESC);

-- 4. RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_setting_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated on system_settings" ON public.system_settings;
CREATE POLICY "Enable read access for authenticated on system_settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (
    sensivel = false
    OR (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

DROP POLICY IF EXISTS "Enable write access for admins on system_settings" ON public.system_settings;
CREATE POLICY "Enable write access for admins on system_settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

DROP POLICY IF EXISTS "Enable read access for authenticated on system_setting_versions" ON public.system_setting_versions;
CREATE POLICY "Enable read access for authenticated on system_setting_versions"
  ON public.system_setting_versions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated on system_setting_versions" ON public.system_setting_versions;
CREATE POLICY "Enable insert for authenticated on system_setting_versions"
  ON public.system_setting_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Seed Parameters
INSERT INTO public.system_settings (categoria, chave, valor, tipo, descricao, valor_padrao, sensivel) VALUES
  -- Marketplace
  ('Marketplace', 'tempo_maximo_aceite', '60'::jsonb, 'integer', 'Tempo máximo em segundos para o prestador aceitar uma solicitação', '60'::jsonb, false),
  ('Marketplace', 'tempo_cancelamento', '300'::jsonb, 'integer', 'Janela de cancelamento grátis pelo tomador em segundos', '300'::jsonb, false),
  ('Marketplace', 'taxa_cancelamento', '5.00'::jsonb, 'decimal', 'Taxa cobrada em R$ em caso de cancelamento tardio', '5.00'::jsonb, false),
  ('Marketplace', 'raio_busca', '15'::jsonb, 'integer', 'Raio de busca inicial de prestadores em quilômetros', '15'::jsonb, false),
  ('Marketplace', 'distancia_maxima', '50'::jsonb, 'integer', 'Distância máxima de deslocamento atendida em km', '50'::jsonb, false),

  -- Financeiro
  ('Financeiro', 'taxa_ubt', '0.04'::jsonb, 'decimal', 'Percentual de comissão UBT retido em cada transação (4%)', '0.04'::jsonb, false),
  ('Financeiro', 'premio_consumidor', '0.01'::jsonb, 'decimal', 'Percentual destinado ao sorteio mensal de consumidores (1%)', '0.01'::jsonb, false),
  ('Financeiro', 'premio_prestador', '0.01'::jsonb, 'decimal', 'Percentual destinado ao sorteio mensal de trabalhadores (1%)', '0.01'::jsonb, false),
  ('Financeiro', 'percentual_associacao', '0.005'::jsonb, 'decimal', 'Percentual repassado às associações parceiras (0.5%)', '0.005'::jsonb, false),
  ('Financeiro', 'valor_minimo_payout', '10.00'::jsonb, 'decimal', 'Valor mínimo em R$ para solicitação de saque', '10.00'::jsonb, false),
  ('Financeiro', 'valor_maximo_payout', '5000.00'::jsonb, 'decimal', 'Limite diário de payout por prestador em R$', '5000.00'::jsonb, true),
  ('Financeiro', 'dias_payout', '1'::jsonb, 'integer', 'Prazo de liquidação em dias úteis para saques', '1'::jsonb, false),

  -- Mototáxi
  ('Mototaxi', 'tempo_busca_motorista', '120'::jsonb, 'integer', 'Tempo máximo de tentativa de pareamento em segundos', '120'::jsonb, false),
  ('Mototaxi', 'aceitar_viagens_intermunicipais', 'true'::jsonb, 'boolean', 'Permitir corridas iniciando ou terminando fora de Ubatuba', 'true'::jsonb, false),
  ('Mototaxi', 'origem_ubatuba_obrigatoria', 'true'::jsonb, 'boolean', 'Exigir que a origem do passageiro esteja no município de Ubatuba', 'true'::jsonb, false),
  ('Mototaxi', 'destino_ubatuba_obrigatorio', 'false'::jsonb, 'boolean', 'Exigir que o destino do passageiro esteja no município de Ubatuba', 'false'::jsonb, false),

  -- LGPD
  ('LGPD', 'dias_retencao_logs', '180'::jsonb, 'integer', 'Prazo de conservação legal de audit logs em dias', '180'::jsonb, false),
  ('LGPD', 'dias_retencao_gps', '30'::jsonb, 'integer', 'Prazo de conservação do histórico de coordenadas em dias', '30'::jsonb, false),
  ('LGPD', 'permitir_exportacao', 'true'::jsonb, 'boolean', 'Habilitar download de dados pessoais no PWA', 'true'::jsonb, false),
  ('LGPD', 'permitir_exclusao', 'true'::jsonb, 'boolean', 'Habilitar solicitação de auto-exclusão de conta', 'true'::jsonb, false),

  -- Telemetria
  ('Telemetria', 'intervalo_gps', '5'::jsonb, 'integer', 'Intervalo de envio de sinal GPS em segundos', '5'::jsonb, false),
  ('Telemetria', 'velocidade_maxima', '120'::jsonb, 'integer', 'Alerta de velocidade excessiva em km/h', '120'::jsonb, false),
  ('Telemetria', 'distancia_alerta', '1000'::jsonb, 'integer', 'Distância em metros para alerta de proximidade de parada', '1000'::jsonb, false),

  -- Analytics
  ('Analytics', 'ativar_eventos', 'true'::jsonb, 'boolean', 'Ativar captura de eventos analíticos de tela', 'true'::jsonb, false),
  ('Analytics', 'ativar_funil', 'true'::jsonb, 'boolean', 'Mapear funil de conversão no PWA', 'true'::jsonb, false),
  ('Analytics', 'ativar_heatmap', 'false'::jsonb, 'boolean', 'Habilitar rastreamento de cliques e calor', 'false'::jsonb, false),

  -- Feature Flags
  ('Feature Flags', 'novo_checkout', 'true'::jsonb, 'boolean', 'Habilitar novo fluxo de checkout com Pix instantâneo', 'true'::jsonb, false),
  ('Feature Flags', 'novo_chat', 'false'::jsonb, 'boolean', 'Habilitar mensageria interna em tempo real', 'false'::jsonb, false),
  ('Feature Flags', 'novo_kyc', 'true'::jsonb, 'boolean', 'Habilitar OCR e análise automática de CNH/Documentos', 'true'::jsonb, false),
  ('Feature Flags', 'novo_dashboard', 'true'::jsonb, 'boolean', 'Exibir Centro de Controle Operacional v1.0', 'true'::jsonb, false),
  ('Feature Flags', 'novo_algoritmo_match', 'false'::jsonb, 'boolean', 'Ativar despacho inteligente por menor tempo estimado de chegada', 'false'::jsonb, false),

  -- Notificações
  ('Notificacoes', 'push_ativo', 'true'::jsonb, 'boolean', 'Disparo de notificações Push (Web Push / Firebase)', 'true'::jsonb, false),
  ('Notificacoes', 'email_ativo', 'true'::jsonb, 'boolean', 'Disparo de e-mails transacionais (Resend / SMTP)', 'true'::jsonb, false),
  ('Notificacoes', 'whatsapp_ativo', 'true'::jsonb, 'boolean', 'Envio de confirmações de corridas via WhatsApp', 'true'::jsonb, false),
  ('Notificacoes', 'sms_ativo', 'false'::jsonb, 'boolean', 'Envio de códigos OTP por SMS', 'false'::jsonb, false),
  ('Notificacoes', 'retry_maximo', '3'::jsonb, 'integer', 'Número máximo de tentativas de reenvio de notificações', '3'::jsonb, false),
  ('Notificacoes', 'retry_intervalo', '60'::jsonb, 'integer', 'Intervalo em segundos entre tentativas de retry', '60'::jsonb, false),

  -- Comunicação
  ('Comunicacao', 'banner_home', '"Bem-vindo ao UBT SuperApp — O App Oficial de Ubatuba!"'::jsonb, 'string', 'Mensagem de boas-vindas exibida na Home do PWA', '"Bem-vindo ao UBT SuperApp — O App Oficial de Ubatuba!"'::jsonb, false),
  ('Comunicacao', 'popup_ativo', 'false'::jsonb, 'boolean', 'Exibir modal de alerta promocional no PWA', 'false'::jsonb, false),
  ('Comunicacao', 'popup_texto', '""'::jsonb, 'string', 'Texto do popup institucional', '""'::jsonb, false),

  -- Sistema
  ('Sistema', 'cor_primaria', '"#0DB87E"'::jsonb, 'cor', 'Cor primária da marca UBT em HEX', '"#0DB87E"'::jsonb, false),
  ('Sistema', 'versao_minima_pwa', '"1.0.0"'::jsonb, 'string', 'Versão mínima do cliente PWA compatível', '"1.0.0"'::jsonb, false),
  ('Sistema', 'modo_manutencao', 'false'::jsonb, 'boolean', 'Ativar tela de manutenção preventiva global', 'false'::jsonb, true)
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, sensivel = EXCLUDED.sensivel;

-- 6. RPC update_system_setting
CREATE OR REPLACE FUNCTION update_system_setting(
  p_chave text,
  p_novo_valor jsonb,
  p_user_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_setting public.system_settings%ROWTYPE;
  v_real_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_new_version integer;
BEGIN

  SELECT * INTO v_setting FROM public.system_settings WHERE chave = p_chave;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração com chave % não encontrada.', p_chave;
  END IF;

  IF NOT v_setting.editavel THEN
    RAISE EXCEPTION 'A configuração % é marcada como não editável.', p_chave;
  END IF;

  v_new_version := v_setting.versao + 1;

  -- Insert into version history
  INSERT INTO public.system_setting_versions (setting_id, chave, valor, versao, updated_by, motivo)
  VALUES (v_setting.id, v_setting.chave, v_setting.valor, v_setting.versao, v_real_user_id, p_motivo);

  -- Update main setting
  UPDATE public.system_settings
     SET valor = p_novo_valor,
         versao = v_new_version,
         updated_at = NOW(),
         updated_by = v_real_user_id
   WHERE id = v_setting.id;

  -- Audit log integration
  PERFORM log_admin_action(
    p_admin_id => v_real_user_id,
    p_acao => 'setting_updated',
    p_categoria => 'Configuracoes',
    p_modulo => 'Configuration Center',
    p_entidade => 'system_settings',
    p_registro_id => v_setting.id::text,
    p_valor_anterior => v_setting.valor,
    p_valor_novo => p_novo_valor,
    p_motivo => p_motivo,
    p_criticidade => CASE WHEN v_setting.sensivel THEN 'ALTA' ELSE 'MEDIA' END,
    p_metadata => jsonb_build_object('chave', p_chave, 'versao', v_new_version)
  );

  RETURN jsonb_build_object(
    'success', true,
    'chave', p_chave,
    'valor', p_novo_valor,
    'versao', v_new_version
  );
END;
$$;

-- 7. RPC rollback_system_setting
CREATE OR REPLACE FUNCTION rollback_system_setting(
  p_setting_id uuid,
  p_versao integer,
  p_user_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hist public.system_setting_versions%ROWTYPE;
BEGIN

  SELECT * INTO v_hist
    FROM public.system_setting_versions
   WHERE setting_id = p_setting_id AND versao = p_versao;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão % do parâmetro não encontrada no histórico.', p_versao;
  END IF;

  RETURN update_system_setting(
    p_chave => v_hist.chave,
    p_novo_valor => v_hist.valor,
    p_user_id => p_user_id,
    p_motivo => COALESCE(p_motivo, FORMAT('Rollback para versão %s', p_versao))
  );
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION update_system_setting(text, jsonb, uuid, text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION rollback_system_setting(uuid, integer, uuid, text) TO authenticated, service_role, anon;
