# Audit 01 — Database Usage & TypeScript Interfaces Mapping

Este documento registra o mapeamento do uso atual do banco de dados (Supabase) na aplicação e as interfaces TypeScript locais criadas para simular e estruturar esses dados.

---

## 1. Mapeamento de Tabelas (Supabase)

Abaixo estão documentadas todas as tabelas identificadas no código-fonte em [`src/`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src), suas respectivas operações, colunas manipuladas e filtros.

### 1.1. `usuarios`
* **Arquivos:** [`useCurrentUser.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/hooks/useCurrentUser.ts), [`AmbulanteCarrinhoPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulanteCarrinhoPage.tsx), [`AmbulantesOnboardingPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantesOnboardingPage.tsx), [`DiaristaAgendarPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaAgendarPage.tsx), [`AdminArbitragemPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminArbitragemPage.tsx)
* **Operações:** `Select`, `Upsert`, `Update`
* **Colunas Manipuladas:** `id`, `role`, `nome`, `cpf`, `telefone`, `chave_pix`, `padrinho_id`, `status`
* **Filtros:** `.eq('id', userId)`

### 1.2. `permissions`
* **Arquivos:** [`usePermissions.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/hooks/usePermissions.ts)
* **Operações:** `Select`
* **Colunas Manipuladas:** `codigo`
* **Filtros:** Nenhum (busca todos os registros)

### 1.3. `geocoding_metrics`
* **Arquivos:** [`geoService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/lib/geoService.ts)
* **Operações:** `Insert`
* **Colunas Manipuladas:** `endpoint`, `query`, `duration_ms`, `success`, `response_status`, `error`
* **Filtros:** N/A

### 1.4. `endereco_cache`
* **Arquivos:** [`geoService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/lib/geoService.ts)
* **Operações:** `Insert`, `Select`
* **Colunas Manipuladas:** `query`, `lat`, `lng`, `display_name`, `raw_data`
* **Filtros:** `.eq('query', cleanQuery)`

### 1.5. `ceps_ubatuba`
* **Arquivos:** [`geoService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/lib/geoService.ts)
* **Operações:** `Select`, `Update`
* **Colunas Manipuladas:** `cep`, `lat`, `lng`
* **Filtros:** `.eq('cep', cepClean)`

### 1.6. `pedidos`
* **Arquivos:** [`AmbulanteCarrinhoPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulanteCarrinhoPage.tsx), [`AmbulantePedidoPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantePedidoPage.tsx), [`AmbulantesGerenciarPedidoPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantesGerenciarPedidoPage.tsx), [`AmbulantesOnlinePage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantesOnlinePage.tsx), [`AdminLgpdPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLgpdPage.tsx), [`AdminOperacoesPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminOperacoesPage.tsx)
* **Operações:** `Insert`, `Select`, `Update`
* **Colunas Manipuladas:** `id`, `tomador_id`, `prestador_id`, `status`, `total`, `modalidade`, `endereco_entrega`, `forma_pagamento`, `taxa_servico`, `taxa_entrega`
* **Filtros:** `.eq('id', orderId)`, `.eq('prestador_id', prestadorId)`, `.in('status', ['pending', 'confirmed', ...])`

### 1.7. `pedido_itens`
* **Arquivos:** [`AmbulanteCarrinhoPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulanteCarrinhoPage.tsx)
* **Operações:** `Insert`
* **Colunas Manipuladas:** `pedido_id`, `produto_id`, `quantidade`, `preco_unitario`
* **Filtros:** N/A

### 1.8. `ambulante_sessions`
* **Arquivos:** [`AmbulantesOnlinePage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantesOnlinePage.tsx)
* **Operações:** `Insert`, `Update`, `Select`
* **Colunas Manipuladas:** `id`, `prestador_id`, `status`, `lat`, `lng`, `socket_id`, `modalidade_delivery`, `modalidade_local`, `nome_fantasia`
* **Filtros:** `.eq('prestador_id', user.uid)`, `.eq('status', 'online')`

### 1.9. `ambulante_session_produtos`
* **Arquivos:** [`AmbulantesOnlinePage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/AmbulantesOnlinePage.tsx)
* **Operações:** `Insert`, `Delete`
* **Colunas Manipuladas:** `session_id`, `produto_id`
* **Filtros:** `.eq('session_id', activeSessionId)`

