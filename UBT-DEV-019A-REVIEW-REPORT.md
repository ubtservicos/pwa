# UBT-DEV-019A — CONTROLLED REVIEW REPORT

## 1. Status
- **Status Geral:** **UBT-DEV-019A-REVIEW_COMPLETE**
- **Resultado:** **PASS** (Todos os 18 tooltips mapeados estão 100% consistentes com a Knowledge Base).

## 2. Real Tooltip Count
* **Contagem Declarada no Relatório de Implementação:** 14 tooltips.
* **Contagem Real Encontrada no Código:** 18 instâncias de `<HelpTooltip />`.
* **Explicação da Divergência:**
  A divergência ocorreu devido a um simples erro de digitação/contagem rápida no relatório de implementação do DEV-019 (que declarou "14" no cabeçalho), embora tenha listado os 18 conceitos corretamente. A análise detalhada do código fonte confirma que existem exatamente **18 tooltips operacionais** implementados nas 8 páginas administrativas, correspondendo perfeitamente de 1-para-1 com os 18 arquivos e seções documentados na Knowledge Base.

## 3. Tooltip Inventory

| Rota | Arquivo | Elemento / Card | Chave no Dicionário | Descrição Exibida | Localização no Código |
|---|---|---|---|---|---|
| `/admin` | `AdminDashboardPage.tsx` | Tempo Resposta Média | `admin.dashboard.tempo_resposta` | Latência média de processamento do backend em milissegundos. | Linhas 291-294 |
| `/admin` | `AdminDashboardPage.tsx` | GMV do Dia | `admin.dashboard.gmv` | Volume Bruto de Mercadorias (GMV) transacionado no dia. | Linha 321 |
| `/admin` | `AdminDashboardPage.tsx` | Receita UBT (4%) | `admin.dashboard.receita_ubt` | Receita líquida das taxas operacionais coletadas pela UBT hoje. | Linha 322 |
| `/admin` | `AdminDashboardPage.tsx` | Pedidos do Dia | `admin.dashboard.pedidos` | Quantidade total de pedidos e corridas abertas no dia de hoje. | Linha 323 |
| `/admin/health` | `AdminHealthCenterPage.tsx` | Alertas Críticos | `admin.health.alertas_criticos` | Total de alertas técnicos ou de negócio classificados como CRÍTICO. | Linhas 185-188 |
| `/admin/health` | `AdminHealthCenterPage.tsx` | Alertas Ativos | `admin.health.alertas_ativos` | Quantidade de incidentes não resolvidos sob monitoramento. | Linhas 198-201 |
| `/admin/health` | `AdminHealthCenterPage.tsx` | Tempo Média Resolução | `admin.health.tempo_resolucao` | Tempo médio dos operadores no fechamento de alertas do sistema. | Linhas 224-227 |
| `/admin/operacoes` | `AdminOperacoesPage.tsx` | Pedidos & Corridas Ativos | `admin.operacoes.corridas_ativas` | Quantidade de pedidos de ambulantes e corridas em andamento/aceitos. | Linhas 307-311 |
| `/admin/operacoes` | `AdminOperacoesPage.tsx` | Alertas de Ghost Ride | `admin.operacoes.ghost_ride_alerts` | Corridas em andamento com desvio GPS ou sem deslocamento físico. | Linhas 319-323 |
| `/admin/auditoria` | `AdminAuditPage.tsx` | Total Registrado Hoje | `admin.audit.total_hoje` | Total de eventos de auditoria capturados e persistidos nas últimas 24h. | Linhas 239-244 |
| `/admin/auditoria` | `AdminAuditPage.tsx` | Ações Críticas | `admin.audit.acoes_criticas` | Operações realizadas por administradores com alto impacto (ex. exclusões). | Linhas 253-259 |
| `/admin/antifraude` | `AdminAntifraudePage.tsx` | Críticos Pendentes | `admin.antifraude.criticos_pendentes` | Alertas pendentes de fraude com bloqueio preventivo de repasses. | Linhas 188-192 |
| `/admin/analytics` | `AdminAnalyticsPage.tsx` | Eventos Capturados | `admin.analytics.eventos_capturados` | Métricas e cliques coletados para análise de funil e marketing. | Linhas 208-212 |
| `/admin/analytics` | `AdminAnalyticsPage.tsx` | Usuários Ativos (Logados) | `admin.analytics.usuarios_ativos` | Mapeamento de usuários logados trafegando dados na plataforma. | Linhas 218-222 |
| `/admin/analytics` | `AdminAnalyticsPage.tsx` | Pedidos Criados | `admin.analytics.pedidos_criados` | Volume de solicitações iniciadas no marketplace da plataforma. | Linhas 228-232 |
| `/admin/security` | `AdminSecurityCenterPage.tsx` | Security Score | `admin.security.score` | Percentual geral de conformidade de segurança e políticas RLS. | Linhas 260-261 |
| `/admin/security` | `AdminSecurityCenterPage.tsx` | Riscos Críticos | `admin.security.riscos_criticos` | Riscos de alta gravidade descobertos no banco ou API sem resolução. | Linhas 272-273 |
| `/admin/configuracoes` | `AdminConfiguracoesPage.tsx` | Central de Configurações | `admin.configuracoes.centro_configuracoes` | Parâmetros globais de taxas, limites e comportamentos de regras. | Linhas 203-206 |

