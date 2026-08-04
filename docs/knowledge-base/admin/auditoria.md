# Ajuda Contextual — Logs de Auditoria (/admin/auditoria)

Este documento detalha o monitoramento e conformidade de ações administrativas rastreadas na trilha de auditoria.

---

### Total Registrado Hoje (`admin.audit.total_hoje`)

- **Descrição curta:** Total de eventos de auditoria capturados e persistidos nas últimas 24h.
- **O que significa:** O somatório de todos os registros de logs de auditoria administrativa inseridos no dia corrente.
- **Para que serve:** Verificar a integridade e a volumetria de ações administrativas realizadas em todos os painéis.
- **Como interpretar:** Flutua de acordo com o número de ações manuais feitas por operadores (aprovações de KYC, alterações de regras, configurações).
- **Origem dos dados:** Tabela `public.admin_audit_logs` ou `public.admin_logs` filtrada pelas últimas 24 horas.
- **Quem normalmente utiliza:** Auditores de Compliance, Administradores, Segurança da Informação.
- **Observações / limitações:** Os registros são gravados de forma imutável (RLS bloqueia UPDATE e DELETE).

---

### Ações Críticas (`admin.audit.acoes_criticas`)

- **Descrição curta:** Operações realizadas por administradores com alto impacto (ex. exclusões).
- **O que significa:** Ações que modificam diretamente privilégios de usuários, executam exclusões nos termos da LGPD, estornam grandes quantias financeiras ou revertem parâmetros globais.
- **Para que serve:** Prover rastreabilidade absoluta e prevenir o abuso de privilégios ou o vazamento de credenciais administrativas.
- **Como interpretar:** Deve ser monitorado de perto. Picos de ações críticas fora do horário comercial devem disparar investigação de segurança.
- **Origem dos dados:** Tabela `public.admin_audit_logs` filtrada por `criticidade IN ('ALTA', 'CRITICA')`.
- **Quem normalmente utiliza:** DPO (Data Protection Officer), Gerente de Segurança.
