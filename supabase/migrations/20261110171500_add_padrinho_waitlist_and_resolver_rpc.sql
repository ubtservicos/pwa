-- Migration: 20261110171500_add_padrinho_waitlist_and_resolver_rpc.sql
-- Description: Adiciona padrinho_id na public.waitlist, cria RPC resolver_padrinho_slug e atualiza trigger sync_waitlist_to_usuarios

-- 1. Adiciona coluna de vínculo na public.waitlist com Foreign Key para usuarios
ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS padrinho_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_slug text;

CREATE INDEX IF NOT EXISTS idx_waitlist_padrinho_id ON public.waitlist(padrinho_id);

-- 2. RPC de Resolução de Slug (converte slug/código textual em UUID do padrinho sem expor PII)
CREATE OR REPLACE FUNCTION public.resolver_padrinho_slug(p_slug text)
RETURNS TABLE (
  padrinho_id uuid,
  nome_exibicao text,
  tipo_padrinho text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_slug text := lower(trim(p_slug));
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS padrinho_id,
    COALESCE(u.nome, 'Padrinho UBT')::text AS nome_exibicao,
    u.role::text AS tipo_padrinho
  FROM public.usuarios u
  LEFT JOIN public.waitlist w ON w.user_id = u.id OR w.telefone = u.telefone
  WHERE lower(w.referral_slug) = v_clean_slug
     OR lower(w.referral_code) = v_clean_slug
     OR lower(u.referral_code) = v_clean_slug
     OR lower(u.metadata->>'referral_slug') = v_clean_slug
     OR lower(u.metadata->>'referral_code') = v_clean_slug
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_padrinho_slug(text) TO anon, authenticated;

-- 3. Atualiza trigger sync_waitlist_to_usuarios para propagar padrinho_id
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
BEGIN
  -- Auto-confirmação de email (sem tentar escrever na coluna gerada confirmed_at)
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email = NEW.email AND email_confirmed_at IS NULL;

  -- Identificação de PJ
  v_is_pj := (
    NEW.tipo_cadastro IN ('pj', 'associacao', 'PJ')
    OR NEW.cnpj IS NOT NULL
    OR NEW.razao_social IS NOT NULL
  );

  IF v_is_pj THEN
    v_role := 'associacao';
  ELSE
    v_role := COALESCE(NEW.role, 'tomador');
  END IF;

  IF NEW.cadastro_completo = true OR NEW.status IN ('aprovado', 'approved') THEN
    INSERT INTO public.usuarios (
      id,
      nome,
      email,
      telefone,
      role,
      status,
      cpf,
      cnpj,
      padrinho_id,
      metadata
    ) VALUES (
      COALESCE(NEW.user_id, gen_random_uuid()),
      COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, 'Novo Usuário'),
      NEW.email,
      NEW.telefone,
      v_role,
      'ativo',
      COALESCE(NEW.cpf, NEW.responsavel_cpf),
      NEW.cnpj,
      NEW.padrinho_id,
      jsonb_build_object(
        'origem', CASE WHEN NEW.padrinho_id IS NOT NULL THEN 'indicacao' ELSE 'direto' END,
        'tipo_cadastro', CASE WHEN v_is_pj THEN 'pj' ELSE 'pf' END,
        'razao_social', NEW.razao_social,
        'cnpj', NEW.cnpj,
        'status_waitlist', NEW.status,
        'cadastro_completo', NEW.cadastro_completo
      )
    )
    ON CONFLICT (telefone) DO UPDATE SET
      nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
      email = COALESCE(EXCLUDED.email, public.usuarios.email),
      role = EXCLUDED.role,
      cnpj = COALESCE(EXCLUDED.cnpj, public.usuarios.cnpj),
      padrinho_id = COALESCE(public.usuarios.padrinho_id, EXCLUDED.padrinho_id),
      status = 'ativo',
      metadata = public.usuarios.metadata || EXCLUDED.metadata,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload config';
