# Ajuda Contextual — Dashboard Principal (/admin)

Este documento descreve as métricas e indicadores de monitoramento real-time exibidos no Dashboard Executivo do BackOffice.

---

### GMV do Dia (`admin.dashboard.gmv`)

- **Descrição curta:** Volume Bruto de Mercadorias transacionado no dia.
- **O que significa:** O montante financeiro total movimentado em transações comerciais na plataforma UBT (corridas de mototáxi, pedidos de coco, agendamentos de diaristas).
- **Para que serve:** Medir o volume bruto total de circulação econômica do ecossistema no dia de hoje.
- **Como interpretar:** Valores altos indicam forte atividade transacional. Quedas abruptly indicam desaceleração de contratações ou instabilidades de processamento de checkout.
- **Origem dos dados:** Consulta agregada da tabela `public.payments` onde a data do pagamento é igual ao dia atual (`now()`) e o status é aprovado/concluído.
- **Quem normalmente utiliza:** Administradores, Diretores Operacionais, Financeiro.
- **Observações / limitações:** Não desconta estornos, taxas da processadora ou repasses (splits). É o volume financeiro bruto.

---

### Receita UBT (`admin.dashboard.receita_ubt`)

- **Descrição curta:** Receita líquida das taxas operacionais coletadas pela UBT hoje.
- **O que significa:** O percentual (por padrão 4%) que a UBT retém de cada pagamento de transações concluídas como taxa de serviço da plataforma.
- **Para que serve:** Acompanhar a rentabilidade operacional direta do marketplace da UBT em tempo real.
- **Como interpretar:** Diretamente proporcional ao GMV do dia. Mostra a receita líquida gerada para a empresa antes de custos com infraestrutura.
- **Origem dos dados:** Agrupamento das transações de `public.pagamentos_split` (ou percentual calculado em cima da tabela de pagamentos aprovados).
- **Quem normalmente utiliza:** Financeiro, Diretores e Investidores.
- **Observações / limitações:** O valor está atrelado às configurações de split ativo na data de hoje.

---

### Pedidos do Dia (`admin.dashboard.pedidos`)

- **Descrição curta:** Quantidade total de pedidos e corridas abertas no dia de hoje.
- **O que significa:** O total consolidado de ordens de serviço geradas nas verticais do SuperApp.
- **Para que serve:** Acompanhar o fluxo físico de transações operacionais do dia, independentemente do valor financeiro de cada uma.
- **Como interpretar:** Mede o engajamento e a volumetria de uso dos clientes na contratação de mototáxis, diaristas e ambulantes.
- **Origem dos dados:** Contagem (`COUNT`) de registros na tabela `public.pedidos` e `public.mototaxi_corridas` com timestamp no dia de hoje.
- **Quem normalmente utiliza:** Operadores de BackOffice, Equipes de Atendimento e Suporte.

---

### Tempo Resposta Média (`admin.dashboard.tempo_resposta`)

- **Descrição curta:** Latência média de processamento do backend em milissegundos.
- **O que significa:** O tempo que o servidor de banco de dados e as Edge Functions do Supabase demoram para processar requisições em média.
- **Para que serve:** Monitorar a performance técnica, gargalos e lentidões na infraestrutura de servidores.
- **Como interpretar:** Valores abaixo de 200ms representam ótimo desempenho. Acima de 500ms requer monitoramento de infraestrutura para verificar queries lentas ou gargalo de conexões.
- **Origem dos dados:** Calculado em tempo real por scripts de monitoramento de saúde ou através de log de latências em `public.system_logs`.
- **Quem normalmente utiliza:** Engenheiros de Software, DevOps e administradores de infraestrutura.
