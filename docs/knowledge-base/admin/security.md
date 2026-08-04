# Ajuda Contextual — Security Center (/admin/security)

Este documento detalha as métricas de conformidade e auditoria de segurança exibidas no painel Security Center.

---

### Security Score (`admin.security.score`)

- **Descrição curta:** Percentual geral de conformidade de segurança e políticas RLS.
- **O que significa:** Uma pontuação calculada com base na ativação de criptografia, conformidade de políticas RLS em tabelas críticas, pendências de KYC e logs de auditoria válidos.
- **Para que serve:** Prover uma métrica de alto nível sobre a postura geral de segurança e privacidade (LGPD) do SuperApp.
- **Como interpretar:** O ideal é manter a pontuação sempre acima de 90%. Quedas indicam a criação de novas tabelas sem RLS habilitado ou falhas na verificação de novos prestadores (KYC).
- **Origem dos dados:** Calculado em lote pela lógica interna do painel analisando configurações de RLS do banco de dados e dados de segurança agregados.
- **Quem normalmente utiliza:** Engenheiros de Segurança, DPO.
- **Observações / limitações:** É uma pontuação paramétrica de conformidade, devendo ser cruzada com testes de invasão e relatórios de auditoria externos.

---

### Riscos Críticos (`admin.security.riscos_criticos`)

- **Descrição curta:** Riscos de alta gravidade descobertos no banco ou API sem resolução.
- **O que significa:** O total de ameaças operacionais ou técnicas não mitigadas na infraestrutura (como tabelas do Supabase expostas sem autenticação, ou múltiplos acessos administrativos de IPs desconhecidos).
- **Para que serve:** Chamar atenção imediata dos administradores para vulnerabilidades de segurança que requerem patch ou correção rápida.
- **Como interpretar:** Deve ser zero. Qualquer valor acima disso representa um ponto de falha ou vulnerabilidade ativa que deve ser corrigida imediatamente.
- **Origem dos dados:** Tabela `public.security_findings` com severidade alta/crítica e status não resolvido.
- **Quem normalmente utiliza:** Equipe de Infraestrutura e Red Team de Segurança.
