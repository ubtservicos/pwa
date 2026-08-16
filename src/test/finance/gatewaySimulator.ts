/**
 * UBT Finance — Gateway Mock Simulator
 *
 * Self-contained in-process simulator of the payment-gateway Edge Function.
 * Mirrors the real handler logic using injected mocks instead of Deno.env / fetch.
 * Used exclusively by the Vitest test suite — no real network calls.
 */

import type { SplitConfig, SplitAmounts } from "../../lib/finance/splitEngine";
import { calculateSplitAmounts, REGULATORY_DEFAULTS } from "../../lib/finance/splitEngine";

// ============================================================
// TYPES
// ============================================================

export type ServiceType = "mototaxi" | "diarista" | "ambulante";

export interface CreatePixIntentRequest {
  action:             "create_payment_intent";
  transaction_amount: number;
  description:        string;
  payer_email:        string;
  service_type:       ServiceType;
  service_id:         string;
  external_reference?: string;
  entity_id?:          string;
  godparent_id?:       string;
}

export interface AuditLogEntry {
  transaction_type: string;
  status:           string;
  payload?:         Record<string, unknown>;
  error_details?:   string;
}

export interface SplitRecord {
  transaction_id:       string;
  status:               string;
  service_type:         ServiceType;
  service_id:           string;
  total_amount:         number;
  provider_amount:      number;
  ubt_amount:           number;
  entity_amount:        number;
  prize_worker_amount:  number;
  prize_consumer_amount: number;
  godparent_amount:     number;
  entity_id?:           string | null;
  godparent_id?:        string | null;
}

export interface MpPixResponse {
  id?:              number;
  status?:          string;
  status_detail?:   string;
  point_of_interaction?: {
    transaction_data?: {
      ticket_url?:     string;
      qr_code?:        string;
      qr_code_base64?: string;
    };
  };
  error?:           string;
  message?:         string;
}

export interface GatewayDeps {
  /** Returns the split config to apply (mock the DB read) */
  getSplitConfig:   () => Promise<SplitConfig>;
  /** Calls Mercado Pago (or returns a mock response) */
  callMercadoPago:  (payload: Record<string, unknown>) => Promise<{ data: MpPixResponse; status: number }>;
  /** Writes to financial_audit_logs */
  writeAuditLog:    (entry: AuditLogEntry) => Promise<void>;
  /** Upserts into pagamentos_split */
  upsertSplitRecord: (record: SplitRecord) => Promise<{ ok: boolean; error?: string }>;
}

export interface GatewayResult {
  httpStatus:        number;
  body:              Record<string, unknown>;
  auditLogs:         AuditLogEntry[];
  splitRecord?:      SplitRecord;
  split?:            SplitAmounts;
}

