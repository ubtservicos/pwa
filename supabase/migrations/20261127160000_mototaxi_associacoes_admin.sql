-- ============================================================================
-- Migration: 20261127160000_mototaxi_associacoes_admin.sql
-- Release: v1.8.12-admin-mototaxi-associacoes-prod
-- Goals:
--   1) Enrich public.associations with the 7 official registration fields +
--      categoria ('mototaxi') + gestor_user_id.
--   2) Ensure public.usuarios has associacao_id and associacao_filiacao_at.
--   3) Create public.associacao_mensagens and associacao_mensagens_destinatarios
--      for in-app mass messaging (Association -> Drivers) + in_app_notifications.
--   4) Enforce strict RBAC isolation (super_admin/admin vs associacao) via RLS
--      and SECURITY DEFINER RPCs.
-- ============================================================================

-- 1. Enrich canonical associations table
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS endereco_sede text,
  ADD COLUMN IF NOT EXISTS presidente_nome text,
  ADD COLUMN IF NOT EXISTS presidente_cpf text,
  ADD COLUMN IF NOT EXISTS email_oficial text,
  ADD COLUMN IF NOT EXISTS telefone_responsavel text,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'mototaxi',
  ADD COLUMN IF NOT EXISTS gestor_user_id uuid;

UPDATE public.associations
SET nome = COALESCE(NULLIF(BTRIM(nome), ''), name)
WHERE nome IS NULL OR BTRIM(nome) = '';

-- 2. Affiliation link and date on public.usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS associacao_id uuid REFERENCES public.associations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS associacao_filiacao_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_usuarios_associacao_id
  ON public.usuarios (associacao_id)
  WHERE associacao_id IS NOT NULL;

-- 3. In-app mass messaging tables
CREATE TABLE IF NOT EXISTS public.associacao_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associacao_id uuid REFERENCES public.associations(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  total_destinatarios integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.associacao_mensagens_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.associacao_mensagens(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL,
  lida_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_associacao_msg_destinatario UNIQUE (mensagem_id, destinatario_id)
);

CREATE INDEX IF NOT EXISTS idx_associacao_mensagens_assoc_created
  ON public.associacao_mensagens (associacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_associacao_msg_dest_user
  ON public.associacao_mensagens_destinatarios (destinatario_id, lida_em);

-- 4. RLS Policies with strict Association isolation
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associacao_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associacao_mensagens_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._resolve_caller_mototaxi_assoc_context()
RETURNS TABLE(
  caller_id uuid,
  caller_role text,
  caller_associacao_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := '';
  v_assoc_id uuid := NULL;
  v_email text := '';
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(coalesce(email, '')),
         lower(coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role', ''))
    INTO v_email, v_role
  FROM auth.users
  WHERE id = v_uid;

  IF v_email = 'ubt.servicos@gmail.com' THEN
    v_role := 'super_admin';
  END IF;

  IF v_role NOT IN ('super_admin', 'superadmin', 'admin', 'associacao', 'associacao_lider', 'operator') THEN
    SELECT lower(coalesce(u.role, '')), u.associacao_id
      INTO v_role, v_assoc_id
    FROM public.usuarios u
    WHERE u.id = v_uid
    LIMIT 1;
  ELSE
    SELECT u.associacao_id
      INTO v_assoc_id
    FROM public.usuarios u
    WHERE u.id = v_uid
    LIMIT 1;
  END IF;

  IF v_role = 'superadmin' THEN
    v_role := 'super_admin';
  ELSIF v_role = 'associacao_lider' THEN
    v_role := 'associacao';
  END IF;

  IF v_assoc_id IS NULL THEN
    SELECT a.id INTO v_assoc_id
    FROM public.associations a
    WHERE a.gestor_user_id = v_uid
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_uid, COALESCE(v_role, ''), v_assoc_id;
END;
$fn$;

DROP POLICY IF EXISTS "Admin and own associacao read associations" ON public.associations;
CREATE POLICY "Admin and own associacao read associations"
  ON public.associations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public._resolve_caller_mototaxi_assoc_context() ctx
      WHERE ctx.caller_role IN ('super_admin', 'admin', 'operator')
         OR (ctx.caller_role = 'associacao' AND ctx.caller_associacao_id = associations.id)
    )
  );

DROP POLICY IF EXISTS "Admin and own associacao read associacao_mensagens" ON public.associacao_mensagens;
CREATE POLICY "Admin and own associacao read associacao_mensagens"
  ON public.associacao_mensagens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public._resolve_caller_mototaxi_assoc_context() ctx
      WHERE ctx.caller_role IN ('super_admin', 'admin')
         OR (ctx.caller_role = 'associacao' AND ctx.caller_associacao_id = associacao_mensagens.associacao_id)
    )
  );

