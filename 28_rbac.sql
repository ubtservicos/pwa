-- Migration: 28_rbac.sql
-- Description: Complete RBAC schema, permissions matrix, default roles, RLS and RPCs

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_roles_codigo ON public.roles(codigo);
CREATE INDEX IF NOT EXISTS idx_permissions_codigo ON public.permissions(codigo);
CREATE INDEX IF NOT EXISTS idx_permissions_categoria ON public.permissions(categoria);

-- 3. RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated on rbac" ON public.roles;
CREATE POLICY "Enable read access for authenticated on rbac" ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable read access for authenticated on permissions" ON public.permissions;
CREATE POLICY "Enable read access for authenticated on permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable read access for authenticated on role_permissions" ON public.role_permissions;
CREATE POLICY "Enable read access for authenticated on role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable read access for authenticated on user_roles" ON public.user_roles;
CREATE POLICY "Enable read access for authenticated on user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable write access for super_admin on roles" ON public.roles;
CREATE POLICY "Enable write access for super_admin on roles" ON public.roles FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable write access for super_admin on role_permissions" ON public.role_permissions;
CREATE POLICY "Enable write access for super_admin on role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable write access for super_admin on user_roles" ON public.user_roles;
CREATE POLICY "Enable write access for super_admin on user_roles" ON public.user_roles FOR ALL TO authenticated USING (true);

-- 4. Seed Permissions
INSERT INTO public.permissions (codigo, nome, descricao, categoria) VALUES
  ('dashboard.view', 'Visualizar Dashboard', 'Acesso à página inicial do BackOffice', 'Analytics'),
  ('dashboard.export', 'Exportar Dashboard', 'Exportar métricas e gráficos do Dashboard', 'Analytics'),
  ('analytics.view', 'Visualizar Analytics Operacional', 'Acesso ao painel completo de métricas', 'Analytics'),
  ('analytics.export', 'Exportar Relatórios de Analytics', 'Exportar relatórios de desempenho', 'Analytics'),
  ('finance.view', 'Visualizar Painel Financeiro', 'Visualizar métricas e saldo financeiro', 'Financeiro'),
  ('finance.edit', 'Editar Configurações Financeiras', 'Modificar taxas e parâmetros de repasse', 'Financeiro'),
  ('payments.view', 'Visualizar Transações e Pagamentos', 'Ver lista detalhada de pagamentos', 'Financeiro'),
  ('payments.refund', 'Estornar Pagamentos', 'Efetuar devoluções Pix/Cartão', 'Financeiro'),
  ('payments.split.edit', 'Gerenciar Regras de Split', 'Configurar divisão de repasses', 'Financeiro'),
  ('payouts.view', 'Visualizar Saques e Payouts', 'Listagem de solicitações de saque', 'Financeiro'),
  ('payouts.approve', 'Aprovar e Enviar Payouts', 'Aprovação manual de transferências', 'Financeiro'),
  ('disputes.manage', 'Gerenciar Mediações e Disputas', 'Tratar desacordo comercial', 'Financeiro'),
  ('refunds.manage', 'Gerenciar Solicitações de Estorno', 'Processar solicitações de reembolso', 'Financeiro'),
  ('clientes.view', 'Visualizar Cadastro de Clientes', 'Acesso aos perfis de tomadores e prestadores', 'Usuários'),
  ('clientes.edit', 'Editar Usuários', 'Modificar dados cadastrais de usuários', 'Usuários'),
  ('clientes.block', 'Bloquear/Suspender Usuários', 'Bloqueio preventivo por infração', 'Usuários'),
  ('usuarios.delete', 'Excluir / Anonymizar Usuários', 'Expurgo definitivo de cadastro', 'LGPD'),
  ('kyc.view', 'Visualizar KYCs Pendentes', 'Ver documentos de verificação', 'KYC'),
  ('kyc.approve', 'Aprovar Cadastro KYC', 'Validar documento e liberar prestador', 'KYC'),
  ('kyc.reject', 'Reprovar Cadastro KYC', 'Rejeitar documento com motivo', 'KYC'),
  ('conteudo.view', 'Visualizar Gestão de Conteúdo', 'Ver banners e avisos institucionais', 'Conteúdo'),
  ('conteudo.edit', 'Editar Conteúdo da Plataforma', 'Publicar banners e notificações', 'Conteúdo'),
  ('marketing.view', 'Visualizar Métricas de Marketing', 'Acompanhar origem de aquisição', 'Marketing'),
  ('marketing.export', 'Exportar Relatórios de Campanhas', 'Download de bases para remarketing', 'Marketing'),
  ('operacoes.view', 'Visualizar Operações Realtime', 'Acompanhar motoristas e pedidos no mapa', 'Operações'),
  ('telemetria.view', 'Visualizar Telemetria e Logs', 'Acesso aos rastros de execução', 'Sistema'),
  ('health.view', 'Visualizar Health Center', 'Acesso à Central Inteligente de Alertas', 'Health Center'),
  ('audit.view', 'Visualizar Trilha de Auditoria', 'Ver registros de auditoria imutável', 'Auditoria'),
  ('audit.export', 'Exportar Relatórios de Auditoria', 'Download CSV/JSON de audit logs', 'Auditoria'),
  ('featureflags.edit', 'Gerenciar Preço e Regras Dinâmicas', 'Editar preço por km e dinâmica', 'Sistema'),
  ('config.edit', 'Editar Configurações Gerais', 'Alterar preferências do sistema', 'Configurações'),
  ('roles.manage', 'Gerenciar Perfis e Permissões (RBAC)', 'Administrar matriz de permissões', 'Sistema'),
  ('system.admin', 'Super Administrador Total', 'Acesso irrestrito a todas as rotas e RPCs', 'Sistema')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria;

