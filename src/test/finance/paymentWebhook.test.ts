/**
 * CENÁRIO C — Webhook: Idempotência e Orquestração
 *
 * Tests the full payment-webhook flow using the injectable simulator.
 * No real network calls, no Deno runtime, no Supabase connection.
 *
 * Cenário C covers:
 *   C1 — Webhook processing: valid signature, anti-spoofing fetch, audit logs
 *   C2 — Idempotência: duplo envio do mesmo event_id ignorado via constraint única
 *   C3 — Orquestração: pagamentos_split updated to 'approved' when MP confirms
 *   C4 — Security: invalid signatures, spoofing attempts blocked
 *   C5 — Edge cases: non-payment events, missing external_reference
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runWebhookHandler,
  type WebhookDeps,
  type AuditLogEntry,
} from "./gatewaySimulator";

// ============================================================
// FACTORY — reusable mock deps
// ============================================================
function makeWebhookDeps(overrides: Partial<WebhookDeps> = {}): {
  deps: WebhookDeps;
  capturedLogs: AuditLogEntry[];
} {
  const capturedLogs: AuditLogEntry[] = [];

  const defaultMpPayment = {
    id: 9988776655,
    status: "approved",
    status_detail: "accredited",
    external_reference: "pedido_abc_ts_1723000000000",
    date_approved: "2026-08-15T12:00:00.000-03:00",
  };

  const deps: WebhookDeps = {
    verifySignature:   vi.fn().mockReturnValue(true),
    claimEvent:        vi.fn().mockResolvedValue("claimed"),
    fetchMpPayment:    vi.fn().mockResolvedValue({ data: defaultMpPayment, status: 200 }),
    writeAuditLog:     vi.fn().mockResolvedValue(undefined),
    updateSplitStatus: vi.fn().mockResolvedValue({ updated: true, alreadyApproved: false }),
    markEventDone:     vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { deps, capturedLogs };
}

// ============================================================
// VALID WEBHOOK PAYLOADS
// ============================================================
const VALID_PAYMENT_EVENT = JSON.stringify({
  id: 1001,
  type: "payment",
  action: "payment.updated",
  data: { id: "9988776655" },
  live_mode: false,
  api_version: "v1",
});

const VALID_HEADERS = { "content-type": "application/json", "x-signature": "ts=1723000000,v1=abc123" };

// ============================================================
// CENÁRIO C1 — Processamento normal de webhook válido
// ============================================================
describe("Cenário C1 · Webhook — Processamento Normal de Evento Válido", () => {

  it("returns HTTP 200 for a valid payment webhook", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("writes 'webhook_received' audit log with status 'processing'", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "webhook_received");
    expect(log).toBeDefined();
    expect(log!.status).toBe("processing");
  });

  it("calls Mercado Pago API to verify payment (anti-spoofing)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.fetchMpPayment).toHaveBeenCalledWith("9988776655");
  });

  it("writes 'webhook_payment_update' log with verified status from MP", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "webhook_payment_update");
    expect(log).toBeDefined();
    expect(log!.status).toBe("approved");
  });

  it("marks event as 'completed' after successful processing", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.markEventDone).toHaveBeenCalledWith("1001", "completed");
  });

  it("response contains verified_status from MP API", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.body.verified_status).toBe("approved");
  });
});

// ============================================================
// CENÁRIO C2 — Idempotência: duplo envio ignorado com segurança
// ============================================================
describe("Cenário C2 · Webhook — Idempotência (Duplo Envio do Mesmo event_id)", () => {

  it("returns HTTP 200 (not an error) when event_id is a duplicate", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      claimEvent: vi.fn().mockResolvedValue("duplicate"),
    });
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(200);
  });

  it("body indicates 'already processed' on duplicate", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      claimEvent: vi.fn().mockResolvedValue("duplicate"),
    });
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(String(result.body.message)).toContain("already processed");
  });

  it("does NOT call Mercado Pago API on duplicate event (no side effects)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      claimEvent: vi.fn().mockResolvedValue("duplicate"),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.fetchMpPayment).not.toHaveBeenCalled();
  });

  it("does NOT call updateSplitStatus on duplicate event (idempotent: no DB mutation)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      claimEvent: vi.fn().mockResolvedValue("duplicate"),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.updateSplitStatus).not.toHaveBeenCalled();
  });

  it("does NOT mark event done on duplicate (event was already marked)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      claimEvent: vi.fn().mockResolvedValue("duplicate"),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.markEventDone).not.toHaveBeenCalled();
  });

  it("already_approved state is skipped idempotently without re-updating DB", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      updateSplitStatus: vi.fn().mockResolvedValue({ updated: false, alreadyApproved: true }),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);

    const skipLog = capturedLogs.find((l) => l.transaction_type === "order_fulfillment_skipped");
    expect(skipLog).toBeDefined();
    expect(skipLog!.status).toBe("already_approved");
  });
});

// ============================================================
// CENÁRIO C3 — Orquestração: pagamentos_split updated on approval
// ============================================================
describe("Cenário C3 · Webhook — Orquestração ao Receber Pagamento Aprovado", () => {

  it("calls updateSplitStatus with 'approved' status when MP confirms payment", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.updateSplitStatus).toHaveBeenCalledWith(
      "pedido_abc_ts_1723000000000",
      "approved",
      "2026-08-15T12:00:00.000-03:00"
    );
  });

  it("writes 'order_fulfilled' audit log with status 'approved'", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "order_fulfilled");
    expect(log).toBeDefined();
    expect(log!.status).toBe("approved");
  });

  it("'order_fulfilled' log contains the external_reference for traceability", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "order_fulfilled");
    expect(log!.payload?.external_reference).toBe("pedido_abc_ts_1723000000000");
  });

  it("does NOT call updateSplitStatus when payment is 'pending' (not approved yet)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      fetchMpPayment: vi.fn().mockResolvedValue({
        data: { id: 9988776655, status: "pending", status_detail: "pending_waiting_transfer", external_reference: "pedido_abc" },
        status: 200,
      }),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.updateSplitStatus).not.toHaveBeenCalled();
  });

  it("does NOT call updateSplitStatus when payment is 'rejected'", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      fetchMpPayment: vi.fn().mockResolvedValue({
        data: { id: 9988776655, status: "rejected", status_detail: "cc_rejected_bad_filled_card_number", external_reference: "pedido_abc" },
        status: 200,
      }),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.updateSplitStatus).not.toHaveBeenCalled();
  });
});

// ============================================================
// CENÁRIO C4 — Segurança: assinaturas inválidas e spoofing
// ============================================================
describe("Cenário C4 · Webhook — Segurança: Assinaturas Inválidas e Spoofing", () => {

  it("returns HTTP 401 when signature validation fails", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      verifySignature: vi.fn().mockReturnValue(false),
    });
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(401);
  });

  it("writes 'webhook_rejected' audit log on signature failure", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      verifySignature: vi.fn().mockReturnValue(false),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "webhook_rejected");
    expect(log).toBeDefined();
    expect(log!.status).toBe("security_rejected");
  });

  it("never calls Mercado Pago API when signature is invalid", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      verifySignature: vi.fn().mockReturnValue(false),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(deps.fetchMpPayment).not.toHaveBeenCalled();
    expect(deps.updateSplitStatus).not.toHaveBeenCalled();
  });

  it("returns HTTP 502 when Mercado Pago verification fetch fails (spoofing guard)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      fetchMpPayment: vi.fn().mockResolvedValue({
        data: { error: "not_found", message: "Payment not found" },
        status: 404,
      }),
    });
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(502);
  });

  it("writes 'webhook_verification_failed' log when MP verification fails", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      fetchMpPayment: vi.fn().mockResolvedValue({
        data: { error: "unauthorized", message: "Invalid token" },
        status: 401,
      }),
    });
    await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "webhook_verification_failed");
    expect(log).toBeDefined();
  });
});

// ============================================================
// CENÁRIO C5 — Edge cases: eventos não-pagamento, body inválido
// ============================================================
describe("Cenário C5 · Webhook — Edge Cases", () => {

  it("returns 200 and acknowledges non-payment events without processing", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    const subscriptionEvent = JSON.stringify({ id: 2001, type: "subscription", data: { id: "sub_123" } });
    const result = await runWebhookHandler(subscriptionEvent, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(200);
    expect(deps.fetchMpPayment).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    const result = await runWebhookHandler("not-json{{{{", VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(400);
  });

  it("writes 'webhook_parse_error' on invalid JSON", async () => {
    const { deps, capturedLogs } = makeWebhookDeps();
    await runWebhookHandler("not-json{{{{", VALID_HEADERS, deps, capturedLogs);
    const log = capturedLogs.find((l) => l.transaction_type === "webhook_parse_error");
    expect(log).toBeDefined();
  });

  it("catches and logs unhandled exceptions without crashing (HTTP 500)", async () => {
    const { deps, capturedLogs } = makeWebhookDeps({
      fetchMpPayment: vi.fn().mockRejectedValue(new Error("TCP connection reset by peer")),
    });
    const result = await runWebhookHandler(VALID_PAYMENT_EVENT, VALID_HEADERS, deps, capturedLogs);
    expect(result.httpStatus).toBe(500);
    const crashLog = capturedLogs.find((l) => l.transaction_type === "webhook_crash");
    expect(crashLog).toBeDefined();
  });
});
