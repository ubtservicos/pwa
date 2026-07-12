-- 06_beta_hardening.sql
-- Correção de políticas RLS para visibilidade de reciclagem (coco_pontos) e inserção de split

-- 1. Tabela public.coco_pontos
-- Remove a política antiga que bloqueava motoristas devido a caminhao_id nulo no estado aguardando
DROP POLICY IF EXISTS "Modificação por criador ou motorista ou admin para coco_pontos" ON public.coco_pontos;

-- Nova política: Coletores aprovados na tabela coco_caminhoes e o criador do ponto podem alterar a linha
CREATE POLICY "Modificação por criador ou coletor aprovado ou admin para coco_pontos" ON public.coco_pontos
  FOR ALL
  USING (
    auth.uid() = tomador_id 
    OR EXISTS (
      SELECT 1 FROM public.coco_caminhoes 
      WHERE prestador_id = auth.uid() AND status_aprovacao = 'approved'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = tomador_id 
    OR EXISTS (
      SELECT 1 FROM public.coco_caminhoes 
      WHERE prestador_id = auth.uid() AND status_aprovacao = 'approved'
    )
    OR public.is_admin()
  );

-- 2. Tabela public.pagamentos_split
-- Remove a política antiga que restringia inserção somente a admins
DROP POLICY IF EXISTS "Modificações restritas a admin para splits" ON public.pagamentos_split;
DROP POLICY IF EXISTS "Acesso a splits próprios ou admin" ON public.pagamentos_split;

-- Permite leitura de splits para participantes e admins
CREATE POLICY "Leitura de splits por participantes ou admin" ON public.pagamentos_split
  FOR SELECT USING (
    public.is_admin()
    OR auth.uid() = godparent_id
    OR (service_type = 'mototaxi' AND EXISTS (SELECT 1 FROM public.mototaxi_corridas WHERE id = service_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid())))
    OR (service_type = 'diarista' AND EXISTS (SELECT 1 FROM public.diarista_agendamentos WHERE id = service_id AND (tomador_id = auth.uid() OR diarista_id = auth.uid())))
    OR (service_type = 'ambulante' AND EXISTS (SELECT 1 FROM public.pedidos WHERE id = service_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid())))
  );

-- Permite inserção de splits por qualquer usuário autenticado (tomador realizando pagamento)
CREATE POLICY "Inserção de splits por usuários autenticados" ON public.pagamentos_split
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Modificação de splits restrita a admin
CREATE POLICY "Modificação de splits restrita a admin" ON public.pagamentos_split
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Remoção de splits restrita a admin
CREATE POLICY "Remoção de splits restrita a admin" ON public.pagamentos_split
  FOR DELETE USING (public.is_admin());

-- Recarrega cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
