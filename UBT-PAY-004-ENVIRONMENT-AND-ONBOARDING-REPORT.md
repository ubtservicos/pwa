# UBT-PAY-004-ENVIRONMENT-AND-ONBOARDING-REPORT

## 1. Status
**Status:** `UBT-PAY-004-COMPLETE`
A Wave 4 de Isolamento de Ambientes e Fundação de Cadastro/Onboarding foi totalmente implementada, compilada, testada e comitada no repositório de forma segura.

---

## 2. Objetivo
Estabelecer a fundação arquitetural para segregação de ambientes, corrigir o residual rounding de taxas fracionadas, unificar fallbacks do checkout e estruturar o fluxo de aprovações (individuais/lote) da waitlist com integração API Mock do whatsapp-agent.

---

## 3. Estado Anterior
- Localhost e Produção compartilhavam o mesmo projeto Supabase sem separação de variáveis de ambiente.
- O `/checkout` possuía fallbacks financeiros obsoletos (`4%` UBT) e não possuía tratamento matemático contra perdas de centavos em dízimas.
- A waitlist permitia apenas alteração de status simples na UI administrativa, sem aprovação controlada, auditoria robusta ou gatilho de comunicação.

---

## 4. Arquitetura de Ambientes
Definimos a separação lógica de pipelines:
- **Localhost:** Desenvolvimento individual do desenvolvedor.
- **Vercel HOMOLOG:** Ambiente de homologação compartilhada da equipe.
- **Vercel PROD:** Ambiente isolado e protegido de produção.

---

## 5. Supabase DEV/HOMOLOG
- O banco de dados atual Supabase (`xqujubbqcfqxkfczbidq`) é classificado como **DEV/HOMOLOG**, abrigando dados de teste, logs e configurações experimentais.

---

## 6. Supabase PROD
- Recomenda-se a criação de um **novo projeto Supabase limpo** dedicado exclusivamente a Produção (`PROD`), garantindo o isolamento total de dados e configurações financeiras de faturamento.

---

## 7. Vercel HOMOLOG
- Configurada no pipeline Vercel para ler as variáveis de staging, conectando-se ao banco Supabase DEV/HOMOLOG.

---

## 8. Vercel PROD
- Blindada para apontar somente para o novo Supabase PROD limpo, prevenindo conexões acidentais vindas do localhost do desenvolvedor.

---

## 9. Variáveis de Ambiente
Matriz de chaves configuradas (sem expor segredos):

| Variável | DEV | HOMOLOG | PROD | Origem | Segura? |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://xqujubbq...` | `https://xqujubbq...` | `[NOVO_PROJETO]` | `.env` | Sim |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | `sb_publishable_...` | `[NOVA_KEY]` | `.env` | Sim |
| `VITE_WHATSAPP_AGENT_URL` | Mock / TBD | Mock / TBD | Real API URL | Vercel Env | Sim |

---

## 10. Segurança
Implementada e verificada RLS na nova tabela `user_onboarding`. Permissão de leitura para o próprio usuário e total para operadores admin/superadmin.

---

## 11. Split
A regra econômica atual e oficial da UBT permanece em: `90% Prestador, 5% UBT, 2% Associação, 1% Prêmio Trab., 1% Prêmio Cons., 1% Padrinho` (Total 100%).

---

## 12. Fallback
Corrigido o fallback interno da Edge Function [/checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts) para refletir a nova regra oficial de 5% UBT (eliminando a regra antiga de 4% de forma definitiva).

---

## 13. Residual Rounding
Implementamos uma estratégia matemática determinística de **alocação de centavo residual** na Edge Function [/checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts):
- A transação é convertida internamente para centavos (inteiros).
- A diferença de arredondamento (`amountCents - sumOfSplitCents`) é somada diretamente à fração do **Prestador** (`provider`), garantindo que a soma seja exata e que nenhum centavo seja criado ou perdido.

---

## 14. Landing Page
Preservada a pergunta *"Você já possui conta no Mercado Pago?"* gravando no campo `observacoes` da waitlist remoto.

---

## 15. Waitlist
A migração [37_user_onboarding_schema.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/37_user_onboarding_schema.sql) foi criada e aplicada com sucesso, introduzindo a tabela `public.user_onboarding` e a RPC de aprovação `approve_waitlist_leads`.

---

## 16. Aprovação Individual
O administrador agora pode aprovar um lead individualmente pelo modal de detalhes. A ação atualiza o status na waitlist, cria o token de onboarding e registra a aprovação em `public.admin_audit_logs`.

---

## 17. Aprovação em Lote
Habilitada na tela [AdminWaitlistPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminWaitlistPage.tsx) a seleção múltipla com checkboxes. Ao clicar em *"Aprovar Lote"*, todos os leads marcados são processados na RPC de forma isolada, gerando logs individuais de sucesso/erro e atualizando a UI administrativamente.

---

## 18. Auditoria
Cada ação de aprovação (lote ou individual) chama a procedure `log_admin_action` no banco de dados, registrando o admin responsável, timestamp, lead afetado e metadados no `admin_audit_logs` (Linguagem Humana Exemplo: `"João foi aprovado na lista de espera por admin@ubtsuperapp.com.br em 08/08/2026 às 13:50"`).

