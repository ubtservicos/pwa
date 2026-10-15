# UBT-PAY-005-PRE-INTEGRATION-AUDIT

## 1. O que já existe no repositório
- **Mecanismo de Arredondamento Residual:** Função de processamento de splits em centavos inteiros (preservando o restante de centavos no provedor). Validado por suíte de testes.
- **Estruturas de Onboarding, Waitlist e KYC:** Tabelas Supabase com transições de estados e validações de e-mail/dados.
- **Tabela de Split Econômico:** Tabela `split_config` no banco de dados atuando como fonte de verdade para os percentuais da UBT.

---

## 2. O que pode ser reutilizado
- **Trilha de Auditoria:** Chamadas à RPC `log_admin_action` e a tabela `public.admin_audit_logs` para gravar eventos de conexão/desconexão.
- **Páginas de Configuração:** Layout existente em [`ConfigFinanceiroPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/ConfigFinanceiroPage.tsx) para injetar o fluxo de vinculação do Mercado Pago.
- **Estrutura do checkout:** A Supabase Edge Function `/supabase/functions/checkout/index.ts` pode ser estendida futuramente para integrar o adaptador.

---

## 3. O que precisa ser alterado
- **Contratos e Classes de Checkout:** Adicionar uma camada de abstração de gateway (Interface) para isolar o domínio da UBT da resposta direta do Mercado Pago.
- **Controle de Variáveis de Ambiente:** Adicionar checagem explícita para barrar credenciais Sandbox em produção e vice-versa.

---

## 4. O que está ausente
- **Tabelas de Log de Webhooks e Relacionamento:** Estruturas para registrar tokens criptografados de OAuth, links de pagamentos e logs de auditoria dos webhooks recebidos.
- **Assinatura e Idempotência de Webhook:** Métodos para validação criptográfica do cabeçalho `x-signature` do Mercado Pago e validação de `event_id` duplicados.

---

## 5. O que depende de informação do Mercado Pago (Comercial / Suporte)
- **Habilitação de Split 1:N:** Confirmação de que a conta da UBT possui permissão de Marketplace com carteira assessorada para repasse simultâneo a 6 destinatários.
- **Mapeamento de Destinatários:** Se é necessário criar uma conta Mercado Pago individual para a Associação, Prêmios e Padrinhos ou se os splits são consolidados.

---

## 6. O que não deve ser integrado/ativado ainda
- **Endpoints Reais de Produção:** Nenhuma credencial privada de produção da UBT ou do Mercado Pago pode ser ativada ou exposta.
- **Fluxos de Cobrança Real:** Nenhuma transação bancária ou Pix de Produção deve ser gerada nesta wave.
