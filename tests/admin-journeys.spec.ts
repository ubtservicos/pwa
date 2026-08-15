import { test, expect } from "@playwright/test";

test.describe("Happy Path & Business Journey Testing Suite (E2E)", () => {

  test.beforeEach(async ({ page }) => {
    // Aumenta o timeout para 60 segundos por teste para evitar falhas de concorrência em máquinas lentas
    test.setTimeout(60000);

    // Escuta logs do console, erros de runtime e tráfego de rede para facilitar troubleshooting
    page.on("console", msg => console.log(`BROWSER_LOG [${msg.type()}]:`, msg.text()));
    page.on("pageerror", err => console.log(`BROWSER_ERROR:`, err.message));
    page.on("request", req => console.log(`E2E REQUEST: ${req.method()} ${req.url()}`));
    page.on("response", res => console.log(`E2E RESPONSE: ${res.status()} from ${res.url()}`));

    // Desativa o registro de Service Workers para garantir que o Playwright intercepte todas as requisições de rede
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        get() {
          return undefined;
        }
      });
    });
  });

  test("Cenário 1: Jornada B2C - Fila de Espera/Waitlist (Happy Path)", async ({ page }) => {
    // 1. Intercepta requisições Supabase API para o cadastro na Waitlist e Analytics
    await page.route(/\/auth\/v1\/user/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-client-uuid",
          email: "client-test@ubt.com.br",
          role: "authenticated",
          aud: "authenticated",
          user_metadata: {}
        })
      });
    });

    await page.route(/\/rest\/v1\/waitlist/, async (route) => {
      if (route.request().method() === "GET") {
        // Retorna null como objeto único para simular e-mail não existente (evita que o array vazio [] seja tratado como truthy)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "null"
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: "mock-inserted-id" }])
        });
      }
    });

    await page.route(/\/rest\/v1\/ceps_ubatuba/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bairro: "Estufa I" })
      });
    });

    await page.route(/\/rest\/v1\/analytics_events/, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([{ id: "mock-analytics-id" }])
      });
    });

    // 2. Navega para a página pública
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // 3. Scroll até a seção do formulário
    const formSection = page.locator("#cadastro-fundadores-cap").first();
    await formSection.scrollIntoViewIfNeeded();

    // 4. Preenche os campos do formulário com dados válidos
    const nomeInput = page.locator("input[placeholder*='Ex: Carlos da Silva' i]").first();
    const phoneInput = page.locator("input[placeholder*='(12) 99999-9999' i]").first();
    const emailInput = page.locator("input[placeholder*='Ex: carlos@email.com' i]").first();
    
    await nomeInput.fill("Usuário E2E Happy Path");
    await phoneInput.fill("(12) 99999-9988");
    await emailInput.fill(`happy-path-${Date.now()}@ubt.com.br`);

    // 5. Escolhe o perfil (Diarista) usando setChecked direto no input
    const checkboxDiarista = page.locator("label:has-text('Diarista') input[type='checkbox']").first();
    await checkboxDiarista.setChecked(true, { force: true });
    await page.waitForTimeout(200);

    // 5b. Seleciona a região de atuação para Diarista (Centro)
    const regionCentro = page.locator("label:has-text('Centro') input[type='checkbox']").first();
    await regionCentro.setChecked(true, { force: true });

    // 6. Seleciona Mercado Pago - Sim
    const mpButton = page.locator("button:has-text('Sim')").first();
    await mpButton.click({ force: true });

    // 7. Aceita o consentimento da LGPD
    const consentCheckbox = page.locator("#consent-lgpd").first();
    await consentCheckbox.setChecked(true, { force: true });

    // 8. Clica no botão de enviar interno do formulário (evita o botão principal do Hero com mesmo texto)
    const submitBtn = page.locator("#cadastro-fundadores-cap form button[type='submit']").first();
    
    const isDisabled = await submitBtn.getAttribute("disabled");
    console.log("SUBMIT BUTTON DISABLED STATE BEFORE CLICK:", isDisabled);

    await submitBtn.click();
    await page.waitForTimeout(2500);

    // 9. Valida a renderização da mensagem de sucesso
    const successHeader = page.locator("text=/Você já é um Fundador|Sucesso no Cadastro/i");
    try {
      await expect(successHeader.first()).toBeVisible({ timeout: 15000 });
    } catch (e) {
      console.log("PAGE TEXT CONTENT ON FAILURE:", await page.locator("body").textContent());
      throw e;
    }
  });

  test("Cenário 2: Jornada Superadmin - Analytics & Tabela (Happy Path)", async ({ page }) => {
    // 1. Intercepta requisições Supabase API para fornecer dados estáticos consistentes
    await page.route(/\/auth\/v1\/user/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-admin-uuid",
          email: "ubt.servicos@gmail.com",
          role: "authenticated",
          aud: "authenticated",
          user_metadata: {}
        })
      });
    });

    await page.route(/\/rest\/v1\/usuarios/, async (route) => {
      // Retorna objeto único para atender ao maybeSingle()
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: "super_admin" })
      });
    });

    await page.route(/\/rest\/v1\/waitlist/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Content-Range": "0-0/1"
        },
        body: JSON.stringify([
          {
            id: "1",
            created_at_utc: "2026-08-14T10:00:00Z",
            created_at_local: "14/08/2026 07:00:00",
            nome: "Felipe Diarista Teste",
            email: "felipe@ubt.com.br",
            telefone: "(12) 98888-8888",
            cidade: "Ubatuba",
            perfil: ["diarista"],
            origem: "direto",
            consentimento_lgpd: true,
            status: "novo"
          }
        ])
      });
    });

    // 2. Navega para a página de login para inicializar o origin
    await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // 3. Define o local storage autenticado
    await page.evaluate(() => {
      window.localStorage.setItem(
        "sb-xqujubbqcfqxkfczbidq-auth-token",
        JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "e2e-admin-uuid",
            email: "ubt.servicos@gmail.com",
            role: "authenticated",
            aud: "authenticated",
            user_metadata: {}
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600
        })
      );
    });

    // 4. Acessa a página interna de Fila de Espera (caminho correto)
    await page.goto("/admin/waitlist", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("CURRENT URL IN SUPERADMIN TEST:", page.url());

    // 5. Valida se os KPIs da Waitlist estão visíveis ("Total Inscritos" de acordo com o AdminWaitlistPage.tsx)
    const totalCadastrosKpi = page.locator("text=Total Inscritos").first();
    await expect(totalCadastrosKpi).toBeVisible({ timeout: 15000 });

    // 6. Valida se a barra de pesquisa e a tabela carregam corretamente
    const searchBar = page.locator("input[placeholder*='Pesquisar' i]").first();
    await expect(searchBar).toBeVisible();

    const dataRow = page.locator("text=Felipe Diarista Teste").first();
    await expect(dataRow).toBeVisible();
  });

});
