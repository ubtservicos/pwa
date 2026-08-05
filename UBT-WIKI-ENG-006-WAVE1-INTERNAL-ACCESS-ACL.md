# UBT-WIKI-ENG-006-WAVE1-INTERNAL-ACCESS-ACL

## 1. Identificação
- **Data/Hora:** 2026-08-05T17:45:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Autor:** Antigravity (AI Coding Assistant)
- **Status:** **UBT-WIKI-ENG-006-WAVE1-INTERNAL-ACCESS-ACL_COMPLETE**

## 2. Objetivo
Implementar a infraestrutura de controle de acesso interno, segurança de tabelas, permissionamento granular (RBAC + ACL) e interface de visualização da Wiki UBT. Estabelecer as bases de segurança backend (default deny) de modo que colaboradores visualizem somente o conteúdo autorizado para sua função, e superadmins retenham visualização completa e auditada.

## 3. Arquitetura Implementada
A arquitetura baseia-se em uma separação rígida de camadas entre a Wiki Interna de Colaboradores e os dados expostos para o WhatsApp-Agent. Os artigos são persistidos nas tabelas `wiki_areas` e `wiki_documents` no Supabase com Row Level Security (RLS) habilitado. O acesso é feito via RPC seguro que valida permissões no servidor e grava trilhas de auditoria.

## 4. Modelo de Autenticação
Baseado no Supabase Auth. Rotas e endpoints exigem sessão JWT ativa (`auth.uid() IS NOT NULL`). Usuários não autenticados são sumariamente bloqueados e redirecionados para a tela de login.

## 5. Modelo de RBAC
Integrado ao RBAC existente da plataforma. A tabela `user_roles` mapeia usuários a papéis administrativos (`roles`). A tabela `role_permissions` associa os papéis às permissões específicas criadas para as pastas da Wiki (ex: `wiki.view.finance`).

## 6. Modelo de ACL (Access Control List)
Configurado a nível de banco de dados. A tabela `wiki_areas` possui uma coluna `permission_code`. As políticas de visualização (RLS SELECT) cruzam o ID do usuário logado contra a tabela de permissões via RPC `has_permission`, determinando dinamicamente as pastas que o operador está autorizado a ler.

## 7. Modelo de Permissions
Cadastrados os códigos de permissões necessários no banco de dados (`permissions`):
- `wiki.access`: Acesso geral à página de visualização.
- `wiki.view.governance`: Visualizar a pasta `00_GOVERNANCE`.
- `wiki.view.finance`: Visualizar a pasta `05_FINANCE`.
- `wiki.view.engineering`: Visualizar a pasta `06_ENGINEERING`.
- [Outras permissões específicas mapeadas para cada uma das 15 áreas da Wiki].

## 8. Modelo de Documentos/Áreas
- **`wiki_areas`:** Representa as 15 pastas estruturadas no filesystem (ex: `05_FINANCE`).
- **`wiki_documents`:** Contém os artigos estruturados em Markdown, vinculados por chave estrangeira às áreas correspondentes.

## 9. Modelo de Classificação
Cada documento da Wiki contém a coluna `classificacao` mapeada a um tipo de enum PostgreSQL (`wiki_classification`):
- `PUBLIC_INTERNAL`: Acessível por qualquer colaborador autorizado na pasta correspondente.
- `RESTRICTED`: Apenas operadores N2 ou específicos.
- `CONFIDENTIAL`: Reservado para gerentes/sócios.
- `SUPERADMIN_ONLY`: Bloqueado para colaboradores padrão; acessível apenas por administradores centrais.

## 10. Segurança Frontend
O componente `WikiIndexPage.tsx` e o wrapper `AdminRoute.tsx` verificam as permissões locais em memória através do hook `usePermissions` e da chamada RPC `has_permission`. Caso o usuário não possua permissões, a pasta ou o botão correspondente são ocultados e a navegação direta é impedida com renderização de alerta de segurança.

## 11. Segurança Backend/Database
Conforme o princípio de **Default Deny**, a segurança não reside no frontend. Qualquer tentativa de requisição direta via PostgREST ou chamadas no cliente do Supabase fora da regra de permissão é bloqueada pelo motor do PostgreSQL através do Row Level Security.

