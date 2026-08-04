# UBT-WIKI-ENG-001 — TECHNICAL INVENTORY

## 1. Identificação
- **Data/Hora:** 2026-08-04T19:30:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Autor:** Antigravity (AI Coding Assistant)
- **Status:** **UBT-WIKI-ENG-001-TECHNICAL-INVENTORY_COMPLETE**

## 2. Metodologia e Fontes
Este levantamento técnico factual foi gerado exclusivamente a partir da inspeção direta da árvore de diretórios local, do código-fonte do frontend React/TypeScript, das rotas declaradas em `App.tsx`, da catalogação de tabelas no banco de dados Supabase de produção (via consultas PostgreSQL) e da análise do repositório de Edge Functions e arquivos de migração.

---

## 3. Arquitetura

### A) Frontend
- **Framework:** React 18.3.1 (Vite Single Page Application).
- **Linguagem:** TypeScript 5.5.
- **Bundler:** Vite v5.4.21.
- **Bibliotecas Relevantes:** Tailwind CSS (estilização), Lucide React (ícones), Radix UI (primitivas de interface/tooltips), React Router DOM (roteamento SPA), Supabase JS Client (conexão com o banco).
- **Gerenciamento de Estado:** Contextos customizados (`RideProvider`, `AmbulantePedidoProvider`), QueryClient (TanStack Query v5).
- **Service Worker:** Implementado em `public/sw.js` interceptando requisições locais com bypass explícito para rotas de subdomínios do Supabase (`supabase.co`).
- **PWA:** Ativo via `manifest.json` com suporte a execução offline e instalação em desktop/mobile.

### B) Backend
- **Framework de Banco/API:** Supabase (PostgREST para geração automática de APIs REST).
- **Banco de Dados:** PostgreSQL 15.
- **Edge Functions:** Deno runtime (servidas via Supabase Functions).
- **RPCs:** Rotinas em PL/pgSQL encapsulando relatórios operacionais complexos (ex: `get_executive_dashboard_kpis` e `get_health_center_summary`).

### C) Infraestrutura
- **Frontend Hosting:** Vercel (`ubtservicos.vercel.app`).
- **Database & API Gateway:** Supabase (`xqujubbqcfqxkfczbidq`).
- **Observabilidade:** Sentry (captura de exceções e erros de performance de frontend).
- **Versionamento:** GitHub (repositório privado hospedando o código fonte da aplicação).

---

## 4. Rotas
Mapeadas **74 rotas** ativas declaradas no arquivo [src/App.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx):

- **Rotas Públicas / Autenticação (6 rotas):**
  - `/` -> Landing Page principal (`Index.tsx`)
  - `/experience` -> Documentário Interativo (`ConceptExperience.tsx`)
  - `/login` -> Login do usuário comum (`Login.tsx`)
  - `/cadastro` -> Cadastro de clientes (`Cadastro.tsx`)
  - `/recuperar-senha` -> Fluxo de senha (`RecuperarSenha.tsx`)
  - `/app/consentimento` -> Aceite de LGPD obrigatório (`LgpdConsentPage.tsx`)

- **Rotas sob Proteção LGPD / Usuários & Prestadores (35 rotas):**
  - `/app/home` -> Dashboard principal de serviços
  - `/app/mototaxi` -> Solicitação de corridas
  - `/app/prestador/home` -> Painel do motorista/diarista
  - `/app/prestador/mototaxi/onboarding`, `/online`, `/active` -> Fluxos de corrida do mototaxista
  - `/app/ambulantes`, `/carrinho`, `/pedido/:id`, `/:sessionId` -> Fluxos do marketplace de ambulantes
  - `/app/prestador/ambulantes/onboarding`, `/online`, `/pedido/:id` -> Gerenciamento de carrinho de ambulante
  - `/app/diaristas`, `/agendar/:prestadorId`, `/agendamento/:id`, `/:prestadorId` -> Fluxos do marketplace de diaristas
  - `/app/prestador/diaristas/onboarding`, `/agenda`, `/servico/:id` -> Agenda e diária da diarista prestadora
  - `/app/config/*` (9 rotas) -> Configurações de perfil, segurança, acessibilidade, ajuda e privacidade
  - `/app/coco`, `/app/prestador/coco/onboarding`, `/online` -> Controle de descarte reciclável (Côco & Cia)
  - `/app/gerenciar`, `/app/gerenciar/transacao/:id` -> Extrato e histórico financeiro de transações

