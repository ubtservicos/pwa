import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as verticalFlags from "@/config/verticalFlags";
import { calculateCarroQuote } from "@/utils/ride";
import {
  deduplicatePaymentHistory,
  paymentToTransaction,
  type PaymentHistoryRow,
} from "@/services/PaymentHistoryService";
import {
  CarVehicleDetailsCard,
  mergeCarVehicleDetails,
} from "@/components/carros/CarVehicleDetailsCard";

const { navigateMock, rpcMock, getUserMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    uid: "user-carro-1",
    name: "Passageiro Ubatuba",
    role: "tomador",
    status: "active",
    kycStatus: "none",
    carroKycStatus: "none",
    isLoading: false,
  }),
  setCurrentUid: vi.fn(),
}));

vi.mock("@/components/notifications/InAppNotificationBell", () => ({
  default: () => null,
}));

vi.mock("@/components/app/GuidedOnboarding", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    rpc: rpcMock,
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.ubt/doc.jpg" } }),
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

import AppHome from "@/pages/AppHome";
import PrestadorCarroOnboarding from "@/pages/PrestadorCarroOnboarding";

describe("Vertical Carros — Fluxo App Tomador, Prestador KYC, Atributos e Extrato (v1.9.1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
    rpcMock.mockReset();
    window.scrollTo = vi.fn();
    getUserMock.mockResolvedValue({
      data: { user: { id: "driver-1", user_metadata: {} } },
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_my_carro_profile") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "submit_carro_kyc") {
        return Promise.resolve({
          data: { ok: true, kyc_status: "pending", record: { kyc_status: "pending" } },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("habilita 'carros' em Produção, Homologação e Local e calcula tarifa canônica com multiplicador de subtipo", () => {
    const prodCtx = {
      appEnv: "production",
      hostname: "ubtservicos.vercel.app",
      supabaseUrl: "https://bfqidoduceusbqlnrsol.supabase.co",
      envOverrides: {},
    };
    const homologCtx = {
      appEnv: "",
      hostname: "ubt-homologacao.vercel.app",
      supabaseUrl: "https://xqujubbqcfqxkfczbidq.supabase.co",
      envOverrides: {},
    };

    expect(verticalFlags.isVerticalEnabled("carros", prodCtx)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("carros", homologCtx)).toBe(true);

    const quotePadrao = calculateCarroQuote(
      5,
      {
        taxaUnica: 8.5,
        valorPorKm: 2.0,
        kmGatilhoIdaVolta: 10,
        fatorDemanda: 1,
        fatorHorario: 1,
        fatorClima: 1,
        subtypeMultipliers: { padrao: 1.0, conforto: 1.25 },
      },
      "padrao",
    );
    expect(quotePadrao.precoFinal).toBe(18.5);
    expect(quotePadrao.repassePrestador).toBe(16.65);

    const quoteConforto = calculateCarroQuote(
      5,
      {
        taxaUnica: 8.5,
        valorPorKm: 2.0,
        kmGatilhoIdaVolta: 10,
        fatorDemanda: 1,
        fatorHorario: 1,
        fatorClima: 1,
        subtypeMultipliers: { padrao: 1.0, conforto: 1.25 },
      },
      "conforto",
    );
    expect(quoteConforto.precoFinal).toBe(23.13);
  });

  it("AppHome renderiza o card Carros ativo e navegável para /app/carros mesmo em Produção", () => {
    vi.spyOn(verticalFlags, "isVerticalEnabled").mockImplementation(
      (v) => v !== "diaristas" && v !== "ambulantes",
    );

    render(
      <MemoryRouter initialEntries={["/app/home"]}>
        <AppHome />
      </MemoryRouter>,
    );

    const carrosBtn = screen.getByRole("button", { name: /^Carros$/i });
    expect(carrosBtn).not.toBeDisabled();
    expect(carrosBtn).not.toHaveTextContent("Em breve");

    fireEvent.click(carrosBtn);
    expect(navigateMock).toHaveBeenCalledWith("/app/carros");
  });

  it("PrestadorCarroOnboarding permite envio do KYC com campos descritivos opcionais vazios OU preenchidos (não impeditivos)", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <PrestadorCarroOnboarding />
      </MemoryRouter>,
    );

    // 1. Cenário com campos opcionais vazios
    fireEvent.click(screen.getByRole("button", { name: /^Pessoal$/i }));
    fireEvent.change(screen.getByPlaceholderText("000.000.000-00"), {
      target: { value: "12345678901" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Masculino/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Dados Veículo$/i }));
    fireEvent.change(screen.getByPlaceholderText("ABC-1D23"), {
      target: { value: "ABC1D23" },
    });
    fireEvent.change(screen.getByPlaceholderText("Chevrolet Onix 1.0 Turbo"), {
      target: { value: "Fiat Argo 1.3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Modo$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar Configurações/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "submit_carro_kyc",
        expect.objectContaining({
          p_plate: "ABC-1D23",
          p_brand_model: "Fiat Argo 1.3",
          p_cor: null,
          p_ano: null,
          p_portas: null,
          p_ar_condicionado: false,
          p_cnh_categoria: null,
          p_possui_ear: false,
          p_alvara_municipal: null,
          p_vehicle_subtype: "padrao",
        }),
      );
    });

    unmount();
    rpcMock.mockClear();

    // 2. Cenário com todos os campos descritivos preenchidos
    render(
      <MemoryRouter>
        <PrestadorCarroOnboarding />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Pessoal$/i }));
    fireEvent.change(screen.getByPlaceholderText("000.000.000-00"), {
      target: { value: "12345678901" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Feminino/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Dados Veículo$/i }));
    fireEvent.change(screen.getByPlaceholderText("ABC-1D23"), {
      target: { value: "XYZ9K88" },
    });
    fireEvent.change(screen.getByPlaceholderText("Chevrolet Onix 1.0 Turbo"), {
      target: { value: "Chevrolet Onix LTZ" },
    });
    fireEvent.change(screen.getByPlaceholderText("Prata"), { target: { value: "Branco" } });
    fireEvent.change(screen.getByPlaceholderText("2022"), { target: { value: "2024" } });
    fireEvent.change(screen.getByPlaceholderText("4"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/Categoria da CNH/i), { target: { value: "B" } });
    fireEvent.click(screen.getByLabelText(/Ar-condicionado/i));
    fireEvent.click(screen.getByLabelText(/Possui EAR/i));
    fireEvent.change(screen.getByPlaceholderText("Ex.: UBT-2026-001"), {
      target: { value: "ALV-2026-77" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Modo$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar Configurações/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "submit_carro_kyc",
        expect.objectContaining({
          p_plate: "XYZ-9K88",
          p_brand_model: "Chevrolet Onix LTZ",
          p_cor: "Branco",
          p_ano: 2024,
          p_portas: 4,
          p_ar_condicionado: true,
          p_cnh_categoria: "B",
          p_possui_ear: true,
          p_alvara_municipal: "ALV-2026-77",
        }),
      );
    });
  });

  it("CarVehicleDetailsCard exibe todos os atributos descritivos do carro e omite campos vazios sem null/undefined", () => {
    const fullVehicle = mergeCarVehicleDetails(
      {
        brand_model: "Toyota Corolla XEi",
        plate: "UBT-4A20",
        cor: "Prata",
        ano: 2023,
        portas: 4,
        ar_condicionado: true,
        cnh_categoria: "B",
        possui_ear: true,
        alvara_municipal: "UBT-908",
        vehicle_subtype: "padrao",
        carro_photo_url: "https://cdn.ubt/ext.jpg",
        carro_interno_photo_url: "https://cdn.ubt/int.jpg",
      },
      null,
    );

    const { rerender } = render(
      <CarVehicleDetailsCard
        driver={{
          name: "Carlos Silva",
          plate: "UBT-4A20",
          rating: 4.9,
          vehicle: fullVehicle,
        }}
      />,
    );

    expect(screen.getByText("Carlos Silva")).toBeInTheDocument();
    expect(screen.getByText("Toyota Corolla XEi")).toBeInTheDocument();
    expect(screen.getByText("UBT-4A20")).toBeInTheDocument();
    expect(screen.getByText("Prata")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("4 portas")).toBeInTheDocument();
    expect(screen.getByText("Ar-condicionado")).toBeInTheDocument();
    expect(screen.getByText("CNH Cat. B")).toBeInTheDocument();
    expect(screen.getByText("EAR")).toBeInTheDocument();
    expect(screen.getByText("Alvará UBT-908")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();

    // Parcial: sem campos opcionais preenchidos
    const minimalVehicle = mergeCarVehicleDetails({ brand_model: "VW Gol", plate: "AAA-1111" }, null);
    rerender(
      <CarVehicleDetailsCard
        driver={{ name: "Maria", plate: "AAA-1111", rating: 5, vehicle: minimalVehicle }}
      />,
    );

    const card = screen.getByTestId("car-vehicle-details-card");
    expect(card).toHaveTextContent("VW Gol");
    expect(card).toHaveTextContent("AAA-1111");
    expect(card.textContent).not.toMatch(/null|undefined/i);
    expect(screen.queryByText(/Alvará/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CNH Cat\./i)).not.toBeInTheDocument();
  });

  it("PaymentHistoryService diferencia Corrida Carros UBT de Corrida Mototáxi UBT mantendo deduplicação", () => {
    const baseRow = (overrides: Partial<PaymentHistoryRow>): PaymentHistoryRow => ({
      payment_id: "pay-1",
      transaction_id: "tx-1",
      payment_status: "approved",
      service_id: "srv-11112222",
      service_type: "carro",
      total_amount: 25,
      provider_amount: 22.5,
      ubt_amount: 1.88,
      entity_amount: 0.13,
      prize_worker_amount: 0.13,
      prize_consumer_amount: 0.13,
      godparent_amount: 0.23,
      payment_route: "seller_oauth_split",
      paid_at: "2026-11-27T18:00:00Z",
      participant_role: "prestador",
      origin: { address: "Centro, Ubatuba" },
      destination: { address: "Praia Grande, Ubatuba" },
      distance_km: 6.5,
      duration_min: 14,
      ride_type: "carona",
      ride_status: "paid",
      payment_method: "pix",
      ...overrides,
    });

    const rows: PaymentHistoryRow[] = [
      baseRow({ payment_id: "pay-car-ok", service_id: "car-aaaa1111", service_type: "carro", payment_status: "approved" }),
      baseRow({ payment_id: "pay-car-pending", service_id: "car-aaaa1111", service_type: "carro", payment_status: "pending" }),
      baseRow({ payment_id: "pay-moto-ok", service_id: "moto-bbbb2222", service_type: "mototaxi", payment_status: "approved" }),
    ];

    const deduped = deduplicatePaymentHistory(rows);
    expect(deduped).toHaveLength(2);

    const carroTx = paymentToTransaction(deduped[0]);
    const motoTx = paymentToTransaction(deduped[1]);

    expect(carroTx.description).toContain("Corrida Carros UBT");
    expect(carroTx.serviceType).toBe("carro");
    expect(motoTx.description).toContain("Corrida Mototáxi UBT");
    expect(motoTx.serviceType).toBe("mototaxi");
  });
});
