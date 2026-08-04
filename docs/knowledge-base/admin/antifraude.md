# Ajuda Contextual — Antifraude Operacional (/admin/antifraude)

Este documento descreve os mecanismos de segurança e contingenciamento aplicados no monitoramento de riscos.

---

### Críticos Pendentes (`admin.antifraude.criticos_pendentes`)

- **Descrição curta:** Alertas pendentes de fraude com bloqueio preventivo de repasses.
- **O que significa:** O número de motoristas, diaristas ou usuários com suspeitas graves de fraude operacional (como lavagem de cartão, chargebacks recorrentes ou abuso de geolocalização) cujos saques e repasses financeiros foram preventivamente retidos pela plataforma.
- **Para que serve:** Proteger o caixa da UBT contra perdas financeiras iminentes e chargebacks de cartões clonados enquanto os casos são investigados.
- **Como interpretar:** O ideal é manter este número o mais baixo possível através de revisões diárias. Cada pendência representa um prestador de serviço com a conta bloqueada aguardando avaliação do moderador.
- **Origem dos dados:** Tabela `public.telemetry_flags` ou `public.usuarios` onde o status é `under_review` ou há flags de risco graves não resolvidas.
- **Quem normalmente utiliza:** Analistas de Compliance Financeiro, Moderadores de Risco.
- **Observações / limitações:** O bloqueio preventivo de saques é uma medida extrema e reversível, devendo ser conduzido com rapidez para evitar fricções com prestadores honestos.
