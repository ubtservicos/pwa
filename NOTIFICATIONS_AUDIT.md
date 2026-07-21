# UBT SuperApp — Relatório de Auditoria: Sistema de Notificações

**Data do Relatório:** 2026-07-15  
**Versão:** Notifications Audit v1.0  
**Classificação:** Técnico / Segurança Interna  
**Autor:** Antigravity AI  

---

## 1. Mapeamento de Canais e Integrações

O sistema de mensagens e alertas de eventos do UBT SuperApp está estruturado nos seguintes pilares:

*   **Push Notifications:** Disparados via **Firebase Cloud Messaging (FCM)** para dispositivos Android/iOS. Utilizados para despachar alertas imediatos (ex: "Mototaxista a caminho").
*   **E-mail:** Integrado com **Resend API / SendGrid**. Utilizado para envio de recibos fiscais PDF, faturas de cartão de crédito e comunicados institucionais.
*   **SMS:** Integrado com **Twilio / Zenvia**. Canal alternativo de contingência para validação OTP de login (Double Factor Authentication).
*   **WhatsApp:** Canal oficial secundário integrado via **Z-API / Twilio WhatsApp API**. Utilizado para disparo de confirmação Pix e compartilhamento de trajetos de segurança.
*   **Supabase Realtime (WebSockets):** Utilizado para sincronicidade in-app (ex: chat em tempo real entre diarista e cliente ou acompanhamento do mototaxista no mapa).

---

## 2. Políticas de Retentativa (Retry) e Filas Assíncronas

Para garantir a entrega resiliente das mensagens e tolerar instabilidades de provedores externos:

### 2.1 Fila Assíncrona (`public.notifications_queue`)
*   Todas as requisições de mensagens são gravadas em uma tabela de fila dedicada:
    *   `id`: `uuid`
    *   `recipient_id`: `uuid`
    *   `channel`: `text` (`'push'`, `'whatsapp'`, `'email'`, etc.)
    *   `payload`: `jsonb` (dados da mensagem)
    *   `status`: `text` (`'pending'`, `'sent'`, `'failed'`)
    *   `retry_count`: `integer` (Default: `0`)
    *   `next_attempt_at`: `timestamp with time zone`

### 2.2 Política de Retry (Exponential Backoff)
Em caso de falha no envio inicial (retorno de erro da API do Firebase/Twilio), um worker secundário executa novas tentativas em intervalos crescentes:
*   **Tentativa 1 (Falha inicial):** Aguarda **1 minuto** antes de reprocessar.
*   **Tentativa 2:** Aguarda **5 minutos** antes de reprocessar.
*   **Tentativa 3 (Última):** Aguarda **15 minutos** antes de marcar a mensagem como `'failed'` definitivamente no log de auditoria do operador.

---

## 3. Matriz de Criticidade por Vertical

Abaixo está o mapeamento dos fluxos críticos de mensagens do SuperApp e sua classificação de impacto:

| Vertical | Tipo de Mensagem | Canal Primário | Nível de Criticidade | SLA de Envio | Impacto da Falha |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mototáxi** | Alerta de Aceite da Corrida | Push | 🔴 Crítico | < 3 segundos | O passageiro desiste da corrida pensando que não há motorista por perto. |
| **Ambulantes**| Mudança de Status do Pedido | Push / WhatsApp| 🟡 Alto | < 15 segundos | Cliente aguarda na areia da praia sem saber se o pedido foi aceito. |
| **Diaristas** | Confirmação de Agendamento | E-mail / Push | 🟡 Alto | < 5 minutos | Quebra de agenda e desencontro entre contratante e diarista. |
| **Côco & Cia**| Alerta de Proximidade Coleta | Push | 🟢 Médio | < 2 minutos | Morador perde o horário de passar o caminhão de lixo. |
| **Financeiro**| Código Pix Dinâmico | WhatsApp / SMS | 🔴 Crítico | < 5 segundos | O cliente desiste de pagar ou abandona o carrinho. |

---

## 4. Prontidão para Escala (Classificação)

*   **Classificação:** 🟡 **Pilot Ready**
*   **Justificativa:** A integração via Supabase Realtime in-app e os templates de e-mail e push via Firebase estão implementados e funcionais para testes. Contudo, a robustez da fila de contingência Pix via WhatsApp e a política de retentativa assíncrona automática em segundo plano precisam de testes de estresse em conexões móveis antes de ir para produção com alta carga.
