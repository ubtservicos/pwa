-- 04_tickets_and_support.sql
-- UBT SuperApp — Central de Suporte e Tickets

-- 1. Criação da tabela support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('billing', 'ride_issue', 'diarista_damage', 'app_bug', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_admin uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitação de RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de Políticas antigas
DROP POLICY IF EXISTS "Leitura de tickets próprios ou admin" ON public.support_tickets;
DROP POLICY IF EXISTS "Inserção de tickets próprios" ON public.support_tickets;
DROP POLICY IF EXISTS "Atualização de tickets próprios ou admin" ON public.support_tickets;
DROP POLICY IF EXISTS "Deleção restrita a admin para tickets" ON public.support_tickets;

-- 4. Definição das Políticas RLS

-- Leitura: Solicitante lê seus próprios tickets, admins leem todos
CREATE POLICY "Leitura de tickets próprios ou admin" ON public.support_tickets
  FOR SELECT USING (auth.uid() = requester_id OR public.is_admin());

-- Inserção: Usuário logado cria para si mesmo, ou admin
CREATE POLICY "Inserção de tickets próprios" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = requester_id OR public.is_admin());

-- Atualização: Solicitante (para reabrir/fechar) ou admin
CREATE POLICY "Atualização de tickets próprios ou admin" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = requester_id OR public.is_admin())
  WITH CHECK (auth.uid() = requester_id OR public.is_admin());

-- Deleção: Restrita a admin
CREATE POLICY "Deleção restrita a admin para tickets" ON public.support_tickets
  FOR DELETE USING (public.is_admin());

-- Recarregar cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
