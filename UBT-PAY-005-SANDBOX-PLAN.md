# UBT-PAY-005-SANDBOX-PLAN

## 1. Variáveis de Ambiente de Sandbox
Para garantir o isolamento estrito entre testes e produção, as seguintes variáveis de ambiente foram mapeadas para o ambiente Sandbox nas variáveis locais (`.env`) e no painel `Preview / Development` da Vercel:
- `MERCADO_PAGO_ENV=sandbox`
- `MERCADO_PAGO_CLIENT_ID=[CLIENT_ID_SANDBOX_PLACEHOLDER]`
- `MERCADO_PAGO_CLIENT_SECRET=[CLIENT_SECRET_SANDBOX_PLACEHOLDER]`
- `VITE_SUPABASE_URL=https://xqujubbqcfqxkfczbidq.supabase.co`

---

## 2. Validação Estrita de Segurança (Release Gate)
- O código do backend/Edge Functions implementa uma checagem ativa:
  ```typescript
  if (Deno.env.get("MERCADO_PAGO_ENV") !== "sandbox" && Deno.env.get("SUPABASE_URL")?.includes("bfqidoduceusbqlnrsol")) {
    throw new Error("PRODUCTION_ENVIRONMENT_BLOCKED: Real payments/credentials not configured!");
  }
  ```
- Essa regra impede que qualquer credencial ou teste de sandbox seja acionado acidentalmente no banco de Produção oficial.
