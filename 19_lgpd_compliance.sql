-- migration: 19_lgpd_compliance.sql
-- Adicao de campo deleted_reason na tabela usuarios para conformidade LGPD

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS deleted_reason text;
