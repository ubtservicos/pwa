-- migration: 35_wiki_access_control.sql
-- UBT SuperApp — Wiki, RBAC, RLS and ACL Infrastructure

BEGIN;

-- 1. Create Enums and Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wiki_classification') THEN
        CREATE TYPE wiki_classification AS ENUM ('PUBLIC_INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'SUPERADMIN_ONLY');
    END IF;
END$$;

-- 2. Create public.wiki_areas Table
CREATE TABLE IF NOT EXISTS public.wiki_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    descricao text,
    permission_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Create public.wiki_documents Table
CREATE TABLE IF NOT EXISTS public.wiki_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id uuid NOT NULL REFERENCES public.wiki_areas(id) ON DELETE CASCADE,
    slug text NOT NULL,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    classificacao wiki_classification NOT NULL DEFAULT 'PUBLIC_INTERNAL',
    ai_allowed boolean NOT NULL DEFAULT false,
    version text NOT NULL DEFAULT '1.0.0',
    created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wiki_document_slug_area_unique UNIQUE (area_id, slug)
);

-- 4. Create public.wiki_audit_logs Table
CREATE TABLE IF NOT EXISTS public.wiki_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    action text NOT NULL,
    area_nome text,
    document_slug text,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Helper Function to Check Admin Role or system.admin Permission
CREATE OR REPLACE FUNCTION public.is_wiki_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) = 'ubt.servicos@gmail.com' OR EXISTS (
    SELECT 1
      FROM public.permissions p
      JOIN public.role_permissions rp ON rp.permission_id = p.id
      JOIN public.user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = auth.uid() AND p.codigo = 'system.admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Enable RLS
ALTER TABLE public.wiki_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies
DROP POLICY IF EXISTS "select_wiki_areas" ON public.wiki_areas;
CREATE POLICY "select_wiki_areas" ON public.wiki_areas
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            public.is_wiki_admin()
            -- Verify if user holds the permission corresponding to this area
            OR EXISTS (
                SELECT 1
                  FROM public.permissions p
                  JOIN public.role_permissions rp ON rp.permission_id = p.id
                  JOIN public.user_roles ur ON ur.role_id = rp.role_id
                 WHERE ur.user_id = auth.uid() AND p.codigo = permission_code
            )
        )
    );

DROP POLICY IF EXISTS "modify_wiki_areas" ON public.wiki_areas;
CREATE POLICY "modify_wiki_areas" ON public.wiki_areas
    FOR ALL USING (public.is_wiki_admin()) WITH CHECK (public.is_wiki_admin());

DROP POLICY IF EXISTS "select_wiki_documents" ON public.wiki_documents;
CREATE POLICY "select_wiki_documents" ON public.wiki_documents
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            public.is_wiki_admin()
            OR (
                -- Must have permission for the area
                EXISTS (
                    SELECT 1 FROM public.wiki_areas wa
                     WHERE wa.id = area_id AND EXISTS (
                        SELECT 1
                          FROM public.permissions p
                          JOIN public.role_permissions rp ON rp.permission_id = p.id
                          JOIN public.user_roles ur ON ur.role_id = rp.role_id
                         WHERE ur.user_id = auth.uid() AND p.codigo = wa.permission_code
                     )
                )
                -- Standard collaborators cannot view SUPERADMIN_ONLY documents
                AND (classificacao <> 'SUPERADMIN_ONLY')
            )
        )
    );

DROP POLICY IF EXISTS "modify_wiki_documents" ON public.wiki_documents;
CREATE POLICY "modify_wiki_documents" ON public.wiki_documents
    FOR ALL USING (public.is_wiki_admin()) WITH CHECK (public.is_wiki_admin());

DROP POLICY IF EXISTS "select_wiki_audit" ON public.wiki_audit_logs;
CREATE POLICY "select_wiki_audit" ON public.wiki_audit_logs
    FOR SELECT USING (public.is_wiki_admin());