- **Rotas sob Proteção Admin (33 rotas):**
  - `/admin/login` -> Login administrativo sem layout compartilhado
  - `/admin` -> Centro de Controle Operacional (Executive Dashboard)
  - `/admin/clientes`, `/admin/clientes/:id` -> Gerenciamento de clientes e bloqueios
  - `/admin/kyc/:id`, `/admin/kyc-pendentes` -> Validação de documentos de prestadores
  - `/admin/financeiro`, `/admin/payments`, `/admin/payouts`, `/admin/split`, `/admin/refunds` -> Painéis financeiros e repasses
  - `/admin/disputes`, `/admin/cancellations` -> Gestão de estornos, contestações e abusos operacionais
  - `/admin/operacoes` -> Central de Operações e Geolocalização (Ghost Ride)
  - `/admin/lgpd` -> Auditoria de exclusão e portabilidade de dados
  - `/admin/auditoria` -> Trilha de auditoria administrativa imutável (RLS bloqueado)
  - `/admin/antifraude` -> Alertas de telemetria e segurança operacional
  - `/admin/analytics` -> Captura de eventos e análise de funis
  - `/admin/health` -> Central de Saúde e Circuit Breakers
  - `/admin/permissoes` -> Painel de RBAC de operadores
  - `/admin/configuracoes` -> Central de Parâmetros de Configuração
  - `/admin/quality` -> Relatórios e execuções de testes automáticos
  - `/admin/security` -> Diagnósticos de RLS e postura de segurança do Supabase
  - `/admin/waitlist` -> Gestão de leads cadastrados na lista de espera
  - `/admin/sorteio/1-5`, `/admin/sorteio/1-11` -> Sorteios e promoções internas
  - `/admin/entidades`, `/admin/preco` -> Cadastro de tabelas auxiliares de precificação
  - `/admin/arbitragem`, `/admin/conteudo`, `/admin/coco`, `/admin/diaristas` -> BackOffice de verticais e gestão

---

## 5. Funcionalidades
Catalogadas **11 funcionalidades** centrais da plataforma e classificadas de acordo com as regras factuais:

1. **Cadastro na Lista de Espera (Waitlist):**
   - *Status:* **VALIDADO**
   - *Descrição:* Formulário na Landing Page coleta Nome, E-mail, WhatsApp, Cidade e múltiplos Perfis caiçaras, gerando IP hash client-side (SHA-256) por privacidade e inserindo o lead no Supabase.
   - *Evidência:* [src/pages/Index.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/Index.tsx).

2. **Busca e Resolução de CEP de Ubatuba:**
   - *Status:* **VALIDADO**
   - *Descrição:* Ao digitar 8 dígitos de um CEP válido, o frontend consulta localmente a base de dados de logradouros de Ubatuba e auto-completa o bairro de moradia, permitindo correção manual pelo usuário.
   - *Evidência:* [src/pages/Index.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/Index.tsx) lines 170-195.

3. **Sistema de Ajuda Contextual (HelpTooltip):**
   - *Status:* **VALIDADO**
   - *Descrição:* Exibição de tooltips informativos flutuantes sobre cards e KPIs administrativos a partir de um dicionário estático tipado mapeado 1-para-1 com a documentação do repositório.
   - *Evidência:* [src/components/admin/HelpTooltip.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/HelpTooltip.tsx).

