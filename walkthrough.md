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

### 5. Analytics Core & Service Worker Stabilizations
*   **Stale User ID Validation**: Added an asynchronous DB check (`checkUserExists`) inside the authentication state listener to confirm that `session.user.id` exists in the `public.usuarios` table. If it does not exist, `currentUserId` is set to `null` (preventing foreign key constraint failures caused by stale localStorage sessions after database cleans).
*   **Strict Sanitization**: Enhanced the event tracking filter to enforce that `user_id` is never empty (`""`), the string `"null"`, `"undefined"`, or any invalid UUID.
*   **Required Diagnostics Logging**: Configured a verbose console log immediately before any database insertion showing `typeof user_id`, `user_id_value`, `anonymous_id`, `session_id`, and `origem_source`.
*   **Auto-Correction / Salvaging**: Implemented an automated recovery catch inside `flush()` and `retryBatch()`. If a database insertion triggers the `23503` foreign key violation on `analytics_events_user_id_fkey`, all `user_id` columns in the batch are immediately set to `null` (representing visitor events) and re-inserted, resolving database loops.
*   **ReferenceError Mitigation**: Imported `logSystem` from `@/services/LoggingService` and wrapped its calls in a private try-catch helper `safeLogSystem`, protecting the analytics thread from unexpected logging failures.
*   **Strict Discard Policies**: Hardened the retry loop. A batch is discarded permanently after 5 attempts without rescheduling any retries, adding back to `this.buffer`, or executing additional flushes.
*   **Service Worker Interception Fix**: Refactored `public/sw.js` to skip intercepting URLs containing `supabase.co`, `rest/v1`, `auth/v1`, `storage/v1`, `functions/v1`, or `realtime`, bypassing service worker processing and avoiding fetch credentials/CORS exceptions.

### 6. Landing Page Hero Reconstruction (UBT-COMM-003-HERO-REDESIGN-V1.0)
*   **Complete Redesign**: Reconstructed the entire Hero section from scratch, removing all legacy SVG networks, interactive card map representations, and control containers to let the beauty of Ubatuba shine as the primary element.
*   **Strict Structural Order**: Structured the section layout strictly in three absolute layers:
    1.  **Background absoluto**: Premium photo of Ubatuba with connected economic networks (`/hero-2.0.png`) spanning the full width of the Hero section. We edited the user's mockup image using generative AI (`generate_image`) to remove the overlay text, buttons, and logo, resulting in a clean background containing only the sunset landscape and glowing network nodes/lines.
    2.  **Overlay**: Clean dark gradient fade overlay to ensure high-contrast left-aligned text legibility.
    3.  **Conteúdo**: Left-aligned content block containing the impact title (headline broken into 4 lines exactly as mockup), descriptive subheadline, gradient divider line, action CTA buttons, localized status indicator, and animated scroll indicator.
*   **Logo Transparency**: Processed all official UBT logo files (`logo-02.png`, `logo-03.png`, `logo-aplicacoes.png`) using Jimp, removing their solid off-white backgrounds with edge anti-aliasing to make them fully transparent.
*   **Left Alignment**: Aligned the Hero headline, subheadline, divider line, and CTAs to the left (`items-start text-left`) to match the mockup layout.
*   **CTAs & Padding**: Stacked buttons vertically inside a responsive `max-w-md` container. Set both buttons to exactly the same height (`h-16`) and generous padding (`px-8`), matching the mockup's height and style perfectly.

---

## Verifications
*   **Compilation:** `npx tsc --noEmit` returns zero compilation errors.
*   **Production Build:** `npm run build` completed successfully.
*   **Development Server:** Dev server starts successfully on port 8081 without errors.
