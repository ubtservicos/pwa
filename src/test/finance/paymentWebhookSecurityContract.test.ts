import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webhook = readFileSync(
  resolve(process.cwd(), "supabase/functions/payment-webhook/index.ts"),
  "utf8",
);

describe("payment-webhook sandbox QA bypass security contract", () => {
  it("gates the bypass on the server-side sandbox environment", () => {
    expect(webhook).toContain('environment !== "sandbox"');
    expect(webhook).toContain("QA webhook bypass is forbidden outside sandbox.");
    expect(webhook).not.toContain("VITE_MP_ENVIRONMENT");
  });

  it("requires a dedicated secret and compares it in constant time", () => {
    expect(webhook).toContain('Deno.env.get("MP_QA_WEBHOOK_BYPASS_TOKEN")');
    expect(webhook).toContain("expectedQaToken.length < 32");
    expect(webhook).toContain("constantTimeSecretMatch");
    expect(webhook).not.toContain("sandbox-only signature bypass");
  });

  it("requires an explicit approval override and preserves canonical MP verification", () => {
    expect(webhook).toContain('req.headers.get("x-qa-force-status")');
    expect(webhook).toContain("fetchMPPaymentStatus(paymentId)");
    expect(webhook).toContain("actual_mp_status: actualStatus");
    expect(webhook).toContain("qa_simulated: qaForceApproved");
  });

  it("verifies seller split payments with the same OAuth account that created them", () => {
    expect(webhook).toContain('.eq("gateway_payment_id", String(paymentId))');
    expect(webhook).toContain('split.payment_route !== "seller_oauth_split"');
    expect(webhook).toContain('Deno.env.get("MP_TOKEN_ENCRYPTION_KEY")');
    expect(webhook).toContain('decryptSellerToken(account.access_token_encrypted, environment)');
  });
});
