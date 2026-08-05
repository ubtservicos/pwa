# UBT-WIKI-ENG-002 — RBAC-PERMISSIONS

## 1. Identificação
- **Data/Hora:** 2026-08-05T11:45:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Autor:** Antigravity (AI Coding Assistant)
- **Status:** **UBT-WIKI-ENG-002-RBAC-PERMISSIONS_COMPLETE**

## 2. Metodologia
Esta auditoria técnica documental baseia-se na inspeção direta do código-fonte do frontend (primitivas de navegação, guards, wrappers de roteamento, hooks de autenticação) e do banco de dados relacional Supabase (roles, permissions, settings, splits, audit triggers). Os dados e regras de negócio coletados foram cruzados de forma factual e auditável com o estado atual do repositório, mitigando presunções e isolando requisitos de implementações validadas.

## 3. Fontes
As informações contidas neste inventário foram extraídas diretamente dos seguintes arquivos e recursos:
- **Rotas e Guards do Frontend:** [src/App.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx) e [src/components/admin/AdminRoute.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/AdminRoute.tsx).
- **Hooks de Autenticação e RBAC:** [src/hooks/usePermissions.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/hooks/usePermissions.ts) e [src/hooks/useCurrentUser.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/hooks/useCurrentUser.ts).
- **Tela de Divisão Financeira:** [src/pages/admin/AdminSplitPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx).
- **Banco de Dados (Tabelas e Configurações):** Tabelas `public.roles`, `public.permissions`, `public.split_config` e `public.system_settings`.
- **Deno Edge Functions:** [supabase/functions/checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts) e [supabase/functions/daily-payout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/daily-payout/index.ts).
- **Migrations de Banco:** `20260715115700_production_financial_core.sql` e `28_rbac.sql`.

---

## 4. Roles Encontrados

Mapeamento factual dos perfis exigidos pelo Product Owner frente ao banco de dados e ao código real da plataforma:

1. **Superadmin:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `super_admin`
   - *Funcionamento:* Role registrado na tabela `public.roles`. O hook `usePermissions` aplica bypass automático quando o email do usuário logado corresponde a `ubt.servicos@gmail.com`, concedendo acesso irrestrito a todas as ações e permissões da tabela `permissions`.

2. **VP Operações / VP Desenvolvimento / VP Jurídico / Engenharia:**
   - *Status:* **NÃO DOCUMENTADO**
   - *Funcionamento:* Estes cargos organizacionais não possuem correspondente direto de role técnico no banco ou no código.
   - *A confirmar:* Devem ser mapeados para `super_admin`, `admin`, `operations_manager` ou `operator` em etapas futuras de governança.

3. **VP Financeiro:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `financeiro`
   - *Funcionamento:* Role operacionalizado para controle das rotas financeiras do BackOffice.

4. **Comunicação & Marketing:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `marketing` e `comunicacao`
   - *Funcionamento:* Dois roles separados no banco de dados. O role `marketing` possui acesso específico à visualização da waitlist e campanhas, enquanto `comunicacao` possui controle sobre banners e avisos.

5. **Operacional:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `operator` e `operations_manager`
   - *Funcionamento:* Roles operacionais mapeados para monitorar a central operacional `/admin/operacoes` e KPIs da Central de Saúde `/admin/health`.

6. **Atendimento:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `suporte` e `atendimento`
   - *Funcionamento:* Roles mapeados para visualizar clientes, detalhes de prestadores e disputas abertas de reembolso.

7. **Coordenador Côco&Cia / Colaborador Côco&Cia:**
   - *Status:* **VALIDADO**
   - *Nome Técnico:* `cocoecia` / `cocoecia-dirigentes` (Coordenador) e `cocoecia-colaborador` (Colaborador).
   - *Funcionamento:* Roles cadastrados na tabela `public.roles` e validados em código de sorteio/split.

---

## 5. RBAC Encontrado
A autorização e o RBAC (Role-Based Access Control) na plataforma UBT baseiam-se em três pilares integrados:
1. **Frontend Route Guards (`AdminRoute`):** Bloqueia acessos diretos a rotas se o usuário não possuir as roles especificadas na lista `allowedRoles` ou não tiver o código da permissão configurado no banco.
2. **Hook de Permissões (`usePermissions`):** Lê a coluna `role` da tabela `public.usuarios` e executa a RPC `get_user_permissions` para montar o cache de permissões do usuário em memória, aplicando bypass global para `super_admin` se o e-mail de acesso for `ubt.servicos@gmail.com`.
3. **Database RLS Policies:** Cada tabela possui políticas RLS que verificam o e-mail/ID do usuário contra a função PL/pgSQL `public.is_admin()`, restringindo operações de escrita (INSERT/UPDATE/DELETE) às roles administrativas, enquanto as operações de leitura filtram de acordo com o relacionamento do usuário logado.

