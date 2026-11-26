import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MpEnvironment = "sandbox" | "production";
type PaymentRoute = "seller_oauth_split" | "platform_fallback";
type ServiceType = "mototaxi" | "diarista" | "ambulante";

interface SplitConfig {
  prestador_pct: number;
  ubt_pct: number;
  comunidade_pct: number;
  premio_trabalhador_pct: number;
  premio_consumidor_pct: number;
  padrinho_tomador_pct: number;
  padrinho_prestador_pct: number;
}

interface SplitAmounts {
  base_amount: number;
  fee_pct: number;
  fee_amount: number;
  total_amount: number;
  prestador_amount: number;
  ubt_amount: number;
  comunidade_amount: number;
  premio_trabalhador: number;
  premio_consumidor: number;
  padrinho_tomador_amount: number;
  padrinho_prestador_amount: number;
  padrinho_amount: number;
  application_fee: number;
}

interface GatewayFeeSettings {
  taxaPixPct: number;
  taxaCardPct: number;
  source: "database" | "defaults";
}

interface RoutingDecision {
  mode: PaymentRoute;
  authToken: string;
  checkoutPublicKey: string | null;
  marketplaceAccountId: string | null;
  mercadoPagoUserId: string | null;
  collectorScope: string;
  fallbackReason: string | null;
}

interface MpResult {
  ok: boolean;
  httpStatus: number;
  data: Record<string, any>;
  outcomeUnknown?: boolean;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

// Do not throw during module evaluation. A top-level exception prevents the
// worker from starting and Supabase can only return an opaque 503. Keeping the
// client lazy lets the request boundary return a structured configuration error.
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

function adminClient() {
  if (!supabaseAdmin) {
    throw new HttpError(
      500,
      "server_configuration_error",
      "A função de pagamento está sem a configuração obrigatória do Supabase.",
    );
  }
  return supabaseAdmin;
}

const REGULATORY_DEFAULTS: SplitConfig = {
  prestador_pct: 90,
  ubt_pct: 7.5,
  comunidade_pct: 0.5,
  premio_trabalhador_pct: 0.5,
  premio_consumidor_pct: 0.5,
  padrinho_tomador_pct: 0.5,
  padrinho_prestador_pct: 0.5,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function paymentEnvironment(): MpEnvironment {
  const value = (Deno.env.get("MP_ENVIRONMENT") || Deno.env.get("APP_ENV") || "")
    .trim()
    .toLowerCase();
  if (value !== "sandbox" && value !== "production") {
    throw new Error("MP_ENVIRONMENT must be explicitly set to 'sandbox' or 'production'");
  }
  return value;
}

function platformAccessToken(environment: MpEnvironment): string {
  const scopedName = environment === "sandbox"
    ? "MP_ACCESS_TOKEN_SANDBOX"
    : "MP_ACCESS_TOKEN_PRODUCTION";
  const scopedToken = Deno.env.get(scopedName)?.trim() ?? "";
  if (scopedToken || environment === "production") return scopedToken;
  return (
    Deno.env.get("MP_ACCESS_TOKEN") ||
    Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ||
    ""
  ).trim();
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const configuredEnvironment = (Deno.env.get("MP_ENVIRONMENT") || Deno.env.get("APP_ENV") || "")
    .trim()
    .toLowerCase();
  const allowOrigin = configured.includes(origin)
    ? origin
    : configuredEnvironment === "sandbox" && configured.length === 0
      ? "*"
      : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DEFAULT_FEE_SETTINGS: GatewayFeeSettings = {
  taxaPixPct: 0.0,
  taxaCardPct: 2.99,
  source: "defaults",
};

function normalizeFeePct(raw: unknown): number | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      // keep raw string
    }
  }
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) return null;
  // Convert strict fractional notation (e.g. 0.0299 -> 2.99) without altering 0.99% -> 0.99.
  return parsed > 0 && parsed < 0.2 ? roundMoney(parsed * 100) : parsed;
}

async function fetchGatewayFeeSettings(): Promise<GatewayFeeSettings> {
  const { data, error } = await adminClient()
    .from("system_settings")
    .select("chave, valor")
    .in("chave", ["taxa_pix", "taxa_cartao", "taxa_gateway_pix", "taxa_gateway_cartao", "taxa_credito"]);

  if (error || !data || data.length === 0) {
    return DEFAULT_FEE_SETTINGS;
  }

  let taxaPixPct = DEFAULT_FEE_SETTINGS.taxaPixPct;
  let taxaCardPct = DEFAULT_FEE_SETTINGS.taxaCardPct;
  let found = false;

  for (const row of data) {
    const pct = normalizeFeePct(row.valor);
    if (pct === null) continue;
    if (row.chave === "taxa_pix" || row.chave === "taxa_gateway_pix") {
      taxaPixPct = pct;
      found = true;
    } else if (
      row.chave === "taxa_cartao" ||
      row.chave === "taxa_gateway_cartao" ||
      row.chave === "taxa_credito"
    ) {
      taxaCardPct = pct;
      found = true;
    }
  }

  return {
    taxaPixPct,
    taxaCardPct,
    source: found ? "database" : "defaults",
  };
}

function calculateSplitAmounts(
  baseAmount: number,
  config: SplitConfig,
  feePct = 0,
  feeAmount = 0,
): SplitAmounts {
  const totalPct =
    config.prestador_pct +
    config.ubt_pct +
    config.comunidade_pct +
    config.premio_trabalhador_pct +
    config.premio_consumidor_pct +
    config.padrinho_prestador_pct +
    config.padrinho_tomador_pct;

  if (!Number.isFinite(totalPct) || Math.round(totalPct * 100) > 10000) {
    throw new HttpError(500, "invalid_split_configuration", "A configuração de split ultrapassa 100%.");
  }

  // Largest Remainder Method (Hamilton) em centavos inteiros:
  // garante soma exata === baseAmount e zero buckets negativos mesmo em valores baixos (ex: R$ 1,35 / R$ 1,36).
  const totalCents = Math.max(0, Math.round(baseAmount * 100));
  const buckets = [
    { key: "prestador", pct: config.prestador_pct, priority: 0 },
    { key: "ubt", pct: config.ubt_pct, priority: 1 },
    { key: "padrinho_prestador", pct: config.padrinho_prestador_pct, priority: 2 },
    { key: "padrinho_tomador", pct: config.padrinho_tomador_pct, priority: 3 },
    { key: "comunidade", pct: config.comunidade_pct, priority: 4 },
    { key: "premio_trabalhador", pct: config.premio_trabalhador_pct, priority: 5 },
    { key: "premio_consumidor", pct: config.premio_consumidor_pct, priority: 6 },
  ].map((b) => {
    const exact = (totalCents * b.pct) / 100;
    const floor = Math.floor(exact);
    return { ...b, floor, remainder: exact - floor, cents: floor };
  });

  const allocatedCents = buckets.reduce((sum, b) => sum + b.floor, 0);
  let remainingCents = totalCents - allocatedCents;

  if (remainingCents > 0) {
    const sorted = [...buckets].sort((a, b) => {
      if (Math.abs(b.remainder - a.remainder) > 1e-9) return b.remainder - a.remainder;
      return a.priority - b.priority;
    });
    for (let i = 0; i < sorted.length && remainingCents > 0; i++) {
      sorted[i].cents += 1;
      remainingCents -= 1;
    }
  }

  const centsByKey = Object.fromEntries(buckets.map((b) => [b.key, b.cents])) as Record<string, number>;
  const prestadorAmount = roundMoney(centsByKey.prestador / 100);
  const ubtAmount = roundMoney(centsByKey.ubt / 100);
  const comunidadeAmount = roundMoney(centsByKey.comunidade / 100);
  const premioTrabalhador = roundMoney(centsByKey.premio_trabalhador / 100);
  const premioConsumidor = roundMoney(centsByKey.premio_consumidor / 100);
  const padrinhoPrestadorAmount = roundMoney(centsByKey.padrinho_prestador / 100);
  const padrinhoTomadorAmount = roundMoney(centsByKey.padrinho_tomador / 100);

  const totalAmount = roundMoney(baseAmount + feeAmount);

  return {
    base_amount: baseAmount,
    fee_pct: feePct,
    fee_amount: feeAmount,
    total_amount: totalAmount,
    prestador_amount: prestadorAmount,
    ubt_amount: ubtAmount,
    comunidade_amount: comunidadeAmount,
    premio_trabalhador: premioTrabalhador,
    premio_consumidor: premioConsumidor,
    padrinho_tomador_amount: padrinhoTomadorAmount,
    padrinho_prestador_amount: padrinhoPrestadorAmount,
    padrinho_amount: roundMoney(padrinhoTomadorAmount + padrinhoPrestadorAmount),
    application_fee: roundMoney(totalAmount - prestadorAmount),
  };
}

