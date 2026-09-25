// scripts/test-payment-gateway.mjs
// UBT-PAY-007: Test script with robust timeouts, token handling, and non-blocking execution

const SUPABASE_FUNCTION_URL = "https://xqujubbqcfqxkfczbidq.supabase.co/functions/v1/payment-gateway";
const SUPABASE_ANON_KEY = "sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT";

async function testScenario(title, payload) {
  console.log("\n================================================================================");
  console.log(`🧪 CENÁRIO: ${title}`);
  console.log("================================================================================");
  console.log("📦 Payload enviado:", JSON.stringify(payload, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout max

  try {
    const startTime = Date.now();
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    console.log(`⏱️ Resposta em ${duration}ms | HTTP Status: ${response.status} (${response.statusText})`);

    const textBody = await response.text();
    let jsonBody;
    try {
      jsonBody = JSON.parse(textBody);
    } catch {
      jsonBody = null;
    }

    console.log("📄 Corpo da resposta:", JSON.stringify(jsonBody || textBody, null, 2));

    if (response.status >= 200 && response.status < 300 && jsonBody?.success !== false) {
      console.log(`✅ ${title}: APROVADO!`);
    } else {
      console.log(`⚠️ ${title}: Resposta do Gateway (Status ${response.status}):`, jsonBody?.message || jsonBody?.error || "Rejeitado");
      if (jsonBody?.details) {
        console.log("🔍 Detalhes:", JSON.stringify(jsonBody.details, null, 2));
      }
    }
    return { status: response.status, body: jsonBody };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    console.error(`💥 Erro na requisição:`, isTimeout ? "Timeout de 12s atingido" : err.message);
    return { error: err.message };
  }
}

async function runAll() {
  console.log("🚀 Iniciando testes do payment-gateway...");

  // Teste 1: Validação preventiva de resiliência - Cartão SEM Token
  // Deve retornar HTTP 400 limpo e explicativo imediatamente, sem travar nem chamar o MP
  await testScenario("Teste 1 - Validação de Cartão SEM Token (Resiliência)", {
    action: "create_payment_intent",
    transaction_amount: 10.00,
    payment_method_id: "master",
    service_type: "mototaxi",
    service_id: "00000000-0000-0000-0000-000000000001",
    payer_email: "TESTUSER367958859718560557@testuser.com",
    payer: {
      email: "TESTUSER367958859718560557@testuser.com",
      first_name: "Test",
      last_name: "User",
      identification: { type: "CPF", number: "85311283087" }
    }
  });

  // Teste 2: Cartão com Mock Token (Sandbox)
  await testScenario("Teste 2 - Cartão COM Token Mockado (Fluxo de Cartão)", {
    action: "create_payment_intent",
    transaction_amount: 10.00,
    payment_method_id: "master",
    service_type: "mototaxi",
    service_id: "00000000-0000-0000-0000-000000000002",
    token: "mock_card_token_sandbox_3311",
    card_token: "mock_card_token_sandbox_3311",
    payer_email: "TESTUSER367958859718560557@testuser.com",
    payer: {
      email: "TESTUSER367958859718560557@testuser.com",
      first_name: "Test",
      last_name: "User",
      identification: { type: "CPF", number: "85311283087" }
    }
  });

  // Teste 3: Pagamento PIX (Sem necessidade de token de cartão)
  await testScenario("Teste 3 - Pagamento PIX Transparente", {
    action: "create_payment_intent",
    transaction_amount: 10.00,
    payment_method_id: "pix",
    service_type: "mototaxi",
    service_id: "00000000-0000-0000-0000-000000000003",
    payer_email: "TESTUSER367958859718560557@testuser.com",
    payer: {
      email: "TESTUSER367958859718560557@testuser.com",
      first_name: "Test",
      last_name: "User",
      identification: { type: "CPF", number: "85311283087" }
    }
  });

  console.log("\n🏁 Todos os testes executados sem travamento!");
}

runAll();
