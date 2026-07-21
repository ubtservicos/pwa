# UBT SuperApp — Relatório de Auditoria: Telemetria & Rastreamento

**Data do Relatório:** 2026-07-15  
**Versão:** Telemetry Audit v1.0  
**Classificação:** Técnico / Segurança Interna  
**Autor:** Antigravity AI  

---

## 1. Tabelas de Telemetria e Amostragem

O rastreamento de rotas e telemetria operacional de prestadores ativos no UBT SuperApp está mapeado nas seguintes tabelas:

*   `public.pedidos` (Colunas `latitude`, `longitude` do prestador e tomador) ➔ Armazena a localização e destino de mototaxistas em corrida.
*   `public.ambulante_sessions` (Colunas `latitude`, `longitude` do carrinho) ➔ Armazena a geolocalização do ambulante em atividade de venda.
*   `public.coco_caminhoes` (Colunas `latitude`, `longitude` do caminhão) ➔ Acompanhamento do caminhão coletor de lixo reciclável.
*   `public.telemetry_raw_logs` (Nova tabela técnica) ➔ Histórico cru das coordenadas GPS transmitidas em segundo plano pelos dispositivos.

### Frequência de Coleta por Vertical
1.  **Mototáxi (Em trânsito):** A cada **10 segundos** (Amostragem alta para atualizar o trajeto no mapa com precisão de navegação).
2.  **Reciclagem (Caminhões):** A cada **15 segundos**.
3.  **Ambulantes (Sessão de vendas):** A cada **30 segundos** (Amostragem menor, pois caminham devagar ou operam de forma estática na areia).

---

## 2. Retenção de Dados e Custo Estimado

### 2.1 Política de Retenção de Coordenadas Raw
Para evitar saturação de disco no Supabase e atrito de privacidade:
*   **Dados Cruas (GPS Telemetry):** Excluídos automaticamente após **30 dias** por meio de um script programado (Supabase pg_cron) executando um purge na tabela `telemetry_raw_logs`.
*   **Rotas Consolidadas (Trajeto finalizado da corrida):** Armazenado como uma String comprimida de linha (Polilinha) na tabela `pedidos`, retida por **90 dias** para fins de auditoria financeira em caso de contestação de valor.
*   **Metadados de Distância (KM totais):** Armazenados de forma definitiva para relatórios de estatísticas do SuperApp.

### 2.2 Projeção de Custo Mensal Estimado (Base: 100 mil corridas/mês)
Calculado com base no tráfego de dados e queries de mapas:

*   **Banco de Dados Supabase (Ingestão e Armazenamento):**  
    100 mil corridas ➔ Média de 15 minutos por corrida ➔ 90 coordenadas por corrida ➔ 9 milhões de inserts/mês.  
    *Custo Estimado Supabase (Disco e CPU):* **US$ 25.00**
*   **Consumo de Provedor de Mapas (Google Places / Mapbox):**  
    Geocodificação reversa de endereços e renderização de mapas vetoriais.  
    *Custo Estimado Mapbox:* **US$ 120.00**
*   **Total de Custos de Telemetria:** ~**R$ 800,00 / mês**.

---

## 3. Conformidade LGPD e Auditoria Operacional

### 3.1 Políticas de Privacidade LGPD (Dados Locacionais)
> [!IMPORTANT]
> A localização em tempo real é considerada dado pessoal altamente sensível.
> 
> 1. **Consentimento Explícito:** O prestador e o cliente devem aceitar a permissão de rastreamento no momento do login.
> 2. **Rastreamento Condicional:** O envio de GPS deve ser encerrado e desativado imediatamente na saída do aplicativo, logoff ou término da corrida. Rastreamento em segundo plano sem serviço ativo é proibido.

### 3.2 Suporte Antifraude ("Ghost Rides")
O módulo de telemetria cruza as coordenadas GPS transmitidas pelo aplicativo do Mototaxista com a localização do dispositivo do Passageiro durante a corrida.
*   **Alerta de Divergência:** Se a distância física entre os dois aparelhos for superior a **100 metros** com a corrida em andamento, o sistema sinaliza como fraude em potencial ("Ghost Ride"). O faturamento é retido preventivamente para auditoria.
*   **Alerta de Velocidade Impossível:** Coordenadas indicando deslocamento de velocidade média superior a 120 km/h (indicação de carro/rodovia ou teletransporte fake de localização de desenvolvedor).

---

## 4. Nível de Prontidão (Classificação)

*   **Classificação:** 🟡 **Pilot Ready**
*   **Justificativa:** O rastreamento de coletas Côco & Cia Leaflet funciona perfeitamente. Contudo, o sistema de telemetria móvel em segundo plano (background tracking) em smartphones iOS/Android com economia de bateria e as políticas de detecção de fraudes in-app em tempo real exigem maturação durante a fase de piloto local em Ubatuba.