### 1.10. `diarista_perfis`
* **Arquivos:** [`DiaristaAgendarPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaAgendarPage.tsx), [`DiaristaOnboardingPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaOnboardingPage.tsx), [`DiaristaPerfilPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaPerfilPage.tsx), [`DiaristasBuscaPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristasBuscaPage.tsx), [`AdminLgpdPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLgpdPage.tsx)
* **Operações:** `Select`, `Insert`, `Update`
* **Colunas Manipuladas:** `user_id`, `biografia`, `cidades`, `experiencia_anos`, `preco_dia`, `preco_hora`, `tempo_medio_atendimento`
* **Filtros:** `.eq('user_id', userId)`

### 1.11. `diarista_agendamentos`
* **Arquivos:** [`DiaristaAgendarPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaAgendarPage.tsx), [`AdminOperacoesPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminOperacoesPage.tsx)
* **Operações:** `Insert`, `Select`
* **Colunas Manipuladas:** `id`, `tomador_id`, `prestador_id`, `data_agendamento`, `duracao_horas`, `preco_total`, `status`, `observacoes`
* **Filtros:** `.eq('status', 'pending')`

### 1.12. `diarista_materiais_padrao`
* **Arquivos:** [`DiaristaOnboardingPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaOnboardingPage.tsx), [`AdminDiaristasPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminDiaristasPage.tsx)
* **Operações:** `Select`, `Insert`, `Update`, `Delete`
* **Colunas Manipuladas:** `id`, `nome`, `categoria`, `preco_medio`
* **Filtros:** `.eq('id', id)`

### 1.13. `vw_diarista_materiais_media_7d` (View)
* **Arquivos:** [`DiaristaOnboardingPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaOnboardingPage.tsx)
* **Operações:** `Select`
* **Colunas Manipuladas:** `material_id`, `preco_medio`
* **Filtros:** N/A (busca média consolidada)

### 1.14. `diarista_materiais_precos_declarados`
* **Arquivos:** [`DiaristaOnboardingPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/DiaristaOnboardingPage.tsx)
* **Operações:** `Insert`
* **Colunas Manipuladas:** `prestador_id`, `material_id`, `preco_pago`
* **Filtros:** N/A

### 1.15. `user_consents`
* **Arquivos:** [`LgpdConsentPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/LgpdConsentPage.tsx)
* **Operações:** `Insert`
* **Colunas Manipuladas:** `user_id`, `consent_type`, `accepted`, `ip_address`, `user_agent`
* **Filtros:** N/A

### 1.16. `payments`, `payment_splits`, `payouts`, `disputes`, `refunds`, `cancellations`
* **Arquivos:** [`AdminFinanceiroPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminFinanceiroPage.tsx), [`AdminLgpdPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminLgpdPage.tsx)
* **Operações:** `Select`
* **Colunas Manipuladas:** `*`
* **Filtros:** `.or('customer_id.eq.X,provider_id.eq.X')`

### 1.17. `roles` & `role_permissions`
* **Arquivos:** [`AdminPermissoesPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminPermissoesPage.tsx)
* **Operações:** `Select`, `Insert`, `Delete`
* **Colunas Manipuladas:** `id`, `nome`, `permission_id`, `role_id`
* **Filtros:** `.eq('role_id', roleId)`

### 1.18. `split_config`
* **Arquivos:** [`AdminSorteioConsPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioConsPage.tsx), [`AdminSorteioTrabPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioTrabPage.tsx), [`AdminSplitPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx)
* **Operações:** `Select`, `Update`
* **Colunas Manipuladas:** `id`, `prestador_pct`, `premio_consumidor_pct`, `premio_trabalhador_pct`
* **Filtros:** `.eq('id', 1)`

