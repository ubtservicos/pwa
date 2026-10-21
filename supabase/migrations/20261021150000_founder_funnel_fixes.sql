-- ==============================================================================
-- MIGRATION: 20261021150000_founder_funnel_fixes.sql
-- Descrição:
--   1. Adiciona colunas cadastro_completo, status e updated_at em public.waitlist.
--   2. Criação da RPC salvar_slug_fundador (SECURITY DEFINER) para permitir
--      atualização segura do slug pelo telefone, CPF, e-mail ou ID do fundador.
--   3. Criação da RPC concluir_atualizacao_cadastral (SECURITY DEFINER) para
--      persistência irrestrita dos dados cadastrais na waitlist e sincronização
--      com public.usuarios.
-- ==============================================================================

BEGIN;

-- 1. Colunas adicionais na waitlist e usuarios
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS cadastro_completo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Atualiza leads legados com status completo se já tiverem preenchido dados essenciais
UPDATE public.waitlist
   SET cadastro_completo = true
 WHERE cadastro_completo IS NOT TRUE
   AND (cpf IS NOT NULL OR cnpj IS NOT NULL OR chave_pix IS NOT NULL OR status IN ('completo', 'approved'));

-- 2. RPC salvar_slug_fundador
DROP FUNCTION IF EXISTS public.salvar_slug_fundador(text, text);

CREATE OR REPLACE FUNCTION public.salvar_slug_fundador(
  p_identificador text,
  p_novo_slug text
)
RETURNS jsonb AS $$
DECLARE
  clean_slug text := lower(trim(p_novo_slug));
  clean_id text := trim(COALESCE(p_identificador, ''));
  clean_digits text := regexp_replace(clean_id, '\D', '', 'g');
  found_lead_id uuid := NULL;
  found_user_id uuid := NULL;
