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
// SUPABASE CLIENT — service_role for audit logging + DB writes
// ============================================================
const supabaseUrl            = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : ({ from: () => { throw new Error("Supabase client not initialized (missing env vars)"); } } as any);

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

/**
 * Mirrors public.split_config (singleton row, id=1).
 * All fields are percentages (0–100).
 */
interface SplitConfig {
  prestador_pct:          number; // e.g. 90.000
  ubt_pct:                number; // e.g.  5.000
  comunidade_pct:         number; // e.g.  2.000
  premio_trabalhador_pct: number; // e.g.  1.000
  premio_consumidor_pct:  number; // e.g.  1.000
  padrinho_pct:           number; // e.g.  1.000
}

/**
 * Calculated monetary amounts (BRL, rounded to 2 decimal places).
 * prestador_amount + platform_fee = total_amount.
 */
interface SplitAmounts {
  total_amount:           number;
  prestador_amount:       number; // Goes to the service provider
  ubt_amount:             number; // UBT platform cut
  comunidade_amount:      number; // Community fund
  premio_trabalhador:     number; // Worker lottery pool
  premio_consumidor:      number; // Consumer loyalty pool
  padrinho_amount:        number; // Godparent referral (residual bucket)
  application_fee:        number; // Sum of all platform cuts sent to Mercado Pago
}

type ServiceType = "mototaxi" | "diarista" | "ambulante";

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
      console.error("[payment-gateway] Audit log insert failed:", error.message);
    }
  } catch (logErr) {
    console.error("[payment-gateway] Critical: audit logger threw unexpectedly:", logErr);
  }
}

// ============================================================
// SPLIT CONFIG READER — fetches live rules from public.split_config
// Falls back to the PO's official regulatory defaults if DB is unreachable.
// The fallback ensures payment can always proceed even during DB hiccups.
// ============================================================
const REGULATORY_DEFAULTS: SplitConfig = {
  prestador_pct:          90.000,
  ubt_pct:                 5.000,
  comunidade_pct:          2.000,
  premio_trabalhador_pct:  1.000,
  premio_consumidor_pct:   1.000,
  padrinho_pct:            1.000,
};

async function fetchSplitConfig(): Promise<{ config: SplitConfig; fromDb: boolean }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("split_config")
      .select("prestador_pct, ubt_pct, comunidade_pct, premio_trabalhador_pct, premio_consumidor_pct, padrinho_pct")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.warn("[payment-gateway] split_config not found in DB — using regulatory defaults:", error?.message);
      return { config: REGULATORY_DEFAULTS, fromDb: false };
    }

    return { config: data as SplitConfig, fromDb: true };
  } catch (err) {
    console.error("[payment-gateway] Error fetching split_config — using regulatory defaults:", err);
    return { config: REGULATORY_DEFAULTS, fromDb: false };
  }
}

// ============================================================
// SPLIT CALCULATOR — cent-precise with residual bucket
// The `padrinho_amount` absorbs floating-point rounding drift so that
// the sum of all parts ALWAYS equals `total_amount` exactly.
// ============================================================
function calculateSplitAmounts(totalAmount: number, config: SplitConfig): SplitAmounts {
  const r = (v: number) => Math.round(v * 100) / 100; // round to 2 decimal places

  const prestador_amount   = r(totalAmount * (config.prestador_pct          / 100));
  const ubt_amount         = r(totalAmount * (config.ubt_pct                / 100));
  const comunidade_amount  = r(totalAmount * (config.comunidade_pct         / 100));
  const premio_trabalhador = r(totalAmount * (config.premio_trabalhador_pct / 100));
  const premio_consumidor  = r(totalAmount * (config.premio_consumidor_pct  / 100));

  // Residual bucket: padrinho absorbs any rounding drift to guarantee total integrity
  const sumBeforePadrinho = r(prestador_amount + ubt_amount + comunidade_amount + premio_trabalhador + premio_consumidor);
  const padrinho_amount   = r(Math.max(0, totalAmount - sumBeforePadrinho));

  // application_fee = everything the marketplace retains (MP will split this internally or release to marketplace account)
  // = total - provider_amount — this is sent to Mercado Pago Payments API
  const application_fee = r(totalAmount - prestador_amount);

  return {
    total_amount: totalAmount,
    prestador_amount,
    ubt_amount,
    comunidade_amount,
    premio_trabalhador,
    premio_consumidor,
    padrinho_amount,
    application_fee,
  };
}

