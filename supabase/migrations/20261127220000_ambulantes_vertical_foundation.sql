-- ============================================================================
-- Migration: 20261127220000_ambulantes_vertical_foundation.sql
-- Release: v1.10.0-ambulantes-core-db-and-edge-functions (Fase 1 de 3 — Ambulantes)
-- Goals:
--   1) Critical RLS lockdown on fornecedores_padrao, produtos_padrao,
--      estoque_ambulante and storage bucket 'catalogo-ambulantes'.
--   2) Create canonical KYC/profile table public.prestador_ambulante,
--      version & harden ambulante_sessions, pedidos, pedido_itens,
--      create ambulante_mensagens & ambulante_avaliacoes, and extend
--      public.associations with praias_atuacao text[].
--   3) Create SECURITY DEFINER RPCs for KYC/profile, individual delivery_fee,
--      atomic stock confirmation/cancellation, financial history/admin queries,
--      and Ambulantes Association management (categoria = 'ambulante').
-- ============================================================================

-- ============================================================================
-- A) CORREÇÃO CRÍTICA DE SEGURANÇA (RLS) — PRIORIDADE MÁXIMA
-- ============================================================================

ALTER TABLE public.fornecedores_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_ambulante ENABLE ROW LEVEL SECURITY;

-- 1. public.fornecedores_padrao (leitura pública; escrita exclusiva Admin/Superadmin)
DROP POLICY IF EXISTS "Permitir escrita de fornecedores_padrao para admin/autenticado" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "Permitir leitura publica de fornecedores_padrao" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "fornecedores_padrao_select_public" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "fornecedores_padrao_insert_admin" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "fornecedores_padrao_update_admin" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "fornecedores_padrao_delete_admin" ON public.fornecedores_padrao;
DROP POLICY IF EXISTS "fornecedores_padrao_service_role_all" ON public.fornecedores_padrao;

CREATE POLICY "fornecedores_padrao_select_public"
  ON public.fornecedores_padrao
  FOR SELECT
  USING (true);

CREATE POLICY "fornecedores_padrao_insert_admin"
  ON public.fornecedores_padrao
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "fornecedores_padrao_update_admin"
  ON public.fornecedores_padrao
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "fornecedores_padrao_delete_admin"
  ON public.fornecedores_padrao
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "fornecedores_padrao_service_role_all"
  ON public.fornecedores_padrao
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. public.produtos_padrao (leitura pública; escrita exclusiva Admin/Superadmin)
DROP POLICY IF EXISTS "Permitir escrita de produtos_padrao para admin/autenticado" ON public.produtos_padrao;
DROP POLICY IF EXISTS "Permitir leitura publica de produtos_padrao" ON public.produtos_padrao;
DROP POLICY IF EXISTS "produtos_padrao_select_public" ON public.produtos_padrao;
DROP POLICY IF EXISTS "produtos_padrao_insert_admin" ON public.produtos_padrao;
DROP POLICY IF EXISTS "produtos_padrao_update_admin" ON public.produtos_padrao;
DROP POLICY IF EXISTS "produtos_padrao_delete_admin" ON public.produtos_padrao;
DROP POLICY IF EXISTS "produtos_padrao_service_role_all" ON public.produtos_padrao;

CREATE POLICY "produtos_padrao_select_public"
  ON public.produtos_padrao
  FOR SELECT
  USING (true);

CREATE POLICY "produtos_padrao_insert_admin"
  ON public.produtos_padrao
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "produtos_padrao_update_admin"
  ON public.produtos_padrao
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "produtos_padrao_delete_admin"
  ON public.produtos_padrao
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "produtos_padrao_service_role_all"
  ON public.produtos_padrao
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. public.estoque_ambulante (leitura pública para vitrine; escrita exclusiva do próprio ambulante ou Admin)
DROP POLICY IF EXISTS "Permitir gerenciar estoque_ambulante" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "Permitir leitura publica de estoque_ambulante" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "estoque_ambulante_select_public" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "estoque_ambulante_insert_owner_or_admin" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "estoque_ambulante_update_owner_or_admin" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "estoque_ambulante_delete_owner_or_admin" ON public.estoque_ambulante;
DROP POLICY IF EXISTS "estoque_ambulante_service_role_all" ON public.estoque_ambulante;

CREATE POLICY "estoque_ambulante_select_public"
  ON public.estoque_ambulante
  FOR SELECT
  USING (true);

CREATE POLICY "estoque_ambulante_insert_owner_or_admin"
  ON public.estoque_ambulante
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id_ambulante
    OR public.is_current_usuario(id_ambulante)
    OR public.is_admin()
  );

CREATE POLICY "estoque_ambulante_update_owner_or_admin"
  ON public.estoque_ambulante
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id_ambulante
    OR public.is_current_usuario(id_ambulante)
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id_ambulante
    OR public.is_current_usuario(id_ambulante)
    OR public.is_admin()
  );

CREATE POLICY "estoque_ambulante_delete_owner_or_admin"
  ON public.estoque_ambulante
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = id_ambulante
    OR public.is_current_usuario(id_ambulante)
    OR public.is_admin()
  );

CREATE POLICY "estoque_ambulante_service_role_all"
  ON public.estoque_ambulante
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. storage.objects bucket 'catalogo-ambulantes' (leitura pública; escrita exclusiva Admin/Superadmin)
DROP POLICY IF EXISTS "Public Access catalogo-ambulantes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Catalogo Ambulantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated and Admin Upload catalogo-ambulantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated and Admin Update catalogo-ambulantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated and Admin Delete catalogo-ambulantes" ON storage.objects;
DROP POLICY IF EXISTS "catalogo_ambulantes_select_public" ON storage.objects;
DROP POLICY IF EXISTS "catalogo_ambulantes_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "catalogo_ambulantes_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "catalogo_ambulantes_delete_admin" ON storage.objects;