// ============================================================
// GATEWAY SIMULATOR — injectable dependency version
// ============================================================
export async function runPaymentGateway(
  req: CreatePixIntentRequest,
  deps: GatewayDeps,
  capturedLogs: AuditLogEntry[]
): Promise<GatewayResult> {
  const writeAudit = async (entry: AuditLogEntry) => {
    capturedLogs.push(entry);
    await deps.writeAuditLog(entry);
  };

  try {
    // --- Input validation (mirrors Edge Function exactly) ---
    if (typeof req.transaction_amount !== "number" || req.transaction_amount <= 0) {
      return { httpStatus: 400, body: { error: "Invalid transaction_amount. Must be a positive number." }, auditLogs: capturedLogs };
    }
    if (!req.description) {
      return { httpStatus: 400, body: { error: "Missing or invalid description." }, auditLogs: capturedLogs };
    }
    if (!req.payer_email || !req.payer_email.includes("@")) {
      return { httpStatus: 400, body: { error: "Missing or invalid payer_email." }, auditLogs: capturedLogs };
    }
    if (!req.service_id) {
      return { httpStatus: 400, body: { error: "Missing service_id." }, auditLogs: capturedLogs };
    }
    const validTypes: ServiceType[] = ["mototaxi", "diarista", "ambulante"];
    if (!validTypes.includes(req.service_type)) {
      return { httpStatus: 400, body: { error: `Invalid service_type.` }, auditLogs: capturedLogs };
    }

    // --- Fetch split config ---
    const splitConfig = await deps.getSplitConfig();

    // --- Calculate split ---
    const split = calculateSplitAmounts(req.transaction_amount, splitConfig);

    // --- Audit: split_calculated (BEFORE calling MP) ---
    await writeAudit({
      transaction_type: "split_calculated",
      status: "pending",
      payload: {
        external_reference:  req.external_reference ?? null,
        service_type:        req.service_type,
        split_amounts:       split,
      },
    });

    // --- Call Mercado Pago ---
    const mpPayload: Record<string, unknown> = {
      transaction_amount:  req.transaction_amount,
      description:         req.description,
      payment_method_id:   "pix",
      payer:               { email: req.payer_email },
      application_fee:     split.application_fee,
      ...(req.external_reference ? { external_reference: req.external_reference } : {}),
    };

    const { data: mpData, status: mpStatus } = await deps.callMercadoPago(mpPayload);

    // --- Audit: raw MP response ---
    await writeAudit({
      transaction_type: "pix_intent",
      status: mpData.status ?? (mpStatus >= 400 ? "failed" : "unknown"),
      payload: mpData as Record<string, unknown>,
      ...(mpData.error ? { error_details: `[${mpData.error}] ${mpData.message ?? ""}` } : {}),
    });

    // --- Handle MP errors ---
    if (mpStatus >= 400 || mpData.error) {
      return {
        httpStatus: mpStatus >= 400 ? mpStatus : 502,
        body: {
          error:  "Payment provider rejected the request.",
          detail: mpData.message ?? mpData.error ?? "Unknown MP error",
        },
        auditLogs: capturedLogs,
        split,
      };
    }

    // --- Persist split record ---
    const transactionId = req.external_reference ?? `mp_${mpData.id}`;
    const splitRecord: SplitRecord = {
      transaction_id:        transactionId,
      status:                "pending",
      service_type:          req.service_type,
      service_id:            req.service_id,
      total_amount:          split.total_amount,
      provider_amount:       split.prestador_amount,
      ubt_amount:            split.ubt_amount,
      entity_amount:         split.comunidade_amount,
      prize_worker_amount:   split.premio_trabalhador,
      prize_consumer_amount: split.premio_consumidor,
      godparent_amount:      split.padrinho_amount,
      entity_id:             req.entity_id ?? null,
      godparent_id:          req.godparent_id ?? null,
    };

    const { ok: splitOk, error: splitError } = await deps.upsertSplitRecord(splitRecord);

    if (!splitOk) {
      await writeAudit({
        transaction_type: "split_persist_failed",
        status: "error",
        error_details: splitError,
      });
    } else {
      await writeAudit({
        transaction_type: "split_registered",
        status: "pending",
        payload: { transaction_id: transactionId, split_amounts: split },
      });
    }

    // --- Return ---
    const txData = mpData.point_of_interaction?.transaction_data;
    return {
      httpStatus: 200,
      body: {
        success: true,
        pix: {
          payment_id:         mpData.id,
          status:             mpData.status,
          external_reference: req.external_reference ?? null,
          ticket_url:         txData?.ticket_url    ?? null,
          qr_code:            txData?.qr_code       ?? null,
          qr_code_base64:     txData?.qr_code_base64 ?? null,
        },
        split: {
          total_amount:       split.total_amount,
          prestador_amount:   split.prestador_amount,
          application_fee:    split.application_fee,
          ubt_amount:         split.ubt_amount,
          comunidade_amount:  split.comunidade_amount,
          premio_trabalhador: split.premio_trabalhador,
          premio_consumidor:  split.premio_consumidor,
          padrinho_amount:    split.padrinho_amount,
        },
      },
      auditLogs: capturedLogs,
      splitRecord,
      split,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeAudit({ transaction_type: "unknown", status: "failed", error_details: msg });
    return {
      httpStatus: 500,
      body: { error: "Internal server error. Incident logged." },
      auditLogs: capturedLogs,
    };
  }
}

// ============================================================
// WEBHOOK SIMULATOR — injectable dependency version
// ============================================================

export interface WebhookBody {
  id?:     number;
  type?:   string;
  action?: string;
  data?:   { id?: string | number };
}

export interface WebhookDeps {
  verifySignature:    (body: string, headers: Record<string, string>) => boolean;
  claimEvent:         (eventId: string, paymentId: string) => Promise<"claimed" | "duplicate" | "error">;
  fetchMpPayment:     (paymentId: string) => Promise<{ data: MpPixResponse & { external_reference?: string; date_approved?: string }; status: number }>;
  writeAuditLog:      (entry: AuditLogEntry) => Promise<void>;
  updateSplitStatus:  (transactionId: string, status: string, dateApproved?: string) => Promise<{ updated: boolean; alreadyApproved?: boolean }>;
  markEventDone:      (eventId: string, status: "completed" | "failed", error?: string) => Promise<void>;
}

export interface WebhookResult {
  httpStatus:  number;
  body:        Record<string, unknown>;
  auditLogs:   AuditLogEntry[];
}

export async function runWebhookHandler(
  rawBody: string,
  headers: Record<string, string>,
  deps: WebhookDeps,
  capturedLogs: AuditLogEntry[]
): Promise<WebhookResult> {
  const writeAudit = async (entry: AuditLogEntry) => {
    capturedLogs.push(entry);
    await deps.writeAuditLog(entry);
  };

  try {
    // [1] Signature validation
    const sigValid = deps.verifySignature(rawBody, headers);
    if (!sigValid) {
      await writeAudit({ transaction_type: "webhook_rejected", status: "security_rejected" });
      return { httpStatus: 401, body: { error: "Unauthorized: invalid webhook signature." }, auditLogs: capturedLogs };
    }

    // [2] Parse body
    let webhookBody: WebhookBody;
    try { webhookBody = JSON.parse(rawBody); }
    catch {
      await writeAudit({ transaction_type: "webhook_parse_error", status: "failed" });
      return { httpStatus: 400, body: { error: "Invalid JSON body." }, auditLogs: capturedLogs };
    }

    const { type, action, data } = webhookBody;

    // [3] Log raw receipt
    await writeAudit({ transaction_type: "webhook_received", status: "processing", payload: webhookBody as Record<string, unknown> });

    // [4] Only process payment events
    if (type !== "payment" || !data?.id) {
      return { httpStatus: 200, body: { success: true, message: "Event acknowledged but not processed." }, auditLogs: capturedLogs };
    }

    const paymentId = String(data.id);
    const eventId   = String(webhookBody.id ?? `${type}_${paymentId}`);

    // [5] Idempotency guard
    const claimResult = await deps.claimEvent(eventId, paymentId);
    if (claimResult === "duplicate") {
      return { httpStatus: 200, body: { success: true, message: "Duplicate event — already processed." }, auditLogs: capturedLogs };
    }
    if (claimResult === "error") {
      return { httpStatus: 500, body: { error: "Internal server error. Incident logged." }, auditLogs: capturedLogs };
    }

    // [6] Anti-spoofing: verify with MP API
    const { data: mpPayment, status: mpStatus } = await deps.fetchMpPayment(paymentId);
    if (mpStatus >= 400 || mpPayment.error) {
      await deps.markEventDone(eventId, "failed", mpPayment.message);
      await writeAudit({ transaction_type: "webhook_verification_failed", status: "failed" });
      return { httpStatus: 502, body: { error: "Could not verify payment with Mercado Pago." }, auditLogs: capturedLogs };
    }

    const verifiedStatus = mpPayment.status ?? "unknown";

    // [7] Audit: verified update
    await writeAudit({
      transaction_type: "webhook_payment_update",
      status: verifiedStatus,
      payload: { payment_id: mpPayment.id, status: mpPayment.status, external_reference: mpPayment.external_reference },
    });

    // [8] Orchestration (only on approved)
    if (verifiedStatus === "approved" && mpPayment.external_reference) {
      const { updated, alreadyApproved } = await deps.updateSplitStatus(
        mpPayment.external_reference,
        "approved",
        mpPayment.date_approved
      );

      if (alreadyApproved) {
        await writeAudit({ transaction_type: "order_fulfillment_skipped", status: "already_approved" });
      } else if (updated) {
        await writeAudit({ transaction_type: "order_fulfilled", status: "approved",
          payload: { external_reference: mpPayment.external_reference, payment_id: mpPayment.id } });
      }
    }

    // [9] Mark done
    await deps.markEventDone(eventId, "completed");

    return {
      httpStatus: 200,
      body: { success: true, payment_id: mpPayment.id, verified_status: verifiedStatus },
      auditLogs: capturedLogs,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeAudit({ transaction_type: "webhook_crash", status: "failed", error_details: msg });
    return { httpStatus: 500, body: { error: "Internal server error. Incident logged." }, auditLogs: capturedLogs };
  }
}
