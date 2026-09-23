// scripts/test-payment-gateway.mjs
// Test script testing both PIX and Card modes

const SUPABASE_FUNCTION_URL = "https://xqujubbqcfqxkfczbidq.supabase.co/functions/v1/payment-gateway";
const SUPABASE_ANON_KEY = "sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT";

async function testScenario(title, payload) {
  console.log("\n================================================================================");
  console.log(`🧪 CENÁRIO: ${title}`);
  console.log("================================================================================");
  console.log("📦 Payload enviado:", JSON.stringify(payload, null, 2));

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
    });
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
      console.log(`❌ ${title}: REJEITADO (Status ${response.status})`);
      if (jsonBody?.mp_error) {
        console.log("🔍 Erro MP:", jsonBody.mp_error);
      }
    }
  } catch (err) {
    console.error(`💥 Erro:`, err);
  }
}

async function runAll() {
  // Test 1: Sandbox Testuser Payer (Mastercard)
  await testScenario("Teste 1 - Cartão com Payer Testuser", {
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

  // Test 2: Pix Payment
  await testScenario("Teste 2 - Pagamento PIX", {
    action: "create_payment_intent",
    transaction_amount: 10.00,
    payment_method_id: "pix",
    service_type: "mototaxi",
    service_id: "00000000-0000-0000-0000-000000000002",
    payer_email: "TESTUSER367958859718560557@testuser.com",
    payer: {
      email: "TESTUSER367958859718560557@testuser.com",
      first_name: "Test",
      last_name: "User",
      identification: { type: "CPF", number: "85311283087" }
    }
  });
}

runAll();
