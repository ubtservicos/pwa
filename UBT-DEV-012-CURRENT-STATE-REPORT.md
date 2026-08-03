# UBT-DEV-012-CURRENT-STATE-REPORT

## 1. GIT STATUS
- **Status:** **PASS**
- **Detalhes:** O branch local `main` está perfeitamente limpo, sem arquivos modificados pendentes de commit. O branch está configurado para rastrear `origin/main` e a árvore está sincronizada com o commit local mais recente (`af617b0`).

## 2. BUILD STATUS
- **Status:** **PASS**
- **Detalhes:** O build de produção Vite (`npm run build`) e a checagem de tipos do TypeScript (`npx tsc --noEmit`) foram executados com 100% de sucesso e sem erros remanescentes no código.

## 3. WAITLIST STATUS
- **Status:** **PASS**
- **Detalhes:** O formulário da waitlist foi corrigido localmente para gerar o hash de fingerprint (`ip_hash` via SHA-256) no frontend e metadados de UA, evitando o erro de violação de constraint `23502` (HTTP 400).

## 4. WAITLIST UX STATUS
- **Status:** **PARTIAL**
- **Detalhes:** O formulário funciona visualmente e exibe a tela de sucesso ao concluir a submissão. No entanto, em caso de erro, a mensagem de erro (`submitError`) não exibe o feedback visual adequado (fundo vermelho/borda/texto colorido) porque as classes Tailwind utilizadas (`bg-red/10`, `border-red/20`, `text-red`) não estão mapeadas no tema do Tailwind (a cor do tema é `brand-red` ou exige sufixo de tonalidade como `red-500`). Isso faz com que as mensagens de erro fiquem visualmente mascaradas ou invisíveis na Landing Page.

## 5. WAITLIST DATABASE STATUS
- **Status:** **PASS**
- **Detalhes:** A persistência na tabela `public.waitlist` foi testada e confirmada via query SQL. Registros válidos contendo múltiplos perfis como array `text[]` e hashes de IP estão gravando e persistindo perfeitamente no Supabase de produção.

## 6. ADMIN WAITLIST STATUS
- **Status:** **PASS**
- **Detalhes:** A interface `AdminWaitlistPage.tsx` está totalmente corrigida e operacional localmente. Os leads são exibidos com suporte a múltiplos perfis, filtros de pesquisa e modal de visualização de metadados sem falhas de importação de ícones.

## 7. PILOT APPROVAL WORKFLOW STATUS
- **Status:** **FAIL**
- **Detalhes:** Não existe nenhum fluxo de aprovação técnica ou automação implementado. As únicas ações no painel de administração são a atualização do status textual do lead ("novo", "contatado", "arquivado") e exportação CSV. Não há workflows para converter leads em usuários piloto.

## 8. ANALYTICS STATUS
- **Status:** **PASS**
- **Detalhes:** O painel `AdminAnalyticsPage.tsx` está operacional e adaptado ao schema real da tabela `analytics_events` (`created_at_utc`, `event_name`, `properties`, `vertical`).

## 9. ANONYMOUS USER ANALYTICS STATUS
- **Status:** **PASS**
- **Detalhes:** O comportamento do `AnalyticsService.ts` de enviar `user_id = null` e `anonymous_id = deviceId` (Device ID persistente no localStorage) para visitantes anônimos está correto, atende ao schema do banco e está em conformidade com as diretrizes da LGPD (evitando coleta direta de IPs puros).

## 10. AUTHENTICATED USER ANALYTICS STATUS
- **Status:** **PASS**
- **Detalhes:** O `AnalyticsService.ts` escuta as mudanças de estado de autenticação via `onAuthStateChange` e passa a enviar corretamente o UUID do usuário no campo `user_id` em eventos pós-login.

## 11. SENTRY STATUS
- **Status:** **FAIL**
- **Detalhes:** O erro `403 Forbidden` no POST de ingestão do Sentry persiste em produção. O DSN de produção nas variáveis de ambiente da Vercel está sendo rejeitado pelo Sentry por expiração de cotas ou por falta de whitelisting do domínio `ubtservicos.vercel.app` nas configurações de segurança do painel Sentry.

## 12. SERVICE WORKER STATUS
- **Status:** **FAIL**
- **Detalhes:** O erro `The FetchEvent for /app/consentimento resulted in a network error response` ocorre porque o `sw.js` intercepta a rota dinâmica do React Router e tenta buscá-la como um arquivo físico no servidor via `fetch(e.request)`. Como o servidor em produção não possuía regras de rewrite para SPA (index.html fallback), a requisição falha com status 404, disparando o crash do service worker.

## 13. ANTIGRAVITY PROCESS STATUS
- **Status:** **PASS**
- **Detalhes:** Não existem tarefas em background ou processos do Antigravity travados. Todos os builds anteriores e processos de git push pendentes de rede foram encerrados com sucesso.

---

## 14. Riscos
* **Estilização de Erros do Formulário:** Mensagens de validação do formulário podem passar despercebidas pelo visitante devido à formatação CSS nula das cores de alerta.
* **Service Worker Caching:** Se o service worker continuar repassando rotas dinâmicas cruas para a rede sem servir o shell `index.html`, o acesso direto às rotas dinâmicas continuará falhando mesmo com a configuração da Vercel.

## 15. Recomendações
1. **Ajuste de Cores do Formulário:** Alterar as classes CSS de erro em `src/pages/Index.tsx` de `bg-red/10 border border-red/20 text-red` para classes válidas do Tailwind como `bg-destructive/10 border border-destructive/20 text-destructive` (ou `text-red-500 bg-red-500/10 border-red-500/20`).
2. **Deploy do SPA Fallback:** Publicar o arquivo `vercel.json` na Vercel para sanar os erros 404 de rotas diretas e resolver a falha de rede do Service Worker.
3. **Whitelist no Sentry:** Configurar o domínio de produção na conta do Sentry para eliminar os erros 403.
