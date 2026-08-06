# UBT-PAY-001-DIAGNOSTIC-REPORT

## 1. Executive Summary
Este relatório apresenta o diagnóstico técnico factual da arquitetura de pagamentos e da integração com o Mercado Pago na plataforma UBT. A auditoria mapeou as lógicas de frontend (React/Vite), backend (Deno Edge Functions no Supabase), migrations aplicadas no banco de dados remoto e a adequação aos requisitos de Sandbox e Split de Pagamentos do Mercado Pago. 

Foi detectado um desalinhamento crítico entre a simulação local (localStorage/fallback direto do client) e a execução produtiva do backend. Além disso, foram mapeados os caminhos necessários para a transição segura para o Mercado Pago Sandbox sem risco de vazamento de credenciais ou corrupção de dados operacionais.

---

## 2. Estado Atual do Sistema de Pagamentos
Atualmente, o sistema de pagamentos da plataforma opera em regime de **Homologação/Simulado (Mock)**. Não existem cobranças reais efetuadas por meio do Mercado Pago.
- O status de pagamento de um serviço (diarista, mototáxi ou ambulante) é ativado como "confirmado" automaticamente na interface do usuário assim que ele clica em "Confirmar Pagamento", sem depender do sucesso real de transações ou da recepção de webhooks.
- Os repasses e splits gerados nas telas são calculados e simulados de forma client-side ou por Deno stubs fixos de 90% prestador e 4% UBT.

---

## 3. Arquitetura Atual
A arquitetura financeira da plataforma foi desenhada para centralizar as chamadas no servidor e receber confirmações via webhooks, mas o fluxo atual carece de integração ativa com as APIs do Mercado Pago.

```text
  [ CLIENTE / PWA ] 
         │
         │ (1) Envia parâmetros de cobrança
         ▼
  [ Edge Function: /checkout ] ──(2) Insere na tabela 'payments' e 'payment_splits' (MOCK STUB)
         │
         │ (3) Devolve QR Pix mockado
         ▼
  [ CLIENTE / PWA ] ──(4) Se falhar, executa Fallback direto na tabela 'pagamentos_split'
```

---

## 4. Frontend
- **Framework:** React com Vite e TypeScript.
- **Serviços:** `src/services/LoggingService.ts` e Supabase client.
- **Componentes Relacionados a Checkout:**
  - `src/pages/DiaristaAgendamentoPage.tsx` (Invoca `/checkout` no backend; se falhar, insere fallback na tabela `pagamentos_split`).
  - `src/pages/AmbulantePedidoPage.tsx` (Chama `/checkout` e marca o pedido como `"confirmed"` sem checar retorno).
  - `src/pages/MototaxiTomador.tsx` (Chama `/checkout` e altera o estado para avaliação `"rating"` imediatamente).
  - `src/pages/admin/AdminSplitPage.tsx` (Painel visual de taxa global que persiste valores exclusivamente no `localStorage`).

---

## 5. Backend
- **Hospedagem:** Supabase Deno Edge Functions.
- **Gerenciamento de Requisições:** Hardening de requisições implementado no diretório `_shared` com cabeçalhos CORS e logs de tempo de execução no console.

---

## 6. Supabase
- **Conectividade:** Integrado nativamente ao PostgreSQL do Supabase, utilizando RLS (Row Level Security) e triggers PL/pgSQL para auditoria de transações.

---

## 7. Edge Functions
- **`/checkout`:** Stub que cria ID de transação aleatório (`mp_pay_...`), gera Pix mockado e insere registros estáticos de split (90% prestador, 4% UBT) na tabela `payment_splits`.
- **`/webhooks-mercado-pago`:** Stub que recebe requisições, assume `paymentStatus = "approved"` sem validar assinatura criptográfica e atualiza as tabelas de agendamentos/pedidos.
- **`/refund`:** Stub que altera o status do pagamento para `"refunded"` localmente.
- **`/payment_webhook`:** Stub legado sem processamento.
- **`/split_processor` & `/refund_processor`:** Reservados para fila de processamento em lote.

