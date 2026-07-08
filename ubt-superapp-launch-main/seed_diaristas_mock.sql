-- 1. Remove dados antigos para evitar conflitos de chaves primárias ou emails
DELETE FROM public.diarista_perfis WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '60e0a5ba-1941-4c7d-8153-f72be1c70e06');
DELETE FROM public.usuarios WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '60e0a5ba-1941-4c7d-8153-f72be1c70e06');
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '60e0a5ba-1941-4c7d-8153-f72be1c70e06');

-- 2. Habilita a extensão pgcrypto se não estiver ativa (usada para criptografia de senha)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. Insere os usuários de teste em auth.users (necessário para a chave estrangeira em public.profiles)
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
    '11111111-1111-1111-1111-111111111111', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'maria.silva@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"Maria Silva"}', 
    now(), 
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'joao.souza@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"João Souza"}', 
    now(), 
    now()
  ),
  (
    '60e0a5ba-1941-4c7d-8153-f72be1c70e06', 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'joao.surfista@example.com', 
    crypt('senha123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"full_name":"João Surfista"}', 
    now(), 
    now()
  );

-- 4. Insere em public.usuarios (usado para RLS/regras de negócios do superapp)
INSERT INTO public.usuarios (id, nome, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Maria Silva', 'prestador'),
  ('22222222-2222-2222-2222-222222222222', 'João Souza', 'prestador'),
  ('60e0a5ba-1941-4c7d-8153-f72be1c70e06', 'João Surfista', 'tomador')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  role = EXCLUDED.role;

-- 5. Corrige a restrição de roles da tabela public.profiles para permitir 'prestador' e 'tomador'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Atualiza qualquer linha existente com role inválido ou nulo para 'user' para evitar falhas na validação do check constraint
UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL OR role NOT IN ('tomador', 'prestador', 'admin', 'client', 'provider', 'user', 'authenticated');

-- Adiciona a restrição permitindo os novos roles bem como os padrões e 'authenticated'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('tomador', 'prestador', 'admin', 'client', 'provider', 'user', 'authenticated'));

-- 6. Insere ou atualiza os perfis correspondentes em public.profiles (evitando erro se o trigger de auth.users já os criou)
INSERT INTO public.profiles (id, name, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Maria Silva', 'prestador'),
  ('22222222-2222-2222-2222-222222222222', 'João Souza', 'prestador'),
  ('60e0a5ba-1941-4c7d-8153-f72be1c70e06', 'João Surfista', 'tomador')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- 7. Garante que a tabela public.diarista_perfis tem a coluna nome
ALTER TABLE public.diarista_perfis ADD COLUMN IF NOT EXISTS nome TEXT;

-- 8. Insere as prestadoras diaristas
INSERT INTO public.diarista_perfis (
  user_id, nome, cpf, sexo, endereco, valor_por_m2, minimo_m2, materiais, disponibilidade, horarios_por_dia, rating, total_servicos
)
VALUES
(
  '11111111-1111-1111-1111-111111111111', 
  'Maria Silva', 
  '111.111.111-11', 
  'feminino', 
  '"Centro, Itaguá"'::jsonb, 
  3.50, 
  40, 
  ARRAY['vassoura', 'luvas']::text[], 
  '{"seg": true, "qua": true, "sex": true}'::jsonb, 
  '{"seg": ["08:00", "09:00", "14:00"], "qua": ["08:00", "09:00", "14:00"], "sex": ["08:00", "09:00", "14:00"]}'::jsonb,
  4.8, 
  12
),
(
  '22222222-2222-2222-2222-222222222222', 
  'João Souza', 
  '222.222.222-22', 
  'masculino', 
  '"Perequê-Açu"'::jsonb, 
  3.00, 
  30, 
  ARRAY['vassoura', 'produtos']::text[], 
  '{"ter": true, "qui": true, "sab": true}'::jsonb, 
  '{"ter": ["10:00", "11:00"], "qui": ["10:00", "11:00"], "sab": ["10:00", "11:00"]}'::jsonb,
  4.5, 
  5
)
ON CONFLICT (user_id) DO UPDATE SET 
  nome = EXCLUDED.nome,
  sexo = EXCLUDED.sexo,
  endereco = EXCLUDED.endereco,
  valor_por_m2 = EXCLUDED.valor_por_m2,
  minimo_m2 = EXCLUDED.minimo_m2,
  materiais = EXCLUDED.materiais,
  disponibilidade = EXCLUDED.disponibilidade,
  horarios_por_dia = EXCLUDED.horarios_por_dia,
  rating = EXCLUDED.rating,
  total_servicos = EXCLUDED.total_servicos;

-- 9. Recarrega o esquema da API do Supabase
NOTIFY pgrst, 'reload schema';