async function fetchSplitConfig(): Promise<{ config: SplitConfig; source: "database" | "defaults" }> {
  const { data, error } = await adminClient()
    .from("split_config")
    .select("prestador_pct, ubt_pct, comunidade_pct, premio_trabalhador_pct, premio_consumidor_pct, padrinho_tomador_pct, padrinho_prestador_pct")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    console.warn("[payment-gateway] split_config unavailable; using regulatory defaults", error?.message);
    return { config: REGULATORY_DEFAULTS, source: "defaults" };
  }

  const config: SplitConfig = {
    prestador_pct: Number(data.prestador_pct),
    ubt_pct: Number(data.ubt_pct),
    comunidade_pct: Number(data.comunidade_pct),
    premio_trabalhador_pct: Number(data.premio_trabalhador_pct),
    premio_consumidor_pct: Number(data.premio_consumidor_pct),
    padrinho_tomador_pct: Number(data.padrinho_tomador_pct),
    padrinho_prestador_pct: Number(data.padrinho_prestador_pct),
  };
  const percentageTotal = Object.values(config).reduce((sum, value) => sum + value, 0);
  if (!Object.values(config).every(Number.isFinite) || Math.abs(Math.round(percentageTotal * 100) - 10000) > 1) {
    throw new HttpError(500, "invalid_split_configuration", "A configuração de split deve totalizar 100%.");
  }
  return { config, source: "database" };
}

async function logAuditEvent(
  transactionType: string,
  status: string,
  payload?: Record<string, unknown>,
  errorDetails?: string,
): Promise<void> {
  try {
    const { error } = await adminClient().from("financial_audit_logs").insert({
      transaction_type: transactionType,
      status,
      payload: payload ?? null,
      error_details: errorDetails?.slice(0, 4000) ?? null,
    });
    if (error) console.error("[payment-gateway] audit insert failed", error.message);
  } catch (error) {
    console.error("[payment-gateway] audit logger failed", error);
  }
}

