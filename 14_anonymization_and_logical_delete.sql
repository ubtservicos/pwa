-- migration: 14_anonymization_and_logical_delete.sql
-- Adicao de campos de exclusao logica e anonimizacao LGPD

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS anonymized_at timestamp with time zone;

-- Criar indices de busca otimizados
CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_at ON public.usuarios(deleted_at) WHERE deleted_at IS NULL;