### 1.19. `system_settings`
* **Arquivos:** [`AdminSplitPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx), [`QualityRunnerService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/QualityRunnerService.ts)
* **Operações:** `Select`, `Update`
* **Colunas Manipuladas:** `chave`, `valor`
* **Filtros:** `.eq('chave', keyName)`

### 1.20. `user_onboarding` & `waitlist`
* **Arquivos:** [`AdminWaitlistPage.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminWaitlistPage.tsx)
* **Operações:** `Select`, `Update`
* **Colunas Manipuladas:** `id`, `perfil`, `origem`, `status`, `communication_status`, `waitlist_id`
* **Filtros:** `.eq('id', leadId)`, `.eq('waitlist_id', lead.id)`

### 1.21. `analytics_events`, `system_logs`, `quality_runs`, `quality_test_results`, `admin_audit_logs`, `health_alerts`
* **Arquivos:** [`AnalyticsService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/AnalyticsService.ts), [`LoggingService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/LoggingService.ts), [`E2ECertificationService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/E2ECertificationService.ts), [`ResilienceService.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/services/ResilienceService.ts)
* **Operações:** `Insert`, `Select`
* **Colunas Manipuladas:** Campos de eventos de telemetria, logs de auditoria e métricas
* **Filtros:** Parâmetros de infraestrutura internos

---

## 2. Tipos e Interfaces TypeScript Extraídas

Abaixo estão listadas as definições estruturais locais que servem de modelo ou dados transitórios das entidades:

### 2.1. `RealUser` (useCurrentUser.ts)
```typescript
export type RealUser = {
  uid: string;
  name: string;
  email?: string;
  role: "tomador" | "prestador" | "admin" | "cocoecia" | "cocoecia-colaborador" | "cocoecia-dirigentes";
  plate?: string;
  modalidade?: "carona_entrega" | "so_entrega" | "so_carona";
  cpf?: string;
  sexo?: "masculino" | "feminino" | string;
  kycStatus?: string;
  status?: string;
  mototaxiActive?: boolean;
};
```

### 2.2. `CartItem` & `AmbulantePedidoState` (AmbulantePedidoContext.tsx)
```typescript
export interface CartItem {
  prodId: string;
  nome: string;
  emoji: string;
  qty: number;
  precoUnit: number;
  subtotal: number;
}

export type AmbulantePedidoStatus =
  | "idle" | "cart" | "pending" | "confirmed"
  | "preparing" | "ready" | "completed" | "rating";

export interface AmbulantePedidoState {
  sessionId: string | null;
  pedidoId: string | null;
  status: AmbulantePedidoStatus;
  modalidade: "delivery" | "local_fixo" | null;
  itens: CartItem[];
  total: number;
  prestadorInfo: { nome: string; emoji: string; rating: number } | null;
  paymentMethod: "pix" | "card" | null;
  tomadorAddress: string | null;
}
```

### 2.3. `RideState` & `PrestadorInfo` (RideContext.tsx)
```typescript
export type RideStatus =
  | "idle"
  | "searching"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "rating";

export type RideType = "carona" | "entrega";

export interface LatLngAddr {
  lat: number;
  lng: number;
  address: string;
}

export interface PrestadorInfo {
  name: string;
  photo: string;
  plate: string;
  rating: number;
}

export interface RideMessage {
  text: string;
  from: "tomador" | "prestador";
  ts: number;
}

export interface RideState {
  status: RideStatus;
  rideId: string | null;
  type: RideType | null;
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  estimatedPrice: number;
  finalPrice: number;
  distanceKm: number;
  durationMin: number;
  prestadorInfo: PrestadorInfo | null;
  prestadorLocation: { lat: number; lng: number } | null;
  acceptedAt: number | null;
  paymentMethod: "pix" | "card" | null;
  messages: RideMessage[];
}
```
