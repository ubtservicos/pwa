-- ============================================================================
-- MIGRATION: Vínculo por Slug UBT, Perfil Prestador e Confirmação de Coleta
-- AMBIENTE: Homologação (xqujubbqcfqxkfczbidq) — Idempotente
-- ============================================================================

-- 1. Adicionar coluna ubt_slug em public.coco_colaboradores e ampliar constraint de perfil
ALTER TABLE public.coco_colaboradores
  ADD COLUMN IF NOT EXISTS ubt_slug text;

CREATE INDEX IF NOT EXISTS idx_coco_colaboradores_ubt_slug
  ON public.coco_colaboradores (lower(ubt_slug));

ALTER TABLE public.coco_colaboradores
  DROP CONSTRAINT IF EXISTS coco_colaboradores_perfil_check;

ALTER TABLE public.coco_colaboradores
  ADD CONSTRAINT coco_colaboradores_perfil_check
  CHECK (perfil IN ('colaborador_administrativo', 'alta_gestao', 'prestador'));

-- Backfill idempotente de ubt_slug a partir de usuarios.referral_code
UPDATE public.coco_colaboradores c
SET ubt_slug = u.referral_code
FROM public.usuarios u
WHERE c.user_id = u.id
  AND c.ubt_slug IS NULL
  AND u.referral_code IS NOT NULL;

-- 2. Adicionar metadados de quem realizou a coleta em public.coco_pontos
ALTER TABLE public.coco_pontos
  ADD COLUMN IF NOT EXISTS coletado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coletado_por_nome text;

-- 3. Atualizar can_manage_coco_manuais() para EXCLUIR perfil 'prestador' do painel admin
CREATE OR REPLACE FUNCTION public.can_manage_coco_manuais()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'superadmin', 'cocoecia', 'cocoecia-dirigentes', 'cocoecia-colaborador')
  )
  OR EXISTS (
    SELECT 1
    FROM public.coco_colaboradores c
    WHERE c.user_id = auth.uid()
      AND c.is_ativo = true
      AND c.status_aprovacao = 'aprovado'
      AND c.perfil IN ('alta_gestao', 'colaborador_administrativo')
  );
$$;

-- 4. Helper para identificar colaboradores de campo (inclui perfil 'prestador')
CREATE OR REPLACE FUNCTION public.is_coco_field_collaborator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_coco_manuais()
  OR EXISTS (
    SELECT 1
    FROM public.coco_colaboradores c
    WHERE c.user_id = auth.uid()
      AND c.is_ativo = true
      AND c.status_aprovacao = 'aprovado'
  )
  OR EXISTS (
    SELECT 1
    FROM public.coco_caminhoes cam
    WHERE cam.prestador_id = auth.uid()
      AND cam.status_aprovacao = 'approved'
  );
$$;