CREATE POLICY "catalogo_ambulantes_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'catalogo-ambulantes');

CREATE POLICY "catalogo_ambulantes_insert_admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'catalogo-ambulantes' AND public.is_admin());

CREATE POLICY "catalogo_ambulantes_update_admin"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'catalogo-ambulantes' AND public.is_admin())
  WITH CHECK (bucket_id = 'catalogo-ambulantes' AND public.is_admin());

CREATE POLICY "catalogo_ambulantes_delete_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'catalogo-ambulantes' AND public.is_admin());

-- ============================================================================
-- B) TABELAS CORE VERSIONADAS E BLINDADAS (AMBULANTES)
-- ============================================================================

-- 1. public.prestador_ambulante (tabela canônica de KYC/Perfil de Ambulantes)
CREATE TABLE IF NOT EXISTS public.prestador_ambulante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome_comercial text NOT NULL,
  cpf text,
  telefone text,
  chave_pix text,
  modalidades text[] NOT NULL DEFAULT ARRAY['entrega'::text, 'retirada'::text],
  praia_referencia text,
  ponto_referencia text,
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
  rg_cnh_frente_url text,
  rg_cnh_verso_url text,
  selfie_url text,
  kyc_status text NOT NULL DEFAULT 'pending',
  kyc_notes text,
  is_online boolean NOT NULL DEFAULT false,
  location jsonb,
  -- Selos descritivos de confiança (opcionais / NÃO impeditivos)
  possui_alvara boolean DEFAULT false,
  alvara_numero text,
  alvara_validade date,
  alvara_photo_url text,
  alvara_verificado boolean DEFAULT false,
  possui_vigilancia_sanitaria boolean DEFAULT false,
  vigilancia_photo_url text,
  tipo_estrutura text,
  estrutura_photo_url text,
  mei_cnpj text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prestador_ambulante_delivery_fee_check CHECK (delivery_fee >= 0),
  CONSTRAINT prestador_ambulante_kyc_status_check CHECK (
    kyc_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])
  ),
  CONSTRAINT prestador_ambulante_tipo_estrutura_check CHECK (
    tipo_estrutura IS NULL OR tipo_estrutura = ANY (ARRAY['carrinho'::text, 'barraca'::text, 'isopor'::text, 'ponto_fixo'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_prestador_ambulante_kyc_status
  ON public.prestador_ambulante (kyc_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestador_ambulante_online
  ON public.prestador_ambulante (is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_prestador_ambulante_praia
  ON public.prestador_ambulante (praia_referencia);

ALTER TABLE public.prestador_ambulante ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prestador_ambulante_select_policy" ON public.prestador_ambulante;
CREATE POLICY "prestador_ambulante_select_policy"
  ON public.prestador_ambulante
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_usuario(user_id)
    OR kyc_status = 'approved'
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "prestador_ambulante_insert_policy" ON public.prestador_ambulante;
CREATE POLICY "prestador_ambulante_insert_policy"
  ON public.prestador_ambulante
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_usuario(user_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "prestador_ambulante_update_policy" ON public.prestador_ambulante;
CREATE POLICY "prestador_ambulante_update_policy"
  ON public.prestador_ambulante
  FOR UPDATE
  TO authenticated
  USING (
    public.is_current_usuario(user_id)
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_current_usuario(user_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "prestador_ambulante_service_role_all" ON public.prestador_ambulante;
CREATE POLICY "prestador_ambulante_service_role_all"
  ON public.prestador_ambulante
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger de sync KYC (usuarios + profiles + kyc_profiles)
CREATE OR REPLACE FUNCTION public.sync_ambulante_kyc_status()
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

    -- Sincroniza espelho em public.kyc_profiles (best-effort)
    BEGIN
      UPDATE public.kyc_profiles
      SET
        document_number = COALESCE(NULLIF(BTRIM(NEW.cpf), ''), document_number),
        document_type = COALESCE(document_type, 'CPF'),
        status = NEW.kyc_status,
        notes = NEW.kyc_notes,
        updated_at = now()
      WHERE user_id = NEW.user_id;

      IF NOT FOUND THEN
        INSERT INTO public.kyc_profiles (user_id, document_number, document_type, status, notes, created_at, updated_at)
        VALUES (NEW.user_id, NULLIF(BTRIM(NEW.cpf), ''), 'CPF', NEW.kyc_status, NEW.kyc_notes, now(), now());
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS on_ambulante_updated ON public.prestador_ambulante;
CREATE TRIGGER on_ambulante_updated
  BEFORE UPDATE ON public.prestador_ambulante
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_sync_ambulante_kyc ON public.prestador_ambulante;
CREATE TRIGGER trg_sync_ambulante_kyc
  AFTER INSERT OR UPDATE OR DELETE ON public.prestador_ambulante
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ambulante_kyc_status();

-- 2. Versionamento e endurecimento de public.ambulante_sessions
CREATE TABLE IF NOT EXISTS public.ambulante_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL,
  modalidade text DEFAULT 'entrega',
  lat double precision,
  lng double precision,
  address text,
  praia_referencia text,
  ponto_referencia text,
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
  is_online boolean NOT NULL DEFAULT false,
  rating numeric DEFAULT 5.0,
  total_pedidos integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ambulante_sessions
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS praia_referencia text,
  ADD COLUMN IF NOT EXISTS ponto_referencia text,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.ambulante_sessions
  DROP CONSTRAINT IF EXISTS ambulante_sessions_delivery_fee_check;
ALTER TABLE public.ambulante_sessions
  ADD CONSTRAINT ambulante_sessions_delivery_fee_check CHECK (delivery_fee >= 0);

CREATE INDEX IF NOT EXISTS idx_ambulante_sessions_prestador
  ON public.ambulante_sessions (prestador_id);
CREATE INDEX IF NOT EXISTS idx_ambulante_sessions_online
  ON public.ambulante_sessions (is_online) WHERE is_online = true;

ALTER TABLE public.ambulante_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública para ambulante_sessions" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "Modificação própria ou admin para ambulante_sessions" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "ambulante_sessions_select_public" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "ambulante_sessions_insert_approved_or_admin" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "ambulante_sessions_update_approved_or_admin" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "ambulante_sessions_delete_owner_or_admin" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "ambulante_sessions_service_role_all" ON public.ambulante_sessions;

CREATE POLICY "ambulante_sessions_select_public"
  ON public.ambulante_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "ambulante_sessions_insert_approved_or_admin"
  ON public.ambulante_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      (auth.uid() = prestador_id OR public.is_current_usuario(prestador_id))
      AND EXISTS (
        SELECT 1 FROM public.prestador_ambulante pa
        WHERE pa.user_id = prestador_id
          AND pa.kyc_status = 'approved'
      )
    )
  );

CREATE POLICY "ambulante_sessions_update_approved_or_admin"
  ON public.ambulante_sessions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = prestador_id
    OR public.is_current_usuario(prestador_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      (auth.uid() = prestador_id OR public.is_current_usuario(prestador_id))
      AND (
        is_online = false
        OR EXISTS (
          SELECT 1 FROM public.prestador_ambulante pa
          WHERE pa.user_id = prestador_id
            AND pa.kyc_status = 'approved'
        )
      )
    )
  );

CREATE POLICY "ambulante_sessions_delete_owner_or_admin"
  ON public.ambulante_sessions
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = prestador_id
    OR public.is_current_usuario(prestador_id)
  );

CREATE POLICY "ambulante_sessions_service_role_all"
  ON public.ambulante_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Versionamento e endurecimento de public.pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid,
  prestador_id uuid,
  session_id uuid,
  status text NOT NULL DEFAULT 'pending',
  modalidade text DEFAULT 'entrega',
  subtotal numeric(10, 2) DEFAULT 0.00,
  delivery_fee numeric(10, 2) DEFAULT 0.00,
  total numeric(10, 2) DEFAULT 0.00,
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_address text,
  delivery_referencia text,
  payment_method text,
  payment_status text,
  pix_payment_id text,
  pix_transaction_id text,
  pix_copy_paste text,
  pix_charge_status text,
  pix_charge_created_at timestamp with time zone,
  pix_charge_expires_at timestamp with time zone,
  pix_qr_code_base64 text,
  prestador_snapshot jsonb,
  cancel_reason text,
  confirmed_at timestamp with time zone,
  completed_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total numeric(10, 2),
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS pix_payment_id text,
  ADD COLUMN IF NOT EXISTS pix_transaction_id text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text,
  ADD COLUMN IF NOT EXISTS pix_charge_status text,
  ADD COLUMN IF NOT EXISTS pix_charge_created_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pix_charge_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS prestador_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'completed'::text, 'paid'::text, 'cancelled'::text]))
  NOT VALID;

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_payment_method_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['pix'::text, 'card'::text]))
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_pedidos_tomador_created ON public.pedidos (tomador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_prestador_created ON public.pedidos (prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_created ON public.pedidos (status, created_at DESC);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso a pedidos próprios ou admin" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_select_participant_or_admin" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_tomador_or_admin" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_participant_or_admin" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_service_role_all" ON public.pedidos;

CREATE POLICY "pedidos_select_participant_or_admin"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR public.is_admin()
  );

CREATE POLICY "pedidos_insert_tomador_or_admin"
  ON public.pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_current_usuario(tomador_id) OR public.is_admin())
    AND status = 'pending'
  );