-- 5. Seed Roles
INSERT INTO public.roles (codigo, nome, descricao) VALUES
  ('super_admin', 'Super Admin', 'Acesso total e irrestrito ao sistema'),
  ('admin', 'Administrador', 'Acesso executivo a todos os módulos operacionais'),
  ('financeiro', 'Gestor Financeiro', 'Controle de pagamentos, saques, split e estornos'),
  ('operacoes', 'Operações Realtime', 'Monitoramento ao vivo de pedidos e mapas'),
  ('operations_manager', 'Gerente de Operações', 'Acesso exclusivo ao Health Center e Operações'),
  ('marketing', 'Analista de Marketing', 'Acompanhamento de aquisição e campanhas'),
  ('comunicacao', 'Comunicação & Conteúdo', 'Gestão de avisos, banners e pushes'),
  ('kyc', 'Analista de KYC', 'Validação documental de prestadores'),
  ('suporte', 'Atendimento / Suporte', 'Consulta de clientes, pedidos e disputas'),
  ('atendimento', 'Atendente N1', 'Visualização de cadastros e dúvidas'),
  ('moderador', 'Moderador de Conteúdo', 'Tratamento de disputas e arbitragem'),
  ('analytics', 'Analista de Dados', 'Visualização e exportação de relatórios'),
  ('auditoria', 'Auditor de Compliance', 'Consulta imutável de audit logs e LGPD')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

-- 6. Map Initial Role Permissions
-- Super Admin gets all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin gets all except roles.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo = 'admin' AND p.codigo != 'roles.manage'
ON CONFLICT DO NOTHING;

-- Financeiro
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo = 'financeiro' AND p.categoria IN ('Financeiro', 'Analytics')
ON CONFLICT DO NOTHING;

-- KYC
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo = 'kyc' AND p.categoria = 'KYC'
ON CONFLICT DO NOTHING;

-- Operações & Operations Manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo IN ('operacoes', 'operations_manager') AND p.codigo IN ('dashboard.view', 'operacoes.view', 'health.view', 'telemetria.view')
ON CONFLICT DO NOTHING;

-- Auditoria
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.codigo = 'auditoria' AND p.codigo IN ('audit.view', 'audit.export', 'health.view')
ON CONFLICT DO NOTHING;

-- 7. Assign user_roles for existing admin users
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM public.usuarios u
 CROSS JOIN public.roles r
 WHERE u.role IN ('super_admin', 'admin') AND r.codigo = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM public.usuarios u
  JOIN public.roles r ON r.codigo = u.role
 WHERE u.role NOT IN ('super_admin', 'admin', 'tomador', 'prestador')
ON CONFLICT DO NOTHING;

-- 8. RPC get_user_permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id uuid)
RETURNS TABLE (codigo text, categoria text, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If super_admin role or user_roles super_admin, return all permissions
  IF EXISTS (
    SELECT 1 FROM public.usuarios u
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      LEFT JOIN public.roles r ON r.id = ur.role_id
     WHERE u.id = p_user_id AND (u.role = 'super_admin' OR r.codigo = 'super_admin')
  ) THEN
    RETURN QUERY SELECT p.codigo, p.categoria, p.nome FROM public.permissions p;
  ELSE
    RETURN QUERY
      SELECT DISTINCT p.codigo, p.categoria, p.nome
        FROM public.permissions p
        JOIN public.role_permissions rp ON rp.permission_id = p.id
        JOIN public.user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = p_user_id;
  END IF;
END;
$$;

-- 9. RPC has_permission
CREATE OR REPLACE FUNCTION has_permission(p_user_id uuid, p_permission_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Super admin bypass
  IF EXISTS (
    SELECT 1 FROM public.usuarios u
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      LEFT JOIN public.roles r ON r.id = ur.role_id
     WHERE u.id = p_user_id AND (u.role = 'super_admin' OR r.codigo = 'super_admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.permissions p
      JOIN public.role_permissions rp ON rp.permission_id = p.id
      JOIN public.user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = p_user_id AND p.codigo = p_permission_code
  );
END;
$$;

-- 10. RPC manage_role_permissions
CREATE OR REPLACE FUNCTION manage_role_permissions(p_role_id uuid, p_permission_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  IF array_length(p_permission_ids, 1) > 0 THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT p_role_id, unnest(p_permission_ids);
  END IF;

  RETURN true;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION get_user_permissions(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION has_permission(uuid, text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION manage_role_permissions(uuid, uuid[]) TO authenticated, service_role, anon;