4. **Trilha de Auditoria Imutável (Audit Trail):**
   - *Status:* **VALIDADO**
   - *Descrição:* Gravação de logs de modificações administrativas que são bloqueados contra deleção ou atualização através de gatilhos e políticas RLS restritas no PostgreSQL.
   - *Evidência:* [src/pages/admin/AdminAuditPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminAuditPage.tsx).

5. **Tolerância a Falhas (Circuit Breaker):**
   - *Status:* **VALIDADO**
   - *Descrição:* Mecanismo que detecta falhas consecutivas em APIs externas (como envio de e-mails ou gateways) e ativa disjuntores de fallback para não travar o carregamento do SuperApp.
   - *Evidência:* [src/pages/admin/AdminHealthCenterPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminHealthCenterPage.tsx).

6. **Regras Antifraude Operacional (Operational Flags):**
   - *Status:* **IMPLEMENTADO — NÃO VALIDADO**
   - *Descrição:* Triggers que monitoram excesso de cancelamentos e no-shows (ex: 3 cancelamentos em 1 hora para mototáxi) aplicando suspensões temporárias de 60 minutos de forma automática.
   - *Evidência:* [21_operational_antifraud.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/21_operational_antifraud.sql).

7. **Estabilização de Rotas SPA em Produção:**
   - *Status:* **VALIDADO**
   - *Descrição:* Regras de rewrite no arquivo Vercel JSON para redirecionar acessos diretos de rotas virtuais de volta para o entry-point `index.html`.
   - *Evidência:* [vercel.json](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/vercel.json).

8. **Exclusão de Conta LGPD (Direito ao Esquecimento):**
   - *Status:* **IMPLEMENTADO — NÃO VALIDADO**
   - *Descrição:* Função que executa a exclusão lógica/física e anonimização de dados cadastrais dos usuários do Supabase Auth de forma automatizada.
   - *Evidência:* Edge Function `delete-account`.

9. **Portabilidade de Dados LGPD (Meus Dados):**
   - *Status:* **IMPLEMENTADO — NÃO VALIDADO**
   - *Descrição:* Compilação e exportação de todas as transações, KYC, histórico de corridas e dados cadastrais em arquivo JSON assinado temporariamente.
   - *Evidência:* Edge Function `export-user-data`.

10. **Processamento de Split de Pagamentos (Mercado Pago):**
    - *Status:* **IMPLEMENTADO — NÃO VALIDADO**
    - *Descrição:* Distribuição e repasse das taxas operacionais (4% para a UBT e 96% para o prestador) após a conclusão das transações comerciais.
    - *Evidência:* Edge Function `split_processor`.

11. **Service Worker Offline Caching:**
    - *Status:* **IMPLEMENTADO — NÃO VALIDADO**
    - *Descrição:* Interceptação de requisições de assets estáticos em background para manter a navegação disponível em zonas sem sinal de celular.
    - *Evidência:* `public/sw.js`.

---

## 6. Administração
As 8 áreas administrativas auditadas possuem os seguintes KPIs, tooltips e origens de dados factual:

1. **Dashboard Principal (`/admin`):**
   - *KPIs/Cards:* GMV do Dia, Receita UBT (4%), Pedidos do Dia, Tempo de Resposta Média, Saúde dos Serviços (Sistema, Edge Functions, Realtime, Banco).
   - *Tooltips Ativos:* 4 tooltips (`gmv`, `receita_ubt`, `pedidos`, `tempo_resposta`).
   - *Origem dos Dados:* RPC `get_executive_dashboard_kpis`.

2. **Central de Saúde (`/admin/health`):**
   - *KPIs/Cards:* Alertas Críticos, Alertas Ativos, Alertas Resolvidos Hoje, Tempo Médio de Resolução.
   - *Tooltips Ativos:* 3 tooltips (`alertas_criticos`, `alertas_ativos`, `tempo_resolucao`).
   - *Origem dos Dados:* RPC `get_health_center_summary`.

