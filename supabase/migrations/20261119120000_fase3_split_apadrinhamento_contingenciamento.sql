-- Migração: 20261119120000_fase3_split_apadrinhamento_contingenciamento.sql
-- Fase 3: Split Financeiro de Apadrinhamento, Contingenciamento por Chave PIX e Status Mercado Pago
-- Ambiente Alvo: Homologação (xqujubbqcfqxkfczbidq)

-- 1. Padronização de Recebimento em public.usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS tipo_chave_pix text,
  ADD COLUMN IF NOT EXISTS possui_mercadopago boolean NOT NULL DEFAULT false;

-- Backfill seguro de chave_pix, tipo_chave_pix e possui_mercadopago a partir de waitlist, profiles e marketplace_accounts
UPDATE public.usuarios u
SET
  chave_pix = COALESCE(
    NULLIF(trim(u.chave_pix), ''),
    NULLIF(trim(w.chave_pix), ''),
    NULLIF(trim(u.metadata->>'chave_pix'), '')
  ),
  tipo_chave_pix = COALESCE(
    NULLIF(trim(u.tipo_chave_pix), ''),
    NULLIF(trim(w.tipo_chave_pix), ''),
    NULLIF(trim(u.metadata->>'tipo_chave_pix'), '')
  ),
  possui_mercadopago = COALESCE(u.possui_mercadopago, false) OR COALESCE(w.possui_mercado_pago, false)
FROM public.waitlist w
WHERE (w.user_id = u.id OR (w.telefone IS NOT NULL AND w.telefone = u.telefone) OR (w.email IS NOT NULL AND LOWER(w.email) = LOWER(u.email)));

UPDATE public.usuarios u
SET chave_pix = NULLIF(trim(p.pix_key), '')
FROM public.profiles p
WHERE p.id = u.id
  AND NULLIF(trim(u.chave_pix), '') IS NULL
  AND NULLIF(trim(p.pix_key), '') IS NOT NULL;

UPDATE public.usuarios u
SET possui_mercadopago = true
FROM public.marketplace_accounts ma
WHERE ma.user_id = u.id
  AND ma.status = 'CONNECTED'
  AND u.possui_mercadopago = false;

-- 2. Estrutura de Repasse e Contingenciamento em public.pagamentos_split
ALTER TABLE public.pagamentos_split
  ADD COLUMN IF NOT EXISTS tomador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_repasse_godparent_tomador text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS status_repasse_godparent_prestador text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS repasse_godparent_tomador_em timestamptz,
  ADD COLUMN IF NOT EXISTS repasse_godparent_prestador_em timestamptz;