DROP POLICY IF EXISTS "insert_wiki_audit" ON public.wiki_audit_logs;
CREATE POLICY "insert_wiki_audit" ON public.wiki_audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Register New Permissions
INSERT INTO public.permissions (codigo, nome, descricao, categoria) VALUES
('wiki.access', 'Acesso Geral à Wiki', 'Permite acessar a interface da wiki no backoffice', 'Wiki'),
('wiki.view.governance', 'Visualizar Governança', 'Acesso à pasta de governança da wiki', 'Wiki'),
('wiki.view.company', 'Visualizar Institucional', 'Acesso à pasta institucional', 'Wiki'),
('wiki.view.products', 'Visualizar Produtos & Serviços', 'Acesso à pasta de produtos e serviços', 'Wiki'),
('wiki.view.support', 'Visualizar Suporte ao Cliente', 'Acesso à pasta de atendimento e FAQs', 'Wiki'),
('wiki.view.operations', 'Visualizar Operações', 'Acesso à pasta de procedimentos operacionais', 'Wiki'),
('wiki.view.finance', 'Visualizar Financeiro Interno', 'Acesso a documentos de split e relatórios financeiros', 'Wiki'),
('wiki.view.engineering', 'Visualizar Engenharia', 'Acesso a especificações técnicas e diagramas', 'Wiki'),
('wiki.view.marketing', 'Visualizar Comunicação & Marketing', 'Acesso a relatórios de campanhas e marca', 'Wiki'),
('wiki.view.legal', 'Visualizar Jurídico', 'Acesso a termos de uso e políticas de privacidade', 'Wiki'),
('wiki.view.admin', 'Visualizar Administração', 'Acesso a documentos administrativos de fornecedores', 'Wiki'),
('wiki.view.ai', 'Visualizar AI Knowledge', 'Acesso a camada simplificada de IA', 'Wiki'),
('wiki.view.templates', 'Visualizar Templates', 'Acesso aos modelos de escrita', 'Wiki'),
('wiki.view.inbox', 'Visualizar Inbox de Triagem', 'Acesso aos rascunhos em triagem', 'Wiki'),
('wiki.view.archive', 'Visualizar Arquivo Histórico', 'Acesso aos artigos depreciados', 'Wiki'),
('wiki.view.index', 'Visualizar Índices de Catálogo', 'Acesso a catálogos mestres de artigos', 'Wiki')
ON CONFLICT (codigo) DO NOTHING;

-- 9. Seed Areas
INSERT INTO public.wiki_areas (nome, descricao, permission_code) VALUES
('00_GOVERNANCE', 'Diretrizes oficiais de escrita e governança documental', 'wiki.view.governance'),
('01_COMPANY', 'Institucional, organograma, cultura e metas estratégicas', 'wiki.view.company'),
('02_PRODUCTS_SERVICES', 'Visão técnica e comercial de cada vertical operacional', 'wiki.view.products'),
('03_CUSTOMER_SUPPORT', 'Manuais de suporte, FAQs oficiais e fluxos de escalonamento', 'wiki.view.support'),
('04_OPERATIONS', 'Procedimentos internos, segurança física e resolução de incidentes', 'wiki.view.operations'),
('05_FINANCE', 'Faturamento, estornos, payouts e controle de taxas de serviço', 'wiki.view.finance'),
('06_ENGINEERING', 'Arquitetura de sistemas, modelagem de banco e edge functions', 'wiki.view.engineering'),
('07_COMMUNICATION_MARKETING', 'Manuais de comunicação, marca e regras de campanhas', 'wiki.view.marketing'),
('08_LEGAL', 'Termos de uso, políticas de privacidade e LGPD compliance', 'wiki.view.legal'),
('09_ADMINISTRATION', 'Contratos de fornecedores e controle geral administrativo', 'wiki.view.admin'),
('10_AI_KNOWLEDGE', 'Camada de dados estruturados para o WhatsApp-Agent', 'wiki.view.ai'),
('11_TEMPLATES', 'Modelos e padrões recomendados para criação de conteúdo', 'wiki.view.templates'),
('12_INBOX', 'Rascunhos temporários em triagem de validação de fontes', 'wiki.view.inbox'),
('90_ARCHIVE', 'Artigos antigos mantidos para histórico técnico', 'wiki.view.archive'),
('99_INDEX', 'Índice de catálogos gerais e perguntas em aberto', 'wiki.view.index')
ON CONFLICT (nome) DO NOTHING;

-- 10. Seed Initial Documents (Sample / Baseline)
INSERT INTO public.wiki_documents (area_id, slug, titulo, conteudo, classificacao, ai_allowed, version)
SELECT 
    id AS area_id,
    'readme' AS slug,
    'Guia de Governança' AS titulo,
    '# Guia de Governança da Wiki UBT\n\nEste espaço define as políticas de escrita e governança de conteúdo corporativo.',
    'PUBLIC_INTERNAL'::wiki_classification,
    false AS ai_allowed,
    '1.0.0' AS version
