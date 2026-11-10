-- Migration: 20261110174000_create_obter_meus_apadrinhados_rpc.sql
-- Description: Garante created_at em waitlist e cria RPC obter_meus_apadrinhados

-- 1. Garante coluna created_at timestamptz em waitlist
ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.waitlist 
SET created_at = COALESCE(created_at, created_at_utc, now())
WHERE created_at IS NULL;

-- 2. RPC para obter apadrinhados de um usuário específico (para o painel /app/indicacao)
DROP FUNCTION IF EXISTS public.obter_meus_apadrinhados(uuid);

CREATE OR REPLACE FUNCTION public.obter_meus_apadrinhados(p_padrinho_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  tipo_cadastro text,
  status text,
  cadastro_completo boolean,
  criado_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    COALESCE(w.razao_social, w.nome, 'Membro Fundador')::text AS nome,
    COALESCE(w.tipo_cadastro, 'pf')::text AS tipo_cadastro,
    w.status::text,
    COALESCE(w.cadastro_completo, false) AS cadastro_completo,
    COALESCE(w.created_at, w.created_at_utc, now()) AS criado_em
  FROM public.waitlist w
  WHERE w.padrinho_id = p_padrinho_id
  ORDER BY COALESCE(w.created_at, w.created_at_utc, now()) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_meus_apadrinhados(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload config';
