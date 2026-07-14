-- 05_mercado_pago_split.sql
-- UBT SuperApp — Integração Financeira Mercado Pago Split

-- 1. Criação da tabela pagamentos_split
CREATE TABLE IF NOT EXISTS public.pagamentos_split (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'in_mediation', 'rejected', 'refunded', 'charged_back')),
  service_type text NOT NULL CHECK (service_type IN ('mototaxi', 'diarista', 'ambulante')),
  service_id uuid NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  provider_amount numeric(10,2) NOT NULL,
  ubt_amount numeric(10,2) NOT NULL,
  entity_amount numeric(10,2) NOT NULL,
  entity_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prize_worker_amount numeric(10,2) NOT NULL,
  prize_consumer_amount numeric(10,2) NOT NULL,
  godparent_amount numeric(10,2) NOT NULL,
  godparent_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  refunded_amount numeric(10,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitação de RLS
ALTER TABLE public.pagamentos_split ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de Políticas antigas
DROP POLICY IF EXISTS "Acesso a splits próprios ou admin" ON public.pagamentos_split;
DROP POLICY IF EXISTS "Modificações restritas a admin para splits" ON public.pagamentos_split;

-- 4. Definição das Políticas RLS

-- Leitura: Apenas admins, padrinhos/madrinhas ou participantes diretos do serviço correspondente
CREATE POLICY "Acesso a splits próprios ou admin" ON public.pagamentos_split
  FOR SELECT USING (
    public.is_admin()
    OR auth.uid() = godparent_id
    OR (service_type = 'mototaxi' AND EXISTS (SELECT 1 FROM public.mototaxi_corridas WHERE id = service_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid())))
    OR (service_type = 'diarista' AND EXISTS (SELECT 1 FROM public.diarista_agendamentos WHERE id = service_id AND (tomador_id = auth.uid() OR diarista_id = auth.uid())))
    OR (service_type = 'ambulante' AND EXISTS (SELECT 1 FROM public.pedidos WHERE id = service_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid())))
  );

-- Modificações (Insert, Update, Delete) restritas aos administradores do sistema (processamento via webhook/backend seguro)
CREATE POLICY "Modificações restritas a admin para splits" ON public.pagamentos_split
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Recarregar cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