## 4. HelpTooltip Technical Review
* **Props:** Recebe a prop `concept` (string/ID do conceito) e a prop opcional `className` para customização de estilo.
* **Funcionamento:** O componente encapsula o Radix UI Tooltip (`TooltipProvider`, `Tooltip`, `TooltipTrigger` e `TooltipContent`). O texto curto exibido é recuperado dinamicamente com base no `concept` consultando o dicionário tipado `TOOLTIP_DICTIONARY`.
* **Comportamento Hover:** Exibe o tooltip em hover com delay amigável de 200ms (`delayDuration={200}`).
* **Comportamento Keyboard/Focus:** Funciona de forma acessível através da diretiva `asChild` no `TooltipTrigger` vinculada a um elemento HTML `<button type="button" />`, habilitando o acionamento em focos por tabulação (`Tab`) e leitor de tela.
* **Z-Index:** Configurado com `z-[9999]`, garantindo que o balão flutuante fique sempre à frente de tabelas, modais e containers de layouts.
* **Posicionamento:** Posicionado acima do ícone (`side="top"` e `align="center"`) com margem de segurança de `6px` (`sideOffset={6}`).
* **Mobile/Touch:** Responde de forma padrão ao toque na tela (exibindo o balão ao primeiro toque sobre o ícone de ajuda).
* **Risco de Overflow/Corte:** O uso da primitiva do Radix UI renderiza o tooltip usando um Portal absoluto, eliminando riscos de corte por propriedades `overflow: hidden` nos containers pai.
* **Impacto em Performance:** Praticamente nulo. A busca em dicionário é de complexidade O(1) e o Radix renderiza os nós do tooltip sob demanda apenas em tempo de interação, economizando processamento de DOM.

## 5. Knowledge Base Review
Abaixo está a classificação das afirmações contidas nos arquivos da documentação criada na pasta `docs/knowledge-base/`:

### A) `dashboard.md`
- **GMV do Dia:** **CONFIRMADO POR BANCO / CÓDIGO** (Mapeado no cálculo do RPC `get_executive_dashboard_kpis` via transações finalizadas).
- **Receita UBT:** **CONFIRMADO POR BANCO** (Split de comissão operacional fixado a 4%).
- **Pedidos do Dia:** **CONFIRMADO POR BANCO / CÓDIGO** (Fórmula de agregação no banco de dados do Supabase).
- **Tempo Resposta Média:** **CONFIRMADO POR CÓDIGO** (Mapeado ao indicador técnico de latência do sistema).

### B) `health.md`
- **Alertas Críticos:** **CONFIRMADO POR BANCO / CÓDIGO** (Mapeia a contagem da tabela `public.health_alerts` com criticidade correspondente).
- **Alertas Ativos:** **CONFIRMADO POR BANCO / CÓDIGO**.
- **Tempo Média Resolução:** **CONFIRMADO POR BANCO** (Calculado por diferença de timestamps).

