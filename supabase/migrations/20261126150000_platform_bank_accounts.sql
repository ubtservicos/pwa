-- Migration: 20261126150000_platform_bank_accounts.sql
-- Purpose:
--   1. Ensure Super Admin / Admin can read public.marketplace_accounts and public.marketplace_oauth_connections.
--   2. Create public.platform_bank_accounts for multi-account UBT bank & PIX management.
--   3. Create audited SECURITY DEFINER RPCs for upsert, set-primary, and toggle-active,
--      auto-syncing public.system_settings (ubt_pix_key / ubt_pix_tipo) and public.usuarios (ubt.servicos@gmail.com).
--   4. Seed initial primary UBT Mercado Pago account (idempotent).

-- 1. Admin SELECT policies for OAuth visibility in /admin/clientes/:id
DROP POLICY IF EXISTS "Admin read marketplace_accounts" ON public.marketplace_accounts;
CREATE POLICY "Admin read marketplace_accounts"
  ON public.marketplace_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin());

DROP POLICY IF EXISTS "Admin read marketplace_oauth_connections" ON public.marketplace_oauth_connections;
CREATE POLICY "Admin read marketplace_oauth_connections"
  ON public.marketplace_oauth_connections
  FOR SELECT
  TO authenticated
  USING (public.is_current_usuario(user_id) OR is_admin() OR is_superadmin());

-- 2. Table: public.platform_bank_accounts
CREATE TABLE IF NOT EXISTS public.platform_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apelido text NOT NULL,
  instituicao text NOT NULL,
  titular_nome text NOT NULL,
  titular_documento text NOT NULL,
  tipo_chave_pix text NOT NULL CHECK (tipo_chave_pix IN ('cnpj', 'cpf', 'email', 'telefone', 'aleatoria')),
  chave_pix text NOT NULL,
  finalidade text NOT NULL DEFAULT 'principal_recebimento'
    CHECK (finalidade IN ('principal_recebimento', 'fundo_comunidade', 'fundo_premios', 'reserva_operacional', 'outro')),
  mp_user_id text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only ONE active primary account at any time
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_bank_accounts_single_primary
  ON public.platform_bank_accounts (is_primary)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_platform_bank_accounts_finalidade
  ON public.platform_bank_accounts (finalidade, is_active);

ALTER TABLE public.platform_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin_Full_Access_Platform_Bank_Accounts" ON public.platform_bank_accounts;
CREATE POLICY "Admin_Full_Access_Platform_Bank_Accounts"
  ON public.platform_bank_accounts
  FOR ALL
  TO authenticated
  USING (is_admin() OR is_superadmin())
  WITH CHECK (is_admin() OR is_superadmin());

