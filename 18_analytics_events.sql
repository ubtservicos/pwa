-- migration: 18_analytics_events.sql
-- Criacao da infraestrutura de analytics operacional

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'signup_started', 'signup_completed', 'order_created', etc.
  device_info jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Politica 1: Permitir insercao publica ou autenticada (para registrar cliques/inicio de fluxo sem atrito)
CREATE POLICY "Allow public inserts on analytics_events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

-- Politica 2: Permitir leitura apenas para administradores/operadores
CREATE POLICY "Allow admin select on analytics_events" 
ON public.analytics_events 
FOR SELECT 
USING (public.is_admin());
