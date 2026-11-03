-- Migration: 20261103141500_add_unique_constraint_waitlist_telefone.sql
-- Descrição: 
--   1. Deduplicação e criação da constraint formal UNIQUE em public.waitlist(telefone) para suportar upsert ON CONFLICT.
--   2. Remoção de travas NOT NULL e configuração de DEFAULTS em created_at_local, cidade, perfil e ip_hash.

-- 1. Remove duplicatas existentes mantendo apenas o registro mais recente por telefone
DELETE FROM public.waitlist a USING public.waitlist b
WHERE a.id < b.id 
  AND a.telefone = b.telefone 
  AND a.telefone IS NOT NULL;

-- 2. Remove constraint anterior se existir com outro padrão
ALTER TABLE public.waitlist 
  DROP CONSTRAINT IF EXISTS waitlist_telefone_key,
  DROP CONSTRAINT IF EXISTS waitlist_telefone_unique;

-- 3. Cria a constraint formal UNIQUE exigida pelo ON CONFLICT do Postgres
ALTER TABLE public.waitlist 
  ADD CONSTRAINT waitlist_telefone_key UNIQUE (telefone);

-- 4. Remove a obrigatoriedade estrita de created_at_local e define default local
ALTER TABLE public.waitlist 
  ALTER COLUMN created_at_local DROP NOT NULL;

ALTER TABLE public.waitlist 
  ALTER COLUMN created_at_local SET DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo');

-- 5. Resiliência para cidade, perfil e ip_hash
ALTER TABLE public.waitlist 
  ALTER COLUMN cidade DROP NOT NULL;

ALTER TABLE public.waitlist 
  ALTER COLUMN cidade SET DEFAULT 'Ubatuba';

ALTER TABLE public.waitlist 
  ALTER COLUMN perfil DROP NOT NULL;

ALTER TABLE public.waitlist 
  ALTER COLUMN perfil SET DEFAULT ARRAY['morador']::text[];

ALTER TABLE public.waitlist 
  ALTER COLUMN ip_hash DROP NOT NULL;

-- 6. Garante default nas colunas de timestamp caso existam
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'created_at') THEN
    ALTER TABLE public.waitlist ALTER COLUMN created_at SET DEFAULT now();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = 'created_at_utc') THEN
    ALTER TABLE public.waitlist ALTER COLUMN created_at_utc SET DEFAULT now();
  END IF;
END $$;

-- 7. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload config';
