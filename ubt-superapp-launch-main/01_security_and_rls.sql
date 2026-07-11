-- 01_security_and_rls.sql
-- UBT SuperApp — Hardening das políticas RLS (Row Level Security)

-- 1. Criação da função auxiliar para verificar se o usuário é administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) = 'ubt.servicos@gmail.com';
END;
$$ LANGUAGE plpgsql;

-- 2. Habilitação de RLS para todas as 13 tabelas existentes (caso não estejam)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceps_ubatuba ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mototaxi_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mototaxi_corridas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarista_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarista_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulante_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulante_session_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_caminhoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coco_pontos ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de Políticas de Desenvolvimento ("Allow All")
DROP POLICY IF EXISTS "Allow All Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow All profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow All ceps_ubatuba" ON public.ceps_ubatuba;
DROP POLICY IF EXISTS "Allow All mototaxi_sessoes" ON public.mototaxi_sessoes;
DROP POLICY IF EXISTS "Allow All mototaxi_corridas" ON public.mototaxi_corridas;
DROP POLICY IF EXISTS "Allow All diarista_perfis" ON public.diarista_perfis;
DROP POLICY IF EXISTS "Allow All diarista_agendamentos" ON public.diarista_agendamentos;
DROP POLICY IF EXISTS "Allow All Produtos" ON public.produtos;
DROP POLICY IF EXISTS "Allow All Sessions" ON public.ambulante_sessions;
DROP POLICY IF EXISTS "Allow All Session Prod" ON public.ambulante_session_produtos;
DROP POLICY IF EXISTS "Allow All Pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow All Pedido Itens" ON public.pedido_itens;
DROP POLICY IF EXISTS "Allow All coco_caminhoes" ON public.coco_caminhoes;
DROP POLICY IF EXISTS "Allow All coco_pontos" ON public.coco_pontos;

-- 4. Criação das Novas Políticas Seguras de Produção

-- Tabela: usuarios
CREATE POLICY "Leitura pública para usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para usuarios" ON public.usuarios FOR ALL
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Tabela: profiles
CREATE POLICY "Leitura pública para profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para profiles" ON public.profiles FOR ALL
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Tabela: ceps_ubatuba
CREATE POLICY "Leitura pública para ceps_ubatuba" ON public.ceps_ubatuba FOR SELECT USING (true);
CREATE POLICY "Modificação restrita a admin para ceps_ubatuba" ON public.ceps_ubatuba FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tabela: mototaxi_sessoes
CREATE POLICY "Leitura pública para mototaxi_sessoes" ON public.mototaxi_sessoes FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para mototaxi_sessoes" ON public.mototaxi_sessoes FOR ALL
  USING (auth.uid() = prestador_id OR public.is_admin())
  WITH CHECK (auth.uid() = prestador_id OR public.is_admin());

-- Tabela: mototaxi_corridas
CREATE POLICY "Acesso a corridas próprias ou em busca ou admin" ON public.mototaxi_corridas FOR ALL
  USING (auth.uid() = tomador_id OR auth.uid() = prestador_id OR status = 'searching' OR public.is_admin())
  WITH CHECK (auth.uid() = tomador_id OR auth.uid() = prestador_id OR public.is_admin());

-- Tabela: diarista_perfis
CREATE POLICY "Leitura pública para diarista_perfis" ON public.diarista_perfis FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para diarista_perfis" ON public.diarista_perfis FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Tabela: diarista_agendamentos
CREATE POLICY "Acesso a agendamentos próprios ou admin" ON public.diarista_agendamentos FOR ALL
  USING (auth.uid() = tomador_id OR auth.uid() = diarista_id OR public.is_admin())
  WITH CHECK (auth.uid() = tomador_id OR auth.uid() = diarista_id OR public.is_admin());

-- Tabela: produtos
CREATE POLICY "Leitura pública para produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Modificação restrita a admin para produtos" ON public.produtos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tabela: ambulante_sessions
CREATE POLICY "Leitura pública para ambulante_sessions" ON public.ambulante_sessions FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para ambulante_sessions" ON public.ambulante_sessions FOR ALL
  USING (auth.uid() = prestador_id OR public.is_admin())
  WITH CHECK (auth.uid() = prestador_id OR public.is_admin());

-- Tabela: ambulante_session_produtos
CREATE POLICY "Leitura pública para ambulante_session_produtos" ON public.ambulante_session_produtos FOR SELECT USING (true);
CREATE POLICY "Modificação por dono da sessão ou admin para ambulante_session_produtos" ON public.ambulante_session_produtos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.ambulante_sessions WHERE id = session_id AND prestador_id = auth.uid()) 
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ambulante_sessions WHERE id = session_id AND prestador_id = auth.uid()) 
    OR public.is_admin()
  );

-- Tabela: pedidos
CREATE POLICY "Acesso a pedidos próprios ou admin" ON public.pedidos FOR ALL
  USING (auth.uid() = tomador_id OR auth.uid() = prestador_id OR public.is_admin())
  WITH CHECK (auth.uid() = tomador_id OR auth.uid() = prestador_id OR public.is_admin());

-- Tabela: pedido_itens
CREATE POLICY "Acesso a itens de pedidos próprios ou admin" ON public.pedido_itens FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.pedidos WHERE id = pedido_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pedidos WHERE id = pedido_id AND (tomador_id = auth.uid() OR prestador_id = auth.uid()))
    OR public.is_admin()
  );

-- Tabela: coco_caminhoes
CREATE POLICY "Leitura pública para coco_caminhoes" ON public.coco_caminhoes FOR SELECT USING (true);
CREATE POLICY "Modificação própria ou admin para coco_caminhoes" ON public.coco_caminhoes FOR ALL
  USING (auth.uid() = prestador_id OR public.is_admin())
  WITH CHECK (auth.uid() = prestador_id OR public.is_admin());

-- Tabela: coco_pontos
CREATE POLICY "Leitura pública para coco_pontos" ON public.coco_pontos FOR SELECT USING (true);
CREATE POLICY "Modificação por criador ou motorista ou admin para coco_pontos" ON public.coco_pontos FOR ALL
  USING (
    auth.uid() = tomador_id 
    OR EXISTS (SELECT 1 FROM public.coco_caminhoes WHERE id = caminhao_id AND prestador_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = tomador_id 
    OR EXISTS (SELECT 1 FROM public.coco_caminhoes WHERE id = caminhao_id AND prestador_id = auth.uid())
    OR public.is_admin()
  );

-- Recarregar cache do esquema no PostgREST
NOTIFY pgrst, 'reload schema';
