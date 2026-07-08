ALTER TABLE diarista_perfis ADD COLUMN IF NOT EXISTS horarios_por_dia JSONB DEFAULT '{}'::jsonb;
ALTER TABLE diarista_perfis ADD COLUMN IF NOT EXISTS materiais_detalhes JSONB DEFAULT '[]'::jsonb;

-- Atualiza o cache da API do Supabase para refletir a mudança instantaneamente
NOTIFY pgrst, 'reload schema';
