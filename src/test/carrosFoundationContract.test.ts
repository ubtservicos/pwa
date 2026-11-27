import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateSplitAmounts, REGULATORY_DEFAULTS } from "../lib/finance/splitEngine";

const ROOT = path.resolve(__dirname, "../..");

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Carros Vertical — Fase 1 Foundation Contract (v1.9.0)", () => {
  const migrationSql = readRepoFile("supabase/migrations/20261127190000_carros_vertical_foundation.sql");
  const paymentGateway = readRepoFile("supabase/functions/payment-gateway/index.ts");
  const paymentWebhook = readRepoFile("supabase/functions/payment-webhook/index.ts");
  const checkoutFn = readRepoFile("supabase/functions/checkout/index.ts");
  const adminDeleteClient = readRepoFile("supabase/functions/admin-delete-client/index.ts");

  it("cria as 5 tabelas isoladas da vertical Carros com RLS e Realtime", () => {
    for (const table of [
      "carro_corridas",
      "prestador_carro",
      "carro_sessoes",
      "carro_pricing_config",
      "carro_mensagens",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }

    expect(migrationSql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_corridas");
    expect(migrationSql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_sessoes");
    expect(migrationSql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.carro_mensagens");
  });

  it("define atributos descritivos não impeditivos em prestador_carro e seed independente de carro_pricing_config", () => {
    for (const col of [
      "vehicle_subtype text NOT NULL DEFAULT 'padrao'",
      "cor text",
      "ano integer",
      "portas integer",
      "ar_condicionado boolean DEFAULT false",
      "cnh_categoria text",
      "possui_ear boolean DEFAULT false",
      "alvara_municipal text",
      "carro_interno_photo_url text",
    ]) {
      expect(migrationSql).toContain(col);
    }

    expect(migrationSql).toContain(`subtype_multipliers jsonb NOT NULL DEFAULT '{"padrao": 1.0}'::jsonb`);
    expect(migrationSql).toContain("INSERT INTO public.carro_pricing_config");
    expect(migrationSql).toContain("LEFT JOIN public.mototaxi_pricing_config m ON m.id = 'default'");
    expect(migrationSql).toContain("WHERE NOT EXISTS (SELECT 1 FROM public.carro_pricing_config WHERE id = 'default')");
  });

  it("instala triggers antifraude/analytics/KYC de Carros sem violar FK de telemetry_flags", () => {
    for (const trigger of [
      "evaluate_carro_ghost_ride_trigger",
      "trigger_carro_analytics",
      "trigger_carro_fraud_check",
      "on_carro_updated",
      "trg_sync_carro_kyc",
    ]) {
      expect(migrationSql).toContain(trigger);
    }

    expect(migrationSql).toContain("INSERT INTO public.operational_flags");
    expect(migrationSql).not.toContain("INSERT INTO public.telemetry_flags");
  });

  it("expande pagamentos_split para 'carro' e mantém compatibilidade integral com Mototáxi nas RPCs financeiras", () => {
    expect(migrationSql).toContain("pagamentos_split_service_type_check");
    expect(migrationSql).toContain("'mototaxi'::text, 'carro'::text, 'diarista'::text, 'ambulante'::text, 'coco'::text");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_user_payment_history()");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.admin_list_financial_transactions()");
    expect(migrationSql).toContain("LEFT JOIN public.mototaxi_corridas mc");
    expect(migrationSql).toContain("LEFT JOIN public.carro_corridas cc");
    expect(migrationSql).toContain("IF NOT public.is_admin() THEN");
    expect(migrationSql).toContain("'superadmin'");
  });

  it("cria todas as RPCs SECURITY DEFINER de Carros (KYC, Perfil, Tarifas, Escopo e Associações)", () => {
    for (const rpc of [
      "CREATE OR REPLACE FUNCTION public.submit_carro_kyc(",
      "CREATE OR REPLACE FUNCTION public.get_my_carro_profile()",
      "CREATE OR REPLACE FUNCTION public.admin_update_carro_pricing_config(",
      "CREATE OR REPLACE FUNCTION public._resolve_caller_assoc_context()",
      "CREATE OR REPLACE FUNCTION public.get_my_association_scope()",
      "CREATE OR REPLACE FUNCTION public.admin_get_carro_associacao_overview(",
      "CREATE OR REPLACE FUNCTION public.admin_update_carro_associacao_dados(",
      "CREATE OR REPLACE FUNCTION public.admin_send_carro_associacao_mass_message(",
    ]) {
      expect(migrationSql).toContain(rpc);
    }

    expect(migrationSql).toContain("lower(coalesce(a.categoria, '')) = 'carro'");
    expect(migrationSql).toContain("to_jsonb(m)->>'association_id'");
  });

  it("parametriza as 4 Edge Functions para suportar Carros com zero regressão em Mototáxi", () => {
    // payment-gateway
    expect(paymentGateway).toContain('"mototaxi" | "carro"');
    expect(paymentGateway).toContain('mototaxi: "mototaxi_corridas"');
    expect(paymentGateway).toContain('carro: "carro_corridas"');
    expect(paymentGateway).toContain('"create_mototaxi_pix_charge"');
    expect(paymentGateway).toContain('"create_carro_pix_charge"');
    expect(paymentGateway).toContain('"create_ride_pix_charge"');
    expect(paymentGateway).toContain('"check_mototaxi_pix_status"');
    expect(paymentGateway).toContain('"check_carro_pix_status"');
    expect(paymentGateway).toContain('"check_ride_pix_status"');
    expect(paymentGateway).toContain('"verify_pix_payment"');

    // payment-webhook
    expect(paymentWebhook).toContain('mototaxi: "mototaxi_corridas"');
    expect(paymentWebhook).toContain('carro: "carro_corridas"');

    // checkout
    expect(checkoutFn).toContain('mototaxi: "mototaxi_corridas"');
    expect(checkoutFn).toContain('carro: "carro_corridas"');

    // admin-delete-client
    expect(adminDeleteClient).toContain('label: "carro_sessoes"');
    expect(adminDeleteClient).toContain('label: "prestador_carro"');
    expect(adminDeleteClient).toContain('label: "mototaxi_sessoes"');
    expect(adminDeleteClient).toContain('label: "prestador_mototaxi"');
  });

  it("preserva o cálculo de split canônico 90/10 para corridas de Carros", () => {
    const split = calculateSplitAmounts(40.0, REGULATORY_DEFAULTS);
    expect(split.total_amount).toBe(40.0);
    expect(split.prestador_amount).toBe(36.0);
    expect(split.application_fee).toBe(4.0);
    expect(split.ubt_amount).toBe(3.0);
    expect(split.comunidade_amount).toBe(0.2);
    expect(split.premio_trabalhador).toBe(0.2);
    expect(split.premio_consumidor).toBe(0.2);
    expect(split.padrinho_tomador_amount).toBe(0.2);
    expect(split.padrinho_prestador_amount).toBe(0.2);
  });
});
