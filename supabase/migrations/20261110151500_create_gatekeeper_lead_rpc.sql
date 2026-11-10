-- ==============================================================================
-- MIGRATION: 20261110151500_create_gatekeeper_lead_rpc.sql
-- Descrição:
--   Criação da RPC public.obter_gatekeeper_lead para suporte ao Gatekeeper de
--   segurança do Wizard de Atualização Cadastral.
--   Retorna estritamente metadados seguros (email para login e hashes SHA-256
--   de documentos cadastrados), sem vazar dados sensíveis para clientes anônimos.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.obter_gatekeeper_lead(p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_last8 text;
  v_lead RECORD;
  v_is_pj boolean;
  v_hashes text[] := ARRAY[]::text[];
  v_cnpj_clean text;
  v_cpf_clean text;
  v_resp_cpf_clean text;
BEGIN
  v_digits := regexp_replace(COALESCE(p_identificador, ''), '\D', '', 'g');
  IF length(v_digits) > 10 AND v_digits LIKE '55%' THEN
    v_digits := substr(v_digits, 3);
  END IF;

  IF length(v_digits) < 8 THEN
    RETURN jsonb_build_object('encontrado', false, 'erro', 'Telefone com formato inválido');
  END IF;

  v_last8 := right(v_digits, 8);

  SELECT 
    id, email, tipo_pessoa, tipo_cadastro, cnpj, cpf, 
    responsavel_cpf, cpf_responsavel, razao_social, nome, telefone
  INTO v_lead
  FROM public.waitlist
  WHERE telefone = v_digits
     OR regexp_replace(telefone, '\D', '', 'g') = v_digits
     OR telefone ILIKE '%' || v_last8
  ORDER BY created_at_utc DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND OR v_lead.id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  v_is_pj := COALESCE(
    (
      v_lead.tipo_cadastro IN ('pj', 'PJ', 'associacao') 
      OR v_lead.tipo_pessoa = 'PJ'
      OR v_lead.cnpj IS NOT NULL 
      OR v_lead.razao_social IS NOT NULL
    ),
    false
  );

  v_cnpj_clean := regexp_replace(COALESCE(v_lead.cnpj, ''), '\D', '', 'g');
  v_cpf_clean := regexp_replace(COALESCE(v_lead.cpf, ''), '\D', '', 'g');
  v_resp_cpf_clean := regexp_replace(COALESCE(v_lead.responsavel_cpf, v_lead.cpf_responsavel, ''), '\D', '', 'g');

  IF v_cnpj_clean != '' THEN
    v_hashes := array_append(v_hashes, encode(sha256(v_cnpj_clean::bytea), 'hex'));
  END IF;

  IF v_cpf_clean != '' THEN
    v_hashes := array_append(v_hashes, encode(sha256(v_cpf_clean::bytea), 'hex'));
  END IF;

  IF v_resp_cpf_clean != '' AND v_resp_cpf_clean != v_cpf_clean THEN
    v_hashes := array_append(v_hashes, encode(sha256(v_resp_cpf_clean::bytea), 'hex'));
  END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'id', v_lead.id,
    'email', v_lead.email,
    'is_pj', v_is_pj,
    'tipo_documento', CASE WHEN v_is_pj THEN 'CNPJ' ELSE 'CPF' END,
    'doc_hashes', v_hashes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_gatekeeper_lead(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload config';

COMMIT;
