-- 03_notifications.sql
-- UBT SuperApp — Sistema de Notificações Internas

-- 1. Criação da tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('order_new', 'order_accepted', 'payment_received', 'chat_message', 'kyc_update', 'general')),
  title text NOT NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitação de RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de Políticas antigas
DROP POLICY IF EXISTS "Leitura de notificações próprias ou admin" ON public.notifications;
DROP POLICY IF EXISTS "Atualização de notificações próprias ou admin" ON public.notifications;
DROP POLICY IF EXISTS "Qualquer usuário logado insere notificações" ON public.notifications;

-- 4. Definição das Políticas RLS

-- Leitura: Usuário logado lê suas próprias notificações, admins leem todas
CREATE POLICY "Leitura de notificações próprias ou admin" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Atualização (ex: Marcar como lida): Apenas o próprio usuário ou admin
CREATE POLICY "Atualização de notificações próprias ou admin" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Inserção: Qualquer usuário autenticado (para disparar alertas a prestadores/tomadores) ou admin
CREATE POLICY "Qualquer usuário logado insere notificações" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR public.is_admin());

-- Deleção: Restrita ao usuário dono ou admin
CREATE POLICY "Deleção de notificações próprias ou admin" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- Recarregar cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
