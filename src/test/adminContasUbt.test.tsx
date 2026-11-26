import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const rpcMock = vi.fn();
let mockAccounts: any[] = [];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockAccounts, error: null })),
          })),
        })),
      })),
    })),
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

vi.mock("@/components/admin/AdminToast", () => ({
  useAdminToast: () => ({ show: vi.fn() }),
}));

import AdminContasUbtPage from "@/pages/admin/AdminContasUbtPage";

describe("Admin Financeiro — Contas & Chaves PIX UBT (v1.8.9)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    mockAccounts = [
      {
        id: "acc-1",
        apelido: "Conta Principal UBT (Mercado Pago)",
        instituicao: "Mercado Pago (323)",
        titular_nome: "UBT Plataforma Digital Ltda",
        titular_documento: "68.394.558/0001-32",
        tipo_chave_pix: "cnpj",
        chave_pix: "68.394.558/0001-32",
        finalidade: "principal_recebimento",
        mp_user_id: "3593998633",
        is_primary: true,
        is_active: true,
        observacoes: "Conta oficial",
        created_at: "2026-11-26T12:00:00Z",
        updated_at: "2026-11-26T12:00:00Z",
      },
      {
        id: "acc-2",
        apelido: "Conta Fundo Prêmios",
        instituicao: "Banco Inter (077)",
        titular_nome: "UBT Plataforma Digital Ltda",
        titular_documento: "68.394.558/0001-32",
        tipo_chave_pix: "aleatoria",
        chave_pix: "550e8400-e29b-41d4-a716-446655440000",
        finalidade: "fundo_premios",
        mp_user_id: null,
        is_primary: false,
        is_active: true,
        observacoes: null,
        created_at: "2026-11-26T12:10:00Z",
        updated_at: "2026-11-26T12:10:00Z",
      },
    ];
  });

  it("exibe a Conta Principal Ativa com chave CNPJ, MP Collector ID e lista todas as contas cadastradas", async () => {
    render(<AdminContasUbtPage />);

    await waitFor(() => {
      expect(screen.getByText(/CONTA PRINCIPAL ATIVA/i)).toBeTruthy();
      expect(screen.getAllByText(/Conta Principal UBT \(Mercado Pago\)/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("68.394.558/0001-32").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("3593998633").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Conta Fundo Prêmios")).toBeTruthy();
      expect(screen.getByText("550e8400-e29b-41d4-a716-446655440000")).toBeTruthy();
    });
  });

  it("permite definir outra conta como Principal chamando admin_set_primary_platform_bank_account", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    render(<AdminContasUbtPage />);

    await waitFor(() => {
      expect(screen.getByText("Definir Principal")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Definir Principal"));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("admin_set_primary_platform_bank_account", {
        p_account_id: "acc-2",
      });
    });
  });

  it("permite abrir modal 'Adicionar Nova Conta UBT' e cadastrar nova conta com chave PIX", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    render(<AdminContasUbtPage />);

    await waitFor(() => {
      expect(screen.getByText(/Adicionar Nova Conta UBT/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Adicionar Nova Conta UBT/i));

    const apelidoInput = screen.getByPlaceholderText(/Ex\.: Conta Fundo Prêmios/i);
    fireEvent.change(apelidoInput, { target: { value: "Conta Reserva Operacional" } });

    const pixInput = screen.getByPlaceholderText("00.000.000/0000-00");
    fireEvent.change(pixInput, { target: { value: "68.394.558/0001-32" } });

    fireEvent.click(screen.getByText("Cadastrar Conta"));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "admin_upsert_platform_bank_account",
        expect.objectContaining({
          p_apelido: "Conta Reserva Operacional",
          p_tipo_chave_pix: "cnpj",
          p_chave_pix: "68.394.558/0001-32",
        }),
      );
    });
  });
});
