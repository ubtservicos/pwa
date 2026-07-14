-- 08_security_lgpd_profiles.sql
-- UBT SuperApp — Adequação e Hardening RLS para Privacidade LGPD
-- Data de Criação: 14/07/2026

-- =========================================================================
-- 1. Limpeza de Políticas Públicas Antigas ("Allow SELECT true")
-- =========================================================================
DROP POLICY IF EXISTS "Leitura pública para usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Leitura pública para profiles" ON public.profiles;

-- =========================================================================
-- 2. Nova Política RLS Condicional Baseada em Relacionamento para public.usuarios
-- =========================================================================
CREATE POLICY "Leitura de usuarios condicional" ON public.usuarios
  FOR SELECT
  USING (
    auth.uid() = id                                   -- Acesso ao próprio perfil
    OR role IN ('prestador', 'admin', 'cocoecia')     -- Prestadores públicos para descoberta/mapa
    OR public.is_admin()                              -- Administradores leem tudo
    OR EXISTS (
      -- Relacionamento em corridas de mototaxi
      SELECT 1 FROM public.mototaxi_corridas 
      WHERE (tomador_id = auth.uid() AND prestador_id = id) 
         OR (prestador_id = auth.uid() AND tomador_id = id)
    )
    OR EXISTS (
      -- Relacionamento em agendamentos de diaristas
      SELECT 1 FROM public.diarista_agendamentos
      WHERE (tomador_id = auth.uid() AND diarista_id = id) 
         OR (diarista_id = auth.uid() AND tomador_id = id)
    )
    OR EXISTS (
      -- Relacionamento em pedidos de ambulantes
      SELECT 1 FROM public.pedidos
      WHERE (tomador_id = auth.uid() AND prestador_id = id) 
         OR (prestador_id = auth.uid() AND tomador_id = id)
    )
  );

-- =========================================================================
-- 3. Nova Política RLS Condicional Restrita para public.profiles
--    O objetivo é impedir o vazamento público de PII (Telefones) de clientes
-- =========================================================================
CREATE POLICY "Leitura de profiles segura" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id                                   -- Acesso ao próprio perfil
    OR public.is_admin()                              -- Administradores leem tudo
    OR EXISTS (
      -- Relacionamento em corridas de mototaxi
      SELECT 1 FROM public.mototaxi_corridas 
      WHERE (tomador_id = auth.uid() AND prestador_id = id) 
         OR (prestador_id = auth.uid() AND tomador_id = id)
    )
    OR EXISTS (
      -- Relacionamento em agendamentos de diaristas
      SELECT 1 FROM public.diarista_agendamentos
      WHERE (tomador_id = auth.uid() AND diarista_id = id) 
         OR (diarista_id = auth.uid() AND tomador_id = id)
    )
    OR EXISTS (
      -- Relacionamento em pedidos de ambulantes
      SELECT 1 FROM public.pedidos
      WHERE (tomador_id = auth.uid() AND prestador_id = id) 
         OR (prestador_id = auth.uid() AND tomador_id = id)
    )
  );

-- =========================================================================
-- 4. Função Criptográfica Segura para Leitura do Nome de Padrinho no Onboarding
--    (Bypassa RLS de forma controlada apenas para recuperar o Nome via UUID)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_padrinho_nome(ref_id uuid)
RETURNS text SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT nome FROM public.usuarios WHERE id = ref_id);
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- NOTIFY: Recarregar cache do esquema no PostgREST
-- =========================================================================
NOTIFY pgrst, 'reload schema';
