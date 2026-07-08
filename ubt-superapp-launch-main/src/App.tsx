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
import CocoPage from "./pages/CocoPage.tsx";
import CocoOnboardingPage from "./pages/CocoOnboardingPage.tsx";
import CocoOnlinePage from "./pages/CocoOnlinePage.tsx";
import NotFound from "./pages/NotFound.tsx";


const adminGuard = (el: React.ReactNode) => (
  <AdminRoute>
    <AdminLayout>{el}</AdminLayout>
  </AdminRoute>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RideProvider>
          <AmbulantePedidoProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/recuperar-senha" element={<RecuperarSenha />} />
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
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={adminGuard(<AdminDashboardPage />)} />
              <Route path="/admin/clientes" element={adminGuard(<AdminClientesPage />)} />
              <Route path="/admin/clientes/:id" element={adminGuard(<AdminClienteDetailPage />)} />
              <Route path="/admin/kyc/:id" element={adminGuard(<AdminKycDetailPage />)} />
              <Route path="/admin/kyc-pendentes" element={adminGuard(<AdminKycListPage />)} />
              <Route path="/admin/financeiro" element={adminGuard(<AdminFinanceiroPage />)} />
               <Route path="/admin/split" element={adminGuard(<AdminSplitPage />)} />
              <Route path="/admin/sorteio/1-5" element={adminGuard(<AdminSorteioTrabPage />)} />
              <Route path="/admin/sorteio/1-11" element={adminGuard(<AdminSorteioConsPage />)} />
              <Route path="/admin/entidades" element={adminGuard(<AdminEntidadesPage />)} />
              <Route path="/admin/preco" element={adminGuard(<AdminPrecoPage />)} />
              <Route path="/admin/arbitragem" element={adminGuard(<AdminArbitragemPage />)} />
              <Route path="/admin/conteudo" element={adminGuard(<AdminConteudoPage />)} />
              <Route path="/admin/coco" element={adminGuard(<AdminCocoPage />)} />
              <Route path="/admin/diaristas" element={adminGuard(<AdminDiaristasPage />)} />
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

export default App;