-- Helper to sync primary UBT PIX key into system_settings & UBT superadmin user
CREATE OR REPLACE FUNCTION public._sync_primary_ubt_pix(p_chave_pix text, p_tipo_chave_pix text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_settings (categoria, chave, valor, tipo, descricao, valor_padrao, editavel, sensivel, versao)
  VALUES
    ('Financeiro', 'ubt_pix_key', to_jsonb(p_chave_pix), 'string', 'Chave PIX oficial da plataforma UBT', to_jsonb(p_chave_pix), true, false, 1),
    ('Financeiro', 'ubt_pix_tipo', to_jsonb(p_tipo_chave_pix), 'string', 'Tipo da chave PIX oficial da plataforma UBT', to_jsonb(p_tipo_chave_pix), true, false, 1)
  ON CONFLICT (chave) DO UPDATE SET
    valor = EXCLUDED.valor,
    updated_at = now();

  UPDATE public.usuarios
  SET chave_pix = p_chave_pix,
      tipo_chave_pix = p_tipo_chave_pix
  WHERE lower(email) = 'ubt.servicos@gmail.com';
END;
$$;

-- 3. RPC: admin_upsert_platform_bank_account
CREATE OR REPLACE FUNCTION public.admin_upsert_platform_bank_account(
  p_id uuid DEFAULT NULL,
  p_apelido text DEFAULT NULL,
  p_instituicao text DEFAULT NULL,
  p_titular_nome text DEFAULT NULL,
  p_titular_documento text DEFAULT NULL,
  p_tipo_chave_pix text DEFAULT 'cnpj',
  p_chave_pix text DEFAULT NULL,
  p_finalidade text DEFAULT 'principal_recebimento',
  p_mp_user_id text DEFAULT NULL,
  p_is_primary boolean DEFAULT false,
  p_is_active boolean DEFAULT true,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tipo text := lower(trim(coalesce(p_tipo_chave_pix, 'cnpj')));
  v_fin text := lower(trim(coalesce(p_finalidade, 'principal_recebimento')));
  v_chave text := trim(coalesce(p_chave_pix, ''));
  v_row public.platform_bank_accounts%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT (is_admin() OR is_superadmin()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerenciar contas UBT.';
  END IF;

  IF v_tipo IN ('evp', 'random', 'chave_aleatoria', 'aleatória') THEN
    v_tipo := 'aleatoria';
  END IF;
  IF v_tipo NOT IN ('cnpj', 'cpf', 'email', 'telefone', 'aleatoria') THEN
    RAISE EXCEPTION 'Tipo de chave PIX inválido: %', v_tipo;
  END IF;
  IF v_fin NOT IN ('principal_recebimento', 'fundo_comunidade', 'fundo_premios', 'reserva_operacional', 'outro') THEN
    RAISE EXCEPTION 'Finalidade inválida: %', v_fin;
  END IF;
  IF length(trim(coalesce(p_apelido, ''))) < 2 OR length(v_chave) < 3 THEN
    RAISE EXCEPTION 'Apelido e Chave PIX são obrigatórios.';
  END IF;

  IF p_is_primary AND p_is_active THEN
    UPDATE public.platform_bank_accounts
    SET is_primary = false, updated_at = now()
    WHERE is_primary = true AND (p_id IS NULL OR id <> p_id);
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.platform_bank_accounts
    SET
      apelido = trim(p_apelido),
      instituicao = trim(coalesce(p_instituicao, instituicao)),
      titular_nome = trim(coalesce(p_titular_nome, titular_nome)),
      titular_documento = trim(coalesce(p_titular_documento, titular_documento)),
      tipo_chave_pix = v_tipo,
      chave_pix = v_chave,
      finalidade = v_fin,
      mp_user_id = nullif(trim(coalesce(p_mp_user_id, '')), ''),
      is_primary = CASE WHEN p_is_active THEN coalesce(p_is_primary, false) ELSE false END,
      is_active = coalesce(p_is_active, true),
      observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.platform_bank_accounts (
      apelido, instituicao, titular_nome, titular_documento,
      tipo_chave_pix, chave_pix, finalidade, mp_user_id,
      is_primary, is_active, observacoes, updated_at
    )
    VALUES (
      trim(p_apelido),
      trim(coalesce(p_instituicao, 'Mercado Pago (323)')),
      trim(coalesce(p_titular_nome, 'UBT Plataforma Digital Ltda')),
      trim(coalesce(p_titular_documento, '68.394.558/0001-32')),
      v_tipo,
      v_chave,
      v_fin,
      nullif(trim(coalesce(p_mp_user_id, '')), ''),
      CASE WHEN coalesce(p_is_active, true) THEN coalesce(p_is_primary, false) ELSE false END,
      coalesce(p_is_active, true),
      nullif(trim(coalesce(p_observacoes, '')), ''),
      now()
    )
    RETURNING * INTO v_row;
  END IF;

  IF v_row.is_primary AND v_row.is_active THEN
    PERFORM public._sync_primary_ubt_pix(v_row.chave_pix, v_row.tipo_chave_pix);
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_caller,
    CASE WHEN p_id IS NULL THEN 'create_platform_bank_account' ELSE 'update_platform_bank_account' END,
    'platform_bank_account',
    v_row.id::text,
    jsonb_build_object('apelido', v_row.apelido, 'finalidade', v_row.finalidade, 'tipo_chave_pix', v_row.tipo_chave_pix, 'is_primary', v_row.is_primary, 'is_active', v_row.is_active)
  );

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_platform_bank_account(uuid, text, text, text, text, text, text, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_platform_bank_account(uuid, text, text, text, text, text, text, text, text, boolean, boolean, text) TO authenticated;

-- 4. RPC: admin_set_primary_platform_bank_account
CREATE OR REPLACE FUNCTION public.admin_set_primary_platform_bank_account(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.platform_bank_accounts%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT (is_admin() OR is_superadmin()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.platform_bank_accounts
  SET is_primary = false, updated_at = now()
  WHERE is_primary = true AND id <> p_account_id;

  UPDATE public.platform_bank_accounts
  SET is_primary = true, is_active = true, updated_at = now()
  WHERE id = p_account_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada.';
  END IF;

  PERFORM public._sync_primary_ubt_pix(v_row.chave_pix, v_row.tipo_chave_pix);

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_caller,
    'set_primary_platform_bank_account',
    'platform_bank_account',
    v_row.id::text,
    jsonb_build_object('apelido', v_row.apelido, 'chave_pix', v_row.chave_pix, 'tipo_chave_pix', v_row.tipo_chave_pix)
  );

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_primary_platform_bank_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_primary_platform_bank_account(uuid) TO authenticated;

-- 5. RPC: admin_toggle_platform_bank_account
CREATE OR REPLACE FUNCTION public.admin_toggle_platform_bank_account(p_account_id uuid, p_is_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row public.platform_bank_accounts%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT (is_admin() OR is_superadmin()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.platform_bank_accounts
  SET
    is_active = p_is_active,
    is_primary = CASE WHEN p_is_active = false THEN false ELSE is_primary END,
    updated_at = now()
  WHERE id = p_account_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada.';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_caller,
    'toggle_platform_bank_account',
    'platform_bank_account',
    v_row.id::text,
    jsonb_build_object('apelido', v_row.apelido, 'is_active', v_row.is_active)
  );

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_platform_bank_account(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_platform_bank_account(uuid, boolean) TO authenticated;

-- 6. Idempotent Seed of Official Primary UBT Account
INSERT INTO public.platform_bank_accounts (
  apelido, instituicao, titular_nome, titular_documento,
  tipo_chave_pix, chave_pix, finalidade, mp_user_id,
  is_primary, is_active, observacoes
)
SELECT
  'Conta Principal UBT (Mercado Pago)',
  'Mercado Pago (323)',
  'UBT Plataforma Digital Ltda',
  '68.394.558/0001-32',
  'cnpj',
  '68.394.558/0001-32',
  'principal_recebimento',
  NULL,
  true,
  true,
  'Conta oficial de recebimento e split da plataforma UBT.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_bank_accounts WHERE chave_pix = '68.394.558/0001-32'
);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
