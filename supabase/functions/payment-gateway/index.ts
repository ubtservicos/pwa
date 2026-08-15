import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS HEADERS — strict, minimal surface
// ============================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

// ============================================================
// SUPABASE CLIENT — service_role for audit logging (server-side only)
// ============================================================
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================
// TYPES
// ============================================================
interface MercadoPagoPixResponse {
  id?: number;
  status?: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      ticket_url?: string;
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  error?: string;
  message?: string;
  cause?: Array<{ code: number; description: string }>;
}

// ============================================================
// AUDIT LOGGER — immutable insert in financial_audit_logs
// Non-throwing: a log failure must NEVER cascade into user-facing errors.
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
      console.error("[payment-gateway] Audit log insert failed:", error.message);
    }
  } catch (logErr) {
    // Absolutely non-throwing — log to stdout only
    console.error("[payment-gateway] Critical: audit logger threw unexpectedly:", logErr);
  }
}

// ============================================================
// PIX PAYMENT GENERATOR — calls Mercado Pago REST API
// ============================================================
async function createPixPayment({
  transactionAmount,
  description,
  payerEmail,
  externalReference,
  metadata,
}: {
  transactionAmount: number;
  description: string;
  payerEmail: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ data: MercadoPagoPixResponse; httpStatus: number }> {
  const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN_TEST");

  if (!mpAccessToken) {
    throw new Error("MP_ACCESS_TOKEN_TEST is not configured in Edge Function secrets.");
  }

  // Unique idempotency key per attempt — prevents duplicate charges on retries
  const idempotencyKey = crypto.randomUUID();

  const mpPayload: Record<string, unknown> = {
    transaction_amount: transactionAmount,
    description,
    payment_method_id: "pix",
    payer: { email: payerEmail },
    // external_reference is the key link between MP and our internal pagamentos_split table.
    // Format convention: "<entity>_<id>_ts_<timestamp>" (e.g. "pedido_uuid-abc_ts_1234567890")
    ...(externalReference ? { external_reference: externalReference } : {}),
    ...(metadata ? { metadata } : {}),
  };

  const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${mpAccessToken}`,
      "X-Idempotency-Key": idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mpPayload),
  });

  const data: MercadoPagoPixResponse = await mpResponse.json();

  return { data, httpStatus: mpResponse.status };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request): Promise<Response> => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ---- Central try/catch — all errors MUST be caught and logged ----
  try {
    const body = await req.json();
    const { action } = body;

    // ----------------------------------------------------------------
    // ROUTE: PIX Payment Intent
    // ----------------------------------------------------------------
    if (action === "create_payment_intent") {
      const { transaction_amount, description, payer_email, external_reference, metadata } = body;

      // --- Input validation ---
      if (typeof transaction_amount !== "number" || transaction_amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid transaction_amount. Must be a positive number." }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      if (!description || typeof description !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing or invalid description." }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      if (!payer_email || typeof payer_email !== "string" || !payer_email.includes("@")) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid payer_email." }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // --- Call Mercado Pago ---
      const { data: mpData, httpStatus: mpStatus } = await createPixPayment({
        transactionAmount: transaction_amount,
        description,
        payerEmail: payer_email,
        externalReference: external_reference,
        metadata,
      });

      // --- Audit log: persist raw MP response immutably ---
      const auditStatus = mpData.status ?? (mpStatus >= 400 ? "failed" : "unknown");
      await logAuditEvent({
        transactionType: "pix_intent",
        status: auditStatus,
        payload: mpData as Record<string, unknown>,
        errorDetails: mpData.error
          ? `[${mpData.error}] ${mpData.message ?? ""} ${JSON.stringify(mpData.cause ?? [])}`
          : undefined,
      });

      // --- Handle MP API errors ---
      if (mpStatus >= 400 || mpData.error) {
        console.error("[payment-gateway] Mercado Pago returned error:", mpStatus, mpData);
        return new Response(
          JSON.stringify({
            error: "Payment provider rejected the request.",
            detail: mpData.message ?? mpData.error ?? "Unknown MP error",
            mp_status: mpData.status,
            mp_status_detail: mpData.status_detail,
          }),
          {
            status: mpStatus >= 400 ? mpStatus : 502,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      // --- Extract PIX display data ---
      const txData = mpData.point_of_interaction?.transaction_data;
      const pixData = {
        payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
        // external_reference ties the MP payment_id back to pagamentos_split.transaction_id
        external_reference: external_reference ?? null,
        ticket_url: txData?.ticket_url ?? null,
        qr_code: txData?.qr_code ?? null,           // "Copia e Cola"
        qr_code_base64: txData?.qr_code_base64 ?? null,
      };

      return new Response(JSON.stringify({ success: true, pix: pixData }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // --- Unrecognized action ---
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack   = err instanceof Error ? err.stack    : undefined;

    console.error("[payment-gateway] Unhandled error:", errorMessage);

    // Persist the failure in financial_audit_logs for traceability
    await logAuditEvent({
      transactionType: "unknown",
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
