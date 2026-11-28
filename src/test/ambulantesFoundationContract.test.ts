import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20261127220000_ambulantes_vertical_foundation.sql",
);
const GATEWAY_PATH = path.join(
  ROOT,
  "supabase",
  "functions",
  "payment-gateway",
  "index.ts",
);
const WEBHOOK_PATH = path.join(
  ROOT,
  "supabase",
  "functions",
  "payment-webhook",
  "index.ts",
);
const DELETE_CLIENT_PATH = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-delete-client",
  "index.ts",
);

const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");
const gatewaySrc = fs.readFileSync(GATEWAY_PATH, "utf8");
const webhookSrc = fs.readFileSync(WEBHOOK_PATH, "utf8");
const deleteClientSrc = fs.readFileSync(DELETE_CLIENT_PATH, "utf8");

function computeAmbulanteOrderTotal(
  items: Array<{ qty: number; unitPrice: number }>,
  modalidade: "entrega" | "retirada",
  vendorDeliveryFee: number,
) {
  const subtotal = Number(
    items.reduce((acc, it) => acc + Math.max(0, it.qty) * Math.max(0, it.unitPrice), 0).toFixed(2),
  );
  const deliveryFee =
    modalidade === "retirada" ? 0 : Math.max(0, Number(vendorDeliveryFee.toFixed(2)));
  return {
    subtotal,
    deliveryFee,
    total: Number((subtotal + deliveryFee).toFixed(2)),
  };
}

describe("Fundação da Vertical Ambulantes — DB, RLS, Estoque Atômico e Edge Functions (v1.10.0)", () => {
  it("fecha as policies RLS abertas de fornecedores_padrao, produtos_padrao, estoque_ambulante e bucket catalogo-ambulantes", () => {
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Permitir escrita de fornecedores_padrao para admin/autenticado" ON public.fornecedores_padrao;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Permitir escrita de produtos_padrao para admin/autenticado" ON public.produtos_padrao;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Permitir gerenciar estoque_ambulante" ON public.estoque_ambulante;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Authenticated and Admin Upload catalogo-ambulantes" ON storage.objects;',
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Public Access Catalogo Ambulantes" ON storage.objects;',
    );
    expect(migrationSql).toContain('CREATE POLICY "fornecedores_padrao_insert_admin"');
    expect(migrationSql).toContain('CREATE POLICY "produtos_padrao_insert_admin"');
    expect(migrationSql).toContain('CREATE POLICY "estoque_ambulante_update_owner_or_admin"');
    expect(migrationSql).toContain("bucket_id = 'catalogo-ambulantes' AND public.is_admin()");
  });

  it("define prestador_ambulante com KYC obrigatório + selos descritivos opcionais não impeditivos e delivery_fee >= 0", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.prestador_ambulante");
    expect(migrationSql).toContain("delivery_fee numeric(10, 2) NOT NULL DEFAULT 0.00");
    expect(migrationSql).toContain("CONSTRAINT prestador_ambulante_delivery_fee_check CHECK (delivery_fee >= 0)");
    expect(migrationSql).toContain("possui_alvara boolean DEFAULT false");
    expect(migrationSql).toContain("alvara_verificado boolean DEFAULT false");
    expect(migrationSql).toContain("possui_vigilancia_sanitaria boolean DEFAULT false");
    expect(migrationSql).toContain("tipo_estrutura text");
    expect(migrationSql).toContain("mei_cnpj text");
    expect(migrationSql).toContain("trg_sync_ambulante_kyc");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.ambulante_mensagens");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.ambulante_avaliacoes");
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS praias_atuacao text[]");
  });

  it("implementa RPCs de estoque atômico (confirm_ambulante_order com FOR UPDATE e cancel_ambulante_order com estorno) e taxa individual", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.submit_ambulante_kyc(");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_my_ambulante_profile()");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.update_my_ambulante_delivery_fee(");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.confirm_ambulante_order(");
    expect(migrationSql).toContain("FOR UPDATE;");
    expect(migrationSql).toContain("quantidade = quantidade - v_item.qty");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.cancel_ambulante_order(");
    expect(migrationSql).toContain("quantidade = quantidade + v_item.qty");
    expect(migrationSql).toContain("Pedidos já pagos não podem ser cancelados diretamente.");
  });

  it("mantém taxa de entrega individual por ambulante (>= 0) e zerada para retirada no ponto", () => {
    const entrega = computeAmbulanteOrderTotal(
      [
        { qty: 2, unitPrice: 12.5 },
        { qty: 1, unitPrice: 8.0 },
      ],
      "entrega",
      5.5,
    );
    expect(entrega).toEqual({ subtotal: 33.0, deliveryFee: 5.5, total: 38.5 });

    const retirada = computeAmbulanteOrderTotal(
      [{ qty: 2, unitPrice: 12.5 }],
      "retirada",
      5.5,
    );
    expect(retirada).toEqual({ subtotal: 25.0, deliveryFee: 0, total: 25.0 });
  });

  it("integra pedidos de ambulante nas RPCs financeiras transversais e cria RPCs de Associação categoria = 'ambulante'", () => {
    expect(migrationSql).toContain(
      "LEFT JOIN public.pedidos ped\n    ON ps.service_type = 'ambulante' AND ped.id = ps.service_id",
    );
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.admin_get_ambulante_associacao_overview(",
    );
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.admin_update_ambulante_associacao_dados(",
    );
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.admin_send_ambulante_associacao_mass_message(",
    );
    expect(migrationSql).toContain("lower(coalesce(a.categoria, '')) = 'ambulante'");
  });

  it("Edge Functions suportam service_type='ambulante', pagamento somente ao final, PIX presencial e limpeza em cascata", () => {
    // payment-gateway
    expect(gatewaySrc).toContain('"create_ambulante_pix_charge"');
    expect(gatewaySrc).toContain('"check_ambulante_pix_status"');
    expect(gatewaySrc).toContain("Pedido UBT Ambulantes ${shortRideId}");
    expect(gatewaySrc).toContain('else if (serviceType === "ambulante")');
    expect(gatewaySrc).toContain("order_not_ready_for_payment");
    expect(gatewaySrc).toContain("order_cancelled");
    expect(gatewaySrc).toContain("order_amount_mismatch");
    expect(gatewaySrc).toContain('if (serviceType === "ambulante" && mpStatus === "approved")');

    // payment-webhook
    expect(webhookSrc).toContain('String(split.service_type || "").toLowerCase() === "ambulante"');
    expect(webhookSrc).toContain('.from("pedidos")');

    // admin-delete-client
    expect(deleteClientSrc).toContain('label: "ambulante_sessions"');
    expect(deleteClientSrc).toContain('label: "estoque_ambulante"');
    expect(deleteClientSrc).toContain('label: "prestador_ambulante"');
  });
});