3. **Operações (`/admin/operacoes`):**
   - *KPIs/Cards:* Pedidos & Corridas Ativos, Alertas de Ghost Ride, Carrinhos Ambulantes, Veículos Reciclagem.
   - *Tooltips Ativos:* 2 tooltips (`corridas_ativas`, `ghost_ride_alerts`).
   - *Origem dos Dados:* Consultas real-time nas tabelas `pedidos`, `mototaxi_corridas` e `ambulante_sessions`.

4. **Auditoria (`/admin/auditoria`):**
   - *KPIs/Cards:* Total Registrado Hoje, Última Hora, Ações Críticas, Falhas de Operação.
   - *Tooltips Ativos:* 2 tooltips (`total_hoje`, `acoes_criticas`).
   - *Origem dos Dados:* RPC `get_admin_audit_logs_summary`.

5. **Antifraude (`/admin/antifraude`):**
   - *KPIs/Cards:* Alertas Totais, Críticos Pendentes, Alertas Resolvidos.
   - *Tooltips Ativos:* 1 tooltip (`criticos_pendentes`).
   - *Origem dos Dados:* Tabela `public.telemetry_flags`.

6. **Analytics (`/admin/analytics`):**
   - *KPIs/Cards:* Eventos Capturados, Usuários Ativos, Pedidos Criados, Serviços Concluídos.
   - *Tooltips Ativos:* 3 tooltips (`eventos_capturados`, `usuarios_ativos`, `pedidos_criados`).
   - *Origem dos Dados:* Tabela `public.analytics_events`.

7. **Security Center (`/admin/security`):**
   - *KPIs/Cards:* Security Score (%), Riscos Críticos, Vulnerabilidades Ativas.
   - *Tooltips Ativos:* 2 tooltips (`score`, `riscos_criticos`).
   - *Origem dos Dados:* Classe de serviço `SecurityAuditService` querying `security_findings`.

8. **Configurações (`/admin/configuracoes`):**
   - *KPIs/Cards:* Painel de Chaves Operacionais de Negócios e Histórico de Parâmetros.
   - *Tooltips Ativos:* 1 tooltip (`centro_configuracoes`).
   - *Origem dos Dados:* Tabela `public.system_settings`.

---

## 7. Banco de Dados
Mapeadas **58 tabelas** ativas no schema `public` do banco Supabase de produção.

### Tabelas Críticas e Finalidade

1. `usuarios` (uuid PK): Dados cadastrais de clientes, prestadores e operadores (roles).
2. `waitlist` (uuid PK): Contém leads, CEP, bairro de moradia, bairro de trabalho e múltiplos perfis.
3. `ceps_ubatuba` (text PK): Tabela auxiliar contendo 1.823 registros de logradouros, bairros e coordenadas placeholders de Ubatuba.
4. `mototaxi_corridas` (uuid PK): Registros de corridas solicitadas, trajetos, valores e níveis de risco antifraude.
5. `pedidos` (uuid PK): Pedidos comerciais nas verticais de ambulantes e diaristas.
6. `payments` (uuid PK): Registro de transações financeiras Mercado Pago com colunas de telemetria `metadata`.
7. `admin_audit_logs` / `admin_logs` (uuid PK): Trilha de logs de auditoria imutável dos operadores.
8. `telemetry_flags` (uuid PK): Alertas de risco físico detectados em tempo real (GPS distante, velocidade excessiva).
9. `system_settings` (uuid PK): Tabela chave-valor armazenando parâmetros operacionais globais configuráveis.

- **RLS (Row Level Security):** Ativo em todas as tabelas críticas (`usuarios`, `payments`, `telemetry_flags`, `admin_audit_logs`).
- **Policies:** Permissões de escrita públicas limitadas à inserção na `waitlist` e `user_consents`. Tabelas de auditoria e segurança restritas a roles administrativas específicas.

---