-- 5. RPC para resolver usuário UBT pelo slug (referral_code) no cadastro de colaboradores
CREATE OR REPLACE FUNCTION public.resolver_usuario_por_slug_ubt(p_slug text)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  referral_code text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := lower(trim(COALESCE(p_slug, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_coco_manuais() THEN
    RAISE EXCEPTION 'Permissão negada para consultar usuários por slug.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nome, u.email, u.telefone, u.referral_code, u.role
  FROM public.usuarios u
  WHERE lower(trim(COALESCE(u.referral_code, ''))) = v_clean
     OR u.id::text = trim(p_slug)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_usuario_por_slug_ubt(text) TO authenticated;

-- 6. Atualizar RPC gerenciar_vinculo_colaborador_coco para suportar perfil 'prestador'
--    Regra: 'prestador' NÃO recebe role admin /admin/coco/* e mantém acesso normal de tomador
CREATE OR REPLACE FUNCTION public.gerenciar_vinculo_colaborador_coco(
  p_colaborador_id uuid,
  p_acao text,
  p_perfil text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colab record;
  v_perfil text;
  v_target_role text;
  v_current_role text;
BEGIN
  IF NOT public.can_manage_coco_manuais() THEN
    RAISE EXCEPTION 'Permissão negada para gerenciar colaboradores da Côco & Cia.';
  END IF;

  SELECT * INTO v_colab
  FROM public.coco_colaboradores
  WHERE id = p_colaborador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;

  v_perfil := COALESCE(p_perfil, v_colab.perfil, 'colaborador_administrativo');
  IF v_perfil NOT IN ('colaborador_administrativo', 'alta_gestao', 'prestador') THEN
    RAISE EXCEPTION 'Perfil inválido: %', v_perfil;
  END IF;

  IF p_acao = 'aprovar' THEN
    UPDATE public.coco_colaboradores
    SET
      status_aprovacao = 'aprovado',
      perfil = v_perfil,
      is_ativo = true,
      status = 'Ativo',
      aprovado_por = auth.uid(),
      aprovado_em = now(),
      updated_at = now()
    WHERE id = p_colaborador_id;

    IF v_colab.user_id IS NOT NULL THEN
      SELECT role INTO v_current_role FROM public.usuarios WHERE id = v_colab.user_id;

      IF v_current_role NOT IN ('admin', 'superadmin') THEN
        IF v_perfil = 'alta_gestao' THEN
          v_target_role := 'cocoecia-dirigentes';
        ELSIF v_perfil = 'colaborador_administrativo' THEN
          v_target_role := 'cocoecia-colaborador';
        ELSE
          -- Perfil 'prestador': remove role admin de coco se houver, mantendo tomador/operacional
          v_target_role := CASE
            WHEN v_current_role IN ('cocoecia-dirigentes', 'cocoecia-colaborador', 'cocoecia') THEN 'tomador'
            ELSE COALESCE(v_current_role, 'tomador')
          END;
        END IF;

        UPDATE public.usuarios SET role = v_target_role, updated_at = now() WHERE id = v_colab.user_id;
        UPDATE public.profiles SET role = v_target_role WHERE id = v_colab.user_id;
      END IF;
    END IF;

  ELSIF p_acao = 'rejeitar' THEN
    UPDATE public.coco_colaboradores
    SET
      status_aprovacao = 'rejeitado',
      is_ativo = false,
      status = 'Inativo',
      updated_at = now()
    WHERE id = p_colaborador_id;

  ELSIF p_acao = 'alterar_perfil' THEN
    UPDATE public.coco_colaboradores
    SET
      perfil = v_perfil,
      updated_at = now()
    WHERE id = p_colaborador_id;

    IF v_colab.user_id IS NOT NULL AND v_colab.status_aprovacao = 'aprovado' THEN
      SELECT role INTO v_current_role FROM public.usuarios WHERE id = v_colab.user_id;

      IF v_current_role NOT IN ('admin', 'superadmin') THEN
        IF v_perfil = 'alta_gestao' THEN
          v_target_role := 'cocoecia-dirigentes';
        ELSIF v_perfil = 'colaborador_administrativo' THEN
          v_target_role := 'cocoecia-colaborador';
        ELSE
          v_target_role := CASE
            WHEN v_current_role IN ('cocoecia-dirigentes', 'cocoecia-colaborador', 'cocoecia') THEN 'tomador'
            ELSE COALESCE(v_current_role, 'tomador')
          END;
        END IF;

        UPDATE public.usuarios SET role = v_target_role, updated_at = now() WHERE id = v_colab.user_id;
        UPDATE public.profiles SET role = v_target_role WHERE id = v_colab.user_id;
      END IF;
    END IF;

  ELSE
    RAISE EXCEPTION 'Ação inválida: %', p_acao;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'colaborador_id', p_colaborador_id,
    'acao', p_acao,
    'perfil', v_perfil
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerenciar_vinculo_colaborador_coco(uuid, text, text) TO authenticated;

-- 7. RPC para confirmar coleta de um ponto e notificar o Tomador em tempo real
CREATE OR REPLACE FUNCTION public.confirmar_coleta_ponto_coco(
  p_ponto_id uuid,
  p_caminhao_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ponto record;
  v_colab_nome text;
  v_target_caminhao uuid;
BEGIN
  IF NOT public.is_coco_field_collaborator() THEN
    RAISE EXCEPTION 'Permissão negada: apenas colaboradores ativos da Côco & Cia podem confirmar coletas.';
  END IF;

  SELECT * INTO v_ponto
  FROM public.coco_pontos
  WHERE id = p_ponto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ponto de coleta não encontrado.';
  END IF;

  IF v_ponto.status = 'coletado' THEN
    RETURN jsonb_build_object('ok', true, 'already_collected', true, 'ponto_id', p_ponto_id);
  END IF;

  SELECT COALESCE(c.nome, u.nome, 'Equipe Côco & Cia') INTO v_colab_nome
  FROM public.usuarios u
  LEFT JOIN public.coco_colaboradores c ON c.user_id = u.id AND c.is_ativo = true
  WHERE u.id = auth.uid()
  LIMIT 1;

  v_target_caminhao := COALESCE(p_caminhao_id, v_ponto.caminhao_id);

  UPDATE public.coco_pontos
  SET
    status = 'coletado',
    coletado_at = now(),
    coletado_por = auth.uid(),
    coletado_por_nome = COALESCE(v_colab_nome, 'Equipe Côco & Cia'),
    caminhao_id = COALESCE(v_target_caminhao, caminhao_id)
  WHERE id = p_ponto_id;

  IF v_target_caminhao IS NOT NULL THEN
    UPDATE public.coco_caminhoes
    SET
      collections_today = COALESCE(collections_today, 0) + 1,
      total_collections = COALESCE(total_collections, 0) + 1,
      updated_at = now()
    WHERE id = v_target_caminhao;
  END IF;

  -- Dispara notificação in-app para o Tomador que depositou o pacote
  IF v_ponto.tomador_id IS NOT NULL THEN
    INSERT INTO public.in_app_notifications (user_id, title, message, read_status, link)
    VALUES (
      v_ponto.tomador_id,
      '♻️ Pacote Recolhido pela Côco & Cia!',
      'Confirmamos que seu pacote reciclável informado em "' || COALESCE(v_ponto.address, 'endereço informado') || '" foi recolhido com sucesso!',
      false,
      '/app/coco'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ponto_id', p_ponto_id,
    'tomador_id', v_ponto.tomador_id,
    'coletado_por_nome', COALESCE(v_colab_nome, 'Equipe Côco & Cia'),
    'coletado_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_coleta_ponto_coco(uuid, uuid) TO authenticated;

-- 8. Atualizar políticas RLS em coco_pontos para incluir colaboradores vinculados (colaboradores_ids / perfil prestador)
DROP POLICY IF EXISTS "coco_pontos_field_collaborator_update" ON public.coco_pontos;
CREATE POLICY "coco_pontos_field_collaborator_update"
  ON public.coco_pontos
  FOR UPDATE
  TO authenticated
  USING (public.is_coco_field_collaborator() OR auth.uid() = tomador_id)
  WITH CHECK (public.is_coco_field_collaborator() OR auth.uid() = tomador_id);

-- 9. Atualizar políticas RLS em coco_caminhoes para colaboradores vinculados via colaboradores_ids
DROP POLICY IF EXISTS "coco_caminhoes_linked_collaborator_update" ON public.coco_caminhoes;
CREATE POLICY "coco_caminhoes_linked_collaborator_update"
  ON public.coco_caminhoes
  FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_coco_manuais()
    OR auth.uid() = prestador_id
    OR EXISTS (
      SELECT 1
      FROM public.coco_colaboradores c
      WHERE c.user_id = auth.uid()
        AND c.is_ativo = true
        AND c.status_aprovacao = 'aprovado'
        AND c.id = ANY(COALESCE(coco_caminhoes.colaboradores_ids, '{}'::uuid[]))
    )
  )
  WITH CHECK (
    public.can_manage_coco_manuais()
    OR auth.uid() = prestador_id
    OR EXISTS (
      SELECT 1
      FROM public.coco_colaboradores c
      WHERE c.user_id = auth.uid()
        AND c.is_ativo = true
        AND c.status_aprovacao = 'aprovado'
        AND c.id = ANY(COALESCE(coco_caminhoes.colaboradores_ids, '{}'::uuid[]))
    )
  );

NOTIFY pgrst, 'reload config';
