import './lib/leafletFix';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RideProvider } from "@/contexts/RideContext";
import { AmbulantePedidoProvider } from "@/contexts/AmbulantePedidoContext";
import GlobalBottomNav from "@/components/app/GlobalBottomNav";
import AmbulantesDiscoveryPage from "./pages/AmbulantesDiscoveryPage.tsx";
import AmbulanteCatalogPage from "./pages/AmbulanteCatalogPage.tsx";
import AmbulanteCarrinhoPage from "./pages/AmbulanteCarrinhoPage.tsx";
import AmbulantePedidoPage from "./pages/AmbulantePedidoPage.tsx";
import AmbulantesOnboardingPage from "./pages/AmbulantesOnboardingPage.tsx";
import AmbulantesOnlinePage from "./pages/AmbulantesOnlinePage.tsx";
import AmbulantesGerenciarPedidoPage from "./pages/AmbulantesGerenciarPedidoPage.tsx";
import Index from "./pages/Index.tsx";
import ConceptExperience from "./pages/ConceptExperience.tsx";
import Login from "./pages/Login.tsx";
import Cadastro from "./pages/Cadastro.tsx";
import RecuperarSenha from "./pages/RecuperarSenha.tsx";
import AppHome from "./pages/AppHome.tsx";
import MototaxiTomador from "./pages/MototaxiTomador.tsx";
import PrestadorHome from "./pages/PrestadorHome.tsx";
import PrestadorMototaxiOnboarding from "./pages/PrestadorMototaxiOnboarding.tsx";
import PrestadorKycPending from "./pages/PrestadorKycPending.tsx";
import PrestadorMototaxiOnline from "./pages/PrestadorMototaxiOnline.tsx";
import PrestadorMototaxiActive from "./pages/PrestadorMototaxiActive.tsx";
import ConfigIndexPage from "./pages/ConfigIndexPage.tsx";
import ConfigPerfilPage from "./pages/ConfigPerfilPage.tsx";
import ConfigFinanceiroPage from "./pages/ConfigFinanceiroPage.tsx";
import ConfigServicosPage from "./pages/ConfigServicosPage.tsx";
import ConfigAcessibilidadePage from "./pages/ConfigAcessibilidadePage.tsx";
import ConfigNotificacoesPage from "./pages/ConfigNotificacoesPage.tsx";
import ConfigAjudaPage from "./pages/ConfigAjudaPage.tsx";
import ConfigCocoPage from "./pages/ConfigCocoPage.tsx";
import ConfigPrivacidadePage from "./pages/ConfigPrivacidadePage.tsx";
import GerenciarPage from "./pages/GerenciarPage.tsx";
import DiaristasBuscaPage from "./pages/DiaristasBuscaPage.tsx";
import DiaristaPerfilPage from "./pages/DiaristaPerfilPage.tsx";
import DiaristaAgendarPage from "./pages/DiaristaAgendarPage.tsx";
import DiaristaAgendamentoPage from "./pages/DiaristaAgendamentoPage.tsx";
import DiaristaOnboardingPage from "./pages/DiaristaOnboardingPage.tsx";
import DiaristaAgendaPage from "./pages/DiaristaAgendaPage.tsx";
import DiaristaGerenciarPage from "./pages/DiaristaGerenciarPage.tsx";
import TransacaoDetailPage from "./pages/TransacaoDetailPage.tsx";
import { AdminRoute } from "./components/admin/AdminRoute.tsx";
import { AdminLayout } from "./layouts/AdminLayout.tsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.tsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.tsx";
import AdminClientesPage from "./pages/admin/AdminClientesPage.tsx";
import AdminClienteDetailPage from "./pages/admin/AdminClienteDetailPage.tsx";
import AdminKycDetailPage from "./pages/admin/AdminKycDetailPage.tsx";
import AdminKycListPage from "./pages/admin/AdminKycListPage.tsx";
import AdminFinanceiroPage from "./pages/admin/AdminFinanceiroPage.tsx";
import AdminSplitPage from "./pages/admin/AdminSplitPage.tsx";
import AdminEntidadesPage from "./pages/admin/AdminEntidadesPage.tsx";
import AdminPrecoPage from "./pages/admin/AdminPrecoPage.tsx";
import AdminArbitragemPage from "./pages/admin/AdminArbitragemPage.tsx";
import AdminConteudoPage from "./pages/admin/AdminConteudoPage.tsx";
import AdminCocoPage from "./pages/admin/AdminCocoPage.tsx";
import AdminDiaristasPage from "./pages/admin/AdminDiaristasPage.tsx";
import AdminSorteioTrabPage from "./pages/admin/AdminSorteioTrabPage.tsx";
import AdminSorteioConsPage from "./pages/admin/AdminSorteioConsPage.tsx";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage.tsx";
import AdminPayoutsPage from "./pages/admin/AdminPayoutsPage.tsx";
import AdminDisputesPage from "./pages/admin/AdminDisputesPage.tsx";
import AdminRefundsPage from "./pages/admin/AdminRefundsPage.tsx";
import AdminCancellationsPage from "./pages/admin/AdminCancellationsPage.tsx";
import AdminOperacoesPage from "./pages/admin/AdminOperacoesPage.tsx";
import AdminLgpdPage from "./pages/admin/AdminLgpdPage.tsx";
import AdminAuditPage from "./pages/admin/AdminAuditPage.tsx";
import AdminAntifraudePage from "./pages/admin/AdminAntifraudePage.tsx";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage.tsx";
import AdminHealthCenterPage from "./pages/admin/AdminHealthCenterPage.tsx";
import AdminPermissoesPage from "./pages/admin/AdminPermissoesPage.tsx";
import AdminConfiguracoesPage from "./pages/admin/AdminConfiguracoesPage.tsx";
import AdminQualityCenterPage from "./pages/admin/AdminQualityCenterPage.tsx";
import AdminSecurityCenterPage from "./pages/admin/AdminSecurityCenterPage.tsx";
import AdminWaitlistPage from "./pages/admin/AdminWaitlistPage.tsx";
import CocoPage from "./pages/CocoPage.tsx";
import CocoOnboardingPage from "./pages/CocoOnboardingPage.tsx";
import CocoOnlinePage from "./pages/CocoOnlinePage.tsx";
import LgpdGuard from "./components/app/LgpdGuard.tsx";
import LgpdConsentPage from "./pages/LgpdConsentPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import * as Sentry from "@sentry/react";


