-- ==============================================================================
-- MIGRATION: 20261028160000_unify_concluir_atualizacao_cadastral.sql
-- Descrição:
--   Unificação da RPC concluir_atualizacao_cadastral no schema public,
--   removendo todas as sobrecargas anteriores para eliminar erro PGRST203.
-- ==============================================================================

BEGIN;

-- 1. Remove dinamicamente todas as versões e sobrecargas anteriores
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND proname = 'concluir_atualizacao_cadastral'
    ) LOOP
        EXECUTE 'DROP FUNCTION public.concluir_atualizacao_cadastral(' || r.args || ')';
    END LOOP;
END $$;

-- 2. Cria assinatura canônica unificada recebendo parâmetros tipados
CREATE OR REPLACE FUNCTION public.concluir_atualizacao_cadastral(
    p_lead_id uuid,
    p_senha text,
    p_bairro_residencia text,
    p_regioes text[],
    p_bairros_atuacao text[],
    p_praias text[],
    p_possui_mp boolean,
    p_tipo_chave_pix text,
    p_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.waitlist
    SET 
        cadastro_completo = true,
        status = 'completo',
        bairro_residencia = p_bairro_residencia,
        bairro = p_bairro_residencia,
        bairro_moradia = COALESCE(bairro_moradia, p_bairro_residencia),
        regioes = p_regioes,
        bairros_atuacao = p_bairros_atuacao,
        bairros = p_bairros_atuacao,
        praias = p_praias,
        possui_mercado_pago = p_possui_mp,
        possui_conta_mercado_pago = p_possui_mp,
        tipo_chave_pix = p_tipo_chave_pix,
        chave_pix = p_chave_pix,
        updated_at = now()
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.concluir_atualizacao_cadastral(
    uuid, text, text, text[], text[], text[], boolean, text, text
) TO anon, authenticated, service_role;

COMMIT;

-- Notifica o PostgREST para recarregar o schema cache imediatamente:
NOTIFY pgrst, 'reload config';
