import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const provider = read("src/pages/PrestadorMototaxiActive.tsx");
const passenger = read("src/pages/MototaxiTomador.tsx");
const gateway = read("supabase/functions/payment-gateway/index.ts");
const webhook = read("supabase/functions/payment-webhook/index.ts");
const migration = read("supabase/migrations/20261014143000_mototaxi_provider_pix_charge.sql");
const qrImageMigration = read("supabase/migrations/20261014162000_mototaxi_pix_qr_image.sql");

describe("Mototaxi provider-created Pix contract", () => {
  it("makes the assigned provider the only Pix charge initiator", () => {
    expect(provider).toContain('action: "create_mototaxi_pix_charge"');
    expect(provider).toContain("Gerar Cobrança Pix");
    expect(provider).toContain("payment_attempt_id: ride.id");
    expect(passenger).not.toContain("Gerar Código Pix");
    expect(passenger).not.toContain('action: "create_payment_intent"');
  });

  it("validates provider, canonical ride amount and payer identity server-side", () => {
    expect(gateway).toContain('action === "create_mototaxi_pix_charge"');
    expect(gateway).toContain('ride.prestador_id !== customerId || providerId !== customerId');
    expect(gateway).toContain("canonicalAmount");
    expect(gateway).toMatch(/(?:supabaseAdmin|adminClient\(\))\.auth\.admin\.getUserById\(ride\.tomador_id\)/);
  });

  it("persists the Pix payload instead of relying on an ephemeral broadcast", () => {
    expect(migration).toContain("pix_copy_paste text");
    expect(migration).toContain("pix_payment_id text");
    expect(gateway).toContain("pix_copy_paste: pixCopyPaste");
    expect(passenger).toContain('.select("status, pix_copy_paste")');
    expect(provider).not.toContain('event: \'pix_qr_ready\'');
  });

  it("starts with no passenger method and restores the provider QR PNG", () => {
    expect(passenger).toContain("useState<PaymentMethodOption | null>(null)");
    expect(qrImageMigration).toContain("pix_qr_code_base64 text");
    expect(gateway).toContain("pix_qr_code_base64: pixQrCodeBase64 || null");
    expect(provider).toContain("data:image/png;base64,${pixQrBase64}");
    expect(provider).toContain("pix_qr_code_base64");
  });

  it("uses stable Realtime subscriptions and the webhook remains authoritative", () => {
    expect(passenger).toContain("tomador_payment_${rideId}");
    expect(provider).toContain("active_ride_${ride.id}");
    expect(passenger).toContain("<FullscreenConfetti");
    expect(provider).toContain("<FullscreenConfetti");
    expect(webhook).toContain('pix_charge_status: "approved"');
    expect(webhook).toContain('status: "paid"');
  });
});