---

## 8. Banco de Dados (Tabelas Ativas)
O banco de dados remete a dois modelos concomitantes em tabelas:
- **`public.payments`:** ID, tipo de serviço, IDs do cliente/prestador, amount, gateway, status do pagamento, e `idempotency_key`.
- **`public.payment_splits`:** Registros de repasse vinculados à `payments` (roles: `provider`, `ubt`, `godparent`, `comunidade`, `prize_worker`, `prize_consumer`).
- **`public.pagamentos_split`:** Tabela legada onde o frontend escreve diretamente os splits simulados em caso de falha da Edge Function.
- **`public.split_config`:** Parâmetros de percentuais cadastrados (90% prestador, 4% UBT, 2% comunidade, 1.5% prêmio trabalhador, 1.5% prêmio consumidor, 1% padrinho).

---

## 9. Migrations
- **`05_mercado_pago_split.sql`:** Criação da tabela legada `pagamentos_split` e regras de RLS (Leitura restrita a participantes do serviço).
- **`10_production_financial_core.sql`:** Estrutura unificada com as tabelas `payments`, `payment_splits`, `payouts`, `disputes`, triggers de auditoria imutáveis `log_financial_audit()` e índices de performance.
- **`11_disputes_and_refunds.sql`:** Criação da tabela `refunds` e controle de contestações.
- **`20_payment_security_metadata.sql`:** Metadados antifraude do dispositivo coletados no checkout.

---

## 10. Fluxo Atual de Pedido
1. O Tomador escolhe o prestador e preenche dados cadastrais.
2. Ao confirmar, o frontend chama a Edge Function `/checkout`.
3. Independente da aprovação real do gateway de pagamentos, o frontend força localmente a aprovação do pedido e avança a interface do usuário para a tela de avaliação final ("rating").
4. A liberação do serviço ocorre antes da liquidação financeira efetiva.

---

## 11. Fluxo Atual Financeiro
- O checkout simula as divisões proporcionais no banco. Os repasses acumulados não são transferidos em Sandbox ou Produção, permanecendo apenas como registros de contabilidade interna.

---

## 12. Prestadores
- Os prestadores possuem chave Pix cadastrada em `public.pix_keys` para payouts. Não há vinculação de suas contas Mercado Pago nem fluxo de autorização OAuth ativado.

---

## 13. Tomadores
- Possuem dados cadastrais em `public.usuarios` e `public.profiles`. O checkout coleta o método de pagamento simulado (Pix/Cartão).

---

## 14. Pix
- O Pix é gerado como string mockada baseada em UUIDs falsos, sem integração com a API `/v1/payments` do Mercado Pago para retornar QR Codes ou chaves dinâmicas reais.

---

## 15. Checkout Existente
- Interface legada baseada em mockups manuais no React. Não utiliza os SDKs oficiais de pagamento do Mercado Pago (MercadoPago.js ou Secure Fields).

---

## 16. Mercado Pago Existente
- Limita-se a stubs locais e nomes de tabelas de metadados. Nenhuma chamada externa é direcionada para os servidores da API do Mercado Pago.

---

## 17. Código Legado
- O diretório `supabase/functions/payment_webhook` e a tabela `pagamentos_split` (junto ao fallback client-side) constituem o legado inativo que deve ser descontinuado.

---

## 18. Mercado Pago Marketplace / Split
Para realizar split automático real de pagamentos pelo Mercado Pago, a plataforma deve operar no modelo de **Marketplace**:
- **OAuth:** O Prestador de serviços deve ser direcionado para o onboarding de autorização do Mercado Pago via URL oficial da aplicação. A plataforma UBT captura o `code` de retorno e obtém o `access_token` e o `user_id` da conta Mercado Pago do prestador.
- **Contas PF e PJ:** O Mercado Pago aceita ambos os tipos de cadastro de recebedores no split, desde que estejam validados na plataforma do gateway.
- **Contas de Repasse:** Prêmio Trabalhador, Prêmio Consumidor e Associações precisarão de contas Mercado Pago intermediárias ou o valor total correspondente ao split deve ser retido na conta principal da UBT e transferido de forma contábil/payout manual.

