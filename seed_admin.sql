-- ==============================================================================
-- UBT SERVICES & CÔCO & CIA · SCRIPT DE PROVISIONAMENTO DE USUÁRIO ADMINISTRATIVO
-- ==============================================================================
-- Instruções:
-- 1. Abra o painel do Supabase (https://supabase.com/dashboard) no projeto de Produção.
-- 2. Navegue até o "SQL Editor" no menu lateral esquerdo.
-- 3. Cole este script completo e clique em "Run" (Executar).
-- 4. O usuário cocoecia@teste.com estará pronto para autenticação com a senha: 123456
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'cocoecia@teste.com';
  v_password TEXT := '123456';
  v_encrypted_pw TEXT;
BEGIN
  -- 1. Gerar Hash Bcrypt seguro
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  -- 2. Verificar se o usuário já existe em auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- Criar novo ID
    v_user_id := gen_random_uuid();

    -- Inserir em auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"cocoecia","nome":"Gestor Côco & Cia","name":"Gestor Côco & Cia"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Inserir identidade em auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_email,
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Usuário % criado com sucesso em auth.users (ID: %).', v_email, v_user_id;
  ELSE
    -- Se já existia, atualiza a senha e confirmação de e-mail
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = '{"role":"cocoecia","nome":"Gestor Côco & Cia","name":"Gestor Côco & Cia"}'::jsonb,
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuário % já existente. Senha e metadados atualizados (ID: %).', v_email, v_user_id;
  END IF;

  -- 3. Inserir ou Atualizar em public.profiles (se a tabela existir)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    INSERT INTO public.profiles (id, email, role, full_name, updated_at)
    VALUES (v_user_id, v_email, 'cocoecia', 'Gestor Côco & Cia', now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'cocoecia', full_name = 'Gestor Côco & Cia', updated_at = now();
    
    RAISE NOTICE 'Registro sincronizado na tabela public.profiles.';
  END IF;

  -- 4. Inserir ou Atualizar em public.usuarios (se a tabela existir)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
    INSERT INTO public.usuarios (id, email, role, nome, created_at)
    VALUES (v_user_id, v_email, 'cocoecia', 'Gestor Côco & Cia', now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'cocoecia', nome = 'Gestor Côco & Cia';
    
    RAISE NOTICE 'Registro sincronizado na tabela public.usuarios.';
  END IF;

END $$;

-- Verificação final do provisionamento:
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.raw_user_meta_data->>'role' as auth_role
FROM auth.users u
WHERE u.email = 'cocoecia@teste.com';
