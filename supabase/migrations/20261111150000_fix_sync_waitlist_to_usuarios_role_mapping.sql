-- Migration: Fix sync_waitlist_to_usuarios role mapping to avoid check constraint 23514
-- Description: Maps waitlist roles (e.g. 'morador', 'turista') to valid usuarios role ('tomador')
-- while preserving 'prestador', 'admin', 'associacao'.

CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_pj boolean;
  v_role text;
BEGIN
  -- Auto-confirmação de email no auth.users
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
  ELSIF NEW.role IN ('prestador', 'trabalhador') THEN
    v_role := 'prestador';
  ELSIF NEW.role IN ('admin', 'superadmin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'tomador';
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
        'role_waitlist', NEW.role,
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
