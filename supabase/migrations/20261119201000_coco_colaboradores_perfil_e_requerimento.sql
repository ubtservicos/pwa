-- Migração: 20261119201000_coco_colaboradores_perfil_e_requerimento.sql
-- Fase Côco & Cia: Perfil de Colaborador (Colaborador Administrativo vs Alta Gestão),
-- Vínculo com Conta UBT e Fluxo Requerimento > Aprovação.
-- Ambiente Alvo: Homologação (xqujubbqcfqxkfczbidq)

-- 1. Evolução de public.coco_colaboradores
ALTER TABLE public.coco_colaboradores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'colaborador_administrativo',
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

ALTER TABLE public.coco_colaboradores
  DROP CONSTRAINT IF EXISTS coco_colaboradores_perfil_check,
  DROP CONSTRAINT IF EXISTS coco_colaboradores_status_aprovacao_check;

ALTER TABLE public.coco_colaboradores
  ADD CONSTRAINT coco_colaboradores_perfil_check
    CHECK (perfil IN ('colaborador_administrativo', 'alta_gestao')),
  ADD CONSTRAINT coco_colaboradores_status_aprovacao_check
    CHECK (status_aprovacao IN ('pendente', 'aprovado', 'rejeitado'));

CREATE INDEX IF NOT EXISTS idx_coco_colaboradores_user_id ON public.coco_colaboradores(user_id);
CREATE INDEX IF NOT EXISTS idx_coco_colaboradores_status_aprovacao ON public.coco_colaboradores(status_aprovacao);

-- 2. Garante que usuarios_role_check aceite os papéis da Côco & Cia
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role = ANY (ARRAY[
    'tomador'::text,
    'prestador'::text,
    'admin'::text,
    'superadmin'::text,
    'super_admin'::text,
    'cocoecia'::text,
    'cocoecia-colaborador'::text,
    'cocoecia-dirigentes'::text,
    'associacao'::text,
    'associacao_lider'::text,
    'user'::text
  ]));

-- 3. Atualiza can_manage_coco_manuais() para reconhecer também colaboradores aprovados em coco_colaboradores
CREATE OR REPLACE FUNCTION public.can_manage_coco_manuais()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_has_approved_colab boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
  FROM public.usuarios
  WHERE id = auth.uid();

  IF v_role IN (
    'associacao',
    'associacao_lider',
    'cocoecia',
    'cocoecia-dirigentes',
    'cocoecia-colaborador'
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.coco_colaboradores
    WHERE user_id = auth.uid()
      AND status_aprovacao = 'aprovado'
      AND is_ativo = true
  ) INTO v_has_approved_colab;

  RETURN v_has_approved_colab;
END;
$$;

-- 4. RPC SECURITY DEFINER para aprovar/rejeitar requerimento ou alterar perfil sincronizando RBAC na conta UBT
DROP FUNCTION IF EXISTS public.gerenciar_vinculo_colaborador_coco(uuid, text, text);

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
  v_colab RECORD;
  v_next_status text;
  v_next_perfil text;
  v_target_role text;
  v_current_user_role text;
BEGIN
  IF NOT public.can_manage_coco_manuais() THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar vínculos de colaboradores da Côco & Cia.';
  END IF;

  SELECT * INTO v_colab
  FROM public.coco_colaboradores
  WHERE id = p_colaborador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;

  v_next_perfil := COALESCE(NULLIF(trim(p_perfil), ''), v_colab.perfil, 'colaborador_administrativo');
  IF v_next_perfil NOT IN ('colaborador_administrativo', 'alta_gestao') THEN
    RAISE EXCEPTION 'Perfil inválido: %', v_next_perfil;
  END IF;

  IF p_acao = 'aprovar' THEN
    v_next_status := 'aprovado';
  ELSIF p_acao = 'rejeitar' THEN
    v_next_status := 'rejeitado';
  ELSIF p_acao = 'pendente' THEN
    v_next_status := 'pendente';
  ELSIF p_acao = 'atualizar_perfil' THEN
    v_next_status := v_colab.status_aprovacao;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', p_acao;
  END IF;

  UPDATE public.coco_colaboradores
  SET
    perfil = v_next_perfil,
    status_aprovacao = v_next_status,
    is_ativo = CASE WHEN v_next_status = 'rejeitado' THEN false ELSE is_ativo END,
    aprovado_por = CASE WHEN v_next_status = 'aprovado' THEN auth.uid() ELSE aprovado_por END,
    aprovado_em = CASE WHEN v_next_status = 'aprovado' THEN now() ELSE aprovado_em END,
    updated_at = now()
  WHERE id = p_colaborador_id;

  -- Sincroniza role na conta UBT quando vinculado a user_id e aprovado (preservando admin/superadmin)
  IF v_colab.user_id IS NOT NULL AND v_next_status = 'aprovado' THEN
    v_target_role := CASE
      WHEN v_next_perfil = 'alta_gestao' THEN 'cocoecia-dirigentes'
      ELSE 'cocoecia-colaborador'
    END;

    SELECT role INTO v_current_user_role FROM public.usuarios WHERE id = v_colab.user_id;
    IF v_current_user_role IS DISTINCT FROM 'admin'
       AND v_current_user_role IS DISTINCT FROM 'superadmin'
       AND v_current_user_role IS DISTINCT FROM 'super_admin' THEN
      UPDATE public.usuarios
      SET role = v_target_role, updated_at = now()
      WHERE id = v_colab.user_id;

      UPDATE public.profiles
      SET role = v_target_role, updated_at = now()
      WHERE id = v_colab.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_colaborador_id,
    'perfil', v_next_perfil,
    'status_aprovacao', v_next_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerenciar_vinculo_colaborador_coco(uuid, text, text) TO authenticated;

-- 5. Políticas RLS em public.coco_colaboradores (requerimento próprio + gestão Côco & Cia)
DROP POLICY IF EXISTS "Admin_Full_Access_coco_colaboradores" ON public.coco_colaboradores;
DROP POLICY IF EXISTS "coco_colaboradores_self_request_select" ON public.coco_colaboradores;
DROP POLICY IF EXISTS "coco_colaboradores_self_request_insert" ON public.coco_colaboradores;

CREATE POLICY "coco_colaboradores_self_request_select" ON public.coco_colaboradores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "coco_colaboradores_self_request_insert" ON public.coco_colaboradores
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status_aprovacao = 'pendente');

NOTIFY pgrst, 'reload config';
