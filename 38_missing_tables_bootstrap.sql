-- migration: 38_missing_tables_bootstrap.sql
-- UBT SuperApp — Bootstrapping tables that exist in DEV but were missing DDL files

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text UNIQUE,
  phone text,
  pix_key text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN (
    'tomador', 'prestador', 'admin', 'client', 'provider', 'user', 'authenticated', 'cocoecia', 'superadmin'
  )),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  padrinho_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- 2. Create handle_new_user function and trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    case
      when new.email = 'ubt.servicos@gmail.com' then 'superadmin'
      else 'user'
    end
  );
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Create split_config table
CREATE TABLE IF NOT EXISTS public.split_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  prestador_pct numeric NOT NULL DEFAULT 90.000,
  ubt_pct numeric NOT NULL DEFAULT 5.000,
  comunidade_pct numeric NOT NULL DEFAULT 2.000,
  premio_trabalhador_pct numeric NOT NULL DEFAULT 1.000,
  premio_consumidor_pct numeric NOT NULL DEFAULT 1.000,
  padrinho_pct numeric NOT NULL DEFAULT 1.000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert PO's official financial rule
INSERT INTO public.split_config (id, prestador_pct, ubt_pct, comunidade_pct, premio_trabalhador_pct, premio_consumidor_pct, padrinho_pct)
VALUES (1, 90.000, 5.000, 2.000, 1.000, 1.000, 1.000)
ON CONFLICT (id) DO UPDATE
SET prestador_pct = 90.000,
    ubt_pct = 5.000,
    comunidade_pct = 2.000,
    premio_trabalhador_pct = 1.000,
    premio_consumidor_pct = 1.000,
    padrinho_pct = 1.000,
    updated_at = now();

-- 4. Create pix_keys table
CREATE TABLE IF NOT EXISTS public.pix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create prestador_mototaxi table
CREATE TABLE IF NOT EXISTS public.prestador_mototaxi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cpf text NOT NULL UNIQUE,
  cnh text,
  cnh_photo_url text,
  plate text NOT NULL,
  gender text,
  modalidade text NOT NULL,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  kyc_notes text,
  is_online boolean NOT NULL DEFAULT false,
  location jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create rides table
CREATE TABLE IF NOT EXISTS public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'accepted', 'completed', 'cancelled')),
  tomador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  type text NOT NULL,
  origin jsonb NOT NULL,
  destination jsonb NOT NULL,
  estimated_price numeric,
  final_price numeric,
  distance_km numeric,
  duration_min integer,
  prestador_location jsonb,
  payment_method text,
  payment_status text DEFAULT 'pending',
  rating_tomador smallint,
  rating_prestador smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);

-- 7. Create diarista_perfis table
CREATE TABLE IF NOT EXISTS public.diarista_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cpf text NOT NULL UNIQUE,
  gender text,
  endereco jsonb,
  valor_por_m2 numeric NOT NULL,
  minimo_m2 integer NOT NULL DEFAULT 40,
  materiais text[] DEFAULT '{}'::text[],
  materiais_custom text[] DEFAULT '{}'::text[],
  disponibilidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_online boolean NOT NULL DEFAULT false,
  location jsonb,
  rating numeric,
  total_servicos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  horarios_por_dia jsonb DEFAULT '{}'::jsonb,
  materiais_detalhes jsonb DEFAULT '[]'::jsonb,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  sexo text,
  nome text
);

-- 8. Create diarista_agendamentos table
CREATE TABLE IF NOT EXISTS public.diarista_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending_confirm',
  tomador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  diarista_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora time NOT NULL,
  local jsonb NOT NULL,
  materiais_solicitados text[] DEFAULT '{}'::text[],
  valor_base numeric NOT NULL,
  valor_materiais numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL,
  payment_method text,
  payment_status text DEFAULT 'pending',
  rating_tomador smallint,
  rating_diarista smallint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

-- 9. Create diarista_messages table
CREATE TABLE IF NOT EXISTS public.diarista_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.diarista_agendamentos(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Create ambulante_messages table
CREATE TABLE IF NOT EXISTS public.ambulante_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Create ambulante_pedidos table
CREATE TABLE IF NOT EXISTS public.ambulante_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  tomador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.ambulante_sessions(id) ON DELETE SET NULL,
  modalidade text NOT NULL,
  itens jsonb NOT NULL,
  total numeric NOT NULL,
  tomador_location jsonb,
  prestador_location jsonb,
  payment_method text,
  payment_status text DEFAULT 'pending',
  rating_tomador smallint,
  rating_prestador smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz
);

-- 12. Create arbitrage_tickets table
CREATE TABLE IF NOT EXISTS public.arbitrage_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  type text NOT NULL,
  tomador_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  prestador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ride_id uuid,
  value numeric DEFAULT 0,
  description text NOT NULL,
  resolution text,
  resolved_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- 13. Create coco_config table
CREATE TABLE IF NOT EXISTS public.coco_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pix_key text NOT NULL DEFAULT 'coco@pix.com.br',
  descricao text NOT NULL DEFAULT 'Côco & Cia — Reciclagem em Ubatuba',
  missao text NOT NULL DEFAULT 'A Côco & Cia recolhe materiais recicláveis nas praias e ruas de Ubatuba.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.coco_config (id, pix_key, descricao, missao)
VALUES (1, 'coco@pix.com.br', 'Côco & Cia — Reciclagem em Ubatuba', 'A Côco & Cia recolhe materiais recicláveis nas praias e ruas de Ubatuba.')
ON CONFLICT (id) DO NOTHING;

-- 14. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL, -- references rides or races
  sender_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 15. Create messages_archive table
CREATE TABLE IF NOT EXISTS public.messages_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL
);

-- Enable RLS on newly created tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestador_mototaxi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarista_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarista_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarista_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulante_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulante_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbitrage_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_archive ENABLE ROW LEVEL SECURITY;
