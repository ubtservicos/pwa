import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MototaxiErrorBoundary from "@/components/mototaxi/MototaxiErrorBoundary";

// Mock Supabase & heavy map/confetti dependencies for deterministic render tests
const maybeSingleMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleMock,
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: "s1" }, error: null })) })) })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: { success: true, paid: false }, error: null })) },
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    uid: "72dfbb97-1933-4406-b6cd-755746bec68d",
    name: "Mototaxista Teste",
    role: "prestador",
    kycStatus: "approved",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useRealtimeChannel", () => ({
  useRealtimeChannel: vi.fn(),
}));

vi.mock("@/hooks/useMototaxiQuickMessages", () => ({
  useMototaxiQuickMessages: () => ({
    messages: [],
    status: "connected",
    isSending: false,
    error: null,
    sendMessage: vi.fn(),
  }),
}));

vi.mock("@/components/prestador/PrestadorMapLight", () => ({
  default: () => <div data-testid="mock-map" />,
}));

vi.mock("@/components/ui/FullscreenConfetti", () => ({
  FullscreenConfetti: () => null,
}));

vi.mock("@/services/FinancialFeeService", () => ({
  DEFAULT_FEE_SETTINGS: { taxaPixPct: 0.99, taxaCardPct: 4.98 },
  fetchGatewayFeeSettings: () => Promise.resolve({ taxaPixPct: 0.99, taxaCardPct: 4.98 }),
  calculatePaymentWithFee: (base: number) => ({
    basePrice: base,
    feePct: 0.99,
    feeAmount: +(base * 0.0099).toFixed(2),
    totalAmount: +(base * 1.0099).toFixed(2),
  }),
}));

import PrestadorMototaxiActive from "@/pages/PrestadorMototaxiActive";

describe("Mototáxi — Aceite, Renderização Segura e Sincronização (v1.8.6)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    maybeSingleMock.mockReset();
  });

  it("exibe estado de recuperação explícito (nunca tela preta vazia) quando não há corrida ativa", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    render(
      <MemoryRouter initialEntries={["/app/prestador/mototaxi/active"]}>
        <Routes>
          <Route path="/app/prestador/mototaxi/active" element={<PrestadorMototaxiActive />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Corrida não encontrada/i)).toBeTruthy();
      expect(screen.getByText(/Voltar para Online/i)).toBeTruthy();
    });
  });

  it("transita de loading (ride=null) para corrida aceita sem violação de Hooks (#310) mesmo com campos parciais", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "0eae3ae7-fc3a-438b-8ff8-799cdc412710",
        type: "carona",
        status: "accepted",
        origin: { address: "Rua Pescada, Jardim Carolina, Ubatuba - SP", lat: -23.43, lng: -45.08 },
        destination: { address: "Rua Delfim, Jardim Carolina, Ubatuba - SP", lat: -23.42, lng: -45.07 },
        distance_km: 1.1,
        duration_min: 4,
        estimated_price: 1.55,
        final_price: null,
        payment_method: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/app/prestador/mototaxi/active/0eae3ae7-fc3a-438b-8ff8-799cdc412710"]}>
        <Routes>
          <Route path="/app/prestador/mototaxi/active/:id" element={<PrestadorMototaxiActive />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/A caminho do cliente/i)).toBeTruthy();
      expect(screen.getByText(/Rua Pescada, Jardim Carolina, Ubatuba - SP/i)).toBeTruthy();
    });
  });

  it("renderiza estado completed com 'Você recebeu' alinhado ao split canônico de 90%", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "ride-completed-155",
        type: "carona",
        status: "completed",
        origin: { address: "Rua Pescada, Jardim Carolina", lat: -23.43, lng: -45.08 },
        destination: { address: "Rua Delfim, Jardim Carolina", lat: -23.42, lng: -45.07 },
        distance_km: 1.1,
        duration_min: 4,
        estimated_price: 1.55,
        final_price: 1.55,
        payment_method: "pix",
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/app/prestador/mototaxi/active/ride-completed-155"]}>
        <Routes>
          <Route path="/app/prestador/mototaxi/active/:id" element={<PrestadorMototaxiActive />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Serviço finalizado!/i)).toBeTruthy();
      expect(screen.getByText(/Você recebeu/i)).toBeTruthy();
      // Both "Você recebeu" and "Prestador (90%)" must display the exact same canonical split amount (R$ 1,39)
      const matches = screen.getAllByText(/R\$\s*1,39/);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("MototaxiErrorBoundary captura exceção de render e exibe card de recuperação em vez de tela preta", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const CrashChild = () => {
      throw new Error("Simulated render crash");
    };

    render(
      <MototaxiErrorBoundary fallbackLabel="Voltar para Online">
        <CrashChild />
      </MototaxiErrorBoundary>,
    );

    expect(screen.getByText(/Algo deu errado na tela da corrida/i)).toBeTruthy();
    expect(screen.getByText(/Simulated render crash/i)).toBeTruthy();
    expect(screen.getByText(/Tentar novamente/i)).toBeTruthy();
    spy.mockRestore();
  });
});
