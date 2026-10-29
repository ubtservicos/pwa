-- Migration: 20261029144500_add_responsavel_nome_to_waitlist.sql
-- Descrição: Adiciona a coluna responsavel_nome na tabela public.waitlist para suportar o cadastro enxuto de entidades/PJ.

ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

NOTIFY pgrst, 'reload config';
