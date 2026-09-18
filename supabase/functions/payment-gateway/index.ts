import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS HEADERS — strict, minimal surface
// ============================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization, Content-Type, Accept, X-Requested-With",
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
  ubt_pct:                number; // e.g.  7.500
  comunidade_pct:         number; // e.g.  0.500
  premio_trabalhador_pct: number; // e.g.  0.500
  premio_consumidor_pct:  number; // e.g.  0.500
  padrinho_tomador_pct:   number; // e.g.  0.500
  padrinho_prestador_pct: number; // e.g.  0.500
}

/**
 * Calculated monetary amounts (BRL, rounded to 2 decimal places).
 * prestador_amount + platform_fee = total_amount.
 */
interface SplitAmounts {
  total_amount:              number;
  prestador_amount:          number; // Goes to the service provider (90%)
  ubt_amount:                number; // UBT platform cut (7.5%)
  comunidade_amount:         number; // Community fund (0.5%)
  premio_trabalhador:        number; // Worker lottery pool (0.5%)
  premio_consumidor:         number; // Consumer loyalty pool (0.5%)
  padrinho_tomador_amount:   number; // Godparent tomador (0.5% - residual bucket)
  padrinho_prestador_amount: number; // Godparent prestador (0.5%)
  padrinho_amount:           number; // Legacy sum of godparent shares
  application_fee:           number; // Sum of all platform cuts sent to Mercado Pago
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
// ============================================================
const REGULATORY_DEFAULTS: SplitConfig = {
  prestador_pct:          90.000,
  ubt_pct:                 7.500,
  comunidade_pct:          0.500,
  premio_trabalhador_pct:  0.500,
  premio_consumidor_pct:   0.500,
  padrinho_tomador_pct:    0.500,
  padrinho_prestador_pct:  0.500,
};

async function fetchSplitConfig(): Promise<{ config: SplitConfig; fromDb: boolean }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("split_config")
      .select("prestador_pct, ubt_pct, comunidade_pct, premio_trabalhador_pct, premio_consumidor_pct, padrinho_tomador_pct, padrinho_prestador_pct")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.warn("[payment-gateway] split_config not found in DB — using regulatory defaults:", error?.message);
      return { config: REGULATORY_DEFAULTS, fromDb: false };
    }

    return {
      config: {
        prestador_pct:          Number(data.prestador_pct ?? 90.0),
        ubt_pct:                Number(data.ubt_pct ?? 7.5),
        comunidade_pct:         Number(data.comunidade_pct ?? 0.5),
        premio_trabalhador_pct: Number(data.premio_trabalhador_pct ?? 0.5),
        premio_consumidor_pct:  Number(data.premio_consumidor_pct ?? 0.5),
        padrinho_tomador_pct:   Number(data.padrinho_tomador_pct ?? 0.5),
        padrinho_prestador_pct: Number(data.padrinho_prestador_pct ?? 0.5),
      },
      fromDb: true
    };
  } catch (err) {
    console.error("[payment-gateway] Error fetching split_config — using regulatory defaults:", err);
    return { config: REGULATORY_DEFAULTS, fromDb: false };
  }
}

