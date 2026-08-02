# UBT-DEV-011-PRODUCTION-AUDIT-REPORT

## 1. Identificação do Estado Atual
- **Data/Hora:** 2026-08-02T16:25:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Branch:** `main`
- **Commit HEAD Local:** `39ce870 docs: include UBT-DEV-009 execution report`
- **Commit origin/main (GitHub):** `4268938 docs: finalize recovery precommit audit`
- **Git Status:** O branch local `main` está à frente de `origin/main` por 3 commits (`cce5da5`, `b99a010`, `39ce870`).
- **Estado de Publicação:** Os commits locais contendo as correções e arquivos de rotas **não foram publicados** no GitHub devido ao bloqueio de rede no terminal local (`Could not resolve host: github.com`). Consequentemente, o build de produção atualmente em execução na Vercel está desatualizado (ainda no commit `4268938`).

## 2. Landing Page
* **Comportamento em Produção (`https://ubtservicos.vercel.app/`):**
  * **Status:** PASS
  * A página abre normalmente, assets estáticos carregam e vídeos/imagens integrados rodam sem erros críticos ou crashes.

## 3. Waitlist — Teste Real em Produção
* **Comportamento em Produção:**
  * **Status:** FAIL
  * A submissão do formulário na Landing Page de produção falha com código `HTTP 400` do Supabase.
* **Causa do Erro:** O frontend de produção atual (commit `4268938`) não envia a propriedade `ip_hash` no payload. Como a coluna é `text NOT NULL` no banco Supabase, o banco rejeita a operação (código `23502`).
* **Estado Multi-Profile:** Em produção, o seletor continua como dropdown único e a persistência é feita como string simples, enquanto o banco já foi migrado local e remotamente para `text[]` (o array é gerado pelo banco para registros legados, mas o frontend não implementou a interface checkbox múltipla ainda).

## 4. Login Direto
* **Comportamento em Produção (`https://ubtservicos.vercel.app/login`):**
  * **Status:** FAIL
  * Retorna erro `404: NOT_FOUND` da Vercel. A aplicação React e o formulário de login não são carregados em acessos diretos por falta de regras SPA no servidor.

## 5. Admin Direto
* **Comportamento em Produção (`https://ubtservicos.vercel.app/admin`):**
  * **Status:** FAIL
  * Retorna erro `404: NOT_FOUND` da Vercel.

## 6. Usuário Comum
* **Identificação:**
  * **USUARIO_COMUM_LOGIN_URL:** `https://ubtservicos.vercel.app/login`
  * **Área Autenticada:** `https://ubtservicos.vercel.app/app/home` (guarda termos e home de diaristas/mototaxis).
  * **Status de Fluxo:** FAIL (bloqueado em produção devido à falha de acesso direto / 404).

## 7. SuperAdmin
* **Identificação:**
  * **SUPERADMIN_LOGIN_URL:** `https://ubtservicos.vercel.app/admin/login`
  * **Painel Administrativo:** `https://ubtservicos.vercel.app/admin`
  * **Status de Fluxo:** FAIL (bloqueado em produção por erro 404 de rotas).

## 8. Admin Waitlist
* **Comportamento em Produção (`https://ubtservicos.vercel.app/admin/waitlist`):**
  * **Status:** FAIL
  * O painel administrativo não abre diretamente (retorna 404). Em navegação client-side interna, o componente quebra com `ReferenceError` devido à falta de import do ícone `ShieldCheck` no cabeçalho do arquivo.

## 9. Analytics UBT
* **Comportamento em Produção (`https://ubtservicos.vercel.app/admin/analytics`):**
  * **Status:** FAIL
  * Em navegação interna, a página falha ao buscar eventos de analytics pois realiza queries nas colunas antigas (`created_at`, `event_type`, `metadata`), enquanto o banco de dados Supabase já opera sob o schema core unificado (`created_at_utc`, `event_name`, `properties`).

## 10. Sentry
* **Status:** **SENTRY_NON_BLOCKING_FAIL** (O erro 403 Forbidden no POST de ingestão persiste, porém é classificado como falha de observabilidade não bloqueante para a operação de negócio).

## 11. Rotas SPA / Vercel
* **Status:** FAIL
* O arquivo `vercel.json` não está presente no deploy de produção da Vercel. Consequentemente, rotas internas como `/login`, `/admin` e `/app/home` geram erro 404.

## 12. Supabase
* **Status:** PASS
* Conectividade ativa e políticas de segurança (RLS) operacionais. O banco rejeita payloads inválidos e aceita inserções válidas (testadas localmente).

## 13. Compilação Local (Build e TypeScript)
* **npx tsc --noEmit:** PASS (Sem erros).
* **npm run build:** PASS (Build gerada com sucesso na pasta `/dist`).

## 14. Matriz de Classificação Final

| Item | Status de Produção |
|---|---|
| LANDING | PASS |
| WAITLIST | FAIL |
| LOGIN | FAIL |
| ADMIN | FAIL |
| USER_FLOW | FAIL |
| SUPERADMIN_FLOW | FAIL |
| ADMIN_WAITLIST | FAIL |
| UBT_ANALYTICS | FAIL |
| SPA_ROUTES | FAIL |
| SUPABASE | PASS |
| BUILD | PASS |
| TYPESCRIPT | PASS |
| SENTRY | FAIL — NON-BLOCKING |

---

## 15. Conclusões e Classificações

- **FUNCTIONAL_PRODUCTION_STATUS:** **BLOCKED**
- **OBSERVABILITY_STATUS:** **SENTRY_NON_BLOCKING_FAIL**

* **Justificativa do Bloqueio:** Embora as correções técnicas para todos os problemas tenham sido implementadas e validadas localmente com sucesso, elas **não estão publicadas** no deploy de produção da Vercel devido ao bloqueio de rede no terminal local para a execução de `git push`. A produção continua operando com código desatualizado, sofrendo de falhas de rotas SPA (404), travamento do formulário waitlist (400) e crashes de referência em páginas admin.

## 16. Próximos Passos
1. Restabelecer a conectividade do host local com o GitHub (`github.com`) para liberar a execução de `git push`.
2. Efetuar o push da branch `main` contendo os commits de correções.
3. Acompanhar e validar a implantação automática do deploy na Vercel.
4. Repetir smoke tests em ambiente de produção após deploy para declarar o status READY_FOR_PILOT.
