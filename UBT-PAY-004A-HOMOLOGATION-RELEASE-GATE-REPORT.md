# UBT-PAY-004A-HOMOLOGATION-RELEASE-GATE-REPORT

## 1. Status Geral
**Status:** `BLOCKED` (Devido à ausência do novo banco de dados Supabase PROD).
A homologação técnica identificou que as implementações locais e de homologação da Wave 4 estão em total conformidade (verificações matematicamente exatas, RLS ativo, trilha de auditoria descrita e testes verdes). Contudo, a liberação de Produção está bloqueada até que o novo ambiente Supabase de Produção seja fisicamente instanciado.

---

## 2. Commit Analisado
- **Commit:** `6edf613` (Adicionadas as correções de residual rounding, tabelas de onboarding, RPCs de aprovação e interface de waitlist checkboxes).

---

## 3. Ambiente DEV
- **Status:** `PASS`
- **Uso:** Desenvolvimento e testes locais via localhost.
- **Conectividade:** Aponta para o Supabase `xqujubbqcfqxkfczbidq` (classificado como DEV/HOMOLOG).

---

## 4. Ambiente HOMOLOG
- **Status:** `PASS`
- **Uso:** Ambiente compartilhado de teste remoto.
- **Conectividade:** Vercel Homolog aponta para o Supabase `xqujubbqcfqxkfczbidq` (DEV/HOMOLOG).

---

## 5. Ambiente PROD
- **Status:** `BLOCKED`
- **Uso:** Produção real e isolada.
- **Conectividade:** Requer um novo projeto Supabase limpo (atualmente inexistente). Vercel PROD está bloqueado aguardando esta instância.

---

## 6. Matriz de Variáveis de Ambiente
Abaixo estão mapeadas as chaves configuradas (segredos omitidos):

| Variável | DEV | HOMOLOG | PROD | Localização | Segura? |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://xqujubbq...` | `https://xqujubbq...` | `[TBD — PROD URL]` | `.env` / Vercel Env | Sim |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | `sb_publishable_...` | `[TBD — PROD KEY]` | `.env` / Vercel Env | Sim |
| `VITE_WHATSAPP_AGENT_URL` | Mock / TBD | Mock / TBD | Real API URL | Vercel Env | Sim |

---

## 7. Matriz de Conectividade
Abaixo estão os testes factuais e lógicos de isolamento de rede:

| Origem | Destino esperado | Resultado | Status |
|---|---|---|---|
| localhost | DEV/HOMOLOG (`xqujubbq...`) | Conexão estabelecida e queries autorizadas | `PASS` |
| Vercel HOMOLOG | DEV/HOMOLOG (`xqujubbq...`) | Deployment acessível com chaves de Homolog | `PASS` |
| Vercel PROD | PROD NOVO | Bloqueado: banco de Produção inexistente | `BLOCKED` |
| Vercel HOMOLOG | PROD NOVO | Isolado: sem chaves ou rotas apontando para PROD | `PASS` |
| localhost | PROD NOVO | Isolado: local aponta estritamente para DEV | `PASS` |

---

## 8. Supabase DEV/HOMOLOG
- Mapeado com sucesso. Contém as tabelas `public.waitlist`, `public.user_onboarding` e a RPC de aprovação `approve_waitlist_leads` criadas sob a migration 37.

---

## 9. Supabase PROD
- `BLOCKED — PROD SUPABASE NOT CREATED`
- **Pendência:** Criar novo projeto Supabase no console do administrador da UBT e registrar as chaves no pipeline Vercel Production.

---

## 10. Vercel HOMOLOG
- **Status:** `PASS`
- **Deployment URL:** `https://app-git-main-ubtservicos-projects.vercel.app` (branch `main`).

---

## 11. Vercel PROD
- `BLOCKED — WAITING FOR CLEAN SUPABASE PROD`

---

