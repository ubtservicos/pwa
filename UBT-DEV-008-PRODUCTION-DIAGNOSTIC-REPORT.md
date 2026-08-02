# UBT-DEV-008-PRODUCTION-DIAGNOSTIC-REPORT

## 1. Identificação
- **Data/Hora:** 2026-08-02T16:05:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Branch:** `main`
- **Commit Atual:** `cce5da5 fix(waitlist): resolve public waitlist submission and apply layout/multi-profile adjustments`
- **URL de Produção:** `https://ubtservicos.vercel.app/`

## 2. Diagnóstico das Rotas `/login` e `/admin`
* **Comportamento em Produção:** O acesso direto a `https://ubtservicos.vercel.app/login` ou `https://ubtservicos.vercel.app/admin` retorna a página `404: NOT_FOUND` da Vercel.
* **Análise Técnica:**
  * Router Utilizado: `BrowserRouter` do `react-router-dom` (React Router v6).
  * As rotas `/login` e `/admin` estão devidamente configuradas e declaradas no React em `src/App.tsx`.
  * A rota `/admin` possui proteção de permissão/autenticação via wrapper `adminGuard`.
  * Quando a aplicação é acessada pela raiz (`/`), o React carrega normalmente e permite a navegação interna para `/login` ou `/admin`.
* **Causa Raiz:** Como se trata de uma Single Page Application (SPA) cliente, as rotas `/login` ou `/admin` não correspondem a diretórios ou arquivos HTML reais na build gerada em `dist/`. Sem um arquivo de configuração `vercel.json` especificando regras de reescrita (rewrites), a Vercel tenta buscar arquivos físicos para esses caminhos e, ao não encontrá-los, retorna erro 404 em vez de redirecioná-los para o fallback `index.html`.

## 3. Diagnóstico do Sentry 403
* **Comportamento:** POST para `https://o4507005847371776.ingest.us.sentry.io/api/...` retorna `403 Forbidden`.
* **Análise Técnica:**
  * O Sentry é inicializado em `src/main.tsx` através de `dsn: import.meta.env.VITE_SENTRY_DSN`.
  * No workspace local, nem `.env` nem `.env.local` definem essa variável.
  * O DSN `o4507005847371776` está configurado nas variáveis de ambiente do projeto na Vercel (Produção).
* **Causa Raiz:** O código HTTP `403 Forbidden` no endpoint de ingestão do Sentry indica que a requisição de log de exceção foi rejeitada pelo servidor do Sentry. Isso ocorre devido a um DSN inválido/expirado, DSN pertencente a um projeto excluído/desativado, ou porque o domínio atual (`ubtservicos.vercel.app`) não está configurado na lista de "Allowed Domains" nas configurações de segurança do projeto no Sentry.
* **Impacto:** O erro 403 é estritamente uma falha na pipeline de observabilidade (não afeta o fluxo de execução JS do formulário nem impede o cadastro). Porém, ele é disparado sempre que a aplicação tenta registrar uma falha, o que indica a ocorrência de outro erro subjacente que não pôde ser reportado.

## 4. Diagnóstico do Formulário Waitlist
* **Comportamento:** O envio do formulário falha em produção e gera erro Sentry.
* **Análise Técnica:**
  * O POST é feito para `https://xqujubbqcfqxkfczbidq.supabase.co/rest/v1/waitlist`.
  * Retorno do Supabase: `code: 23502` / `message: null value in column "ip_hash" of relation "waitlist" violates not-null constraint`.
  * A tabela `public.waitlist` exige `ip_hash text NOT NULL` (definido em `32_waitlist.sql`).
* **Causa Raiz:** O formulário da Landing Page em produção não constrói o campo `ip_hash` no payload enviado no método `insert` do Supabase. Como a coluna possui a restrição `NOT NULL` e nenhum valor padrão ou trigger server-side foi criado no banco para preenchê-la, o Supabase rejeita a gravação.

## 5. Evidências Técnicas
* **Ausência de `vercel.json`:** Testado na raiz do workspace e retornado `False` para a presença do arquivo, confirmando a ausência de regras de reescrita SPA.
* **Log do Supabase 400 (Violência de Constraint):**
```json
{
  "code": "23502",
  "details": "Failing row contains (9c647ab..., 2026-08-02 12:00:00, ..., null, null, null, null, null, null, null, null, null, null, null, false, novo, null).",
  "hint": null,
  "message": "null value in column \"ip_hash\" of relation \"waitlist\" violates not-null constraint"
}
```

## 6. Classificação dos Problemas

- **ROUTES:** FAIL
- **SENTRY:** FAIL
- **WAITLIST:** FAIL

## 7. Correções Recomendadas

### A) Rotas (SPA Fallback)
Criar o arquivo `vercel.json` na raiz do workspace com a seguinte diretiva de rewrite para garantir o funcionamento do React Router sob qualquer URL acessada diretamente:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### B) Sentry 403
Revisar e corrigir a chave DSN configurada no dashboard da Vercel para o ambiente de produção. Adicionalmente, certificar-se de que o domínio `ubtservicos.vercel.app` (e outros domínios de produção utilizados) esteja cadastrado na seção **Allowed Domains** nas configurações do projeto Sentry.

### C) Formulário Waitlist
Aplicar o deploy do commit local `cce5da5` na Vercel. O commit já introduz a geração de fingerprint anônimo (`ip_hash` SHA-256) gerado de forma segura no frontend e metadados de UA no payload do INSERT, resolvendo integralmente o erro de constraint `23502` do Supabase.
