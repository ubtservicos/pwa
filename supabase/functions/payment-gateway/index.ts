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
// SUPABASE CLIENT — initialized with service_role for audit logging
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
// AUDIT LOGGER — inserts an immutable record in financial_audit_logs
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
  const { error } = await supabaseAdmin.from("financial_audit_logs").insert({
    transaction_type: transactionType,
    status,
    payload: payload ?? null,
    error_details: errorDetails ?? null,
  });

  if (error) {
    // Non-throwing — we must never let a logging failure cascade into user-facing errors
    console.error("[payment-gateway] Failed to write audit log:", error.message);
  }
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

    // --- ROUTE: Payment Intent ---
    if (action === "create_payment_intent") {
      // TODO (Release 2.0 Sprint 2): Integrate with Mercado Pago Sandbox API
      // MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")
      // const mpResponse = await createMercadoPagoPayment({ ... });

      // Placeholder: log the request attempt
      await logAuditEvent({
        transactionType: "payment_intent",
        status: "pending",
        payload: { action, requested_at: new Date().toISOString() },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Payment gateway initialized. Integration pending." }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // --- Unrecognized action ---
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

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
