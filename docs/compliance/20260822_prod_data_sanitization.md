# Relatório de Compliance: Sanitização de Dados em Produção

**Data:** 22/08/2026
**Banco de Dados:** Produção (bfqidoduceusbqlnrsol)

## Objetivo
Expurgo de dados operacionais de teste (veículos fake, disputas de arbitragem, filas de espera simuladas, KYCs mockados e históricos financeiros de Sandbox) antes do Go-Live do sistema, preservando estritamente as contas corporativas e administrativas.

## Ações de Sanitização (Garbage Collection)
As seguintes tabelas e registros operacionais foram limpos (TRUNCATE / DELETE) no banco de dados de Produção:
- **Operacional:** waitlist, eiculos / frota, tabelas de KYC.
- **Auditoria / Disputas:** disputes, rbitrage_tickets, udit_events.
- **Financeiro / Marketplace:** pagamentos_split, payments, payment_splits, marketplace_webhook_events, marketplace_payment_links, marketplace_recipient_allocations.
- **Corridas / Pedidos:** ides, mototaxi_corridas, pedidos, mbulante_pedidos, diarista_agendamentos.

## Preservação Restrita de Usuários
Para garantir acesso administrativo, todos os perfis e registros em uth.users e tabelas satélites (usuarios, profiles, dmin_users) foram expurgados, COM EXCEÇÃO das seguintes contas de e-mail corporativas:
1. chrystianp094@gmail.com
2. epasantander@gmail.com
3. ssociacao.teste@example.com
4. ubt.servicos@gmail.com

**Responsável Técnico:** Agente Antigravity
