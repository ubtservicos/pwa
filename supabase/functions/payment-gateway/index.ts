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

interface RoutingDecision {
  mode: PaymentRoute;
  authToken: string;
  checkoutPublicKey: string | null;
  marketplaceAccountId: string | null;
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

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  const value = (Deno.env.get("MP_ENVIRONMENT") || Deno.env.get("APP_ENV") || "sandbox")
    .trim()
    .toLowerCase();
  if (value !== "sandbox" && value !== "production") {
    throw new Error("MP_ENVIRONMENT must be 'sandbox' or 'production'");
  }
  return value;
}

function platformAccessToken(environment: MpEnvironment): string {
  const scopedName = environment === "sandbox"
    ? "MP_ACCESS_TOKEN_SANDBOX"
    : "MP_ACCESS_TOKEN_PRODUCTION";
  return (
    Deno.env.get(scopedName) ||
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
  const allowOrigin = configured.includes(origin)
    ? origin
    : paymentEnvironment() === "sandbox" && configured.length === 0
      ? "*"
      : configured[0] || "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function calculateSplitAmounts(totalAmount: number, config: SplitConfig): SplitAmounts {
  const prestadorAmount = roundMoney(totalAmount * config.prestador_pct / 100);
  const ubtAmount = roundMoney(totalAmount * config.ubt_pct / 100);
  const comunidadeAmount = roundMoney(totalAmount * config.comunidade_pct / 100);
  const premioTrabalhador = roundMoney(totalAmount * config.premio_trabalhador_pct / 100);
  const premioConsumidor = roundMoney(totalAmount * config.premio_consumidor_pct / 100);
  const padrinhoPrestadorAmount = roundMoney(totalAmount * config.padrinho_prestador_pct / 100);
  const allocated = roundMoney(
    prestadorAmount + ubtAmount + comunidadeAmount + premioTrabalhador +
      premioConsumidor + padrinhoPrestadorAmount,
  );
  const padrinhoTomadorAmount = roundMoney(totalAmount - allocated);

  if (padrinhoTomadorAmount < 0) {
    throw new HttpError(500, "invalid_split_configuration", "A configuração de split ultrapassa 100%.");
  }

  return {
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
  const { data, error } = await supabaseAdmin
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
  if (!Object.values(config).every(Number.isFinite) || Math.abs(percentageTotal - 100) > 0.001) {
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
    const { error } = await supabaseAdmin.from("financial_audit_logs").insert({
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

  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
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
  const { data: sellerAccount, error } = await supabaseAdmin
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

  return {
    mode: "seller_oauth_split",
    authToken: sellerToken,
    checkoutPublicKey: String(sellerAccount.token_metadata?.public_key || "").trim() || null,
    marketplaceAccountId: sellerAccount.id,
    fallbackReason: null,
  };
}

async function handleGetCheckoutConfig(req: Request, body: Record<string, any>): Promise<Response> {
  const environment = paymentEnvironment();
  const providerId = assertUuid(body.provider_id ?? body.providerId, "provider_id");
  const route = await resolvePaymentRoute(providerId, environment);
  if (route.mode === "seller_oauth_split" && !route.checkoutPublicKey) {
    throw new HttpError(
      409,
      "seller_public_key_missing",
      "A conta OAuth do Seller não possui Public Key para tokenizar o cartão.",
    );
  }
  return json(req, {
    success: true,
    environment,
    payment_route: route.mode,
    public_key: route.checkoutPublicKey,
    fallback_reason: route.fallbackReason,
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

  const payload: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description,
    payment_method_id: input.paymentMethodId,
    payer: input.payer,
    external_reference: input.externalReference,
    metadata: input.metadata,
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

async function reserveSplitRecord(input: {
  transactionId: string;
  idempotencyKey: string;
  serviceType: ServiceType;
  serviceId: string;
  providerId: string;
  split: SplitAmounts;
  route: RoutingDecision;
  environment: MpEnvironment;
  entityId: string | null;
  godparentTomadorId: string | null;
  godparentPrestadorId: string | null;
}): Promise<void> {
  const record = {
    transaction_id: input.transactionId,
    idempotency_key: input.idempotencyKey,
    status: "pending",
    service_type: input.serviceType,
    service_id: input.serviceId,
    provider_id: input.providerId,
    total_amount: input.split.total_amount,
    provider_amount: input.split.prestador_amount,
    ubt_amount: input.split.ubt_amount,
    entity_amount: input.split.comunidade_amount,
    entity_id: input.entityId,
    prize_worker_amount: input.split.premio_trabalhador,
    prize_consumer_amount: input.split.premio_consumidor,
    godparent_tomador_amount: input.split.padrinho_tomador_amount,
    godparent_tomador_id: input.godparentTomadorId,
    godparent_prestador_amount: input.split.padrinho_prestador_amount,
    godparent_prestador_id: input.godparentPrestadorId,
    godparent_amount: input.split.padrinho_amount,
    godparent_id: input.godparentTomadorId,
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

  const { error } = await supabaseAdmin.from("pagamentos_split").insert(record);
  if (!error) return;
  if (error.code !== "23505") {
    throw new HttpError(503, "split_reservation_failed", "Não foi possível reservar o lançamento contábil.");
  }

  const { data: existing, error: readError } = await supabaseAdmin
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

  const { error } = await supabaseAdmin
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

function mpErrorDetails(data: Record<string, any>): Array<{ code?: string | number; description: string }> {
  if (Array.isArray(data?.cause)) {
    return data.cause.slice(0, 10).map((cause: any) => ({
      code: cause?.code,
      description: String(cause?.description || "Erro não detalhado").slice(0, 500),
    }));
  }
  return [{ code: data?.error, description: String(data?.message || data?.error || "Pagamento rejeitado").slice(0, 500) }];
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
  return candidate;
}

async function handleGetOAuthUrl(req: Request, body: Record<string, any>, userId: string): Promise<Response> {
  const clientId = (Deno.env.get("MERCADOPAGO_CLIENT_ID") || Deno.env.get("MP_CLIENT_ID") || "").trim();
  if (!clientId) throw new HttpError(500, "missing_client_id", "Client ID do Mercado Pago não configurado.");

  const redirectUri = allowedRedirectUri(body.redirect_uri);
  const state = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("marketplace_oauth_connections").insert({
    user_id: userId,
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
    oauth_url: `https://auth.mercadopago.com/authorization?${params.toString()}`,
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

  const { data: connection, error: stateError } = await supabaseAdmin
    .from("marketplace_oauth_connections")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("state_reference", state)
    .eq("authorization_status", "started")
    .maybeSingle();
  if (stateError || !connection || Date.now() - new Date(connection.created_at).getTime() > 10 * 60 * 1000) {
    throw new HttpError(400, "oauth_state_mismatch", "OAuth state ausente, expirado ou já utilizado.");
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
      test_token: environment === "sandbox" ? "true" : "false",
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData?.access_token) {
    await supabaseAdmin.from("marketplace_oauth_connections").update({
      authorization_status: "failed",
      error_code: String(tokenData?.error || tokenResponse.status),
      error_message: String(tokenData?.message || tokenData?.error_description || "OAuth rejected").slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id);
    throw new HttpError(400, "oauth_token_exchange_failed", "Mercado Pago recusou a troca do código OAuth.", {
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
    await supabaseAdmin.from("marketplace_oauth_connections").update({
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
  const { data: account, error: upsertError } = await supabaseAdmin.from("marketplace_accounts").upsert({
    user_id: userId,
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

  await supabaseAdmin.from("marketplace_oauth_connections").update({
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

async function handlePayment(req: Request, body: Record<string, any>, customerId: string): Promise<Response> {
  const environment = paymentEnvironment();
  const amount = validateAmount(body.transaction_amount ?? body.amount);
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
  const cardToken = String(body.card_token || body.token || "").trim() || undefined;
  const installments = Math.min(24, Math.max(1, Number.parseInt(String(body.installments || 1), 10) || 1));
  if (paymentMethodId !== "pix" && !cardToken) {
    throw new HttpError(400, "missing_card_token", "Pagamento com cartão exige tokenização prévia.");
  }
  const clientMetadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const metadataJson = JSON.stringify(clientMetadata);
  if (metadataJson.length > 4000) throw new HttpError(400, "metadata_too_large", "metadata excede 4 KB.");
  const payerEmail = resolvePayerEmail(body, environment);
  const payer = sanitizePayer(body, payerEmail);
  const route = await resolvePaymentRoute(providerId, environment);
  const { config, source: splitConfigSource } = await fetchSplitConfig();
  const split = calculateSplitAmounts(amount, config);
  const transactionId = paymentAttemptId;
  const idempotencyKey = paymentAttemptId;

  await reserveSplitRecord({
    transactionId,
    idempotencyKey,
    serviceType,
    serviceId,
    providerId,
    split,
    route,
    environment,
    entityId,
    godparentTomadorId,
    godparentPrestadorId,
  });

  await logAuditEvent("payment_routed", "pending", {
    transaction_id: transactionId,
    service_type: serviceType,
    service_id: serviceId,
    provider_id: providerId,
    customer_id: customerId,
    payment_attempt_source: paymentAttempt.source,
    route: route.mode,
    fallback_reason: route.fallbackReason,
    environment,
    split_config_source: splitConfigSource,
    split_amounts: split,
  });

  const mpResult = await createMercadoPagoPayment({
    authToken: route.authToken,
    idempotencyKey,
    transactionAmount: amount,
    description,
    paymentMethodId,
    payer,
    cardToken,
    installments,
    externalReference: transactionId,
    metadata: {
      ...clientMetadata,
      ubt_service_type: serviceType,
      ubt_service_id: serviceId,
      ubt_provider_id: providerId,
      ubt_payment_route: route.mode,
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
    const status = mpResult.outcomeUnknown
      ? mpResult.httpStatus
      : mpResult.httpStatus >= 500
        ? 502
        : 422;
    return json(req, {
      success: false,
      error: mpResult.outcomeUnknown ? "payment_outcome_unknown" : "payment_rejected",
      message: mpResult.outcomeUnknown
        ? "Não foi possível confirmar o resultado. Consulte pela mesma payment_attempt_id antes de tentar novamente."
        : String(mpResult.data?.message || mpResult.data?.error || "Pagamento rejeitado pelo Mercado Pago."),
      details: mpErrorDetails(mpResult.data),
      gateway_status: mpResult.httpStatus,
      transaction_id: transactionId,
      payment_route: route.mode,
    }, status);
  }

  if (serviceType === "mototaxi" && mpStatus === "approved") {
    const { error } = await supabaseAdmin.from("mototaxi_corridas").update({
      status: "paid",
      final_price: amount,
      updated_at: new Date().toISOString(),
    }).eq("id", serviceId);
    if (error) console.error("[payment-gateway] ride status update failed", error.message);
  }

  if (serviceType === "diarista" && mpStatus === "approved") {
    const { error } = await supabaseAdmin.from("services_requests").update({
      status: "paid",
      payment_id: String(mpResult.data.id),
      updated_at: new Date().toISOString(),
    }).eq("id", serviceId);
    if (error) console.error("[payment-gateway] service request status update failed", error.message);
  }

  const txData = mpResult.data?.point_of_interaction?.transaction_data;
  const appliedApplicationFee = route.mode === "seller_oauth_split" ? split.application_fee : 0;
  return json(req, {
    success: true,
    payment_id: mpResult.data.id,
    status: mpStatus,
    transaction_id: transactionId,
    payment_route: route.mode,
    fallback_reason: route.fallbackReason,
    provider_payout_status: route.mode === "platform_fallback" ? "pending" : "not_required",
    ledger_persisted: ledgerPersisted,
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
    } : null,
    split: {
      ...split,
      application_fee: appliedApplicationFee,
      accounting_platform_allocation: split.application_fee,
      config_source: splitConfigSource,
    },
  }, 200);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
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
    if (["create_payment_intent", "checkout"].includes(action)) {
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
