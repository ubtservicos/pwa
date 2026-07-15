-- 09_hybrid_geocoding_cache.sql
-- UBT SuperApp — Arquitetura de Geocodificação Híbrida e Cache de Endereços
-- Data de Criação: 14/07/2026

-- =========================================================================
-- PARTE 1: TABELA DE CACHE DE ENDEREÇOS (endereco_cache)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.endereco_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query text NOT NULL,
    normalized_query text NOT NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    provider text NOT NULL, -- 'cache_cep', 'nominatim', 'mapbox', 'google'
    confidence numeric, -- Score de 0 a 1 de precisão/confiabilidade
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para busca rápida no cache por query exata ou busca textual insensível
CREATE INDEX IF NOT EXISTS idx_endereco_cache_query ON public.endereco_cache(query);
CREATE INDEX IF NOT EXISTS idx_endereco_cache_normalized_query ON public.endereco_cache(normalized_query);

-- Habilitar RLS
ALTER TABLE public.endereco_cache ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir SELECT publico para endereco_cache" 
    ON public.endereco_cache FOR SELECT 
    USING (true);

CREATE POLICY "Permitir INSERT publico para endereco_cache" 
    ON public.endereco_cache FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir UPDATE publico para endereco_cache" 
    ON public.endereco_cache FOR UPDATE 
    USING (true)
    WITH CHECK (true);


-- =========================================================================
-- PARTE 2: TABELA DE MÉTRICAS DE GEOCODIFICAÇÃO (geocoding_metrics)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.geocoding_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type text NOT NULL, -- 'cache_hit', 'fallback_usage', 'avg_time', 'error', 'not_found'
    query text,
    normalized_query text,
    provider text, -- 'cache_cep', 'nominatim', 'mapbox', 'google'
    response_time_ms integer,
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para geração de relatórios rápidos de métricas por tipo e data
CREATE INDEX IF NOT EXISTS idx_geocoding_metrics_type_created ON public.geocoding_metrics(metric_type, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.geocoding_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir SELECT publico para geocoding_metrics" 
    ON public.geocoding_metrics FOR SELECT 
    USING (true);

CREATE POLICY "Permitir INSERT publico para geocoding_metrics" 
    ON public.geocoding_metrics FOR INSERT 
    WITH CHECK (true);


-- =========================================================================
-- PARTE 3: GATILHO PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMP (updated_at)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_timestamp_endereco_cache
    BEFORE UPDATE ON public.endereco_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();

-- Notificar PostgREST do novo esquema
NOTIFY pgrst, 'reload schema';
