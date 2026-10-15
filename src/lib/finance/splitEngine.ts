/**
 * UBT Finance — Split Engine (Pure Business Logic)
 *
 * This module is intentionally framework-agnostic (no Deno, no fetch, no Supabase).
 * It is the source of truth for all split calculations and can be imported
 * by both the Vitest test suite and the Deno Edge Function (payment-gateway).
 *
 * Rules sourced from public.split_config (id = 1).
 */

// ============================================================
// TYPES
// ============================================================

export interface SplitConfig {
  prestador_pct:          number; // e.g. 90.000
  ubt_pct:                number; // e.g.  7.500
  comunidade_pct:         number; // e.g.  0.500
  premio_trabalhador_pct: number; // e.g.  0.500
  premio_consumidor_pct:  number; // e.g.  0.500
  padrinho_tomador_pct:   number; // e.g.  0.500
  padrinho_prestador_pct: number; // e.g.  0.500
  padrinho_pct?:          number; // deprecated backwards-compat
}

export interface SplitAmounts {
  total_amount:              number;
  prestador_amount:          number; // Goes to the service provider (90%)
  ubt_amount:                number; // UBT platform cut (7.5%)
  comunidade_amount:         number; // Community social fund (0.5%)
  premio_trabalhador:        number; // Worker lottery pool (0.5%)
  premio_consumidor:         number; // Consumer loyalty pool (0.5%)
  padrinho_tomador_amount:   number; // Godparent tomador referral (0.5% - residual bucket)
  padrinho_prestador_amount: number; // Godparent prestador referral (0.5%)
  padrinho_amount?:          number; // Deprecated alias (= tomador + prestador)
  application_fee:           number; // Sum of all platform cuts (sent to Mercado Pago)
}

// ============================================================
// REGULATORY DEFAULTS (official PO rule — mirrors DB seed)
// Used as fallback when split_config cannot be read from the DB.
// ============================================================
export const REGULATORY_DEFAULTS: SplitConfig = {
  prestador_pct:          90.000,
  ubt_pct:                 7.500,
  comunidade_pct:          0.500,
  premio_trabalhador_pct:  0.500,
  premio_consumidor_pct:   0.500,
  padrinho_tomador_pct:    0.500,
  padrinho_prestador_pct:  0.500,
};

// ============================================================
// SPLIT CALCULATOR
//
// Design:
//  - Rounds each bucket to 2 decimal places (BRL cent precision).
//  - The `padrinho_tomador_amount` is calculated as a residual subtraction
//    to guarantee: Σ(all buckets) === total_amount, exactly.
//    This eliminates any floating-point drift from sequential rounding.
//  - application_fee = total_amount - prestador_amount
//    (the amount the marketplace withholds, sent to Mercado Pago)
// ============================================================
export function calculateSplitAmounts(
  totalAmount: number,
  config: SplitConfig = REGULATORY_DEFAULTS
): SplitAmounts {
  if (totalAmount <= 0) {
    throw new RangeError(`calculateSplitAmounts: totalAmount must be > 0, got ${totalAmount}`);
  }

  const r = (v: number): number => Math.round(v * 100) / 100;

  const prestador_pct = config.prestador_pct ?? 90.0;
  const ubt_pct = config.ubt_pct ?? 7.5;
  const comunidade_pct = config.comunidade_pct ?? 0.5;
  const premio_trabalhador_pct = config.premio_trabalhador_pct ?? 0.5;
  const premio_consumidor_pct = config.premio_consumidor_pct ?? 0.5;
  const padrinho_tomador_pct = config.padrinho_tomador_pct ?? (config.padrinho_pct ? config.padrinho_pct / 2 : 0.5);
  const padrinho_prestador_pct = config.padrinho_prestador_pct ?? (config.padrinho_pct ? config.padrinho_pct / 2 : 0.5);

  const prestador_amount          = r(totalAmount * (prestador_pct          / 100));
  const ubt_amount                = r(totalAmount * (ubt_pct                / 100));
  const comunidade_amount         = r(totalAmount * (comunidade_pct         / 100));
  const premio_trabalhador        = r(totalAmount * (premio_trabalhador_pct / 100));
  const premio_consumidor         = r(totalAmount * (premio_consumidor_pct  / 100));
  const padrinho_prestador_amount = r(totalAmount * (padrinho_prestador_pct / 100));

  // Residual bucket: absorbs all floating-point drift
  const sumBeforeResidual = r(
    prestador_amount + ubt_amount + comunidade_amount + premio_trabalhador + premio_consumidor + padrinho_prestador_amount
  );
  const padrinho_tomador_amount = r(Math.max(0, totalAmount - sumBeforeResidual));

  // application_fee sent to Mercado Pago = everything except the prestador's share
  const application_fee = r(totalAmount - prestador_amount);

  return {
    total_amount:              totalAmount,
    prestador_amount,
    ubt_amount,
    comunidade_amount,
    premio_trabalhador,
    premio_consumidor,
    padrinho_tomador_amount,
    padrinho_prestador_amount,
    padrinho_amount:           r(padrinho_tomador_amount + padrinho_prestador_amount),
    application_fee,
  };
}

// ============================================================
// VALIDATION HELPERS (used by Edge Function input validation)
// ============================================================

