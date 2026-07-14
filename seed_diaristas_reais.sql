-- seed_diaristas_reais.sql
-- Script de população de dados reais no banco de dados Supabase para Diaristas

-- 1. Habilitar política permissiva (padrão de desenvolvimento do projeto)
ALTER TABLE public.diarista_agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All diarista_agendamentos" ON public.diarista_agendamentos;
CREATE POLICY "Allow All diarista_agendamentos" ON public.diarista_agendamentos FOR ALL USING (true) WITH CHECK (true);

-- 2. Limpar dados de teste antigos para evitar conflitos de IDs e constraints
DELETE FROM public.diarista_agendamentos WHERE id IN (
  -- Felipe Santander (prefix f)
  'f1111111-1111-1111-1111-111111111111',
  'f2222222-2222-2222-2222-222222222222',
  'f3333333-3333-3333-3333-333333333333',
  'f4444444-4444-4444-4444-444444444444',
  -- Maria Silva (prefix e)
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444',
  -- João Souza (prefix d)
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444'
);

DELETE FROM public.profiles WHERE id IN (
  'aa111111-1111-1111-1111-111111111111',
  'bb222222-2222-2222-2222-222222222222',
  'cc333333-3333-3333-3333-333333333333',
  'dd444444-4444-4444-4444-444444444444'
);

DELETE FROM public.usuarios WHERE id IN (
  'aa111111-1111-1111-1111-111111111111',
  'bb222222-2222-2222-2222-222222222222',
  'cc333333-3333-3333-3333-333333333333',
  'dd444444-4444-4444-4444-444444444444'
);

DELETE FROM auth.users WHERE id IN (
  'aa111111-1111-1111-1111-111111111111',
  'bb222222-2222-2222-2222-222222222222',
  'cc333333-3333-3333-3333-333333333333',
  'dd444444-4444-4444-4444-444444444444'
);

-- 3. Habilitar a extensão pgcrypto se não estiver ativa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4. Inserir os usuários de teste em auth.users (necessário para a FK em public.profiles)
INSERT INTO auth.users (
  id, 
  instance_id, 
  aud, 
  role, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at
) VALUES 
  (
    'aa111111-1111-1111-1111-111111111111', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'amanda.lima@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Amanda Lima"}', 
    now(), 
    now()
  ),
  (
    'bb222222-2222-2222-2222-222222222222', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'carlos.silveira@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Carlos Silveira"}', 
    now(), 
    now()
  ),
  (
    'cc333333-3333-3333-3333-333333333333', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'bruna.santos@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Bruna Santos"}', 
    now(), 
    now()
  ),
  (
    'dd444444-4444-4444-4444-444444444444', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'renato.albuquerque@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Renato Albuquerque"}', 
    now(), 
    now()
  );

-- 5. Inserir Clientes de Teste na tabela public.usuarios
INSERT INTO public.usuarios (id, nome, role) VALUES
  ('aa111111-1111-1111-1111-111111111111', 'Amanda Lima', 'tomador'),
  ('bb222222-2222-2222-2222-222222222222', 'Carlos Silveira', 'tomador'),
  ('cc333333-3333-3333-3333-333333333333', 'Bruna Santos', 'tomador'),
  ('dd444444-4444-4444-4444-444444444444', 'Renato Albuquerque', 'tomador')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  role = EXCLUDED.role;

-- 6. Inserir Clientes de Teste na tabela public.profiles
INSERT INTO public.profiles (id, name, role) VALUES
  ('aa111111-1111-1111-1111-111111111111', 'Amanda Lima', 'tomador'),
  ('bb222222-2222-2222-2222-222222222222', 'Carlos Silveira', 'tomador'),
  ('cc333333-3333-3333-3333-333333333333', 'Bruna Santos', 'tomador'),
  ('dd444444-4444-4444-4444-444444444444', 'Renato Albuquerque', 'tomador')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- 7. Inserir Agendamentos Reais para Felipe Santander (4db6e8a4-535f-4a77-9dba-8f3861f8b4dd)
INSERT INTO public.diarista_agendamentos (
  id, diarista_id, tomador_id, status, data, hora, local, materiais_solicitados, valor_base, valor_materiais, valor_total, notes
) VALUES
  (
    'f1111111-1111-1111-1111-111111111111',
    '4db6e8a4-535f-4a77-9dba-8f3861f8b4dd',
    'aa111111-1111-1111-1111-111111111111', -- Amanda Lima
    'confirmed',
    CURRENT_DATE, -- Hoje
    '08:30',
    '{"endereco": "Rua Dom Pedro, 450 - Itaguá", "m2": 90}'::jsonb,
    ARRAY['basico']::text[],
    180.00,
    20.00,
    200.00,
    'Favor focar na limpeza da cozinha e banheiros.'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    '4db6e8a4-535f-4a77-9dba-8f3861f8b4dd',
    'bb222222-2222-2222-2222-222222222222', -- Carlos Silveira
    'pending_confirm',
    CURRENT_DATE, -- Hoje
    '14:00',
    '{"endereco": "Av. Iperoig, 122 - Centro", "m2": 120}'::jsonb,
    ARRAY[]::text[],
    240.00,
    0.00,
    240.00,
    'Preciso de limpeza simples pós-mudança.'
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    '4db6e8a4-535f-4a77-9dba-8f3861f8b4dd',
    'cc333333-3333-3333-3333-333333333333', -- Bruna Santos
    'confirmed',
    CURRENT_DATE + 1, -- Amanhã
    '09:00',
    '{"endereco": "Rua das Toninhas, 78 - Praia Grande", "m2": 80}'::jsonb,
    ARRAY['detergente', 'agua_sanitaria', 'desinfetante', 'multiuso', 'desengordurante', 'pano_microfibra', 'pano_chao', 'esponja', 'luvas', 'limpa_vidros']::text[],
    160.00,
    64.65,
    224.65,
    'Tenho cachorro no quintal, mas é manso.'
  ),
  (
    'f4444444-4444-4444-4444-444444444444',
    '4db6e8a4-535f-4a77-9dba-8f3861f8b4dd',
    'dd444444-4444-4444-4444-444444444444', -- Renato Albuquerque
    'pending_confirm',
    CURRENT_DATE + 1, -- Amanhã
    '15:00',
    '{"endereco": "Av. Leovigildo Dias Vieira, 420 - Itaguá", "m2": 60}'::jsonb,
    ARRAY[]::text[],
    120.00,
    0.00,
    120.00,
    'Limpeza rápida de apartamento de 1 quarto.'
  );

