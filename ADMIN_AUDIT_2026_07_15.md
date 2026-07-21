# UBT SuperApp — Relatório de Auditoria do Módulo Administrativo (/admin)

**Data da Auditoria:** 2026-07-15  
**Versão:** UBT Admin Audit v1.1  
**Classificação:** Técnico / Interno UBT  
**Autor:** Antigravity AI  

---

## 1. Rotas Administrativas Existentes

Todas as rotas do backoffice estão declaradas em [src/App.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx) e envelopadas pelo wrapper `<AdminLayout />` (que gerencia o painel e sidebar lateral) e protegidas pelo componente `<AdminRoute />`.

Abaixo está o detalhamento de cada rota mapeada sob `/admin`:

| Rota | Arquivo React Responsável | Nível de Proteção | Exige Admin? | Utiliza AdminRoute.tsx? | Validação RLS Complementar (DB) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/admin/login` | [AdminLoginPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLoginPage.tsx) | Público (Sem wrapper) | Não | Não | Não (Autenticação Primária) |
| `/admin` | [AdminDashboardPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminDashboardPage.tsx) | Protegido | Sim | Sim | Sim (Tabelas de contagem RLS) |
| `/admin/clientes` | [AdminClientesPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminClientesPage.tsx) | Protegido | Sim | Sim | Sim (Leitura de `usuarios` e `pedidos`) |
| `/admin/clientes/:id` | [AdminClienteDetailPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminClienteDetailPage.tsx) | Protegido | Sim | Sim | Sim (Update em `usuarios`) |
| `/admin/kyc-pendentes` | [AdminKycListPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminKycListPage.tsx) | Protegido | Sim | Sim | Sim (Leitura com base em role) |
| `/admin/kyc/:id` | [AdminKycDetailPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminKycDetailPage.tsx) | Protegido | Sim | Sim | Sim (Update em `usuarios` e `profiles`) |
| `/admin/financeiro` | [AdminFinanceiroPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminFinanceiroPage.tsx) | Protegido | Sim | Sim | Sim (Leitura de `pedidos` / `agendamentos`) |
| `/admin/split` | [AdminSplitPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx) | Protegido | Sim | Sim | Não (Persistência em `localStorage`) |
| `/admin/sorteio/1-5` | [AdminSorteioTrabPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioTrabPage.tsx) | Protegido | Sim | Sim | Sim (Cálculos de pedidos reais) |
| `/admin/sorteio/1-11` | [AdminSorteioConsPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioConsPage.tsx) | Protegido | Sim | Sim | Sim (Leitura de pedidos) |
| `/admin/entidades` | [AdminEntidadesPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminEntidadesPage.tsx) | Protegido | Sim | Sim | Não (Parâmetros locais) |
| `/admin/preco` | [AdminPrecoPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminPrecoPage.tsx) | Protegido | Sim | Sim | Não (Simulador em memória) |
| `/admin/arbitragem` | [AdminArbitragemPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminArbitragemPage.tsx) | Protegido | Sim | Sim | Não (Tickets mockados em memória) |
| `/admin/conteudo` | [AdminConteudoPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminConteudoPage.tsx) | Protegido | Sim | Sim | Não (Salva em `localStorage`) |
| `/admin/coco` | [AdminCocoPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminCocoPage.tsx) | Protegido | Sim | Sim | Sim (Update em `coco_caminhoes` e RLS) |
| `/admin/diaristas` | [AdminDiaristasPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminDiaristasPage.tsx) | Protegido | Sim | Sim | Sim (Update em `diarista_materiais_padrao`) |

---

## 2. Componentes Existentes

Detalhamento dos componentes React que compõem o ecossistema administrativo:

| Nome do Componente | Caminho do Arquivo | Objetivo | Status |
| :--- | :--- | :--- | :--- |
| `AdminLayout` | [src/layouts/AdminLayout.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/layouts/AdminLayout.tsx) | Controla o frame da tela (menu lateral, header "ao vivo", breadcrumbs). | **Funcional** |
| `AdminRoute` | [src/components/admin/AdminRoute.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/AdminRoute.tsx) | Interceptador de segurança que valida papel 'admin' no banco. | **Funcional** |
| `AdminToast` | [src/components/admin/AdminToast.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/AdminToast.tsx) | Sistema de alertas flutuantes (banners) de confirmação/erro. | **Funcional** |
| `Card` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L4-L20) | Wrapper visual com borda, sombra e cor de superfície administrativa. | **Funcional** |
| `PageTitle` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L22-L27) | Padronizador de títulos e subtítulos de página. | **Funcional** |
| `PrimaryButton` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L29-L51) | Botão principal de ação (verde esmeralda ou cinza inativo). | **Funcional** |
| `GhostButton` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L53-L72) | Botão secundário vazado com contorno cinza suave. | **Funcional** |
| `Pill` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L74-L97) | Etiqueta colorida de status para tags e categorizações. | **Funcional** |
| `Avatar` | [src/components/admin/ui.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/ui.tsx#L105-L137) | Renderizador redondo de iniciais para representação de usuários. | **Funcional** |

---

## 3. Fontes de Dados (Integração com Supabase)

O backoffice administrativo utiliza conexões diretas às tabelas públicas via cliente Supabase JS. Abaixo estão as tabelas e recursos consumidos por tela:

| Rota / Tela | Tabelas Supabase Utilizadas | Views | RPCs | Edge Functions | Realtime (Sim/Não) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `usuarios`, `diarista_perfis`, `coco_caminhoes`, `ambulante_sessions`, `coco_pontos`, `pedidos` | Nenhuma | Nenhuma | Nenhuma | Não (Apenas polling visual) |
| **Clientes** | `usuarios`, `diarista_perfis`, `coco_caminhoes`, `pedidos` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Cliente Detalhe** | `usuarios`, `diarista_perfis`, `coco_caminhoes`, `pedidos` | Nenhuma | Nenhuma | Nenhuma | Não |
| **KYC Pendentes** | `usuarios`, `diarista_perfis`, `coco_caminhoes` | Nenhuma | Nenhuma | Nenhuma | Não |
| **KYC Detalhe** | `usuarios`, `diarista_perfis`, `coco_caminhoes` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Financeiro** | `pedidos`, `diarista_agendamentos` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Split / Taxas** | `usuarios`, `pedidos`, `diarista_perfis`, `coco_caminhoes` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Sorteio 1/5** | `usuarios`, `pedidos`, `diarista_perfis`, `coco_caminhoes` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Sorteio 1/11** | `usuarios`, `pedidos` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Côco & Cia** | `coco_caminhoes`, `coco_pontos` | Nenhuma | Nenhuma | Nenhuma | **Sim** (Canais: `admin-realtime-caminhoes` / `admin-realtime-pontos` via `postgres_changes`) |
| **Diaristas** | `diarista_materiais_padrao` | Nenhuma | Nenhuma | Nenhuma | Não |
| **Preço Dinâmico** | Nenhuma (Mock local) | Nenhuma | Nenhuma | Nenhuma | Não |
| **Arbitragem** | Nenhuma (Mock local) | Nenhuma | Nenhuma | Nenhuma | Não |
| **Conteúdo** | Nenhuma (LocalStorage) | Nenhuma | Nenhuma | Nenhuma | Não |

---

## 4. Funcionalidades Já Existentes (Matriz de Cobertura)

Abaixo está o inventário de cobertura de regras administrativas em produção:

### 4.1 Usuários
*   **Visualizar usuários:** 🟢 **Funcional** (Listagem com foto/nome, filtragem por mês de aniversário, tipo de serviço prestado e período do cadastro).
*   **Editar usuários:** 🔴 **Inexistente** (Não é possível editar nome, celular ou dados cadastrais diretamente na interface administrativa).
*   **Bloquear/Suspender usuários:** 🟡 **Parcial (Mock)** (As regras de suspensão, bloqueio de chat, bloqueio de login e quarentena são calibradas e salvas em `localStorage` ou aplicadas na memória).

### 4.2 Financeiro
*   **Visualizar pagamentos:** 🟡 **Parcial** (Exibe histórico de faturamento mesclando transações reais de pedidos com dados estatísticos históricos criados na inicialização do script).
*   **Visualizar splits:** 🔴 **Inexistente** (Não existe tela exibindo o split financeiro de cada transação processada. A tela `/admin/split` serve apenas para calibração visual dos coeficientes de divisão).
*   **Visualizar payouts:** 🔴 **Inexistente** (Sem listagem ou aprovação de saques/payouts de prestadores).
*   **Visualizar chargebacks:** 🔴 **Inexistente** (Sem área de contestações Mercado Pago).

### 4.3 Operações
*   **Visualizar corridas:** 🔴 **Inexistente** (Sem tela ou mapa de rastreamento de corridas de mototáxi).
*   **Visualizar diaristas:** 🟡 **Parcial** (Permite gerenciar a tabela `diarista_materiais_padrao`, mas não monitora as diárias ativas).
*   **Visualizar pedidos ambulantes:** 🔴 **Inexistente** (Pedidos de ambulantes são exibidos como volume financeiro genérico).
*   **Visualizar coletas Côco:** 🟢 **Funcional** (Mapa Leaflet dinâmico exibindo pontos de coleta pendentes, caminhões de lixo reciclável ativos em tempo real e aprovação de novos veículos).

### 4.4 Compliance
*   **Exportar LGPD:** 🔴 **Inexistente** (Sem ferramenta de exportação).
*   **Anonimizar usuário:** 🔴 **Inexistente**.
*   **Excluir conta:** 🔴 **Inexistente** (Apenas rebaixamento de papel de prestador para tomador).

---

## 5. Segurança do Backoffice

*   **Identificação do Administrador:** Ao fazer login via [AdminLoginPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLoginPage.tsx), o sistema autentica a credencial na tabela `public.usuarios` utilizando o Supabase Auth.
*   **Claim / Condicional de Acesso:** O componente de interceptação [AdminRoute.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/components/admin/AdminRoute.tsx#L20-L21) considera um usuário válido como admin se:
    1.  O e-mail cadastrado for exatamente `ubt.servicos@gmail.com` **ou**
    2.  O registro correspondente na tabela `public.usuarios` contiver o campo `role = 'admin'`.
*   **Função `is_admin()`:** Existe como regra helper client-side e está descrita no PostgreSQL (verificada em políticas RLS anteriores).
*   **Riscos de Segurança Identificados:**
    > [!WARNING]
    > **Ausência de persistência em configurações críticas:** Configurações de taxa de serviço (splits) e chaves Pix da plataforma são salvas puramente no `localStorage` do navegador do operador. Isso impossibilita a leitura dessas chaves pelas Edge Functions do gateway.
    
    > [!CAUTION]
    > **Mocks em localStorage e Memória:** A simulação de arbitragem e status de quarentena é feita no navegador local. O aplicativo do passageiro/mototaxista não lê essas restrições, expondo a plataforma a acessos não autorizados de usuários teoricamente "suspensos".

---

## 6. Screenshots do Painel Atual

Abaixo, demonstração conceitual da área administrativa central (/admin) operando sob a identidade visual premium UBT SuperApp:

![Painel Administrativo Central - UBT Dashboard](file:///C:/Users/MacInBox/.gemini/antigravity/brain/8cbad69a-1539-43ca-bf05-6bad0559f4c2/ubt_admin_dashboard_1784135369969.png)

---

## 7. Classificação e Avaliação de Prontidão

### 7.1 Matriz Funcional de Prontidão
*   **Módulo de Clientes:** 🟡 **Pilot Ready** (O banco de dados é lido corretamente, listando e distinguindo prestadores e tomadores).
*   **Módulo de KYC:** 🟡 **Pilot Ready** (O fluxo de aprovação e alteração de role para `prestador` funciona diretamente no Supabase).
*   **Módulo Côco & Cia:** 🟢 **Production Ready** (Possui assinatura realtime no mapa Leaflet, exibindo a localização dos coletores e o estado das coletas).
*   **Módulo Financeiro / Split:** 🔴 **MVP Ready** (Puramente estatístico e simulado por localStorage, sem integração a transações Mercado Pago reais).
*   **Módulo de Preços & Arbitragem:** 🔴 **MVP Ready** (Cálculos de preço dinâmico e resolução de disputas são executados apenas na interface).

### 7.2 Lacunas Faltantes para Produção (Gaps)
1.  **Centralização do Split:** A tabela `public.payment_splits` criada nas migrations precisa ser integrada às telas de calibração para salvar as chaves Pix e frações no banco, e não no `localStorage`.
2.  **Persistência de Arbitragem e Punições:** Integrar os status de suspensão configurados em `AdminArbitragemPage` com a tabela `public.usuarios` ou `profiles`, ativando os triggers de bloqueio de login e chat no aplicativo final.
3.  **Visualizador de Transações Mercado Pago:** Integrar a tabela `public.payments` e webhook de pagamentos à listagem de transações financeiras.
