import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS / RESPONSE HEADERS
// Mercado Pago webhooks are server-to-server (no browser CORS needed),
// but we define them for consistency and potential manual testing.
// ============================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-signature, x-request-id",
};

// ============================================================
// SUPABASE CLIENT — service_role for audit writes
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
  action?: string;        // e.g. "payment.created", "payment.updated"
  type?: string;          // e.g. "payment"
  data?: {
    id?: string | number; // MP payment ID carried in webhook notification
  };
  live_mode?: boolean;
  date_created?: string;
  user_id?: string;
  api_version?: string;
}

interface MercadoPagoPaymentDetail {
  id?: number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  description?: string;
  payment_method_id?: string;
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
// MP PAYMENT VERIFIER
// Fetches the canonical payment state directly from Mercado Pago
// to prevent webhook spoofing attacks. We NEVER trust the webhook
// body alone — we always verify against the MP API.
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
// SIGNATURE VALIDATION HELPER (sandbox-tolerant)
// In production, MP signs webhooks with HMAC-SHA256.
// In sandbox/test mode the header may be absent — we log a warning
// but continue processing so development is not blocked.
// Set MP_WEBHOOK_SECRET in production to enable full verification.
// ============================================================
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

  // Build the signed manifest string per MP docs
  const manifest = `id:${xRequestId ?? ""};request-id:${xRequestId ?? ""};ts:${timestamp};`;

  const keyData = new TextEncoder().encode(webhookSecret);
  const msgData = new TextEncoder().encode(manifest);

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
  // Handle CORS Preflight
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

    // --- Signature Validation ---
    const { valid: sigValid, warning: sigWarning } = await validateMPSignature(req, rawBody);
    if (sigWarning) {
      console.warn("[payment-webhook] Signature warning:", sigWarning);
    }
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

    // --- Parse Webhook Body ---
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

    // --- Log raw webhook receipt for full lifecycle traceability ---
    await logAuditEvent({
      transactionType: "webhook_received",
      status: "processing",
      payload: webhookBody as Record<string, unknown>,
    });

    // --- Only process payment-type events ---
    if (type !== "payment" || !data?.id) {
      console.log(`[payment-webhook] Non-payment event ignored: type=${type}, action=${action}`);
      return new Response(JSON.stringify({ success: true, message: "Event acknowledged but not processed." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const paymentId = data.id;

    // --- Anti-spoofing: Verify payment state directly with MP API ---
    const { data: mpPayment, httpStatus: mpStatus } = await fetchMPPaymentStatus(paymentId);

    if (mpStatus >= 400 || mpPayment.error) {
      const errMsg = `MP verification failed for payment ${paymentId}: [${mpPayment.error ?? mpStatus}] ${mpPayment.message ?? ""}`;
      console.error("[payment-webhook]", errMsg);
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

    // --- Persist verified payment status in audit log ---
    const verifiedStatus = mpPayment.status ?? "unknown";
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
        date_approved: mpPayment.date_approved,
        date_last_updated: mpPayment.date_last_updated,
        payer_email: mpPayment.payer?.email,
      },
    });

    console.log(`[payment-webhook] Payment ${paymentId} verified. Status: ${verifiedStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: mpPayment.id,
        verified_status: verifiedStatus,
        verified_status_detail: mpPayment.status_detail,
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