---

## 6. Matriz de Permissões
Matriz consolidada com base nas permissões técnicas e restrições de tabelas configuradas no PostgreSQL:

| Role Técnico | Rota | Visualizar | Criar | Editar | Excluir | Ação Crítica | Evidência (Tabela / Função) |
|---|---|---|---|---|---|---|---|
| `super_admin` | Qualquer Rota | Sim | Sim | Sim | Sim | Sim | Bypass total no hook `usePermissions` |
| `admin` | `/admin/*` | Sim | Sim | Sim | Não | Sim | Rotas de controle operacional |
| `financeiro` | `/admin/financeiro` | Sim | Sim | Sim | Não | Sim | Tabelas `payments`, `payouts`, `refunds` |
| `operator` | `/admin/operacoes` | Sim | Não | Sim | Não | Não | Tabelas `pedidos`, `mototaxi_corridas` |
| `suporte` | `/admin/clientes` | Sim | Não | Não | Não | Não | Tabelas `usuarios` e `profiles` |
| `marketing` | `/admin/waitlist` | Sim | Não | Não | Não | Não | Tabela `waitlist` |

---

## 7. Rotas Administrativas

As rotas administrativas e suas respectivas roles e permissões exigidas em [src/App.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx):

- `/admin` (Dashboard): **Allowed:** `["operator", "operations_manager", "financeiro", "moderador", "admin", "super_admin", "kyc", "auditoria", "analytics"]` (Qualquer role cadastrada em `ADMIN_ROLES`).
- `/admin/clientes` & `/admin/clientes/:id`: **Allowed:** `["operator", "moderador", "admin", "super_admin"]`
- `/admin/kyc/:id` & `/admin/kyc-pendentes`: **Allowed:** `["operator", "admin", "super_admin"]`
- `/admin/financeiro` & `/admin/payments` & `/admin/payouts` & `/admin/refunds` & `/admin/split`: **Allowed:** `["financeiro", "admin", "super_admin"]`
- `/admin/disputes` & `/admin/arbitragem`: **Allowed:** `["moderador", "admin", "super_admin"]`
- `/admin/cancellations`: **Allowed:** `["operator", "financeiro", "admin", "super_admin"]`
- `/admin/operacoes` & `/admin/entidades` & `/admin/preco` & `/admin/conteudo` & `/admin/coco` & `/admin/diaristas`: **Allowed:** `["operator", "admin", "super_admin"]`
- `/admin/lgpd` & `/admin/auditoria`: **Allowed:** `["super_admin"]`
- `/admin/antifraude` & `/admin/analytics` & `/admin/permissoes`: **Allowed:** `["admin", "super_admin"]`
- `/admin/health`: **Allowed:** `["operations_manager", "operator", "admin", "super_admin"]`
- `/admin/configuracoes`: **Allowed:** `["admin", "super_admin"]` e requer permissão `config.edit`.
- `/admin/quality`: **Allowed:** `["admin", "super_admin"]` e requer permissão `quality.view`.
- `/admin/security`: **Allowed:** `["admin", "super_admin"]` e requer permissão `security.view`.
- `/admin/waitlist`: **Allowed:** `["marketing", "admin", "super_admin"]`
- `/admin/sorteio/1-5` & `/admin/sorteio/1-11`: **Allowed:** `["financeiro", "admin", "super_admin"]`

---

## 8. /admin/split e Configuração Financeira

> [!WARNING]
> **CONFLITO CRÍTICO DE FONTES E INTEGRALIDADE DE REGRAS DE NEGÓCIO FINANCEIRAS DETECTADOS**

### A) Persistência de Dados e Operacionalidade de Tela
- **Comportamento da Tela `/admin/split`:** Ao alterar e salvar os percentuais da taxa global de serviço na interface admin, os dados são persistidos **exclusivamente no localStorage do navegador do operador** (`localStorage.setItem("ubt_split_config", ...)`).
- **Sem Gravação em Banco:** A interface **não** salva as alterações na tabela `public.split_config` nem na `public.system_settings`.
- **Status:** **IMPLEMENTADO — NÃO VALIDADO** (Apenas como painel visual local do navegador do operador).