---

## 19. Checkout API / Orders
A integração futura do Checkout API do Mercado Pago utilizará:
- Criação de pagamento via `/v1/payments` passando o parâmetro `splits` ou `application_fee` na criação da transação.
- Envio do token do cartão obtido com segurança através do SDK `MercadoPago.js` no frontend para evitar que dados de cartão transitem pelo servidor da UBT.

---

## 20. Webhooks
- O Mercado Pago notificará a plataforma via `POST` no endpoint `/webhooks-mercado-pago`.
- A assinatura criptográfica deve ser validada utilizando o cabeçalho `x-signature` criptografado em HMAC-SHA256 com o token do webhook configurado no console de desenvolvimento.

---

## 21. Idempotência
- Deve-se enviar o cabeçalho `X-Idempotency-Key` em todas as requisições de criação de pagamento. A chave será gerada a partir do UUID gerado previamente para a linha inserida na tabela `payments` da UBT.

---

## 22. Sandbox
- **Testes de Cartão:** Serão executados utilizando os cartões de teste e CPFs fictícios oficiais da documentação do Mercado Pago Sandbox.
- **Contas de Teste:** Exige a criação de contas de "Comprador de Teste" e "Vendedor de Teste" através do painel de desenvolvedor do Mercado Pago.

---

## 23. Localhost (Estratégia de Desenvolvimento)
- Para rodar localmente e receber Webhooks do Mercado Pago Sandbox, os desenvolvedores precisarão expor as Edge Functions locais através de túnel seguro (ex: `ngrok` ou `localtunnel`).
- Configuração de variáveis de ambiente locais no arquivo `agent/.env` (anon key e service role).

---

## 24. Produção (Estratégia de Deploy)
- O chaveamento Sandbox/Production será feito via variáveis de ambiente configuradas no Supabase Vault (`MP_ACCESS_TOKEN` e `MP_PUBLIC_KEY`). O frontend lerá a chave pública dinamicamente via requisição de configuração do backend, mitigando o risco de exposição de secrets.

---

## 25. Variáveis e Secrets
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Gerenciadas e salvas em ambiente Supabase remoto).
- `MP_ACCESS_TOKEN` (Sandbox/Production Access Token do Mercado Pago) -> `[SEGREDO/CREDENCIAL ENCONTRADO — NÃO EXPOR]`.

---

## 26. Segurança
- O frontend não manipula credenciais do Mercado Pago. Dados de cartões são tokenizados via SDK client do Mercado Pago e trafegam como tokens temporários de transação de uso único. RLS default deny bloqueia escritas externas.

---

## 27. LGPD
- O compartilhamento de dados cadastrais dos prestadores ou clientes com o Mercado Pago exige consentimento expresso e deve ser limitado aos dados mínimos exigidos pelo gateway (CPF/CNPJ, nome, e-mail).

---

## 28. Observabilidade
- Logs de requisições de pagamento integrados ao Sentry e monitoramento de tempo de execução e logs em Deno via Deno console / Better Stack.

---

## 29. Modelo Financeiro UBT
- As taxas parametrizáveis e dinâmicas da tabela `public.split_config` serão consultadas pelo backend no momento da chamada da Edge Function `/checkout`, recalculando os repasses Pix em tempo real para os 6 destinos.

---

## 30. Taxas Comerciais do Mercado Pago
- Cartão de Crédito (na hora): 4,98%.
- Pix (na hora): 0,99%.
- Boleto (fixo): R$ 3,49.
- *Observação:* Estes parâmetros comerciais serão configurados em `public.system_settings` para cálculos de simulação.

---

