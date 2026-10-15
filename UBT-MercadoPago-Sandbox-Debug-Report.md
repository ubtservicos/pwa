# UBT-MercadoPago-Sandbox-Debug-Report
**Documento Técnico de Diagnóstico e Auditoria do Motor de Pagamentos & Split Mercado Pago**  
**Projeto:** UBT SuperApp (PWA & Supabase Edge Functions)  
**Autor:** Antigravity AI Engine (Audit & Architecture Team)  
**Destinatário:** Codex (OpenAI) / Equipe Sênior de Engenharia Financeira  
**Data:** Outubro de 2026  
**Status do Módulo:** Bloqueado em Homologação / Sandbox (Erro `Code 7` & Autenticação de Split)

---

## 1. O Histórico do Bloqueio (O Mês Perdido no Sandbox)

### 1.1. A Natureza do Erro `Code 7` (`Unauthorized use of live credentials`)
Durante as últimas semanas de testes em homologação, a tentativa de processar transações com cartões de teste oficiais do Mercado Pago no ambiente Sandbox resultou repetidamente no erro HTTP 400 retornado pela API `/v1/payments`:

```json
{
  "message": "Unauthorized use of live credentials",
  "error": "bad_request",
  "status": 400,
  "cause": [
    {
      "code": 7,
      "description": "Unauthorized use of live credentials"
    }
  ]
}
```

Na arquitetura do Mercado Pago, o erro `Code 7` é disparado por uma violação estrita de fronteira entre os ambientes **Sandbox (Homologação)** e **Live (Produção)**. Especificamente:

1. **Incompatibilidade Cruzada de Chaves (Key Mismatch):** O cartão de teste é tokenizado no frontend com uma chave pública de Sandbox (`TEST-...`), mas a requisição subsequente para a API `/v1/payments` na Edge Function é autenticada com um Access Token de produção (`APP_USR-...`), ou vice-versa.
2. **Uso de Cartões de Teste com Credenciais Live:** Qualquer tentativa de submeter cartões de teste oficiais (ex: prefixos `5031 7557...` ou `4242 4242...`) utilizando um `Authorization: Bearer APP_USR-...` é imediatamente abortada pelo gateway do Mercado Pago com `Code 7`.
3. **Payer de Produção em Sandbox:** Se o objeto `payer.email` submetido na cobrança não for um **Buyer Test User** gerado pelo Mercado Pago (`@testuser.com`), mas a chamada estiver em modo de teste, ocorre rejeição de segurança.

---

### 1.2. A Topologia de Contas de Teste e a Quebra do Fluxo de Split
O modelo de negócios da UBT exige um **Marketplace com Split de Pagamentos**. No ecossistema Mercado Pago, isso não é uma cobrança simples de e-commerce, mas uma operação envolvendo **3 entidades obrigatórias**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TOPOLOGIA MERCADO PAGO MARKETPLACE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CONTA MARKETPLACE (Aplicação UBT):                                      │
│     - Criada no Portal de Desenvolvedores Mercado Pago                      │
│     - Possui Client ID, Client Secret, Public Key e Access Token (TEST-)    │
│     - Atua como a intermediadora que retém a 'application_fee'             │
│                                                                             │
│  2. CONTA SELLER / RECEBEDOR DO SPLIT (Mototaxista / Prestador):             │
│     - Conta de usuário de teste com perfil de Vendedor (Collector)          │
│     - Conecta-se à aplicação UBT via OAuth (/authorization + test_token)    │
│     - Recebe o valor líquido da corrida (90% do total)                      │
│                                                                             │
│  3. CONTA BUYER / PAGADOR (Tomador do Serviço / Passageiro):                │
│     - Usuário de teste específico criado na mesma aplicação                 │
│     - E-mail no padrão TESTUSER... @testuser.com                            │
│     - Titular dos cartões de teste de Sandbox                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Onde o fluxo quebrava no projeto:
1. **Ausência do Token do Vendedor (Seller OAuth Fallback Fatal):**  
   Na Edge Function `payment-gateway`, quando um mototaxista não concluiu o fluxo de OAuth (ou seja, não possui registro em `public.marketplace_accounts`), o código faz o fallback para o token da plataforma:
   ```ts
   const effectiveAuthToken = (sellerToken || "").trim() || canonicalAccessToken;
   ```
   **A Armadilha do Mercado Pago:** O endpoint `/v1/payments` **NÃO PERMITE** o envio do campo `application_fee` se o `Authorization: Bearer` pertencer à própria aplicação Marketplace! O parâmetro `application_fee` serve exclusivamente para a aplicação reter uma comissão da transação processada **na conta do Seller**. Quando a UBT tenta cobrar na própria conta usando `application_fee`, a API do MP retorna erro de validação ou 400.