CREATE POLICY "pedidos_update_participant_or_admin"
  ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (
    public.is_current_usuario(tomador_id)
    OR public.is_current_usuario(prestador_id)
    OR public.is_admin()
  )
  WITH CHECK (
    (public.is_current_usuario(tomador_id) OR public.is_current_usuario(prestador_id) OR public.is_admin())
    AND (status <> 'paid' OR public.is_admin())
  );

CREATE POLICY "pedidos_service_role_all"
  ON public.pedidos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Versionamento e endurecimento de public.pedido_itens
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id uuid,
  nome text,
  emoji text,
  qty integer NOT NULL DEFAULT 1,
  preco_unit numeric(10, 2) NOT NULL DEFAULT 0.00,
  subtotal numeric(10, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens (pedido_id);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso a itens de pedidos próprios ou admin" ON public.pedido_itens;
DROP POLICY IF EXISTS "pedido_itens_participant_or_admin" ON public.pedido_itens;
DROP POLICY IF EXISTS "pedido_itens_service_role_all" ON public.pedido_itens;

CREATE POLICY "pedido_itens_participant_or_admin"
  ON public.pedido_itens
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = pedido_itens.pedido_id
        AND (public.is_current_usuario(p.tomador_id) OR public.is_current_usuario(p.prestador_id))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = pedido_itens.pedido_id
        AND (public.is_current_usuario(p.tomador_id) OR public.is_current_usuario(p.prestador_id))
    )
  );

CREATE POLICY "pedido_itens_service_role_all"
  ON public.pedido_itens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Chat Real: public.ambulante_mensagens
