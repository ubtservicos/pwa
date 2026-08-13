-- =========================================================================
-- SCRIPT DE CONFIGURAÇÃO E CRIAÇÃO DE DADOS DE HOMOLOGAÇÃO: PORTAL B2B
-- =========================================================================
-- Execute este script no SQL Editor do Supabase para inicializar as tabelas
-- de Associações, configurar a nova role e inserir dados de teste para a demo.

-- 1. Garantir que as tabelas existem no banco de dados
CREATE TABLE IF NOT EXISTS associacoes_perfil (
    id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    nome_fantasia TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    chave_pix TEXT NOT NULL,
    taxa_repasse_pct NUMERIC(3,2) DEFAULT 2.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS associacao_membros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associacao_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    prestador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_associacao_prestador UNIQUE (associacao_id, prestador_id)
);

-- Habilitar RLS (Row Level Security) para conformidade com a auditoria
ALTER TABLE associacoes_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE associacao_membros ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso simples para a homologação
DROP POLICY IF EXISTS "Acesso total associacoes_perfil" ON associacoes_perfil;
CREATE POLICY "Acesso total associacoes_perfil" ON associacoes_perfil FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso total associacao_membros" ON associacao_membros;
CREATE POLICY "Acesso total associacao_membros" ON associacao_membros FOR ALL USING (true);


-- 2. Configurar um Usuário de Testes como Associação
-- Altere o ID abaixo pelo ID real do usuário obtido pelo Supabase Auth (ex: se o e-mail for presidente@ubt.com.br)
-- Para fins de demonstração síncrona, criaremos um UUID fixo:
INSERT INTO usuarios (id, nome, role, status)
VALUES ('d3b07384-d113-4c9f-864f-4d9d44e55a62', 'Associação de Mototaxistas de Ubatuba', 'associacao', 'active')
ON CONFLICT (id) DO UPDATE 
SET role = 'associacao', nome = 'Associação de Mototaxistas de Ubatuba';

-- 3. Inserir o Perfil Institucional da Associação de Teste
INSERT INTO associacoes_perfil (id, nome_fantasia, cnpj, chave_pix, taxa_repasse_pct)
VALUES (
    'd3b07384-d113-4c9f-864f-4d9d44e55a62', 
    'Associação de Mototaxistas de Ubatuba', 
    '45.890.123/0001-02', 
    'financeiro@mototaxistasuba.org', 
    2.00
)
ON CONFLICT (id) DO UPDATE
SET nome_fantasia = EXCLUDED.nome_fantasia, cnpj = EXCLUDED.cnpj, chave_pix = EXCLUDED.chave_pix;


-- 4. Criar Prestadores Filiados Fictícios para Alimentar o Painel
INSERT INTO usuarios (id, nome, role, status)
VALUES 
  ('a1b07384-d113-4c9f-864f-4d9d44e55a01', 'Carlos Eduardo da Silva', 'prestador', 'active'),
  ('a2b07384-d113-4c9f-864f-4d9d44e55a02', 'Mariana Souza Santos', 'prestador', 'active'),
  ('a3b07384-d113-4c9f-864f-4d9d44e55a03', 'Roberto Ramos Cruz', 'prestador', 'active'),
  ('a4b07384-d113-4c9f-864f-4d9d44e55a04', 'Juliana Mendes Vieira', 'prestador', 'active'),
  ('a5b07384-d113-4c9f-864f-4d9d44e55a05', 'Marcos Paulo Rezende', 'prestador', 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Vincular os Prestadores à Associação
INSERT INTO associacao_membros (associacao_id, prestador_id, status, created_at)
VALUES 
  ('d3b07384-d113-4c9f-864f-4d9d44e55a62', 'a1b07384-d113-4c9f-864f-4d9d44e55a01', 'active', NOW() - INTERVAL '30 days'),
  ('d3b07384-d113-4c9f-864f-4d9d44e55a02', 'a2b07384-d113-4c9f-864f-4d9d44e55a02', 'active', NOW() - INTERVAL '15 days'),
  ('d3b07384-d113-4c9f-864f-4d9d44e55a62', 'a3b07384-d113-4c9f-864f-4d9d44e55a03', 'pending', NOW() - INTERVAL '2 days'),
  ('d3b07384-d113-4c9f-864f-4d9d44e55a62', 'a4b07384-d113-4c9f-864f-4d9d44e55a04', 'pending', NOW() - INTERVAL '1 day'),
  ('d3b07384-d113-4c9f-864f-4d9d44e55a62', 'a5b07384-d113-4c9f-864f-4d9d44e55a05', 'blocked', NOW() - INTERVAL '40 days')
ON CONFLICT (associacao_id, prestador_id) DO NOTHING;