## 31. Arquitetura Futura Proposta
```text
  [ CLIENTE / PWA ] (Tokeniza Cartão via SDK Mercado Pago)
         │
         │ (1) Solicita Pagamento (Card Token / Pix / Boleto)
         ▼
  [ Edge Function: /checkout ] ──(2) Valida idempotência, lê taxas de 'split_config'
         │
         │ (3) Cria transação via API Oficial Mercado Pago (Sandbox/Production)
         ▼
  [ API Mercado Pago ] (Retorna status pendente + QR Pix / Linha Digitável)
         │
         │ (4) Envia Webhook HTTP POST (Notificação de Pagamento Aprovado)
         ▼
  [ Edge Function: /webhooks-mercado-pago ] (Valida assinatura x-signature)
         │
         │ (5) Libera serviço (Completed) e liquida splits no banco de dados UBT
         ▼
  [ Banco de Dados Supabase ]
```

---

## 32. Modelo de Dados Futuro Proposto
- Manter o schema de `public.payments` e `public.payment_splits` intacto como única fonte de verdade de transação.
- Adicionar a tabela `public.payment_provider_accounts` para vincular o `user_id` do prestador ao seu token de acesso OAuth do Mercado Pago obtido no onboarding.

---

## 33. Estratégia Sandbox → Production
- A separação de ambientes será automática: chaves com prefixo `TEST-` direcionam as chamadas para a Sandbox do Mercado Pago; chaves com prefixo `APP_USR-` direcionam para a produção.

---

## 34. Testes Necessários
- Teste de fluxo completo Pix (pendente -> aprovado via webhook -> liberação de serviço).
- Teste de erro de cartão (rejeitado por saldo insuficiente).
- Teste de idempotência (envio repetido de requisições idênticas).

---

## 35. Riscos
- **Liberação Indevida:** O frontend continuar burlando o status de pagamento antes da liquidação real.
- **Spoofing de Webhook:** Recebimento de requisições falsas que simulam pagamentos aprovados caso a validação do cabeçalho `x-signature` não esteja ativa no backend.

---

## 36. Conflitos de Fontes

### CONFLITO DE FONTES 1
- **Fonte A:** Solicitação do Product Owner (Mapeamento dos percentuais: 5% UBT, 1% prêmio trabalhador, 1% prêmio consumidor).
- **Fonte B:** Banco de dados remoto `public.split_config` e fallback do frontend (4% UBT, 1.5% prêmio trabalhador, 1.5% prêmio consumidor).
- **Impacto:** Descompasso de cálculo de R$ de repasse em prêmios e lucros da plataforma.
- **Recomendação:** Confirmar com o PO se os parâmetros do banco devem ser alterados para o modelo de 5% UBT e 1% prêmios.

### CONFLITO DE FONTES 2
- **Fonte A:** Tabela legada `pagamentos_split` (Migration 5).
- **Fonte B:** Tabela de produção `payment_splits` (Migration 10).
- **Diferença:** O frontend escreve na primeira tabela; o backend do Supabase e migrations mais recentes utilizam a segunda.
- **Impacto:** Fragmentação de dados financeiros.
- **Recomendação:** Decommission da tabela legada `pagamentos_split`.

---

## 37. Decisões Necessárias
1. Desativação do fallback de inserção client-side direta do frontend para fins de segurança.
2. Definição do fluxo de onboarding oficial (O prestador será obrigado a vincular conta Mercado Pago via OAuth antes de receber corridas/agendamentos Pix).

---

## 38. Informações Ainda Desconhecidas
- `UNKNOWN`: Se os prestadores PF sem conta jurídica conseguirão receber splits de pagamentos transparentes diretamente na Sandbox do Mercado Pago sem validação de CNPJ do recebedor secundário.
- `UNKNOWN`: A viabilidade de uso de Caixinhas automáticas via API do Mercado Pago para acumulação de prêmios (a princípio, tratada como indisponível via documentação oficial).

---

