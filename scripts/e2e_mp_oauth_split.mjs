import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "xqujubbqcfqxkfczbidq";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const gatewayUrl = `${supabaseUrl}/functions/v1/payment-gateway`;
const providerId = "4db6e8a4-535f-4a77-9dba-8f3861f8b4dd";
const expectedSellerId = "3751383558";
const amount = 5.66;
const artifactDir = resolve(root, "test-results", "mp-oauth-split");
const evidencePath = resolve(root, ".mp_e2e_evidence.json");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function required(value, name) {
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

function cliApiKeys() {
  const args = ["supabase", "projects", "api-keys", "--project-ref", projectRef, "--output", "json"];
  const raw = process.platform === "win32"
    ? execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", [
      "/d", "/s", "/c", `npx ${args.join(" ")}`,
    ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    : execFileSync("npx", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const keys = JSON.parse(raw);
  const byName = (name) => keys.find((item) => item.name === name)?.api_key;
  return {
    anon: required(byName("anon") || byName("publishable"), "Supabase anon key"),
    serviceRole: required(byName("service_role") || byName("secret"), "Supabase service role key"),
  };
}

async function sessionForUser(admin, anonKey, userId) {
  const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(userId);
  if (getUserError || !userData?.user?.email) throw getUserError || new Error(`Usuário Auth ${userId} sem email`);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError || !link?.properties?.hashed_token) throw linkError || new Error("Magic link sem hashed_token");
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (verifyError || !verified?.session?.access_token) throw verifyError || new Error("Sessão não emitida");
  if (verified.user?.id !== userId) throw new Error("JWT emitido para usuário diferente do solicitado");
  return verified.session.access_token;
}

async function ensureE2eBuyer(admin) {
  const email = "qa+mp-oauth-split@ubtsuperapp.com.br";
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) return existing.id;
    if (data.users.length < 1000) break;
    page += 1;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `${crypto.randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { purpose: "mp_oauth_split_e2e" },
  });
  if (error || !data.user) throw error || new Error("Falha ao criar comprador E2E");
  return data.user.id;
}

async function ensurePublicBuyerProfile(admin, customerId) {
  const { error } = await admin.from("usuarios").upsert({
    id: customerId,
    nome: "UBT MP OAuth Split E2E Buyer",
    role: "tomador",
  }, { onConflict: "id" });
  if (error) throw error;
}

async function gateway(anonKey, accessToken, payload) {
  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 1000) }; }
  return { status: response.status, body };
}

async function marketplaceAccount(admin) {
  const { data, error } = await admin.from("marketplace_accounts")
    .select("id,user_id,mercado_pago_user_id,status,ambiente,oauth_status,token_expiration,token_metadata,connected_at")
    .eq("user_id", providerId)
    .eq("ambiente", "sandbox")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function authorizeSeller(oauthUrl, redirectUri, seller) {
  mkdirSync(artifactDir, { recursive: true });
  // O login do MP recusa o Chromium headless antes de renderizar o formulário.
  // O navegador continua totalmente automatizado; headless fica opt-in para CI compatível.
  const browser = await chromium.launch({ headless: process.env.MP_E2E_HEADLESS === "1" });
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  try {
    let capturedCallback = null;
    page.on("framenavigated", (frame) => {
      const navigatedUrl = frame.url();
      if (frame === page.mainFrame() && navigatedUrl.startsWith(redirectUri)) capturedCallback = navigatedUrl;
    });
    await page.goto(oauthUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const deadline = Date.now() + 120_000;
    let countrySelected = false;
    let usernameFilled = false;
    let passwordFilled = false;
    let alternateMethodRequested = false;
    let passwordMethodAttempts = 0;

    while (Date.now() < deadline) {
      const current = capturedCallback || page.url();
      if (current.startsWith(redirectUri)) {
        const url = new URL(current);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) throw new Error(`Redirect OAuth sem code/state (erro=${url.searchParams.get("error") || "desconhecido"})`);
        return { code, state };
      }

      const cookieButton = page.getByRole("button", { name: /^aceitar cookies$|^accept cookies$/i }).first();
      if (await cookieButton.isVisible().catch(() => false) && await cookieButton.isEnabled().catch(() => false)) {
        await cookieButton.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(300);
      }

      if (!countrySelected) {
        const countrySelect = page.locator("select").first();
        if (await countrySelect.isVisible().catch(() => false)) {
          const options = await countrySelect.locator("option").allTextContents();
          const label = options.find((value) => /brasil|brazil/i.test(value));
          if (label) {
            await countrySelect.selectOption({ label });
            countrySelected = true;
          }
        } else {
          const countryCombo = page.getByRole("combobox").first();
          if (await countryCombo.isVisible().catch(() => false)) {
            await countryCombo.click();
            const brazil = page.getByRole("option", { name: /brasil|brazil/i }).first();
            if (await brazil.isVisible().catch(() => false)) {
              await brazil.click();
              countrySelected = true;
            }
          }
        }
        if (countrySelected) {
          const confirm = page.getByRole("button", { name: /confirmar|confirm/i }).first();
          if (await confirm.isVisible().catch(() => false)) await confirm.click();
          await page.waitForTimeout(1_500);
          continue;
        }
      }

      const username = page.locator("input:visible").first();
      if (!usernameFilled && await username.isVisible().catch(() => false)) {
        await username.fill(seller.nickname || seller.email);
        usernameFilled = true;
        const next = page.getByRole("button", { name: /continuar|continue|próximo|next|entrar/i }).first();
        if (await next.isVisible().catch(() => false)) await next.click();
        console.log("[oauth] Identificador do Seller enviado.");
        await page.waitForTimeout(1_000);
        continue;
      }

      const password = page.locator("input:visible").first();
      if (!passwordFilled && passwordMethodAttempts > 0 && await password.isVisible().catch(() => false)) {
        await password.fill(seller.password);
        passwordFilled = true;
        const login = page.getByRole("button", { name: /entrar|iniciar sessão|login|continue|continuar|confirmar/i }).first();
        if (await login.isVisible().catch(() => false)) await login.click();
        console.log("[oauth] Senha do Seller enviada.");
        await page.waitForTimeout(1_500);
        continue;
      }

      if (usernameFilled && !passwordFilled) {
        const usePassword = page.getByText(/^(senha|password)$/i, { exact: true }).first();
        if (await usePassword.isVisible().catch(() => false)) {
          if (passwordMethodAttempts >= 4) throw new Error("Portal não navegou após selecionar repetidamente o método Senha");
          if (passwordMethodAttempts === 0) {
            const ancestry = await usePassword.evaluate((element) => {
              const result = [];
              let current = element;
              for (let index = 0; index < 6 && current; index += 1, current = current.parentElement) {
                result.push({
                  tag: current.tagName,
                  role: current.getAttribute("role"),
                  testid: current.getAttribute("data-testid"),
                  className: String(current.className || "").slice(0, 160),
                });
              }
              return result;
            });
            console.log(`[oauth] Estrutura segura da opção Senha: ${JSON.stringify(ancestry)}`);
          }
          const clickableAncestor = usePassword.locator('xpath=ancestor::*[self::button or self::a or self::li or @role="button" or @tabindex][1]');
          if (await clickableAncestor.count()) {
            await clickableAncestor.click({ timeout: 5_000 }).catch(() => {});
          } else {
            await usePassword.evaluate((element, level) => {
              let target = element;
              for (let index = 0; index < level && target.parentElement; index += 1) target = target.parentElement;
              target.click();
            }, Math.min(3, passwordMethodAttempts + 1));
          }
          passwordMethodAttempts += 1;
          console.log(`[oauth] Método por senha acionado (tentativa ${passwordMethodAttempts}).`);
          await page.waitForTimeout(1_500);
          continue;
        }
      }

      const approve = page.locator('button:not([disabled])').filter({ hasText: /autorizar|permitir|continuar|conectar|vincular/i }).first();
      if (usernameFilled && passwordFilled && await approve.isVisible().catch(() => false)) {
        await approve.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(1_500);
        continue;
      }

      const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
      if (/hubo un error accediendo|erro ao acessar esta página|error accessing this page/i.test(bodyText)) {
        const location = new URL(page.url());
        throw new Error(`Portal OAuth recusou a autorização em ${location.origin}${location.pathname}`);
      }
      const otpInput = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[id*="code" i]').first();
      if (await otpInput.isVisible().catch(() => false)) {
        if (!alternateMethodRequested) {
          const chooseOther = page.getByText(/escolher outro método|choose another method|otro método/i).first();
          if (await chooseOther.isVisible().catch(() => false)) {
            await chooseOther.click();
            alternateMethodRequested = true;
            console.log("[oauth] OTP por e-mail contornado pela opção oficial de outro método.");
            await page.waitForTimeout(1_000);
            continue;
          }
        }
        throw new Error("Mercado Pago exigiu código OTP e não disponibilizou autenticação alternativa por senha");
      }
      const captchaFrame = page.locator('iframe[src*="captcha" i], iframe[title*="captcha" i]').first();
      const captchaPrompt = page.getByText(/não sou um robô|i'm not a robot/i).first();
      if (await captchaFrame.isVisible().catch(() => false) || await captchaPrompt.isVisible().catch(() => false)) {
        throw new Error("Mercado Pago exigiu desafio humano/MFA no login do Seller Test User");
      }
      await page.waitForTimeout(750);
    }
    throw new Error("Timeout aguardando a conclusão do OAuth do Seller Test User");
  } catch (error) {
    await page.screenshot({ path: resolve(artifactDir, "oauth-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function ensureSellerOAuth(admin, anonKey, providerJwt, credentials, redirectUri) {
  const existing = await marketplaceAccount(admin);
  if (existing?.status === "CONNECTED" && existing?.oauth_status === "authorized" && String(existing.mercado_pago_user_id) === expectedSellerId) {
    console.log("[oauth] Seller correto já está conectado; reutilizando vínculo criptografado.");
    return existing;
  }
  console.log("[oauth] Iniciando autorização do Seller Test User em navegador isolado.");
  const start = await gateway(anonKey, providerJwt, { action: "get_oauth_url", redirect_uri: redirectUri });
  if (start.status !== 200 || !start.body?.oauth_url) throw new Error(`Falha ao iniciar OAuth: HTTP ${start.status} ${JSON.stringify(start.body)}`);
  const callback = await authorizeSeller(start.body.oauth_url, redirectUri, credentials.seller);
  if (callback.state !== start.body.state) throw new Error("OAuth state devolvido diverge do state emitido");
  const exchange = await gateway(anonKey, providerJwt, {
    action: "exchange_oauth_code",
    code: callback.code,
    state: callback.state,
    redirect_uri: redirectUri,
  });
  if (exchange.status !== 200 || exchange.body?.success !== true) {
    throw new Error(`Falha na troca OAuth: HTTP ${exchange.status} ${JSON.stringify(exchange.body)}`);
  }
  const connected = await marketplaceAccount(admin);
  if (String(connected?.mercado_pago_user_id) !== expectedSellerId || connected?.status !== "CONNECTED") {
    throw new Error(`Seller OAuth persistido incorretamente: ${JSON.stringify(connected)}`);
  }
  console.log(`[oauth] Seller conectado e validado: MP user ${connected.mercado_pago_user_id}.`);
  return connected;
}

async function tokenizeCard(publicKey) {
  const response = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      card_number: "5480832801033311",
      expiration_month: 11,
      expiration_year: 2030,
      security_code: "123",
      cardholder: {
        name: "APRO",
        identification: { type: "CPF", number: "12345678909" },
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 201 || !body?.id) {
    throw new Error(`Tokenização MP falhou: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  console.log(`[payment] Cartão de teste tokenizado pelo Mercado Pago (HTTP ${response.status}).`);
  return body.id;
}