-- 8. Inserir Agendamentos Reais para Maria Silva (11111111-1111-1111-1111-111111111111)
INSERT INTO public.diarista_agendamentos (
  id, diarista_id, tomador_id, status, data, hora, local, materiais_solicitados, valor_base, valor_materiais, valor_total, notes
) VALUES
  (
    'e1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aa111111-1111-1111-1111-111111111111',
    'confirmed',
    CURRENT_DATE,
    '08:30',
    '{"endereco": "Rua Dom Pedro, 450 - Itaguá", "m2": 90}'::jsonb,
    ARRAY['basico']::text[],
    180.00,
    20.00,
    200.00,
    'Favor focar na limpeza da cozinha e banheiros.'
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'bb222222-2222-2222-2222-222222222222',
    'pending_confirm',
    CURRENT_DATE,
    '14:00',
    '{"endereco": "Av. Iperoig, 122 - Centro", "m2": 120}'::jsonb,
    ARRAY[]::text[],
    240.00,
    0.00,
    240.00,
    'Preciso de limpeza simples pós-mudança.'
  ),
  (
    'e3333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'cc333333-3333-3333-3333-333333333333',
    'confirmed',
    CURRENT_DATE + 1,
    '09:00',
    '{"endereco": "Rua das Toninhas, 78 - Praia Grande", "m2": 80}'::jsonb,
    ARRAY['detergente', 'agua_sanitaria', 'desinfetante', 'multiuso', 'desengordurante', 'pano_microfibra', 'pano_chao', 'esponja', 'luvas', 'limpa_vidros']::text[],
    160.00,
    64.65,
    224.65,
    'Tenho cachorro no quintal, mas é manso.'
  ),
  (
    'e4444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'dd444444-4444-4444-4444-444444444444',
    'pending_confirm',
    CURRENT_DATE + 1,
    '15:00',
    '{"endereco": "Av. Leovigildo Dias Vieira, 420 - Itaguá", "m2": 60}'::jsonb,
    ARRAY[]::text[],
    120.00,
    0.00,
    120.00,
    'Limpeza rápida de apartamento de 1 quarto.'
  );

-- 9. Inserir Agendamentos Reais para João Souza (22222222-2222-2222-2222-222222222222)
INSERT INTO public.diarista_agendamentos (
  id, diarista_id, tomador_id, status, data, hora, local, materiais_solicitados, valor_base, valor_materiais, valor_total, notes
) VALUES
  (
    'd1111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'aa111111-1111-1111-1111-111111111111',
    'confirmed',
    CURRENT_DATE,
    '08:30',
    '{"endereco": "Rua Dom Pedro, 450 - Itaguá", "m2": 90}'::jsonb,
    ARRAY['basico']::text[],
    180.00,
    20.00,
    200.00,
    'Favor focar na limpeza da cozinha e banheiros.'
  ),
  (
    'd2222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'bb222222-2222-2222-2222-222222222222',
    'pending_confirm',
    CURRENT_DATE,
    '14:00',
    '{"endereco": "Av. Iperoig, 122 - Centro", "m2": 120}'::jsonb,
    ARRAY[]::text[],
    240.00,
    0.00,
    240.00,
    'Preciso de limpeza simples pós-mudança.'
  ),
  (
    'd3333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'cc333333-3333-3333-3333-333333333333',
    'confirmed',
    CURRENT_DATE + 1,
    '09:00',
    '{"endereco": "Rua das Toninhas, 78 - Praia Grande", "m2": 80}'::jsonb,
    ARRAY['detergente', 'agua_sanitaria', 'desinfetante', 'multiuso', 'desengordurante', 'pano_microfibra', 'pano_chao', 'esponja', 'luvas', 'limpa_vidros']::text[],
    160.00,
    64.65,
    224.65,
    'Tenho cachorro no quintal, mas é manso.'
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'dd444444-4444-4444-4444-444444444444',
    'pending_confirm',
    CURRENT_DATE + 1,
    '15:00',
    '{"endereco": "Av. Leovigildo Dias Vieira, 420 - Itaguá", "m2": 60}'::jsonb,
    ARRAY[]::text[],
    120.00,
    0.00,
    120.00,
    'Limpeza rápida de apartamento de 1 quarto.'
  );

-- 10. Recarregar o cache de esquemas
NOTIFY pgrst, 'reload schema';
