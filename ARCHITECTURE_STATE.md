# UBT PWA Architecture State

Este documento registra o estado arquitetural atual do PWA da UBT para alinhamento técnico e planejamento de integrações de banco de dados e próximos épicos.

---

## 1. Árvore de Diretórios (src/)
Estrutura reativa mapeada do diretório [`src/`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src):

```text
src/
├── main.tsx
├── App.tsx
├── App.css
├── index.css
├── vite-env.d.ts
├── components/
│   ├── AddressSearch.tsx
│   ├── MototaxiMap.tsx
│   ├── NavLink.tsx
│   ├── TransactionCard.tsx
│   ├── UBTMap.tsx
│   ├── admin/
│   ├── ambulantes/
│   ├── app/
│   ├── auth/
│   ├── landing/
│   ├── mototaxi/
│   ├── prestador/
│   ├── settings/
│   └── ui/
├── contexts/
│   ├── AmbulantePedidoContext.tsx
│   └── RideContext.tsx
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   ├── useCurrentUser.ts
│   ├── useGeolocation.ts
│   ├── usePermissions.ts
│   ├── usePwaInstall.ts (Wave UBT-PWA-INSTALL-001)
│   ├── useReveal.ts
│   ├── useTheme.ts
│   └── useToast2.ts
├── layouts/
├── lib/
│   ├── firebase.ts
│   ├── geoService.ts
│   ├── leafletFix.ts
│   ├── mapIcons.ts
│   ├── statusRules.ts
│   ├── supabase.ts
│   └── utils.ts
├── pages/
│   ├── AmbulanteCarrinhoPage.tsx
│   ├── AmbulanteCatalogPage.tsx
│   ├── AmbulantePedidoPage.tsx
│   ├── AmbulantesDiscoveryPage.tsx
│   ├── AmbulantesGerenciarPedidoPage.tsx
│   ├── AmbulantesOnboardingPage.tsx
│   ├── AmbulantesOnlinePage.tsx
│   ├── AppHome.tsx
│   ├── Cadastro.tsx
│   ├── CocoOnboardingPage.tsx
│   ├── CocoOnlinePage.tsx
│   ├── CocoPage.tsx
│   ├── ConceptExperience.tsx
│   ├── ConfigAcessibilidadePage.tsx
│   ├── ConfigAjudaPage.tsx
│   ├── ConfigCocoPage.tsx
│   ├── ConfigFinanceiroPage.tsx
│   ├── ConfigIndexPage.tsx
│   ├── ConfigNotificacoesPage.tsx
│   ├── ConfigPerfilPage.tsx
│   ├── ConfigPrivacidadePage.tsx
│   ├── ConfigServicosPage.tsx
│   ├── DiaristaAgendaPage.tsx
│   ├── DiaristaAgendamentoPage.tsx
│   ├── DiaristaAgendarPage.tsx
│   ├── DiaristaGerenciarPage.tsx
│   ├── DiaristaOnboardingPage.tsx
│   ├── DiaristaPerfilPage.tsx
│   ├── DiaristasBuscaPage.tsx
│   ├── GerenciarPage.tsx
│   ├── Index.tsx (Landing Page / Waitlist / PWA install CTA)
│   ├── LgpdConsentPage.tsx
│   ├── Login.tsx
│   ├── MototaxiTomador.tsx
│   ├── NotFound.tsx
│   ├── PrestadorHome.tsx
│   ├── PrestadorKycPending.tsx
│   ├── PrestadorMototaxiActive.tsx
│   ├── PrestadorMototaxiOnboarding.tsx
│   ├── PrestadorMototaxiOnline.tsx
│   ├── RecuperarSenha.tsx
│   ├── TransacaoDetailPage.tsx
│   └── admin/
│       └── AdminSplitPage.tsx
├── services/
│   ├── AnalyticsService.ts
│   ├── AuditService.ts
│   ├── E2ECertificationService.ts
│   ├── GeofenceService.ts
│   ├── LoggingService.ts
│   ├── PaymentSecurityService.ts
│   ├── QualityRunnerService.ts
│   ├── ResilienceService.ts
│   ├── SecurityAuditService.ts
│   └── SettingsService.ts
├── test/
│   ├── DynamicSplit.test.ts (Wave UBT-PAY-006)
│   ├── FinancialRounding.test.ts
│   ├── MercadoPagoSandbox.test.ts
│   ├── PwaInstall.test.ts (Wave UBT-PWA-INSTALL-001)
│   └── Waitlist.test.ts
└── utils/
    ├── cocoIcons.ts
    ├── dateFilter.ts
    ├── geo.ts
    ├── masks.ts
    └── ride.ts
```

---

## 2. Configuração de Ambiente
Variáveis de ambiente requeridas e configuradas em [`.env`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/.env):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 3. Dependências Core (package.json)
Bibliotecas chave instaladas no [`package.json`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/package.json):

* **Roteamento & State:**
  - `react-router-dom` (v6.30.1)
  - `@tanstack/react-query` (v5.83.0)
* **Banco de Dados & Autenticação:**
  - `@supabase/supabase-js` (v2.105.3)
  - `firebase` (v12.12.1)
* **UI Components & Icons:**
  - `radix-ui` (componentes primitivos variados)
  - `lucide-react` (v0.462.0)
  - `recharts` (v2.15.4)
  - `leaflet` / `react-leaflet` (Mapas e Georreferenciamento)

---

## 4. Infraestrutura
* **Vite:** Configurado em [`vite.config.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/vite.config.ts) com React SWC, aliases de imports com `@` mapeado para `src`, HMR ativo, e otimização de manualChunks do Rollup segmentando dependências críticas em pacotes isolados (`vendor-core`, `vendor-ui`, `vendor-maps`, `vendor-supabase`, etc.) para melhorar o tempo de carregamento da aplicação.
* **Tailwind:** Configurado em [`tailwind.config.ts`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/tailwind.config.ts) estendendo famílias de fonte (`display: Syne`, `sans: DM Sans`), estendendo cores personalizadas com suporte a animações nativas.
* **TypeScript:** Configurado no padrão modular de referências dividindo [`tsconfig.json`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/tsconfig.json), `tsconfig.app.json` e `tsconfig.node.json` garantindo a tipagem estrita do compilador React.
