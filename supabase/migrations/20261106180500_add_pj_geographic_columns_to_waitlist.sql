-- Migration: 20261106180500_add_pj_geographic_columns_to_waitlist.sql
-- Descrição: Adiciona colunas estruturais para refinamento geográfico de entidades/PJ em public.waitlist.

ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS bairro_matriz text,
  ADD COLUMN IF NOT EXISTS bairros_filiais text[],
  ADD COLUMN IF NOT EXISTS regioes_atuacao text[],
  ADD COLUMN IF NOT EXISTS nao_atua_praias boolean DEFAULT false;

NOTIFY pgrst, 'reload config';
