# Walkthrough — UBT SuperApp: LGPD & Segurança Antifraude (Financeiro & Operacional)

Este documento consolida as implementações recentes de conformidade legal, telemetria de segurança financeira para Mercado Pago Produção e proteção contra abusos operacionais.

---

## 1. Conformidade Mínima LGPD (Piloto Fechado)

*   **Banco de Dados ([19_lgpd_compliance.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/19_lgpd_compliance.sql)):** Adicionada a coluna `deleted_reason` à tabela `usuarios`.
*   **Portabilidade ("Meus Dados"):** Criada a Edge Function `export-user-data` compilando dados de perfil, histórico de pedidos/corridas, financeiros, cancelamentos, disputas e documentos KYC em JSON assinado temporário de 24h. Histórico exibido em [ConfigPrivacidadePage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/ConfigPrivacidadePage.tsx).
*   **Direito ao Esquecimento ("Excluir Conta"):** Criada a Edge Function `delete-account` realizando a anonimização cadastral e exclusão de credenciais na tabela `auth.users` e arquivos do storage de KYC, resguardando dados de splits/auditorias fiscais. Ações manuais administrativas em [AdminLgpdPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLgpdPage.tsx) exigem justificativa formal.

---

## 2. Preparação Mercado Pago Produção (Segurança Financeira)

*   **Banco de Dados ([20_payment_security_metadata.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/20_payment_security_metadata.sql)):**
    *   Adicionada coluna `metadata` (jsonb) em `payments` e `refunds`.
    *   Criada tabela de riscos `chargebacks` com RLS restrita.
    *   Criada a função PL/pgSQL `calculate_antifraud_score()` pontuando riscos transacionais (dispositivo novo, cartões múltiplos, cancelamentos excessivos, múltiplos logins).
*   **Serviço Cliente ([PaymentSecurityService.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/PaymentSecurityService.ts)):** Coleta fingerprint de browser persistente no `localStorage`, OS, versão do app e card hash. Integrado ao checkout das três verticais ([AmbulantePedidoPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantePedidoPage.tsx), [DiaristaAgendamentoPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaAgendamentoPage.tsx), [MototaxiTomador.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/MototaxiTomador.tsx)).
*   **Enriquecimento Backend:** As Edge Functions de `/checkout` e `/refund` processam e gravam automaticamente o IP hash (via Base64 por privacidade) e User Agent na transação.

---

## 3. Mecanismo Antifraude para Abuso Operacional

*   **Banco de Dados ([21_operational_antifraud.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/21_operational_antifraud.sql)):**
    *   Criada tabela `operational_flags` registrando eventos de abuso com severidade.
    *   Adicionadas colunas `blocked_until` e `under_review` em `usuarios`.
    *   Gatilhos reativos (Triggers) após novas inserções em `cancellations` e `disputes`.
*   **Regras Operacionais:**
    1.  **Mototáxi:** 3 cancelamentos fora da carência em 1 hora ➔ Suspensão temporária de 60 minutos.
    2.  **Diaristas:** 3 no-shows em 30 dias ➔ Status de revisão manual obrigatória (`under_review = true`).
    3.  **Ambulantes:** >= 3 cancelamentos sucessivos do cliente em 2 horas ➔ Flag de monitoramento de risco médio.
*   **Auto-Unblock:** Criada a função SQL self-healing `check_and_unblock_user(p_user_id)` que restaura o status `'active'` e limpa bloqueios temporários vencidos automaticamente.

---

## 4. Resultados da Validação
*   **Gatilhos de Auditoria SQL:** Corrigida a função `log_financial_audit()` legada de trigger em `cancellations` e `refunds` para se integrar à tabela estruturada `audit_events`.
*   **Scripts de Teste:** Executados com sucesso os testes e2e de triggers transacionais antifraude (`test_operational_antifraud.js`), verificando bloqueios automáticos temporários e revisões pendentes.
*   **Compilação PWA:** O comando de build (`npm run build`) concluiu com **sucesso** (exit code 0).
