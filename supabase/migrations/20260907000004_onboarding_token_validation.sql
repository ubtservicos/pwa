-- Migration: 20260907_onboarding_token_validation.sql
-- Validation and Completion RPCs for token-based onboarding

-- 1. Function to validate onboarding token (accepts text token, accessible by public/anon)
CREATE OR REPLACE FUNCTION public.validate_onboarding_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uuid uuid;
  v_onboarding RECORD;
  v_lead RECORD;
BEGIN
  -- Validate UUID format
  BEGIN
    v_uuid := p_token::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'INVALID_TOKEN_FORMAT',
      'message', 'Formato de token de convite inválido.'
    );
  END;

  -- Search in user_onboarding
  SELECT * INTO v_onboarding
  FROM public.user_onboarding
  WHERE waitlist_id = v_uuid;

  -- Search in waitlist
  SELECT * INTO v_lead
  FROM public.waitlist
  WHERE id = v_uuid;

  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'TOKEN_NOT_FOUND',
      'message', 'Token de convite não encontrado.'
    );
  END IF;

  -- Check if already completed
  IF (v_onboarding.id IS NOT NULL AND v_onboarding.status = 'COMPLETED') OR v_lead.status = 'converted' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'ALREADY_COMPLETED',
      'message', 'Este convite já foi utilizado para criar uma conta.',
      'email', v_lead.email,
      'nome', v_lead.nome
    );
  END IF;

  -- Check if status is approved
  IF (v_onboarding.id IS NOT NULL AND v_onboarding.status = 'WAITLIST_APPROVED') OR v_lead.status = 'approved' THEN
    RETURN jsonb_build_object(
      'valid', true,
      'lead_id', v_lead.id,
      'nome', v_lead.nome,
      'email', v_lead.email,
      'telefone', v_lead.telefone,
      'perfil', v_lead.perfil,
      'status', COALESCE(v_onboarding.status, v_lead.status),
      'bairro_moradia', v_lead.bairro_moradia,
      'bairro_trabalho', v_lead.bairro_trabalho,
      'cidade', v_lead.cidade
    );
  END IF;

  -- Otherwise not yet approved or invalid status
  RETURN jsonb_build_object(
    'valid', false,
    'error', 'NOT_APPROVED',
    'message', 'Este cadastro ainda não foi aprovado na fila de espera.',
    'status', COALESCE(v_onboarding.status, v_lead.status)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_onboarding_token(text) TO anon, authenticated, service_role;

-- 2. Function to complete onboarding and link auth user with lead/usuarios
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_token text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uuid uuid;
  v_lead RECORD;
  v_role text := 'tomador';
BEGIN
  -- Validate UUID format
  BEGIN
    v_uuid := p_token::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOKEN_FORMAT');
  END;

  -- Fetch lead details
  SELECT * INTO v_lead
  FROM public.waitlist
  WHERE id = v_uuid;

  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'LEAD_NOT_FOUND');
  END IF;

  -- Map role
  IF ('mototaxista' = ANY(v_lead.perfil) OR 'ambulante' = ANY(v_lead.perfil) OR 'prestador' = ANY(v_lead.perfil)) THEN
    v_role := 'prestador';
  ELSIF ('associacao' = ANY(v_lead.perfil)) THEN
    v_role := 'associacao';
  ELSE
    v_role := 'tomador';
  END IF;

  -- Update user_onboarding
  UPDATE public.user_onboarding
  SET status = 'COMPLETED',
      user_id = p_user_id,
      updated_at = NOW()
  WHERE waitlist_id = v_uuid;

  -- If no user_onboarding row existed, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_onboarding (waitlist_id, user_id, status, approved_at, updated_at)
    VALUES (v_uuid, p_user_id, 'COMPLETED', NOW(), NOW())
    ON CONFLICT (waitlist_id) DO UPDATE
    SET status = 'COMPLETED',
        user_id = p_user_id,
        updated_at = NOW();
  END IF;

  -- Update waitlist status
  UPDATE public.waitlist
  SET status = 'converted'
  WHERE id = v_uuid;

  -- Ensure usuarios profile is created/active
  INSERT INTO public.usuarios (
    id,
    nome,
    role,
    status,
    telefone,
    bairro_moradia,
    bairro_trabalho,
    created_at
  )
  VALUES (
    p_user_id,
    v_lead.nome,
    v_role,
    'active',
    v_lead.telefone,
    v_lead.bairro_moradia,
    v_lead.bairro_trabalho,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome,
      status = 'active',
      telefone = COALESCE(usuarios.telefone, EXCLUDED.telefone),
      bairro_moradia = COALESCE(usuarios.bairro_moradia, EXCLUDED.bairro_moradia),
      bairro_trabalho = COALESCE(usuarios.bairro_trabalho, EXCLUDED.bairro_trabalho);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'nome', v_lead.nome,
    'role', v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
