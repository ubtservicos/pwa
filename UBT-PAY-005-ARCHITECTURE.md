# UBT-PAY-005-ARCHITECTURE

## 1. Abstração de Domínio / Desacoplamento
Para proteger o ecossistema UBT de alterações de contrato do gateway de pagamento, criamos uma camada de abstração que mapeia entidades internas para o provedor Mercado Pago de forma desacoplada.

```text
  UBT DOMAIN ENTITIES             ADAPTER INTERFACE             GATEWAY PROVIDER
 [Payment / SplitConfig]  --->  [MarketplaceGateway]  --->  [Mercado Pago 1:N API]
```

---

## 2. Separação de Splits: Interno vs. Mercado Pago
- **UBT Internal Economic Split:** Gerenciado em `split_config` no banco de dados Supabase (90% Prestador, 5% UBT, 2% Associação, 1% Prêmio Trab., 1% Prêmio Cons., 1% Padrinho).
- **Mercado Pago Marketplace Split:** Camada adaptadora responsável por consolidar e traduzir as frações econômicas internas para o payload 1:N aceito pelo Mercado Pago (exemplo: enviando taxa administrativa de comissão no parâmetro `application_fee` ou distribuindo entre os recipients cadastrados).

---

## 3. Modelo Operacional de Marketplace 1:N
A arquitetura prepara o fluxo conceitual mínimo:
1. **Marketplace (UBT):** Administrador e detentor do Client ID/Client Secret.
2. **Seller / Prestador:** Conecta sua conta via OAuth e concede escopo de recebimento.
3. **Payment:** Operação Pix gerada com `marketplace_fee` retido automaticamente.
4. **Recipients:** Destinatários do split configurado na liquidação.
5. **Settlement / Payment Status:** Monitoramento assíncrono de aprovações.
6. **Refund / Dispute:** Fluxo de devolução proporcional ou total com estorno das taxas.