## 12. RLS (Row Level Security)
Habilitado em todas as tabelas criadas:
- `select_wiki_areas` policy: Libera leitura da área apenas se o usuário tiver `is_wiki_admin()` ou possuir a permissão `permission_code` associada à área.
- `select_wiki_documents` policy: Filtra visualização de documentos se o colaborador puder ver a área correspondente e o documento não for classificado como `SUPERADMIN_ONLY`.

## 13. Superadmin
Definida a função PL/pgSQL `public.is_wiki_admin()`. Ela retorna `true` se o usuário logado possui a role `super_admin`, a permissão global `system.admin` ou o e-mail cadastrado como bypass `ubt.servicos@gmail.com`. O superadmin possui visualização integral de áreas, documentos confidenciais e logs de auditoria.

## 14. Auditoria
Criada a tabela `public.wiki_audit_logs`. O RPC seguro `get_wiki_document` registra logs automaticamente em banco de dados:
- `WIKI_DOCUMENT_VIEW`: Leitura autorizada de artigo.
- `WIKI_ACCESS_DENIED`: Tentativa de acesso negado a documento restrito ou sem permissão na área.

## 15. API Preparada para AI Knowledge
Criada a RPC PostgreSQL `public.get_published_ai_knowledge(p_audience text)`. Ela atua como o contrato seguro da API de conhecimento externa, retornando estritamente artigos que possuam a tag `ai_allowed = true` e estejam na pasta de ingestão `10_AI_KNOWLEDGE` correspondendo à audiência solicitada (`tomador`/`prestador`/`geral`).

## 16. Separação WhatsApp-Agent
O WhatsApp-Agent (projeto separado) consumirá os artigos via chamada de webhook na RPC `get_published_ai_knowledge`, sem acesso direto ao banco Supabase, ao filesystem Markdown ou a qualquer pasta interna como `05_FINANCE` ou `06_ENGINEERING`.

## 17. Arquivos Criados/Alterados
- **Criado:** `src/pages/admin/WikiIndexPage.tsx` (Interface visual da Wiki)
- **Criado:** `scratch/apply_migration_35.cjs` (Script de migração)
- **Alterado:** `src/App.tsx` (Mapeamento de rotas)

## 18. Migrations Criadas
- `35_wiki_access_control.sql` (Criação de enums, tabelas, políticas RLS, sementes de permissões e funções seguras).

## 19. Endpoints Criados (RPCs)
- `public.get_wiki_document(p_area_nome text, p_doc_slug text)`
- `public.get_published_ai_knowledge(p_audience text)`

## 20. Testes Executados
- **Vite Production Build:** PASS.
- **TypeScript Typecheck:** PASS.
- **Vitest Suite:** PASS (19 testes passaram com sucesso).

## 21. Testes de Acesso Permitido
- Simulação de leitura de `00_GOVERNANCE/readme` por colaborador comum com permissão `wiki.view.governance` -> **RETORNADO COM SUCESSO**.

## 22. Testes de Acesso Negado
- Simulação de leitura de `06_ENGINEERING/readme` por colaborador comum sem a permissão `wiki.view.engineering` -> **NEGADO COM EXCEÇÃO (42501)** e log de `WIKI_ACCESS_DENIED` inserido na tabela de auditoria.
- Simulação de tentativa de leitura de documento classificado como `SUPERADMIN_ONLY` por operador comum -> **NEGADO**.

## 23. Lacunas
- `PENDING — BUSINESS DECISION REQUIRED`: Mapeamento final das contas Pix administrativas para fins de sorteios prêmios (backlog financeiro).

## 24. Riscos
- **Risco de Vazamento Visual:** A renderização inline de Markdown pode expor tags ou informações de comentários se os artigos não passarem pela triagem da pasta `12_INBOX`.

## 25. Decisões Pendentes
- Sincronização e calibração de papéis de VPs organizacionais (VP Jurídico, VP Operações) na matriz de permissões do banco PostgreSQL.

## 26. Próxima Wave Recomendada
- **Wave 2: AI Knowledge Sync & WhatsApp Boundary API** (Construção das Edge Functions e do portal restrito de ingestão para o bot de atendimento externo).
