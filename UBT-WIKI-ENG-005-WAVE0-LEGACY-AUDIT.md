# UBT-WIKI-ENG-005-WAVE0-LEGACY-AUDIT

## 1. Identificação
- **Data/Hora:** 2026-08-05T12:30:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Autor:** Antigravity (AI Coding Assistant)
- **Status:** **UBT-WIKI-ENG-005-WAVE0-LEGACY-AUDIT_COMPLETE**

## 2. Escopo Auditado
Foram inspecionadas as seguintes pastas, subpastas e arquivos factuais no ambiente local:
- Raiz da Wiki: `C:\Users\MacInBox\Documents\profissional\ubt\wiki`
- Código-fonte do frontend e RBAC: `C:\Users\MacInBox\Documents\profissional\ubt\pwa\src`
- Estrutura local do banco e Deno Edge Functions: `C:\Users\MacInBox\Documents\profissional\ubt\supabase`
- Relatórios técnicos de governança prévios: `UBT-WIKI-ENG-001` e `UBT-WIKI-ENG-002`.

---

## 3. Estrutura Atual da Wiki
A árvore de diretórios atualmente existente em `C:\Users\MacInBox\Documents\profissional\ubt\wiki` é a seguinte:
```
wiki/
├── 00_GOVERNANCE/
├── 01_COMPANY/
├── 02_PRODUCTS_SERVICES/
├── 03_CUSTOMER_SUPPORT/
├── 04_OPERATIONS/
├── 05_FINANCE/
├── 06_ENGINEERING/
├── 07_COMMUNICATION_MARKETING/
├── 08_LEGAL/
├── 09_ADMINISTRATION/
├── 10_AI_KNOWLEDGE/
├── 11_TEMPLATES/
├── 12_INBOX/
├── 90_ARCHIVE/
└── 99_INDEX/
```

---

## 4. Arquivos Encontrados e Classificação
Mapeamento e classificação individual de fidedignidade sobre todos os arquivos da estrutura física da Wiki:

