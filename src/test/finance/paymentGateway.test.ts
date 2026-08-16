/**
 * CENÁRIOS A + B — Payment Gateway Integration Tests
 *
 * Tests the full payment-gateway flow using the injectable simulator.
 * No real network calls, no Deno runtime, no Supabase connection.
 *
 * Cenário A: PIX intent succeeds → split calculated, audit logged, pagamentos_split persisted.
 * Cenário B: PIX intent fails (bad payload / MP rejection) → error audited, app does not crash.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runPaymentGateway,
  type GatewayDeps,
  type AuditLogEntry,
  type CreatePixIntentRequest,
  type MpPixResponse,
} from "./gatewaySimulator";
import { REGULATORY_DEFAULTS } from "../../lib/finance/splitEngine";

// ============================================================
// FACTORY — reusable mock deps
// ============================================================
function makeDeps(overrides: Partial<GatewayDeps> = {}): {
  deps: GatewayDeps;
  capturedLogs: AuditLogEntry[];
  capturedSplitRecord: ReturnType<GatewayDeps["upsertSplitRecord"]> extends Promise<infer T> ? T : never;
} {
  const capturedLogs: AuditLogEntry[] = [];

  // Default successful MP response for PIX
  const defaultMpResponse: MpPixResponse = {
    id: 9988776655,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    point_of_interaction: {
      transaction_data: {
        ticket_url:     "https://sandbox.mercadopago.com.br/sandbox/payments/ticket/9988776655",
        qr_code:        "00020126580014BR.GOV.BCB.PIX0136aaa-bbb-ccc",
        qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6...",
      },
    },
  };

  const deps: GatewayDeps = {
    getSplitConfig:    vi.fn().mockResolvedValue(REGULATORY_DEFAULTS),
    callMercadoPago:   vi.fn().mockResolvedValue({ data: defaultMpResponse, status: 200 }),
    writeAuditLog:     vi.fn().mockResolvedValue(undefined),
    upsertSplitRecord: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };

  return { deps, capturedLogs, capturedSplitRecord: { ok: true } as any };
}

// ============================================================
// VALID BASE REQUEST
// ============================================================
const VALID_REQUEST: CreatePixIntentRequest = {
  action:             "create_payment_intent",
  transaction_amount: 100.00,
  description:        "Corrida UBT Mototáxi #123",
  payer_email:        "tomador@ubt.com.br",
  service_type:       "mototaxi",
  service_id:         "550e8400-e29b-41d4-a716-446655440001",
  external_reference: "pedido_550e8400_ts_1723000000000",
};

// ============================================================
// CENÁRIO A — Successful PIX Intent with Split
// ============================================================
describe("Cenário A · PIX Intent — Sucesso com Split e Auditoria", () => {

  describe("A-GW-01 · Split calculation sent to MP (application_fee)", () => {
    it("calls Mercado Pago with correct application_fee (10% of R$100 = R$10)", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const mpCallArgs = (deps.callMercadoPago as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(mpCallArgs.application_fee).toBe(10.00);
    });

    it("calls Mercado Pago with pix payment_method_id", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const mpCallArgs = (deps.callMercadoPago as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(mpCallArgs.payment_method_id).toBe("pix");
    });

    it("sends external_reference to Mercado Pago for traceability", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const mpCallArgs = (deps.callMercadoPago as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(mpCallArgs.external_reference).toBe(VALID_REQUEST.external_reference);
    });
  });

  describe("A-GW-02 · pagamentos_split record persisted correctly", () => {
    it("upserts pagamentos_split with correct amounts", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const upsertArgs = (deps.upsertSplitRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertArgs.provider_amount).toBe(90.00);
      expect(upsertArgs.ubt_amount).toBe(5.00);
      expect(upsertArgs.entity_amount).toBe(2.00);
      expect(upsertArgs.prize_worker_amount).toBe(1.00);
      expect(upsertArgs.prize_consumer_amount).toBe(1.00);
      expect(upsertArgs.godparent_amount).toBe(1.00);
    });

    it("upserts pagamentos_split with correct transaction_id (external_reference)", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const upsertArgs = (deps.upsertSplitRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertArgs.transaction_id).toBe(VALID_REQUEST.external_reference);
    });

    it("sets status to 'pending' in pagamentos_split on initial creation", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const upsertArgs = (deps.upsertSplitRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertArgs.status).toBe("pending");
    });

    it("falls back to mp_{id} as transaction_id when external_reference is absent", async () => {
      const { deps, capturedLogs } = makeDeps();
      const reqWithoutRef = { ...VALID_REQUEST, external_reference: undefined };
      await runPaymentGateway(reqWithoutRef, deps, capturedLogs);

      const upsertArgs = (deps.upsertSplitRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertArgs.transaction_id).toBe("mp_9988776655");
    });
  });

  describe("A-GW-03 · Audit trail written to financial_audit_logs", () => {
    it("writes 'split_calculated' log BEFORE calling Mercado Pago", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const splitCalcLog = capturedLogs.find((l) => l.transaction_type === "split_calculated");
      expect(splitCalcLog).toBeDefined();
      expect(splitCalcLog!.status).toBe("pending");
    });

    it("'split_calculated' log contains split_amounts payload", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const splitCalcLog = capturedLogs.find((l) => l.transaction_type === "split_calculated");
      expect(splitCalcLog!.payload?.split_amounts).toBeDefined();
    });

    it("writes 'pix_intent' log after Mercado Pago responds", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const pixLog = capturedLogs.find((l) => l.transaction_type === "pix_intent");
      expect(pixLog).toBeDefined();
      expect(pixLog!.status).toBe("pending"); // mirrors mpData.status
    });

    it("writes 'split_registered' log after successful pagamentos_split upsert", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const regLog = capturedLogs.find((l) => l.transaction_type === "split_registered");
      expect(regLog).toBeDefined();
    });

    it("split_calculated is logged before pix_intent (audit ordering)", async () => {
      const { deps, capturedLogs } = makeDeps();
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);

      const splitIdx = capturedLogs.findIndex((l) => l.transaction_type === "split_calculated");
      const pixIdx   = capturedLogs.findIndex((l) => l.transaction_type === "pix_intent");
      expect(splitIdx).toBeLessThan(pixIdx);
    });
  });

  describe("A-GW-04 · Response shape", () => {
    it("returns HTTP 200 on success", async () => {
      const { deps, capturedLogs } = makeDeps();
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect(result.httpStatus).toBe(200);
    });

    it("response body contains pix.qr_code", async () => {
      const { deps, capturedLogs } = makeDeps();
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect((result.body.pix as any).qr_code).toBe("00020126580014BR.GOV.BCB.PIX0136aaa-bbb-ccc");
    });

    it("response body contains split.application_fee = R$10.00", async () => {
      const { deps, capturedLogs } = makeDeps();
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect((result.body.split as any).application_fee).toBe(10.00);
    });

    it("response body contains split.prestador_amount = R$90.00", async () => {
      const { deps, capturedLogs } = makeDeps();
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect((result.body.split as any).prestador_amount).toBe(90.00);
    });
  });
});

// ============================================================
// CENÁRIO B — Failures: non-throwing, always audited
// ============================================================
describe("Cenário B · PIX Intent — Falhas capturadas sem quebrar a aplicação", () => {

  describe("B-GW-01 · Input validation rejections (400)", () => {
    it("rejects missing transaction_amount with 400", async () => {
      const { deps, capturedLogs } = makeDeps();
      const bad = { ...VALID_REQUEST, transaction_amount: 0 };
      const result = await runPaymentGateway(bad, deps, capturedLogs);
      expect(result.httpStatus).toBe(400);
      expect(result.body.error).toContain("transaction_amount");
    });

    it("rejects invalid payer_email with 400", async () => {
      const { deps, capturedLogs } = makeDeps();
      const bad = { ...VALID_REQUEST, payer_email: "not-an-email" };
      const result = await runPaymentGateway(bad, deps, capturedLogs);
      expect(result.httpStatus).toBe(400);
    });

    it("rejects missing service_id with 400", async () => {
      const { deps, capturedLogs } = makeDeps();
      const bad = { ...VALID_REQUEST, service_id: "" };
      const result = await runPaymentGateway(bad, deps, capturedLogs);
      expect(result.httpStatus).toBe(400);
    });

    it("rejects invalid service_type with 400", async () => {
      const { deps, capturedLogs } = makeDeps();
      const bad = { ...VALID_REQUEST, service_type: "drone" as any };
      const result = await runPaymentGateway(bad, deps, capturedLogs);
      expect(result.httpStatus).toBe(400);
    });

    it("does NOT call Mercado Pago when input is invalid", async () => {
      const { deps, capturedLogs } = makeDeps();
      const bad = { ...VALID_REQUEST, transaction_amount: -10 };
      await runPaymentGateway(bad, deps, capturedLogs);
      expect(deps.callMercadoPago).not.toHaveBeenCalled();
    });
  });

  describe("B-GW-02 · Mercado Pago API rejection (4xx)", () => {
    it("returns 422 when MP returns 422", async () => {
      const { deps, capturedLogs } = makeDeps({
        callMercadoPago: vi.fn().mockResolvedValue({
          data: { error: "bad_request", message: "Invalid email format", status: "rejected" },
          status: 422,
        }),
      });
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect(result.httpStatus).toBe(422);
    });

    it("audit log 'pix_intent' is written even when MP rejects", async () => {
      const { deps, capturedLogs } = makeDeps({
        callMercadoPago: vi.fn().mockResolvedValue({
          data: { error: "bad_request", message: "mp error" },
          status: 400,
        }),
      });
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      const pixLog = capturedLogs.find((l) => l.transaction_type === "pix_intent");
      expect(pixLog).toBeDefined();
    });

    it("does NOT upsert pagamentos_split when MP rejects the payment", async () => {
      const { deps, capturedLogs } = makeDeps({
        callMercadoPago: vi.fn().mockResolvedValue({
          data: { error: "unauthorized", message: "Invalid access token" },
          status: 401,
        }),
      });
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect(deps.upsertSplitRecord).not.toHaveBeenCalled();
    });
  });

  describe("B-GW-03 · pagamentos_split persistence failure (non-blocking)", () => {
    it("still returns HTTP 200 even when pagamentos_split upsert fails", async () => {
      const { deps, capturedLogs } = makeDeps({
        upsertSplitRecord: vi.fn().mockResolvedValue({ ok: false, error: "DB connection timeout" }),
      });
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      // The payment was approved by MP — we must not block the user
      expect(result.httpStatus).toBe(200);
    });

    it("writes 'split_persist_failed' audit log when upsert fails", async () => {
      const { deps, capturedLogs } = makeDeps({
        upsertSplitRecord: vi.fn().mockResolvedValue({ ok: false, error: "DB connection timeout" }),
      });
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      const failLog = capturedLogs.find((l) => l.transaction_type === "split_persist_failed");
      expect(failLog).toBeDefined();
      expect(failLog!.error_details).toContain("timeout");
    });
  });

  describe("B-GW-04 · Unhandled exception (non-throwing guarantee)", () => {
    it("catches and audits unexpected errors without crashing", async () => {
      const { deps, capturedLogs } = makeDeps({
        callMercadoPago: vi.fn().mockRejectedValue(new Error("Network unreachable")),
      });
      const result = await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      expect(result.httpStatus).toBe(500);
      expect(result.body.error).toContain("Internal server error");
    });

    it("writes crash audit log on unhandled exception", async () => {
      const { deps, capturedLogs } = makeDeps({
        callMercadoPago: vi.fn().mockRejectedValue(new Error("SSL handshake failed")),
      });
      await runPaymentGateway(VALID_REQUEST, deps, capturedLogs);
      const crashLog = capturedLogs.find((l) => l.transaction_type === "unknown");
      expect(crashLog).toBeDefined();
      expect(crashLog!.status).toBe("failed");
    });
  });
});