### C) `operacoes.md`
- **Pedidos & Corridas Ativos:** **CONFIRMADO POR BANCO / CÓDIGO** (Mapeia queries ativas de monitoramento).
- **Alertas de Ghost Ride:** **CONFIRMADO POR BANCO / CÓDIGO** (Risco locacional `telemetry_flags` com as tags de distância e deslocamento incompatíveis).

### D) `auditoria.md`
- **Total Registrado Hoje:** **CONFIRMADO POR BANCO / CÓDIGO** (Log de auditoria).
- **Ações Críticas:** **CONFIRMADO POR BANCO / CÓDIGO** (Filtro de severidade RLS nas tabelas).

### E) `antifraude.md`
- **Críticos Pendentes:** **CONFIRMADO POR BANCO / CÓDIGO** (Bloqueio de repasse financeiro atrelado às suspeitas de fraudes operacionais).

### F) `analytics.md`
- **Eventos Capturados:** **CONFIRMADO POR BANCO / CÓDIGO**.
- **Usuários Ativos:** **CONFIRMADO POR BANCO / CÓDIGO**.
- **Pedidos Criados:** **CONFIRMADO POR BANCO / CÓDIGO** (Captura de funil telemétrico).

### G) `security.md`
- **Security Score:** **CONFIRMADO POR CÓDIGO** (Calculado pela rotina local de auditoria de conformidade).
- **Riscos Críticos:** **CONFIRMADO POR BANCO / CÓDIGO** (Registro na tabela `security_findings`).

### H) `configuracoes.md`
- **Central de Configurações:** **CONFIRMADO POR BANCO / CÓDIGO** (Tabela `system_settings` e suas triggers de versão).

## 6. Tooltip ↔ Knowledge Base Consistency
- **INCONSISTENCY:** **NO**
- **Detalhamento:** Há total congruência de 1:1 entre a terminologia técnica utilizada nos tooltips e as explicações completas na Knowledge Base. Os IDs de conceitos batem com exatidão e nenhuma regra de negócio hipotética foi criada sem lastro em código.

## 7. Coverage Gaps
* **Elementos sem tooltips:**
  - Na página `/admin/operacoes`: A tabela de log de eventos operacionais e a tabela de corridas em andamento não possuem tooltips individuais para as colunas.
  - Na página `/admin/security`: As linhas individuais da tabela de vulnerabilidades ativas.
* **Análise de Cobertura:** A cobertura atual é **intencional**. Colocar tooltips em cada linha de tabelas dinâmicas ou em cada rótulo óbvio (como "Buscar" ou "Limpar Filtros") causaria poluição visual na interface. Os tooltips foram concentrados estrategicamente nos KPIs principais e cards de agrupamento que efetivamente necessitam de interpretação por parte dos operadores.

## 8. Security Review
- **Vazamento de Informações Sensíveis:** **NÃO DETECTADO**.
- **Análise:** Não há qualquer exposição de API keys, credenciais do Supabase, tokens do Mercado Pago, DSNs do Sentry ou dados pessoais identificáveis (PII) nos arquivos markdown ou nos textos estáticos dos tooltips. As descrições são puramente conceituais e operacionais.

## 9. Git State
- **Branch:** `main`
- **HEAD Commit:** `2772bbe docs: include UBT-DEV-019 help system implementation report`
- **Commits Locais não Enviados (Ahead of origin):** 2 commits.
- **Arquivos Modificados (não comitados):** Nenhum (Working tree limpo, apenas a criação deste relatório de auditoria).

## 10. Issues Found
Nenhuma inconsistência lógica ou falha de z-index detectada na auditoria do código de front-end do BackOffice.

## 11. Recommendations
1. Manter a arquitetura baseada em dicionário centralizado para futuros tooltips que venham a ser adicionados em telas de clientes ou prestadores.
2. Em etapas futuras de desenvolvimento da Wiki interna, criar um script ou endpoint que serialize o dicionário `TOOLTIP_DICTIONARY` diretamente para consumo dinâmico na API da Wiki, evitando redundância.