## 8. Migrations
Identificadas e catalogadas as migrações locais presentes na raiz do repositório:
- `19_lgpd_compliance.sql`: Adiciona suporte à exclusão de conta e auditorias na tabela `usuarios`.
- `20_payment_security_metadata.sql`: Adiciona coluna `metadata` (JSONB) às tabelas de pagamentos e reembolsos.
- `21_operational_antifraud.sql`: Cria triggers de flags operacionais para punição automática de no-show e abusos.
- `32_waitlist.sql`: Criação da tabela principal da waitlist com RLS padrão.
- `33_waitlist_multi_profile.sql`: Altera a coluna `perfil` da waitlist para o tipo array de texto (`text[]`).
- `34_waitlist_geo_fields.sql`: Adiciona campos `cep_moradia`, `bairro_moradia` e `bairro_trabalho` à tabela `waitlist`.

---

## 9. Autenticação e Permissões
- **Autenticação:** Supabase Auth (`supabase.auth.getUser()`) com armazenamento de sessão JWT local e verificação de integridade contra contas ativas.
- **Autorização (RBAC):** Proteção de rotas administrativas via helper `AdminRoute` comparando claims no metadata do usuário (`user_metadata.role`).

### Matriz de Acesso Administrativo

| Role | Acesso | Restrições | Evidência |
|---|---|---|---|
| `super_admin` | Acesso total a todas as rotas operacionais, financeiras, configurações e LGPD. | Nenhuma restrição técnica no BackOffice. | `App.tsx` |
| `admin` | Acesso a dashboards, analytics, segurança, configurações e antifraude. | Não acessa rotas restritas de LGPD (exclusão direta). | `App.tsx` |
| `operator` | Visualização de clientes, kyc e dashboard operacional. | Não acessa configurações financeiras ou auditoria profunda. | `App.tsx` |
| `financeiro` | Acesso aos painéis de financeiro, pagamentos, payouts, splits e reembolsos. | Bloqueado para alterar parâmetros de segurança ou deletar dados. | `App.tsx` |

---

## 10. Segurança
- **RLS & Políticas:** Habilitadas em tabelas de auditoria, logs e flags. Políticas do Postgres bloqueiam exclusão/edição de logs.
- **LGPD:** Minimização de dados territoriais (coleta de CEP e bairro, sem logradouro/número/complemento). Consentimento de cookies e termos registrado em banco (`user_consents`).
- **Antifraude Locacional:** Lógica de Geofencing comparando desvio de rota, falta de deslocamento físico ou velocidades incompatíveis.

---

## 11. Infraestrutura
- **Plataforma de Deploy:** Vercel. Configuração de rewrites ativos para SPA.
- **Bando de Dados / Backend:** Supabase. API Rest auto-gerada sobre RLS.
- **Sentry Integration:** Integrado via middleware de monitoramento e boundary de erro no frontend React.

---

## 12. Edge Functions
Catalogadas **12 Edge Functions** na estrutura local do repositório Deno:

1. `checkout` (VALIDADO) - Processamento de checkout financeiro.
2. `daily-payout` (IMPLEMENTADO — NÃO VALIDADO) - Execução agendada de repasses diários a prestadores.
3. `delete-account` (IMPLEMENTADO — NÃO VALIDADO) - Anonimização de dados LGPD.
4. `export-user-data` (IMPLEMENTADO — NÃO VALIDADO) - Exportação JSON de portabilidade de dados.
5. `kyc_processor` (IMPLEMENTADO — NÃO VALIDADO) - Validação automatizada de documentos e CNH.
6. `notification_dispatcher` (IMPLEMENTADO — NÃO VALIDADO) - Disparo de Push Notifications e e-mails.
7. `payment_webhook` (IMPLEMENTADO — NÃO VALIDADO) - Receptor de IPNs e notificações de status de pagamento do Mercado Pago.
8. `qr_pix_generator` (IMPLEMENTADO — NÃO VALIDADO) - Geração dinâmica de chaves copia e cola e QR Code Pix.
9. `refund` (IMPLEMENTADO — NÃO VALIDADO) - Execução de estornos manuais no gateway.
10. `refund_processor` (IMPLEMENTADO — NÃO VALIDADO) - Regras internas de devolução de créditos de cancelamento.
11. `split_processor` (IMPLEMENTADO — NÃO VALIDADO) - Particionador financeiro.
12. `webhooks-mercado-pago` (IMPLEMENTADO — NÃO VALIDADO) - Tratador de alterações de estado de cobranças.

