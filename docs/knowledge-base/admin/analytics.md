# Ajuda Contextual — Analytics & Funis (/admin/analytics)

Este documento descreve as métricas de telemetria de fluxo e conversão de usuários coletadas pelo sistema de Analytics da UBT.

---

### Eventos Capturados (`admin.analytics.eventos_capturados`)

- **Descrição curta:** Métricas e cliques coletados para análise de funil e marketing.
- **O que significa:** O volume bruto de interações registradas no SuperApp, tais como abertura de telas, cliques em CTAs, início de cadastros e finalização de checkouts.
- **Para que serve:** Subsediar análises de comportamento do usuário, performance de campanhas de marketing (UTMs) e taxas de conversão de funil.
- **Como interpretar:** Permite identificar gargalos de usabilidade (por exemplo, alto número de cadastros iniciados mas poucos finalizados).
- **Origem dos dados:** Tabela `public.analytics_events` no período e filtros configurados na tela.
- **Quem normalmente utiliza:** Equipes de Marketing, UX Designers, Gestores de Produto.
- **Observações / limitações:** Os dados de analytics respeitam estritamente a LGPD, sendo coletados de forma anônima para visitantes e pseudonimizada para usuários logados.

---

### Usuários Ativos (`admin.analytics.usuarios_ativos`)

- **Descrição curta:** Mapeamento de usuários logados trafegando dados na plataforma.
- **O que significa:** A quantidade de identificadores de usuários únicos que realizaram pelo menos um evento telemétrico registrado no período selecionado.
- **Para que serve:** Medir o engajamento diário (DAU) e mensal (MAU) real dos usuários da UBT.
- **Como interpretar:** O crescimento desta métrica indica maior adoção e fidelização dos clientes e prestadores no marketplace.
- **Origem dos dados:** Agrupamento de `user_id` únicos na tabela `public.analytics_events`.
- **Quem normalmente utiliza:** Gerentes de Produto, Growth Hackers.

---

### Pedidos Criados (`admin.analytics.pedidos_criados`)

- **Descrição curta:** Volume de solicitações iniciadas no marketplace da plataforma.
- **O que significa:** A contagem de eventos correspondentes ao início de uma solicitação de corrida ou compra no ecossistema UBT.
- **Para que serve:** Acompanhar a intenção de compra ativa dos usuários no período selecionado.
- **Como interpretar:** Comparado com o total de pedidos pagos, ajuda a determinar a taxa de conversão final do funil de vendas.
- **Origem dos dados:** Registros na tabela `public.analytics_events` com o nome de evento `request_created`.
- **Quem normalmente utiliza:** Equipes de Produto, Gestores de Negócio.
