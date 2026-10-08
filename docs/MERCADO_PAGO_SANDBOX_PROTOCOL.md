# Protocolo definitivo de Sandbox — Mercado Pago Marketplace 1:1

Este protocolo usa três identidades distintas:

1. **Marketplace/Integrador UBT**: conta que possui a aplicação e retém a comissão.
2. **Seller Test User**: conta de teste do prestador, autorizada por OAuth.
3. **Buyer Test User**: conta de teste exclusiva do pagador.

Nunca use a mesma conta como Seller e Buyer. O split físico suportado por esta integração é 1:1: o Seller recebe o líquido e a UBT retém `application_fee`. As outras cinco destinações do split UBT são lançamentos contábeis internos; split físico 1:N depende de contratação/carteira assessorada do Mercado Pago.

## 1. Criar e configurar a aplicação Marketplace

1. Entre em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app).
2. Crie uma aplicação de **Pagamentos online**, produto **Checkout API**, modelo **Marketplace**.
3. Cadastre exatamente as URLs usadas pelo PWA, por exemplo:
   - `http://localhost:8080/app/config/financeiro`
   - `https://ubt-homologacao.vercel.app/app/config/financeiro`
4. Em **Testes > Credenciais de teste**, copie a Public Key e o Access Token da mesma aplicação.
5. Não classifique credenciais pelo prefixo. A documentação atual informa que Access Tokens de teste também podem começar com `APP_USR`.

Fontes oficiais: [configuração de Split 1:1](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/create-configuration), [credenciais](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/credentials?scope=prod).

## 2. Criar Buyer e Seller Test Users no painel

Em **Suas integrações > aplicação UBT > Contas de teste**, clique em **Criar conta de teste**. O painel permite até 15 contas e não permite excluí-las.

Crie as contas no mesmo país, Brasil:

| Descrição sugerida | Tipo no painel | Uso |
|---|---|---|
| `UBT Sandbox Seller 01` | Vendedor | Autoriza OAuth e recebe 90% na rota principal |
| `UBT Sandbox Buyer 01` | Comprador | Pagador; seu e-mail vai em `payer.email` |
| `UBT Sandbox Integrator` | Integrador, se o painel solicitar | Identidade de teste do Marketplace |

Guarde separadamente User ID, usuário, senha, código de verificação e e-mail de cada conta. Se o painel pedir validação por e-mail no login, use o código de seis dígitos exibido na linha da conta de teste.

Fonte oficial: [Contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/resources/your-integrations/test/accounts?scope=prod).

### Alternativa por API

O endpoint atual é `POST /users/test`, não `/users/test_user`:

```bash
curl --request POST 'https://api.mercadopago.com/users/test' \
  --header 'Authorization: Bearer SEU_ACCESS_TOKEN_DA_APLICACAO' \
  --header 'Content-Type: application/json' \
  --data '{"site_id":"MLB","description":"UBT Sandbox Buyer API"}'
```

