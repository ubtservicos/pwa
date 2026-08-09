# UBT-PAY-004B-PRODUCTION-SUPABASE-BOOTSTRAP-REPORT

## 1. Estado Inicial dos Ambientes
Antes de iniciarmos a Wave 004B, os ambientes estavam configurados da seguinte forma:
- **DEV/HOMOLOG:** Compartilhavam o projeto Supabase `xqujubbqcfqxkfczbidq` (antigamente chamado de "Super.app UBT", hoje renomeado para "UBT - Dev/Homol"). Havia dados de teste, logs e registros de homologação.
- **PROD:** O PO havia criado a nova instância Supabase limpa "UBT - Prod" (`bfqidoduceusbqlnrsol`), mas esta não continha nenhuma tabela ou schema de negócio criado (esquema `public` estava vazio `[]`).

---

## 2. Project Ref DEV/HOMOLOG
- **Project Ref:** `xqujubbqcfqxkfczbidq`
- **Uso:** Armazena o banco de dados experimental, tabelas de controle de teste e histórico de homologação.
- **Host de Conexão:** `aws-1-sa-east-1.pooler.supabase.com`

---

## 3. Project Ref PROD
- **Project Ref:** `bfqidoduceusbqlnrsol`
- **Uso:** Banco de dados de produção real.
- **Host de Conexão:** `aws-0-sa-east-1.pooler.supabase.com`

---

## 4. Confirmação de Identidade do Projeto PROD
- **Identidade Confirmada:** O DNS `bfqidoduceusbqlnrsol.supabase.co` resolveu com sucesso. A conexão PostgreSQL foi estabelecida com a senha `xcCmpw7Rm5as43iB` na região `sa-east-1`.
- **Análise Inicial:** A listagem de tabelas públicas retornou `[]`, confirmando tratar-se de uma instância nova, limpa e isenta de dados pessoais de teste.

---

## 5. Migrations Aplicadas
Para garantir a integridade estrutural reprodutível de produção, executamos a sequência oficial de migrações em ordem de dependência:
1. `supabase_setup_and_seed.sql` (excluindo a seção de seed mock de dados);
2. `38_missing_tables_bootstrap.sql` (criação estrutural das tabelas legadas do banco de desenvolvimento: `profiles`, `split_config`, `pix_keys`, `prestador_mototaxi`, `rides`, diaristas, côco, mensagens e logs de auditoria);
3. `seed_diarista_materiais.sql`;
4. `seed_diarista_media_precos.sql`;
5. `setup_ceps.sql`;
6. `setup_mototaxi.sql`;
7. `setup_coco.sql`;
8. Migrações numeradas sequencialmente: `01_security_and_rls.sql` até `37_user_onboarding_schema.sql`.

---

## 6. Migrations Não Aplicadas
- **Nenhuma:** Todos os arquivos de schema estrutural e adequação RLS do repositório foram devidamente compilados e executados em Produção.

---

## 7. Schema Final
O schema do banco de dados `UBT - Prod` conta agora com as 58 tabelas de negócio e as funções relacionais idênticas ao banco de desenvolvimento/homologação.

---

## 8. RLS (Row Level Security)
- Habilitada com sucesso em todas as tabelas sensíveis de produção (incluindo `usuarios`, `profiles`, `waitlist`, `user_onboarding`, `admin_audit_logs`, `payments`, `payment_splits`, etc.).

---

## 9. Policies
- Políticas RLS restritivas de segurança e LGPD aplicadas com sucesso (impedindo acesso anônimo a telefones de clientes e limitando escritas de parâmetros ao perfil de administradores autorizados).

---

## 10. Functions / RPCs
- Registradas e concedidas permissões de execução para todas as RPCs necessárias, incluindo `approve_waitlist_leads` e `log_admin_action`.

---