2. **Autopagamento Proibido (Self-Payment Rejection):**  
   Durante os testes, para evitar erros de e-mail, forçou-se o comprador para um e-mail estático:
   `TESTUSER367958859718560557@testuser.com`.  
   Se esse usuário for o mesmo proprietário da credencial de teste do Marketplace ou do Seller, a API do Mercado Pago rejeita sumariamente a cobrança por autopagamento.
3. **Desalinhamento de Aplicações:**  
   Usuários de teste criados no painel do Mercado Pago pertencem a uma aplicação específica (`client_id`). Se a Public Key do frontend (`VITE_MP_PUBLIC_KEY`) pertencer a uma aplicação "App A" e o Access Token da Edge Function (`MP_ACCESS_TOKEN`) pertencer a uma "App B", a tokenização e o pagamento quebram com `invalid_token` ou `Code 7`.

---

## 2. Arquitetura Atual do Frontend (`CheckoutUniversal.tsx`)

### 2.1. Inicialização e Tokenização Direta via API REST
O frontend **não** carrega a biblioteca de Bricks do Mercado Pago (`window.MercadoPago`). Para manter o PWA leve e com carregamento instantâneo, a tokenização foi construída chamando diretamente o endpoint `/v1/card_tokens`:

```typescript
// Localização: src/components/Payment/CheckoutUniversal.tsx (Linhas 32-96)
async function tokenizeCard(
  cardNumber: string,
  cardholderName: string,
  expMonth: number,
  expYear: number,
  cvv: string,
  cpf?: string,
): Promise<string> {
  const mpPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY;

  if (!mpPublicKey || !mpPublicKey.trim() || mpPublicKey.trim() === "undefined") {
    throw new Error("Chave pública do Mercado Pago (VITE_MP_PUBLIC_KEY) não está configurada no ambiente.");
  }

  const cleanKey = mpPublicKey.trim();
  const cleanCpf = (cpf || "").replace(/\D/g, "");

  const payload: Record<string, unknown> = {
    cardNumber,
    card_number: cardNumber,
    cardholder: {
      name: cardholderName,
      ...(cleanCpf ? { identification: { type: "CPF", number: cleanCpf } } : {}),
    },
    cardExpirationMonth: expMonth,
    card_expiration_month: expMonth,
    expiration_month: expMonth,
    cardExpirationYear: expYear,
    card_expiration_year: expYear,
    expiration_year: expYear,
    securityCode: cvv || "123",
    security_code: cvv || "123",
  };

  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(cleanKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.id) return data.id;

  const errMessage =
    data?.message ||
    (Array.isArray(data?.cause) && data.cause[0]?.description) ||
    data?.error ||
    `Erro ${res.status} ao tokenizar cartão no Mercado Pago`;

  throw new Error(`Falha na tokenização do cartão: ${errMessage}`);
}
```

### 2.2. Geração do Cartão de Teste no Client-Side
O componente possui botões de atalho (*presets*) para preenchimento de cartões de teste de homologação:
- **Mastercard Test (Crédito):** `4242 4242 4242 4242` ou `5031 7557 3450 1234`
- **Validade:** `11/28` ou `05/29`
- **CVV:** `123` ou `789`

### 2.3. Payload Exato Disparado do Frontend para a Edge Function
Após obter o `cardToken`, o componente `CheckoutUniversal.tsx` monta o seguinte payload e dispara via `supabase.functions.invoke("payment-gateway")`:

```json
{
  "action": "create_payment_intent",
  "service_type": "mototaxi",
  "service_id": "00000000-0000-0000-0000-000000000001",
  "external_reference": "00000000-0000-0000-0000-000000000001",
  "transaction_amount": 25.00,
  "provider_id": "0a5edf64-7585-401f-b310-126529607da0",
  "provider_name": "Silvina Luz",
  "payer_email": "passageiro@gmail.com",
  "payer": {
    "email": "passageiro@gmail.com",
    "first_name": "Felipe",
    "last_name": "Santander",
    "identification": {
      "type": "CPF",
      "number": "85311283087"
    }
  },
  "payer_first_name": "Felipe",
  "payer_last_name": "Santander",
  "payer_identification": {
    "type": "CPF",
    "number": "85311283087"
  },
  "description": "Serviço UBT mototaxi - R$ 25,00 (Split 7 Vias)",
  "payment_method_id": "master",
  "cardToken": "98127398127391827391827391",
  "card_token": "98127398127391827391827391",
  "card_token_id": "98127398127391827391827391",
  "card_data": {
    "number": "5031755734501234",
    "cardholder_name": "Felipe Santander",
    "expiration_month": 5,
    "expiration_year": 2029,
    "security_code": "789"
  },
  "installments": 1,
  "metadata": {}
}
```

---

## 3. Arquitetura Atual do Backend (Edge Function `payment-gateway`)

### 3.1. Matemática de Repasse e Split de 7 Vias
O arquivo `supabase/functions/payment-gateway/index.ts` executa um algoritmo com precisão de centavos e balde residual para ratear o valor total:

```typescript
// Configuração Regulatória UBT
const REGULATORY_DEFAULTS = {
  prestador_pct:          90.000, // 90% para o Mototaxista
  ubt_pct:                 7.500, // 7.5% Taxa da Plataforma UBT
  comunidade_pct:          0.500, // 0.5% Associação / Fundo Comunitário
  premio_trabalhador_pct:  0.500, // 0.5% Sorteio do Trabalhador
  premio_consumidor_pct:   0.500, // 0.5% Fidelidade do Consumidor
  padrinho_tomador_pct:    0.500, // 0.5% Padrinho Passageiro (Balde residual)
  padrinho_prestador_pct:  0.500, // 0.5% Padrinho Motorista
};

// Injeção da taxa no Mercado Pago:
// application_fee = Tudo o que a plataforma UBT retém (10% total)
const application_fee = Math.round((totalAmount - prestador_amount) * 100) / 100;
```

### 3.2. Construção da Requisição para `https://api.mercadopago.com/v1/payments`
A função `createMercadoPagoPayment` monta o payload HTTP para o Mercado Pago da seguinte forma:

```typescript
// Localização: supabase/functions/payment-gateway/index.ts (Linhas 352-370)
const mpPayload: Record<string, unknown> = {
  transaction_amount: transactionAmount,
  description,
  payment_method_id: paymentMethodId || (cardToken ? "master" : "pix"),
  ...(Object.keys(payerObj).length > 0 ? { payer: payerObj } : {}),
  
  // application_fee: taxa retida pela UBT (marketplace) do total
  application_fee: applicationFee,
  
  ...(externalReference ? { external_reference: externalReference } : {}),
  ...(metadata ? { metadata } : {}),
};

if (cardToken) {
  mpPayload.token = cardToken;
}
if (isCard) {
  mpPayload.installments = Number(installments) || 1;
}
```

### 3.3. Cabeçalhos (Headers) e Autenticação
```typescript
const mpHeaders = new Headers();
mpHeaders.set("Authorization", `Bearer ${mpToken}`);
mpHeaders.set("Content-Type", "application/json");
mpHeaders.set("X-Idempotency-Key", idempotencyKey);
```

#### O Dilema do Token:
```typescript
// Resolução do token executada na Edge Function:
const canonicalToken = (
  Deno.env.get("MP_ACCESS_TOKEN") ||
  Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ||
  ""
).trim();

// Se o prestador conectou via OAuth, usa o token dele; caso contrário usa o da plataforma:
const mpToken = (sellerAccessToken || "").trim() || canonicalToken;
```
> **Ponto Crítico:** Se `sellerAccessToken` não existir, `mpToken` se torna `canonicalToken`. Como consequência, a requisição envia `application_fee` na própria conta dona do token, o que causa rejeição no Mercado Pago.

