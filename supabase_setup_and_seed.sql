-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELAS

-- Limpa tabelas caso já existam para recriar limpo
DROP TABLE IF EXISTS public.pedido_itens CASCADE;
DROP TABLE IF EXISTS public.pedidos CASCADE;
DROP TABLE IF EXISTS public.ambulante_session_produtos CASCADE;
DROP TABLE IF EXISTS public.ambulante_sessions CASCADE;
DROP TABLE IF EXISTS public.produtos CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- Usuários / Perfis
create table public.usuarios (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  role text not null check (role in ('tomador', 'prestador', 'admin')),
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Produtos Catálogo Global
create table if not exists public.produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  emoji text,
  descricao text,
  preco_sugerido numeric(10,2),
  categoria text,
  created_at timestamp with time zone default now()
);

-- Sessões de Ambulantes (Prestadores Ativos)
create table public.ambulante_sessions (
  id uuid primary key default uuid_generate_v4(),
  prestador_id uuid references public.usuarios(id) on delete cascade,
  modalidade text check (modalidade in ('local_fixo', 'delivery', 'both')),
  lat numeric(10,6),
  lng numeric(10,6),
  address text,
  is_online boolean default true,
  rating numeric(3,1) default 5.0,
  total_pedidos integer default 0,
  created_at timestamp with time zone default now()
);

