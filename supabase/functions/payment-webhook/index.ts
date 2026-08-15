import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS / RESPONSE HEADERS
// ============================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-signature, x-request-id",
};

// ============================================================
// SUPABASE CLIENT — service_role for audit writes + orchestration
// ============================================================
const supabaseUrl            = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// TYPES
// ============================================================
interface MercadoPagoWebhookBody {
  id?: number;
  action?: string;
  type?: string;
  data?: { id?: string | number };
  live_mode?: boolean;
  date_created?: string;
  user_id?: string;
  api_version?: string;
}

interface MercadoPagoPaymentDetail {
  id?: number;
  status?: string;           // pending | approved | in_mediation | rejected | refunded | charged_back
  status_detail?: string;
  transaction_amount?: number;
  description?: string;
  payment_method_id?: string;
  external_reference?: string; // Maps back to pagamentos_split.transaction_id
  date_approved?: string | null;
  date_last_updated?: string | null;
  payer?: { email?: string };
  point_of_interaction?: {
    transaction_data?: {
      ticket_url?: string;
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  error?: string;
  message?: string;
}

// ============================================================
// AUDIT LOGGER — non-throwing immutable insert
// ============================================================
async function logAuditEvent({
  transactionType,
  status,
  payload,
  errorDetails,
}: {
  transactionType: string;
  status: string;
  payload?: Record<string, unknown>;
  errorDetails?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("financial_audit_logs").insert({
      transaction_type: transactionType,
      status,
      payload: payload ?? null,
      error_details: errorDetails ?? null,
    });
    if (error) {
      console.error("[payment-webhook] Audit log insert failed:", error.message);
    }
  } catch (logErr) {
    console.error("[payment-webhook] Critical: audit logger threw unexpectedly:", logErr);
  }
}

// ============================================================
// MP PAYMENT VERIFIER — anti-spoofing canonical fetch
// Never trust the webhook body alone; always verify via MP API.
// ============================================================
async function fetchMPPaymentStatus(
  paymentId: string | number
): Promise<{ data: MercadoPagoPaymentDetail; httpStatus: number }> {
  const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN_TEST");
  if (!mpAccessToken) {
    throw new Error("MP_ACCESS_TOKEN_TEST is not configured in Edge Function secrets.");
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${mpAccessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data: MercadoPagoPaymentDetail = await response.json();
  return { data, httpStatus: response.status };
}

// ============================================================
// IDEMPOTENCY GUARD — marketplace_webhook_events
// Checks if this event_id was already processed. If so, returns
// true and the webhook handler returns 200 immediately (no side effects).
// Also writes the event_id atomically to prevent double-processing.
// ============================================================
async function claimWebhookEvent(eventId: string, paymentId: string): Promise<boolean> {
  // Attempt to insert the event. The UNIQUE constraint on event_id will reject duplicates.
  const { error } = await supabaseAdmin.from("marketplace_webhook_events").insert({
    event_id: eventId,
    event_type: "payment",
    external_id: paymentId,
    environment: "sandbox",
    processing_status: "processing",
    attempts: 1,
    payload_hash: await computeSha256(paymentId),
  });

  if (error) {
    // PostgreSQL unique violation code = '23505'
    if (error.code === "23505") {
      console.warn(`[payment-webhook] Duplicate event ${eventId} — skipping (idempotent).`);
      return false; // Already processed
    }
    // Other DB error — re-throw for central handler
    throw new Error(`[payment-webhook] Failed to claim event ${eventId}: ${error.message}`);
  }

  return true; // Newly claimed, safe to process
}

async function markWebhookEventDone(eventId: string, status: "completed" | "failed", errorMsg?: string): Promise<void> {
  await supabaseAdmin
    .from("marketplace_webhook_events")
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
      ...(errorMsg ? { error_message: errorMsg } : {}),
    })
    .eq("event_id", eventId);
}

// ============================================================
// ORCHESTRATION — update pagamentos_split when payment is approved
// This is the core business logic: tie MP approval to our DB record.
// Only fires on status === 'approved'. All other statuses are logged
// in financial_audit_logs but do not alter pagamentos_split.
// ============================================================
async function orchestrateApprovedPayment(mpPayment: MercadoPagoPaymentDetail): Promise<void> {
  const { external_reference, id: mpId, status, date_approved } = mpPayment;

  if (!external_reference) {
    console.warn(`[payment-webhook] MP payment ${mpId} has no external_reference — cannot link to pagamentos_split.`);
    await logAuditEvent({
      transactionType: "order_fulfillment_skipped",
      status: "warning",
      payload: { mp_payment_id: mpId, reason: "no_external_reference" },
    });
    return;
  }

  // external_reference is the transaction_id in pagamentos_split
  const { data: splits, error: selectErr } = await supabaseAdmin
    .from("pagamentos_split")
    .select("id, status, transaction_id")
    .eq("transaction_id", external_reference)
    .limit(1);

  if (selectErr) {
    throw new Error(`DB lookup failed for external_reference ${external_reference}: ${selectErr.message}`);
  }

  if (!splits || splits.length === 0) {
    console.warn(`[payment-webhook] No pagamentos_split found for transaction_id=${external_reference}. May be a direct PIX without split record.`);
    await logAuditEvent({
      transactionType: "order_fulfillment_skipped",
      status: "warning",
      payload: { mp_payment_id: mpId, external_reference, reason: "no_split_record_found" },
    });
    return;
  }

  const split = splits[0];

  // --- Idempotency guard: skip if already approved/completed ---
  if (split.status === "approved") {
    console.log(`[payment-webhook] pagamentos_split ${split.id} already approved — skipping update (idempotent).`);
    await logAuditEvent({
      transactionType: "order_fulfillment_skipped",
      status: "already_approved",
      payload: { split_id: split.id, mp_payment_id: mpId, external_reference },
    });
    return;
  }

  // --- Atomic update: set status to 'approved' with timestamp ---
  const { error: updateErr } = await supabaseAdmin
    .from("pagamentos_split")
    .update({
      status: "approved",
      updated_at: date_approved ?? new Date().toISOString(),
    })
    .eq("transaction_id", external_reference)
    .eq("status", "pending"); // Extra safety: only update if still pending (prevents overwriting refunded states)

  if (updateErr) {
    throw new Error(`pagamentos_split update failed for ${external_reference}: ${updateErr.message}`);
  }

  console.log(`[payment-webhook] ✅ pagamentos_split ${split.id} updated to approved via MP payment ${mpId}.`);

  // --- Audit: order fulfilled ---
  await logAuditEvent({
    transactionType: "order_fulfilled",
    status: "approved",
    payload: {
      split_id: split.id,
      mp_payment_id: mpId,
      mp_status: status,
      external_reference,
      date_approved,
    },
  });
}

// ============================================================
// SIGNATURE VALIDATION — HMAC-SHA256 (sandbox-tolerant)
// ============================================================
async function computeSha256(input: string): Promise<string> {
  const msgData = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function validateMPSignature(
  req: Request,
  rawBody: string
): Promise<{ valid: boolean; warning?: string }> {
  const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
  const xSignature   = req.headers.get("x-signature");
  const xRequestId   = req.headers.get("x-request-id");

  if (!webhookSecret) {
    return { valid: true, warning: "MP_WEBHOOK_SECRET not configured — signature validation skipped (sandbox mode)." };
  }
  if (!xSignature) {
    return { valid: false, warning: "Missing x-signature header from Mercado Pago." };
  }

  // MP signature format: "ts=<timestamp>,v1=<hash>"
  const parts     = Object.fromEntries(xSignature.split(",").map((p) => p.split("=")));
  const timestamp = parts["ts"];
  const v1Hash    = parts["v1"];

  if (!timestamp || !v1Hash) {
    return { valid: false, warning: "Malformed x-signature header." };
  }

  const manifest = `id:${xRequestId ?? ""};request-id:${xRequestId ?? ""};ts:${timestamp};`;

  const keyData  = new TextEncoder().encode(webhookSecret);
  const msgData  = new TextEncoder().encode(manifest);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature    = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== v1Hash) {
    return { valid: false, warning: "Signature mismatch — potential spoofing attempt." };
  }

  return { valid: true };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();

    // --- [1] Signature Validation ---
    const { valid: sigValid, warning: sigWarning } = await validateMPSignature(req, rawBody);
    if (sigWarning) console.warn("[payment-webhook] Signature warning:", sigWarning);

    if (!sigValid) {
      await logAuditEvent({
        transactionType: "webhook_rejected",
        status: "security_rejected",
        payload: { reason: sigWarning, timestamp: new Date().toISOString() },
        errorDetails: sigWarning,
      });
      return new Response(JSON.stringify({ error: "Unauthorized: invalid webhook signature." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // --- [2] Parse JSON body ---
    let webhookBody: MercadoPagoWebhookBody;
    try {
      webhookBody = JSON.parse(rawBody);
    } catch {
      await logAuditEvent({
        transactionType: "webhook_parse_error",
        status: "failed",
        errorDetails: "Invalid JSON body received from webhook.",
      });
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { type, action, data } = webhookBody;

    // --- [3] Log raw receipt for full lifecycle traceability ---
    await logAuditEvent({
      transactionType: "webhook_received",
      status: "processing",
      payload: webhookBody as Record<string, unknown>,
    });

    // --- [4] Only process payment-type events ---
    if (type !== "payment" || !data?.id) {
      console.log(`[payment-webhook] Non-payment event ignored: type=${type}, action=${action}`);
      return new Response(JSON.stringify({ success: true, message: "Event acknowledged but not processed." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const paymentId = String(data.id);
    // Use MP's notification id as event_id for idempotency.
    // Fall back to a composite key if not present.
    const eventId = String(webhookBody.id ?? `${type}_${paymentId}_${Date.now()}`);

    // --- [5] Idempotency guard: claim the event exclusively ---
    const claimed = await claimWebhookEvent(eventId, paymentId);
    if (!claimed) {
      return new Response(JSON.stringify({ success: true, message: "Duplicate event — already processed." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // --- [6] Anti-spoofing: verify payment state directly with MP API ---
    const { data: mpPayment, httpStatus: mpStatus } = await fetchMPPaymentStatus(paymentId);

    if (mpStatus >= 400 || mpPayment.error) {
      const errMsg = `MP verification failed for payment ${paymentId}: [${mpPayment.error ?? mpStatus}] ${mpPayment.message ?? ""}`;
      console.error("[payment-webhook]", errMsg);
      await markWebhookEventDone(eventId, "failed", errMsg);
      await logAuditEvent({
        transactionType: "webhook_verification_failed",
        status: "failed",
        payload: mpPayment as Record<string, unknown>,
        errorDetails: errMsg,
      });
      return new Response(JSON.stringify({ error: "Could not verify payment with Mercado Pago." }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const verifiedStatus = mpPayment.status ?? "unknown";

    // --- [7] Persist verified payment status in audit log ---
    await logAuditEvent({
      transactionType: "webhook_payment_update",
      status: verifiedStatus,
      payload: {
        payment_id: mpPayment.id,
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        transaction_amount: mpPayment.transaction_amount,
        description: mpPayment.description,
        payment_method_id: mpPayment.payment_method_id,
        external_reference: mpPayment.external_reference,
        date_approved: mpPayment.date_approved,
        date_last_updated: mpPayment.date_last_updated,
        payer_email: mpPayment.payer?.email,
      },
    });

    // --- [8] Orchestration: update operational DB if payment is approved ---
    if (verifiedStatus === "approved") {
      await orchestrateApprovedPayment(mpPayment);
    } else {
      console.log(`[payment-webhook] Payment ${paymentId} status=${verifiedStatus} — no DB orchestration needed.`);
    }

    // --- [9] Mark event as completed ---
    await markWebhookEventDone(eventId, "completed");

    console.log(`[payment-webhook] ✅ Event ${eventId} for payment ${paymentId} processed. Status: ${verifiedStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: mpPayment.id,
        verified_status: verifiedStatus,
        verified_status_detail: mpPayment.status_detail,
        external_reference: mpPayment.external_reference ?? null,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack   = err instanceof Error ? err.stack    : undefined;

    console.error("[payment-webhook] Unhandled error:", errorMessage);

    await logAuditEvent({
      transactionType: "webhook_crash",
      status: "failed",
      payload: { timestamp: new Date().toISOString() },
      errorDetails: `${errorMessage}${errorStack ? `\n${errorStack}` : ""}`,
    });

    return new Response(
      JSON.stringify({ error: "Internal server error. Incident logged." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