async function createServiceRequest(admin, customerId) {
  const { data, error } = await admin.from("services_requests").insert({
    service_type: "diarista",
    provider_id: providerId,
    customer_id: customerId,
    amount,
    status: "Aguardando Pagamento",
    metadata: { e2e: true, scenario: "seller_oauth_split", generated_by: "scripts/e2e_mp_oauth_split.mjs" },
  }).select("id").single();
  if (error || !data) throw error || new Error("Falha ao criar services_request E2E");
  return data.id;
}

async function collectEvidence(admin, serviceId, transactionId) {
  const [service, split] = await Promise.all([
    admin.from("services_requests")
      .select("id,service_type,provider_id,customer_id,amount,status,payment_id,metadata,created_at,updated_at")
      .eq("id", serviceId).single(),
    admin.from("pagamentos_split")
      .select("transaction_id,status,service_type,service_id,total_amount,provider_amount,ubt_amount,entity_amount,prize_worker_amount,prize_consumer_amount,godparent_tomador_amount,godparent_prestador_amount,application_fee_amount,platform_collected_amount,payment_route,provider_payout_status,marketplace_account_id,environment,gateway_payment_id,gateway_status,created_at,updated_at")
      .eq("transaction_id", transactionId).single(),
  ]);
  if (service.error) throw service.error;
  if (split.error) throw split.error;
  return { service_request: service.data, pagamento_split: split.data };
}

