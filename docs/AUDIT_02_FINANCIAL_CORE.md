# Audit 02 — Financial Core & Payment Securities Mapping

Este documento detalha o funcionamento e a arquitetura das operações financeiras, regras de split dinâmico e os mecanismos de segurança e prevenção a fraudes mapeados no PWA da UBT.

---

## 1. Integração Mercado Pago

Conforme verificado nas especificações e em [`MercadoPagoSandbox.test.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/test/MercadoPagoSandbox.test.ts), a integração com o Mercado Pago foi projetada sob as seguintes premissas:

### 1.1. Fluxo de Autorização OAuth
- Permite que os prestadores de serviço conectem suas contas Mercado Pago à UBT de forma segura.
- **Prevenção contra CSRF:** O redirecionamento exige um token de estado (`state`) único gerado na plataforma. Caso o estado retornado difira do salvo localmente, o processo é abortado lançando `CSRF_STATE_INVALID`.
- **Validação de Código:** Impede a reutilização de tokens expirados (`OAUTH_CODE_EXPIRED`) ou já processados (`OAUTH_CODE_REUSED`).

### 1.2. Processamento de Pagamento (API / Checkout Transparente)
- Opera via chamadas diretas de API que recebem o valor da transação, descrição, identificadores de rateio (recipients) e chave de idempotência.
- **Prevenção a Cobranças Duplas (Idempotência):** Um mapa interno armazena o resultado de cada transação indexada por sua chave única de idempotência. Se o mesmo pedido de pagamento for submetido novamente (ex: clique duplo do usuário), retorna o mesmo identificador aprovado anteriormente.
- **Trava de Sandbox:** Trava explícita de segurança impede o processamento real de pagamentos caso a chave `sandbox` esteja desativada e as credenciais reais do Mercado Pago não estejam configuradas (`PRODUCTION_ENVIRONMENT_BLOCKED`).

### 1.3. Recepção de Webhooks
- O sistema de escuta captura atualizações de transações Mercado Pago.
- **Validação de Assinatura:** O webhook exige uma assinatura criptográfica válida (`valid_mp_signature`). Assinaturas corrompidas ou inválidas disparam a exceção `WEBHOOK_SIGNATURE_INVALID`.
- **Tratamento de Duplicidade:** Mantém cache dos IDs de eventos processados. Tentativas de reprocessamento do mesmo webhook retornam status `"duplicate"`, impedindo duplicações de crédito ou cashback.

---

## 2. Regras de Split Dinâmico (Rateio)

O motor de rateio de valores em transações, conforme testado em [`DynamicSplit.test.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/test/DynamicSplit.test.ts), obedece a regras rígidas de distribuição:

### 2.1. Tamanho do Pool de Distribuição
O "Pool" representa a soma das fatias que serão redistribuídas na economia local (Comunidade, Prêmios e Padrinhos/Indicações). Atualmente, existem três pools default do sistema configurados e validados no banco de dados:

1. **Pool de 5%:**
   - **Prestador (Trabalhador):** 90%
   - **Taxa UBT:** 5%
   - **Fundo Comunitário:** 2%
   - **Prêmio Trabalhador:** 1%
   - **Prêmio Consumidor:** 1%
   - **Padrinho/Madrinha:** 1%
2. **Pool de 6%:**
   - **Prestador (Trabalhador):** 90%
   - **Taxa UBT:** 4%
   - **Fundo Comunitário:** 2%
   - **Prêmio Trabalhador:** 1.5%
   - **Prêmio Consumidor:** 1.5%
   - **Padrinho/Madrinha:** 1%
3. **Pool de 8%:**
   - **Prestador (Trabalhador):** 88%
   - **Taxa UBT:** 4%
   - **Fundo Comunitário:** 3%
   - **Prêmio Trabalhador:** 2%
   - **Prêmio Consumidor:** 2%
   - **Padrinho/Madrinha:** 1%

### 2.2. Restrições e Clamps no Ajuste pelo Prestador
Os prestadores de serviço podem ajustar individualmente a divisão de seu pool, respeitando as seguintes restrições:
- **Limite Mínimo:** Nenhuma categoria do pool (Ex: Fundo Comunitário) pode ser zerada. É aplicado um limite inferior rígido de **0.5%** por categoria.
- **Incrementos Válidos:** Apenas incrementos ou decréscimos múltiplos de **0.5%** são aceitos. Valores quebrados sofrem arredondamento automático para o valor múltiplo de 0.5% mais próximo.
- **Invalidação de Regra Customizada:** Caso o admin altere o tamanho do Pool padrão geral no banco de dados (ex: de 5% para 6%), a configuração individualizada do prestador que somava 5% é imediatamente desativada, e a distribuição retorna à regra padrão atualizada da plataforma.
- **Imutabilidade de Taxas Core:** Os prestadores são impedidos de alterar as fatias destinadas ao próprio prestador (`prestador_pct`) e à taxa de intermediação UBT (`ubt_pct`). Estas fatias são fixas por modalidade e alteráveis unicamente pelo administrador.

---

## 3. Segurança e Prevenção a Fraudes (PaymentSecurityService)

O módulo de segurança de pagamentos em [`PaymentSecurityService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/PaymentSecurityService.ts) atua como a camada de telemetria antifraude executada na ponta (client-side):

- **Geração de Device Fingerprint:** Cria um identificador persistente e único concatenando a resolução da tela do usuário (`screenInfo`), profundidade de cor e um UUID aleatório criptografado em Base64 (`ubt_df_[resolucao_base64]_[uuid_aleatorio]`). O identificador é salvo em localStorage para rastrear sessões repetidas.
- **Identificação do Sistema Operacional:** Analisa o UserAgent para detectar o sistema operacional (Windows, macOS, UNIX, Linux, Android, iOS), gerando dados contextuais contra ataques de spoofing.
- **Coleta de Metadados de Pagamento:** Agrupa o Device Fingerprint, o UserAgent do navegador, o hash do cartão transacionado (`card_hash`) e a data/hora exata em um objeto consolidado enviado junto aos pagamentos. O campo `ip_hash` é reservado como nulo para que o gateway ou edge functions realizem a resolução real e o hashing do IP do cliente de forma inviolável no lado do servidor.
