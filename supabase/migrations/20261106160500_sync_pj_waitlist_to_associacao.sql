-- Migration: 20261106160500_sync_pj_waitlist_to_associacao.sql
-- Descrição: Atualiza sync_waitlist_to_usuarios para atribuir role='associacao' e sincronizar com entidades/associações.

CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$ 
DECLARE 
  v_is_pj boolean; 
  v_role text; 
BEGIN 
  -- Identifica se é PJ pelo tipo_cadastro, cnpj ou razao_social 
  v_is_pj := ( 
    NEW.tipo_cadastro IN ('pj', 'associacao', 'PJ') 
    OR NEW.tipo_cadastro ILIKE 'pj'
    OR NEW.tipo_cadastro ILIKE 'associacao'
    OR NEW.cnpj IS NOT NULL 
    OR NEW.razao_social IS NOT NULL 
  );    

  -- Define o role correto respeitando a check constraint ('tomador', 'prestador', 'admin', 'associacao') 
  IF v_is_pj THEN 
    v_role := 'associacao'; 
  ELSE 
    v_role := COALESCE(NEW.role, 'tomador'); 
  END IF;    

  -- Sincroniza se o cadastro foi marcado como completo OU se foi aprovado 
  IF NEW.cadastro_completo = true OR NEW.status IN ('aprovado', 'approved') THEN  
    -- 1. Sincroniza em public.usuarios com o role correto 
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
      COALESCE(NEW.razao_social, NEW.nome, NEW.responsavel_nome, 'Nova Entidade'), 
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
      status = 'ativo', 
      cnpj = COALESCE(EXCLUDED.cnpj, public.usuarios.cnpj),
      metadata = public.usuarios.metadata || EXCLUDED.metadata, 
      updated_at = now();      

    -- 2. Se existir a tabela public.entidades, garanta a inserção/upsert da entidade correspondente 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entidades') THEN 
      IF v_is_pj THEN 
        INSERT INTO public.entidades ( 
          nome, 
          razao_social, 
          cnpj, 
          email, 
          telefone, 
          responsavel_nome, 
          status, 
          created_at 
        ) VALUES ( 
          COALESCE(NEW.razao_social, NEW.nome), 
          NEW.razao_social, 
          NEW.cnpj, 
          NEW.email, 
          NEW.telefone, 
          NEW.responsavel_nome, 
          'ativo', 
          now() 
        ) 
        ON CONFLICT (cnpj) DO UPDATE SET 
          nome = EXCLUDED.nome, 
          telefone = EXCLUDED.telefone, 
          responsavel_nome = EXCLUDED.responsavel_nome, 
          status = 'ativo'; 
      END IF; 
    END IF;    
  END IF;  
  RETURN NEW; 
END; 
$$;

-- Corrige retroativamente os cadastros PJ já existentes em Homologação
UPDATE public.usuarios u
SET 
  role = 'associacao',
  cnpj = COALESCE(u.cnpj, w.cnpj),
  metadata = u.metadata || jsonb_build_object(
    'tipo_cadastro', 'pj',
    'razao_social', w.razao_social,
    'cnpj', w.cnpj
  )
FROM public.waitlist w
WHERE u.telefone = w.telefone
  AND (
    w.tipo_cadastro IN ('pj', 'associacao', 'PJ') 
    OR w.tipo_cadastro ILIKE 'pj'
    OR w.tipo_cadastro ILIKE 'associacao'
    OR w.cnpj IS NOT NULL 
    OR w.razao_social IS NOT NULL
  );

NOTIFY pgrst, 'reload config';