const adminGuard = (el: React.ReactNode, allowedRoles?: string[]) => (
  <AdminRoute allowedRoles={allowedRoles}>
    <AdminLayout>{el}</AdminLayout>
  </AdminRoute>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RideProvider>
          <AmbulantePedidoProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/experience" element={<ConceptExperience />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/recuperar-senha" element={<RecuperarSenha />} />
              <Route path="/app/consentimento" element={<LgpdConsentPage />} />

              <Route element={<LgpdGuard />}>
                <Route path="/app/home" element={<AppHome />} />
                <Route path="/app/mototaxi" element={<MototaxiTomador />} />
                <Route path="/app/prestador/home" element={<PrestadorHome />} />
                <Route path="/app/prestador/mototaxi/onboarding" element={<PrestadorMototaxiOnboarding />} />
                <Route path="/app/prestador/mototaxi/kyc-pending" element={<PrestadorKycPending />} />
                <Route path="/app/prestador/mototaxi/online" element={<PrestadorMototaxiOnline />} />
                <Route path="/app/prestador/mototaxi/active" element={<PrestadorMototaxiActive />} />
                <Route path="/app/ambulantes" element={<AmbulantesDiscoveryPage />} />
                <Route path="/app/ambulantes/carrinho" element={<AmbulanteCarrinhoPage />} />
                <Route path="/app/ambulantes/pedido/:id" element={<AmbulantePedidoPage />} />
                <Route path="/app/ambulantes/:sessionId" element={<AmbulanteCatalogPage />} />
                <Route path="/app/prestador/ambulantes/onboarding" element={<AmbulantesOnboardingPage />} />
                <Route path="/app/prestador/ambulantes/online" element={<AmbulantesOnlinePage />} />
                <Route path="/app/prestador/ambulantes/pedido/:id" element={<AmbulantesGerenciarPedidoPage />} />
                <Route path="/app/diaristas" element={<DiaristasBuscaPage />} />
                <Route path="/app/diaristas/agendar/:prestadorId" element={<DiaristaAgendarPage />} />
                <Route path="/app/diaristas/agendamento/:id" element={<DiaristaAgendamentoPage />} />
                <Route path="/app/diaristas/:prestadorId" element={<DiaristaPerfilPage />} />
                <Route path="/app/prestador/diaristas/onboarding" element={<DiaristaOnboardingPage />} />
                <Route path="/app/prestador/diaristas/agenda" element={<DiaristaAgendaPage />} />
                <Route path="/app/prestador/diaristas/servico/:id" element={<DiaristaGerenciarPage />} />
                <Route path="/app/config" element={<ConfigIndexPage />} />
                <Route path="/app/config/perfil" element={<ConfigPerfilPage />} />
                <Route path="/app/config/financeiro" element={<ConfigFinanceiroPage />} />
                <Route path="/app/config/privacidade" element={<ConfigPrivacidadePage />} />
                <Route path="/app/config/servicos" element={<ConfigServicosPage />} />
                <Route path="/app/config/acessibilidade" element={<ConfigAcessibilidadePage />} />
                <Route path="/app/config/notificacoes" element={<ConfigNotificacoesPage />} />
                <Route path="/app/config/ajuda" element={<ConfigAjudaPage />} />
                <Route path="/app/config/coco" element={<ConfigCocoPage />} />
                <Route path="/app/coco" element={<CocoPage />} />
                <Route path="/app/prestador/coco/onboarding" element={<CocoOnboardingPage />} />
                <Route path="/app/prestador/coco/online" element={<CocoOnlinePage />} />
                <Route path="/app/gerenciar" element={<GerenciarPage />} />
                <Route path="/app/gerenciar/transacao/:id" element={<TransacaoDetailPage />} />
              </Route>
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={adminGuard(<AdminDashboardPage />)} />
              <Route path="/admin/clientes" element={adminGuard(<AdminClientesPage />, ["operator", "moderador", "admin", "super_admin"])} />
              <Route path="/admin/clientes/:id" element={adminGuard(<AdminClienteDetailPage />, ["operator", "moderador", "admin", "super_admin"])} />
              <Route path="/admin/kyc/:id" element={adminGuard(<AdminKycDetailPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/kyc-pendentes" element={adminGuard(<AdminKycListPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/financeiro" element={adminGuard(<AdminFinanceiroPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/payments" element={adminGuard(<AdminPaymentsPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/payouts" element={adminGuard(<AdminPayoutsPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/disputes" element={adminGuard(<AdminDisputesPage />, ["moderador", "admin", "super_admin"])} />
              <Route path="/admin/refunds" element={adminGuard(<AdminRefundsPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/cancellations" element={adminGuard(<AdminCancellationsPage />, ["operator", "financeiro", "admin", "super_admin"])} />
              <Route path="/admin/operacoes" element={adminGuard(<AdminOperacoesPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/lgpd" element={adminGuard(<AdminLgpdPage />, ["super_admin"])} />
              <Route path="/admin/auditoria" element={adminGuard(<AdminAuditPage />, ["super_admin"])} />
              <Route path="/admin/antifraude" element={adminGuard(<AdminAntifraudePage />, ["admin", "super_admin"])} />
              <Route path="/admin/analytics" element={adminGuard(<AdminAnalyticsPage />, ["admin", "super_admin"])} />
              <Route path="/admin/health" element={adminGuard(<AdminHealthCenterPage />, ["operations_manager", "operator", "admin", "super_admin"])} />
              <Route path="/admin/permissoes" element={adminGuard(<AdminPermissoesPage />, ["admin", "super_admin"])} />
              <Route path="/admin/configuracoes" element={adminGuard(<AdminConfiguracoesPage />, ["admin", "super_admin"], "config.edit")} />
              <Route path="/admin/quality" element={adminGuard(<AdminQualityCenterPage />, ["admin", "super_admin"], "quality.view")} />
              <Route path="/admin/security" element={adminGuard(<AdminSecurityCenterPage />, ["admin", "super_admin"], "security.view")} />
              <Route path="/admin/waitlist" element={adminGuard(<AdminWaitlistPage />, ["marketing", "admin", "super_admin"])} />
              <Route path="/admin/split" element={adminGuard(<AdminSplitPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/sorteio/1-5" element={adminGuard(<AdminSorteioTrabPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/sorteio/1-11" element={adminGuard(<AdminSorteioConsPage />, ["financeiro", "admin", "super_admin"])} />
              <Route path="/admin/entidades" element={adminGuard(<AdminEntidadesPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/preco" element={adminGuard(<AdminPrecoPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/arbitragem" element={adminGuard(<AdminArbitragemPage />, ["moderador", "admin", "super_admin"])} />
              <Route path="/admin/conteudo" element={adminGuard(<AdminConteudoPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/coco" element={adminGuard(<AdminCocoPage />, ["operator", "admin", "super_admin"])} />
              <Route path="/admin/diaristas" element={adminGuard(<AdminDiaristasPage />, ["operator", "admin", "super_admin"])} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <GlobalBottomNav />
          </AmbulantePedidoProvider>
        </RideProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default Sentry.withErrorBoundary(App, {
  fallback: (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0B1B3E", color: "#fff", padding: 24, textAlign: "center" }}>
      <h2 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Ops! Algo deu errado.</h2>
      <p style={{ fontFamily: "DM Sans", fontSize: 15, color: "rgba(255,255,255,0.7)", maxWidth: 400, marginBottom: 24 }}>
        Ocorreu um erro inesperado no aplicativo. Nossa equipe técnica já foi notificada automaticamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: "12px 24px", borderRadius: 12, background: "#0DB87E", color: "#fff", border: "none", fontFamily: "Syne", fontWeight: 700, cursor: "pointer" }}
      >
        Recarregar Aplicativo
      </button>
    </div>
  )
});
