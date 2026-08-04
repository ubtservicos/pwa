# Ajuda Contextual — Operações & Geolocalização (/admin/operacoes)

Este documento detalha os KPIs e fluxos geográficos monitorados em tempo real na tela de Operações do BackOffice.

---

### Pedidos & Corridas Ativos (`admin.operacoes.corridas_ativas`)

- **Descrição curta:** Quantidade de pedidos de ambulantes e corridas em andamento/aceitos.
- **O que significa:** O volume total de transações de marketplace da plataforma que estão nas fases de solicitação, preparo, deslocamento físico ou atendimento.
- **Para que serve:** Monitorar a carga transacional e a saturação de prestadores ativos nas ruas de Ubatuba.
- **Como interpretar:** Permite identificar gargalos de demanda (muitas corridas ativas sem motorista disponível) ou picos de tráfego.
- **Origem dos dados:** Consulta realtime das tabelas `public.pedidos` (status pendente/preparo) e `public.mototaxi_corridas` (status ativo/deslocamento).
- **Quem normalmente utiliza:** Operadores de Logística, Fiscais de Rota, Suporte.

---

### Alertas de Ghost Ride (`admin.operacoes.ghost_ride_alerts`)

- **Descrição curta:** Corridas em andamento com desvio GPS ou sem deslocamento físico.
- **O que significa:** Corridas de mototáxi marcadas preventivamente pelo algoritmo de geofencing com nível de risco médio ou alto.
- **Para que serve:** Prevenir a fraude do "Ghost Ride" (corrida fantasma), em que motorista e passageiro simulam uma viagem falsa na interface para lavar cupons de desconto ou bater metas artificiais.
- **Como interpretar:** O aumento de alertas indica possíveis tentativas de fraude organizada nas rotas. Requer auditoria manual do trajeto GPS.
- **Origem dos dados:** Tabela `public.mototaxi_corridas` filtrada por `risk_level IN ('risk_high', 'risk_medium')`.
- **Quem normalmente utiliza:** Analistas de Risco, Moderadores de Segurança.
- **Observações / limitações:** Pode gerar falsos positivos se o aparelho do motorista perder conexão GPS temporariamente ou trafegar em túneis e áreas de sombra de sinal.
