# Audit 04 — Autonomous Services & Engines Architecture

Este documento registra a análise técnica dos motores e serviços autônomos que operam em segundo plano (background) no PWA da UBT para gerenciar geolocalização, resiliência a falhas, certificações E2E e testes de integridade da qualidade.

---

## 1. Mapeamento de Serviços Autônomos

### 1.1. Geolocalização e Geofencing
* **Arquivos:** [`geoService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/lib/geoService.ts) e [`GeofenceService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/GeofenceService.ts)
* **Responsabilidade Principal:**
  - **Normalização de Textos:** Padroniza a grafia de vias públicas brasileiras (ex: "R." ou "rua" vira "rua").
  - **Mecanismo de Cache Híbrido:** Reduz latência salvando resultados geograficamente válidos localmente (memória RAM e `localStorage`) e remotamente no Supabase (`endereco_cache`).
  - **Geocodificação Direta/Reversa:** Resolve strings de endereço em coordenadas (latitude/longitude) combinando provedores secundários em caso de falha.
  - **Ray-Casting Geofencing:** Aplica algoritmo matemático (Ponto em Polígono) sobre a coordenada resolvida para verificar se ela se localiza dentro do polígono limítrofe do município de Ubatuba-SP.
  - **Validação de CEP:** Valida se o CEP está na faixa oficial de Ubatuba (11680-000 a 11699-999).
* **Gatilhos (Triggers):** Executado dinamicamente durante digitação em campos de endereço (Cadastro/Waitlist, Busca de Diaristas, Georreferenciamento de Corrida).
* **Integrações Externas:**
  - **Nominatim (OpenStreetMap):** Provedor inicial gratuito.
  - **Mapbox Geocoding API / Google Maps Geocoding API:** Provedores de geolocalização pagos.
  - **Supabase DB:** Grava e busca no cache remoto e insere métricas de performance em `geocoding_metrics`.

### 1.2. Certificação E2E Automatizada
* **Arquivo:** [`E2ECertificationService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/E2ECertificationService.ts)
* **Responsabilidade Principal:** Rodar uma suíte abrangente de testes operacionais diretamente contra as APIs e políticas de banco de dados do Supabase. Verifica o status do Supabase Auth, as políticas RLS na gravação de consentimentos LGPD, filas de análise KYC de prestadores, gravação de logs de auditoria e cálculo de split.
* **Gatilhos (Triggers):** Disparado sob demanda pelo administrador no painel Backoffice / Quality Center.
* **Integrações Externas:**
  - **Supabase Auth / Storage / DB:** Comunicação direta para validação de credenciais, listagem de buckets e chamadas de RPCs administrativas.
  - **ResilienceService & SettingsService:** Avalia e testa limites de resiliência e parâmetros de sistema.

### 1.3. Motor de Resiliência (Circuit Breaker)
* **Arquivo:** [`ResilienceService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/ResilienceService.ts)
* **Responsabilidade Principal:**
  - **Circuit Breaker:** Monitora e isola conexões com microsserviços integrados para evitar travamentos em cascata. Mapeia estados: `CLOSED` (serviço operando normalmente), `OPEN` (bloqueio temporário devido a erros consecutivos) e `HALF_OPEN` (modo de teste após tempo de cooldown).
  - **Timeout e Auto-Retry:** Executa tentativas adicionais automáticas para APIs instáveis (ex: Mapbox, Google Maps).
  - **Trava Financeira:** A propriedade `allowAutoRetry` é forçada estritamente como **false** para operações financeiras no Mercado Pago, garantindo que requisições de pagamento falhas nunca sejam refeitas automaticamente pelo cliente, o que causaria cobranças duplicadas.
  - **Alertas de Saúde:** Insere registros em `health_alerts` no banco de dados quando um circuito de integração é aberto por falhas graves.
* **Gatilhos (Triggers):** Roda de forma contínua interceptando qualquer chamada de integração de terceiros encapsulada pelo serviço.
* **Integrações Externas:** Interceptação ativa das integrações Mercado Pago, Google Maps, Mapbox, WhatsApp/Resend, Supabase Realtime e Supabase Storage.

### 1.4. Diagnóstico e Centro de Qualidade
* **Arquivo:** [`QualityRunnerService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/QualityRunnerService.ts)
* **Responsabilidade Principal:** Validar a saúde geral da infraestrutura e dos dados. Executa queries e invoca procedimentos armazenados (RPCs) no PostgreSQL para calcular KPIs executivos, obter contagens de registros ativos nas verticais de serviço (mototáxi, ambulantes, diaristas), monitorar canais de transmissão do Realtime e verificar a integridade da matriz de permissões RBAC.
* **Gatilhos (Triggers):** Disparado em segundo plano periodicamente ou de forma manual através do painel Backoffice / Health Center.
* **Integrações Externas:** Supabase DB, conexões WebSocket de canais Realtime e buckets de Storage.