A referência desse endpoint não oferece um campo para escolher `Buyer`, `Seller` ou `Integrator`. Para garantir o perfil correto no teste de Marketplace, prefira o painel. Fonte oficial: [Criar test user](https://www.mercadopago.com.br/developers/en/reference/test_user/_users_test/post).

## 3. Configurar os ambientes sem cruzar credenciais

Frontend/Vercel:

```dotenv
VITE_MP_ENVIRONMENT=sandbox
VITE_MP_PUBLIC_KEY=PUBLIC_KEY_DE_TESTE_DA_APLICACAO_UBT
VITE_MP_TEST_PAYER_EMAIL=EMAIL_DO_BUYER_TEST_USER
VITE_MP_TEST_PAYER_CPF=12345678909
```

`VITE_MP_TEST_PAYER_EMAIL` é recomendado para manter o bundle observável, mas não é a fonte de
verdade. A Edge Function sempre substitui o e-mail recebido por `MP_TEST_PAYER_EMAIL` antes de
chamar o Mercado Pago; assim o segredo de homologação continua correto mesmo durante um rollout
em que o frontend antigo e o backend novo coexistam.

Supabase Edge Functions:

```dotenv
MP_ENVIRONMENT=sandbox
MP_ACCESS_TOKEN_SANDBOX=ACCESS_TOKEN_DE_TESTE_DA_APLICACAO_UBT
MP_TEST_PAYER_EMAIL=EMAIL_DO_BUYER_TEST_USER
MP_TEST_SELLER_EMAILS=EMAIL_DA_CONTA_MARKETPLACE,EMAIL_DO_SELLER_TEST_USER
MP_TEST_SELLER_USER_IDS=USER_ID_DO_SELLER_TEST_USER
MERCADOPAGO_CLIENT_ID=APP_ID_DA_APLICACAO_UBT
MERCADOPAGO_CLIENT_SECRET=CLIENT_SECRET_DA_APLICACAO_UBT
MP_REDIRECT_URIS=http://localhost:8080/app/config/financeiro,https://SEU-DOMINIO/app/config/financeiro
MP_TOKEN_ENCRYPTION_KEY=CHAVE_BASE64_DE_32_BYTES
ALLOWED_ORIGINS=http://localhost:8080,https://SEU-DOMINIO
```

Gere a chave de envelope uma vez e guarde-a como segredo:

```bash
openssl rand -base64 32
```

Aplicação, Public Key, Access Token, Client ID e Client Secret devem pertencer ao mesmo cadastro Marketplace. `MP_ENVIRONMENT` e `VITE_MP_ENVIRONMENT` devem ter o mesmo valor.

## 4. Vincular o Seller Test User por OAuth — teste real da rota principal

1. Aplique a migração `20261005170000_mercadopago_routing_fallback.sql`.
2. Publique a Edge Function `payment-gateway` com os segredos acima.
3. Entre no UBT com o usuário interno do prestador cujo UUID é enviado como `provider_id`.
4. Abra uma janela anônima para evitar sessão Mercado Pago da conta Marketplace/Buyer.
5. No UBT, abra `/app/config/financeiro` e clique em **Conectar Mercado Pago**.
6. Na tela do Mercado Pago, faça login com o **Seller Test User**, nunca com o Buyer ou com a conta Marketplace.
7. Autorize. O callback troca o `code` com `test_token: true`, valida o `state` e grava `marketplace_accounts` com `ambiente='sandbox'` e `token_metadata.live_mode=false`.
8. Verifique sem consultar os segredos:

```sql
select
  user_id,
  mercado_pago_user_id,
  status,
  ambiente,
  token_expiration,
  token_metadata ->> 'live_mode' as live_mode
from public.marketplace_accounts
where user_id = 'UUID_INTERNO_DO_PRESTADOR';
```

Resultado esperado: `CONNECTED`, `sandbox`, `live_mode=false`.

Fontes oficiais: [OAuth Authorization Code](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation), [integração do Marketplace](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace).

## 5. Simulação controlada da linha `marketplace_accounts`

Use somente em Sandbox, com um **Access Token OAuth do Seller** já obtido pelo fluxo acima. Não coloque o Access Token da plataforma nessa linha.

```sql
insert into public.marketplace_accounts (
  user_id,
  mercado_pago_user_id,
  status,
  ambiente,
  oauth_status,
  access_token_encrypted,
  token_metadata,
  connected_at,
  updated_at
) values (
  'UUID_INTERNO_DO_PRESTADOR',
  'USER_ID_MP_DO_SELLER_TEST',
  'CONNECTED',
  'sandbox',
  'authorized',
  'plain:ACCESS_TOKEN_OAUTH_DO_SELLER_TEST',
  '{"live_mode":false,"source":"manual_sandbox_test"}'::jsonb,
  now(),
  now()
)
on conflict (user_id, ambiente) do update set
  mercado_pago_user_id = excluded.mercado_pago_user_id,
  status = excluded.status,
  oauth_status = excluded.oauth_status,
  access_token_encrypted = excluded.access_token_encrypted,
  token_metadata = excluded.token_metadata,
  connected_at = now(),
  updated_at = now();
```

O prefixo `plain:` é aceito pelo código somente quando `MP_ENVIRONMENT=sandbox`. Produção exige o envelope AES-GCM gerado automaticamente no callback OAuth.

## 6. Executar os dois cenários obrigatórios

Use os cartões atuais documentados para Brasil:

- Mastercard: `5480 8328 0103 3311`, CVV `123`, validade `11/30`.
- Visa: `4235 6477 2802 5682`, CVV `123`, validade `11/30`.
- Titular para aprovação: `APRO`.
- CPF de teste: `12345678909`.

Fonte oficial: [compra de teste com cartões](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/cards).

### Cenário A — Seller conectado

Mantenha a linha `CONNECTED` do Seller e pague com o Buyer Test User.

Esperado:

- `payment_route = 'seller_oauth_split'`;
- header `Authorization` usa o Access Token OAuth do Seller;
- payload do Mercado Pago contém `application_fee` de 10%;
- `provider_payout_status = 'not_required'`.

### Cenário B — fallback contábil

Marque a conta do Seller como revogada:

```sql
update public.marketplace_accounts
set status = 'REVOKED', disconnected_at = now(), updated_at = now()
where user_id = 'UUID_INTERNO_DO_PRESTADOR' and ambiente = 'sandbox';
```

Faça um novo pagamento.

Esperado:

- `payment_route = 'platform_fallback'`;
- header `Authorization` usa `MP_ACCESS_TOKEN_SANDBOX`;
- o payload do Mercado Pago **não contém** `application_fee`;
- a plataforma recebe 100% fisicamente;
- `provider_payout_status = 'pending'` e `provider_payout_amount` registra os 90% devidos.

Audite os dois resultados:

```sql
select
  transaction_id,
  gateway_payment_id,
  status,
  payment_route,
  total_amount,
  provider_amount,
  application_fee_amount,
  platform_collected_amount,
  provider_payout_status,
  routing_reason,
  environment,
  created_at
from public.pagamentos_split
order by created_at desc
limit 20;
```

## 7. Critérios de aprovação antes de produção

- Nenhum PAN, validade ou CVV aparece em logs, requests da UBT ou banco; só o CardToken.
- Cada clique gera uma `payment_attempt_id` UUID, reutilizada como `X-Idempotency-Key` e `external_reference`.
- A linha contábil é reservada antes da chamada externa.
- Corrida só muda para `paid` quando o Mercado Pago retorna `approved`.
- Timeout retorna `payment_outcome_unknown`; não crie outra cobrança antes de reconciliar a tentativa existente.
- Seller conectado com token ausente/corrompido falha fechado; não muda silenciosamente o destino do dinheiro.
- Buyer, Seller e Marketplace são contas distintas e do mesmo país.
- O webhook deve reconciliar `external_reference = transaction_id` e liberar o repasse fallback somente após `approved`.