async function authenticatedUserId(req: Request): Promise<string> {
  const authorization = req.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError(401, "missing_authorization", "Autenticação obrigatória.");

  const { data, error } = await adminClient().auth.getUser(jwt);
  if (error || !data.user) {
    throw new HttpError(401, "invalid_authorization", "Sessão inválida ou expirada.");
  }
  return data.user.id;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function tokenEncryptionKey(): Promise<CryptoKey | null> {
  const encoded = Deno.env.get("MP_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!encoded) return null;
  const bytes = base64ToBytes(encoded);
  if (bytes.length !== 32) throw new Error("MP_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(value: string, environment: MpEnvironment): Promise<string> {
  const key = await tokenEncryptionKey();
  if (!key) {
    if (environment === "production") {
      throw new Error("MP_TOKEN_ENCRYPTION_KEY is required in production");
    }
    return `plain:${value}`;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decryptToken(value: string, environment: MpEnvironment): Promise<string> {
  if (value.startsWith("v1:")) {
    const [, ivValue, cipherValue] = value.split(":");
    const key = await tokenEncryptionKey();
    if (!key || !ivValue || !cipherValue) throw new Error("Seller OAuth token cannot be decrypted");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivValue) },
      key,
      base64ToBytes(cipherValue),
    );
    return new TextDecoder().decode(plain);
  }
  if (value.startsWith("plain:") && environment === "sandbox") return value.slice(6);
  if (environment === "sandbox") return value;
  throw new Error("Unencrypted Seller OAuth token is not allowed in production");
}

function assertUuid(value: unknown, field: string): string {
  const normalized = String(value || "").trim();
  if (!UUID_RE.test(normalized)) {
    throw new HttpError(400, `invalid_${field}`, `${field} deve ser um UUID válido.`);
  }
  return normalized;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return assertUuid(value, field);
}

function normalizeServiceType(value: unknown): ServiceType {
  const service = String(value || "").trim().toLowerCase();
  if (service === "mototaxi") return "mototaxi";
  if (service === "diarista" || service === "services") return "diarista";
  if (service === "ambulante" || service === "delivery") return "ambulante";
  throw new HttpError(400, "invalid_service_type", "service_type não suportado.");
}

function validateAmount(value: unknown): number {
  const amount = Number(value);
  const configuredMax = Number(Deno.env.get("MP_MAX_PAYMENT_AMOUNT") || 100000);
  if (!Number.isFinite(amount) || amount <= 0 || amount > configuredMax) {
    throw new HttpError(400, "invalid_transaction_amount", "transaction_amount está fora do intervalo permitido.");
  }
  return roundMoney(amount);
}

function resolvePaymentAttemptId(body: Record<string, any>): {
  id: string;
  source: "payment_attempt_id" | "idempotency_key" | "legacy_external_reference";
} {
  if (body.payment_attempt_id !== undefined && body.payment_attempt_id !== null) {
    return { id: assertUuid(body.payment_attempt_id, "payment_attempt_id"), source: "payment_attempt_id" };
  }
  if (body.idempotency_key !== undefined && body.idempotency_key !== null) {
    return { id: assertUuid(body.idempotency_key, "idempotency_key"), source: "idempotency_key" };
  }

  // Compatibilidade transitória com o bundle anterior do CheckoutUniversal,
  // que usava o UUID da corrida em external_reference e não enviava uma
  // payment_attempt_id separada. O frontend atual sempre envia o novo campo.
  if (body.external_reference !== undefined && body.external_reference !== null) {
    return {
      id: assertUuid(body.external_reference, "external_reference"),
      source: "legacy_external_reference",
    };
  }

  throw new HttpError(
    400,
    "invalid_payment_attempt_id",
    "payment_attempt_id é obrigatório e deve ser um UUID.",
  );
}

function resolvePayerEmail(body: Record<string, any>, environment: MpEnvironment): string {
  if (environment === "sandbox") {
    const testBuyerEmail = (Deno.env.get("MP_TEST_PAYER_EMAIL") || "").trim().toLowerCase();
    if (!EMAIL_RE.test(testBuyerEmail) || !testBuyerEmail.endsWith("@testuser.com")) {
      throw new HttpError(
        500,
        "invalid_test_buyer_configuration",
        "MP_TEST_PAYER_EMAIL deve conter o e-mail de uma conta Buyer Test User.",
      );
    }
    const forbidden = (Deno.env.get("MP_TEST_SELLER_EMAILS") || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (forbidden.includes(testBuyerEmail)) {
      throw new HttpError(500, "test_self_payment", "Buyer Test User não pode ser a conta Marketplace/Seller.");
    }
    return testBuyerEmail;
  }

  const payerEmail = String(body.payer_email || body.payer?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(payerEmail) || payerEmail.endsWith("@testuser.com")) {
    throw new HttpError(400, "invalid_payer_email", "payer.email de produção é inválido.");
  }
  return payerEmail;
}

async function resolvePaymentRoute(providerId: string, environment: MpEnvironment): Promise<RoutingDecision> {
  const platformToken = platformAccessToken(environment);
  const { data: sellerAccount, error } = await adminClient()
    .from("marketplace_accounts")
    .select("id, mercado_pago_user_id, access_token_encrypted, ambiente, status, token_expiration, token_metadata")
    .eq("user_id", providerId)
    .eq("ambiente", environment)
    .eq("status", "CONNECTED")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "seller_account_lookup_failed", "Não foi possível resolver a conta recebedora.");
  }

  if (!sellerAccount) {
    if (!platformToken) throw new HttpError(500, "missing_platform_token", "Access Token da plataforma não configurado.");
    return {
      mode: "platform_fallback",
      authToken: platformToken,
      checkoutPublicKey: null,
      marketplaceAccountId: null,
      mercadoPagoUserId: null,
      collectorScope: "platform",
      fallbackReason: "seller_not_connected",
    };
  }

  const allowedSandboxSellers = (Deno.env.get("MP_TEST_SELLER_USER_IDS") || "")
    .split(",")
    .map((userId) => userId.trim())
    .filter(Boolean);
  if (
    environment === "sandbox" && allowedSandboxSellers.length > 0 &&
    !allowedSandboxSellers.includes(String(sellerAccount.mercado_pago_user_id || ""))
  ) {
    throw new HttpError(
      409,
      "seller_test_user_mismatch",
      "A conta OAuth vinculada não é o Seller Test User autorizado para este Sandbox.",
    );
  }

  if (sellerAccount.token_expiration && new Date(sellerAccount.token_expiration).getTime() <= Date.now()) {
    if (!platformToken) throw new HttpError(500, "missing_platform_token", "Access Token da plataforma não configurado.");
    return {
      mode: "platform_fallback",
      authToken: platformToken,
      checkoutPublicKey: null,
      marketplaceAccountId: sellerAccount.id,
      mercadoPagoUserId: null,
      collectorScope: "platform",
      fallbackReason: "seller_token_expired",
    };
  }

  const liveMode = sellerAccount.token_metadata?.live_mode;
  if (typeof liveMode === "boolean" && liveMode !== (environment === "production")) {
    throw new HttpError(409, "seller_environment_mismatch", "A credencial OAuth do Seller pertence a outro ambiente.");
  }

  if (!sellerAccount.access_token_encrypted) {
    throw new HttpError(409, "seller_token_missing", "A conta do Seller está CONNECTED, mas não possui Access Token.");
  }

  const sellerToken = (await decryptToken(sellerAccount.access_token_encrypted, environment)).trim();
  if (!sellerToken) throw new HttpError(409, "seller_token_missing", "Access Token OAuth do Seller está vazio.");

  const sellerMpUserId = String(sellerAccount.mercado_pago_user_id || "").trim() || null;

  return {
    mode: "seller_oauth_split",
    authToken: sellerToken,
    checkoutPublicKey: String(sellerAccount.token_metadata?.public_key || "").trim() || null,
    marketplaceAccountId: sellerAccount.id,
    mercadoPagoUserId: sellerMpUserId,
    collectorScope: sellerMpUserId ? `seller:${sellerMpUserId}` : `account:${sellerAccount.id}`,
    fallbackReason: null,
  };
}

async function handleGetCheckoutConfig(req: Request, body: Record<string, any>): Promise<Response> {
  const environment = paymentEnvironment();
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const [route, feeSettings] = await Promise.all([
    resolvePaymentRoute(providerId, environment),
    fetchGatewayFeeSettings(),
  ]);
  if (route.mode === "seller_oauth_split" && !route.checkoutPublicKey) {
    throw new HttpError(
      409,
      "seller_public_key_missing",
      "A conta OAuth do Seller não possui Public Key para tokenizar o cartão.",
    );
  }
  const platformPublicKey = (Deno.env.get("MP_PUBLIC_KEY") || Deno.env.get("MERCADOPAGO_PUBLIC_KEY") || "").trim() || null;
  return json(req, {
    success: true,
    environment,
    payment_route: route.mode,
    public_key: route.checkoutPublicKey || platformPublicKey,
    fallback_reason: route.fallbackReason,
    fee_settings: {
      taxa_pix_pct: feeSettings.taxaPixPct,
      taxa_cartao_pct: feeSettings.taxaCardPct,
      source: feeSettings.source,
    },
  });
}

function sanitizePayer(body: Record<string, any>, email: string): Record<string, unknown> {
  const payer = body.payer && typeof body.payer === "object" ? body.payer : {};
  const firstName = String(body.payer_first_name || payer.first_name || "").trim().slice(0, 60);
  const lastName = String(body.payer_last_name || payer.last_name || "").trim().slice(0, 60);
  const rawIdentification = body.payer_identification || payer.identification;
  const identificationNumber = String(rawIdentification?.number || "").replace(/\D/g, "").slice(0, 20);
  const identificationType = String(rawIdentification?.type || "CPF").trim().toUpperCase().slice(0, 10);

  return {
    email,
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    ...(identificationNumber
      ? { identification: { type: identificationType, number: identificationNumber } }
      : {}),
  };
}

async function createMercadoPagoPayment(input: {
  authToken: string;
  idempotencyKey: string;
  transactionAmount: number;
  description: string;
  paymentMethodId: string;
  payer: Record<string, unknown>;
  cardToken?: string;
  installments: number;
  externalReference: string;
  metadata: Record<string, unknown>;
  applicationFee?: number;
}): Promise<MpResult> {
  const isCard = Boolean(input.cardToken) || input.paymentMethodId !== "pix";
  if (isCard && !input.cardToken) {
    throw new HttpError(400, "missing_card_token", "Pagamento com cartão exige tokenização prévia.");
  }

  const notificationUrl = (
    Deno.env.get("MP_WEBHOOK_URL") ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1/payment-webhook` : "")
  ).trim();

  const payload: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description,
    payment_method_id: input.paymentMethodId,
    payer: input.payer,
    external_reference: input.externalReference,
    metadata: input.metadata,
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    ...(input.applicationFee !== undefined ? { application_fee: input.applicationFee } : {}),
    ...(input.cardToken ? { token: input.cardToken } : {}),
    ...(isCard ? { installments: input.installments } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${input.authToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: Record<string, any>;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "invalid_gateway_response", message: "Mercado Pago retornou uma resposta inválida." };
    }
    return { ok: response.ok, httpStatus: response.status, data };
  } catch (error) {
    const timeoutError = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      httpStatus: timeoutError ? 504 : 502,
      outcomeUnknown: true,
      data: {
        error: timeoutError ? "gateway_timeout" : "gateway_network_error",
        message: timeoutError
          ? "Timeout ao comunicar com o Mercado Pago."
          : "Falha de rede ao comunicar com o Mercado Pago.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ledgerStatus(mpStatus: string | undefined, failure: boolean): string {
  if (failure) return "rejected";
  if (["approved", "in_mediation", "rejected", "refunded", "charged_back"].includes(mpStatus || "")) {
    return mpStatus!;
  }
  return "pending";
}

async function resolveGodparentSplitContext(
  tomadorId: string | null,
  providerId: string,
  explicitTomadorGodparentId: string | null,
  explicitPrestadorGodparentId: string | null,
): Promise<{
  godparentTomadorId: string | null;
  godparentPrestadorId: string | null;
  statusRepasseTomador: "nao_aplicavel" | "pendente_repasse" | "contingenciado";
  statusRepassePrestador: "nao_aplicavel" | "pendente_repasse" | "contingenciado";
}> {
  let godparentTomadorId = explicitTomadorGodparentId;
  let godparentPrestadorId = explicitPrestadorGodparentId;

  const idsToFetch = [tomadorId, providerId].filter(Boolean) as string[];
  if ((!godparentTomadorId || !godparentPrestadorId) && idsToFetch.length > 0) {
    const { data: usersData } = await adminClient()
      .from("usuarios")
      .select("id, padrinho_id")
      .in("id", idsToFetch);

    if (usersData) {
      for (const u of usersData) {
        if (!godparentTomadorId && tomadorId && u.id === tomadorId && u.padrinho_id) {
          godparentTomadorId = u.padrinho_id;
        }
        if (!godparentPrestadorId && u.id === providerId && u.padrinho_id) {
          godparentPrestadorId = u.padrinho_id;
        }
      }
    }
  }

  const godparentIds = [godparentTomadorId, godparentPrestadorId].filter(Boolean) as string[];
  const pixByUser = new Map<string, boolean>();
  if (godparentIds.length > 0) {
    const [{ data: gpUsers }, { data: gpProfiles }] = await Promise.all([
      adminClient().from("usuarios").select("id, chave_pix").in("id", godparentIds),
      adminClient().from("profiles").select("id, pix_key").in("id", godparentIds),
    ]);
    for (const gp of gpUsers || []) {
      if (String(gp.chave_pix || "").trim()) pixByUser.set(gp.id, true);
    }
    for (const pr of gpProfiles || []) {
      if (String(pr.pix_key || "").trim()) pixByUser.set(pr.id, true);
    }
  }

  const statusRepasseTomador = !godparentTomadorId
    ? "nao_aplicavel"
    : pixByUser.get(godparentTomadorId)
      ? "pendente_repasse"
      : "contingenciado";

  const statusRepassePrestador = !godparentPrestadorId
    ? "nao_aplicavel"
    : pixByUser.get(godparentPrestadorId)
      ? "pendente_repasse"
      : "contingenciado";

  return {
    godparentTomadorId,
    godparentPrestadorId,
    statusRepasseTomador,
    statusRepassePrestador,
  };
}

async function reserveSplitRecord(input: {
  transactionId: string;
  idempotencyKey: string;
  serviceType: ServiceType;
  serviceId: string;
  providerId: string;
  tomadorId: string | null;
  split: SplitAmounts;
  route: RoutingDecision;
  environment: MpEnvironment;
  entityId: string | null;
  godparentTomadorId: string | null;
  godparentPrestadorId: string | null;
  statusRepasseGodparentTomador: "nao_aplicavel" | "pendente_repasse" | "contingenciado";
  statusRepasseGodparentPrestador: "nao_aplicavel" | "pendente_repasse" | "contingenciado";
  paymentMethod: "pix" | "card";
}): Promise<void> {
  const record = {
    transaction_id: input.transactionId,
    idempotency_key: input.idempotencyKey,
    status: "pending",
    service_type: input.serviceType,
    service_id: input.serviceId,
    provider_id: input.providerId,
    tomador_id: input.tomadorId,
    base_amount: input.split.base_amount,
    payment_method_fee_pct: input.split.fee_pct,
    payment_method_fee_amount: input.split.fee_amount,
    payment_method: input.paymentMethod,
    total_amount: input.split.total_amount,
    provider_amount: input.split.prestador_amount,
    ubt_amount: input.split.ubt_amount,
    entity_amount: input.split.comunidade_amount,
    entity_id: input.entityId,
    prize_worker_amount: input.split.premio_trabalhador,
    prize_consumer_amount: input.split.premio_consumidor,
    godparent_tomador_amount: input.split.padrinho_tomador_amount,
    godparent_tomador_id: input.godparentTomadorId,
    status_repasse_godparent_tomador: input.statusRepasseGodparentTomador,
    godparent_prestador_amount: input.split.padrinho_prestador_amount,
    godparent_prestador_id: input.godparentPrestadorId,
    status_repasse_godparent_prestador: input.statusRepasseGodparentPrestador,
    godparent_amount: input.split.padrinho_amount,
    godparent_id: input.godparentTomadorId ?? input.godparentPrestadorId,
    refunded_amount: 0,
    payment_route: input.route.mode,
    provider_payout_status: input.route.mode === "platform_fallback" ? "pending" : "not_required",
    provider_payout_amount: input.split.prestador_amount,
    application_fee_amount: input.route.mode === "seller_oauth_split" ? input.split.application_fee : 0,
    platform_collected_amount: input.route.mode === "platform_fallback"
      ? input.split.total_amount
      : input.split.application_fee,
    marketplace_account_id: input.route.marketplaceAccountId,
    environment: input.environment,
    routing_reason: input.route.fallbackReason,
  };

  const { error } = await adminClient().from("pagamentos_split").insert(record);
  if (!error) return;
  if (error.code !== "23505") {
    throw new HttpError(503, "split_reservation_failed", "Não foi possível reservar o lançamento contábil.");
  }

  const { data: existing, error: readError } = await adminClient()
    .from("pagamentos_split")
    .select("idempotency_key, service_id, provider_id, total_amount")
    .eq("transaction_id", input.transactionId)
    .single();
  if (
    readError || !existing || existing.idempotency_key !== input.idempotencyKey ||
    existing.service_id !== input.serviceId || existing.provider_id !== input.providerId ||
    Number(existing.total_amount) !== input.split.total_amount
  ) {
    throw new HttpError(409, "idempotency_conflict", "A chave idempotente já foi usada com outro pagamento.");
  }
}

async function finalizeSplitRecord(input: {
  transactionId: string;
  mpResult: MpResult;
  route: RoutingDecision;
}): Promise<boolean> {
  const mpStatus = String(input.mpResult.data?.status || "");
  const rejected = !input.mpResult.ok || mpStatus === "rejected";
  const payoutStatus = input.route.mode === "seller_oauth_split"
    ? "not_required"
    : rejected && !input.mpResult.outcomeUnknown
      ? "cancelled"
      : "pending";
  const lastError = rejected
    ? {
      error: input.mpResult.data?.error || "payment_rejected",
      message: input.mpResult.data?.message || null,
      cause: input.mpResult.data?.cause || null,
      http_status: input.mpResult.httpStatus,
      outcome_unknown: Boolean(input.mpResult.outcomeUnknown),
    }
    : null;

  const { error } = await adminClient()
    .from("pagamentos_split")
    .update({
      status: ledgerStatus(mpStatus, rejected && !input.mpResult.outcomeUnknown),
      gateway_payment_id: input.mpResult.data?.id ? String(input.mpResult.data.id) : null,
      gateway_status: mpStatus || (input.mpResult.outcomeUnknown ? "unknown" : "failed"),
      gateway_status_detail: input.mpResult.data?.status_detail || null,
      provider_payout_status: payoutStatus,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", input.transactionId);
  if (error) console.error("[payment-gateway] split finalization failed", error.message);
  return !error;
}

const collectorEmailCache = new Map<string, string>();

async function resolveCollectorEmail(authToken: string): Promise<string> {
  const cacheKey = authToken.slice(-16);
  const cached = collectorEmailCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${authToken}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.ok) {
      const me = await res.json().catch(() => ({}));
      const email = String(me?.email || "").trim().toLowerCase();
      if (email) {
        collectorEmailCache.set(cacheKey, email);
        return email;
      }
    }
  } catch {
    // non-blocking
  } finally {
    clearTimeout(timeout);
  }
  return "ubt.servicos@gmail.com";
}

function translateMercadoPagoError(data: Record<string, any>): string {
  const rawMessage = String(data?.message || data?.error || "")
    .replace(/rendernull\b/gi, "render")
    .replace(/null\s*$/i, "")
    .trim();
  const causeDescriptions = Array.isArray(data?.cause)
    ? data.cause.map((c: any) => String(c?.description || "")).join(" ")
    : "";
  const combined = `${rawMessage} ${causeDescriptions}`.toLowerCase();

  if (combined.includes("without key enabled for qr render")) {
    return "Chave PIX ainda não está ativada para QR Code na conta Mercado Pago recebedora. Ative a chave PIX (CNPJ 68.394.558/0001-32) no app Mercado Pago e tente novamente.";
  }
  if (combined.includes("payer and collector cannot be the same") || combined.includes("cannot pay to yourself")) {
    return "O pagador e o recebedor não podem usar a mesma conta Mercado Pago. Tente novamente com um e-mail diferente.";
  }
  if (combined.includes("invalid payer email") || combined.includes("payer.email")) {
    return "E-mail do pagador inválido para processamento no Mercado Pago.";
  }
  if (combined.includes("transaction_amount") || combined.includes("invalid amount")) {
    return "Valor da cobrança inválido para processamento no Mercado Pago.";
  }
  return rawMessage || "Pagamento rejeitado pelo Mercado Pago.";
}

function mpErrorDetails(data: Record<string, any>): Array<{ code?: string | number; description: string }> {
  if (Array.isArray(data?.cause)) {
    return data.cause.slice(0, 10).map((cause: any) => ({
      code: cause?.code,
      description: String(cause?.description || "Erro não detalhado")
        .replace(/rendernull\b/gi, "render")
        .replace(/null\s*$/i, "")
        .trim()
        .slice(0, 500),
    }));
  }
  return [{ code: data?.error, description: translateMercadoPagoError(data).slice(0, 500) }];
}

function allowedRedirectUri(requested: unknown): string {
  const allowed = (Deno.env.get("MP_REDIRECT_URIS") || Deno.env.get("MP_REDIRECT_URI") || "")
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
  const candidate = String(requested || allowed[0] || "").trim();
  if (!candidate || !allowed.includes(candidate)) {
    throw new HttpError(400, "invalid_redirect_uri", "redirect_uri não está na allowlist MP_REDIRECT_URIS.");
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new HttpError(400, "invalid_redirect_uri", "redirect_uri inválida.");
  }
  if (paymentEnvironment() === "production" && parsed.protocol !== "https:") {
    throw new HttpError(400, "insecure_redirect_uri", "OAuth em produção exige redirect_uri HTTPS.");
  }
  return candidate;
}

async function resolveCanonicalUsuarioId(authUid: string): Promise<string> {
  try {
    const { data: direct } = await adminClient()
      .from("usuarios")
      .select("id")
      .eq("id", authUid)
      .maybeSingle();
    if (direct?.id) return direct.id;

    const { data: authUser } = await adminClient().auth.admin.getUserById(authUid);
    const email = String(authUser?.user?.email || "").trim().toLowerCase();
    if (email) {
      const { data: byEmail } = await adminClient()
        .from("usuarios")
        .select("id")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) return byEmail.id;
    }
  } catch (err) {
    console.warn("[payment-gateway] resolveCanonicalUsuarioId fallback:", err);
  }
  return authUid;
}

async function handleGetOAuthUrl(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const clientId = (Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("MP_CLIENT_ID") || "").trim();
  if (!clientId) throw new HttpError(500, "missing_client_id", "Client ID do Mercado Pago não configurado.");

  const redirectUri = allowedRedirectUri(body.redirect_uri);
  const canonicalUserId = await resolveCanonicalUsuarioId(userId);
  const state = crypto.randomUUID();
  const { error } = await adminClient().from("marketplace_oauth_connections").insert({
    user_id: canonicalUserId,
    state_reference: state,
    authorization_status: "started",
  });
  if (error) throw new HttpError(503, "oauth_state_persist_failed", "Não foi possível iniciar o vínculo OAuth.");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri,
  });
  return json(req, {
    success: true,
    oauth_url: `https://auth.mercadopago.com.br/authorization?${params.toString()}`,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    environment: paymentEnvironment(),
  });
}