export function validateSplitConfig(config: SplitConfig): { valid: boolean; error?: string } {
  const sum =
    config.prestador_pct +
    config.ubt_pct +
    config.comunidade_pct +
    config.premio_trabalhador_pct +
    config.premio_consumidor_pct +
    (config.padrinho_tomador_pct ?? 0) +
    (config.padrinho_prestador_pct ?? 0);

  // Floating-point equality with epsilon tolerance
  if (Math.abs(sum - 100.0) > 0.001) {
    return {
      valid: false,
      error: `Split percentages must sum to 100.000%, got ${sum.toFixed(3)}%`,
    };
  }

  const values = Object.values(config).filter(v => typeof v === 'number');
  if (values.some((v) => v < 0 || v > 100)) {
    return {
      valid: false,
      error: "All split percentages must be between 0.000 and 100.000%",
    };
  }

  return { valid: true };
}

// ============================================================
// NOMINAL 7-WAY LEDGER RESOLVER (UBT 7 Destinos)
// ============================================================

export interface NominalSplitEntry {
  destination_index: number;
  category: "prestador" | "ubt" | "padrinho_prestador" | "padrinho_tomador" | "associacao" | "premio_trabalhador" | "premio_consumidor";
  name: string;
  wallet_identifier: string;
  percentage: number;
  amount: number;
}

export interface Nominal7WayLedger {
  total_amount: number;
  entries: NominalSplitEntry[];
  formatted_summary: string;
}

export function buildNominal7WayLedger({
  totalAmount,
  providerName = "Prestador UBT",
  providerId = "0a5edf64-7585-401f-b310-126529607da0",
  associationName,
  associationId,
  godparentPrestadorName,
  godparentPrestadorId,
  godparentTomadorName,
  godparentTomadorId,
  config = REGULATORY_DEFAULTS,
}: {
  totalAmount: number;
  providerName?: string;
  providerId?: string;
  associationName?: string | null;
  associationId?: string | null;
  godparentPrestadorName?: string | null;
  godparentPrestadorId?: string | null;
  godparentTomadorName?: string | null;
  godparentTomadorId?: string | null;
  config?: SplitConfig;
}): Nominal7WayLedger {
  const split = calculateSplitAmounts(totalAmount, config);

  const resolvedAssocName = associationName || "caixinha-mototaxista-sem-associação";
  const resolvedAssocId = associationId || "caixinha-mototaxista-sem-associação";

  const resolvedGodparentPrestadorName = godparentPrestadorName || (godparentPrestadorId ? `Padrinho (${godparentPrestadorId.substring(0, 8)})` : "ubt-fundo-reserva-prestador");
  const resolvedGodparentPrestadorId = godparentPrestadorId || "ubt-fundo-reserva-prestador";

  const resolvedGodparentTomadorName = godparentTomadorName || (godparentTomadorId ? `Padrinho (${godparentTomadorId.substring(0, 8)})` : "ubt-fundo-reserva-tomador");
  const resolvedGodparentTomadorId = godparentTomadorId || "ubt-fundo-reserva-tomador";

  const entries: NominalSplitEntry[] = [
    {
      destination_index: 1,
      category: "prestador",
      name: `Prestador (${providerName})`,
      wallet_identifier: providerId,
      percentage: config.prestador_pct,
      amount: split.prestador_amount,
    },
    {
      destination_index: 2,
      category: "ubt",
      name: "Plataforma UBT (Taxa da Casa)",
      wallet_identifier: "ubt-platform-treasury",
      percentage: config.ubt_pct,
      amount: split.ubt_amount,
    },
    {
      destination_index: 3,
      category: "padrinho_prestador",
      name: `Padrinho Prestador (${resolvedGodparentPrestadorName})`,
      wallet_identifier: resolvedGodparentPrestadorId,
      percentage: config.padrinho_prestador_pct,
      amount: split.padrinho_prestador_amount,
    },
    {
      destination_index: 4,
      category: "padrinho_tomador",
      name: `Padrinho Tomador (${resolvedGodparentTomadorName})`,
      wallet_identifier: resolvedGodparentTomadorId,
      percentage: config.padrinho_tomador_pct,
      amount: split.padrinho_tomador_amount,
    },
    {
      destination_index: 5,
      category: "associacao",
      name: `Associação / Fundo Social (${resolvedAssocName})`,
      wallet_identifier: resolvedAssocId,
      percentage: config.comunidade_pct,
      amount: split.comunidade_amount,
    },
    {
      destination_index: 6,
      category: "premio_trabalhador",
      name: "Fundo Prêmio-Trabalhador",
      wallet_identifier: "premio-trabalhador-2026",
      percentage: config.premio_trabalhador_pct,
      amount: split.premio_trabalhador,
    },
    {
      destination_index: 7,
      category: "premio_consumidor",
      name: "Fundo Prêmio-Consumidor",
      wallet_identifier: "premio-consumidor-2026",
      percentage: config.premio_consumidor_pct,
      amount: split.premio_consumidor,
    },
  ];

  const lines = [
    `========================================================================`,
    `💰 EXTRATO NOMINAL DE REPASSE — MOTOR DE SPLIT UBT (7 VIAS)`,
    `Total da Corrida: R$ ${totalAmount.toFixed(2)}`,
    `------------------------------------------------------------------------`,
    ...entries.map(
      (e) =>
        `${e.destination_index}. ${e.name.padEnd(52, " ")} R$ ${e.amount.toFixed(2).padStart(6, " ")} (${e.percentage.toFixed(1)}%)`
    ),
    `------------------------------------------------------------------------`,
    `SOMA TOTAL DAS 7 VIAS:                              R$ ${entries.reduce((a, b) => a + b.amount, 0).toFixed(2).padStart(6, " ")} (100.0%)`,
    `========================================================================`,
  ];

  return {
    total_amount: totalAmount,
    entries,
    formatted_summary: lines.join("\n"),
  };
}

