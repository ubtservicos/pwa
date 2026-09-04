# Backlog & Dívidas Técnicas — UBT SuperApp

Este documento centraliza as pendências técnicas, melhorias de infraestrutura e itens de débito técnico identificados durante os ciclos de desenvolvimento e homologação.

---

## 🛠️ Infraestrutura & Back-end

- [ ] **Mensageria (Última Milha)**: Inserir chaves de API externas (`RESEND_API_KEY`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `TWILIO_ACCOUNT_SID`, etc.) nos Secrets do Supabase para destravar a entrega real da Edge Function `omnichannel-answer-engine`.
- [ ] **Rate Limiting & Telemetria**: Adicionar limites de frequência por IP/usuário nas rotas públicas de edge functions.

---

## 💻 Front-end & UX

- [ ] **Code Splitting**: Aplicar `React.lazy` nas rotas do painel administrativo para reduzir o bundle inicial abaixo de 500 kB.
- [ ] **Offline First**: Melhorar caching de assets estáticos no Service Worker para áreas com sinal intermitente em Ubatuba.

---

## 🔒 Segurança & Compliance

- [ ] **Auditoria de Secrets Periódica**: Rotação das chaves de criptografia e HMAC dos webhooks transacionais.