-- Relação de Produtos que o Ambulante tem na Sessão
create table if not exists public.ambulante_session_produtos (
  session_id uuid references public.ambulante_sessions(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete cascade,
  preco numeric(10,2),
  disponivel boolean default true,
  primary key (session_id, produto_id)
);

-- Pedidos / Transações
create table public.pedidos (
  id uuid primary key default uuid_generate_v4(),
  tomador_id uuid references public.usuarios(id) on delete set null,
  prestador_id uuid references public.usuarios(id) on delete set null,
  session_id uuid references public.ambulante_sessions(id) on delete set null,
  status text not null default 'pending', -- pending, confirmed, preparing, ready, completed, cancelled
  modalidade text check (modalidade in ('local_fixo', 'delivery')),
  total numeric(10,2) not null,
  delivery_lat numeric(10,6),
  delivery_lng numeric(10,6),
  delivery_address text,
  delivery_referencia text,
  payment_method text,
  payment_status text,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- Itens do Pedido
create table if not exists public.pedido_itens (
  id uuid primary key default uuid_generate_v4(),
  pedido_id uuid references public.pedidos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  emoji text,
  qty integer not null default 1,
  preco_unit numeric(10,2) not null,
  subtotal numeric(10,2) not null
);


-- 3. HABILITANDO RLS (Row Level Security) - Simplificado para Desenvolvimento
alter table public.usuarios enable row level security;
alter table public.produtos enable row level security;
alter table public.ambulante_sessions enable row level security;
alter table public.ambulante_session_produtos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- Políticas permissivas (Para DEV - ATENÇÃO: ajustar em PROD)
create policy "Allow All Usuarios" on public.usuarios for all using (true) with check (true);
create policy "Allow All Produtos" on public.produtos for all using (true) with check (true);
create policy "Allow All Sessions" on public.ambulante_sessions for all using (true) with check (true);
create policy "Allow All Session Prod" on public.ambulante_session_produtos for all using (true) with check (true);
create policy "Allow All Pedidos" on public.pedidos for all using (true) with check (true);
create policy "Allow All Pedido Itens" on public.pedido_itens for all using (true) with check (true);


-- 4. INSERÇÃO DE DADOS (SEEDS)

-- Limpar dados existentes para evitar duplicidade durante testes
truncate table public.pedido_itens cascade;
truncate table public.pedidos cascade;
truncate table public.ambulante_session_produtos cascade;
truncate table public.ambulante_sessions cascade;
truncate table public.produtos cascade;
truncate table public.usuarios cascade;

-- Inserir Perfis
insert into public.usuarios (id, nome, role) values
  ('d17d0577-bc62-42da-9f89-8dcaee499d34', 'Zé do Coco', 'prestador'),
  ('b73523fc-629b-4e12-a164-9be1a7090fcb', 'Maria do Milho', 'prestador'),
  ('60e0a5ba-1941-4c7d-8153-f72be1c70e06', 'João Surfista', 'tomador');

-- Inserir Produtos
insert into public.produtos (id, nome, emoji, descricao, preco_sugerido, categoria) values
  ('f701c9a6-71d5-45ea-b364-7bc1496b9f27', 'Água de Coco', '🥥', 'Gelada, natural', 8.00, 'Bebida'),
  ('4e626e2a-14d2-4cf0-9e63-71ccfa2f3b9e', 'Refrigerante', '🥤', 'Lata 350ml', 6.00, 'Bebida'),
  ('c5abeb4b-140b-41f3-a15e-bf3cdab793a0', 'Milho Cozido', '🌽', 'Com manteiga e sal', 7.00, 'Comida'),
  ('c342f558-86fc-4630-b3b3-d349320e8a75', 'Pamonha', '🌽', 'Doce ou salgada', 10.00, 'Comida'),
  ('8b12f6a9-8fc0-4a88-8255-a22fc8eef714', 'Espetinho', '🍢', 'Carne, frango ou queijo', 12.00, 'Comida');

-- Inserir Sessões
insert into public.ambulante_sessions (id, prestador_id, modalidade, lat, lng, address, is_online, rating, total_pedidos) values
  ('5af1b742-1200-4b8f-ae32-359bc7e9559c', 'd17d0577-bc62-42da-9f89-8dcaee499d34', 'delivery', -23.435, -45.080, 'Praia Grande, Quiosque 5', true, 4.8, 150),
  ('9c5f83c0-0387-43b6-857e-7c5c00b0805a', 'b73523fc-629b-4e12-a164-9be1a7090fcb', 'local_fixo', -23.430, -45.088, 'Praia do Tenório, Entrada principal', true, 4.9, 85);

-- Inserir Produtos nas Sessões
insert into public.ambulante_session_produtos (session_id, produto_id, preco, disponivel) values
  -- Zé do Coco
  ('5af1b742-1200-4b8f-ae32-359bc7e9559c', 'f701c9a6-71d5-45ea-b364-7bc1496b9f27', 8.00, true),
  ('5af1b742-1200-4b8f-ae32-359bc7e9559c', '4e626e2a-14d2-4cf0-9e63-71ccfa2f3b9e', 6.00, true),
  -- Maria do Milho
  ('9c5f83c0-0387-43b6-857e-7c5c00b0805a', 'c5abeb4b-140b-41f3-a15e-bf3cdab793a0', 7.00, true),
  ('9c5f83c0-0387-43b6-857e-7c5c00b0805a', 'c342f558-86fc-4630-b3b3-d349320e8a75', 10.00, true);

-- Inserir um Pedido de Exemplo (Histórico)
insert into public.pedidos (id, tomador_id, prestador_id, session_id, status, modalidade, total, delivery_address, delivery_referencia, payment_method, payment_status, completed_at) values
  ('6df173f3-0ea1-4ebc-b3a9-fb02d41ba3fa', '60e0a5ba-1941-4c7d-8153-f72be1c70e06', 'd17d0577-bc62-42da-9f89-8dcaee499d34', '5af1b742-1200-4b8f-ae32-359bc7e9559c', 'completed', 'delivery', 16.00, 'Praia Grande, Areia', 'Guarda-sol Azul', 'pix', 'confirmed', now());

insert into public.pedido_itens (pedido_id, produto_id, nome, emoji, qty, preco_unit, subtotal) values
  ('6df173f3-0ea1-4ebc-b3a9-fb02d41ba3fa', 'f701c9a6-71d5-45ea-b364-7bc1496b9f27', 'Água de Coco', '🥥', 2, 8.00, 16.00);