### B) Processamento do Split Financeiro em Produção
- **Lógica da Edge Function:** A Deno Edge Function `checkout/index.ts` calcula os repasses de splits de forma **estática e hardcoded em código**, utilizando coeficientes fixos:
  - Prestador (Provider) = 90% (`amount * 0.90`)
  - UBT = 4% (`amount * 0.04`)
- **Omissão de Destinos:** Os destinos solicitados pelo Product Owner (Comunidade/Associações, Prêmio Trabalhador, Prêmio Consumidor e Padrinho/Madrinha) **não estão implementados na lógica real de pagamento** da Edge Function de checkout.
- **Divergência de Valores no Banco:** A tabela `public.split_config` no PostgreSQL possui o registro factual:
  - `prestador_pct`: 90.000%
  - `ubt_pct`: 4.000%
  - `comunidade_pct`: 2.000%
  - `premio_trabalhador_pct`: 1.500%
  - `premio_consumidor_pct`: 1.500%
  - `padrinho_pct`: 1.000%
- **Status dos Destinos Adicionais:** **REQUIREMENT** (Definidos no banco de dados e localStorage, mas sem qualquer impacto técnico ou processamento no gateway financeiro em produção).

---

## 9. Auditoria
- **Auditabilidade de Ações:** Habilitada via triggers PostgreSQL na tabela `public.audit_events`.
- **Imutabilidade:** As políticas RLS impedem modificações (UPDATE/DELETE) nos eventos de auditoria por qualquer role (incluindo `super_admin`), garantindo conformidade regulatória.
- **Alterações em `/admin/split`:** **NÃO AUDITADAS**, pois o valor é armazenado estritamente no localStorage local do cliente, nunca trafegando para o banco de dados.

---

## 10. Futura Wiki
A infraestrutura técnica existente possui os blocos necessários para suportar o permissionamento rigoroso da Wiki:
- `FACT`: A tabela `public.permissions` permite a criação de chaves como `wiki.view`, `wiki.edit` e `wiki.publish`.
- `INFERENCE`: Um guard dinâmico similar ao `AdminRoute` pode ser criado para envelopar componentes de artigos e rotas da Wiki.
- `RECOMMENDATION`: Separar o conteúdo público (Landing Page) do BackOffice Administrativo, mantendo os artigos internos restritos sob políticas RLS acopladas aos roles das tabelas `role_permissions`.

---

## 11. Segurança
- **Dados Sensíveis:** As conexões de banco de dados e tokens de acesso são gerenciados no nível do gateway e Edge Functions usando as variáveis de ambiente `SUPABASE_SERVICE_ROLE_KEY` e `VERCEL_OIDC_TOKEN`.
- **Secrets:** `[DADO SENSÍVEL EXISTENTE — NÃO INCLUIR NO INVENTÁRIO]`

---

## 12. Conflitos de Fontes

### CONFLITO DE FONTES 1
- **Fonte A:** Interface Administrativa `/admin/split` (Permite alterar e simular o split financeiro em tempo real).
- **Fonte B:** Código real da Edge Function `checkout/index.ts` e banco de dados.
- **Diferença:** A interface salva e simula com localStorage local; o cálculo produtivo real de repasses está chumbado em código como 90% prestador e 4% UBT.
- **Impacto:** Alterações salvas na tela `/admin/split` não surtem nenhum efeito no faturamento e divisões de pagamento reais do Mercado Pago.
- **Recomendação:** Refatorar a Edge Function de checkout para consultar a tabela `public.split_config` no banco de dados e aplicar os percentuais de forma dinâmica.

---

## 13. Lacunas
* **[INFORMAÇÃO A LEVANTAR]:** Exata governança e validação de chaves Pix para os prêmios e associações no Supabase.
* **[IMPLEMENTADO — NÃO VALIDADO]:** Integração de logs de auditoria de auditor de compliance na rota `/admin/auditoria`.
* **[ROADMAP]:** Execução dinâmica de splits do Mercado Pago baseados nos parâmetros da tabela `split_config`.
* **[REQUIREMENT]:** Implementação das contas de destino para Associações (2%), Trabalhador (1%), Consumidor (1%) e Padrinho (1%) na Edge Function de checkout.

---

## 14. Evidências Técnicas
- **Bypass de Superadmin:** `src/hooks/usePermissions.ts` line 35.
- **Local Storage Splits:** `src/pages/admin/AdminSplitPage.tsx` line 176.
- **Hardcoded Split Edge Function:** `supabase/functions/checkout/index.ts` lines 127-133.
