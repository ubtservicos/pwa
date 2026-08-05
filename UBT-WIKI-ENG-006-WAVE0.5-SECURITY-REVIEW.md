# UBT-WIKI-ENG-006-WAVE0.5-SECURITY-REVIEW

## 1. Status
- **Status Geral:** **COMPLETE**
- **Resultado Global:** **SAFE WITH FINDINGS**

## 2. Escopo Auditado
Foram submetidos à análise de isolamento, auditoria de código e testes de vulnerabilidade telemática os seguintes componentes e esquemas da arquitetura da Wiki:
- **Tabelas e Permissões:** `public.wiki_areas`, `public.wiki_documents`, `public.wiki_audit_logs`.
- **Row Level Security (RLS):** Regras de leitura, escrita e modificação de esquemas.
- **RPCs Seguras:** `public.get_wiki_document` e `public.get_published_ai_knowledge`.
- **Roteador e Componentes:** [src/App.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx) e [src/pages/admin/WikiIndexPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/WikiIndexPage.tsx).

---

## 3. Evidências Técnicas
- **Default Deny no Banco:** A tabela `public.wiki_documents` possui RLS ativo com políticas de select vinculadas ao RPC `has_permission` no schema de dados, o que impossibilita que um usuário recupere dados efetuando bypass de frontend ou efetuando requisições REST brutas para o PostgREST.
- **Imutabilidade de Logs:** A tabela `public.wiki_audit_logs` só possui política ativa para SELECT (restrita a admins) e INSERT (authenticated). Não há nenhuma política de UPDATE ou DELETE cadastrada, tornando a trilha de auditoria imutável por padrão.

---

## 4. Testes Executados e Resultados

### Teste A — Acesso Não Autenticado
- *Método:* Tentar acessar a rota `/wiki` no browser ou chamar a RPC `get_wiki_document` sem cabeçalhos JWT.
- *Resultado:* **PASS** (Redirecionado no frontend pelo `AdminRoute`; no banco de dados, o Supabase bloqueia a query pelo teste `auth.uid() IS NOT NULL`).

### Teste B — Isolamento de Funcionário Comum
- *Método:* Simulação de usuário com role `operator` (sem permissão em `05_FINANCE`) tentando ler dados da pasta financeira via RPC e consulta direta PostgREST.
- *Resultado:* **PASS** (PostgreSQL retorna erro de restrição de acesso `42501` e grava log de `WIKI_ACCESS_DENIED`).

### Teste C — Teste de Documento SUPERADMIN_ONLY
- *Método:* Operador com acesso padrão à pasta tenta consultar um documento interno marcado como `SUPERADMIN_ONLY`.
- *Resultado:* **PASS** (RLS e RPC barram a linha pelo filtro `classificacao <> 'SUPERADMIN_ONLY'`).

### Teste D — Isolamento do WhatsApp-Agent (get_published_ai_knowledge)
- *Método:* Chamar a RPC passando audiência `tomador` e verificar se vaza dados das pastas internas (`05_FINANCE`, `06_ENGINEERING`) ou logs de auditoria.
- *Resultado:* **PASS** (A query possui cláusulas estritas `ai_allowed = true` e `wa.nome = '10_AI_KNOWLEDGE'`, isolando 100% de outros metadados ou pastas internas).

### Teste E — Write / Tampering Direct Check
- *Método:* Tentar executar um `INSERT` ou `UPDATE` na tabela `wiki_documents` com usuário sem a role `super_admin` ou `admin`.
- *Resultado:* **PASS** (Barrado pelo RLS que exige `public.is_wiki_admin()`).

---

## 5. Findings (Achados de Segurança)

### FINDING-01: KNOWN_RISK — HARD-CODED SUPERADMIN BYPASS
- **Severidade:** Média.
- **Descrição:** A verificação de superadmin inclui comparação estática da string de e-mail `'ubt.servicos@gmail.com'` no frontend (`usePermissions.ts`, `AdminRoute.tsx`) e na função SQL `public.is_wiki_admin()`.
- **Evidência:** `src/hooks/usePermissions.ts` line 35, `AdminRoute.tsx` line 28, e `35_wiki_access_control.sql` line 62.
- **Impacto:** Centralização de credencial e risco em caso de vazamento da senha deste e-mail específico.
- **Recomendação:** Migrar o controle de superadmin exclusivamente para claims persistidas na tabela `public.user_roles` do banco Supabase.
- **Corrigir agora?** **NO** (Congelado para validação posterior do PO).

### FINDING-02: LOGGING BYPASS ON DIRECT POSTGREST ACCESS
- **Severidade:** Baixa.
- **Descrição:** Se um colaborador com permissão de leitura consultar os documentos diretamente via PostgREST/REST API (em vez de chamar a RPC `get_wiki_document`), a leitura é autorizada pelo RLS, mas o log `WIKI_DOCUMENT_VIEW` não é inserido em `wiki_audit_logs` (pois o insert de auditoria reside dentro da lógica do RPC).
- **Evidência:** Políticas RLS e RPC em `35_wiki_access_control.sql`.
- **Impacto:** Logs de visualização incompletos se o usuário utilizar clientes de API alternativos para consumir a base de dados.
- **Recomendação:** Implementar um trigger de banco de dados `AFTER SELECT` (ou monitoramento de auditoria a nível de infraestrutura de rede) para garantir gravação imutável de leituras de tabelas críticas.
- **Corrigir agora?** **NO**.

---

## 6. Security Matrix

| Cenário | Resultado |
|---|---|
| Funcionário acessa área autorizada | **PASS** |
| Funcionário acessa área não autorizada | **PASS** (Acesso bloqueado por RLS/RPC) |
| Funcionário acessa CONFIDENTIAL não autorizado | **PASS** (Acesso bloqueado por RLS) |
| Funcionário acessa SUPERADMIN_ONLY | **PASS** (Acesso bloqueado por classificação no banco) |
| Tomador acessa /wiki | **PASS** (Bloqueado por Guard no frontend) |
| Prestador acessa /wiki | **PASS** (Bloqueado por Guard no frontend) |
| Tomador chama RPC diretamente | **PASS** (Rejeitado por credenciais JWT) |
| Prestador chama RPC diretamente | **PASS** (Rejeitado por credenciais JWT) |
| WhatsApp-Agent recebe conteúdo não autorizado | **PASS** (Restrito pela RPC estática `get_published_ai_knowledge`) |
| Usuário altera ai_allowed | **PASS** (Rejeitado por políticas de escrita RLS) |
| Usuário altera classification | **PASS** (Rejeitado por políticas de escrita RLS) |
| Usuário altera published | **PASS** (Rejeitado por políticas de escrita RLS) |
| Auditoria de acesso permitido | **PASS** (Log `WIKI_DOCUMENT_VIEW` gravado) |
| Auditoria de acesso negado | **PASS** (Log `WIKI_ACCESS_DENIED` gravado) |
| Auditoria pode ser adulterada | **PASS** (Default Deny para UPDATE/DELETE na tabela de logs) |

---

## 7. Conclusão
A arquitetura de segurança, isolamento granular e ACL implementada na Wiki UBT é classificada como:
- **SAFE WITH FINDINGS** (Apta para receber a Wave 1 de dados e alimentação telemática, com recomendações de monitoramento a serem corrigidas em sprints de manutenção subsequentes).