---

## 13. Integrações Externas
Identificadas **5 integrações** reais ativas no código:
- **Mercado Pago:** Pagamentos Pix e Cartão de Crédito (via SDK frontend e Edge Functions de checkout/webhook).
- **Sentry:** Observabilidade de erros no frontend (`App.tsx`).
- **Supabase:** Armazenamento de dados e autenticação de usuários.
- **Vercel:** Hospedagem da aplicação.
- **GitHub:** Repositório de código e integração CI/CD.

---

## 14. Analytics
- **Mecanismo:** Captura de eventos pseudonimizados com buffer local, fila de reenvios, retry exponencial de 5 tentativas e fallback de salvamento em lote para evitar perda de dados sob falha de chave estrangeira (`23503`).
- **Tabela:** `public.analytics_events`.

---

## 15. Waitlist / Fundadores
- **Fluxo:** Landing Page -> Coleta de CEP/Bairro/Perfis -> Supabase.
- **BackOffice:** Visualização e filtragem por novos perfis no `AdminWaitlistPage.tsx`.

---

## 16. Geolocalização
- **Tabela `ceps_ubatuba`:** Contém 1.823 CEPs associados a bairros, mas latitudes/longitudes são placeholders inválidos que apontam para fora da cidade.
- **Resolução:** A geolocalização funciona 100% de forma nominal (CEP -> Bairro), mas não permite a plotagem em coordenadas geográficas exatas sem intervenção futura.

---

## 17. Erros Conhecidos
- **Sentry 403 (Observabilidade):** Ocorre rejeição de requisição no envio de logs de erros do Sentry (classificado como `SENTRY_NON_BLOCKING_FAIL`). Não bloqueia funcionalidades principais do aplicativo.

---

## 18. Conflitos de Fontes

### CONFLITO DE FONTES 1

- **Fonte A:** Relatório `UBT-DEV-012` / `UBT-DEV-013` (Declara que as coordenadas de lat/lng de `ceps_ubatuba` estão prontas para plotagem do mapa).
- **Fonte B:** Código real e Banco de dados Supabase (Coordenadas são nulas em 99.6% dos registros e placeholders inválidos nas 7 linhas preenchidas).
- **Diferença:** A tabela possui as colunas, mas não possui dados geográficos operacionais reais.
- **Impacto:** O mapa de adensamento geográfico de fundadores não pode ser renderizado a partir das coordenadas originais de `ceps_ubatuba`.
- **Recomendação:** Utilizar dicionário de coordenadas centrais de bairros estático no frontend para renderização do mapa.

### CONFLITO DE FONTES 2

- **Fonte A:** Arquivo local `09_hybrid_geocoding_cache.sql` no repositório.
- **Fonte B:** Banco de dados de produção Supabase (Tabela inexistente).
- **Diferença:** O script SQL existe localmente, mas a tabela `endereco_cache` não foi criada no banco de produção.
- **Impacto:** Cache de geocodificação nominal não operacional na base remota.
- **Recomendação:** Executar a migração de cache em sprint futura de infraestrutura.

---

## 19. Lacunas
* **[INFORMAÇÃO A LEVANTAR]:** Exato mapeamento de webhooks e homologação do Mercado Pago em produção.
* **[IMPLEMENTADO — NÃO VALIDADO]:** Funcionamento de onboarding de diaristas e ambulantes em produção.
* **[ROADMAP]:** Plotagem e interface do Mapa de Fundadores.
* **[ROADMAP]:** Lógica de exportação e download visual da Wiki no painel administrativo.
* **[REQUIREMENT]:** Higienização de dados na waitlist para remoção de perfis legados `"empresa"`.

