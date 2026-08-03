-- Migration: 34_waitlist_geo_fields.sql
-- Description: Add geolocation fields to waitlist table for UBT-DEV-014
-- Date: 2026-08-03

ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cep_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_moradia text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS bairro_trabalho text;

-- Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