// ============================================================
// PAGAMENTOS_SPLIT PERSISTER — idempotent upsert
// Uses transaction_id (= external_reference) as the deduplication key.
// If called twice for the same external_reference, the second call is a no-op.
// ============================================================
async function persistSplitRecord({
  transactionId,
  serviceType,
  serviceId,
  split,
  entityId,
  godparentId,
}: {
  transactionId:  string;
  serviceType:    ServiceType;
  serviceId:      string;
  split:          SplitAmounts;
  entityId?:      string | null;
  godparentId?:   string | null;
}): Promise<{ persisted: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("pagamentos_split").upsert(
      {
        transaction_id:         transactionId,
        status:                 "pending",
        service_type:           serviceType,
        service_id:             serviceId,
        total_amount:           split.total_amount,
        provider_amount:        split.prestador_amount,
        ubt_amount:             split.ubt_amount,
        entity_amount:          split.comunidade_amount,
        entity_id:              entityId ?? null,
        prize_worker_amount:    split.premio_trabalhador,
        prize_consumer_amount:  split.premio_consumidor,
        godparent_amount:       split.padrinho_amount,
        godparent_id:           godparentId ?? null,
        refunded_amount:        0.00,
        updated_at:             new Date().toISOString(),
      },
      {
        onConflict:      "transaction_id",
        ignoreDuplicates: true, // idempotent: second insert for same transaction_id is a no-op
      }
    );

    if (error) {
      console.error("[payment-gateway] pagamentos_split upsert failed:", error.message);
      return { persisted: false, error: error.message };
    }

    return { persisted: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payment-gateway] pagamentos_split upsert threw:", msg);
    return { persisted: false, error: msg };
  }
}

