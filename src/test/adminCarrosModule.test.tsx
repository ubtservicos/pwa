import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { rpcMock, fromMock, getUserMock, toastShowMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
  toastShowMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: rpcMock,
    from: fromMock,
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/components/admin/AdminToast", () => ({
  AdminToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminToast: () => ({ show: toastShowMock }),
}));

vi.mock("@/services/AnalyticsService", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/services/LoggingService", () => ({
  logSystem: vi.fn(),
}));

import { AdminLayout, CARROS_NAV_ITEMS } from "@/layouts/AdminLayout";
import { AdminRoute } from "@/components/admin/AdminRoute";
import AdminCarrosPrecoPage from "@/pages/admin/AdminCarrosPrecoPage";
import AdminCarrosAssociacaoPage, {
  formatDataFiliacao,
  buildWhatsAppLink,
} from "@/pages/admin/AdminCarrosAssociacaoPage";
import AdminFinanceiroPage from "@/pages/admin/AdminFinanceiroPage";
import AdminKycListPage from "@/pages/admin/AdminKycListPage";

function buildQueryChain(resolveWith: { data?: any; error?: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue(resolveWith),
    single: vi.fn().mockResolvedValue(resolveWith),
    then: (resolve: any) => Promise.resolve(resolveWith).then(resolve),
  };
  return chain;
}

const CARRO_ASSOC_A = {
  id: "carro-assoc-1",
  cnpj: "11.222.333/0001-44",
  nome: "Associação Carros Centro Ubatuba",
  endereco_sede: "Rua Dona Maria Alves, 200 - Centro, Ubatuba/SP",
  presidente_nome: "Roberto Almeida",
  presidente_cpf: "111.222.333-44",
  email_oficial: "contato@carroscentro.org.br",
  telefone_responsavel: "12991112233",
  categoria: "carro",
  total_motoristas: 2,
};

const CARRO_ASSOC_B = {
  id: "carro-assoc-2",
  cnpj: "55.666.777/0001-88",
  nome: "Associação Carros Litoral Norte",
  endereco_sede: "Av. Capitão Felipe, 80 - Itaguá, Ubatuba/SP",
  presidente_nome: "Fernanda Souza",
  presidente_cpf: "555.666.777-88",
  email_oficial: "litoralnorte@carros.org.br",
  telefone_responsavel: "12994445566",
  categoria: "carro",
  total_motoristas: 1,
};

const CARRO_MOTORISTAS = [
  {
    id: "car-drv-1",
    nome: "Rafael Motorista Carro",
    email: "rafael@ubt.com",
    telefone: "12997771122",
    status: "ativo",
    associacao_id: "carro-assoc-1",
    associacao_nome: CARRO_ASSOC_A.nome,
    data_filiacao: "2025-04-12T12:00:00Z",
  },
  {
    id: "car-drv-2",
    nome: "Camila Motorista Carro",
    email: "camila@ubt.com",
    telefone: "12996663344",
    status: "ativo",
    associacao_id: "carro-assoc-1",
    associacao_nome: CARRO_ASSOC_A.nome,
    data_filiacao: "2025-09-05T12:00:00Z",
  },
  {
    id: "car-drv-3",
    nome: "Diego Litoral",
    email: "diego@ubt.com",
    telefone: "12995557788",
    status: "ativo",
    associacao_id: "carro-assoc-2",
    associacao_nome: CARRO_ASSOC_B.nome,
    data_filiacao: "2026-02-01T12:00:00Z",
  },
];

