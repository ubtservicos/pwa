# UBT-PAY-005-WEBHOOK-DESIGN

## 1. Segurança e Assinatura de Webhooks
O Mercado Pago envia webhooks para notificar atualizações de pagamento, estornos e chargebacks. A arquitetura UBT assegura a autenticidade através do cabeçalho `x-signature`:

- O backend valida a assinatura HMAC utilizando o segredo configurado (`MERCADO_PAGO_WEBHOOK_SECRET`).
- Qualquer requisição com assinatura inválida é descartada imediatamente com erro `HTTP 401 Unauthorized`.

---

## 2. Idempotência e Bloqueio de Duplicidade
Para evitar que múltiplos disparos do webhook resultem em duplicações de transação:
1. O backend recebe o payload e calcula o hash (MD5 ou SHA-256) da requisição.
2. É feita uma consulta à tabela `marketplace_webhook_events` utilizando o `event_id` único enviado pelo Mercado Pago.
3. Se o `event_id` já existir no banco, a requisição é reconhecida e finalizada imediatamente com `HTTP 200 OK`, sem reprocessar as regras de negócio.
4. Se for novo, ele entra com status `pending` e inicia o processamento assíncrono.