// ============================================================
// MERCADO PAGO PAYMENT GENERATOR (PIX & CREDIT CARD)
// ============================================================
async function createMercadoPagoPayment({
  transactionAmount,
  description,
  payerEmail,
  payerFirstName,
  payerLastName,
  applicationFee,
  paymentMethodId = "pix",
  cardToken,
  installments = 1,
  externalReference,
  metadata,
}: {
  transactionAmount:  number;
  description:        string;
  payerEmail:         string;
  payerFirstName?:    string;
  payerLastName?:     string;
  applicationFee:     number;
  paymentMethodId?:   string;
  cardToken?:         string;
  installments?:      number;
  externalReference?: string;
  metadata?:          Record<string, unknown>;
}): Promise<{ data: MercadoPagoPixResponse; httpStatus: number }> {
  const isProd = Deno.env.get("ENVIRONMENT") === "production";
  const mpAccessToken = (isProd ? Deno.env.get("MP_ACCESS_TOKEN") : Deno.env.get("MP_ACCESS_TOKEN_TEST")) || Deno.env.get("MP_ACCESS_TOKEN_TEST");

  if (!mpAccessToken) {
    throw new Error("MP_ACCESS_TOKEN_TEST or MP_ACCESS_TOKEN is not configured in Edge Function secrets.");
  }

  // Unique idempotency key per attempt
  const idempotencyKey = crypto.randomUUID();

  const mpPayload = {
    transaction_amount: transactionAmount,
    description,
    payment_method_id: paymentMethodId,
    ...(paymentMethodId !== "pix" && cardToken ? { token: cardToken } : {}),
    ...(paymentMethodId !== "pix" ? { installments } : {}),
    payer: {
      email: payerEmail,
      ...(payerFirstName && { first_name: payerFirstName }),
      ...(payerLastName && { last_name: payerLastName }),
      identification: {
        type: "CPF",
        number: "85311283087"
      }
    },
    // application_fee: the marketplace fee withheld by UBT from the total.
    application_fee: applicationFee,
    // external_reference is the key link between MP and our internal pagamentos_split table.
    // Format convention: "<entity>_<uuid>_ts_<timestamp>" (e.g. "pedido_abc123_ts_1723000000000")
    ...(externalReference ? { external_reference: externalReference } : {}),
    ...(metadata ? { metadata } : {}),
  };

  const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Authorization":    `Bearer ${mpAccessToken}`,
      "X-Idempotency-Key": idempotencyKey,
      "Content-Type":     "application/json",
    },
    body: JSON.stringify(mpPayload),
  });

  const rawText = await mpResponse.text();
  let data: MercadoPagoPixResponse;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error(`Invalid JSON from MP (Status ${mpResponse.status}): ${rawText}`);
  }

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
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body in request." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  const { action } = body;

    // ----------------------------------------------------------------
    // ROUTE: PIX Payment Intent (with Split)
    // ----------------------------------------------------------------
    if (action === "create_payment_intent") {
      const {
        transaction_amount,
        description,
        payer_email,
        payer_first_name,
        payer_last_name,
        service_type,
        service_id,
        external_reference,
        entity_id,
        godparent_id,
        metadata,
        payment_method_id = "pix",
        token: cardToken,
        installments = 1,
      } = body;

      // 1. Basic Validations
      if (!transaction_amount || typeof transaction_amount !== "number" || transaction_amount <= 0) {
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
      if (!service_id || typeof service_id !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing service_id. Required to link payment to service record." }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      const validServiceTypes: ServiceType[] = ["mototaxi", "diarista", "ambulante"];
      if (!validServiceTypes.includes(service_type)) {
        return new Response(
          JSON.stringify({ error: `Invalid service_type. Must be one of: ${validServiceTypes.join(", ")}.` }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // --- [1] Fetch live split rules from DB ---
      const { config: splitConfig, fromDb: splitFromDb } = await fetchSplitConfig();

      // --- [2] Calculate split amounts ---
      const split = calculateSplitAmounts(transaction_amount, splitConfig);

      // --- [3] Audit: split_calculated (BEFORE calling MP — guarantees traceability even on MP failure) ---
      await logAuditEvent({
        transactionType: "split_calculated",
        status: "pending",
        payload: {
          external_reference:    external_reference ?? null,
          service_type,
          service_id,
          split_config_source:   splitFromDb ? "database" : "regulatory_defaults",
          split_config:          splitConfig,
          split_amounts:         split,
          calculated_at:         new Date().toISOString(),
        },
      });

      console.log(`[payment-gateway] Split calculated for R$${transaction_amount}: prestador=R$${split.prestador_amount}, application_fee=R$${split.application_fee}`);

      // --- [MOCK PIX IN TEST ENV] ---
      const mpAccessToken = (Deno.env.get("ENVIRONMENT") === "production" ? Deno.env.get("MP_ACCESS_TOKEN") : Deno.env.get("MP_ACCESS_TOKEN_TEST")) || Deno.env.get("MP_ACCESS_TOKEN_TEST") || "";
      let mpData: any;
      let mpStatus: number;

      if (payment_method_id === "pix" && mpAccessToken.startsWith("TEST-")) {
        console.log("[payment-gateway] MOCKING PIX PAYMENT FOR SANDBOX");
        mpStatus = 201;
        mpData = {
          id: 99999999999,
          status: "pending",
          status_detail: "pending_waiting_transfer",
          point_of_interaction: {
            transaction_data: {
              qr_code: "00020101021243650016COM.MERCADOLIBRE02013063638f1192a-5fd1-4180-a180-8bcae3556bc35204000053039865802BR5925PAGAMENTO MOCK PIX SANDBOX6009SAO PAULO62070503***6304A1B2",
              qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", // 1x1 transparent pixel base64
              ticket_url: "https://sandbox.mercadopago.com.br/ticket/mock"
            }
          }
        };
      } else {
        // --- [4] Call Mercado Pago with application_fee ---
        const result = await createMercadoPagoPayment({
          transactionAmount:  transaction_amount,
          description,
          payerEmail:         payer_email,
          payerFirstName:     payer_first_name,
          payerLastName:      payer_last_name,
          applicationFee:     split.application_fee,
          paymentMethodId:    payment_method_id,
          cardToken,
          installments,
          externalReference:  external_reference,
          metadata,
        });
        mpData = result.data;
        mpStatus = result.httpStatus;
      }

      // --- [5] Audit: raw MP response ---
      const auditStatus = mpData.status ?? (mpStatus >= 400 ? "failed" : "unknown");
      await logAuditEvent({
        transactionType: "pix_intent",
        status: auditStatus,
        payload: mpData as Record<string, unknown>,
        errorDetails: mpData.error
          ? `[${mpData.error}] ${mpData.message ?? ""} ${JSON.stringify(mpData.cause ?? [])}`
          : undefined,
      });

      // --- [6] Handle MP API errors ---
      if (mpStatus >= 400 || mpData.error) {
        console.error("[payment-gateway] Mercado Pago returned error:", mpStatus, mpData);
        return new Response(
          JSON.stringify({
            error:             "Payment provider rejected the request.",
            detail:            mpData.message ?? mpData.error ?? "Unknown MP error",
            mp_status:         mpData.status,
            mp_status_detail:  mpData.status_detail,
          }),
          {
            status: mpStatus >= 400 ? mpStatus : 502,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      // --- [7] Persist split record in pagamentos_split (idempotent upsert) ---
      // Only persist if we have an external_reference to use as the transaction_id key.
      // If omitted by the caller, we use the MP payment ID as fallback.
      const transactionId = external_reference ?? `mp_${mpData.id}`;
      const { persisted: splitPersisted, error: splitError } = await persistSplitRecord({
        transactionId,
        serviceType: service_type as ServiceType,
        serviceId:   service_id,
        split,
        entityId:    entity_id ?? null,
        godparentId: godparent_id ?? null,
      });

      if (!splitPersisted) {
        // Non-blocking: log the failure but do not abort the payment response
        console.error("[payment-gateway] Split record persistence failed:", splitError);
        await logAuditEvent({
          transactionType: "split_persist_failed",
          status: "error",
          payload: { transaction_id: transactionId, mp_payment_id: mpData.id },
          errorDetails: splitError,
        });
      } else {
        // Audit: split successfully registered
        await logAuditEvent({
          transactionType: "split_registered",
          status: "pending",
          payload: {
            transaction_id:   transactionId,
            mp_payment_id:    mpData.id,
            service_type,
            service_id,
            split_amounts:    split,
            split_config_source: splitFromDb ? "database" : "regulatory_defaults",
          },
        });
        console.log(`[payment-gateway] ✅ Split record created for transaction_id=${transactionId}`);
      }

      // --- [8] Return structured PIX data ---
      const txData = mpData.point_of_interaction?.transaction_data;

      return new Response(
        JSON.stringify({
          success: true,
          pix: {
            payment_id:         mpData.id,
            status:             mpData.status,
            status_detail:      mpData.status_detail,
            // external_reference ties the MP payment_id back to pagamentos_split.transaction_id
            external_reference: external_reference ?? null,
            ticket_url:         txData?.ticket_url    ?? null,
            qr_code:            txData?.qr_code       ?? null, // "Copia e Cola"
            qr_code_base64:     txData?.qr_code_base64 ?? null,
          },
          split: {
            total_amount:        split.total_amount,
            prestador_amount:    split.prestador_amount,
            application_fee:     split.application_fee,
            ubt_amount:          split.ubt_amount,
            comunidade_amount:   split.comunidade_amount,
            premio_trabalhador:  split.premio_trabalhador,
            premio_consumidor:   split.premio_consumidor,
            padrinho_amount:     split.padrinho_amount,
            config_source:       splitFromDb ? "database" : "regulatory_defaults",
          },
        }),
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
    const errorStack   = err instanceof Error ? err.stack    : undefined;

    console.error("[payment-gateway] Unhandled error:", errorMessage);

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

