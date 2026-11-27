import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { rpcMock, toastShowMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toastShowMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("@/components/admin/AdminToast", () => ({
  useAdminToast: () => ({ show: toastShowMock }),
}));

import AdminMototaxiAssociacaoPage, {
  formatDataFiliacao,
  buildWhatsAppLink,
} from "@/pages/admin/AdminMototaxiAssociacaoPage";
import { MOTOTAXI_NAV_ITEMS } from "@/layouts/AdminLayout";

const ASSOC_A = {
  id: "assoc-1",
  cnpj: "12.345.678/0001-90",
  nome: "Associação Mototáxi Centro Ubatuba",
  endereco_sede: "Av. Iperoig, 450 - Centro, Ubatuba/SP",
  presidente_nome: "Carlos Eduardo Silva",
  presidente_cpf: "123.456.789-00",
  email_oficial: "contato@mototaxicentro.org.br",
  telefone_responsavel: "12991234567",
  categoria: "mototaxi",
  total_motoristas: 2,
};

const ASSOC_B = {
  id: "assoc-2",
  cnpj: "98.765.432/0001-10",
  nome: "Associação Mototáxi Itaguá",
  endereco_sede: "Rua Guarani, 120 - Itaguá, Ubatuba/SP",
  presidente_nome: "Marcos Pereira",
  presidente_cpf: "321.654.987-11",
  email_oficial: "itagua@mototaxi.org.br",
  telefone_responsavel: "12998887777",
  categoria: "mototaxi",
  total_motoristas: 1,
};

const MOTORISTAS = [
  {
    id: "drv-1",
    nome: "João Mototaxista",
    email: "joao@ubt.com",
    telefone: "12997776655",
    status: "ativo",
    associacao_id: "assoc-1",
    associacao_nome: ASSOC_A.nome,
    data_filiacao: "2025-03-15T12:00:00Z",
  },
  {
    id: "drv-2",
    nome: "Pedro Mototaxista",
    email: "pedro@ubt.com",
    telefone: "12996665544",
    status: "ativo",
    associacao_id: "assoc-1",
    associacao_nome: ASSOC_A.nome,
    data_filiacao: "2025-08-20T12:00:00Z",
  },
  {
    id: "drv-3",
    nome: "Lucas Itaguá",
    email: "lucas@ubt.com",
    telefone: "12995554433",
    status: "ativo",
    associacao_id: "assoc-2",
    associacao_nome: ASSOC_B.nome,
    data_filiacao: "2026-01-10T12:00:00Z",
  },
];

describe("Admin de Associações de Mototaxistas (v1.8.12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Perfil Associação: exibe os 7 campos cadastrais, motoristas com 'desde DD/MM/AAAA' + WhatsApp, oculta dropdown e oculta Preço Dinâmico no menu", async () => {
    rpcMock.mockResolvedValue({
      data: {
        caller_role: "associacao",
        caller_associacao_id: "assoc-1",
        associacoes: [ASSOC_A],
        motoristas: MOTORISTAS.filter((m) => m.associacao_id === "assoc-1"),
        mensagens_recentes: [],
      },
      error: null,
    });

    // Verifica RBAC do menu Mototaxistas para perfil 'associacao'
    const assocMenuLabels = MOTOTAXI_NAV_ITEMS.filter((item) =>
      item.roles.includes("associacao"),
    ).map((item) => item.label);
    expect(assocMenuLabels).toEqual(["Dashboard", "Associação"]);
    expect(assocMenuLabels).not.toContain("Tarifas & Preço Dinâmico");

    render(
      <MemoryRouter>
        <AdminMototaxiAssociacaoPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(ASSOC_A.nome)).toBeInTheDocument();
    });

    // 7 campos cadastrais
    expect(screen.getByText(ASSOC_A.cnpj)).toBeInTheDocument();
    expect(screen.getByText(ASSOC_A.endereco_sede)).toBeInTheDocument();
    expect(screen.getByText(ASSOC_A.presidente_nome)).toBeInTheDocument();
    expect(screen.getByText(ASSOC_A.presidente_cpf)).toBeInTheDocument();
    expect(screen.getByText(ASSOC_A.email_oficial)).toBeInTheDocument();
    expect(screen.getByText("(12) 99123-4567")).toBeInTheDocument();

    // Dropdown de troca de associação oculto para perfil associacao
    expect(screen.queryByLabelText("Filtrar Associação")).not.toBeInTheDocument();

    // Motoristas com 'desde DD/MM/AAAA' e botão WhatsApp
    expect(screen.getByText("João Mototaxista")).toBeInTheDocument();
    expect(screen.getByText(formatDataFiliacao("2025-03-15T12:00:00Z"))).toBeInTheDocument();
    const waLinks = screen.getAllByRole("link", { name: /WhatsApp/i });
    expect(waLinks.length).toBeGreaterThanOrEqual(2);
    expect(buildWhatsAppLink("12997776655")).toBe("https://wa.me/5512997776655");
  });

  it("Perfil Superadmin: exibe dropdown, mostra coluna 'Associação' em 'Todas as Associações' e exibe dados ao filtrar por uma associação", async () => {
    rpcMock.mockImplementation(async (_fn: string, params?: { p_associacao_id?: string | null }) => {
      const filterId = params?.p_associacao_id ?? null;
      return {
        data: {
          caller_role: "super_admin",
          caller_associacao_id: null,
          associacoes: [ASSOC_A, ASSOC_B],
          motoristas: filterId
            ? MOTORISTAS.filter((m) => m.associacao_id === filterId)
            : MOTORISTAS,
          mensagens_recentes: [],
        },
        error: null,
      };
    });

    render(
      <MemoryRouter>
        <AdminMototaxiAssociacaoPage />
      </MemoryRouter>,
    );

    const dropdown = await screen.findByLabelText("Filtrar Associação");
    expect(dropdown).toBeInTheDocument();

    // Em "Todas as Associações", coluna "Associação" aparece na tabela
    await waitFor(() => {
      expect(screen.getByText("João Mototaxista")).toBeInTheDocument();
    });
    expect(screen.getByRole("columnheader", { name: "Associação" })).toBeInTheDocument();
    expect(screen.getByText("Lucas Itaguá")).toBeInTheDocument();

    // Ao filtrar por ASSOC_A, exibe os dados cadastrais da ASSOC_A e oculta Lucas Itaguá
    fireEvent.change(dropdown, { target: { value: "assoc-1" } });

    await waitFor(() => {
      expect(screen.getByText("Dados da Associação")).toBeInTheDocument();
    });
    expect(screen.getByText(ASSOC_A.cnpj)).toBeInTheDocument();
    expect(screen.queryByText("Lucas Itaguá")).not.toBeInTheDocument();
  });

  it("Ações em massa: abre modal de Comunicado In-App e dispara RPC admin_send_associacao_mass_message com destinatários selecionados", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_send_associacao_mass_message") {
        return { data: { id: "msg-1", total_destinatarios: 1 }, error: null };
      }
      return {
        data: {
          caller_role: "associacao",
          caller_associacao_id: "assoc-1",
          associacoes: [ASSOC_A],
          motoristas: MOTORISTAS.filter((m) => m.associacao_id === "assoc-1"),
          mensagens_recentes: [],
        },
        error: null,
      };
    });

    render(
      <MemoryRouter>
        <AdminMototaxiAssociacaoPage />
      </MemoryRouter>,
    );

    await screen.findByText("João Mototaxista");

    // Seleciona apenas João Mototaxista
    fireEvent.click(screen.getByLabelText("Selecionar João Mototaxista"));
    fireEvent.click(screen.getByRole("button", { name: /Enviar Mensagem em Massa \(App\) \(1\)/i }));

    const titleInput = await screen.findByLabelText(/Assunto \/ Título/i);
    const contentInput = screen.getByLabelText(/Mensagem/i);

    fireEvent.change(titleInput, { target: { value: "Assembleia Geral" } });
    fireEvent.change(contentInput, { target: { value: "Compareçam sexta às 19h na sede." } });
    fireEvent.click(screen.getByRole("button", { name: /Disparar Comunicado no App/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("admin_send_associacao_mass_message", {
        p_associacao_id: "assoc-1",
        p_titulo: "Assembleia Geral",
        p_conteudo: "Compareçam sexta às 19h na sede.",
        p_destinatario_ids: ["drv-1"],
      });
    });
  });
});
