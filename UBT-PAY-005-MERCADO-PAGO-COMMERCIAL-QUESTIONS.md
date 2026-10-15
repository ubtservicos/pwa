# UBT-PAY-005-MERCADO-PAGO-COMMERCIAL-QUESTIONS

Este documento consolida as pendências comerciais e técnicas da UBT junto à equipe do Mercado Pago para permitir o acoplamento final da integração 1:N.

---

## 1. Modelo Marketplace 1:N (Split)
1. **Confirmação de Habilitação:** A conta principal da UBT está habilitada contratualmente para split 1:N?
2. **Limite de Favorecidos:** Qual é o número máximo de recipients por transação?
3. **Distribuição para 6 Favorecidos:** O sistema suporta que uma única cobrança Pix distribua valores entre os 6 favorecidos internos da UBT (Prestador, UBT, Associação, Padrinho, Prêmio Trab., Prêmio Cons.)?
4. **Exigência de Contas Individuais:** Os favorecidos (Associação, Padrinho, etc.) precisam criar contas individuais no Mercado Pago para receber o split, ou o marketplace pode repassar via PIX externo de forma assíncrona?
5. **Responsabilidade do Chargeback:** Em caso de chargeback ou cancelamento, a cobrança recai sobre a conta principal da UBT (Marketplace) ou sobre a conta conectada do Prestador?

---

## 2. Comissões & Tarifas
6. **Retenção de Taxa (Application Fee):** O parâmetro de split permite que a comissão da UBT seja retida de forma percentual ou apenas valor fixo?
7. **Liberação de Saldos:** Qual é o prazo padrão de liberação (D+0, D+14, D+30) do saldo arrecadado na conta do vendedor e da UBT?
8. **Sandbox vs Produção:** Existem limites de valores ou volumes operacionais para testes no Sandbox no fluxo de split?

---

## 3. Fluxo OAuth
9. **Escopos Autorizados (Scopes):** Quais escopos (`read`, `write`, `payments`) são estritamente obrigatórios para o vendedor autorizar no modelo 1:N?
10. **Validade do Token:** Qual o tempo de expiração do `access_token` e do `refresh_token` gerados no OAuth?
11. **Uso de PKCE:** O fluxo de autorização do Mercado Pago é compatível com OAuth 2.0 PKCE para segurança no mobile?

---

## 4. Webhooks & Idempotência
12. **Mapeamento de Eventos:** Quais eventos exatos de status (payment, refund, chargeback) são disparados no webhook de split?
13. **Segurança de Origem:** Qual o cabeçalho oficial (`x-signature` ou outro) utilizado para validar a assinatura criptográfica e como validar no backend?