async function handleExchangeOAuthCode(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const clientId = (Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("MP_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("MERCADOPAGO_CLIENT_SECRET") || Deno.env.get("MP_CLIENT_SECRET") || "").trim();
  const code = String(body.code || "").trim();
  const state = String(body.state || "").trim();
  const redirectUri = allowedRedirectUri(body.redirect_uri);
  if (!clientId || !clientSecret) throw new HttpError(500, "missing_oauth_credentials", "Credenciais OAuth não configuradas.");
  if (!code || code.length > 500) throw new HttpError(400, "invalid_oauth_code", "Authorization code inválido.");
  if (!UUID_RE.test(state)) throw new HttpError(400, "invalid_oauth_state", "OAuth state inválido.");

  const canonicalUserId = await resolveCanonicalUsuarioId(userId);
  const { data: connection, error: stateError } = await adminClient()
    .from("marketplace_oauth_connections")
    .select("id, created_at")
    .in("user_id", Array.from(new Set([canonicalUserId, userId])))
    .eq("state_reference", state)
    .eq("authorization_status", "started")
    .maybeSingle();
  if (stateError || !connection || Date.now() - new Date(connection.created_at).getTime() > 60 * 60 * 1000) {
    throw new HttpError(400, "oauth_state_mismatch", "OAuth state ausente, expirado ou já utilizado. Clique em Conectar Mercado Pago novamente.");
  }

  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      ...(environment === "sandbox" ? { test_token: true } : {}),
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData?.access_token) {
    await adminClient().from("marketplace_oauth_connections").update({
      authorization_status: "failed",
      error_code: String(tokenData?.error || tokenResponse.status),
      error_message: String(tokenData?.message || tokenData?.error_description || "OAuth rejected").slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);
    const rawOAuthErr = String(tokenData?.message || tokenData?.error_description || "").toLowerCase();
    const friendlyMsg = rawOAuthErr.includes("redirect_uri")
      ? "A URL de redirecionamento não corresponde à configurada no painel Mercado Pago Developers."
      : rawOAuthErr.includes("invalid_grant") || rawOAuthErr.includes("code")
        ? "O código de autorização expirou ou já foi utilizado. Clique em Conectar Mercado Pago novamente."
        : "Mercado Pago recusou a vinculação da conta. Tente novamente com sua conta pessoal/comercial do Mercado Pago.";
    throw new HttpError(400, "oauth_token_exchange_failed", friendlyMsg, {
      status: tokenResponse.status,
      error: tokenData?.error,
      message: tokenData?.message || tokenData?.error_description,
    });
  }

  if (typeof tokenData.live_mode === "boolean" && tokenData.live_mode !== (environment === "production")) {
    throw new HttpError(409, "oauth_environment_mismatch", "O token OAuth retornado pertence a outro ambiente.");
  }

  const oauthUserId = String(tokenData.user_id || "").trim();
  const allowedSandboxSellers = (Deno.env.get("MP_TEST_SELLER_USER_IDS") || "")
    .split(",")
    .map((sellerId) => sellerId.trim())
    .filter(Boolean);
  if (environment === "sandbox" && allowedSandboxSellers.length > 0 && !allowedSandboxSellers.includes(oauthUserId)) {
    await adminClient().from("marketplace_oauth_connections").update({
      authorization_status: "failed",
      error_code: "oauth_test_seller_mismatch",
      error_message: "OAuth autorizado com uma conta diferente do Seller Test User configurado.",
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);
    throw new HttpError(
      409,
      "oauth_test_seller_mismatch",
      "Entre no Mercado Pago com o Seller Test User configurado antes de autorizar.",
    );
  }

  const now = new Date();
  const expiresIn = Number(tokenData.expires_in);
  const tokenMetadata = {
    live_mode: tokenData.live_mode,
    scope: tokenData.scope,
    token_type: tokenData.token_type,
    public_key: tokenData.public_key,
  };
  const { data: account, error: upsertError } = await adminClient().from("marketplace_accounts").upsert({
    user_id: canonicalUserId,
    mercado_pago_user_id: oauthUserId,
    status: "CONNECTED",
    ambiente: environment,
    oauth_status: "authorized",
    access_token_encrypted: await encryptToken(tokenData.access_token, environment),
    refresh_token_encrypted: tokenData.refresh_token
      ? await encryptToken(tokenData.refresh_token, environment)
      : null,
    token_expiration: Number.isFinite(expiresIn)
      ? new Date(now.getTime() + expiresIn * 1000).toISOString()
      : null,
    token_metadata: tokenMetadata,
    connected_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "user_id,ambiente" }).select("id").single();
  if (upsertError || !account) throw new HttpError(503, "oauth_account_persist_failed", "Não foi possível salvar a conta OAuth.");

  await adminClient().from("marketplace_oauth_connections").update({
    authorization_status: "exchanged",
    marketplace_account_id: account.id,
    connected_at: now.toISOString(),
    expires_at: Number.isFinite(expiresIn)
      ? new Date(now.getTime() + expiresIn * 1000).toISOString()
      : null,
    updated_at: now.toISOString(),
  }).eq("id", connection.id);

  return json(req, {
    success: true,
    user_id: tokenData.user_id,
    public_key: tokenData.public_key,
    live_mode: tokenData.live_mode,
    environment,
  });
}

interface SanitizedSavedCard {
  id: string;
  last_four_digits: string;
  first_six_digits: string;
  expiration_month: number | null;
  expiration_year: number | null;
  payment_method: {
    id: string;
    name: string;
    thumbnail: string | null;
  };
  cardholder: {
    name: string;
  };
}

function sanitizeSavedCard(card: Record<string, any>): SanitizedSavedCard | null {
  const id = String(card?.id || "").trim();
  if (!id) return null;
  return {
    id,
    last_four_digits: String(card?.last_four_digits || "").slice(-4),
    first_six_digits: String(card?.first_six_digits || "").slice(0, 6),
    expiration_month: Number.isFinite(Number(card?.expiration_month)) ? Number(card.expiration_month) : null,
    expiration_year: Number.isFinite(Number(card?.expiration_year)) ? Number(card.expiration_year) : null,
    payment_method: {
      id: String(card?.payment_method?.id || "credit_card"),
      name: String(card?.payment_method?.name || "Cartão"),
      thumbnail: card?.payment_method?.secure_thumbnail || card?.payment_method?.thumbnail || null,
    },
    cardholder: {
      name: String(card?.cardholder?.name || "Titular"),
    },
  };
}

async function resolveAuthenticatedPayerSource(
  userId: string,
  body: Record<string, any>,
): Promise<Record<string, any>> {
  const [{ data: authData }, { data: userRow }] = await Promise.all([
    adminClient().auth.admin.getUserById(userId),
    adminClient().from("usuarios").select("nome").eq("id", userId).maybeSingle(),
  ]);
  const fullName = String(userRow?.nome || authData?.user?.user_metadata?.full_name || "").trim();
  const [firstName = "", ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const cpf = String(authData?.user?.user_metadata?.cpf || "").replace(/\D/g, "");
  return {
    ...body,
    payer_email: body.payer_email || body.payer?.email || authData?.user?.email || "",
    payer_first_name: body.payer_first_name || body.payer?.first_name || firstName || undefined,
    payer_last_name: body.payer_last_name || body.payer?.last_name || lastParts.join(" ") || undefined,
    payer_identification: body.payer_identification || body.payer?.identification ||
      (cpf ? { type: "CPF", number: cpf } : undefined),
  };
}

async function getOrCreateMpCustomer(input: {
  userId: string;
  environment: MpEnvironment;
  route: RoutingDecision;
  payerEmail: string;
  payer: Record<string, unknown>;
  createIfMissing: boolean;
}): Promise<string | null> {
  const { data: existingWallet } = await adminClient()
    .from("mp_customer_wallets")
    .select("mp_customer_id, mp_customer_email")
    .eq("user_id", input.userId)
    .eq("environment", input.environment)
    .eq("collector_scope", input.route.collectorScope)
    .maybeSingle();

  if (existingWallet?.mp_customer_id) {
    return String(existingWallet.mp_customer_id);
  }

  // Search Mercado Pago customer by email under the resolved collector token
  const searchUrl = `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(input.payerEmail)}`;
  const searchResp = await fetch(searchUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${input.route.authToken}`,
      "Accept": "application/json",
    },
  });
  if (searchResp.ok) {
    const searchData = await searchResp.json().catch(() => ({}));
    const firstMatch = Array.isArray(searchData?.results) ? searchData.results[0] : null;
    if (firstMatch?.id) {
      const mpCustomerId = String(firstMatch.id);
      await adminClient().from("mp_customer_wallets").upsert({
        user_id: input.userId,
        environment: input.environment,
        collector_scope: input.route.collectorScope,
        mp_customer_id: mpCustomerId,
        mp_customer_email: input.payerEmail,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,environment,collector_scope" });
      return mpCustomerId;
    }
  }

  if (!input.createIfMissing) return null;

  const createPayload: Record<string, unknown> = {
    email: input.payerEmail,
    ...(input.payer.first_name ? { first_name: input.payer.first_name } : {}),
    ...(input.payer.last_name ? { last_name: input.payer.last_name } : {}),
    ...(input.payer.identification ? { identification: input.payer.identification } : {}),
  };

  const createResp = await fetch("https://api.mercadopago.com/v1/customers", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.route.authToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(createPayload),
  });
  const createData = await createResp.json().catch(() => ({}));
  if (!createResp.ok || !createData?.id) {
    throw new HttpError(
      422,
      "wallet_customer_create_failed",
      String(createData?.message || "Não foi possível inicializar a carteira no Mercado Pago."),
      mpErrorDetails(createData),
    );
  }

  const mpCustomerId = String(createData.id);
  await adminClient().from("mp_customer_wallets").upsert({
    user_id: input.userId,
    environment: input.environment,
    collector_scope: input.route.collectorScope,
    mp_customer_id: mpCustomerId,
    mp_customer_email: input.payerEmail,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,environment,collector_scope" });

  return mpCustomerId;
}

async function saveCardToMpCustomer(input: {
  authToken: string;
  mpCustomerId: string;
  cardToken: string;
}): Promise<SanitizedSavedCard> {
  const resp = await fetch(`https://api.mercadopago.com/v1/customers/${encodeURIComponent(input.mpCustomerId)}/cards`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.authToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ token: input.cardToken }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.id) {
    throw new HttpError(
      422,
      "wallet_card_save_failed",
      String(data?.message || "Não foi possível salvar o cartão na carteira Mercado Pago."),
      mpErrorDetails(data),
    );
  }
  const sanitized = sanitizeSavedCard(data);
  if (!sanitized) {
    throw new HttpError(502, "wallet_card_invalid_response", "Resposta inválida ao salvar cartão.");
  }
  return sanitized;
}

async function handleListSavedCards(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const route = await resolvePaymentRoute(providerId, environment);
  const payerSource = await resolveAuthenticatedPayerSource(userId, body);
  const payerEmail = resolvePayerEmail(payerSource, environment);
  const payer = sanitizePayer(payerSource, payerEmail);

  const mpCustomerId = await getOrCreateMpCustomer({
    userId,
    environment,
    route,
    payerEmail,
    payer,
    createIfMissing: false,
  });

  if (!mpCustomerId) {
    return json(req, {
      success: true,
      customer_id: null,
      payment_route: route.mode,
      cards: [],
    });
  }

  const cardsResp = await fetch(
    `https://api.mercadopago.com/v1/customers/${encodeURIComponent(mpCustomerId)}/cards`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${route.authToken}`,
        "Accept": "application/json",
      },
    },
  );
  if (!cardsResp.ok) {
    return json(req, {
      success: true,
      customer_id: mpCustomerId,
      payment_route: route.mode,
      cards: [],
    });
  }
  const rawCards = await cardsResp.json().catch(() => []);
  const cards = Array.isArray(rawCards)
    ? rawCards.map((item) => sanitizeSavedCard(item)).filter((item): item is SanitizedSavedCard => Boolean(item))
    : [];

  return json(req, {
    success: true,
    customer_id: mpCustomerId,
    payment_route: route.mode,
    cards,
  });
}

async function handleSaveCard(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const cardToken = String(body.card_token || body.token || "").trim();
  if (!cardToken) {
    throw new HttpError(400, "missing_card_token", "card_token é obrigatório para salvar um cartão.");
  }

  const route = await resolvePaymentRoute(providerId, environment);
  const payerSource = await resolveAuthenticatedPayerSource(userId, body);
  const payerEmail = resolvePayerEmail(payerSource, environment);
  const payer = sanitizePayer(payerSource, payerEmail);

  const mpCustomerId = await getOrCreateMpCustomer({
    userId,
    environment,
    route,
    payerEmail,
    payer,
    createIfMissing: true,
  });
  if (!mpCustomerId) {
    throw new HttpError(500, "wallet_customer_unavailable", "Não foi possível resolver o cliente da carteira.");
  }

  const savedCard = await saveCardToMpCustomer({
    authToken: route.authToken,
    mpCustomerId,
    cardToken,
  });

  return json(req, {
    success: true,
    customer_id: mpCustomerId,
    card: savedCard,
  });
}

async function handleDeleteSavedCard(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const cardId = String(body.card_id || "").trim();
  if (!cardId) {
    throw new HttpError(400, "missing_card_id", "card_id é obrigatório.");
  }
  const route = await resolvePaymentRoute(providerId, environment);
  const { data: wallet } = await adminClient()
    .from("mp_customer_wallets")
    .select("mp_customer_id")
    .eq("user_id", userId)
    .eq("environment", environment)
    .eq("collector_scope", route.collectorScope)
    .maybeSingle();

  if (!wallet?.mp_customer_id) {
    throw new HttpError(404, "wallet_not_found", "Carteira do usuário não encontrada.");
  }

  const resp = await fetch(
    `https://api.mercadopago.com/v1/customers/${encodeURIComponent(wallet.mp_customer_id)}/cards/${encodeURIComponent(cardId)}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${route.authToken}`,
        "Accept": "application/json",
      },
    },
  );
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new HttpError(422, "wallet_card_delete_failed", String(errData?.message || "Erro ao remover cartão."));
  }

  return json(req, { success: true, deleted_card_id: cardId });
}

async function handlePayment(req: Request, body: Record<string, any>, customerId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const action = String(body.action || "create_payment_intent").trim().toLowerCase();
  const providerInitiatedMototaxiPix = action === "create_mototaxi_pix_charge";
  const requestedAmount = validateAmount(body.transaction_amount ?? body.amount);
  const serviceType = normalizeServiceType(body.service_type ?? body.serviceType);
  const serviceId = assertUuid(body.service_id ?? body.serviceId, "service_id");
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const paymentAttempt = resolvePaymentAttemptId(body);
  const paymentAttemptId = paymentAttempt.id;
  const entityId = optionalUuid(body.entity_id ?? body.entityId, "entity_id");
  const godparentTomadorId = optionalUuid(body.godparent_tomador_id ?? body.godparentTomadorId ?? body.godparent_id, "godparent_tomador_id");
  const godparentPrestadorId = optionalUuid(body.godparent_prestador_id ?? body.godparentPrestadorId, "godparent_prestador_id");
  const description = String(body.description || `Serviço UBT ${serviceType}`).trim().slice(0, 250);
  const paymentMethodId = String(body.payment_method_id || (body.card_token ? "master" : "pix")).trim().toLowerCase();
  const normalizedMethodCategory: "pix" | "card" = paymentMethodId === "pix" ? "pix" : "card";
  const cardToken = String(body.card_token || body.token || "").trim() || undefined;
  const savedCardId = String(body.saved_card_id || "").trim() || undefined;
  const shouldSaveCard = Boolean(body.save_card) && normalizedMethodCategory === "card" && !savedCardId;
  const saveCardToken = String(body.save_card_token || "").trim() || undefined;
  const installments = Math.min(24, Math.max(1, Number.parseInt(String(body.installments || 1), 10) || 1));
  if (paymentMethodId !== "pix" && !cardToken) {
    throw new HttpError(400, "missing_card_token", "Pagamento com cartão exige tokenização prévia.");
  }

  const feeSettings = await fetchGatewayFeeSettings();
  const appliedFeePct = normalizedMethodCategory === "pix"
    ? feeSettings.taxaPixPct
    : feeSettings.taxaCardPct;

  let baseAmount = requestedAmount;
  let feeAmount = 0;
  let amount = requestedAmount;
  let payerSource = body;
  let effectiveTomadorId: string | null = providerInitiatedMototaxiPix ? null : customerId;

  if (serviceType === "mototaxi") {
    const { data: ride, error: rideError } = await adminClient()
      .from("mototaxi_corridas")
      .select("id, tomador_id, prestador_id, status, estimated_price, final_price, pix_payment_id, pix_transaction_id, pix_copy_paste, pix_qr_code_base64, pix_charge_status, pix_charge_expires_at")
      .eq("id", serviceId)
      .maybeSingle();
    if (rideError) {
      throw new HttpError(503, "ride_lookup_failed", "Não foi possível validar a corrida antes da cobrança.");
    }
    if (!ride) throw new HttpError(404, "ride_not_found", "Corrida não encontrada.");

    if (providerInitiatedMototaxiPix) {
      if (serviceType !== "mototaxi" || paymentMethodId !== "pix") {
        throw new HttpError(400, "invalid_provider_pix_charge", "A cobrança presencial aceita apenas Pix de Mototáxi.");
      }
      if (ride.prestador_id !== customerId || providerId !== customerId) {
        throw new HttpError(403, "provider_not_assigned", "Somente o prestador atribuído pode gerar esta cobrança Pix.");
      }
    } else if (ride.tomador_id && ride.tomador_id !== customerId) {
      throw new HttpError(403, "passenger_not_assigned", "Somente o passageiro da corrida pode pagar esta corrida.");
    }

    // Idempotency Guard 1: already paid -> return immediately without creating a duplicate charge
    const { data: existingApproved } = await adminClient()
      .from("pagamentos_split")
      .select("id, transaction_id, gateway_payment_id, total_amount, base_amount, provider_amount")
      .eq("service_type", "mototaxi")
      .eq("service_id", serviceId)
      .in("status", ["approved", "paid", "confirmed"])
      .maybeSingle();

    if (ride.status === "paid" || existingApproved) {
      return json(req, {
        success: true,
        already_paid: true,
        status: "approved",
        payment_id: existingApproved?.gateway_payment_id || ride.pix_payment_id || null,
        transaction_id: existingApproved?.transaction_id || ride.pix_transaction_id || null,
        payment: {
          id: existingApproved?.gateway_payment_id || ride.pix_payment_id || null,
          status: "approved",
          payment_method_id: "pix",
          transaction_amount: Number(existingApproved?.total_amount ?? ride.final_price ?? ride.estimated_price ?? 0),
        },
      }, 200);
    }

    if (ride.status !== "completed") {
      throw new HttpError(409, "ride_not_ready_for_payment", "A corrida precisa estar concluída antes do pagamento.");
    }
    if (!ride.tomador_id) {
      throw new HttpError(409, "ride_payer_missing", "A corrida não possui um Tomador vinculado.");
    }

    // Idempotency Guard 2: reuse active non-expired pending PIX charge for this ride
    if (providerInitiatedMototaxiPix && ride.pix_payment_id && ride.pix_copy_paste) {
      const chargeSt = String(ride.pix_charge_status || "pending").toLowerCase();
      const notExpired = !ride.pix_charge_expires_at ||
        new Date(ride.pix_charge_expires_at).getTime() > Date.now() + 30_000;
      if (["pending", "in_process"].includes(chargeSt) && notExpired) {
        return json(req, {
          success: true,
          idempotent_reuse: true,
          payment_id: ride.pix_payment_id,
          status: chargeSt,
          transaction_id: ride.pix_transaction_id,
          payment: {
            id: ride.pix_payment_id,
            status: chargeSt,
            payment_method_id: "pix",
            transaction_amount: roundMoney(
              validateAmount(ride.final_price ?? ride.estimated_price) * (1 + appliedFeePct / 100),
            ),
          },
          pix: {
            payment_id: ride.pix_payment_id,
            status: chargeSt,
            external_reference: ride.pix_transaction_id,
            qr_code: ride.pix_copy_paste,
            qr_code_base64: ride.pix_qr_code_base64 ?? null,
            date_of_expiration: ride.pix_charge_expires_at ?? null,
          },
        }, 200);
      }
    }

    const canonicalAmount = validateAmount(ride.final_price ?? ride.estimated_price);
    const canonicalFeeAmount = roundMoney(canonicalAmount * (appliedFeePct / 100));
    const canonicalTotalAmount = roundMoney(canonicalAmount + canonicalFeeAmount);

    const matchesTotal = Math.abs(canonicalTotalAmount - requestedAmount) <= 0.05;
    const matchesBase = Math.abs(canonicalAmount - requestedAmount) <= 0.02;
    if (!matchesTotal && !matchesBase) {
      throw new HttpError(409, "ride_amount_mismatch", "O valor da cobrança diverge do valor registrado na corrida.");
    }

    baseAmount = canonicalAmount;
    feeAmount = canonicalFeeAmount;
    amount = canonicalTotalAmount;
    effectiveTomadorId = ride.tomador_id;

    if (providerInitiatedMototaxiPix) {
      const [{ data: payerAuth }, { data: payerProfile }] = await Promise.all([
        adminClient().auth.admin.getUserById(ride.tomador_id),
        adminClient().from("usuarios").select("nome, email, cpf").eq("id", ride.tomador_id).maybeSingle(),
      ]);

      const resolvedEmail = String(
        payerAuth?.user?.email ||
        payerProfile?.email ||
        body.payer_email ||
        `tomador+${ride.tomador_id.slice(0, 8)}@ubtservicos.com.br`
      ).trim().toLowerCase();

      const payerName = String(payerProfile?.nome || payerAuth?.user?.user_metadata?.full_name || "Passageiro UBT").trim();
      const [payerFirstName = "Passageiro", ...payerLastParts] = payerName.split(/\s+/).filter(Boolean);
      const payerCpf = String(payerProfile?.cpf || payerAuth?.user?.user_metadata?.cpf || "").replace(/\D/g, "");
      payerSource = {
        ...body,
        payer_email: resolvedEmail,
        payer_first_name: payerFirstName || "Passageiro",
        payer_last_name: payerLastParts.join(" ") || "UBT",
        payer_identification: payerCpf.length === 11 ? { type: "CPF", number: payerCpf } : undefined,
      };
    }
  } else {
    baseAmount = requestedAmount;
    feeAmount = 0;
    amount = requestedAmount;
  }

  const clientMetadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const metadataJson = JSON.stringify(clientMetadata);
  if (metadataJson.length > 4000) throw new HttpError(400, "metadata_too_large", "metadata excede 4 KB.");
  const route = await resolvePaymentRoute(providerId, environment);
  let payerEmail = resolvePayerEmail(payerSource, environment);
  if (environment === "production") {
    const collectorEmail = await resolveCollectorEmail(route.authToken);
    if (collectorEmail && payerEmail.toLowerCase() === collectorEmail.toLowerCase()) {
      const safeTag = (effectiveTomadorId || customerId || "ubt").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "ubt";
      payerEmail = `tomador+${safeTag}@ubtservicos.com.br`;
    }
  }
  const payer = sanitizePayer(payerSource, payerEmail);

  let effectivePayer: Record<string, unknown> = payer;
  let resolvedMpCustomerId: string | null = null;
  if (savedCardId) {
    resolvedMpCustomerId = await getOrCreateMpCustomer({
      userId: customerId,
      environment,
      route,
      payerEmail,
      payer,
      createIfMissing: false,
    });
    if (!resolvedMpCustomerId) {
      throw new HttpError(404, "wallet_customer_not_found", "Carteira do pagador não encontrada para o cartão selecionado.");
    }
    effectivePayer = {
      ...payer,
      type: "customer",
      id: resolvedMpCustomerId,
    };
  }

  const { config, source: splitConfigSource } = await fetchSplitConfig();
  const split = calculateSplitAmounts(baseAmount, config, appliedFeePct, feeAmount);
  const transactionId = paymentAttemptId;
  const idempotencyKey = paymentAttemptId;

  const godparentCtx = await resolveGodparentSplitContext(
    effectiveTomadorId,
    providerId,
    godparentTomadorId,
    godparentPrestadorId,
  );

  await reserveSplitRecord({
    transactionId,
    idempotencyKey,
    serviceType,
    serviceId,
    providerId,
    tomadorId: effectiveTomadorId,
    split,
    route,
    environment,
    entityId,
    godparentTomadorId: godparentCtx.godparentTomadorId,
    godparentPrestadorId: godparentCtx.godparentPrestadorId,
    statusRepasseGodparentTomador: godparentCtx.statusRepasseTomador,
    statusRepasseGodparentPrestador: godparentCtx.statusRepassePrestador,
    paymentMethod: normalizedMethodCategory,
  });

  await logAuditEvent("payment_routed", "pending", {
    transaction_id: transactionId,
    service_type: serviceType,
    service_id: serviceId,
    provider_id: providerId,
    customer_id: customerId,
    payment_attempt_source: paymentAttempt.source,
    payment_method: normalizedMethodCategory,
    route: route.mode,
    fallback_reason: route.fallbackReason,
    environment,
    split_config_source: splitConfigSource,
    fee_settings_source: feeSettings.source,
    split_amounts: split,
  });

  const mpResult = await createMercadoPagoPayment({
    authToken: route.authToken,
    idempotencyKey,
    transactionAmount: amount,
    description,
    paymentMethodId,
    payer: effectivePayer,
    cardToken,
    installments,
    externalReference: transactionId,
    metadata: {
      ...clientMetadata,
      ubt_service_type: serviceType,
      ubt_service_id: serviceId,
      ubt_provider_id: providerId,
      ubt_payment_route: route.mode,
      ubt_base_amount: baseAmount,
      ubt_fee_pct: appliedFeePct,
      ubt_fee_amount: feeAmount,
    },
    ...(route.mode === "seller_oauth_split" ? { applicationFee: split.application_fee } : {}),
  });

  const ledgerPersisted = await finalizeSplitRecord({ transactionId, mpResult, route });
  const mpStatus = String(mpResult.data?.status || "");
  const rejected = !mpResult.ok || mpStatus === "rejected" || !mpResult.data?.id;

  await logAuditEvent("mercado_pago_payment", rejected ? "failed" : mpStatus || "unknown", {
    transaction_id: transactionId,
    payment_id: mpResult.data?.id || null,
    gateway_status: mpStatus || null,
    gateway_status_detail: mpResult.data?.status_detail || null,
    http_status: mpResult.httpStatus,
    route: route.mode,
    outcome_unknown: Boolean(mpResult.outcomeUnknown),
    ledger_persisted: ledgerPersisted,
  }, rejected ? JSON.stringify(mpErrorDetails(mpResult.data)) : undefined);

  if (rejected) {
    // If Mercado Pago returned a definitive 4xx/5xx error without creating a payment ID,
    // remove the uncommitted pre-reservation so failed attempts never pollute pagamentos_split
    // (full error trace remains permanently in financial_audit_logs).
    if (!mpResult.outcomeUnknown && !mpResult.data?.id) {
      await adminClient()
        .from("pagamentos_split")
        .delete()
        .eq("transaction_id", transactionId)
        .is("gateway_payment_id", null);
    }

    const status = mpResult.outcomeUnknown
      ? mpResult.httpStatus
      : mpResult.httpStatus >= 500
        ? 502
        : 422;
    return json(req, {
      success: false,
      error: mpResult.outcomeUnknown ? "payment_outcome_unknown" : "payment_rejected",
      status: mpStatus || "rejected",
      status_detail: mpResult.data?.status_detail || null,
      message: mpResult.outcomeUnknown
        ? "Não foi possível confirmar o resultado. Consulte pela mesma payment_attempt_id antes de tentar novamente."
        : translateMercadoPagoError(mpResult.data),
      details: mpErrorDetails(mpResult.data),
      gateway_status: mpResult.httpStatus,
      transaction_id: transactionId,
      payment_route: route.mode,
    }, status);
  }

  // Non-blocking save of new card to Mercado Pago Customer Wallet after approval
  let savedCardResult: SanitizedSavedCard | null = null;
  if (shouldSaveCard && saveCardToken && mpStatus === "approved") {
    try {
      const mpCustId = resolvedMpCustomerId || await getOrCreateMpCustomer({
        userId: customerId,
        environment,
        route,
        payerEmail,
        payer,
        createIfMissing: true,
      });
      if (mpCustId) {
        savedCardResult = await saveCardToMpCustomer({
          authToken: route.authToken,
          mpCustomerId: mpCustId,
          cardToken: saveCardToken,
        });
      }
    } catch (walletErr) {
      console.warn("[payment-gateway] non-blocking wallet card save failed:", walletErr);
    }
  }

  if (serviceType === "mototaxi" && mpStatus === "approved") {
    const { error } = await adminClient().from("mototaxi_corridas").update({
      status: "paid",
      final_price: baseAmount,
      payment_method: normalizedMethodCategory,
      updated_at: new Date().toISOString(),
    }).eq("id", serviceId);
    if (error) console.error("[payment-gateway] ride status update failed", error.message);
  }

  if (serviceType === "diarista" && mpStatus === "approved") {
    const { error } = await adminClient().from("services_requests").update({
      status: "paid",
      payment_id: String(mpResult.data.id),
      updated_at: new Date().toISOString(),
    }).eq("id", serviceId);
    if (error) console.error("[payment-gateway] service request status update failed", error.message);
  }

  const txData = mpResult.data?.point_of_interaction?.transaction_data;
  if (providerInitiatedMototaxiPix) {
    const pixCopyPaste = String(txData?.qr_code || "").trim();
    const pixQrCodeBase64 = String(txData?.qr_code_base64 || "").trim();
    if (!pixCopyPaste) {
      throw new HttpError(502, "pix_payload_missing", "O Mercado Pago não devolveu o código Pix da cobrança.");
    }
    const { error: chargePersistError } = await adminClient()
      .from("mototaxi_corridas")
      .update({
        payment_method: "pix",
        pix_payment_id: String(mpResult.data.id),
        pix_transaction_id: transactionId,
        pix_copy_paste: pixCopyPaste,
        pix_qr_code_base64: pixQrCodeBase64 || null,
        pix_charge_status: mpStatus || "pending",
        pix_charge_created_at: new Date().toISOString(),
        pix_charge_expires_at: mpResult.data?.date_of_expiration || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", serviceId);
    if (chargePersistError) {
      const databaseDetails = {
        code: chargePersistError.code,
        message: chargePersistError.message,
        details: chargePersistError.details,
        hint: chargePersistError.hint,
      };
      console.error("[payment-gateway] Pix charge persistence failed", databaseDetails);
      await logAuditEvent("pix_charge_persist_failed", "failed", {
        transaction_id: transactionId,
        service_id: serviceId,
        payment_id: String(mpResult.data.id),
        database_code: chargePersistError.code,
      }, JSON.stringify(databaseDetails));
      throw new HttpError(
        500,
        "pix_charge_persist_failed",
        "A cobrança foi criada no Mercado Pago, mas o banco recusou a sincronização da corrida.",
        environment === "sandbox" ? databaseDetails : { code: chargePersistError.code },
      );
    }
  }
  const appliedApplicationFee = route.mode === "seller_oauth_split" ? split.application_fee : 0;
  return json(req, {
    success: true,
    payment_id: mpResult.data.id,
    status: mpStatus,
    status_detail: mpResult.data.status_detail || null,
    transaction_id: transactionId,
    payment_route: route.mode,
    fallback_reason: route.fallbackReason,
    provider_payout_status: route.mode === "platform_fallback" ? "pending" : "not_required",
    ledger_persisted: ledgerPersisted,
    saved_card: savedCardResult,
    fee_breakdown: {
      base_amount: baseAmount,
      fee_pct: appliedFeePct,
      fee_amount: feeAmount,
      total_amount: amount,
      payment_method: normalizedMethodCategory,
    },
    payment: {
      id: mpResult.data.id,
      status: mpStatus,
      status_detail: mpResult.data.status_detail,
      payment_method_id: mpResult.data.payment_method_id || paymentMethodId,
      transaction_amount: mpResult.data.transaction_amount || amount,
    },
    pix: paymentMethodId === "pix" ? {
      payment_id: mpResult.data.id,
      status: mpStatus,
      status_detail: mpResult.data.status_detail,
      external_reference: transactionId,
      ticket_url: txData?.ticket_url ?? null,
      qr_code: txData?.qr_code ?? null,
      qr_code_base64: txData?.qr_code_base64 ?? null,
      date_of_expiration: mpResult.data?.date_of_expiration ?? null,
    } : null,
    split: {
      ...split,
      application_fee: appliedApplicationFee,
      accounting_platform_allocation: split.application_fee,
      config_source: splitConfigSource,
    },
  }, 200);
}

async function handleCheckMototaxiPixStatus(
  req: Request,
  body: Record<string, any>,
  userId: string,
): Promise<Response> {
  const environment = paymentEnvironment();
  const serviceId = assertUuid(body.service_id ?? body.serviceId ?? body.ride_id, "service_id");

  const { data: ride, error: rideErr } = await adminClient()
    .from("mototaxi_corridas")
    .select("id, tomador_id, prestador_id, status, final_price, estimated_price, pix_payment_id, pix_transaction_id, pix_charge_status")
    .eq("id", serviceId)
    .maybeSingle();

  if (rideErr) throw new HttpError(503, "ride_lookup_failed", "Erro ao consultar corrida.");
  if (!ride) throw new HttpError(404, "ride_not_found", "Corrida não encontrada.");

  // Check caller authorization (tomador, prestador, or legacy email match)
  let authorized = ride.tomador_id === userId || ride.prestador_id === userId;
  if (!authorized) {
    const { data: callerAuth } = await adminClient().auth.admin.getUserById(userId);
    const callerEmail = String(callerAuth?.user?.email || "").trim().toLowerCase();
    if (callerEmail) {
      const { data: callerUsuarios } = await adminClient()
        .from("usuarios")
        .select("id, role")
        .ilike("email", callerEmail);
      const ids = (callerUsuarios || []).map((u: any) => u.id);
      const isAdminRole = (callerUsuarios || []).some((u: any) =>
        ["admin", "superadmin", "super_admin"].includes(String(u.role || "").toLowerCase())
      );
      authorized = isAdminRole || ids.includes(ride.tomador_id) || ids.includes(ride.prestador_id);
    }
  }
  if (!authorized) {
    throw new HttpError(403, "forbidden", "Você não tem permissão para consultar o pagamento desta corrida.");
  }

  if (ride.status === "paid") {
    return json(req, { success: true, status: "approved", paid: true, ride_status: "paid" }, 200);
  }

  const paymentId = String(ride.pix_payment_id || body.payment_id || "").trim();
  if (!paymentId) {
    return json(req, { success: true, status: ride.pix_charge_status || "pending", paid: false, ride_status: ride.status }, 200);
  }

  const route = await resolvePaymentRoute(ride.prestador_id || userId, environment);
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${route.authToken}`,
      Accept: "application/json",
    },
  });
  const mpData = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok) {
    throw new HttpError(502, "mp_status_lookup_failed", translateMercadoPagoError(mpData));
  }

  const mpStatus = String(mpData?.status || "pending").toLowerCase();
  const mpDetail = String(mpData?.status_detail || "");

  if (mpStatus === "approved") {
    const nowIso = mpData?.date_approved || new Date().toISOString();
    const txId = String(ride.pix_transaction_id || mpData?.external_reference || "");

    // Strictly promote ONLY the row matching this exact Mercado Pago payment ID
    await adminClient()
      .from("pagamentos_split")
      .update({
        status: "approved",
        gateway_status: "approved",
        gateway_status_detail: mpDetail || "accredited",
        updated_at: nowIso,
      })
      .eq("gateway_payment_id", paymentId)
      .eq("status", "pending");

    // Cancel any other stale pending attempts for the same ride
    await adminClient()
      .from("pagamentos_split")
      .update({
        status: "cancelled",
        updated_at: nowIso,
      })
      .eq("service_type", "mototaxi")
      .eq("service_id", ride.id)
      .eq("status", "pending")
      .neq("gateway_payment_id", paymentId);

    await adminClient()
      .from("mototaxi_corridas")
      .update({
        status: "paid",
        final_price: Number(ride.final_price ?? ride.estimated_price ?? 0),
        payment_method: "pix",
        pix_charge_status: "approved",
        updated_at: nowIso,
      })
      .eq("id", ride.id);

    await logAuditEvent("pix_status_verified_approved", "approved", {
      service_id: ride.id,
      payment_id: paymentId,
      transaction_id: txId || null,
      verified_by: userId,
    });

    return json(req, { success: true, status: "approved", status_detail: mpDetail, paid: true, ride_status: "paid" }, 200);
  }

  // Sync non-approved status if changed (e.g. cancelled/expired/rejected)
  if (mpStatus && mpStatus !== ride.pix_charge_status) {
    await adminClient()
      .from("mototaxi_corridas")
      .update({ pix_charge_status: mpStatus, updated_at: new Date().toISOString() })
      .eq("id", ride.id);
  }

  return json(req, {
    success: true,
    status: mpStatus,
    status_detail: mpDetail,
    paid: false,
    ride_status: ride.status,
  }, 200);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { success: false, error: "method_not_allowed" }, 405);

  let requestAuditContext: Record<string, unknown> = {};
  try {
    const userId = await authenticatedUserId(req);
    const body = await req.json().catch(() => {
      throw new HttpError(400, "invalid_json", "Corpo JSON inválido.");
    });
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "invalid_body", "Corpo da requisição inválido.");
    }

    requestAuditContext = {
      action: String(body.action || "create_payment_intent").slice(0, 80),
      payment_attempt_id: String(body.payment_attempt_id || body.idempotency_key || body.external_reference || "").slice(0, 80),
      service_id: String(body.service_id || body.serviceId || "").slice(0, 80),
      provider_id: String(body.provider_id || body.providerId || "").slice(0, 80),
    };

    const action = String(body.action || "create_payment_intent").trim().toLowerCase();
    if (["get_oauth_url", "oauth_url", "get_auth_url", "oauth"].includes(action)) {
      return await handleGetOAuthUrl(req, body, userId);
    }
    if (["exchange_oauth_code", "oauth_callback", "exchange_code"].includes(action)) {
      return await handleExchangeOAuthCode(req, body, userId);
    }
    if (["get_checkout_config", "checkout_config"].includes(action)) {
      return await handleGetCheckoutConfig(req, body);
    }
    if (["list_saved_cards", "wallet_list_cards"].includes(action)) {
      return await handleListSavedCards(req, body, userId);
    }
    if (["save_card", "wallet_save_card"].includes(action)) {
      return await handleSaveCard(req, body, userId);
    }
    if (["delete_saved_card", "wallet_delete_card"].includes(action)) {
      return await handleDeleteSavedCard(req, body, userId);
    }
    if (["check_mototaxi_pix_status", "verify_pix_payment"].includes(action)) {
      return await handleCheckMototaxiPixStatus(req, body, userId);
    }
    if (["create_payment_intent", "checkout", "create_mototaxi_pix_charge"].includes(action)) {
      return await handlePayment(req, body, userId);
    }
    throw new HttpError(400, "unknown_action", `Ação não reconhecida: ${action}`);
  } catch (error) {
    const httpError = error instanceof HttpError
      ? error
      : new HttpError(500, "internal_error", "Erro interno ao processar a solicitação.");
    console.error("[payment-gateway] request failed", httpError.code, error instanceof Error ? error.message : error);
    await logAuditEvent("payment_gateway_error", "failed", {
      ...requestAuditContext,
      code: httpError.code,
      http_status: httpError.status,
    }, error instanceof Error ? error.message : String(error));
    return json(req, {
      success: false,
      error: httpError.code,
      message: httpError.message,
      ...(httpError.details ? { details: httpError.details } : {}),
    }, httpError.status);
  }
});
