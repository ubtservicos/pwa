import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const {
  fetchPricingMock,
  savePricingMock,
  fetchHistoryMock,
  downloadPdfMock,
  shareWhatsAppMock,
  toastShowMock,
} = vi.hoisted(() => ({
  fetchPricingMock: vi.fn(),
  savePricingMock: vi.fn(),
  fetchHistoryMock: vi.fn(),
  downloadPdfMock: vi.fn(),
  shareWhatsAppMock: vi.fn(),
  toastShowMock: vi.fn(),
}));

vi.mock("@/services/MototaxiPricingService", () => ({
  fetchMototaxiPricingConfig: fetchPricingMock,
  saveMototaxiPricingConfig: savePricingMock,
}));

vi.mock("@/components/admin/AdminToast", () => ({
  useAdminToast: () => ({ show: toastShowMock }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ uid: "provider-1", name: "Mototaxista Teste" }),
}));

vi.mock("@/services/PaymentHistoryService", async () => {
  const actual = await vi.importActual<typeof import("@/services/PaymentHistoryService")>(
    "@/services/PaymentHistoryService",
  );
  return {
    ...actual,
    fetchUserPaymentHistory: fetchHistoryMock,
  };
});

vi.mock("@/utils/receiptPdf", async () => {
  const actual = await vi.importActual<typeof import("@/utils/receiptPdf")>("@/utils/receiptPdf");
  return {
    ...actual,
    downloadReceiptPdf: downloadPdfMock,
    shareReceiptViaWhatsApp: shareWhatsAppMock,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

import AdminPrecoPage from "@/pages/admin/AdminPrecoPage";
import TransacaoDetailPage from "@/pages/TransacaoDetailPage";
import { buildReceiptWhatsAppText } from "@/utils/receiptPdf";

describe("UX & Funcionalidades v1.8.11 — Preço Dinâmico Inline + Comprovante PDF/WhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite edição inline na Fórmula Canônica Ativa e salva taxa_unica, valor_por_km e km_gatilho_ida_volta", async () => {
    fetchPricingMock.mockResolvedValue({
      taxaUnica: 1.0,
      valorPorKm: 0.5,
      kmGatilhoIdaVolta: 8,
      fatorDemanda: 1.0,
      fatorHorario: 1.0,
      fatorClima: 1.0,
      updatedAt: "2026-11-27T12:00:00Z",
    });
    savePricingMock.mockImplementation(async (cfg: any) => ({
      ...cfg,
      updatedAt: "2026-11-27T13:30:00Z",
    }));

    render(
      <MemoryRouter>
        <AdminPrecoPage />
      </MemoryRouter>,
    );

    const taxaInline = await screen.findByLabelText("Taxa Única na fórmula");
    const kmInline = screen.getByLabelText("Valor por km na fórmula");
    const gatilhoInline = screen.getByLabelText("Gatilho de Ida e Volta na fórmula");

    fireEvent.change(taxaInline, { target: { value: "4,50" } });
    fireEvent.change(kmInline, { target: { value: "2.25" } });
    fireEvent.change(gatilhoInline, { target: { value: "10" } });

    const saveButtons = screen.getAllByRole("button", { name: /Salvar Tarifas/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(savePricingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taxaUnica: 4.5,
          valorPorKm: 2.25,
          kmGatilhoIdaVolta: 10,
        }),
      );
    });
  });

  it("exibe botões 'Baixar Comprovante (PDF)' e 'Enviar por WhatsApp' no detalhe da transação em Gerenciar", async () => {
    fetchHistoryMock.mockResolvedValue([
      {
        payment_id: "pay-85cd",
        transaction_id: "tx-b663b1e7",
        payment_status: "approved",
        service_id: "6523d066-aa97-420f-802e-30ab0cfd9a39",
        service_type: "mototaxi",
        total_amount: 3.57,
        provider_amount: 3.06,
        ubt_amount: 0.25,
        entity_amount: 0.02,
        prize_worker_amount: 0.02,
        prize_consumer_amount: 0.01,
        godparent_amount: 0.04,
        payment_route: "seller_oauth_split",
        paid_at: "2026-11-26T20:10:19.000Z",
        participant_role: "prestador",
        origin: { address: "Rua Pescada, Jardim Carolina" },
        destination: { address: "Rua Delfim, Jardim Carolina" },
        distance_km: 1.8,
        duration_min: 6,
        ride_type: "carona",
        ride_status: "paid",
        payment_method: "card",
      },
    ]);
    shareWhatsAppMock.mockResolvedValue("fallback");

    render(
      <MemoryRouter initialEntries={["/app/gerenciar/pay-85cd"]}>
        <Routes>
          <Route path="/app/gerenciar/:id" element={<TransacaoDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const pdfBtn = await screen.findByRole("button", { name: /Baixar Comprovante \(PDF\)/i });
    const waBtn = screen.getByRole("button", { name: /Enviar por WhatsApp/i });

    fireEvent.click(pdfBtn);
    expect(downloadPdfMock).toHaveBeenCalledTimes(1);
    expect(downloadPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pay-85cd",
        paymentMethodLabel: "Cartão",
        statusLabel: "Confirmado",
        amount: 3.06,
      }),
    );

    fireEvent.click(waBtn);
    await waitFor(() => {
      expect(shareWhatsAppMock).toHaveBeenCalledTimes(1);
    });
  });

  it("formata resumo de WhatsApp com cabeçalho UBT, serviço, pagamento e divisão de split", () => {
    const text = buildReceiptWhatsAppText({
      id: "pay-85cd",
      serviceId: "6523d066-aa97-420f-802e-30ab0cfd9a39",
      transactionId: "b663b1e7-5531",
      statusLabel: "Confirmado",
      dateLabel: "26 de novembro de 2026",
      timeLabel: "17:10",
      typeLabel: "Entrada",
      description: "Corrida Mototáxi UBT",
      paymentMethodLabel: "Cartão",
      durationLabel: "6 min",
      origin: "Rua Pescada",
      destination: "Rua Delfim",
      amount: 3.06,
      splits: [
        { label: "Prestador", percent: "90", amount: 3.06 },
        { label: "UBT Plataforma", percent: "7,5", amount: 0.25 },
      ],
    });

    expect(text).toContain("UBT Serviços · Comprovante de Serviço");
    expect(text).toContain("#6523D066");
    expect(text).toContain("Cartão");
    expect(text).toContain("Como foi dividido");
  });
});