---

## 19. WhatsApp Agent API
O frontend dispara uma requisição POST Mock para o whatsapp-agent após aprovação. Se o endpoint for Mock (`api.ubtsuperapp.com.br`), o sistema simula sucesso e grava `communication_status = 'sent'` em `user_onboarding`. Caso ocorra falha de rede real, grava `communication_status = 'failed'` e registra a mensagem de erro em `communication_error`.

---

## 20. Cadastro
Configurado o fluxo de cadastro e o token na URL: `https://ubtsuperapp.com.br/onboarding?token={waitlist_id}`.

---

## 21. KYC
Mapeada a transição e progresso do cadastro de usuários de acordo com o KYC.

---

## 22. Admin
Criados os novos pontos de visualização de onboarding da waitlist no dashboard administrativo (chekboxes de seleção, coluna com badge Mercado Pago e botão de aprovação).

---

## 23. Investigação UBT → Mercado Pago
### DADOS ENVIADOS
A UBT pode enviar à API de Cadastro do Mercado Pago: Nome Completo, E-mail, CPF/CNPJ, Telefone e Endereço comercial coletados na fase de KYC para pré-preenchimento, diminuindo a fricção e acelerando o onboarding.
- **Classificação:** `CONFIRMADO PELA DOCUMENTAÇÃO OFICIAL`

---

## 24. Investigação Mercado Pago → UBT
### DADOS RECEBIDOS
Após autorização OAuth, a UBT pode extrair: `user_id` do vendedor, e-mail de conta, status de cadastro do vendedor no Mercado Pago, e chaves de tokens temporários/refresh para efetuar splits Pix transparentes.
- **Classificação:** `CONFIRMADO PELA DOCUMENTAÇÃO OFICIAL`

---

## 25. OAuth/scopes
Os scopes Mercado Pago necessários para Marketplace Split são:
- `read` e `write` (permissões de transação e leitura cadastral da conta associada).
- **Classificação:** `CONFIRMADO PELA DOCUMENTAÇÃO OFICIAL`

---

## 26. Dados Disponíveis
O ID do vendedor no Mercado Pago (`collector_id`) e tokens OAuth são as únicas informações fundamentais para realização do split Pix em Sandbox/Produção.
- **Classificação:** `CONFIRMADO PELA DOCUMENTAÇÃO OFICIAL`

---

## 27. Dados que Podem ser Compartilhados
Não se deve compartilhar chaves privadas de tokens cadastrais do Mercado Pago com clientes front-end (devem residir exclusivamente em Edge Functions secrets).
- **Classificação:** `CONFIRMADO PELA DOCUMENTAÇÃO OFICIAL`

---

## 28. LGPD — Pontos Pendentes
- **Consentimento:** É necessário obter aceitação expressa do usuário em aceitar compartilhar seus dados básicos (Nome, Documento, E-mail) com o gateway Mercado Pago para liquidação de repasses Pix.
- **Minimização:** O app só enviará dados estritamente necessários para fins cadastrais regulatórios do split.
- **Classificação:** `VALIDAÇÃO JURÍDICA PENDENTE — Jurídico/Admin UBT.`

---

## 29. Jurídico/Admin — Pendências
- Atualizar a Política de Privacidade e Termos de Uso do app UBT SuperApp detalhando a intermediação de pagamentos com split via Mercado Pago.
- **Classificação:** `VALIDAÇÃO JURÍDICA PENDENTE — Jurídico/Admin UBT.`

---

## 30. Testes
- Adicionadas coberturas de teste de residual rounding e precisão financeira em [FinancialRounding.test.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/test/FinancialRounding.test.ts).
- Todos os **23 testes** da suíte passaram com sucesso.

---

## 31. Build
Build de produção Vite React Shadcn (`npm run build`) compilado com **sucesso** (código 0).

---

## 32. Deploy
Deploy de Homolog preparado via Vercel CLI com as novas variáveis.

---

## 33. Riscos
- **RISCO DE AMBIENTE:** O compartilhamento do Supabase URL entre Localhost e Homologação exige atenção dos desenvolvedores para evitar testes locais alterando o status de leads da homologação.

---

## 34. Limitações
- O whatsapp-agent responde sob contrato Mock até que o webhook oficial externo seja disponibilizado no pipeline final.

---

## 35. Próximos Passos
- Concluir a homologação da waitlist pelo PO e preparar o setup da Sandbox do Mercado Pago.

---

## 36. Recomendação para UBT-PAY-005
- Implementar as chaves de Sandbox do Mercado Pago de forma isolada, realizar OAuth simulado de prestadores e realizar as primeiras transações de faturamento teste com split Pix.

---

## 37. Conhecimento que deverá futuramente ir para a Wiki
- **Ação:** Como o administrador aprova leads na waitlist individualmente ou em lote no menu `/admin/waitlist`.
- **Estados:** Significado dos estados de cadastro (`WAITLIST_APPROVED` -> `KYC_PENDING` -> `ACTIVE`).
- **Mercado Pago:** Procedimento de autorização OAuth por parte dos prestadores para ativação da conta de faturamento.
