import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  deduplicatePaymentHistory,
  paymentToTransaction,
  type PaymentHistoryRow,
} from "@/services/PaymentHistoryService";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

vi.mock("@/components/admin/AdminToast", () => ({
  useAdminToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/services/AnalyticsService", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/services/LoggingService", () => ({
  logSystem: vi.fn(),
}));

import AdminFinanceiroPage from "@/pages/admin/AdminFinanceiroPage";

function buildHistoryRow(overrides: Partial<PaymentHistoryRow> = {}): PaymentHistoryRow {
  return {
    payment_id: "pay-1",
    transaction_id: "tx-1",
    payment_status: "approved",
    service_id: "ride-6523",
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
    origin: { address: "Centro" },
    destination: { address: "Itaguá" },
    distance_km: 2.1,
    duration_min: 7,
    ride_type: "carona",
    ride_status: "paid",
    payment_method: "card",
    ...overrides,
  };
}

describe("Idempotência Cartão/PIX + Admin Financeiro Real (v1.8.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nunca duplica corrida liquidada no cartão quando há tentativa PIX pending anterior para o mesmo service_id", () => {
    const cardApproved = buildHistoryRow({
      payment_id: "85cdbfa2",
      transaction_id: "tx-card",
      payment_status: "approved",
      payment_method: "card",
      provider_amount: 3.06,
    });
    const stalePixPending = buildHistoryRow({
      payment_id: "19cc6fb5",
      transaction_id: "tx-pix",
      payment_status: "pending",
      payment_method: "pix",
      provider_amount: 3.06,
      ride_status: "paid",
    });

    const deduped = deduplicatePaymentHistory([cardApproved, stalePixPending]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].payment_id).toBe("85cdbfa2");
    expect(deduped[0].payment_method).toBe("card");
  });

  it("nunca promove pagamento pending para confirmed apenas porque ride_status === 'paid'", () => {
    const pendingRow = buildHistoryRow({
      payment_id: "pending-only",
      payment_status: "pending",
      ride_status: "paid",
    });

    const tx = paymentToTransaction(pendingRow);
    expect(tx.status).toBe("pending");
  });

  it("carrega GMV real, receita UBT e transações PIX + Cartão em /admin/financeiro via admin_list_financial_transactions", async () => {
    const nowIso = new Date().toISOString();
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "85cdbfa2-68e2-470f-8d09-14a5222c3d47",
          transaction_id: "b663b1e7",
          gateway_payment_id: "191805808594",
          service_id: "6523d066-aa97-420f-802e-30ab0cfd9a39",
          service_type: "mototaxi",
          payment_method: "card",
          status: "approved",
          total_amount: 3.57,
          base_amount: 3.4,
          provider_amount: 3.06,
          ubt_amount: 0.25,
          entity_amount: 0.02,
          prize_worker_amount: 0.02,
          prize_consumer_amount: 0.01,
          godparent_amount: 0.04,
          godparent_tomador_amount: 0.02,
          godparent_prestador_amount: 0.02,
          payment_route: "seller_oauth_split",
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: "68b329bf-20a3-45a8-ad01-e57f0d797543",
          transaction_id: "7958e3e2",
          gateway_payment_id: "191789331592",
          service_id: "23810be8-5b63-4545-9fd9-286b39153384",
          service_type: "mototaxi",
          payment_method: "pix",
          status: "approved",
          total_amount: 1.26,
          base_amount: 1.25,
          provider_amount: 1.12,
          ubt_amount: 0.09,
          entity_amount: 0.01,
          prize_worker_amount: 0.01,
          prize_consumer_amount: 0,
          godparent_amount: 0.02,
          godparent_tomador_amount: 0.01,
          godparent_prestador_amount: 0.01,
          payment_route: "seller_oauth_split",
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: "a3082bd5-d03c-4c10-9192-0e9cd4ec8655",
          transaction_id: "57d16bb4",
          gateway_payment_id: "190516276225",
          service_id: "0eae3ae7-fc3a-438b-8ff8-799cdc412710",
          service_type: "mototaxi",
          payment_method: "pix",
          status: "approved",
          total_amount: 1.57,
          base_amount: 1.55,
          provider_amount: 1.39,
          ubt_amount: 0.11,
          entity_amount: 0.01,
          prize_worker_amount: 0.01,
          prize_consumer_amount: 0.01,
          godparent_amount: 0.02,
          godparent_tomador_amount: 0.01,
          godparent_prestador_amount: 0.01,
          payment_route: "platform_fallback",
          created_at: nowIso,
          updated_at: nowIso,
        },
      ],
      error: null,
    });

    fromMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    render(
      <MemoryRouter>
        <AdminFinanceiroPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("R$ 6,40")).toBeInTheDocument();
    });
    expect(screen.getByText("R$ 0,45")).toBeInTheDocument();
    expect(screen.getByText("3 Lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Cartão")).toBeInTheDocument();
    expect(screen.getAllByText("PIX").length).toBeGreaterThanOrEqual(2);
  });
});