## 39. Próximo Passo Recomendado
- **Aprovação do Diagnóstico:** Submeter o presente relatório ao PO.
- **Execução da Wave 2 (UBT-PAY-002):** Iniciar a codificação das Edge Functions de Checkout e Webhook integrando-as com as chaves reais de desenvolvimento/Sandbox do Mercado Pago, além de desativar os mocks de status automáticos no frontend.

---

## 40. Matriz Final de Auditoria

| Item | Estado atual | Evidência | Classificação | Próxima ação |
|---|---|---|---|---|
| Checkout | Simulado no frontend | `AmbulantePedidoPage.tsx` | `IMPLEMENTADO — NÃO VALIDADO` | Refatorar para aguardar webhook real |
| Pix | String mockada estática | `checkout/index.ts` | `IMPLEMENTADO — NÃO VALIDADO` | Integrar com endpoint /payments da API |
| Cartão | Não implementado | Sem SDK no frontend | `ROADMAP` | Integrar MercadoPago.js tokenization |
| Boleto | Não implementado | Sem interface | `ROADMAP` | Cadastrar rota de boleto |
| Mercado Pago | Apenas stubs Deno locais | `supabase/functions/` | `IMPLEMENTADO — NÃO VALIDADO` | Iniciar comunicação Sandbox |
| Split | Cálculo de split fixo hardcoded | `checkout/index.ts` | `IMPLEMENTADO — NÃO VALIDADO` | Refatorar para ler da tabela `split_config` |
| Marketplace | Simulação visual local | `/admin/split` | `ROADMAP` | Criar fluxo de split via API MP |
| Prestador MP | Inexistente | Tabela `pix_keys` apenas | `ROADMAP` | Criar tabela para access tokens OAuth |
| Onboarding | Inexistente | Sem link OAuth | `REQUIREMENT` | Adicionar botão de cadastro na UBT |
| OAuth/Authorization | Inexistente | Sem endpoint de callback | `REQUIREMENT` | Criar Edge Function para token exchange |
| Webhook | Stub estático que aprova tudo | `webhooks-mercado-pago/` | `IMPLEMENTADO — NÃO VALIDADO` | Implementar validação de X-Signature |
| Idempotência | Baseada em chaves parciais | `checkout/index.ts` | `IMPLEMENTADO — NÃO VALIDADO` | Adicionar UUIDs persistidos no cabeçalho |
| Reembolso | Altera apenas flag local | `refund/index.ts` | `IMPLEMENTADO — NÃO VALIDADO` | Chamar API de cancelamento do MP |
| Chargeback | Inexistente | Sem tabela | `ROADMAP` | Adicionar fluxo em `public.disputes` |
| Comissões | Configuração em LocalStorage | `/admin/split` | `CONFLICT` | Sincronizar com banco de dados |
| Taxas | Valores estáticos na interface | `AdminSplitPage.tsx` | `VALIDADO` | Configurar no `public.system_settings` |
| Sandbox | Sem credenciais ativas | Auditoria do Vault | `REQUIREMENT` | Inserir tokens de testes no Vault |
| Produção | Sem chaves de produção | Auditoria do Vault | `ROADMAP` | Planejar chaveamento automático |
| Localhost | Sem conexões externas de teste | Sem túneis ngrok | `REQUIREMENT` | Configurar arquivos `.env` e ngrok |
| Secrets | Criptografados no Vault | Supabase Secrets config | `VALIDADO` | Configurar tokens de forma segura |
| LGPD | consentimentos básicos | `public.user_consents` | `VALIDADO` | Exigir opt-in na autorização MP |
| Caixinhas | Sem suporte em API | Documentação Oficial | `UNKNOWN` | Tratar via contabilidade de banco de dados |
| Auditoria | Imutável via triggers SQL | `audit_payments_trigger` | `VALIDADO` | Estender para ações da API de split |
| Observabilidade | Monitoramento de logs Deno | Logs de console | `VALIDADO` | Integrar alertas de webhook no Sentry |