---

## 4. Configuração de Variáveis e Segredos (Test vs Live)

### 4.1. Mapeamento das Variáveis de Ambiente

| Variável | Injetada Por | Consumida Por | Exemplo Sandbox | Exemplo Live |
|---|---|---|---|---|
| `VITE_MP_PUBLIC_KEY` | Vercel (Frontend) | `CheckoutUniversal.tsx` | `TEST-3c32...` | `APP_USR-7e21...` |
| `VITE_MP_CLIENT_ID` | Vercel (Frontend) | `ConfigFinanceiroPage.tsx` | `1234567890123456` | `1234567890123456` |
| `MP_ACCESS_TOKEN` | Supabase Secrets | `payment-gateway` | `TEST-8812...` | `APP_USR-8812...` |
| `MERCADOPAGO_CLIENT_SECRET` | Supabase Secrets | `payment-gateway` | `SecrEtTestKey...` | `SecrEtLiveKey...` |

### 4.2. A Diferença de Tratamento dos Prefixos `TEST-` e `APP_USR-`
No histórico de commits do repositório:
- **Commit `6ac7bed`:** Tentou-se criar um roteador inteligente inspecionando o prefixo da chave. Se a transação fosse identificada como teste, descartava-se o token se ele começasse com `APP_USR-` para evitar o erro 401/Code 7.
- **Commit `a2d64e5`:** A trava foi revertida sob a justificativa de simplificação ("canonical access token"), o que fez o sistema reintroduzir o risco de enviar chamadas de teste usando tokens de produção se o segredo do Supabase estivesse apontando para produção.

**Regra de Ouro do Mercado Pago:**
```
[Frontend VITE_MP_PUBLIC_KEY]   MUST MATCH   [Backend MP_ACCESS_TOKEN]
      TEST-xxx                  ===>               TEST-xxx
     APP_USR-xxx                ===>              APP_USR-xxx
```
Se o frontend gerar um `cardToken` com `TEST-xxx` e o backend enviar esse token para `/v1/payments` usando `APP_USR-xxx`, o Mercado Pago retorna instantaneamente:
`Code: 7 - Unauthorized use of live credentials`.

---

## 5. Estrutura do Banco de Dados (Supabase DDL)

### 5.1. Tabela `public.pagamentos_split` (DDL de `05_mercado_pago_split.sql`)
Armazena o registro de auditoria imutável de cada fatia rateada:

```sql
CREATE TABLE IF NOT EXISTS public.pagamentos_split (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text UNIQUE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'in_mediation', 'rejected', 'refunded', 'charged_back')),
  service_type text NOT NULL CHECK (service_type IN ('mototaxi', 'diarista', 'ambulante')),
  service_id uuid NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  provider_amount numeric(10,2) NOT NULL,
  ubt_amount numeric(10,2) NOT NULL,
  entity_amount numeric(10,2) NOT NULL,
  entity_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prize_worker_amount numeric(10,2) NOT NULL,
  prize_consumer_amount numeric(10,2) NOT NULL,
  godparent_amount numeric(10,2) NOT NULL,
  godparent_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  refunded_amount numeric(10,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### 5.2. Tabela `public.marketplace_accounts` (DDL de `39_marketplace_tables.sql`)
Armazena as credenciais de OAuth dos prestadores (Sellers) vinculados ao Mercado Pago:

```sql
CREATE TABLE IF NOT EXISTS public.marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  provider_id text,
  mercado_pago_user_id text,
  status text NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN (
    'NOT_CONNECTED', 'CONNECTED', 'ERROR', 'TOKEN_EXPIRING', 'REVOKED', 'REFRESH_REQUIRED'
  )),
  ambiente text NOT NULL CHECK (ambiente IN ('sandbox', 'production')),
  oauth_status text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  token_metadata jsonb,
  access_token_encrypted text, -- Token de autorização OAuth do Seller
  refresh_token_encrypted text, -- Refresh token do Seller
  token_expiration timestamptz,
  last_refresh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ambiente)
);
```

### 5.3. Tabela `public.payments` e Relacionamento com Corridas/Serviços
A tabela `public.payments` (definida em `10_production_financial_core.sql`) unifica os pagamentos de corridas de mototáxi (`mototaxi_corridas`), agendamentos de diaristas (`diarista_agendamentos`) e pedidos de ambulantes (`pedidos`):

```sql
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type text NOT NULL,
    service_id uuid NOT NULL,
    customer_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    provider_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    gateway text NOT NULL DEFAULT 'mercado_pago',
    gateway_payment_id text UNIQUE,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    currency text NOT NULL DEFAULT 'BRL',
    payment_method text NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
    status payment_status NOT NULL DEFAULT 'pending',
    idempotency_key text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
