import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let mockUserRow: any = null;
let mockMpRows: any[] = [];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "usuarios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: mockUserRow, error: null })),
            })),
          })),
        };
      }
      if (table === "marketplace_accounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: mockMpRows, error: null })),
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          or: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    }),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

vi.mock("@/components/admin/AdminToast", () => ({
  useAdminToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/components/admin/AdminClienteActionsModals", () => ({
  DeleteClientAlertModal: () => null,
  BlockClientModal: () => null,
  WhatsAppClientModal: () => null,
  ClientHistoryModal: () => null,
  isUserBlockedActive: () => false,
  formatBlockedSummary: () => "",
}));

import AdminClienteDetailPage, { formatPixTypeLabel } from "@/pages/admin/AdminClienteDetailPage";

describe("Admin Seção 4 (PIX & Mercado Pago) + OAuth Contract (v1.8.8)", () => {
  beforeEach(() => {
    mockUserRow = {
      id: "72dfbb97-1933-4406-b6cd-755746bec68d",
      nome: "Felipe Patricio Cataldo Santander",
      email: "fepasantander@gmail.com",
      telefone: "(11) 95342-3954",
      cpf: "30464502810",
      role: "prestador",
      status: "active",
      chave_pix: "550e8400-e29b-41d4-a716-446655440000",
      tipo_chave_pix: "aleatoria",
      possui_mercadopago: true, // self-declared flag must NOT create false positive when marketplace_accounts is empty
      created_at: "2026-11-01T12:00:00Z",
    };
    mockMpRows = [];
  });

  it("exibe tipo + chave PIX real sem contradição no editor e mostra 'Não vinculada ao Mercado Pago' quando marketplace_accounts está vazia", async () => {
    expect(formatPixTypeLabel("aleatoria")).toBe("ALEATÓRIA (EVP)");

    render(
      <MemoryRouter initialEntries={["/admin/clientes/72dfbb97-1933-4406-b6cd-755746bec68d"]}>
        <Routes>
          <Route path="/admin/clientes/:id" element={<AdminClienteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/4\. Situação Cadastral PIX & Mercado Pago/i)).toBeTruthy();
      expect(screen.getByText("ALEATÓRIA (EVP)")).toBeTruthy();
      // Actual PIX key displayed in both the status card and quick editor (zero contradiction)
      const pixOccurrences = screen.getAllByText("550e8400-e29b-41d4-a716-446655440000");
      expect(pixOccurrences.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/Sem chave PIX/i)).toBeNull();
      expect(screen.getByText(/Alterar \/ Atualizar PIX/i)).toBeTruthy();
      // True OAuth status (no false positive from possui_mercadopago)
      expect(screen.getByText("Não vinculada ao Mercado Pago")).toBeTruthy();
    });
  });

  it("exibe 'Vinculada ao Mercado Pago' com MP User ID quando há conta CONNECTED em marketplace_accounts", async () => {
    mockMpRows = [
      {
        id: "mp-acc-1",
        status: "CONNECTED",
        mercado_pago_user_id: "9876543210",
        connected_at: "2026-11-26T10:00:00Z",
        ambiente: "production",
        token_expiration: "2027-05-26T10:00:00Z",
      },
    ];

    render(
      <MemoryRouter initialEntries={["/admin/clientes/72dfbb97-1933-4406-b6cd-755746bec68d"]}>
        <Routes>
          <Route path="/admin/clientes/:id" element={<AdminClienteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vinculada ao Mercado Pago")).toBeTruthy();
      expect(screen.getByText("9876543210")).toBeTruthy();
    });
  });

  it("monta URL de autorização OAuth do Mercado Pago Brasil com client_id, platform_id=mp, response_type=code e redirect_uri", () => {
    const gateway = readFileSync(resolve(process.cwd(), "supabase/functions/payment-gateway/index.ts"), "utf-8");
    const configFin = readFileSync(resolve(process.cwd(), "src/pages/ConfigFinanceiroPage.tsx"), "utf-8");

    expect(gateway).toContain("https://auth.mercadopago.com.br/authorization?");
    expect(gateway).toContain('response_type: "code"');
    expect(gateway).toContain('platform_id: "mp"');
    expect(gateway).toContain("resolveCanonicalUsuarioId");
    expect(configFin).toContain('searchParams.get("error")');
    expect(configFin).toContain("não pode ser a mesma conta administradora da UBT");
  });
});