DROP POLICY IF EXISTS "Drivers read own associacao_mensagens_destinatarios" ON public.associacao_mensagens_destinatarios;
CREATE POLICY "Drivers read own associacao_mensagens_destinatarios"
  ON public.associacao_mensagens_destinatarios
  FOR SELECT
  TO authenticated
  USING (
    destinatario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public._resolve_caller_mototaxi_assoc_context() ctx
      WHERE ctx.caller_role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Drivers mark own associacao_mensagens_destinatarios read" ON public.associacao_mensagens_destinatarios;
CREATE POLICY "Drivers mark own associacao_mensagens_destinatarios read"
  ON public.associacao_mensagens_destinatarios
  FOR UPDATE
  TO authenticated
  USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

-- 5. RPC: Overview of Mototaxi Associations, Affiliated Drivers & Recent Messages
CREATE OR REPLACE FUNCTION public.admin_get_mototaxi_associacao_overview(
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
  v_motoristas jsonb;
  v_mensagens jsonb;
BEGIN
  SELECT * INTO v_ctx FROM public._resolve_caller_mototaxi_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para acessar o módulo de Associação de Mototaxistas.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' THEN
    IF v_ctx.caller_associacao_id IS NULL THEN
      RETURN jsonb_build_object(
        'caller_role', v_ctx.caller_role,
        'caller_associacao_id', NULL,
        'associacoes', '[]'::jsonb,
        'motoristas', '[]'::jsonb,
        'mensagens_recentes', '[]'::jsonb
      );
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: perfil Associação só pode consultar sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  WITH driver_links AS (
    SELECT
      u.id AS driver_id,
      COALESCE(NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Mototaxista') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(m.associacao_id, m.association_id) AS assoc_id, m.created_at
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
    WHERE COALESCE(lower(a.categoria), 'mototaxi') = 'mototaxi'
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
        'categoria', COALESCE(sa.categoria, 'mototaxi'),
        'total_motoristas', (
          SELECT count(*) FROM driver_links dl WHERE dl.associacao_id = sa.id
        )
      )
      ORDER BY COALESCE(NULLIF(BTRIM(sa.nome), ''), sa.name) ASC
    ),
    '[]'::jsonb
  )
  INTO v_associacoes
  FROM scoped_assocs sa;

  WITH driver_links AS (
    SELECT
      u.id AS driver_id,
      COALESCE(NULLIF(BTRIM(u.nome), ''), NULLIF(BTRIM(pr.name), ''), u.email, 'Mototaxista') AS nome,
      u.email,
      COALESCE(NULLIF(BTRIM(u.telefone), ''), NULLIF(BTRIM(pr.phone), ''), '') AS telefone,
      COALESCE(u.status, 'ativo') AS status,
      COALESCE(u.associacao_id, am.assoc_id, pa.association_id) AS associacao_id,
      COALESCE(u.associacao_filiacao_at, am.created_at, pa.created_at, u.created_at) AS data_filiacao
    FROM public.usuarios u
    LEFT JOIN public.profiles pr ON pr.id = u.id
    LEFT JOIN LATERAL (
      SELECT COALESCE(m.associacao_id, m.association_id) AS assoc_id, m.created_at
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
        'id', dl.driver_id,
        'nome', dl.nome,
        'email', COALESCE(dl.email, ''),
        'telefone', dl.telefone,
        'status', dl.status,
        'associacao_id', dl.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Associação'),
        'data_filiacao', dl.data_filiacao
      )
      ORDER BY dl.nome ASC
    ),
    '[]'::jsonb
  )
  INTO v_motoristas
  FROM driver_links dl
  JOIN public.associations a ON a.id = dl.associacao_id
  WHERE COALESCE(lower(a.categoria), 'mototaxi') = 'mototaxi'
    AND (v_effective_assoc_id IS NULL OR dl.associacao_id = v_effective_assoc_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'associacao_id', m.associacao_id,
        'associacao_nome', COALESCE(NULLIF(BTRIM(a.nome), ''), a.name, 'Todas as Associações'),
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
    SELECT *
    FROM public.associacao_mensagens amsg
    WHERE (
      v_ctx.caller_role IN ('super_admin', 'admin')
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
    'associacoes', v_associacoes,
    'motoristas', v_motoristas,
    'mensagens_recentes', v_mensagens
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_get_mototaxi_associacao_overview(uuid) TO authenticated;

-- 6. RPC: Update the 7 official registration fields of an Association
CREATE OR REPLACE FUNCTION public.admin_update_mototaxi_associacao_dados(
  p_associacao_id uuid,
  p_cnpj text,
  p_nome text,
  p_endereco_sede text,
  p_presidente_nome text,
  p_presidente_cpf text,
  p_email_oficial text,
  p_telefone_responsavel text
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
  SELECT * INTO v_ctx FROM public._resolve_caller_mototaxi_assoc_context() LIMIT 1;

  IF v_ctx.caller_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role NOT IN ('super_admin', 'admin', 'associacao') THEN
    RAISE EXCEPTION 'Permissão insuficiente para editar dados da associação.' USING ERRCODE = '42501';
  END IF;

  IF v_ctx.caller_role = 'associacao' AND (v_ctx.caller_associacao_id IS NULL OR v_ctx.caller_associacao_id <> p_associacao_id) THEN
    RAISE EXCEPTION 'Acesso negado: você só pode editar dados da sua própria associação.' USING ERRCODE = '42501';
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
    updated_at = now()
  WHERE id = p_associacao_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'update_mototaxi_associacao_dados',
      'associations',
      p_associacao_id::text,
      jsonb_build_object(
        'nome', v_updated.nome,
        'cnpj', v_updated.cnpj,
        'caller_role', v_ctx.caller_role
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never fail business update if audit log columns differ
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
    'categoria', COALESCE(v_updated.categoria, 'mototaxi')
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_update_mototaxi_associacao_dados(uuid, text, text, text, text, text, text, text) TO authenticated;

-- 7. RPC: Send In-App Mass Message to Association Drivers
CREATE OR REPLACE FUNCTION public.admin_send_associacao_mass_message(
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
  SELECT * INTO v_ctx FROM public._resolve_caller_mototaxi_assoc_context() LIMIT 1;

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
    IF v_ctx.caller_associacao_id IS NULL THEN
      RAISE EXCEPTION 'Sua conta não está vinculada a nenhuma associação.' USING ERRCODE = '42501';
    END IF;
    IF p_associacao_id IS NOT NULL AND p_associacao_id <> v_ctx.caller_associacao_id THEN
      RAISE EXCEPTION 'Acesso negado: você só pode enviar mensagens para motoristas da sua própria associação.' USING ERRCODE = '42501';
    END IF;
    v_effective_assoc_id := v_ctx.caller_associacao_id;
  ELSE
    v_effective_assoc_id := p_associacao_id;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(nome), ''), name, 'Associação UBT')
    INTO v_assoc_nome
  FROM public.associations
  WHERE id = v_effective_assoc_id;

  WITH eligible_drivers AS (
    SELECT DISTINCT u.id AS driver_id
    FROM public.usuarios u
    LEFT JOIN public.associacao_membros am
      ON am.prestador_id = u.id
      AND COALESCE(am.status, 'active') NOT IN ('removed', 'cancelled', 'rejected')
    LEFT JOIN public.provider_associations pa
      ON pa.provider_id = u.id
    JOIN public.associations a
      ON a.id = COALESCE(u.associacao_id, am.associacao_id, am.association_id, pa.association_id)
    WHERE COALESCE(lower(a.categoria), 'mototaxi') = 'mototaxi'
      AND (v_effective_assoc_id IS NULL OR a.id = v_effective_assoc_id)
  )
  SELECT COALESCE(array_agg(ed.driver_id), ARRAY[]::uuid[])
    INTO v_target_ids
  FROM eligible_drivers ed
  WHERE p_destinatario_ids IS NULL
     OR array_length(p_destinatario_ids, 1) IS NULL
     OR ed.driver_id = ANY(p_destinatario_ids);

  v_total := COALESCE(array_length(v_target_ids, 1), 0);

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhum motorista elegível encontrado para este disparo.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.associacao_mensagens (associacao_id, remetente_id, titulo, conteudo, total_destinatarios)
  VALUES (v_effective_assoc_id, v_ctx.caller_id, BTRIM(p_titulo), BTRIM(p_conteudo), v_total)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.associacao_mensagens_destinatarios (mensagem_id, destinatario_id)
  SELECT v_msg_id, unnest(v_target_ids)
  ON CONFLICT (mensagem_id, destinatario_id) DO NOTHING;

  -- Deliver directly into in_app_notifications so drivers receive it in realtime via InAppNotificationBell
  INSERT INTO public.in_app_notifications (user_id, title, message, read_status, link)
  SELECT
    dest_id,
    '[' || COALESCE(v_assoc_nome, 'Associação Mototáxi') || '] ' || BTRIM(p_titulo),
    BTRIM(p_conteudo),
    false,
    '/app/home'
  FROM unnest(v_target_ids) AS dest_id;

  BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    VALUES (
      v_ctx.caller_id,
      'send_associacao_mass_message',
      'associacao_mensagens',
      v_msg_id::text,
      jsonb_build_object(
        'associacao_id', v_effective_assoc_id,
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

GRANT EXECUTE ON FUNCTION public.admin_send_associacao_mass_message(uuid, text, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