async function main() {
  loadEnvFile(resolve(root, ".env"));
  loadEnvFile(resolve(root, ".supabase-secrets.sandbox.env"));
  const redirectUri = required(
    (process.env.MP_REDIRECT_URIS || "").split(",").map((value) => value.trim()).find((value) => value.includes("ubt-homologacao.vercel.app")),
    "MP_REDIRECT_URIS de homologação",
  );
  const credentials = JSON.parse(readFileSync(resolve(root, ".mp_test_credentials.txt"), "utf8"));
  if (String(credentials.seller?.id) !== expectedSellerId) throw new Error("Credencial Seller local não corresponde à allowlist esperada");
  const keys = cliApiKeys();
  const admin = createClient(supabaseUrl, keys.serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log("[setup] Emitindo sessões E2E sem expor chaves ou tokens.");
  const providerJwt = await sessionForUser(admin, keys.anon, providerId);
  const customerId = await ensureE2eBuyer(admin);
  await ensurePublicBuyerProfile(admin, customerId);
  const buyerJwt = await sessionForUser(admin, keys.anon, customerId);
  const account = await ensureSellerOAuth(admin, keys.anon, providerJwt, credentials, redirectUri);

  const serviceId = await createServiceRequest(admin, customerId);
  const paymentAttemptId = crypto.randomUUID();
  const checkoutPublicKey = required(
    account.token_metadata?.public_key,
    "Public Key retornada no OAuth do Seller",
  );
  const cardToken = await tokenizeCard(checkoutPublicKey);
  console.log(`[payment] Enviando tentativa ${paymentAttemptId} para serviço ${serviceId}.`);
  const result = await gateway(keys.anon, buyerJwt, {
    action: "create_payment_intent",
    payment_attempt_id: paymentAttemptId,
    service_type: "diarista",
    service_id: serviceId,
    provider_id: providerId,
    transaction_amount: amount,
    description: "UBT E2E OAuth Split Sandbox",
    payment_method_id: "master",
    card_token: cardToken,
    installments: 1,
    payer: {
      email: credentials.buyer.email,
      first_name: "APRO",
      last_name: "TEST",
      identification: { type: "CPF", number: "12345678909" },
    },
    metadata: { e2e: true, scenario: "seller_oauth_split" },
  });

  const safeResult = {
    http_status: result.status,
    success: result.body?.success,
    status: result.body?.status,
    payment_id: result.body?.payment_id,
    transaction_id: result.body?.transaction_id,
    payment_route: result.body?.payment_route,
    ledger_persisted: result.body?.ledger_persisted,
    error: result.body?.error,
    message: result.body?.message,
    details: result.body?.details,
    gateway_status: result.body?.gateway_status,
  };
  console.log(`[payment] Resultado seguro: ${JSON.stringify(safeResult)}`);
  if (result.status !== 200 || result.body?.status !== "approved" || result.body?.payment_route !== "seller_oauth_split") {
    throw new Error(`Pagamento E2E não aprovado: ${JSON.stringify(safeResult)}`);
  }

  const evidence = await collectEvidence(admin, serviceId, result.body.transaction_id);
  const report = {
    executed_at: new Date().toISOString(),
    scenario: "Mercado Pago Sandbox OAuth Split",
    gateway: safeResult,
    marketplace_account: {
      id: account.id,
      mercado_pago_user_id: account.mercado_pago_user_id,
      status: account.status,
      oauth_status: account.oauth_status,
      ambiente: account.ambiente,
    },
    ...evidence,
  };
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("[success] E2E aprovado; evidências persistidas em .mp_e2e_evidence.json.");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const safeError = error instanceof Error
    ? error.message
    : JSON.stringify({
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  console.error(`[failure] ${safeError}`);
  process.exitCode = 1;
});
