-- Migration: 20261112183000_equalize_prod_schema_columns.sql
-- Description: Equaliza colunas de associacao_membros, waitlist e usuarios entre ambientes

-- 1. Garante associacao_id em associacao_membros
ALTER TABLE public.associacao_membros 
  ADD COLUMN IF NOT EXISTS associacao_id uuid;

UPDATE public.associacao_membros 
SET associacao_id = association_id 
WHERE associacao_id IS NULL AND association_id IS NOT NULL;

-- 2. Garante slug em waitlist
ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.waitlist 
SET slug = COALESCE(referral_slug, referral_code) 
WHERE slug IS NULL;

-- 3. Garante colunas de PJ em usuarios
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS num_associados text;

-- 4. Recarrega PostgREST
NOTIFY pgrst, 'reload config';