```

---

## 6. Diagnóstico Técnico para o Codex (OpenAI)

Para que o Codex possa solucionar de forma definitiva o fluxo de split em Sandbox, os seguintes nós arquiteturais precisam de intervenção cirúrgica:

### ⚠️ Nó 1: O dilema do `application_fee` sem Seller OAuth
- **O Problema:** A API do Mercado Pago **não permite** que uma transação contenha `application_fee` se o `Authorization: Bearer` da requisição for o token da própria conta que vai receber a taxa. Ela exige que a transação ocorra sob as credenciais do **Vendedor** (via OAuth), debitando o `application_fee` em benefício da aplicação Marketplace.
- **A Solução Requerida:**  
  1. No fluxo em que o prestador **não** está conectado via OAuth, a Edge Function não pode enviar `application_fee` para a API do Mercado Pago. Ela deve processar a cobrança integral na conta da UBT e gerenciar o split de forma virtual/contábil no Supabase (`public.pagamentos_split`), realizando o repasse posterior (via Payout / PIX Transfer).
  2. No fluxo em que o prestador **está** conectado via OAuth em Sandbox (com `test_token=true`), o `Authorization: Bearer` deve ser obrigatoriamente o `access_token` do prestador armazenado em `marketplace_accounts`, e o `application_fee` deve ser exatamente os 10% da UBT.

### ⚠️ Nó 2: Alinhamento de Contas e Test Users no Sandbox
Para o teste funcionar de ponta a ponta sem o erro `Code 7`:
1. **Aplicação Única:** Criar uma aplicação limpa no painel de desenvolvedores do Mercado Pago. Extrair a `Public Key (TEST-)` para o frontend e o `Access Token (TEST-)` + `Client ID` + `Client Secret` para o Supabase.
2. **Dois Usuários de Teste Distintos:**
   - **Usuário A (Seller Test User):** Logar no PWA como prestador, ir a `/app/config/financeiro`, clicar em "Conectar Mercado Pago" e autorizar a conta com o Usuário A.
   - **Usuário B (Buyer Test User):** Gerar via endpoint `POST /users/test_user` do Mercado Pago. Usar o e-mail deste usuário no objeto `payer.email` e nos testes de cartão do `CheckoutUniversal.tsx`.

### ⚠️ Nó 3: Tokenização de Cartão no Frontend
No arquivo `src/components/Payment/CheckoutUniversal.tsx`:
- Garantir que a requisição de tokenização envie o `cardholder.identification` com CPF válido caso o Mercado Pago exija (em Sandbox brasileiro, o CPF do comprador de teste é frequentemente validado pelo algoritmo mod11).
- Assegurar que `VITE_MP_PUBLIC_KEY` não sofra fallback acidental para uma chave de produção `APP_USR-`.

---

## 7. Conclusão e Próximos Passos
Este documento consolida todo o código de frontend (`CheckoutUniversal.tsx`), backend (`payment-gateway`), banco de dados (`pagamentos_split`, `marketplace_accounts`) e histórico de commits.  
Com este dossiê, o Codex dispõe de todas as informações necessárias para implementar a blindagem de ambientes, ajustar o roteamento de tokens OAuth e homologar a suíte de testes `UBT-PAY-007` com 100% de sucesso.
