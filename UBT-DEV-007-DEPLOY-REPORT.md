# UBT-DEV-007-DEPLOY-REPORT

## 1. Identificação
- **Data/Hora:** 2026-08-02T15:35:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Branch:** `main`
- **Commit Local:** `cce5da5 fix(waitlist): resolve public waitlist submission and apply layout/multi-profile adjustments`
- **URL de Produção Alvo:** `https://ubtservicos.vercel.app/`

## 2. Resultado da Compilação e Build
* **TypeScript type check (`npx tsc --noEmit`):** PASS (Zero erros).
* **Vite Production Build (`npm run build`):** PASS (Build gerada com sucesso na pasta `/dist`).

## 3. Resultado do Deploy Vercel
* **Status:** **BLOCKED**
* **Causa do Bloqueio:** O comando `git push origin main` falhou devido a restrições de conexão de rede/DNS no host local (`Could not resolve host: github.com`), impossibilitando o envio das alterações para o repositório remoto no GitHub. Como a Vercel realiza a compilação contínua baseada em commits de push, o deploy de produção está bloqueado até que a conexão de rede com o GitHub seja estabelecida/autorizada no ambiente do terminal local.

## 4. Evidências do Git local
* As alterações e relatórios técnicos do projeto foram agrupados e commitados localmente com sucesso:
```text
cce5da5 fix(waitlist): resolve public waitlist submission and apply layout/multi-profile adjustments
4268938 docs: finalize recovery precommit audit
```

## 5. Smoke Tests e Testes Locais
* **Validação do Formulário Waitlist:** PASS (O formulário e o banco foram validados localmente via PG e respondem com 100% de sucesso. Não ocorrem mais erros 400 ou violação de restrições NOT NULL em `ip_hash`).
* **Estrutura multi-perfil:** PASS (Os múltiplos perfis persistem e são consultados via array `text[]` com sucesso).
* **AdminWaitlistPage:** PASS (Painel administrativo livre de erros de carregamento e imports órfãos).
* **Analytics Dashboard:** PASS (Consultas atualizadas funcionando sob o schema unificado de `created_at_utc` / `event_name` / `properties`).

## 6. Conclusão Final do Deploy
* **Status Final:** **DEPLOY_BLOCKED**
* **Motivo:** Falha de rede local impede a execução do `git push` para o GitHub, suspendendo o trigger automático da Vercel. O código local está pronto, compilado e testado. Para concluir, o usuário deve restabelecer a conectividade do terminal com o GitHub para efetuar o push ou realizar a publicação via CLI manual.
