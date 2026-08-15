-- Migration manual: equalize_release_v1.sql
-- Description: Equalização dos schemas da waitlist (múltiplos perfis, geolocalização e Mercado Pago status)
-- Date: 2026-08-15

BEGIN;

-- 1. Alter public.waitlist.perfil column type from text to text[] supporting multiple profiles
ALTER TABLE public.waitlist 
  ALTER COLUMN perfil TYPE text[] USING ARRAY[perfil]::text[];

-- 2. Add geolocation fields to waitlist table
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cep_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_trabalho text;

-- 3. Add possui_conta_mercado_pago field to waitlist table
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS possui_conta_mercado_pago boolean DEFAULT NULL;

-- 4. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