-- Garante Foreign Keys de godparent_tomador_id e godparent_prestador_id para public.usuarios(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_split_godparent_tomador_id_fkey'
  ) THEN
    ALTER TABLE public.pagamentos_split
      ADD CONSTRAINT pagamentos_split_godparent_tomador_id_fkey
      FOREIGN KEY (godparent_tomador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_split_godparent_prestador_id_fkey'
  ) THEN
    ALTER TABLE public.pagamentos_split
      ADD CONSTRAINT pagamentos_split_godparent_prestador_id_fkey
      FOREIGN KEY (godparent_prestador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Check constraints para os novos status de repasse
ALTER TABLE public.pagamentos_split
  DROP CONSTRAINT IF EXISTS pagamentos_split_status_repasse_godparent_tomador_check,
  DROP CONSTRAINT IF EXISTS pagamentos_split_status_repasse_godparent_prestador_check;

ALTER TABLE public.pagamentos_split
  ADD CONSTRAINT pagamentos_split_status_repasse_godparent_tomador_check
    CHECK (status_repasse_godparent_tomador IN ('nao_aplicavel', 'pendente_repasse', 'contingenciado', 'pago')),
  ADD CONSTRAINT pagamentos_split_status_repasse_godparent_prestador_check
    CHECK (status_repasse_godparent_prestador IN ('nao_aplicavel', 'pendente_repasse', 'contingenciado', 'pago'));

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_godparent_tomador
  ON public.pagamentos_split(godparent_tomador_id, status_repasse_godparent_tomador);

CREATE INDEX IF NOT EXISTS idx_pagamentos_split_godparent_prestador
  ON public.pagamentos_split(godparent_prestador_id, status_repasse_godparent_prestador);

-- 3. Função auxiliar de verificação de Chave PIX válida
CREATE OR REPLACE FUNCTION public.usuario_possui_chave_pix(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_chave text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT NULLIF(trim(chave_pix), '') INTO v_chave
  FROM public.usuarios
  WHERE id = p_user_id;

  IF v_chave IS NOT NULL THEN
    RETURN true;
  END IF;

  SELECT NULLIF(trim(pix_key), '') INTO v_chave
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_chave IS NOT NULL;
END;
$$;

-- 4. Motor de Cálculo e Contingenciamento Automático em public.pagamentos_split
CREATE OR REPLACE FUNCTION public.resolve_godparent_split_contingency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_pix_tomador boolean;
  v_has_pix_prestador boolean;
BEGIN
  -- Resolução defensiva de padrinhos caso não enviados explicitamente
  IF NEW.godparent_tomador_id IS NULL AND NEW.tomador_id IS NOT NULL THEN
    SELECT padrinho_id INTO NEW.godparent_tomador_id
    FROM public.usuarios
    WHERE id = NEW.tomador_id;
  END IF;

  IF NEW.godparent_prestador_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    SELECT padrinho_id INTO NEW.godparent_prestador_id
    FROM public.usuarios
    WHERE id = NEW.provider_id;
  END IF;

  -- Mantém coluna legada godparent_id sincronizada se nula
  IF NEW.godparent_id IS NULL THEN
    NEW.godparent_id := COALESCE(NEW.godparent_tomador_id, NEW.godparent_prestador_id);
  END IF;

  -- Regra Padrinho Tomador
  IF NEW.godparent_tomador_id IS NULL OR COALESCE(NEW.godparent_tomador_amount, 0) <= 0 THEN
    NEW.status_repasse_godparent_tomador := 'nao_aplicavel';
  ELSIF NEW.status_repasse_godparent_tomador = 'pago' THEN
    -- Preserva status já liquidado
    NEW.repasse_godparent_tomador_em := COALESCE(NEW.repasse_godparent_tomador_em, now());
  ELSE
    v_has_pix_tomador := public.usuario_possui_chave_pix(NEW.godparent_tomador_id);
    IF v_has_pix_tomador THEN
      NEW.status_repasse_godparent_tomador := 'pendente_repasse';
    ELSE
      NEW.status_repasse_godparent_tomador := 'contingenciado';
    END IF;
  END IF;

  -- Regra Padrinho Prestador
  IF NEW.godparent_prestador_id IS NULL OR COALESCE(NEW.godparent_prestador_amount, 0) <= 0 THEN
    NEW.status_repasse_godparent_prestador := 'nao_aplicavel';
  ELSIF NEW.status_repasse_godparent_prestador = 'pago' THEN
    NEW.repasse_godparent_prestador_em := COALESCE(NEW.repasse_godparent_prestador_em, now());
  ELSE
    v_has_pix_prestador := public.usuario_possui_chave_pix(NEW.godparent_prestador_id);
    IF v_has_pix_prestador THEN
      NEW.status_repasse_godparent_prestador := 'pendente_repasse';
    ELSE
      NEW.status_repasse_godparent_prestador := 'contingenciado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_godparent_split_contingency ON public.pagamentos_split;
CREATE TRIGGER trg_resolve_godparent_split_contingency
  BEFORE INSERT OR UPDATE ON public.pagamentos_split
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_godparent_split_contingency();

-- Reavalia lançamentos existentes em pagamentos_split
UPDATE public.pagamentos_split
SET updated_at = COALESCE(updated_at, now());

-- 5. Trigger de Liberação Automática do Contingenciamento ao Cadastrar/Atualizar Chave PIX
CREATE OR REPLACE FUNCTION public.liberar_contingenciamento_ao_salvar_pix()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_new text := NULLIF(trim(NEW.chave_pix), '');
BEGIN
  IF v_clean_new IS NOT NULL THEN
    -- Promove repasses onde o usuário é padrinho do tomador
    UPDATE public.pagamentos_split
    SET
      status_repasse_godparent_tomador = 'pendente_repasse',
      updated_at = now()
    WHERE godparent_tomador_id = NEW.id
      AND status_repasse_godparent_tomador = 'contingenciado';

    -- Promove repasses onde o usuário é padrinho do prestador
    UPDATE public.pagamentos_split
    SET
      status_repasse_godparent_prestador = 'pendente_repasse',
      updated_at = now()
    WHERE godparent_prestador_id = NEW.id
      AND status_repasse_godparent_prestador = 'contingenciado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liberar_contingenciamento_pix ON public.usuarios;
CREATE TRIGGER trg_liberar_contingenciamento_pix
  AFTER INSERT OR UPDATE OF chave_pix ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.liberar_contingenciamento_ao_salvar_pix();

-- 6. Atualiza sync_waitlist_to_usuarios() para também propagar chave_pix, tipo_chave_pix e possui_mercadopago
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
  v_existing_id uuid;
  v_target_id uuid;
  v_auth_user_id uuid;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE LOWER(email) = LOWER(NEW.email) AND email_confirmed_at IS NULL;
  END IF;

  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO v_auth_user_id FROM auth.users WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    IF v_auth_user_id IS NOT NULL THEN
      NEW.user_id := v_auth_user_id;
    END IF;
  END IF;

  v_is_pj := (
    NEW.tipo_cadastro IN ('pj', 'associacao', 'PJ')
    OR NEW.cnpj IS NOT NULL
    OR NEW.razao_social IS NOT NULL
  );

  IF v_is_pj THEN
    v_role := 'associacao';
  ELSIF NEW.role IN ('prestador', 'trabalhador') THEN
    v_role := 'prestador';
  ELSIF NEW.role IN ('admin', 'superadmin', 'super_admin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'tomador';
  END IF;

  IF NEW.cadastro_completo = true OR NEW.status IN ('aprovado', 'approved', 'completo') THEN
    v_existing_id := NULL;
    IF NEW.user_id IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE id = NEW.user_id;
    END IF;
    IF v_existing_id IS NULL AND NEW.telefone IS NOT NULL AND NEW.telefone != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE telefone = NEW.telefone;
    END IF;
    IF v_existing_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
      SELECT id INTO v_existing_id FROM public.usuarios WHERE LOWER(email) = LOWER(NEW.email);
    END IF;

    v_target_id := COALESCE(v_existing_id, NEW.user_id, gen_random_uuid());

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.usuarios SET
        nome = COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, public.usuarios.nome),
        email = COALESCE(NEW.email, public.usuarios.email),
        telefone = COALESCE(NEW.telefone, public.usuarios.telefone),
        role = CASE WHEN public.usuarios.role IN ('admin', 'superadmin', 'super_admin') THEN public.usuarios.role ELSE v_role END,
        status = 'ativo',
        cpf = COALESCE(NEW.cpf, NEW.responsavel_cpf, public.usuarios.cpf),
        cnpj = COALESCE(NEW.cnpj, public.usuarios.cnpj),
        razao_social = COALESCE(NEW.razao_social, public.usuarios.razao_social),
        padrinho_id = COALESCE(public.usuarios.padrinho_id, NEW.padrinho_id),
        chave_pix = COALESCE(NULLIF(trim(NEW.chave_pix), ''), public.usuarios.chave_pix),
        tipo_chave_pix = COALESCE(NULLIF(trim(NEW.tipo_chave_pix), ''), public.usuarios.tipo_chave_pix),
        possui_mercadopago = COALESCE(public.usuarios.possui_mercadopago, false) OR COALESCE(NEW.possui_mercado_pago, false),
        metadata = COALESCE(public.usuarios.metadata, '{}'::jsonb) || jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', NEW.cadastro_completo
        ),
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.usuarios (
        id,
        nome,
        email,
        telefone,
        role,
        status,
        cpf,
        cnpj,
        razao_social,
        padrinho_id,
        chave_pix,
        tipo_chave_pix,
        possui_mercadopago,
        metadata
      ) VALUES (
        v_target_id,
        COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, 'Novo Usuário'),
        NEW.email,
        NEW.telefone,
        v_role,
        'ativo',
        COALESCE(NEW.cpf, NEW.responsavel_cpf),
        NEW.cnpj,
        NEW.razao_social,
        NEW.padrinho_id,
        NULLIF(trim(NEW.chave_pix), ''),
        NULLIF(trim(NEW.tipo_chave_pix), ''),
        COALESCE(NEW.possui_mercado_pago, false),
        jsonb_build_object(
          'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
          'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
          'razao_social', NEW.razao_social,
          'cnpj', NEW.cnpj,
          'status_waitlist', NEW.status,
          'role_waitlist', NEW.role,
          'cadastro_completo', NEW.cadastro_completo
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. RPC Segura para Extrato Financeiro de Apadrinhamento
DROP FUNCTION IF EXISTS public.obter_resumo_financeiro_apadrinhamento(uuid);

CREATE OR REPLACE FUNCTION public.obter_resumo_financeiro_apadrinhamento(p_padrinho_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chave_pix text;
  v_tipo_chave_pix text;
  v_possui_chave boolean := false;
  v_possui_mp boolean := false;
  v_chave_mascarada text := null;
  v_total_disponivel numeric := 0;
  v_total_contingenciado numeric := 0;
  v_total_pago numeric := 0;
  v_total_pendente numeric := 0;
  v_repasses jsonb := '[]'::jsonb;
BEGIN
  IF p_padrinho_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_disponivel', 0,
      'total_contingenciado', 0,
      'total_pago', 0,
      'total_pendente_repasse', 0,
      'possui_chave_pix', false,
      'chave_pix_atual', null,
      'tipo_chave_pix', null,
      'possui_mercadopago', false,
      'repasses', '[]'::jsonb
    );
  END IF;

  SELECT
    NULLIF(trim(u.chave_pix), ''),
    NULLIF(trim(u.tipo_chave_pix), ''),
    COALESCE(u.possui_mercadopago, false)
  INTO v_chave_pix, v_tipo_chave_pix, v_possui_mp
  FROM public.usuarios u
  WHERE u.id = p_padrinho_id;

  IF v_chave_pix IS NULL THEN
    SELECT NULLIF(trim(pix_key), '') INTO v_chave_pix FROM public.profiles WHERE id = p_padrinho_id;
  END IF;

  v_possui_chave := v_chave_pix IS NOT NULL;

  IF v_possui_chave THEN
    IF length(v_chave_pix) <= 6 THEN
      v_chave_mascarada := v_chave_pix;
    ELSE
      v_chave_mascarada := left(v_chave_pix, 3) || '***' || right(v_chave_pix, 3);
    END IF;
  END IF;

  WITH repasses_raw AS (
    SELECT
      ps.id AS split_id,
      ps.transaction_id,
      ps.created_at AS data,
      ps.service_type,
      ps.status AS status_pagamento,
      'tomador'::text AS papel_indicado,
      COALESCE(ps.godparent_tomador_amount, 0)::numeric AS valor,
      ps.status_repasse_godparent_tomador AS status_repasse,
      COALESCE(ut.nome, 'Cliente Indicado')::text AS indicado_nome
    FROM public.pagamentos_split ps
    LEFT JOIN public.usuarios ut ON ut.id = ps.tomador_id
    WHERE ps.godparent_tomador_id = p_padrinho_id
      AND COALESCE(ps.godparent_tomador_amount, 0) > 0
      AND ps.status NOT IN ('rejected', 'refunded', 'charged_back')

    UNION ALL

    SELECT
      ps.id AS split_id,
      ps.transaction_id,
      ps.created_at AS data,
      ps.service_type,
      ps.status AS status_pagamento,
      'prestador'::text AS papel_indicado,
      COALESCE(ps.godparent_prestador_amount, 0)::numeric AS valor,
      ps.status_repasse_godparent_prestador AS status_repasse,
      COALESCE(up.nome, 'Prestador Indicado')::text AS indicado_nome
    FROM public.pagamentos_split ps
    LEFT JOIN public.usuarios up ON up.id = ps.provider_id
    WHERE ps.godparent_prestador_id = p_padrinho_id
      AND COALESCE(ps.godparent_prestador_amount, 0) > 0
      AND ps.status NOT IN ('rejected', 'refunded', 'charged_back')
  )
  SELECT
    COALESCE(SUM(CASE WHEN status_repasse IN ('pendente_repasse', 'pago') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status_repasse = 'contingenciado' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status_repasse = 'pago' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status_repasse = 'pendente_repasse' THEN valor ELSE 0 END), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'split_id', split_id,
          'transaction_id', transaction_id,
          'data', data,
          'service_type', service_type,
          'papel_indicado', papel_indicado,
          'indicado_nome', indicado_nome,
          'valor', valor,
          'status_repasse', status_repasse,
          'status_pagamento', status_pagamento
        ) ORDER BY data DESC
      ),
      '[]'::jsonb
    )
  INTO v_total_disponivel, v_total_contingenciado, v_total_pago, v_total_pendente, v_repasses
  FROM repasses_raw;

  RETURN jsonb_build_object(
    'total_disponivel', v_total_disponivel,
    'total_contingenciado', v_total_contingenciado,
    'total_pago', v_total_pago,
    'total_pendente_repasse', v_total_pendente,
    'possui_chave_pix', v_possui_chave,
    'chave_pix_atual', v_chave_mascarada,
    'tipo_chave_pix', v_tipo_chave_pix,
    'possui_mercadopago', v_possui_mp,
    'repasses', v_repasses
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_resumo_financeiro_apadrinhamento(uuid) TO anon, authenticated;

-- 8. RPC Segura para Salvar Chave PIX e Status Mercado Pago
DROP FUNCTION IF EXISTS public.salvar_chave_pix_usuario(uuid, text, text);

CREATE OR REPLACE FUNCTION public.salvar_chave_pix_usuario(
  p_user_id uuid,
  p_chave_pix text,
  p_tipo_chave_pix text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_pix text := NULLIF(trim(p_chave_pix), '');
  v_clean_tipo text := NULLIF(trim(p_tipo_chave_pix), '');
  v_liberados int := 0;
  v_count_tom int := 0;
  v_count_prest int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para atualizar chave PIX.';
  END IF;

  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar chave PIX de outro usuário.';
  END IF;

  IF v_clean_pix IS NULL THEN
    RAISE EXCEPTION 'Chave PIX inválida ou vazia.';
  END IF;

  -- Conta quantos contingenciados serão liberados
  SELECT count(*) INTO v_count_tom
  FROM public.pagamentos_split
  WHERE godparent_tomador_id = p_user_id AND status_repasse_godparent_tomador = 'contingenciado';

  SELECT count(*) INTO v_count_prest
  FROM public.pagamentos_split
  WHERE godparent_prestador_id = p_user_id AND status_repasse_godparent_prestador = 'contingenciado';

  v_liberados := v_count_tom + v_count_prest;

  -- Atualiza usuarios (dispara trg_liberar_contingenciamento_pix automaticamente)
  UPDATE public.usuarios
  SET
    chave_pix = v_clean_pix,
    tipo_chave_pix = COALESCE(v_clean_tipo, tipo_chave_pix, 'aleatoria'),
    updated_at = now()
  WHERE id = p_user_id;

  -- Espelha em waitlist quando existir vínculo
  UPDATE public.waitlist
  SET
    chave_pix = v_clean_pix,
    tipo_chave_pix = COALESCE(v_clean_tipo, tipo_chave_pix, 'aleatoria'),
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Espelha em profiles quando existir vínculo
  UPDATE public.profiles
  SET
    pix_key = v_clean_pix,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'chave_pix', v_clean_pix,
    'tipo_chave_pix', v_clean_tipo,
    'repasses_liberados', v_liberados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_chave_pix_usuario(uuid, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.atualizar_status_mercadopago_usuario(uuid, boolean);

CREATE OR REPLACE FUNCTION public.atualizar_status_mercadopago_usuario(
  p_user_id uuid,
  p_possui boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar este usuário.';
  END IF;

  UPDATE public.usuarios
  SET possui_mercadopago = COALESCE(p_possui, false), updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.waitlist
  SET possui_mercado_pago = COALESCE(p_possui, false), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'possui_mercadopago', COALESCE(p_possui, false));
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_status_mercadopago_usuario(uuid, boolean) TO authenticated;

-- 9. Policy RLS para leitura dos próprios splits pelos padrinhos (tomador/prestador)
DROP POLICY IF EXISTS "godparent_read_own_pagamentos_split" ON public.pagamentos_split;
CREATE POLICY "godparent_read_own_pagamentos_split" ON public.pagamentos_split
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = godparent_tomador_id
    OR auth.uid() = godparent_prestador_id
    OR auth.uid() = godparent_id
    OR auth.uid() = tomador_id
    OR auth.uid() = provider_id
    OR public.is_admin()
  );

NOTIFY pgrst, 'reload config';