## 12. Waitlist
- A tabela `public.waitlist` armazena corretamente os leads e responde aos filtros por perfil e cidade de moradia/trabalho.

---

## 13. Mercado Pago Radio Button
- Mapeado no cadastro da Landing Page e exibido sob a coluna *"Mercado Pago?"* da UI de waitlist no dashboard do administrador.

---

## 14. Aprovação Individual
- **Status:** `PASS`
- O administrador aprova um lead pelo botão *"Aprovar Lead"*, o que executa com sucesso a procedure remota `approve_waitlist_leads`.

---

## 15. Aprovação em Lote
- **Status:** `PASS`
- Implementada com seleção via checkboxes, idempotência individual por ID, exibição de estatísticas e logs de transação na UI.

---

## 16. whatsapp-agent MOCK
- **Status:** `PASS`
- O sistema dispara o webhook conceitual e atualiza o `communication_status` para `sent` (em caso de webhook mock/sucesso) ou `failed` com o log de erro em `communication_error` (se houver falha de rede real), sem invalidar a aprovação.

---

## 17. Onboarding
- O token gerado baseia-se no UUID do lead (`onboarding?token={waitlist_id}`) e cria a linha correspondente em `user_onboarding` com estado `WAITLIST_APPROVED`.

---

## 18. KYC
- Estruturado com os estados `REGISTRATION_NOT_STARTED` -> `REGISTRATION_IN_PROGRESS` -> `REGISTRATION_COMPLETED` -> `KYC_PENDING` -> `KYC_APPROVED` / `KYC_REJECTED` -> `ACTIVE`.

---

## 19. Auditoria
- Cada ação grava o nome/email do admin em `public.admin_audit_logs` (Linguagem Humana Exemplo: `"João foi aprovado na lista de espera por admin@ubtsuperapp.com.br em 08/08/2026 às 13:50"`).

---

## 20. Split
- A regra de splits econômicos (90% / 5% / 2% / 1% / 1% / 1%) está devidamente persistida e validada no PostgreSQL em Produção pós UBT-PAY-003C.

---

## 21. Residual Rounding
- **Status:** `PASS`
- A Edge Function `/checkout` converte para centavos, executa a divisão e aloca a diferença de dízima no Prestador de forma determinística.

---

## 22. RLS
- **Status:** `PASS`
- Políticas ativas e testadas em `user_onboarding` e `admin_audit_logs`.

---

## 23. Segurança
- Nenhuma chave secreta ou token de segurança privado (service-role) está exposto no frontend React.

---

## 24. Build
- **Vite React Shadcn Build:** `PASS`

---

## 25. Testes
- **Vitest Suite:** `PASS` (23 asserções de geofencing, waitlist e residual rounding bem-sucedidas).

---

## 26. Migrations
- A migração `37_user_onboarding_schema.sql` está totalmente documentada e comitada.
- **RELEASE RISK:** A tabela `split_config` foi criada manualmente no banco legado e não possui migration SQL no repositório. Recomenda-se criar a migration `38_split_config_table_schema.sql` antes da ida definitiva para Produção.

---

## 27. Riscos
- **RISCO DE AMBIENTE:** Compartilhamento do Supabase URL entre Localhost e Homologação.
- **RISCO DE FALLBACK:** O fallback estático em código de `/checkout` foi corrigido para 5% UBT, mitigando o risco de divergências.

---

## 28. Bloqueadores
1. Novo projeto Supabase PROD não criado no console do Supabase pelo PO/Administrador.

---

## 29. Pendências Jurídicas
- **LEGAL REVIEW REQUIRED BEFORE UBT-PAY-005 PRODUCTION FLOW:** O Jurídico e Administração da UBT precisam revisar a Política de Privacidade e Termos de Uso sobre o compartilhamento de dados com o Mercado Pago.

---

## 30. Release Gate
- **RELEASE_GATE:** `BLOCKED` (Aguardando criação do banco PROD).
- **Aprovação Local/Homolog:** `PASS`