FROM public.wiki_areas WHERE nome = '00_GOVERNANCE'
ON CONFLICT (area_id, slug) DO NOTHING;

INSERT INTO public.wiki_documents (area_id, slug, titulo, conteudo, classificacao, ai_allowed, version)
SELECT 
    id AS area_id,
    'readme' AS slug,
    'Arquitetura de Software' AS titulo,
    '# Engenharia e Arquitetura UBT\n\nEspecificações de banco de dados, RLS e Deno Edge Functions.',
    'CONFIDENTIAL'::wiki_classification,
    false AS ai_allowed,
    '1.0.0' AS version
FROM public.wiki_areas WHERE nome = '06_ENGINEERING'
ON CONFLICT (area_id, slug) DO NOTHING;

-- 11. Create Secure Retrieve Function logging Audit events
CREATE OR REPLACE FUNCTION public.get_wiki_document(p_area_nome text, p_doc_slug text)
RETURNS TABLE (
    id uuid,
    area_nome text,
    slug text,
    titulo text,
    conteudo text,
    classificacao wiki_classification,
    ai_allowed boolean,
    version text,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_area_id uuid;
    v_perm_code text;
    v_doc_class wiki_classification;
    v_doc_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    -- Retrieve area metadata
    SELECT wa.id, wa.permission_code INTO v_area_id, v_perm_code
      FROM public.wiki_areas wa
     WHERE wa.nome = p_area_nome;

    IF v_area_id IS NULL THEN
        RAISE EXCEPTION 'Área da Wiki inexistente' USING ERRCODE = 'P0002';
    END IF;

    -- Retrieve document classification
    SELECT wd.id, wd.classificacao INTO v_doc_id, v_doc_class
      FROM public.wiki_documents wd
     WHERE wd.area_id = v_area_id AND wd.slug = p_doc_slug;

    IF v_doc_id IS NULL THEN
        RAISE EXCEPTION 'Documento inexistente' USING ERRCODE = 'P0002';
    END IF;

    -- Validate user permissions
    IF NOT (
        public.is_wiki_admin()
        OR (
            -- Check standard user area permission
            EXISTS (
                SELECT 1
                  FROM public.permissions p
                  JOIN public.role_permissions rp ON rp.permission_id = p.id
                  JOIN public.user_roles ur ON ur.role_id = rp.role_id
                 WHERE ur.user_id = v_user_id AND p.codigo = v_perm_code
            )
            -- Enforce classification block
            AND v_doc_class <> 'SUPERADMIN_ONLY'
        )
    ) THEN
        -- Log Access Denied Event
        INSERT INTO public.wiki_audit_logs (user_id, action, area_nome, document_slug, payload)
        VALUES (v_user_id, 'WIKI_ACCESS_DENIED', p_area_nome, p_doc_slug, jsonb_build_object('reason', 'Missing permission ' || v_perm_code));
        
        RAISE EXCEPTION 'Acesso negado ao documento (ACL restrita)' USING ERRCODE = '42501';
    END IF;

    -- Log Successful View Event
    INSERT INTO public.wiki_audit_logs (user_id, action, area_nome, document_slug)
    VALUES (v_user_id, 'WIKI_DOCUMENT_VIEW', p_area_nome, p_doc_slug);

    RETURN QUERY
    SELECT wd.id, p_area_nome, wd.slug, wd.titulo, wd.conteudo, wd.classificacao, wd.ai_allowed, wd.version, wd.updated_at
      FROM public.wiki_documents wd
     WHERE wd.id = v_doc_id;
END;
$$;

-- 12. Create Intermediary AI Knowledge API RPC
CREATE OR REPLACE FUNCTION public.get_published_ai_knowledge(p_audience text)
RETURNS TABLE (
    area_nome text,
    slug text,
    titulo text,
    conteudo text,
    version text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function has NO user/session checks, but is restricted strictly to published AI items
    RETURN QUERY
    SELECT wa.nome, wd.slug, wd.titulo, wd.conteudo, wd.version
      FROM public.wiki_documents wd
      JOIN public.wiki_areas wa ON wa.id = wd.area_id
     WHERE wd.ai_allowed = true 
       AND wa.nome = '10_AI_KNOWLEDGE'
       AND (
           p_audience = 'geral' 
           OR wd.slug LIKE p_audience || '%'
       );
END;
$$;

COMMIT;
