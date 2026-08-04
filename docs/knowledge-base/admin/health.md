# Ajuda Contextual — Central de Saúde (Health Center)

Este documento descreve as métricas e indicadores de monitoramento real-time e tolerância a falhas na Central de Saúde da Plataforma.

---

### Alertas Críticos (`admin.health.alertas_criticos`)

- **Descrição curta:** Total de alertas técnicos ou de negócio classificados como CRÍTICO.
- **O que significa:** Eventos anômalos que impedem o funcionamento correto de alguma área chave do aplicativo (ex: API de checkout fora do ar ou detecção de fraudes consecutivas).
- **Para que serve:** Disparar resposta emergencial e notificar os engenheiros de plantão de que uma falha severa está ocorrendo.
- **Como interpretar:** Deve ser idealmente zero. Qualquer valor maior que 1 representa um incidente ativo com impacto direto no usuário ou no faturamento.
- **Origem dos dados:** Tabela `public.health_alerts` com `status = 'active'` e `criticidade = 'CRITICA'`.
- **Quem normalmente utiliza:** Engenheiros de Confiabilidade (SRE), Administradores de Infraestrutura, Suporte Avançado.
- **Observações / limitações:** Pode ser gerado automaticamente por triggers no banco de dados ou monitoramento externo de batimento cardíaco (Heartbeat).

---

### Alertas Ativos (`admin.health.alertas_ativos`)

- **Descrição curta:** Quantidade de incidentes não resolvidos sob monitoramento.
- **O que significa:** O somatório de todos os incidentes abertos que ainda não foram marcados como resolvidos pelos operadores, independentemente da gravidade.
- **Para que serve:** Fornecer uma visão do backlog de problemas e erros não solucionados acumulados no BackOffice.
- **Como interpretar:** O aumento contínuo indica lentidão na resolução de problemas operacionais ou instabilidades sistêmicas persistentes.
- **Origem dos dados:** `COUNT` da tabela `public.health_alerts` filtrada por `status != 'resolved' AND status != 'ignored'`.
- **Quem normalmente utiliza:** Coordenadores de Operações, Líderes de Suporte e Administradores.

---

### Tempo Média Resolução (`admin.health.tempo_resolucao`)

- **Descrição curta:** Tempo médio dos operadores no fechamento de alertas do sistema.
- **O que significa:** O intervalo de tempo (em minutos) decorrido entre a criação do alerta e a marcação de resolução pelo operador.
- **Para que serve:** Medir o SLA (Service Level Agreement) e a eficiência do time operacional na triagem e correção de problemas.
- **Como interpretar:** Menores tempos de resolução indicam uma equipe ágil e processos eficientes de remediação.
- **Origem dos dados:** Calculado comparando `resolved_at` e `created_at` em registros da tabela `public.health_alerts` marcados como resolvidos hoje.
- **Quem normalmente utiliza:** Diretores de Operação, Gerente de Suporte.
- **Observações / limitações:** Apenas considera alertas encerrados. Se um incidente complexo demorar dias, ele só entrará na média quando for finalmente concluído.
