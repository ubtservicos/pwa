import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = resolve(root, "..", "dados-importantes-ubt.txt");
const envFile = resolve(root, ".env");
const secretsFile = resolve(root, ".supabase-secrets.sandbox.env");
const credentialsFile = resolve(root, ".mp_test_credentials.txt");
const summaryFile = resolve(root, ".mp_setup_summary.txt");

const allowedOrigins = "https://ubt-homologacao.vercel.app,http://localhost:8080,http://localhost:5173";
const redirectUris = "https://ubt-homologacao.vercel.app/app/config/financeiro,http://localhost:8080/app/config/financeiro,http://localhost:5173/app/config/financeiro";

function parseEnv(content) {
  const values = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function serializeEnv(values) {
  return [...values.entries()].map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
}

function parseSandboxApplication() {
  if (!existsSync(sourceFile)) throw new Error(`Credential source not found: ${sourceFile}`);
  const source = readFileSync(sourceFile, "utf8");
  const lines = source.split(/\r?\n/);
  const section = lines.findIndex((line) => line.trim().toLowerCase() === "ubt sandbox");
  if (section < 0) throw new Error("The 'UBT Sandbox' credential section was not found.");

  const fields = {};
  for (const line of lines.slice(section + 1, section + 12)) {
    const match = line.match(/^\s*(Client ID|Client Secret|Public Key|Access Token)\s*:\s*(.+?)\s*$/i);
    if (match) fields[match[1].toLowerCase().replaceAll(" ", "_")] = match[2].trim();
  }
  for (const field of ["client_id", "client_secret", "public_key", "access_token"]) {
    if (!fields[field] || fields[field].includes("<SEU_")) {
      throw new Error(`Missing ${field} in the UBT Sandbox credential section.`);
    }
  }
  const productiveMatch = source.match(/npx\s+supabase\s+secrets\s+set\s+MP_ACCESS_TOKEN=(?:"([^"]+)"|'([^']+)'|(\S+))/i);
  fields.productive_access_token = productiveMatch?.[1] || productiveMatch?.[2] || productiveMatch?.[3] || "";
  return fields;
}

function readState() {
  if (!existsSync(credentialsFile)) return { created_at: new Date().toISOString() };
  try {
    return JSON.parse(readFileSync(credentialsFile, "utf8"));
  } catch {
    throw new Error(`${credentialsFile} exists but is not valid JSON; refusing to create duplicate users.`);
  }
}

function persistState(state) {
  writeFileSync(credentialsFile, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
}

async function requestTestUser(accessToken, description) {
  const response = await fetch("https://api.mercadopago.com/users/test", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Idempotency-Key": `ubt-${description.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-20261008`,
    },
    body: JSON.stringify({ site_id: "MLB", description }),
  });
  const rawBody = await response.text();
  let payload = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = {};
  }
  return { response, payload, rawBody };
}

async function createTestUser(accessToken, productiveAccessToken, description) {
  let { response, payload, rawBody } = await requestTestUser(accessToken, description);
  if (
    response.status === 403 &&
    String(payload.message || "").includes("productive user") &&
    productiveAccessToken
  ) {
    ({ response, payload, rawBody } = await requestTestUser(productiveAccessToken, description));
  }
  if (!response.ok) {
    throw new Error(`Mercado Pago POST /users/test failed (${response.status}): ${payload.message || payload.error || JSON.stringify(payload)}`);
  }
  const email = payload.email || (payload.id ? `test_user_${payload.id}@testuser.com` : "");
  if (!payload.id || !email || !payload.password) {
    const receivedFields = Object.keys(payload).sort().join(", ") || "none";
    throw new Error(
      `Mercado Pago returned an incomplete test user for '${description}' ` +
      `(status=${response.status}, fields=${receivedFields}, body_length=${rawBody.length}).`,
    );
  }
  return {
    id: payload.id,
    email,
    password: payload.password,
    nickname: payload.nickname,
    site_id: payload.site_id,
    site_status: payload.site_status,
    description,
  };
}

