-- Migration: 20261110162000_auto_confirm_email_auth.sql
-- Description: Confirma retroativamente usuários pendentes no Supabase Auth,
-- atualiza a trigger sync_waitlist_to_usuarios para auto-confirmar e-mail e cria a RPC confirmar_email_lead.

-- 1. Confirma retroativamente todos os usuários pendentes no Supabase Auth
-- Observação: confirmed_at é uma coluna gerada (GENERATED ALWAYS AS LEAST(email_confirmed_at, phone_confirmed_at)),
-- portanto atualizar email_confirmed_at atualiza confirmed_at automaticamente.
UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. Atualiza a trigger sync_waitlist_to_usuarios para garantir que qualquer usuário inserido/atualizado tenha o e-mail confirmado imediatamente
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
BEGIN
  -- Auto-confirma o e-mail em auth.users se existir
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email = NEW.email AND email_confirmed_at IS NULL;

  -- Identifica se o lead é PJ
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
      jsonb_build_object(
        'origem', 'waitlist_founder',
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
      status = 'ativo',
      metadata = public.usuarios.metadata || EXCLUDED.metadata,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Cria uma RPC administrativa para confirmar e-mail em caso de fallback
CREATE OR REPLACE FUNCTION public.confirmar_email_lead(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE email = p_email AND email_confirmed_at IS NULL;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_email_lead(text) TO anon, authenticated;

NOTIFY pgrst, 'reload config';