BEGIN
  -- 1. Validação estrita do slug
  IF clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(clean_slug) < 3 OR length(clean_slug) > 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O código deve conter apenas letras minúsculas, números e hífens (entre 3 e 40 caracteres).');
  END IF;

  -- 2. Localização do registro por UUID, telefone, CPF, e-mail ou referral_code
  IF clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, user_id INTO found_lead_id, found_user_id FROM public.waitlist WHERE id = clean_id::uuid LIMIT 1;
    IF found_user_id IS NULL THEN
      SELECT id INTO found_user_id FROM public.usuarios WHERE id = clean_id::uuid LIMIT 1;
    END IF;
  END IF;

  IF found_lead_id IS NULL AND found_user_id IS NULL AND length(clean_digits) >= 8 THEN
    -- Busca por telefone ou CPF
    SELECT id, user_id INTO found_lead_id, found_user_id
      FROM public.waitlist
     WHERE regexp_replace(telefone, '\D', '', 'g') = clean_digits
        OR regexp_replace(cpf, '\D', '', 'g') = clean_digits
        OR right(regexp_replace(telefone, '\D', '', 'g'), 8) = right(clean_digits, 8)
     ORDER BY created_at_utc DESC NULLS LAST
     LIMIT 1;

    IF found_user_id IS NULL THEN
      SELECT id INTO found_user_id
        FROM public.usuarios
       WHERE regexp_replace(telefone, '\D', '', 'g') = clean_digits
          OR regexp_replace(cpf, '\D', '', 'g') = clean_digits
          OR right(regexp_replace(telefone, '\D', '', 'g'), 8) = right(clean_digits, 8)
       LIMIT 1;
    END IF;
  END IF;

  IF found_lead_id IS NULL AND found_user_id IS NULL AND clean_id <> '' THEN
    -- Busca por e-mail ou referral_code atual
    SELECT id, user_id INTO found_lead_id, found_user_id
      FROM public.waitlist
     WHERE lower(email) = lower(clean_id)
        OR lower(referral_code) = lower(clean_id)
     LIMIT 1;

    IF found_user_id IS NULL THEN
      SELECT id INTO found_user_id
        FROM public.usuarios
       WHERE lower(email) = lower(clean_id)
          OR lower(referral_code) = lower(clean_id)
       LIMIT 1;
    END IF;
  END IF;

  -- 3. Validação de Unicidade do novo slug
  IF EXISTS (
    SELECT 1 FROM public.usuarios
     WHERE lower(referral_code) = clean_slug
       AND (found_user_id IS NULL OR id <> found_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código de indicação já está em uso por outro fundador.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.waitlist
     WHERE lower(referral_code) = clean_slug
       AND (found_lead_id IS NULL OR id <> found_lead_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código de indicação já está em uso na lista de espera.');
  END IF;

  -- 4. Atualização
  IF found_lead_id IS NOT NULL THEN
    UPDATE public.waitlist
       SET referral_code = clean_slug,
           updated_at = now()
     WHERE id = found_lead_id;
  END IF;

  IF found_user_id IS NOT NULL THEN
    UPDATE public.usuarios
       SET referral_code = clean_slug,
           updated_at = now()
     WHERE id = found_user_id;
  END IF;

  -- Se não encontrou por ID específico mas achou por e-mail/telefone
  IF found_lead_id IS NULL AND found_user_id IS NULL AND clean_id <> '' THEN
    -- Tenta atualizar diretamente por match de telefone/cpf/email
    UPDATE public.waitlist
       SET referral_code = clean_slug,
           updated_at = now()
     WHERE lower(email) = lower(clean_id)
        OR (length(clean_digits) >= 8 AND (
              regexp_replace(telefone, '\D', '', 'g') = clean_digits
           OR regexp_replace(cpf, '\D', '', 'g') = clean_digits
           ));

    UPDATE public.usuarios
       SET referral_code = clean_slug,
           updated_at = now()
     WHERE lower(email) = lower(clean_id)
        OR (length(clean_digits) >= 8 AND (
              regexp_replace(telefone, '\D', '', 'g') = clean_digits
           OR regexp_replace(cpf, '\D', '', 'g') = clean_digits
           ));
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'referral_code', clean_slug,
    'message', 'Código de indicação salvo com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.salvar_slug_fundador(text, text) TO anon, authenticated, service_role;

-- 3. RPC concluir_atualizacao_cadastral (com suporte tanto a UUID quanto a TEXT)
DROP FUNCTION IF EXISTS public.concluir_atualizacao_cadastral(uuid, jsonb);
DROP FUNCTION IF EXISTS public.concluir_atualizacao_cadastral(text, jsonb);

CREATE OR REPLACE FUNCTION public.concluir_atualizacao_cadastral(
  p_lead_id text DEFAULT NULL,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_nome text := trim(COALESCE(p_dados->>'nome', ''));
  v_email text := lower(trim(COALESCE(p_dados->>'email', '')));
  v_telefone text := trim(COALESCE(p_dados->>'telefone', ''));
  v_cpf text := regexp_replace(COALESCE(p_dados->>'cpf', ''), '\D', '', 'g');
  v_cnpj text := regexp_replace(COALESCE(p_dados->>'cnpj', ''), '\D', '', 'g');
  v_tipo_pessoa text := COALESCE(p_dados->>'tipo_pessoa', 'PF');
  v_razao_social text := trim(COALESCE(p_dados->>'razao_social', ''));
  v_responsavel_legal text := trim(COALESCE(p_dados->>'responsavel_legal', ''));
  v_cpf_responsavel text := regexp_replace(COALESCE(p_dados->>'cpf_responsavel', ''), '\D', '', 'g');
  v_regiao_atuacao text := trim(COALESCE(p_dados->>'regiao_atuacao', ''));
  v_bairro_moradia text := trim(COALESCE(p_dados->>'bairro_moradia', ''));
  v_bairro_trabalho text := trim(COALESCE(p_dados->>'bairro_trabalho', ''));
  v_bairro_hospedagem text := trim(COALESCE(p_dados->>'bairro_hospedagem', ''));
  v_possui_mp boolean := NULL;
  v_chave_pix text := trim(COALESCE(p_dados->>'chave_pix', ''));
  v_tipo_chave_pix text := trim(COALESCE(p_dados->>'tipo_chave_pix', ''));
  v_observacoes text := trim(COALESCE(p_dados->>'observacoes', ''));
  v_user_id uuid := NULL;
  v_target_id uuid := NULL;
BEGIN
  -- Converte boolean possui_mp com segurança
  IF (p_dados->>'possui_conta_mercado_pago') IS NOT NULL THEN
    v_possui_mp := (p_dados->>'possui_conta_mercado_pago')::boolean;
  END IF;

  -- Converte user_id se fornecido
  IF (p_dados->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := (p_dados->>'user_id')::uuid;
  END IF;

  -- Converte p_lead_id se fornecido no formato UUID
  IF p_lead_id IS NOT NULL AND p_lead_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_target_id := p_lead_id::uuid;
  END IF;

  -- Se v_target_id não for informado, tenta buscar por email ou telefone
  IF v_target_id IS NULL THEN
    SELECT id INTO v_target_id
      FROM public.waitlist
     WHERE (v_email <> '' AND lower(email) = v_email)
        OR (length(v_telefone) >= 8 AND regexp_replace(telefone, '\D', '', 'g') = regexp_replace(v_telefone, '\D', '', 'g'))
     ORDER BY created_at_utc DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- 1. Atualizar na waitlist
  IF v_target_id IS NOT NULL THEN
    UPDATE public.waitlist
       SET nome = CASE WHEN v_nome <> '' THEN v_nome ELSE nome END,
           email = CASE WHEN v_email <> '' THEN v_email ELSE email END,
           telefone = CASE WHEN v_telefone <> '' THEN v_telefone ELSE telefone END,
           cpf = CASE WHEN v_cpf <> '' THEN v_cpf ELSE cpf END,
           cnpj = CASE WHEN v_cnpj <> '' THEN v_cnpj ELSE cnpj END,
           tipo_pessoa = v_tipo_pessoa,
           razao_social = CASE WHEN v_razao_social <> '' THEN v_razao_social ELSE razao_social END,
           responsavel_legal = CASE WHEN v_responsavel_legal <> '' THEN v_responsavel_legal ELSE responsavel_legal END,
           cpf_responsavel = CASE WHEN v_cpf_responsavel <> '' THEN v_cpf_responsavel ELSE cpf_responsavel END,
           regiao_atuacao = CASE WHEN v_regiao_atuacao <> '' THEN v_regiao_atuacao ELSE regiao_atuacao END,
           bairro_moradia = CASE WHEN v_bairro_moradia <> '' THEN v_bairro_moradia ELSE bairro_moradia END,
           bairro_trabalho = CASE WHEN v_bairro_trabalho <> '' THEN v_bairro_trabalho ELSE bairro_trabalho END,
           bairro_hospedagem = CASE WHEN v_bairro_hospedagem <> '' THEN v_bairro_hospedagem ELSE bairro_hospedagem END,
           possui_conta_mercado_pago = COALESCE(v_possui_mp, possui_conta_mercado_pago),
           chave_pix = CASE WHEN v_chave_pix <> '' THEN v_chave_pix ELSE chave_pix END,
           tipo_chave_pix = CASE WHEN v_tipo_chave_pix <> '' THEN v_tipo_chave_pix ELSE tipo_chave_pix END,
           observacoes = CASE WHEN v_observacoes <> '' THEN v_observacoes ELSE observacoes END,
           user_id = COALESCE(v_user_id, user_id),
           cadastro_completo = true,
           status = 'completo',
           updated_at = now()
     WHERE id = v_target_id;
  END IF;

  -- 2. Sincronizar na tabela public.usuarios se houver user_id
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.usuarios (
      id, nome, email, telefone, cpf, cnpj, tipo_pessoa,
      responsavel_legal, cpf_responsavel, regiao_atuacao,
      chave_pix, tipo_chave_pix, bairro_moradia, bairro_trabalho, status, updated_at
    ) VALUES (
      v_user_id, v_nome, v_email, v_telefone, v_cpf, v_cnpj, v_tipo_pessoa,
      v_responsavel_legal, v_cpf_responsavel, v_regiao_atuacao,
      v_chave_pix, v_tipo_chave_pix, v_bairro_moradia, v_bairro_trabalho, 'completo', now()
    )
    ON CONFLICT (id) DO UPDATE
      SET nome = CASE WHEN EXCLUDED.nome <> '' THEN EXCLUDED.nome ELSE usuarios.nome END,
          email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE usuarios.email END,
          telefone = CASE WHEN EXCLUDED.telefone <> '' THEN EXCLUDED.telefone ELSE usuarios.telefone END,
          cpf = CASE WHEN EXCLUDED.cpf <> '' THEN EXCLUDED.cpf ELSE usuarios.cpf END,
          cnpj = CASE WHEN EXCLUDED.cnpj <> '' THEN EXCLUDED.cnpj ELSE usuarios.cnpj END,
          tipo_pessoa = EXCLUDED.tipo_pessoa,
          chave_pix = CASE WHEN EXCLUDED.chave_pix <> '' THEN EXCLUDED.chave_pix ELSE usuarios.chave_pix END,
          tipo_chave_pix = CASE WHEN EXCLUDED.tipo_chave_pix <> '' THEN EXCLUDED.tipo_chave_pix ELSE usuarios.tipo_chave_pix END,
          bairro_moradia = CASE WHEN EXCLUDED.bairro_moradia <> '' THEN EXCLUDED.bairro_moradia ELSE usuarios.bairro_moradia END,
          bairro_trabalho = CASE WHEN EXCLUDED.bairro_trabalho <> '' THEN EXCLUDED.bairro_trabalho ELSE usuarios.bairro_trabalho END,
          status = 'completo',
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', v_target_id,
    'user_id', v_user_id,
    'message', 'Cadastro concluído com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overload que aceita UUID diretamente
CREATE OR REPLACE FUNCTION public.concluir_atualizacao_cadastral(
  p_lead_id uuid,
  p_dados jsonb
)
RETURNS jsonb AS $$
BEGIN
  RETURN public.concluir_atualizacao_cadastral(p_lead_id::text, p_dados);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.concluir_atualizacao_cadastral(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.concluir_atualizacao_cadastral(uuid, jsonb) TO anon, authenticated, service_role;

COMMIT;
