# UBT-PAY-005-DATA-MODEL

## 1. Schema das Novas Tabelas (Criadas no DEV/HOMOLOG)

### `public.marketplace_accounts`
- Mapeia o vínculo de contas Mercado Pago por Prestador e ambiente (Sandbox/Prod).
- **Segurança:** Armazena apenas tokens criptografados. RLS habilitado (leitura restrita ao dono da conta).

### `public.marketplace_oauth_connections`
- Registra o ciclo de autorização e o token `state` para prevenção de CSRF.
- RLS habilitado (proprietário lê apenas suas próprias conexões).

### `public.marketplace_payment_links`
- Conecta o pagamento UBT com a preferência externa gerada.
- RLS ativo (somente administradores cadastrados podem ler ou atualizar).

### `public.marketplace_recipient_allocations`
- Abstração de splits 1:N preparando a alocação em cents.
- RLS restrito a administradores.

### `public.marketplace_webhook_events`
- Tabela de controle de idempotência de eventos recebidos do Mercado Pago.
- Registra `event_id` único com bloqueio contra duplicidades e hash do payload.

---

## 2. DDL Oficial da Migration 39
As definições SQL completas foram comitadas e aplicadas em DEV na migration [`39_marketplace_tables.sql`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/39_marketplace_tables.sql).
- **Atenção:** NÃO aplicada em PRODUÇÃO, conforme determinação da regra absoluta.
