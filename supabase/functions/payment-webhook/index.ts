import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS / RESPONSE HEADERS
// ============================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization, Content-Type, Accept, x-signature, x-request-id, x-qa-bypass-token, x-qa-force-status",
};

// ============================================================
// SUPABASE CLIENT — service_role for audit writes + orchestration
// ============================================================
const supabaseUrl            = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type MpEnvironment = "sandbox" | "production";

function paymentEnvironment(): MpEnvironment {
  const value = (Deno.env.get("MP_ENVIRONMENT") || "").trim().toLowerCase();
  if (value !== "sandbox" && value !== "production") {
    throw new Error("MP_ENVIRONMENT must be explicitly set to 'sandbox' or 'production'.");
  }
  return value;
}

const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : ({ from: () => { throw new Error("Supabase client not initialized (missing env vars)"); } } as any);

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
  live_mode?: boolean;
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
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function tokenEncryptionKey(): Promise<CryptoKey | null> {
  const encoded = Deno.env.get("MP_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!encoded) return null;
  const bytes = base64ToBytes(encoded);
  if (bytes.length !== 32) {
    throw new Error("MP_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
}

async function decryptSellerToken(value: string, environment: MpEnvironment): Promise<string> {
  if (value.startsWith("v1:")) {
    const [, ivValue, cipherValue] = value.split(":");
    const key = await tokenEncryptionKey();
    if (!key || !ivValue || !cipherValue) {
      throw new Error("Seller OAuth token cannot be decrypted by payment-webhook.");
    }
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivValue) },
      key,
      base64ToBytes(cipherValue),
    );
    return new TextDecoder().decode(plain);
  }
  if (environment === "sandbox" && value.startsWith("plain:")) return value.slice(6);
  if (environment === "sandbox") return value;
  throw new Error("Unencrypted Seller OAuth token is forbidden in production.");
}

function platformAccessToken(environment: MpEnvironment): string {
  const token = environment === "production"
    ? Deno.env.get("MP_ACCESS_TOKEN_PRODUCTION")?.trim()
    : (
      Deno.env.get("MP_ACCESS_TOKEN_SANDBOX") ||
      Deno.env.get("MP_ACCESS_TOKEN_TEST") ||
      Deno.env.get("MP_ACCESS_TOKEN")
    )?.trim();
  if (!token) throw new Error(`Mercado Pago platform access token is not configured for ${environment}.`);
  return token;
}

