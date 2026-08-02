-- Migration: 33_waitlist_multi_profile.sql
-- Description: Convert public.waitlist.perfil from text to text[] to support multiple profiles, preserving existing records.

BEGIN;

-- 1. Alter column type to text[] converting existing single string value to a single-element array
ALTER TABLE public.waitlist 
  ALTER COLUMN perfil TYPE text[] USING ARRAY[perfil]::text[];

-- 2. Ensure RLS policies and indices are untouched as they do not reference the perfil column.
-- (Checked in audit: no index or policy references waitlist.perfil).

COMMIT;
