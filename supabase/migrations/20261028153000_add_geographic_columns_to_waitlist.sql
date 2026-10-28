-- ==============================================================================
-- MIGRATION: 20261028153000_add_geographic_columns_to_waitlist.sql
-- Descrição:
--   Compatibilidade da tabela public.waitlist e public.usuarios para novos campos
--   geográficos (bairro_residencia, bairro, regiao_atuacao, regioes, bairros_atuacao, praias, perfis).
-- ==============================================================================

BEGIN;

ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS bairro_residencia text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS regiao_atuacao text,
  ADD COLUMN IF NOT EXISTS regioes text[],
  ADD COLUMN IF NOT EXISTS bairros_atuacao text[],
  ADD COLUMN IF NOT EXISTS praias text[],
  ADD COLUMN IF NOT EXISTS perfis text[];

-- Sincroniza bairro_residencia e bairro com bairro_moradia caso nulos
UPDATE public.waitlist
   SET bairro_residencia = COALESCE(bairro_residencia, bairro_moradia),
       bairro = COALESCE(bairro, bairro_residencia, bairro_moradia)
 WHERE bairro_residencia IS NULL OR bairro IS NULL;

-- Sincroniza perfis com perfil caso nulo
UPDATE public.waitlist
   SET perfis = perfil
 WHERE perfis IS NULL AND perfil IS NOT NULL;

-- Garante compatibilidade também em public.usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS bairro_residencia text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS regioes text[],
  ADD COLUMN IF NOT EXISTS bairros_atuacao text[],
  ADD COLUMN IF NOT EXISTS praias text[],
  ADD COLUMN IF NOT EXISTS perfis text[];

UPDATE public.usuarios
   SET bairro_residencia = COALESCE(bairro_residencia, bairro_moradia),
       bairro = COALESCE(bairro, bairro_residencia, bairro_moradia)
 WHERE bairro_residencia IS NULL OR bairro IS NULL;

COMMIT;

-- Notifica o PostgREST para recarregar o schema cache imediatamente:
NOTIFY pgrst, 'reload config';