async function paymentVerificationCredential(
  paymentId: string | number,
  environment: MpEnvironment,
): Promise<{ accessToken: string; route: "seller_oauth_split" | "platform_fallback" }> {
  const { data: split, error: splitError } = await supabaseAdmin
    .from("pagamentos_split")
    .select("payment_route, marketplace_account_id, environment")
    .eq("gateway_payment_id", String(paymentId))
    .maybeSingle();

  if (splitError) {
    throw new Error(`Could not resolve payment route for ${paymentId}: ${splitError.message}`);
  }
  if (!split) {
    throw new Error(`No pagamentos_split record found for Mercado Pago payment ${paymentId}.`);
  }
  if (String(split.environment) !== environment) {
    throw new Error(`Payment ${paymentId} belongs to a different environment.`);
  }

  if (split.payment_route !== "seller_oauth_split") {
    return { accessToken: platformAccessToken(environment), route: "platform_fallback" };
  }
  if (!split.marketplace_account_id) {
    throw new Error(`Seller OAuth payment ${paymentId} has no marketplace_account_id.`);
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("marketplace_accounts")
    .select("access_token_encrypted, ambiente, status, token_expiration")
    .eq("id", split.marketplace_account_id)
    .maybeSingle();
  if (accountError || !account) {
    throw new Error(`Marketplace account for payment ${paymentId} could not be loaded.`);
  }
  if (account.status !== "CONNECTED" || account.ambiente !== environment) {
    throw new Error(`Marketplace account for payment ${paymentId} is not connected in ${environment}.`);
  }
  if (!account.access_token_encrypted) {
    throw new Error(`Marketplace account for payment ${paymentId} has no OAuth access token.`);
  }
  if (account.token_expiration && new Date(account.token_expiration).getTime() <= Date.now()) {
    throw new Error(`Marketplace OAuth token for payment ${paymentId} is expired.`);
  }

  const accessToken = (await decryptSellerToken(account.access_token_encrypted, environment)).trim();
  if (!accessToken) throw new Error(`Marketplace OAuth token for payment ${paymentId} is empty.`);
  return { accessToken, route: "seller_oauth_split" };
}

async function fetchMPPaymentStatus(
  paymentId: string | number
): Promise<{ data: MercadoPagoPaymentDetail; httpStatus: number; credentialRoute: string }> {
  const environment = paymentEnvironment();
  const credential = await paymentVerificationCredential(paymentId, environment);
  console.log(`[payment-webhook] Verifying payment ${paymentId} through route ${credential.route}.`);

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${credential.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const rawText = await response.text();
  let data: MercadoPagoPaymentDetail;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error(`Invalid JSON from MP (Status ${response.status}): ${rawText}`);
  }
  return { data, httpStatus: response.status, credentialRoute: credential.route };
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
    environment: paymentEnvironment(),
    processing_status: "processing",
    attempts: 1,
    payload_hash: await computeSha256(paymentId),
  });

  if (error) {
    // PostgreSQL unique violation code = '23505'
    if (error.code === "23505") {
      // Check if the previous attempt is stuck in 'processing' (timeout > 5 min)
      const { data: existing } = await supabaseAdmin
        .from("marketplace_webhook_events")
        .select("processing_status, attempts, created_at")
        .eq("event_id", eventId)
        .single();

      if (
        existing &&
        (existing.processing_status === "failed" ||
          existing.processing_status === "retrying" ||
          (existing.processing_status === "processing" &&
            (Date.now() - new Date(existing.created_at).getTime()) > 300_000))
      ) {
        // Failed or stuck event — allow MP's delivery retry to finish orchestration.
        console.warn(`[payment-webhook] Retryable event ${eventId} detected. Permitting retry.`);
        await supabaseAdmin
          .from("marketplace_webhook_events")
          .update({ processing_status: "retrying", attempts: (existing.attempts || 1) + 1 })
          .eq("event_id", eventId);
        return true; // Allow reprocessing
      }

      // Genuinely completed duplicate — skip safely
      console.warn(`[payment-webhook] Duplicate event ${eventId} — skipping (idempotent).`);
      return false;
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
    .select("id, status, transaction_id, service_type, service_id, total_amount")
    .eq("transaction_id", external_reference)
    .limit(1);

  if (selectErr) {
    throw new Error(`DB lookup failed for external_reference ${external_reference}: ${selectErr.message}`);
  }

  if (!splits || splits.length === 0) {
    console.error(`[payment-webhook] CRITICAL: No pagamentos_split found for transaction_id=${external_reference}. Forcing MP retry.`);
    await logAuditEvent({
      transactionType: "order_fulfillment_missing_split",
      status: "error",
      payload: { mp_payment_id: mpId, external_reference, reason: "no_split_record_found" },
    });
    // THROW to force HTTP 500 → Mercado Pago will retry the webhook
    throw new Error(`No split record found for transaction_id=${external_reference}. Forcing retry.`);
  }

  const split = splits[0];
  if (!["pending", "approved"].includes(String(split.status))) {
    throw new Error(
      `Refusing to approve split ${split.id} from terminal local status ${split.status}. Manual reconciliation required.`,
    );
  }

  // --- Idempotency guard: skip if already approved/completed ---
  const splitAlreadyApproved = split.status === "approved";
  if (splitAlreadyApproved) {
    console.log(`[payment-webhook] pagamentos_split ${split.id} already approved — skipping update (idempotent).`);
    await logAuditEvent({
      transactionType: "order_fulfillment_skipped",
      status: "already_approved",
      payload: { split_id: split.id, mp_payment_id: mpId, external_reference },
    });
  }

  // --- Atomic update: set status to 'approved' with timestamp ---
  if (!splitAlreadyApproved) {
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
  }

  // Keep operational state server-authoritative for asynchronous methods (for
  // example Pix). The browser must never promote a service to paid itself.
  if (split.service_type === "mototaxi") {
    const { error: rideError } = await supabaseAdmin
      .from("mototaxi_corridas")
      .update({
        status: "paid",
        final_price: Number(split.total_amount),
        pix_charge_status: "approved",
        updated_at: date_approved ?? new Date().toISOString(),
      })
      .eq("id", split.service_id);
    if (rideError) {
      throw new Error(`mototaxi_corridas update failed for ${split.service_id}: ${rideError.message}`);
    }
  } else if (split.service_type === "diarista") {
    const { error: requestError } = await supabaseAdmin
      .from("services_requests")
      .update({
        status: "paid",
        payment_id: String(mpId),
        updated_at: date_approved ?? new Date().toISOString(),
      })
      .eq("id", split.service_id);
    if (requestError) {
      throw new Error(`services_requests update failed for ${split.service_id}: ${requestError.message}`);
    }
  }

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
// SIGNATURE VALIDATION — HMAC-SHA256 (production fails closed)
// ============================================================
async function computeSha256(input: string): Promise<string> {
  const msgData = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgData);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function constantTimeSecretMatch(received: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const receivedBytes = new Uint8Array(receivedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let mismatch = 0;
  for (let index = 0; index < receivedBytes.length; index += 1) {
    mismatch |= receivedBytes[index] ^ expectedBytes[index];
  }
  return mismatch === 0;
}

async function validateMPSignature(
  req: Request,
  rawBody: string
): Promise<{ valid: boolean; warning?: string; qaBypass?: boolean; qaForceApproved?: boolean }> {
  const environment = paymentEnvironment();
  const qaToken = req.headers.get("x-qa-bypass-token")?.trim() ?? "";
  if (qaToken) {
    if (environment !== "sandbox") {
      return { valid: false, warning: "QA webhook bypass is forbidden outside sandbox." };
    }
    const expectedQaToken = Deno.env.get("MP_QA_WEBHOOK_BYPASS_TOKEN")?.trim() ?? "";
    if (expectedQaToken.length < 32) {
      return { valid: false, warning: "QA webhook bypass secret is not configured securely." };
    }
    if (!(await constantTimeSecretMatch(qaToken, expectedQaToken))) {
      return { valid: false, warning: "Invalid QA webhook bypass token." };
    }
    const qaForceApproved = req.headers.get("x-qa-force-status")?.trim().toLowerCase() === "approved";
    return {
      valid: true,
      warning: qaForceApproved
        ? "Sandbox QA bypass accepted with forced approved status."
        : "Sandbox QA signature bypass accepted without status override.",
      qaBypass: true,
      qaForceApproved,
    };
  }

  const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET")?.trim();
  const xSignature   = req.headers.get("x-signature");
  const xRequestId   = req.headers.get("x-request-id");

  if (!webhookSecret) {
    return {
      valid: false,
      warning: `MP_WEBHOOK_SECRET is required in ${environment}; use the explicit QA token for sandbox simulations.`,
    };
  }
  if (!xSignature || !xRequestId) {
    return { valid: false, warning: "Missing x-signature or x-request-id header from Mercado Pago." };
  }

  // MP signature format: "ts=<timestamp>,v1=<hash>"
  const parts     = Object.fromEntries(xSignature.split(",").map((p) => p.split("=")));
  const timestamp = parts["ts"];
  const v1Hash    = parts["v1"];

  if (!timestamp || !v1Hash) {
    return { valid: false, warning: "Malformed x-signature header." };
  }

  let dataId = "";
  try {
    const parsed = JSON.parse(rawBody) as MercadoPagoWebhookBody;
    const queryDataId = new URL(req.url).searchParams.get("data.id");
    dataId = String(queryDataId ?? parsed.data?.id ?? "").toLowerCase();
  } catch {
    return { valid: false, warning: "Invalid JSON body for signature validation." };
  }
  if (!dataId) {
    return { valid: false, warning: "Missing data.id for signature validation." };
  }
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

  const keyData  = new TextEncoder().encode(webhookSecret);
  const msgData  = new TextEncoder().encode(manifest);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature    = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expected = v1Hash.toLowerCase();
  let mismatch = computedHash.length !== expected.length ? 1 : 0;
  for (let index = 0; index < Math.min(computedHash.length, expected.length); index += 1) {
    mismatch |= computedHash.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  if (mismatch !== 0) {
    return { valid: false, warning: "Signature mismatch — potential spoofing attempt." };
  }

  return { valid: true };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
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
    const {
      valid: sigValid,
      warning: sigWarning,
      qaBypass = false,
      qaForceApproved = false,
    } = await validateMPSignature(req, rawBody);
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

    if (qaBypass) {
      await logAuditEvent({
        transactionType: "webhook_qa_bypass",
        status: "security_override",
        payload: {
          environment: paymentEnvironment(),
          payment_id: data?.id ? String(data.id) : null,
          force_approved: qaForceApproved,
          timestamp: new Date().toISOString(),
        },
        errorDetails: "Sandbox-only QA bypass used; Mercado Pago payment existence is still verified server-side.",
      });
    }

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
    // Fall back to a DETERMINISTIC composite key (no Date.now!) so retries are deduped.
    const eventId = String(webhookBody.id ?? `${type}_${paymentId}`);

    // --- [5] Idempotency guard: claim the event exclusively ---
    const claimed = await claimWebhookEvent(eventId, paymentId);
    if (!claimed) {
      return new Response(JSON.stringify({ success: true, message: "Duplicate event — already processed." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // --- [6] Anti-spoofing: verify payment state directly with MP API ---
    const { data: mpPayment, httpStatus: mpStatus, credentialRoute } = await fetchMPPaymentStatus(paymentId);

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

    const expectedLiveMode = paymentEnvironment() === "production";
    if (typeof mpPayment.live_mode === "boolean" && mpPayment.live_mode !== expectedLiveMode) {
      throw new Error(`Mercado Pago payment environment mismatch for payment ${paymentId}.`);
    }

    const actualStatus = mpPayment.status ?? "unknown";
    if (
      qaForceApproved &&
      !["pending", "in_process", "approved"].includes(actualStatus)
    ) {
      throw new Error(
        `QA approval refused for Mercado Pago payment ${paymentId} with terminal status ${actualStatus}.`,
      );
    }
    const effectivePayment: MercadoPagoPaymentDetail = qaForceApproved
      ? {
        ...mpPayment,
        status: "approved",
        date_approved: mpPayment.date_approved ?? new Date().toISOString(),
      }
      : mpPayment;
    const verifiedStatus = effectivePayment.status ?? "unknown";

    // --- [7] Persist verified payment status in audit log ---
    await logAuditEvent({
      transactionType: "webhook_payment_update",
      status: verifiedStatus,
      payload: {
        payment_id: mpPayment.id,
        status: verifiedStatus,
        actual_mp_status: actualStatus,
        qa_simulated: qaForceApproved,
        status_detail: mpPayment.status_detail,
        transaction_amount: mpPayment.transaction_amount,
        description: mpPayment.description,
        payment_method_id: mpPayment.payment_method_id,
        credential_route: credentialRoute,
        external_reference: mpPayment.external_reference,
        date_approved: mpPayment.date_approved,
        date_last_updated: mpPayment.date_last_updated,
        payer_email: mpPayment.payer?.email,
      },
    });

    // --- [8] Orchestration: update operational DB if payment is approved ---
    if (verifiedStatus === "approved") {
      await orchestrateApprovedPayment(effectivePayment);
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
        actual_mp_status: actualStatus,
        qa_simulated: qaForceApproved,
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