CREATE TABLE IF NOT EXISTS public.ambulante_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role = ANY (ARRAY['tomador'::text, 'prestador'::text])),
  message_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambulante_mensagens_pedido_created
  ON public.ambulante_mensagens (pedido_id, created_at ASC);

ALTER TABLE public.ambulante_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ambulante_mensagens_select_policy" ON public.ambulante_mensagens;
CREATE POLICY "ambulante_mensagens_select_policy"
  ON public.ambulante_mensagens
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = ambulante_mensagens.pedido_id
        AND (public.is_current_usuario(p.tomador_id) OR public.is_current_usuario(p.prestador_id))
    )
  );

DROP POLICY IF EXISTS "ambulante_mensagens_insert_policy" ON public.ambulante_mensagens;
CREATE POLICY "ambulante_mensagens_insert_policy"
  ON public.ambulante_mensagens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_usuario(sender_id)
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = ambulante_mensagens.pedido_id
        AND (public.is_current_usuario(p.tomador_id) OR public.is_current_usuario(p.prestador_id))
    )
  );

DROP POLICY IF EXISTS "ambulante_mensagens_service_role_all" ON public.ambulante_mensagens;
CREATE POLICY "ambulante_mensagens_service_role_all"
  ON public.ambulante_mensagens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Avaliações Reais: public.ambulante_avaliacoes
CREATE TABLE IF NOT EXISTS public.ambulante_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  reviewed_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL CHECK (reviewer_role = ANY (ARRAY['tomador'::text, 'prestador'::text])),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_ambulante_avaliacao_pedido_reviewer UNIQUE (pedido_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_ambulante_avaliacoes_reviewed
  ON public.ambulante_avaliacoes (reviewed_id, created_at DESC);

ALTER TABLE public.ambulante_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ambulante_avaliacoes_select_policy" ON public.ambulante_avaliacoes;
CREATE POLICY "ambulante_avaliacoes_select_policy"
  ON public.ambulante_avaliacoes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ambulante_avaliacoes_insert_policy" ON public.ambulante_avaliacoes;
CREATE POLICY "ambulante_avaliacoes_insert_policy"
  ON public.ambulante_avaliacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_usuario(reviewer_id)
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = ambulante_avaliacoes.pedido_id
        AND (public.is_current_usuario(p.tomador_id) OR public.is_current_usuario(p.prestador_id))
    )
  );

DROP POLICY IF EXISTS "ambulante_avaliacoes_service_role_all" ON public.ambulante_avaliacoes;
CREATE POLICY "ambulante_avaliacoes_service_role_all"
  ON public.ambulante_avaliacoes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Associações da Orla: public.associations.praias_atuacao
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS praias_atuacao text[] NOT NULL DEFAULT '{}'::text[];

-- 8. Publicação no Supabase Realtime (idempotente)
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['ambulante_sessions', 'pedidos', 'ambulante_mensagens'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================================
-- C) RPCS SECURITY DEFINER (KYC, ESTOQUE ATÔMICO, FINANCEIRO E ASSOCIAÇÕES)
-- ============================================================================