describe("Módulo Admin da Vertical Carros (v1.9.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
  });

  it("AdminLayout: Superadmin vê grupo Carros completo (Dashboard, Tarifas & Preço Dinâmico, Associação)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "super-1", email: "ubt.servicos@gmail.com" } },
    });
    fromMock.mockImplementation(() => buildQueryChain({ data: null, error: null }));

    expect(CARROS_NAV_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard",
      "Tarifas & Preço Dinâmico",
      "Associação",
    ]);

    render(
      <MemoryRouter initialEntries={["/admin/carros"]}>
        <AdminLayout>
          <div>Carros Page</div>
        </AdminLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Carros")).toBeInTheDocument();
      expect(screen.getByText("Mototaxistas")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Tarifas & Preço Dinâmico" })).toHaveAttribute(
      "href",
      "/admin/carros/preco-dinamico",
    );
    expect(screen.getByRole("link", { name: "Associação" })).toHaveAttribute(
      "href",
      "/admin/carros/associacao",
    );
  });

  it("AdminLayout RBAC: Perfil associação de categoria 'carro' vê apenas Carros (Dashboard + Associação), sem Tarifas nem Mototaxistas", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "assoc-car-user", email: "presidente@carroscentro.org.br" } },
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return buildQueryChain({
          data: { role: "associacao", name: "Roberto Carros" },
          error: null,
        });
      }
      return buildQueryChain({ data: null, error: null });
    });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "get_my_association_scope") {
        return {
          data: {
            role: "associacao",
            associacao_id: "carro-assoc-1",
            associacao_categoria: "carro",
            associacao_nome: CARRO_ASSOC_A.nome,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={["/admin/carros"]}>
        <AdminLayout>
          <div>Conteúdo Carros</div>
        </AdminLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Carros")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mototaxistas")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin/carros");
    expect(screen.getByRole("link", { name: "Associação" })).toHaveAttribute(
      "href",
      "/admin/carros/associacao",
    );
    expect(screen.queryByRole("link", { name: "Tarifas & Preço Dinâmico" })).not.toBeInTheDocument();
  });

  it("AdminLayout & AdminRoute RBAC: Perfil associação de categoria 'mototaxi' não vê Carros e é redirecionado ao tentar acessar /admin/carros", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "assoc-moto-user", email: "presidente@mototaxicentro.org.br" } },
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return buildQueryChain({
          data: { role: "associacao", name: "Carlos Mototáxi" },
          error: null,
        });
      }
      return buildQueryChain({ data: null, error: null });
    });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "get_my_association_scope") {
        return {
          data: {
            role: "associacao",
            associacao_id: "moto-assoc-1",
            associacao_categoria: "mototaxi",
            associacao_nome: "Associação Mototáxi Centro",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin/mototaxistas/dashboard"]}>
        <AdminLayout>
          <div>Conteúdo Mototáxi</div>
        </AdminLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mototaxistas")).toBeInTheDocument();
    });
    expect(screen.queryByText("Carros")).not.toBeInTheDocument();
    unmount();

    // Testa redirecionamento de rota direta /admin/carros -> /admin/mototaxistas/dashboard
    render(
      <MemoryRouter initialEntries={["/admin/carros"]}>
        <Routes>
          <Route
            path="/admin/mototaxistas/dashboard"
            element={<div>Dashboard Mototáxi Redirecionado</div>}
          />
          <Route
            path="/admin/carros"
            element={
              <AdminRoute
                allowedRoles={["admin", "super_admin", "associacao", "associacao_lider"]}
                associationCategory="carro"
              >
                <div>Tela Carros Protegida</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Mototáxi Redirecionado")).toBeInTheDocument();
    });
    expect(screen.queryByText("Tela Carros Protegida")).not.toBeInTheDocument();
  });

  it("AdminCarrosPrecoPage: edita fórmula inline (Taxa Única, Valor/km, Gatilho) e persiste via admin_update_carro_pricing_config", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "carro_pricing_config") {
        return buildQueryChain({
          data: {
            taxa_unica: 10,
            valor_por_km: 1,
            km_gatilho_ida_volta: 0,
            fator_demanda: 1,
            fator_horario: 1,
            fator_clima: 1,
            subtype_multipliers: { padrao: 1.0 },
            updated_at: "2026-11-27T18:00:00Z",
          },
          error: null,
        });
      }
      return buildQueryChain({ data: null, error: null });
    });

    rpcMock.mockImplementation(async (fn: string, params: any) => {
      if (fn === "admin_update_carro_pricing_config") {
        return {
          data: {
            taxa_unica: params.p_taxa_unica,
            valor_por_km: params.p_valor_por_km,
            km_gatilho_ida_volta: params.p_km_gatilho_ida_volta,
            fator_demanda: params.p_fator_demanda,
            fator_horario: params.p_fator_horario,
            fator_clima: params.p_fator_clima,
            subtype_multipliers: params.p_subtype_multipliers,
            updated_at: "2026-11-27T19:30:00Z",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter>
        <AdminCarrosPrecoPage />
      </MemoryRouter>,
    );

    const taxaFormulaInput = await screen.findByLabelText("Fórmula Taxa Única");
    const kmFormulaInput = screen.getByLabelText("Fórmula Valor por km");
    const gatilhoFormulaInput = screen.getByLabelText("Fórmula Gatilho Ida e Volta");

    expect(screen.getByText(/Subtipos de Veículo/i)).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();

    fireEvent.change(taxaFormulaInput, { target: { value: "14,50" } });
    fireEvent.change(kmFormulaInput, { target: { value: "2,25" } });
    fireEvent.change(gatilhoFormulaInput, { target: { value: "12" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("admin_update_carro_pricing_config", {
        p_taxa_unica: 14.5,
        p_valor_por_km: 2.25,
        p_km_gatilho_ida_volta: 12,
        p_fator_demanda: 1,
        p_fator_horario: 1,
        p_fator_clima: 1,
        p_subtype_multipliers: { padrao: 1.0 },
      });
    });
  });

  it("AdminCarrosAssociacaoPage: Superadmin vê dropdown + coluna Associação e Associação dispara comunicado via admin_send_carro_associacao_mass_message", async () => {
    // 1. Visão Superadmin
    rpcMock.mockImplementation(async (fn: string, params?: any) => {
      if (fn === "admin_get_carro_associacao_overview") {
        const filterId = params?.p_associacao_id ?? null;
        return {
          data: {
            caller_role: "super_admin",
            caller_associacao_id: null,
            associacoes: [CARRO_ASSOC_A, CARRO_ASSOC_B],
            motoristas: filterId
              ? CARRO_MOTORISTAS.filter((m) => m.associacao_id === filterId)
              : CARRO_MOTORISTAS,
            mensagens_recentes: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const { unmount } = render(
      <MemoryRouter>
        <AdminCarrosAssociacaoPage />
      </MemoryRouter>,
    );

    const dropdown = await screen.findByLabelText("Filtrar Associação");
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Associação" })).toBeInTheDocument();
    expect(screen.getByText("Rafael Motorista Carro")).toBeInTheDocument();
    expect(screen.getByText("Diego Litoral")).toBeInTheDocument();

    fireEvent.change(dropdown, { target: { value: "carro-assoc-1" } });

    await waitFor(() => {
      expect(screen.getByText("Dados da Associação")).toBeInTheDocument();
    });
    expect(screen.getByText(CARRO_ASSOC_A.cnpj)).toBeInTheDocument();
    expect(screen.queryByText("Diego Litoral")).not.toBeInTheDocument();

    unmount();

    // 2. Visão Associação + Disparo de Comunicado em Massa
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_send_carro_associacao_mass_message") {
        return { data: { id: "cmsg-1", total_destinatarios: 1 }, error: null };
      }
      return {
        data: {
          caller_role: "associacao",
          caller_associacao_id: "carro-assoc-1",
          associacoes: [CARRO_ASSOC_A],
          motoristas: CARRO_MOTORISTAS.filter((m) => m.associacao_id === "carro-assoc-1"),
          mensagens_recentes: [],
        },
        error: null,
      };
    });

    render(
      <MemoryRouter>
        <AdminCarrosAssociacaoPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: CARRO_ASSOC_A.nome });
    expect(screen.queryByLabelText("Filtrar Associação")).not.toBeInTheDocument();
    expect(screen.getByText(CARRO_ASSOC_A.presidente_nome)).toBeInTheDocument();
    expect(screen.getByText(formatDataFiliacao("2025-04-12T12:00:00Z"))).toBeInTheDocument();
    expect(buildWhatsAppLink("12997771122")).toBe("https://wa.me/5512997771122");

    fireEvent.click(screen.getByLabelText("Selecionar Rafael Motorista Carro"));
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar Mensagem em Massa \(App\) \(1\)/i }),
    );

    fireEvent.change(await screen.findByLabelText(/Assunto \/ Título/i), {
      target: { value: "Vistoria de Frota Carros" },
    });
    fireEvent.change(screen.getByLabelText(/Mensagem/i), {
      target: { value: "Compareçam segunda-feira às 10h com CRLV." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Disparar Comunicado no App/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("admin_send_carro_associacao_mass_message", {
        p_associacao_id: "carro-assoc-1",
        p_titulo: "Vistoria de Frota Carros",
        p_conteudo: "Compareçam segunda-feira às 10h com CRLV.",
        p_destinatario_ids: ["car-drv-1"],
      });
    });
  });

  it("Telas transversais: Financeiro reconhece service_type='carro' como 'Carros' e KYC lista candidatos de prestador_carro", async () => {
    // 1. AdminFinanceiroPage
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_list_financial_transactions") {
        return {
          data: [
            {
              id: "tx-car-1001",
              service_type: "carro",
              service_id: "ride-car-01",
              total_amount: 45.0,
              provider_amount: 40.5,
              ubt_amount: 3.38,
              entity_amount: 0.22,
              prize_worker_amount: 0.23,
              prize_consumer_amount: 0.22,
              godparent_tomador_amount: 0.22,
              godparent_prestador_amount: 0.23,
              status: "approved",
              payment_method: "pix",
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    fromMock.mockImplementation(() => buildQueryChain({ data: [], error: null }));

    const { unmount } = render(
      <MemoryRouter>
        <AdminFinanceiroPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Carros · #RIDE-CAR via PIX/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "Carros" })).toBeInTheDocument();

    unmount();

    // 2. AdminKycListPage
    const carroUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "prestador_carro") {
        return {
          ...buildQueryChain({
            data: [
              {
                user_id: "cand-carro-1",
                kyc_status: "pending",
                plate: "CAR9A99",
                model: "Onix Plus 2023",
                created_at: "2026-11-27T15:00:00Z",
              },
            ],
            error: null,
          }),
          update: carroUpdateMock,
        };
      }
      if (table === "prestador_mototaxi") {
        return buildQueryChain({ data: [], error: null });
      }
      if (table === "usuarios") {
        return buildQueryChain({
          data: [
            {
              id: "cand-carro-1",
              nome: "Lucas Motorista Onix",
              email: "lucas.carro@ubt.app",
              role: "prestador",
            },
          ],
          error: null,
        });
      }
      return buildQueryChain({ data: [], error: null });
    });

    render(
      <MemoryRouter>
        <AdminKycListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Lucas Motorista Onix")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Carros").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(carroUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ kyc_status: "approved" }),
      );
    });
  });
});
