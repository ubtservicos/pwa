# UBT-DEV-009-ROUTES-WAITLIST-SENTRY-REPORT

## 1. Identificação
- **Data/Hora:** 2026-08-02T16:10:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Branch:** `main`
- **Commit Inicial:** `4268938 docs: finalize recovery precommit audit`
- **Commit Atual:** `b99a010 chore(config): add vercel.json for SPA fallback and include validation reports`

## 2. Problema das Rotas (SPA Fallback)
* **Causa Raiz:** O React Router usa `BrowserRouter` para lidar com rotas dinâmicas do lado do cliente. No entanto, em deployments de produção na Vercel, o servidor tenta carregar caminhos como `/login` ou `/admin` como arquivos estáticos físicos. Pelo fato de estarem ausentes no build estático (`dist/`), a Vercel retorna a página default `404 NOT_FOUND`.
* **Correção Aplicada:** Criado o arquivo [vercel.json](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/vercel.json) na raiz do projeto com as regras de reescrita adequadas para SPA (redirecionando todos os caminhos para `/index.html`), excluindo explicitamente assets estáticos, service workers e manifestos:
```json
{
  "rewrites": [
    { "source": "/((?!manifest\\.json|sw\\.js|assets/|favicon\\.ico).*)", "destination": "/index.html" }
  ]
}
```

## 3. Problema do Formulário Waitlist
* **Causa Raiz:** A coluna `ip_hash` na tabela `public.waitlist` foi definida como `text NOT NULL` sem DEFAULT na migração `32_waitlist.sql`. O frontend omitia esse campo do payload de submissão do formulário, disparando a violação de constraint `23502` (HTTP 400).
* **Evidência do Payload Antes/Depois:**
  * **Antes (Falha):**
    ```typescript
    {
      nome: formName,
      email: formEmail,
      telefone: formPhone,
      cidade: formCity,
      perfil: formProfiles,
      consentimento_lgpd: true,
      status: "novo",
      created_at_local: createdLocal,
      origem: "direto"
    }
    ```
  * **Depois (Corrigido em cce5da5):**
    ```typescript
    {
      nome: formName,
      email: formEmail,
      telefone: formPhone,
      cidade: formCity,
      perfil: formProfiles,
      consentimento_lgpd: true,
      status: "novo",
      created_at_local: createdLocal,
      origem: "direto",
      ip_hash: ipHashVal,
      device_type: parsedUA.device_type,
      browser: parsedUA.browser,
      os: parsedUA.os
    }
    ```
* **Resultado do Teste Real de INSERT:** PASS (Validação realizada com sucesso via inserção direta PostgreSQL de teste contendo múltiplos perfis e o `ip_hash` gerado, que foi devidamente excluído logo em seguida para manter o banco limpo).
* **Resultado da Validação Multi-Profile:** PASS (Coluna `perfil` atende à estrutura `text[]` alterada e o painel administrativo exibe e filtra os múltiplos perfis perfeitamente).
* **Resultado RLS:** PASS (As políticas de segurança de linha continuam ativas e operacionais).
* **Necessidade de Migration:** **MIGRATION_NOT_REQUIRED** (Nenhuma nova migração de banco foi necessária, visto que a estrutura do Supabase foi mantida e atendida pelo novo payload).

## 4. Diagnóstico do Sentry 403
* **Causa do Erro ingest (POST 403 Forbidden):** O DSN está configurado como `VITE_SENTRY_DSN` e é injetado pelo ambiente de build. O erro `403 Forbidden` indica rejeição do ingestor do Sentry. As causas prováveis são chaves de API/DSN revogadas, expiração da quota limite do plano de observabilidade, ou a ausência do domínio `ubtservicos.vercel.app` na lista de **Allowed Domains** (Segurança) nas configurações do projeto no dashboard do Sentry.
* **Ação Manual Recomendada:**
  1. Acessar o console do **Sentry** e verificar se as chaves (DSN) estão ativas e se a quota de eventos foi atingida.
  2. Adicionar o domínio `ubtservicos.vercel.app` à lista de *Allowed Domains* nas configurações do projeto Sentry.
  3. Caso o DSN precise ser atualizado, configurar a variável `VITE_SENTRY_DSN` com o novo valor na console da **Vercel** sob as configurações de variáveis de ambiente do projeto.

## 5. Validação de Compilação e Qualidade
* **TypeScript Check (`npx tsc --noEmit`):** PASS (Zero erros de compilação ou tipagem).
* **Production Build (`npm run build`):** PASS (Build Vite gerada com sucesso).
* **Suite de Testes (`npm test`):** PASS (19/19 testes unitários bem-sucedidos).
* **Runtime Local:** PASS (Nenhum ReferenceError, TypeError ou exceções de runtime detectadas).

## 6. Arquivos Alterados
* `vercel.json` (Criado)
* `src/pages/Index.tsx` (Helpers de hash e metadados de UA + alteração do botão de submissão condicional)
* `src/components/app/LgpdGuard.tsx` (Substituição de useCurrentUser por supabase.auth.getUser())
* `src/pages/admin/AdminAnalyticsPage.tsx` (Sincronização com o schema core de analytics)
* `src/pages/admin/AdminWaitlistPage.tsx` (Import do ShieldCheck + tratamento de múltiplos perfis com array check e cs clause)
* `33_waitlist_multi_profile.sql` (Migração de banco waitlist)

## 7. Necessidade de Deploy
* **Deploy Necessário:** **YES** (A build do frontend precisa ser publicada na Vercel para carregar o novo arquivo de regras de rotas `vercel.json` e a lógica de submissão do formulário).