| Arquivo | Categoria / Pasta | Estado / Princípio | Classificação | Observação |
|---|---|---|---|---|
| `00_GOVERNANCE/README.md` | Governança | `FACT` | `KEEP` | Define a equipe responsável pela governança. |
| `00_GOVERNANCE/WIKI_GOVERNANCE.md` | Governança | `FACT` | `KEEP` | Requisitos gerais de fidedignidade da base. |
| `00_GOVERNANCE/CONTENT_STATUS.md` | Governança | `FACT` | `KEEP` | Define as categorias factuais para os artigos. |
| `00_GOVERNANCE/SOURCE_POLICY.md` | Governança | `FACT` | `KEEP` | Estabelece o princípio da fonte e evidência. |
| `00_GOVERNANCE/VERSIONING_POLICY.md` | Governança | `FACT` | `KEEP` | Versionamento documental simples. |
| `00_GOVERNANCE/ACCESS_CONTROL_POLICY.md` | Governança | `FACT` | `KEEP` | Define restrição aos usuários finais. |
| `00_GOVERNANCE/AI_KNOWLEDGE_POLICY.md` | Governança | `FACT` | `KEEP` | Classificação de segurança para ingestão por IA. |
| `01_COMPANY/README.md` | Corporativo | `FACT` | `KEEP` | Estrutura institucional em backlog. |
| `02_PRODUCTS_SERVICES/README.md` | Serviços | `FACT` | `KEEP` | Documentação geral de verticais operacionais. |
| `03_CUSTOMER_SUPPORT/README.md` | Suporte | `FACT` | `KEEP` | Procedimentos básicos de suporte. |
| `04_OPERATIONS/README.md` | Operações | `FACT` | `KEEP` | Procedimentos do BackOffice operacional. |
| `05_FINANCE/README.md` | Financeiro | `FACT` | `KEEP` | Explicação conceitual de fluxos. |
| `06_ENGINEERING/README.md` | Engenharia | `FACT` | `KEEP` | Especificações de infraestrutura e RLS. |
| `07_COMMUNICATION_MARKETING/README.md` | Marketing | `FACT` | `KEEP` | BackOffice de marca e banners. |
| `08_LEGAL/README.md` | Jurídico | `FACT` | `KEEP` | Termos legais e adequação de privacidade LGPD. |
| `09_ADMINISTRATION/README.md` | Administrativo | `FACT` | `KEEP` | BackOffice administrativo geral. |
| `10_AI_KNOWLEDGE/README.md` | IA Context | `FACT` | `KEEP` | Define a divisão da camada simplificada de IA. |
| `10_AI_KNOWLEDGE/customer_support/tomador/README.md` | IA Context | `PENDING` | `UPDATE` | Subpasta com readme genérico. |
| `10_AI_KNOWLEDGE/customer_support/prestador/README.md` | IA Context | `PENDING` | `UPDATE` | Subpasta com readme genérico. |
| `10_AI_KNOWLEDGE/customer_support/geral/README.md` | IA Context | `PENDING` | `UPDATE` | Subpasta com readme genérico. |
| `10_AI_KNOWLEDGE/customer_support/escalation/README.md` | IA Context | `PENDING` | `UPDATE` | Subpasta com readme genérico. |
| `11_TEMPLATES/README.md` | Templates | `FACT` | `KEEP` | Índice de modelos estruturais. |
| `11_TEMPLATES/article_template.md` | Templates | `FACT` | `KEEP` | Modelo de cabeçalho de artigo e metadados. |
| `11_TEMPLATES/faq_template.md` | Templates | `FACT` | `KEEP` | Modelo de FAQ conversacional. |
| `11_TEMPLATES/procedure_template.md` | Templates | `FACT` | `KEEP` | Modelo de procedimento operacional. |
| `11_TEMPLATES/policy_template.md` | Templates | `FACT` | `KEEP` | Modelo de política de conformidade. |
| `11_TEMPLATES/ai_knowledge_template.md` | Templates | `FACT` | `KEEP` | Modelo de contexto do bot. |
| `11_TEMPLATES/decision_template.md` | Templates | `FACT` | `KEEP` | Modelo de decisão de engenharia (ADR). |
| `12_INBOX/README.md` | Inbox | `FACT` | `KEEP` | Regra de triagem de rascunhos. |
| `90_ARCHIVE/README.md` | Archive | `FACT` | `KEEP` | Preservação de registros depreciados. |
| `99_INDEX/README.md` | Índices | `FACT` | `KEEP` | Índice mestre de catalogação. |
| `99_INDEX/WIKI_MASTER_INDEX.md` | Índices | `FACT` | `KEEP` | Árvore mestre. |
| `99_INDEX/CONTENT_CATALOG.md` | Índices | `FACT` | `KEEP` | Lista de identificadores de artigos. |
| `99_INDEX/AI_KNOWLEDGE_CATALOG.md` | Índices | `FACT` | `KEEP` | Controle de ingestão dos agentes de IA. |
| `99_INDEX/OPEN_QUESTIONS.md` | Índices | `FACT` | `KEEP` | Registro de lacunas operacionais. |

---

## 5. Documentação Anterior
- **`UBT-WIKI-ENG-002-RBAC-PERMISSIONS`:** Analisado e verificado. As evidências técnicas daquele relatório estão 100% corretas no código-fonte do hook `usePermissions.ts` e do guard `AdminRoute.tsx`, especialmente o bypass de superadmin via e-mail e a persistência em localStorage das taxas locais.
- **`UBT-WIKI-ENG-004-CREATION-REPORT`:** Confirmada a criação da estrutura de 35 arquivos markdown de orientação no diretório do BackOffice.

---