function writeConfiguration(app, state = {}) {
  const currentEnv = parseEnv(existsSync(envFile) ? readFileSync(envFile, "utf8") : "");
  const encryptionKey = currentEnv.get("MP_TOKEN_ENCRYPTION_KEY") || randomBytes(32).toString("base64");
  const webhookSecret = currentEnv.get("MP_WEBHOOK_SECRET") || randomBytes(32).toString("hex");
  const values = {
    MP_ENVIRONMENT: "sandbox",
    APP_ENV: "sandbox",
    MP_ACCESS_TOKEN_SANDBOX: app.access_token,
    MP_ACCESS_TOKEN: app.access_token,
    MERCADOPAGO_ACCESS_TOKEN: app.access_token,
    MERCADOPAGO_CLIENT_ID: app.client_id,
    MERCADOPAGO_CLIENT_SECRET: app.client_secret,
    MP_TOKEN_ENCRYPTION_KEY: encryptionKey,
    MP_WEBHOOK_SECRET: webhookSecret,
    ALLOWED_ORIGINS: allowedOrigins,
    MP_REDIRECT_URIS: redirectUris,
    VITE_MP_ENVIRONMENT: "sandbox",
    VITE_MP_PUBLIC_KEY: app.public_key,
    VITE_MP_TEST_PAYER_CPF: "12345678909",
  };
  if (state.buyer?.email) {
    values.MP_TEST_PAYER_EMAIL = state.buyer.email;
    values.VITE_MP_TEST_PAYER_EMAIL = state.buyer.email;
  }
  if (state.seller?.email) values.MP_TEST_SELLER_EMAILS = state.seller.email;
  if (state.seller?.id) values.MP_TEST_SELLER_USER_IDS = String(state.seller.id);
  for (const [key, value] of Object.entries(values)) currentEnv.set(key, value);
  writeFileSync(envFile, serializeEnv(currentEnv), { encoding: "utf8", mode: 0o600 });

  const cloudKeys = [
    "MP_ENVIRONMENT", "APP_ENV", "MP_ACCESS_TOKEN_SANDBOX", "MP_ACCESS_TOKEN",
    "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_CLIENT_ID", "MERCADOPAGO_CLIENT_SECRET",
    "MP_TEST_PAYER_EMAIL", "MP_TEST_SELLER_EMAILS", "MP_TEST_SELLER_USER_IDS", "MP_TOKEN_ENCRYPTION_KEY",
    "MP_WEBHOOK_SECRET", "ALLOWED_ORIGINS", "MP_REDIRECT_URIS",
  ];
  const cloudEnv = new Map(cloudKeys.map((key) => [key, currentEnv.get(key)]));
  writeFileSync(secretsFile, serializeEnv(cloudEnv), { encoding: "utf8", mode: 0o600 });
}

function writeSummary(state) {
  const summary = [
    "UBT Mercado Pago Sandbox — setup concluído",
    "",
    `SELLER_ID=${state.seller.id}`,
    `SELLER_EMAIL=${state.seller.email}`,
    `SELLER_PASSWORD=${state.seller.password}`,
    "",
    `BUYER_ID=${state.buyer.id}`,
    `BUYER_EMAIL=${state.buyer.email}`,
    `BUYER_PASSWORD=${state.buyer.password}`,
    "",
    "Próximos passos:",
    "1. No UBT, entre como o prestador e abra /app/config/financeiro; clique em Conectar Mercado Pago e autorize com o SELLER acima.",
    "2. Cenário A: mantenha marketplace_accounts=CONNECTED e pague com o BUYER usando cartão teste, titular APRO e CPF 12345678909.",
    "3. Cenário B: marque a conta Seller como REVOKED e repita com nova tentativa; confirme payment_route=platform_fallback e provider_payout_status=pending.",
  ].join("\n") + "\n";
  writeFileSync(summaryFile, summary, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(summary);
}

const app = parseSandboxApplication();
if (process.argv.includes("--prepare-only")) {
  writeConfiguration(app);
  process.stdout.write("Local Sandbox environment and encryption key prepared.\n");
  process.exit(0);
}
const state = readState();

if (!state.seller) {
  state.seller = await createTestUser(app.access_token, app.productive_access_token, "UBT Sandbox Seller 01");
  persistState(state);
}
if (!state.buyer) {
  state.buyer = await createTestUser(app.access_token, app.productive_access_token, "UBT Sandbox Buyer 01");
  persistState(state);
}

writeConfiguration(app, state);
writeSummary(state);
