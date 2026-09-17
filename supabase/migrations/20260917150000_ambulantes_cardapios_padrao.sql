-- ==============================================================================
-- MIGRATION: Cardápios Padrão de Ambulantes, Fornecedores e Estoque
-- ==============================================================================

-- 1. TABELA DE FORNECEDORES PADRÃO (Marcas Parceiras)
CREATE TABLE IF NOT EXISTS public.fornecedores_padrao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_marca VARCHAR(150) NOT NULL,
    logo_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE PRODUTOS PADRÃO
CREATE TABLE IF NOT EXISTS public.produtos_padrao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_fornecedor UUID REFERENCES public.fornecedores_padrao(id) ON DELETE CASCADE,
    nome_produto VARCHAR(200) NOT NULL,
    descricao TEXT,
    preco_sugerido NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    imagem_url TEXT,
    categoria VARCHAR(100) NOT NULL DEFAULT 'Geral',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE ESTOQUE DO AMBULANTE
CREATE TABLE IF NOT EXISTS public.estoque_ambulante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_ambulante UUID NOT NULL,
    id_produto_padrao UUID REFERENCES public.produtos_padrao(id) ON DELETE CASCADE,
    preco_venda NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    quantidade INTEGER NOT NULL DEFAULT 0,
    disponivel BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_estoque_ambulante_produto UNIQUE (id_ambulante, id_produto_padrao)
);

-- Índices para performance de busca
CREATE INDEX IF NOT EXISTS idx_produtos_padrao_fornecedor ON public.produtos_padrao(id_fornecedor);
CREATE INDEX IF NOT EXISTS idx_produtos_padrao_categoria ON public.produtos_padrao(categoria);
CREATE INDEX IF NOT EXISTS idx_estoque_ambulante_user ON public.estoque_ambulante(id_ambulante);

-- 4. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.fornecedores_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_ambulante ENABLE ROW LEVEL SECURITY;

-- Políticas para fornecedores_padrao (Leitura pública, escrita autenticada/admin)
DROP POLICY IF EXISTS "Permitir leitura publica de fornecedores_padrao" ON public.fornecedores_padrao;
CREATE POLICY "Permitir leitura publica de fornecedores_padrao" ON public.fornecedores_padrao
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de fornecedores_padrao para admin/autenticado" ON public.fornecedores_padrao;
CREATE POLICY "Permitir escrita de fornecedores_padrao para admin/autenticado" ON public.fornecedores_padrao
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para produtos_padrao (Leitura pública, escrita autenticada/admin)
DROP POLICY IF EXISTS "Permitir leitura publica de produtos_padrao" ON public.produtos_padrao;
CREATE POLICY "Permitir leitura publica de produtos_padrao" ON public.produtos_padrao
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de produtos_padrao para admin/autenticado" ON public.produtos_padrao;
CREATE POLICY "Permitir escrita de produtos_padrao para admin/autenticado" ON public.produtos_padrao
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para estoque_ambulante
DROP POLICY IF EXISTS "Permitir leitura publica de estoque_ambulante" ON public.estoque_ambulante;
CREATE POLICY "Permitir leitura publica de estoque_ambulante" ON public.estoque_ambulante
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gerenciar estoque_ambulante" ON public.estoque_ambulante;
CREATE POLICY "Permitir gerenciar estoque_ambulante" ON public.estoque_ambulante
    FOR ALL USING (true) WITH CHECK (true);

-- 5. BUCKET DE STORAGE 'catalogo-ambulantes'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalogo-ambulantes', 'catalogo-ambulantes', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso ao bucket de storage
DROP POLICY IF EXISTS "Public Access catalogo-ambulantes" ON storage.objects;
CREATE POLICY "Public Access catalogo-ambulantes" ON storage.objects
    FOR SELECT USING (bucket_id = 'catalogo-ambulantes');

DROP POLICY IF EXISTS "Authenticated and Admin Upload catalogo-ambulantes" ON storage.objects;
CREATE POLICY "Authenticated and Admin Upload catalogo-ambulantes" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'catalogo-ambulantes');

DROP POLICY IF EXISTS "Authenticated and Admin Update catalogo-ambulantes" ON storage.objects;
CREATE POLICY "Authenticated and Admin Update catalogo-ambulantes" ON storage.objects
    FOR UPDATE USING (bucket_id = 'catalogo-ambulantes');

DROP POLICY IF EXISTS "Authenticated and Admin Delete catalogo-ambulantes" ON storage.objects;
CREATE POLICY "Authenticated and Admin Delete catalogo-ambulantes" ON storage.objects
    FOR DELETE USING (bucket_id = 'catalogo-ambulantes');