---

## 20. Roadmap
Identificado no histórico de sprints:
- **Mapa de Adensamento:** Plotagem territorial de prestadores e tomadores para determinar a viabilidade e priorização de aberturas de piloto nas orlas de Ubatuba.
- **BackOffice Wiki:** Construção de interface amigável para navegação de documentações e guias operacionais integrados a agentes cognitivos de IA.

---

## 21. Requirements
Identificado:
- **Exclusão de Leads Legados:** Limpeza de registros criados com a tag `"empresa"` na waitlist para adequar os dados consolidados aos novos rótulos de Associações de Trabalhadores.

---

## 22. Decisions
- **Uso de Minimização de Dados (LGPD):** Decidido armazenar apenas CEP e Bairro para evitar a necessidade de gerenciar dados de privacidade extremamente invasivos (número da casa, complemento).

---

## 23. Matriz Consolidada de Status

| Área | Funcionalidade | Estado | Evidência | Fonte | Observação |
|---|---|---|---|---|---|
| Waitlist | Cadastro Geográfico | **VALIDADO** | `.insert` no Supabase | `Index.tsx` | CEP e Bairro incluídos. |
| Waitlist | CEP to Bairro | **VALIDADO** | Query em `ceps_ubatuba` | `Index.tsx` | Autopreenchimento funcional. |
| Admin | Ajuda Contextual | **VALIDADO** | 18 Tooltips ativos | `HelpTooltip.tsx` | z-index configurado. |
| Admin | Auditoria | **VALIDADO** | RLS e Triggers | `AdminAuditPage.tsx` | Logs imutáveis ativos. |
| Admin | Configurações | **VALIDADO** | Edição de `system_settings` | `AdminConfiguracoesPage.tsx` | Versionamento de parâmetros ativo. |
| Antifraude | Punidor Operacional | **IMPLEMENTADO — NÃO VALIDADO** | Gatilhos de no-show | `21_operational_antifraud.sql` | Monitoramento inativo em prod. |
| Financeiro | Split Financeiro | **IMPLEMENTADO — NÃO VALIDADO** | Edge Function de split | `split_processor` | Repasse de comissão MP. |
| LGPD | Esquecimento | **IMPLEMENTADO — NÃO VALIDADO** | Edge Function de exclusão | `delete-account` | Anonimização de perfis. |
| LGPD | Portabilidade | **IMPLEMENTADO — NÃO VALIDADO** | Edge Function de portabilidade | `export-user-data` | Exportação de dados em JSON. |
| Core | Rotas SPA | **VALIDADO** | Arquivo de rewrites Vercel | `vercel.json` | Evita erros 404 em rotas diretas. |
| PWA | Offline Caching | **IMPLEMENTADO — NÃO VALIDADO** | Service Worker fetch logic | `public/sw.js` | Cache em segundo plano. |

---

## 24. Matriz de Confiabilidade das Fontes

| Informação | Fonte | Evidência direta? | Estado | Observação |
|---|---|---|---|---|
| Sucesso de cadastro waitlist | Banco e front atual | Sim | **VALIDADO** | Inserção real testada com novos campos. |
| Ausência de coordenadas ceps | Banco real Supabase | Sim | **VALIDADO** | Contagem indica 99.6% de lat/lng nulos. |
| Trilha de auditoria ativa | Banco e triggers | Sim | **VALIDADO** | RLS impede remoções administrativas. |
| Exclusão de conta LGPD | Edge Function local | Não | **IMPLEMENTADO — NÃO VALIDADO** | Código existe, mas sem execução em prod. |

---

## 25. Informações que precisam de Validação Humana
1. Homologação das credenciais de produção do Mercado Pago e fluxo real de webhooks IPN.
2. Definição do comportamento desejado para os registros legados com o perfil `"empresa"` na waitlist.
