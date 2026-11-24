-- ============================================================================
-- UBT Homologacao: Mototaxi Payments, Fee Pass-Through, Card Wallet & RLS
-- Idempotent migration for project xqujubbqcfqxkfczbidq
-- ============================================================================

-- 1. Gateway payment method fees in system_settings (paid by Tomador)
INSERT INTO public.system_settings (
  categoria,
  chave,
  valor,
  tipo,
  descricao,
  valor_padrao,
  editavel,
  sensivel
)
VALUES
  (
    'Financeiro',
    'taxa_pix',
    to_jsonb(0.99::numeric),
    'decimal',
    'Taxa percentual de processamento PIX (Mercado Pago) arcada pelo Tomador (%)',
    to_jsonb(0.99::numeric),
    true,
    false
  ),
  (
    'Financeiro',
    'taxa_cartao',
    to_jsonb(4.98::numeric),
    'decimal',
    'Taxa percentual de processamento Cartao de Credito (Mercado Pago) arcada pelo Tomador (%)',
    to_jsonb(4.98::numeric),
    true,
    false
  )
ON CONFLICT (chave) DO NOTHING;

-- 2. Fee transparency columns on pagamentos_split
ALTER TABLE public.pagamentos_split
  ADD COLUMN IF NOT EXISTS base_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_method_fee_pct numeric(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_fee_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- 3. Secure Mercado Pago Customer Wallet mapping (linked to auth.uid())
CREATE TABLE IF NOT EXISTS public.mp_customer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  collector_scope text NOT NULL DEFAULT 'platform',
  mp_customer_id text NOT NULL,
  mp_customer_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment, collector_scope)
);

CREATE INDEX IF NOT EXISTS idx_mp_customer_wallets_user_env
  ON public.mp_customer_wallets (user_id, environment);

ALTER TABLE public.mp_customer_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read own mp_customer_wallets" ON public.mp_customer_wallets;
CREATE POLICY "Owner read own mp_customer_wallets"
  ON public.mp_customer_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role full access mp_customer_wallets" ON public.mp_customer_wallets;
CREATE POLICY "service_role full access mp_customer_wallets"
  ON public.mp_customer_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.mp_customer_wallets TO authenticated;
GRANT ALL ON public.mp_customer_wallets TO service_role;

-- 4. Harden RLS on public.mototaxi_corridas (remove open OR true policies and block client paid promotion)
ALTER TABLE public.mototaxi_corridas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de corridas" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "Permitir atualizacao de corridas" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "Permitir criacao de corridas" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "Acesso a corridas próprias ou em busca ou admin" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "mototaxi_corridas_select_policy" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "mototaxi_corridas_insert_policy" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "mototaxi_corridas_update_policy" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "mototaxi_corridas_service_policy" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "mototaxi_corridas_service_role_all" ON public.mototaxi_corridas;

CREATE POLICY "mototaxi_corridas_select_policy"
  ON public.mototaxi_corridas
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = tomador_id
    OR auth.uid() = prestador_id
    OR status = 'searching'
    OR public.is_admin()
  );

CREATE POLICY "mototaxi_corridas_insert_policy"
  ON public.mototaxi_corridas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = tomador_id
    AND status = 'searching'
  );

CREATE POLICY "mototaxi_corridas_update_policy"
  ON public.mototaxi_corridas
  FOR UPDATE
  TO authenticated
  USING (
    (status = 'searching' AND prestador_id IS NULL)
    OR auth.uid() = tomador_id
    OR auth.uid() = prestador_id
    OR public.is_admin()
  )
  WITH CHECK (
    (
      auth.uid() = tomador_id
      OR auth.uid() = prestador_id
      OR public.is_admin()
    )
    AND status <> 'paid'
  );

CREATE POLICY "mototaxi_corridas_service_role_all"
  ON public.mototaxi_corridas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Harden RLS on public.pagamentos_split (remove open authenticated INSERT)
DROP POLICY IF EXISTS "Inserção de splits por usuários autenticados" ON public.pagamentos_split;

-- 6. Reload PostgREST schema & config cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