// ============================================================
// SPLIT CALCULATOR — cent-precise with residual bucket
// The `padrinho_tomador_amount` absorbs floating-point rounding drift so that
// the sum of all parts ALWAYS equals `total_amount` exactly.
// ============================================================
function calculateSplitAmounts(totalAmount: number, config: SplitConfig): SplitAmounts {
  const r = (v: number) => Math.round(v * 100) / 100; // round to 2 decimal places

  const prestador_amount          = r(totalAmount * (config.prestador_pct          / 100));
  const ubt_amount                = r(totalAmount * (config.ubt_pct                / 100));
  const comunidade_amount         = r(totalAmount * (config.comunidade_pct         / 100));
  const premio_trabalhador        = r(totalAmount * (config.premio_trabalhador_pct / 100));
  const premio_consumidor         = r(totalAmount * (config.premio_consumidor_pct  / 100));
  const padrinho_prestador_amount = r(totalAmount * (config.padrinho_prestador_pct / 100));

  // Residual bucket: padrinho_tomador absorbs any rounding drift to guarantee total integrity
  const sumBeforeResidual = r(
    prestador_amount + ubt_amount + comunidade_amount + premio_trabalhador + premio_consumidor + padrinho_prestador_amount
  );
  const padrinho_tomador_amount = r(Math.max(0, totalAmount - sumBeforeResidual));

  // application_fee = everything the marketplace retains sent to Mercado Pago
  const application_fee = r(totalAmount - prestador_amount);

  return {
    total_amount:              totalAmount,
    prestador_amount,
    ubt_amount,
    comunidade_amount,
    premio_trabalhador,
    premio_consumidor,
    padrinho_tomador_amount,
    padrinho_prestador_amount,
    padrinho_amount:           r(padrinho_tomador_amount + padrinho_prestador_amount),
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
  godparentTomadorId,
  godparentPrestadorId,
}: {
  transactionId:         string;
  serviceType:           ServiceType;
  serviceId:             string;
  split:                 SplitAmounts;
  entityId?:             string | null;
  godparentTomadorId?:   string | null;
  godparentPrestadorId?: string | null;
}): Promise<{ persisted: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("pagamentos_split").upsert(
      {
        transaction_id:             transactionId,
        status:                     "pending",
        service_type:               serviceType,
        service_id:                 serviceId,
        total_amount:               split.total_amount,
        provider_amount:            split.prestador_amount,
        ubt_amount:                 split.ubt_amount,
        entity_amount:              split.comunidade_amount,
        entity_id:                  entityId ?? null,
        prize_worker_amount:        split.premio_trabalhador,
        prize_consumer_amount:      split.premio_consumidor,
        godparent_tomador_amount:   split.padrinho_tomador_amount,
        godparent_tomador_id:       godparentTomadorId ?? null,
        godparent_prestador_amount: split.padrinho_prestador_amount,
        godparent_prestador_id:     godparentPrestadorId ?? null,
        godparent_amount:           split.padrinho_amount,
        godparent_id:               godparentTomadorId ?? null,
        refunded_amount:            0.00,
        updated_at:                 new Date().toISOString(),
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
  payer,
  payerEmail,
  payerFirstName,
  payerLastName,
  payerIdentification,
  applicationFee,
  paymentMethodId = "pix",
  cardToken,
  installments = 1,
  externalReference,
  metadata,
  sellerAccessToken,
}: {
  transactionAmount:  number;
  description:        string;
  payer?:             Record<string, unknown>;
  payerEmail?:        string;
  payerFirstName?:    string;
  payerLastName?:     string;
  payerIdentification?: { type?: string; number?: string };
  applicationFee:     number;
  paymentMethodId?:   string;
  cardToken?:         string;
  installments?:      number;
  externalReference?: string;
  metadata?:          Record<string, unknown>;
  sellerAccessToken?: string;
}): Promise<{ data: MercadoPagoPixResponse; rawText: string; httpStatus: number; ok: boolean }> {
  // O token dinâmico do Seller de Teste (obtido via OAuth com test_token=true ou env fallback)
  const mpToken = (
    sellerAccessToken ||
    Deno.env.get("MERCADOPAGO_SELLER_TEST_TOKEN") ||
    Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ||
    Deno.env.get("MP_ACCESS_TOKEN") ||
    ""
  ).trim();

  if (!mpToken) {
    console.error("[CRITICAL MP TOKEN ERROR] Token de acesso (Seller) não está presente no ambiente nem na conta vinculada!");
    throw new Error("Token de acesso do vendedor não configurado. Complete o fluxo OAuth do prestador.");
  }

  // Unique idempotency key per attempt
  const idempotencyKey = crypto.randomUUID();

  const isCard = paymentMethodId !== "pix" || Boolean(cardToken);

  // Email de comprador homologado no sandbox Mercado Pago
  const safePayerEmail = (payerEmail || "").includes("@testuser.com")
    ? payerEmail
    : "TESTUSER367958859718560557@testuser.com";

  const payerObj: Record<string, unknown> = {
    ...(payer || {}),
    email: safePayerEmail,
  };
  if (payerFirstName && !payerObj.first_name) {
    payerObj.first_name = payerFirstName;
  }
  if (payerLastName && !payerObj.last_name) {
    payerObj.last_name = payerLastName;
  }
  if (payerIdentification && !payerObj.identification) {
    payerObj.identification = payerIdentification;
  }

  const mpPayload: Record<string, unknown> = {
    transaction_amount: transactionAmount,
    description,
    payment_method_id: paymentMethodId || (cardToken ? "master" : "pix"),
    ...(Object.keys(payerObj).length > 0 ? { payer: payerObj } : {}),
    // application_fee: a taxa retida pela UBT (marketplace) do total
    application_fee: applicationFee,
    ...(externalReference ? { external_reference: externalReference } : {}),
    ...(metadata ? { metadata } : {}),
  };

  // Injeção do token de cartão para /v1/payments
  if (cardToken) {
    mpPayload.token = cardToken;
  }
  if (isCard) {
    mpPayload.installments = Number(installments) || 1;
  }

  const MP_URL = "https://api.mercadopago.com/v1/payments";

  const mpHeaders = new Headers();
  mpHeaders.set("Authorization", `Bearer ${mpToken}`);
  mpHeaders.set("Content-Type", "application/json");
  mpHeaders.set("X-Idempotency-Key", idempotencyKey);

  console.log(`[MP FETCH] Target URL: ${MP_URL}`);
  console.log(`[MP FETCH] Seller Authorization: Bearer ${mpToken.substring(0, 15)}... (Len: ${mpToken.length}) [${mpToken.startsWith("TEST-") ? "SANDBOX SELLER TOKEN" : "CUSTOM TOKEN"}]`);

  const mpResponse = await fetch(MP_URL, {
    method: "POST",
    headers: mpHeaders,
    body: JSON.stringify(mpPayload),
  });

  const mpResponseBody = await mpResponse.text();
  
  if (!mpResponse.ok) {
    console.error("[MP CRITICAL REJECTION]", mpResponseBody);
  }

  let data: any;
  try {
    data = JSON.parse(mpResponseBody);
  } catch (parseErr) {
    data = { error: "Invalid JSON from MP", raw: mpResponseBody };
  }

  return { data, rawText: mpResponseBody, httpStatus: mpResponse.status, ok: mpResponse.ok };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request): Promise<Response> => {
  const envToken = (Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
  console.log("[TOKEN CHECK INIT] MERCADOPAGO_ACCESS_TOKEN presente:", envToken ? `SIM (Tamanho: ${envToken.length}, Prefixo: ${envToken.substring(0, 15)}...)` : "NAO");

  // 1. Intercept OPTIONS preflight immediately
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[payment-gateway] Failed to parse JSON body:", parseErr);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body in request." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log("RAW REQ BODY:", JSON.stringify(body));

    // Desempacota payload caso venha aninhado em body.body
    if (body && typeof body === "object" && body.body && typeof body.body === "object") {
      body = { ...body.body, ...body };
    }

    const rawAction = String(body.action || body.type || body.event || "create_payment_intent").toLowerCase().trim();
    console.log(`[payment-gateway] Handling action="${rawAction}"`);

    // ----------------------------------------------------------------
    // ROUTE: OAUTH - Gerar URL de Autorização (com test_token=true)
    // ----------------------------------------------------------------
    if (rawAction === "get_oauth_url" || rawAction === "oauth_url" || rawAction === "get_auth_url" || rawAction === "oauth") {
      const clientId = (Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("MP_CLIENT_ID") || "3679588597185605").trim();
      const state = body.state || crypto.randomUUID();
      const redirectUri = body.redirect_uri || `${body.origin || "https://app-git-main-ubtservicos-projects.vercel.app"}/app/config/financeiro`;
      const isTestToken = body.test_token !== false;

      if (body.user_id) {
        try {
          const { error: insertErr } = await supabaseAdmin.from("marketplace_oauth_connections").insert({
            user_id: body.user_id,
            state_reference: state,
            authorization_status: "started",
          });
          if (insertErr) {
            console.warn("[payment-gateway] Non-blocking: could not record oauth start in DB:", insertErr.message);
          }
        } catch (e) {
          console.warn("[payment-gateway] Exception inserting oauth state:", e);
        }
      }

      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}${isTestToken ? "&test_token=true" : ""}`;

      console.log(`[payment-gateway] Generated OAuth URL (test_token=${isTestToken}):`, authUrl);

      return new Response(
        JSON.stringify({
          success: true,
          oauth_url: authUrl,
          state,
          client_id: clientId,
          test_token: isTestToken,
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------
    // ROUTE: OAUTH - Troca de Authorization Code por Tokens (test_token=true)
    // ----------------------------------------------------------------
    if (rawAction === "exchange_oauth_code" || rawAction === "oauth_callback" || rawAction === "exchange_code") {
      const clientId = (Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("MP_CLIENT_ID") || "3679588597185605").trim();
      const clientSecret = (Deno.env.get("MERCADOPAGO_CLIENT_SECRET") || Deno.env.get("MP_CLIENT_SECRET") || "").trim();
      const { code, redirect_uri, user_id, state } = body;

      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing authorization code" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const formParams = new URLSearchParams();
      formParams.append("client_id", clientId);
      formParams.append("client_secret", clientSecret);
      formParams.append("grant_type", "authorization_code");
      formParams.append("code", code);
      if (redirect_uri) formParams.append("redirect_uri", redirect_uri);
      formParams.append("test_token", "true"); // OBRIGATÓRIO CONFORME DIRETRIZ TÉCNICA MP

      console.log(`[MP OAUTH TOKEN EXCHANGE] Exchanging code for user_id=${user_id} with test_token=true`);

      const mpTokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: formParams.toString(),
      });

      const tokenData = await mpTokenRes.json();
      console.log("[MP OAUTH TOKEN RESULT]:", mpTokenRes.status, tokenData);

      if (!mpTokenRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "MP OAuth Token Error", details: tokenData }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      if (user_id) {
        try {
          await supabaseAdmin.from("marketplace_accounts").upsert({
            user_id,
            mercado_pago_user_id: String(tokenData.user_id),
            status: "CONNECTED",
            ambiente: "sandbox",
            access_token_encrypted: tokenData.access_token,
            refresh_token_encrypted: tokenData.refresh_token,
            token_metadata: tokenData,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,ambiente" });

          if (state) {
            await supabaseAdmin.from("marketplace_oauth_connections")
              .update({ authorization_status: "exchanged", updated_at: new Date().toISOString() })
              .eq("state_reference", state);
          }
        } catch (dbErr) {
          console.error("[payment-gateway] Error persisting marketplace_account:", dbErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Conta de Teste Mercado Pago vinculada com sucesso ao vendedor",
          user_id: tokenData.user_id,
          public_key: tokenData.public_key,
          live_mode: tokenData.live_mode,
          test_token: true,
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------
    // ROUTE: Payment Intent / Checkout (with Split)
    // ----------------------------------------------------------------
    const action = rawAction.includes("checkout") ? "checkout" : "create_payment_intent";
    if (action === "create_payment_intent" || action === "checkout") {
      const rawAmount = body.transaction_amount ?? body.amount ?? body.final_amount ?? body.total_amount ?? body.price ?? body.final_price;
      const transaction_amount = Math.max(0.01, Number(rawAmount !== undefined && rawAmount !== null && !isNaN(Number(rawAmount)) ? Number(rawAmount) : 10.0));
      const rawServiceType = String(body.service_type || body.serviceType || "mototaxi").toLowerCase().trim();
      const service_type = (["mototaxi", "diarista", "ambulante"].includes(rawServiceType) ? rawServiceType : "mototaxi") as ServiceType;
      const service_id = String(body.service_id || body.serviceId || body.ride_id || body.rideId || body.order_id || body.orderId || crypto.randomUUID());
      const description = String(body.description || `Serviço UBT ${service_type} - R$ ${transaction_amount.toFixed(2)}`);
      const payer_email = String(body.payer_email || body.email || body.payerEmail || body.payer?.email || "").trim();
      const payer_first_name = body.payer_first_name || body.payerFirstName || body.payer?.first_name || undefined;
      const payer_last_name = body.payer_last_name || body.payerLastName || body.payer?.last_name || undefined;
      const payer_identification = body.payer_identification || body.payerIdentification || body.payer?.identification || undefined;
      const payer = body.payer && typeof body.payer === "object" ? body.payer : undefined;
      
      let payment_method_id = String(
        body.payment_method_id ||
        body.paymentMethodId ||
        body.payment_method ||
        body.paymentMethod ||
        (body.token || body.card_token ? "master" : "pix")
      ).toLowerCase().trim();

      if (payment_method_id === "cartao" || payment_method_id === "cartão" || payment_method_id === "credit_card" || payment_method_id === "card") {
        payment_method_id = "master";
      }

      const external_reference = body.external_reference || body.externalReference || body.service_id || service_id;
      const entity_id = body.entity_id || body.entityId;
      const godparent_id = body.godparent_id || body.godparentId;
      const godparent_tomador_id = body.godparent_tomador_id || body.godparentTomadorId;
      const godparent_prestador_id = body.godparent_prestador_id || body.godparentPrestadorId;
      const provider_id = body.provider_id || body.providerId || "0a5edf64-7585-401f-b310-126529607da0";
      const provider_name = body.provider_name || body.providerName || "Silvina Luz";
      const metadata = body.metadata || {};
      const cardToken =
        body.token ||
        body.card_token ||
        body.card_token_id ||
        body.cardToken ||
        body.cardTokenId ||
        body.card_data?.token ||
        body.cardData?.token;

      console.log(`[payment-gateway] Extracted cardToken:`, cardToken ? `${cardToken.slice(0, 8)}... (${cardToken.length} chars)` : "NONE");
      const installments = Number(body.installments) || 1;

      // --- [1.1] Dynamic Seller Token Resolution ---
      let resolvedSellerToken = (body.seller_access_token || body.sellerToken || body.provider_token || "").trim();
      if (!resolvedSellerToken && provider_id) {
        try {
          const { data: sellerAcc } = await supabaseAdmin
            .from("marketplace_accounts")
            .select("access_token_encrypted")
            .eq("user_id", provider_id)
            .eq("status", "CONNECTED")
            .order("connected_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sellerAcc?.access_token_encrypted) {
            resolvedSellerToken = sellerAcc.access_token_encrypted.trim();
            console.log(`[payment-gateway] Loaded OAuth Seller Token for provider ${provider_id}`);
          }
        } catch (accErr) {
          console.warn("[payment-gateway] Error querying marketplace_accounts for provider:", accErr);
        }
      }

      // --- [1] Fetch live split rules from DB ---
      const { config: splitConfig, fromDb: splitFromDb } = await fetchSplitConfig();

      // --- [2] Calculate split amounts ---
      const split = calculateSplitAmounts(transaction_amount, splitConfig);

      // --- [2.1] Resolve 7 nominal destinations ---
      const resolvedProviderId = provider_id;
      const resolvedProviderName = provider_name;
      const resolvedAssocName = entity_id ? `Associação (${entity_id})` : "caixinha-mototaxista-sem-associação";
      const resolvedGodparentPrestador = godparent_prestador_id || "ubt-fundo-reserva-prestador";
      const resolvedGodparentTomador = godparent_tomador_id || godparent_id || "ubt-fundo-reserva-tomador";

      const nominalLedger = [
        { dest: 1, name: `Prestador (${resolvedProviderName})`, id: resolvedProviderId, pct: splitConfig.prestador_pct, amount: split.prestador_amount },
        { dest: 2, name: "Plataforma UBT (Taxa da Casa)", id: "ubt-platform-treasury", pct: splitConfig.ubt_pct, amount: split.ubt_amount },
        { dest: 3, name: `Padrinho Prestador (${resolvedGodparentPrestador})`, id: resolvedGodparentPrestador, pct: splitConfig.padrinho_prestador_pct, amount: split.padrinho_prestador_amount },
        { dest: 4, name: `Padrinho Tomador (${resolvedGodparentTomador})`, id: resolvedGodparentTomador, pct: splitConfig.padrinho_tomador_pct, amount: split.padrinho_tomador_amount },
        { dest: 5, name: `Associação Mototaxi (${resolvedAssocName})`, id: entity_id || "caixinha-mototaxista-sem-associação", pct: splitConfig.comunidade_pct, amount: split.comunidade_amount },
        { dest: 6, name: "Fundo Prêmio-Trabalhador (premio-trabalhador-2026)", id: "premio-trabalhador-2026", pct: splitConfig.premio_trabalhador_pct, amount: split.premio_trabalhador },
        { dest: 7, name: "Fundo Prêmio-Consumidor (premio-consumidor-2026)", id: "premio-consumidor-2026", pct: splitConfig.premio_consumidor_pct, amount: split.premio_consumidor },
      ];

      const sumNominal = nominalLedger.reduce((acc, curr) => acc + curr.amount, 0);

      const nominalLogString = `
========================================================================
💰 EXTRATO NOMINAL DE REPASSE — MOTOR DE SPLIT UBT (7 VIAS)
Total da Transação: R$ ${transaction_amount.toFixed(2)}
------------------------------------------------------------------------
1. Prestador (${resolvedProviderName}): R$ ${split.prestador_amount.toFixed(2)} (${splitConfig.prestador_pct.toFixed(1)}%)
2. Plataforma UBT (Taxa da Casa): R$ ${split.ubt_amount.toFixed(2)} (${splitConfig.ubt_pct.toFixed(1)}%)
3. Padrinho Prestador (${resolvedGodparentPrestador}): R$ ${split.padrinho_prestador_amount.toFixed(2)} (${splitConfig.padrinho_prestador_pct.toFixed(1)}%)
4. Padrinho Tomador (${resolvedGodparentTomador}): R$ ${split.padrinho_tomador_amount.toFixed(2)} (${splitConfig.padrinho_tomador_pct.toFixed(1)}%)
5. Associação (${resolvedAssocName}): R$ ${split.comunidade_amount.toFixed(2)} (${splitConfig.comunidade_pct.toFixed(1)}%)
6. Prêmio Trabalhador (premio-trabalhador-2026): R$ ${split.premio_trabalhador.toFixed(2)} (${splitConfig.premio_trabalhador_pct.toFixed(1)}%)
7. Prêmio Consumidor (premio-consumidor-2026): R$ ${split.premio_consumidor.toFixed(2)} (${splitConfig.premio_consumidor_pct.toFixed(1)}%)
------------------------------------------------------------------------
SOMA TOTAL DAS 7 VIAS: R$ ${sumNominal.toFixed(2)} (100.0%)
========================================================================`;

      console.log(nominalLogString);

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
          nominal_ledger:        nominalLedger,
          sum_nominal:           sumNominal,
          calculated_at:         new Date().toISOString(),
        },
      });

      // --- [4] Call Mercado Pago with dynamic seller token & application_fee ---
      let mpData: any;
      let mpStatus: number = 200;
      let mpResult: { data: any; rawText: string; httpStatus: number; ok: boolean } | null = null;

      mpResult = await createMercadoPagoPayment({
        transactionAmount:  transaction_amount,
        description,
        payer,
        payerEmail:         payer_email || undefined,
        payerFirstName:     payer_first_name,
        payerLastName:      payer_last_name,
        payerIdentification: payer_identification,
        applicationFee:     split.application_fee,
        paymentMethodId:    payment_method_id,
        cardToken,
        installments,
        externalReference:  external_reference,
        metadata,
        sellerAccessToken:  resolvedSellerToken || undefined,
      });
      mpData = mpResult.data;
      mpStatus = mpResult.httpStatus;

      // --- [5] Audit: raw MP response ---
      const auditStatus = mpData?.status ?? (mpStatus >= 400 ? "failed" : "unknown");
      await logAuditEvent({
        transactionType: "pix_intent",
        status: auditStatus,
        payload: mpData as Record<string, unknown>,
        errorDetails: mpData?.error
          ? `[${mpData.error}] ${mpData.message ?? ""} ${JSON.stringify(mpData.cause ?? [])}`
          : undefined,
      });

      // --- [6] Handle MP API errors ---
      if ((mpResult && !mpResult.ok) || mpStatus >= 400 || mpData?.error) {
        const rawRejection = mpResult?.rawText || JSON.stringify(mpData);
        console.error("[MP CRITICAL REJECTION]", rawRejection);
        return new Response(
          JSON.stringify({
            success: false,
            mp_error: rawRejection,
            error: "MP API Error",
            message: mpData?.message || mpData?.error || "Erro ao processar pagamento",
            details: mpData?.cause || mpData,
            status: mpStatus,
            mp_status: mpData?.status || mpStatus,
            mp_status_detail: mpData?.status_detail,
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      // --- [7] Persist split record in pagamentos_split (idempotent upsert) ---
      const transactionId = external_reference ?? `mp_${mpData.id}`;
      const { persisted: splitPersisted, error: splitError } = await persistSplitRecord({
        transactionId,
        serviceType: service_type as ServiceType,
        serviceId:   service_id,
        split,
        entityId:    entity_id ?? null,
        godparentTomadorId:   godparent_tomador_id ?? godparent_id ?? null,
        godparentPrestadorId: godparent_prestador_id ?? null,
      });

      if (!splitPersisted) {
        console.error("[payment-gateway] Split record persistence failed:", splitError);
        await logAuditEvent({
          transactionType: "split_persist_failed",
          status: "error",
          payload: { transaction_id: transactionId, mp_payment_id: mpData.id },
          errorDetails: splitError,
        });
      } else {
        await logAuditEvent({
          transactionType: "split_registered",
          status: "pending",
          payload: {
            transaction_id:   transactionId,
            mp_payment_id:    mpData.id,
            service_type,
            service_id,
            split_amounts:    split,
            nominal_ledger:   nominalLedger,
            sum_nominal:      sumNominal,
            split_config_source: splitFromDb ? "database" : "regulatory_defaults",
          },
        });
        console.log(`[payment-gateway] ✅ Split record created for transaction_id=${transactionId}`);
      }

      // --- [7.1] Update mototaxi_corridas status to paid if applicable ---
      if (service_type === "mototaxi" && service_id) {
        try {
          await supabaseAdmin
            .from("mototaxi_corridas")
            .update({
              status: "paid",
              final_price: transaction_amount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", service_id);
          console.log(`[payment-gateway] ✅ mototaxi_corridas id=${service_id} updated to status=paid`);
        } catch (corridaErr) {
          console.error("[payment-gateway] Error updating mototaxi_corridas:", corridaErr);
        }
      }

      // --- [8] Return structured PIX/Card data ---
      const txData = mpData.point_of_interaction?.transaction_data;

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id:                 mpData.id,
            status:             mpData.status,
            status_detail:      mpData.status_detail,
            payment_method_id:  mpData.payment_method_id || payment_method_id,
            transaction_amount: mpData.transaction_amount || transaction_amount,
          },
          pix: {
            payment_id:         mpData.id,
            status:             mpData.status,
            status_detail:      mpData.status_detail,
            external_reference: external_reference ?? null,
            ticket_url:         txData?.ticket_url    ?? null,
            qr_code:            txData?.qr_code       ?? null,
            qr_code_base64:     txData?.qr_code_base64 ?? null,
          },
          split: {
            total_amount:              split.total_amount,
            prestador_amount:          split.prestador_amount,
            application_fee:           split.application_fee,
            ubt_amount:                split.ubt_amount,
            comunidade_amount:         split.comunidade_amount,
            premio_trabalhador:        split.premio_trabalhador,
            premio_consumidor:         split.premio_consumidor,
            padrinho_tomador_amount:   split.padrinho_tomador_amount,
            padrinho_prestador_amount: split.padrinho_prestador_amount,
            padrinho_amount:           split.padrinho_amount,
            config_source:             splitFromDb ? "database" : "regulatory_defaults",
            nominal_ledger:            nominalLedger,
            statement:                 nominalLogString,
          },
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // --- Unrecognized action ---
    return new Response(
      JSON.stringify({ error: `Unknown action: ${rawAction}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack   = error instanceof Error ? error.stack    : undefined;

    console.error("[CRITICAL ERROR CATCH]", error);

    try {
      await logAuditEvent({
        transactionType: "unknown",
        status: "failed",
        payload: { timestamp: new Date().toISOString() },
        errorDetails: `${errorMessage}${errorStack ? `\n${errorStack}` : ""}`,
      });
    } catch {
      // ignore audit failure on fatal catch
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage || "Internal server error. Incident logged.",
        message: errorMessage,
        stack: errorStack,
        details: error,
      }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

