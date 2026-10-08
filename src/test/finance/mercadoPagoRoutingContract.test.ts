import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const gateway = readFileSync(
  resolve(process.cwd(), "supabase/functions/payment-gateway/index.ts"),
  "utf8",
);
const checkout = readFileSync(
  resolve(process.cwd(), "src/components/Payment/CheckoutUniversal.tsx"),
  "utf8",
);

describe("Mercado Pago routing contract", () => {
  it("only sends application_fee through the Seller OAuth route", () => {
    expect(gateway).toContain('route.mode === "seller_oauth_split" ? { applicationFee: split.application_fee } : {}');
    expect(gateway).toContain('mode: "platform_fallback"');
    expect(gateway).toContain('provider_payout_status: input.route.mode === "platform_fallback" ? "pending" : "not_required"');
  });

  it("does not accept a Seller access token from the browser", () => {
    expect(gateway).not.toMatch(/body\.(seller_access_token|sellerToken|provider_token)/);
    expect(gateway).toContain('.from("marketplace_accounts")');
  });

  it("uses a stable payment attempt as MP idempotency key", () => {
    expect(gateway).toContain("const paymentAttempt = resolvePaymentAttemptId(body)");
    expect(gateway).toContain('"X-Idempotency-Key": input.idempotencyKey');
    expect(checkout).toContain("payment_attempt_id: paymentAttemptId");
  });

  it("keeps the previous Vercel bundle compatible during rollout", () => {
    expect(gateway).toContain('source: "legacy_external_reference"');
    expect(gateway).toContain('assertUuid(body.external_reference, "external_reference")');
  });

  it("sends only the CardToken, never raw card data, to the Edge Function", () => {
    expect(checkout).toContain("card_token: token");
    expect(checkout).not.toMatch(/card_data|card_number|security_code/);
    expect(checkout).toContain('mp.fields.create("cardNumber"');
    expect(checkout).toContain('mp.fields.create("securityCode"');
  });

  it("requires an explicit Buyer Test User in sandbox", () => {
    expect(checkout).toContain("VITE_MP_TEST_PAYER_EMAIL");
    expect(checkout).toContain("payerIdentity.email ? { payer_email: payerIdentity.email } : {}");
    expect(gateway).toContain("MP_TEST_PAYER_EMAIL");
    expect(gateway).toContain("MP_TEST_SELLER_EMAILS");
    expect(gateway).toContain("return testBuyerEmail");
  });
});