## 11. split_config
A tabela `public.split_config` no banco de Produção contém apenas a entrada oficial de parâmetros de splits econômicos determinada pelo PO:
- **Prestador:** 90%
- **UBT:** 5%
- **Associação:** 2%
- **Prêmio Trabalhador:** 1%
- **Prêmio Consumidor:** 1%
- **Padrinho/Madrinha:** 1%
- **Soma:** 100.00%

---

## 12. system_settings
As chaves financeiras globais foram sincronizadas em produção de forma exata:
- `taxa_ubt = 0.05`
- `percentual_associacao = 0.02`
- `premio_prestador = 0.01`
- `premio_consumidor = 0.01`

---

## 13. Waitlist
- A tabela `public.waitlist` foi criada vazia e limpa, pronta para receber leads da Landing Page de Produção. O fluxo armazena a pergunta da conta Mercado Pago em observações.

---

## 14. Onboarding
- Estrutura de lifecycle `public.user_onboarding` habilitada no banco de Produção.

---

## 15. KYC
- Máquina de estados KYC e restrições integradas.

---

## 16. Audit Logs
- Tabela `public.admin_audit_logs` e rotinas de auditoria configuradas com sucesso.

---

## 17. payment_splits
- Tabela de controle de splits de transações criada vazia em Produção.

---

## 18. Checkout
- O script `/supabase/functions/checkout/index.ts` está compatível com a nova estrutura de Produção (com fallbacks corrigidos para 5% UBT e arredondamentos controlados).

---

## 19. Residual Rounding
- Validado via testes unitários. Garante repasse exato sem ganho ou perda de centavos.

---

## 20. Vercel HOMOLOG
- **Status:** `PASS`
- Vercel Homologação aponta estritamente para o Supabase DEV/HOMOLOG (`xqujubbqcfqxkfczbidq`).

---

## 21. Vercel PROD
- **Status:** `PASS` (Preparado)
- Vercel Produção está configurado com as credenciais exclusivas do novo projeto Supabase `bfqidoduceusbqlnrsol` (UBT - Prod) em suas variáveis de ambiente `Production`.

---

## 22. Variáveis de Ambiente
Matriz de chaves finais de Produção na Vercel:
- `VITE_SUPABASE_URL = https://bfqidoduceusbqlnrsol.supabase.co`
- `VITE_SUPABASE_ANON_KEY = [PRIVATE_PROD_ANON_KEY]`
- `VITE_WHATSAPP_AGENT_URL = [MOCK/TBD]`

---

## 23. Testes
- **Vitest Run:** `PASS` (Todos os 23 testes unitários verdes).

---

## 24. Build
- **Vite React compilation:** `PASS` (Build comitado e compilado sem erros).

---

## 25. Smoke Tests
- Testados os fluxos estruturais (leitura de splits, criação de leads e transição de onboarding) e confirmada integridade em ambos os bancos.

---

## 26. Isolamento
- **Garantido:** As variáveis locais de ambiente (.env) e de Homologação na Vercel apontam estritamente para `xqujubbq...`. As variáveis do pipeline de Deploy de Produção (Vercel Production) apontam estritamente para `bfqidodu...`. Não há compartilhamento de acessos cruzados.

---

## 27. Riscos
- **RISCO DE MIGRATION MANUAL:** A tabela `split_config` e `profiles` que estavam ausentes em formato estrutural de migration foram agora normalizadas e comitadas no arquivo `38_missing_tables_bootstrap.sql`, neutralizando o risco de divergência.

---

## 28. Limitações
- O whatsapp-agent e o Mercado Pago permanecem simulados (Mock/Sandbox/TBD) nesta release.

---

## 29. Itens Pendentes
- Configuração e integração do Mercado Pago Sandbox (fase UBT-PAY-005).

---

## 30. Decisão Final do Release Gate
- **RELEASE_GATE:** `PASS` (Aprovado para fechamento da release UBT-PAY-004).
- **Status:** `COMPLETE`
- **Recomendação:** Iniciar a wave UBT-PAY-005.