-- 1. submit_ambulante_kyc(...)
CREATE OR REPLACE FUNCTION public.submit_ambulante_kyc(
  p_nome_comercial text,
  p_cpf text,
  p_telefone text,
  p_chave_pix text,
  p_modalidades text[] DEFAULT ARRAY['entrega'::text, 'retirada'::text],
  p_praia_referencia text DEFAULT NULL,
  p_ponto_referencia text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0.00,
  p_rg_cnh_frente_url text DEFAULT NULL,
  p_rg_cnh_verso_url text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_possui_alvara boolean DEFAULT false,
  p_alvara_numero text DEFAULT NULL,
  p_alvara_validade date DEFAULT NULL,
  p_alvara_photo_url text DEFAULT NULL,
  p_possui_vigilancia_sanitaria boolean DEFAULT false,
  p_vigilancia_photo_url text DEFAULT NULL,
  p_tipo_estrutura text DEFAULT NULL,
  p_estrutura_photo_url text DEFAULT NULL,
  p_mei_cnpj text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_fee numeric(10, 2);
  v_modalidades text[];
  v_tipo text;
  v_row public.prestador_ambulante%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_nome_comercial), '') IS NULL THEN
    RAISE EXCEPTION 'Nome comercial é obrigatório.' USING ERRCODE = '22023';
  END IF;

  v_fee := GREATEST(0, ROUND(COALESCE(p_delivery_fee, 0)::numeric, 2));
  v_modalidades := CASE
    WHEN p_modalidades IS NULL OR array_length(p_modalidades, 1) IS NULL
      THEN ARRAY['entrega'::text, 'retirada'::text]
    ELSE p_modalidades
  END;
  v_tipo := CASE
    WHEN NULLIF(BTRIM(p_tipo_estrutura), '') IS NULL THEN NULL
    WHEN lower(BTRIM(p_tipo_estrutura)) IN ('carrinho', 'barraca', 'isopor', 'ponto_fixo')
      THEN lower(BTRIM(p_tipo_estrutura))
    ELSE NULL
  END;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.usuarios (id, email, nome, telefone, cpf, chave_pix, role, status)
  VALUES (
    v_uid,
    COALESCE(v_email, v_uid::text || '@ubt.app'),
    BTRIM(p_nome_comercial),
    NULLIF(BTRIM(p_telefone), ''),
    NULLIF(BTRIM(p_cpf), ''),
    NULLIF(BTRIM(p_chave_pix), ''),
    'prestador',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    telefone = COALESCE(NULLIF(BTRIM(p_telefone), ''), public.usuarios.telefone),
    cpf = COALESCE(NULLIF(BTRIM(p_cpf), ''), public.usuarios.cpf),
    chave_pix = COALESCE(NULLIF(BTRIM(p_chave_pix), ''), public.usuarios.chave_pix),
    updated_at = now();

  INSERT INTO public.prestador_ambulante (
    user_id,
    nome_comercial,
    cpf,
    telefone,
    chave_pix,
    modalidades,
    praia_referencia,
    ponto_referencia,
    delivery_fee,
    rg_cnh_frente_url,
    rg_cnh_verso_url,
    selfie_url,
    kyc_status,
    possui_alvara,
    alvara_numero,
    alvara_validade,
    alvara_photo_url,
    possui_vigilancia_sanitaria,
    vigilancia_photo_url,
    tipo_estrutura,
    estrutura_photo_url,
    mei_cnpj
  ) VALUES (
    v_uid,
    BTRIM(p_nome_comercial),
    NULLIF(BTRIM(p_cpf), ''),
    NULLIF(BTRIM(p_telefone), ''),
    NULLIF(BTRIM(p_chave_pix), ''),
    v_modalidades,
    NULLIF(BTRIM(p_praia_referencia), ''),
    NULLIF(BTRIM(p_ponto_referencia), ''),
    v_fee,
    NULLIF(BTRIM(p_rg_cnh_frente_url), ''),
    NULLIF(BTRIM(p_rg_cnh_verso_url), ''),
    NULLIF(BTRIM(p_selfie_url), ''),
    'pending',
    COALESCE(p_possui_alvara, false),
    NULLIF(BTRIM(p_alvara_numero), ''),
    p_alvara_validade,
    NULLIF(BTRIM(p_alvara_photo_url), ''),
    COALESCE(p_possui_vigilancia_sanitaria, false),
    NULLIF(BTRIM(p_vigilancia_photo_url), ''),
    v_tipo,
    NULLIF(BTRIM(p_estrutura_photo_url), ''),
    NULLIF(BTRIM(p_mei_cnpj), '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome_comercial = EXCLUDED.nome_comercial,
    cpf = COALESCE(EXCLUDED.cpf, public.prestador_ambulante.cpf),
    telefone = COALESCE(EXCLUDED.telefone, public.prestador_ambulante.telefone),
    chave_pix = COALESCE(EXCLUDED.chave_pix, public.prestador_ambulante.chave_pix),
    modalidades = EXCLUDED.modalidades,
    praia_referencia = COALESCE(EXCLUDED.praia_referencia, public.prestador_ambulante.praia_referencia),
    ponto_referencia = COALESCE(EXCLUDED.ponto_referencia, public.prestador_ambulante.ponto_referencia),
    delivery_fee = EXCLUDED.delivery_fee,
    rg_cnh_frente_url = COALESCE(EXCLUDED.rg_cnh_frente_url, public.prestador_ambulante.rg_cnh_frente_url),
    rg_cnh_verso_url = COALESCE(EXCLUDED.rg_cnh_verso_url, public.prestador_ambulante.rg_cnh_verso_url),
    selfie_url = COALESCE(EXCLUDED.selfie_url, public.prestador_ambulante.selfie_url),
    kyc_status = CASE
      WHEN public.prestador_ambulante.kyc_status = 'approved' THEN 'approved'
      ELSE 'pending'
    END,
    possui_alvara = EXCLUDED.possui_alvara,
    alvara_numero = COALESCE(EXCLUDED.alvara_numero, public.prestador_ambulante.alvara_numero),
    alvara_validade = COALESCE(EXCLUDED.alvara_validade, public.prestador_ambulante.alvara_validade),
    alvara_photo_url = COALESCE(EXCLUDED.alvara_photo_url, public.prestador_ambulante.alvara_photo_url),
    possui_vigilancia_sanitaria = EXCLUDED.possui_vigilancia_sanitaria,
    vigilancia_photo_url = COALESCE(EXCLUDED.vigilancia_photo_url, public.prestador_ambulante.vigilancia_photo_url),
    tipo_estrutura = COALESCE(EXCLUDED.tipo_estrutura, public.prestador_ambulante.tipo_estrutura),
    estrutura_photo_url = COALESCE(EXCLUDED.estrutura_photo_url, public.prestador_ambulante.estrutura_photo_url),
    mei_cnpj = COALESCE(EXCLUDED.mei_cnpj, public.prestador_ambulante.mei_cnpj),
    updated_at = now()
  RETURNING * INTO v_row;

  -- Sincroniza taxa e referência caso já exista sessão criada
  UPDATE public.ambulante_sessions
  SET
    delivery_fee = v_row.delivery_fee,
    praia_referencia = COALESCE(v_row.praia_referencia, praia_referencia),
    ponto_referencia = COALESCE(v_row.ponto_referencia, ponto_referencia),
    updated_at = now()
  WHERE prestador_id = v_uid;

  RETURN to_jsonb(v_row);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_ambulante_kyc(
  text, text, text, text, text[], text, text, numeric, text, text, text,
  boolean, text, date, text, boolean, text, text, text, text
) TO authenticated;

-- 2. get_my_ambulante_profile()
CREATE OR REPLACE FUNCTION public.get_my_ambulante_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT to_jsonb(pa)
  FROM public.prestador_ambulante pa
  WHERE pa.user_id = auth.uid()
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_ambulante_profile() TO authenticated;

-- 3. update_my_ambulante_delivery_fee(p_delivery_fee numeric)
CREATE OR REPLACE FUNCTION public.update_my_ambulante_delivery_fee(
  p_delivery_fee numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fee numeric(10, 2);
  v_row public.prestador_ambulante%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
    RAISE EXCEPTION 'A taxa de entrega deve ser maior ou igual a zero.' USING ERRCODE = '22023';
  END IF;

  v_fee := ROUND(p_delivery_fee::numeric, 2);

  UPDATE public.prestador_ambulante
  SET delivery_fee = v_fee, updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de ambulante não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.ambulante_sessions
  SET delivery_fee = v_fee, updated_at = now()
  WHERE prestador_id = v_uid;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'delivery_fee', v_fee,
    'updated_at', v_row.updated_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_my_ambulante_delivery_fee(numeric) TO authenticated;

-- 4. Estoque Atômico: confirm_ambulante_order(p_pedido_id uuid)
CREATE OR REPLACE FUNCTION public.confirm_ambulante_order(
  p_pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_item record;
  v_stock record;
  v_snapshot jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (public.is_current_usuario(v_pedido.prestador_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Somente o ambulante atribuído pode confirmar este pedido.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.status <> 'pending' THEN
    RAISE EXCEPTION 'Pedido não está pendente de confirmação (status atual: %).', v_pedido.status USING ERRCODE = '22023';
  END IF;

  -- Verifica e decrementa atomicamente cada item em estoque_ambulante (FOR UPDATE)
  FOR v_item IN
    SELECT pi.produto_id, pi.nome, GREATEST(1, COALESCE(pi.qty, 1)) AS qty
    FROM public.pedido_itens pi
    WHERE pi.pedido_id = p_pedido_id
      AND pi.produto_id IS NOT NULL
    ORDER BY pi.produto_id ASC
  LOOP
    SELECT id, quantidade, disponivel
      INTO v_stock
      FROM public.estoque_ambulante
     WHERE id_ambulante = v_pedido.prestador_id
       AND id_produto_padrao = v_item.produto_id
     FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_stock.quantidade, 0) < v_item.qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para o item "%" (solicitado: %, disponível: %).',
        COALESCE(v_item.nome, v_item.produto_id::text),
        v_item.qty,
        COALESCE(v_stock.quantidade, 0)
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.estoque_ambulante
    SET
      quantidade = quantidade - v_item.qty,
      disponivel = CASE WHEN (quantidade - v_item.qty) <= 0 THEN false ELSE disponivel END,
      updated_at = now()
    WHERE id = v_stock.id;
  END LOOP;

  -- Captura snapshot de selos/estrutura do ambulante no momento da confirmação
  SELECT jsonb_build_object(
    'nome_comercial', pa.nome_comercial,
    'praia_referencia', pa.praia_referencia,
    'ponto_referencia', pa.ponto_referencia,
    'delivery_fee', pa.delivery_fee,
    'possui_alvara', COALESCE(pa.possui_alvara, false),
    'alvara_verificado', COALESCE(pa.alvara_verificado, false),
    'alvara_numero', pa.alvara_numero,
    'possui_vigilancia_sanitaria', COALESCE(pa.possui_vigilancia_sanitaria, false),
    'tipo_estrutura', pa.tipo_estrutura,
    'estrutura_photo_url', pa.estrutura_photo_url,
    'mei_cnpj', pa.mei_cnpj
  )
  INTO v_snapshot
  FROM public.prestador_ambulante pa
  WHERE pa.user_id = v_pedido.prestador_id
  LIMIT 1;

  UPDATE public.pedidos
  SET
    status = 'confirmed',
    confirmed_at = now(),
    prestador_snapshot = COALESCE(v_snapshot, prestador_snapshot, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

  RETURN to_jsonb(v_pedido);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_ambulante_order(uuid) TO authenticated;

-- 5. Estoque Atômico (Estorno): cancel_ambulante_order(p_pedido_id uuid, p_reason text)
CREATE OR REPLACE FUNCTION public.cancel_ambulante_order(
  p_pedido_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_prev_status text;
  v_item record;
  v_restored_items integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_current_usuario(v_pedido.tomador_id)
    OR public.is_current_usuario(v_pedido.prestador_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para cancelar este pedido.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.status = 'paid' THEN
    RAISE EXCEPTION 'Pedidos já pagos não podem ser cancelados diretamente.' USING ERRCODE = '22023';
  END IF;

  IF v_pedido.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'pedido', to_jsonb(v_pedido),
      'stock_restored', false,
      'restored_items', 0
    );
  END IF;

  v_prev_status := v_pedido.status;

  -- Se o pedido já havia confirmado/baixado estoque, estorna atomicamente
  IF v_prev_status IN ('confirmed', 'preparing', 'ready') THEN
    FOR v_item IN
      SELECT pi.produto_id, GREATEST(1, COALESCE(pi.qty, 1)) AS qty
      FROM public.pedido_itens pi
      WHERE pi.pedido_id = p_pedido_id
        AND pi.produto_id IS NOT NULL
      ORDER BY pi.produto_id ASC
    LOOP
      UPDATE public.estoque_ambulante
      SET
        quantidade = quantidade + v_item.qty,
        disponivel = true,
        updated_at = now()
      WHERE id_ambulante = v_pedido.prestador_id
        AND id_produto_padrao = v_item.produto_id;

      IF FOUND THEN
        v_restored_items := v_restored_items + 1;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.pedidos
  SET
    status = 'cancelled',
    cancel_reason = COALESCE(NULLIF(BTRIM(p_reason), ''), cancel_reason),
    updated_at = now()
  WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

  RETURN jsonb_build_object(
    'pedido', to_jsonb(v_pedido),
    'stock_restored', (v_restored_items > 0),
    'restored_items', v_restored_items
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_ambulante_order(uuid, text) TO authenticated;

-- 6. Financeiro Transversal: get_user_payment_history() (Mototáxi + Carros + Ambulantes, mesma assinatura!)
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
      WHEN public.is_current_usuario(COALESCE(mc.prestador_id, cc.prestador_id, ped.prestador_id, ps.provider_id))
        THEN 'prestador'
      ELSE 'tomador'
    END AS participant_role,
    COALESCE(
      mc.origin,
      cc.origin,
      CASE
        WHEN ped.id IS NOT NULL THEN jsonb_build_object(
          'address', COALESCE(ped.prestador_snapshot->>'praia_referencia', ped.prestador_snapshot->>'nome_comercial', 'Ambulante UBT')
        )
        ELSE NULL
      END
    ) AS origin,
    COALESCE(
      mc.destination,
      cc.destination,
      CASE
        WHEN ped.id IS NOT NULL THEN jsonb_build_object(
          'address', COALESCE(ped.delivery_address, ped.delivery_referencia, 'Retirada no ponto')
        )
        ELSE NULL
      END
    ) AS destination,
    COALESCE(mc.distance_km, cc.distance_km) AS distance_km,
    COALESCE(mc.duration_min, cc.duration_min) AS duration_min,
    COALESCE(mc.type, cc.type, ped.modalidade) AS ride_type,
    COALESCE(mc.status, cc.status, ped.status) AS ride_status,
    COALESCE(
      NULLIF(BTRIM(ps.payment_method), ''),
      NULLIF(BTRIM(mc.payment_method), ''),
      NULLIF(BTRIM(cc.payment_method), ''),
      NULLIF(BTRIM(ped.payment_method), '')
    ) AS payment_method
  FROM public.pagamentos_split ps
  LEFT JOIN public.mototaxi_corridas mc
    ON ps.service_type = 'mototaxi' AND mc.id = ps.service_id
  LEFT JOIN public.carro_corridas cc
    ON ps.service_type = 'carro' AND cc.id = ps.service_id
  LEFT JOIN public.pedidos ped
    ON ps.service_type = 'ambulante' AND ped.id = ps.service_id
  WHERE auth.uid() IS NOT NULL
    AND (mc.id IS NOT NULL OR cc.id IS NOT NULL OR ped.id IS NOT NULL)
    AND (
      public.is_current_usuario(COALESCE(mc.tomador_id, cc.tomador_id, ped.tomador_id, ps.tomador_id))
      OR public.is_current_usuario(COALESCE(mc.prestador_id, cc.prestador_id, ped.prestador_id, ps.provider_id))
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

-- 7. Financeiro Transversal: admin_list_financial_transactions() (inclui pedidos de ambulante, zero regressão)
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
      NULLIF(BTRIM(ped.payment_method), ''),
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
  LEFT JOIN public.pedidos ped
    ON ps.service_type = 'ambulante' AND ped.id = ps.service_id
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

-- 8. Associações de Ambulantes (categoria = 'ambulante', isolamento estrito)
CREATE OR REPLACE FUNCTION public.admin_get_ambulante_associacao_overview(
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
  v_ambulantes jsonb;
  v_mensagens jsonb;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para acessar o módulo de Associação de Ambulantes.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' THEN
    IF v_ctx.caller_associacao_id IS NULL OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'ambulante' THEN
      RAISE EXCEPTION 'Acesso negado: perfil Associação não pertence à vertical de Ambulantes.' USING ERRCODE = '42501';
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: perfil Associação só pode consultar sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  WITH vendor_links AS (
    SELECT
      u.id AS vendor_id,
      COALESCE(NULLIF(BTRIM(pamb.nome_comercial), ''), NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Ambulante') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(pamb.telefone), ''), NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao,
      COALESCE(pamb.praia_referencia, sess.praia_referencia, '') AS praia_referencia,
      COALESCE(pamb.possui_alvara, false) AS possui_alvara,
      COALESCE(pamb.alvara_verificado, false) AS alvara_verificado,
      COALESCE(pamb.kyc_status, 'pending') AS kyc_status,
      COALESCE(sess.is_online, pamb.is_online, false) AS is_online,
      (
        SELECT count(*)::integer
        FROM public.estoque_ambulante ea
        WHERE ea.id_ambulante = u.id
          AND COALESCE(ea.quantidade, 0) > 0
          AND COALESCE(ea.disponivel, true) = true
      ) AS total_itens_estoque
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN public.prestador_ambulante pamb ON pamb.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT s.is_online, s.praia_referencia
      FROM public.ambulante_sessions s
      WHERE s.prestador_id = u.id
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    ) sess ON TRUE
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
    WHERE lower(coalesce(a.categoria, '')) = 'ambulante'
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
        'praias_atuacao', COALESCE(sa.praias_atuacao, '{}'::text[]),
        'categoria', 'ambulante',
        'total_ambulantes', (
          SELECT count(*) FROM vendor_links vl WHERE vl.associacao_id = sa.id
        )
      )
      ORDER BY COALESCE(NULLIF(BTRIM(sa.nome), ''), sa.name) ASC
    ),
    '[]'::jsonb
  )
  INTO v_associacoes
  FROM scoped_assocs sa;

  WITH vendor_links AS (
    SELECT
      u.id AS vendor_id,
      COALESCE(NULLIF(BTRIM(pamb.nome_comercial), ''), NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Ambulante') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(pamb.telefone), ''), NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao,
      COALESCE(pamb.praia_referencia, sess.praia_referencia, '') AS praia_referencia,
      COALESCE(pamb.possui_alvara, false) AS possui_alvara,
      COALESCE(pamb.alvara_verificado, false) AS alvara_verificado,
      COALESCE(pamb.kyc_status, 'pending') AS kyc_status,
      COALESCE(sess.is_online, pamb.is_online, false) AS is_online,
      (
        SELECT count(*)::integer
        FROM public.estoque_ambulante ea
        WHERE ea.id_ambulante = u.id
          AND COALESCE(ea.quantidade, 0) > 0
          AND COALESCE(ea.disponivel, true) = true
      ) AS total_itens_estoque
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN public.prestador_ambulante pamb ON pamb.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT s.is_online, s.praia_referencia
      FROM public.ambulante_sessions s
      WHERE s.prestador_id = u.id
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1
    ) sess ON TRUE
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
        'id', vl.vendor_id,
        'nome', vl.nome,
        'email', COALESCE(vl.email, ''),
        'telefone', vl.telefone,
        'status', vl.status,
        'associacao_id', vl.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Associação'),
        'data_filiacao', vl.data_filiacao,
        'praia_referencia', vl.praia_referencia,
        'possui_alvara', vl.possui_alvara,
        'alvara_verificado', vl.alvara_verificado,
        'kyc_status', vl.kyc_status,
        'is_online', vl.is_online,
        'total_itens_estoque', vl.total_itens_estoque
      )
      ORDER BY vl.nome ASC
    ),
    '[]'::jsonb
  )
  INTO v_ambulantes
  FROM vendor_links vl
  JOIN public.associations a ON a.id = vl.associacao_id
  WHERE lower(coalesce(a.categoria, '')) = 'ambulante'
    AND (v_effective_assoc_id IS NULL OR vl.associacao_id = v_effective_assoc_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'associacao_id', m.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Todas as Associações de Ambulantes'),
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
      AND lower(coalesce(a_chk.categoria, '')) = 'ambulante'
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
    'ambulantes', v_ambulantes,
    'mensagens_recentes', v_mensagens
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_get_ambulante_associacao_overview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_ambulante_associacao_dados(
  p_associacao_id uuid,
  p_cnpj text,
  p_nome text,
  p_endereco_sede text,
  p_presidente_nome text,
  p_presidente_cpf text,
  p_email_oficial text,
  p_telefone_responsavel text,
  p_praias_atuacao text[] DEFAULT '{}'::text[]
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
    RAISE EXCEPTION 'Permissão insuficiente para editar dados da associação de Ambulantes.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' AND (
    v_ctx.caller_associacao_id IS NULL
    OR v_ctx.caller_associacao_id <> p_associacao_id
    OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'ambulante'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você só pode editar dados da sua própria associação de Ambulantes.' USING ERRCODE = '42501';
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
    praias_atuacao = COALESCE(p_praias_atuacao, '{}'::text[]),
    updated_at = now()
  WHERE id = p_associacao_id
    AND lower(coalesce(categoria, '')) = 'ambulante'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associação de Ambulantes não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'update_ambulante_associacao_dados',
      'associations',
      p_associacao_id::text,
      jsonb_build_object(
        'nome', v_updated.nome,
        'cnpj', v_updated.cnpj,
        'praias_atuacao', v_updated.praias_atuacao,
        'categoria', 'ambulante',
        'caller_role', v_ctx.caller_role
      )
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
    'praias_atuacao', COALESCE(v_updated.praias_atuacao, '{}'::text[]),
    'categoria', 'ambulante'
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_update_ambulante_associacao_dados(uuid, text, text, text, text, text, text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_ambulante_associacao_mass_message(
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
    IF v_ctx.caller_associacao_id IS NULL OR COALESCE(v_ctx.caller_associacao_categoria, '') <> 'ambulante' THEN
      RAISE EXCEPTION 'Acesso negado: sua associação não pertence à vertical de Ambulantes.' USING ERRCODE = '42501';
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: você só pode enviar mensagens para ambulantes da sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(nome), ''), name, 'Associação Ambulantes UBT')
    INTO v_assoc_nome
  FROM public.associations
  WHERE id = v_effective_assoc_id AND lower(coalesce(categoria, '')) = 'ambulante';

  WITH eligible_vendors AS (
    SELECT DISTINCT u.id AS vendor_id
    FROM public.usuarios u
    LEFT JOIN public.associacao_membros am
      ON am.prestador_id = u.id
      AND COALESCE(am.status, 'active') NOT IN ('removed', 'cancelled', 'rejected')
    LEFT JOIN public.provider_associations pa
      ON pa.provider_id = u.id
    JOIN public.associations a
      ON a.id = COALESCE(u.associacao_id, am.associacao_id, NULLIF(to_jsonb(am)->>'association_id', '')::uuid, pa.association_id)
    WHERE lower(coalesce(a.categoria, '')) = 'ambulante'
      AND (v_effective_assoc_id IS NULL OR a.id = v_effective_assoc_id)
  )
  SELECT COALESCE(array_agg(ev.vendor_id), ARRAY[]::uuid[])
    INTO v_target_ids
  FROM eligible_vendors ev
  WHERE p_destinatario_ids IS NULL
     OR array_length(p_destinatario_ids, 1) IS NULL
     OR ev.vendor_id = ANY(p_destinatario_ids);

  v_total := COALESCE(array_length(v_target_ids, 1), 0);

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhum ambulante elegível encontrado para este disparo.' USING ERRCODE = '22023';
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
    '[' || COALESCE(v_assoc_nome, 'Associação Ambulantes') || '] ' || BTRIM(p_titulo),
    BTRIM(p_conteudo),
    false,
    '/app/home'
  FROM unnest(v_target_ids) AS dest_id;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'send_ambulante_associacao_mass_message',
      'associacao_mensagens',
      v_msg_id::text,
      jsonb_build_object(
        'associacao_id', v_effective_assoc_id,
        'categoria', 'ambulante',
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

GRANT EXECUTE ON FUNCTION public.admin_send_ambulante_associacao_mass_message(uuid, text, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