## 6. RBAC e Permissionamento Factual Atual
- **Autenticação:** Gerenciada via Supabase Auth (`supabase.auth.getUser()`).
- **Funções (Roles):** O banco possui 13 papéis ativos. Apenas usuários que possuam claim administrativo ativo na coluna `role` da tabela `usuarios` (ou e-mail correspondente ao bypass de superadmin) passam pelo Route Guard `AdminRoute`.
- **Permissions:** 24 permissões mapeadas na tabela `public.permissions` regulam botões de visualização, edição de configurações e exclusões lógicas na plataforma.

---

## 7. Segurança e Análise do Superadmin Bypass
- **Bypass Existente:** Confirmado em `src/hooks/usePermissions.ts` line 35 e `src/components/admin/AdminRoute.tsx` line 28:
  ```typescript
  const role = user.email === "ubt.servicos@gmail.com" ? "super_admin" : (dbUser?.role || "tomador");
  ```
- **Risco:** Classificado como **Risco de Hardcoded Bypass**. Se a conta `ubt.servicos@gmail.com` sofrer comprometimento ou vazamento de senha, o invasor possuirá acesso irrestrito client-side.
- **Recomendação Futura:** Migrar o bypass para a tabela `user_roles` do banco e descontinuar verificações de string estática de e-mail no frontend.

---

## 8. Conteúdo Sensível
- **secrets e credenciais:** Não há chaves privadas de produção expostas em arquivos de código ou documentação na raiz da wiki.
- **Secrets locais:** `[DADO SENSÍVEL DETECTADO — NÃO REPRODUZIR]` (Senhas e variáveis de ambiente localizadas em `.env.local` e `inspect_rbac_and_split.cjs` estão blindadas).

---

## 9. AI Knowledge (Análise da Pasta `10_AI_KNOWLEDGE`)
A pasta `10_AI_KNOWLEDGE` foi estruturada para atuar como o **subconjunto autorizado para ingestão externa**.
- **Natureza atual:** Apenas estrutura/template (`README.md` genéricos).
- **Adequação:** Segue perfeitamente o novo princípio de segregação (não misturar a base inteira interna com a base consumida pelo agente de WhatsApp).

---

## 10. Conflitos de Conceitos Identificados

### CONFLITO DE CONCEITOS 1
- **Conceito Antigo:** A ingestão do WhatsApp-Agent consumindo diretamente os Markdowns do repositório da Wiki ou acessando a API geral.
- **Conceito Atual:** O agente externo consome estritamente a subpasta filtrada `10_AI_KNOWLEDGE` através de uma camada de autenticação ACL intermediária, sem acesso direto ao banco ou a `/wiki`.
- **Diferença:** Separação rígida de dados.
- **Recomendação:** A governança deve blindar a API de modo que ela exponha exclusivamente o escopo publicado para a audiência `tomador` ou `prestador`.

---

## 11. Legado e Candidatos a Limpeza
- **Depreciações:** Nenhum arquivo legado é candidato a deleção imediata (`DELETE_CANDIDATE: 0`). A estrutura criada na Wave anterior é a base limpa da Wiki, contendo apenas READMEs e templates, estando pronta para o início do preenchimento factual.

---

## 12. Recomendações
1. **Bypass de Superadmin:** Desacoplar a claim de e-mail estático do frontend, movendo-a para uma função nativa de validação JWT ou trigger de banco de dados.
2. **Configuração de Split:** Não implementar modificações financeiras ou tentar sincronizar a tela `/admin/split` com o banco Supabase nesta etapa da Wiki.
3. **ACL de Leitura da Wiki:** Preparar o guard de navegação da Wiki `/wiki` (que será criado na Wave 1) para restringir leitura por subpastas (ex: operadores de suporte só visualizam `03_CUSTOMER_SUPPORT`).

---

## 13. Decisões que precisam de Aprovação
- Aprovação do modelo de controle de acesso de leitura para funcionários corporativos (Restrição de visualização por área da Wiki).
