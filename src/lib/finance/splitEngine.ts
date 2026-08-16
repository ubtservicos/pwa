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
  ubt_pct:                number; // e.g.  5.000
  comunidade_pct:         number; // e.g.  2.000
  premio_trabalhador_pct: number; // e.g.  1.000
  premio_consumidor_pct:  number; // e.g.  1.000
  padrinho_pct:           number; // e.g.  1.000
}

export interface SplitAmounts {
  total_amount:        number;
  prestador_amount:    number; // Goes to the service provider
  ubt_amount:          number; // UBT platform cut
  comunidade_amount:   number; // Community social fund
  premio_trabalhador:  number; // Worker lottery pool
  premio_consumidor:   number; // Consumer loyalty pool
  padrinho_amount:     number; // Godparent referral (residual bucket)
  application_fee:     number; // Sum of all platform cuts (sent to Mercado Pago)
}

// ============================================================
// REGULATORY DEFAULTS (official PO rule — mirrors DB seed)
// Used as fallback when split_config cannot be read from the DB.
// ============================================================
export const REGULATORY_DEFAULTS: SplitConfig = {
  prestador_pct:          90.000,
  ubt_pct:                 5.000,
  comunidade_pct:          2.000,
  premio_trabalhador_pct:  1.000,
  premio_consumidor_pct:   1.000,
  padrinho_pct:            1.000,
};

// ============================================================
// SPLIT CALCULATOR
//
// Design:
//  - Rounds each bucket to 2 decimal places (BRL cent precision).
//  - The `padrinho_amount` is calculated as a residual subtraction
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

  const prestador_amount   = r(totalAmount * (config.prestador_pct          / 100));
  const ubt_amount         = r(totalAmount * (config.ubt_pct                / 100));
  const comunidade_amount  = r(totalAmount * (config.comunidade_pct         / 100));
  const premio_trabalhador = r(totalAmount * (config.premio_trabalhador_pct / 100));
  const premio_consumidor  = r(totalAmount * (config.premio_consumidor_pct  / 100));

  // Residual bucket: absorbs all floating-point drift
  const sumBeforePadrinho = r(
    prestador_amount + ubt_amount + comunidade_amount + premio_trabalhador + premio_consumidor
  );
  const padrinho_amount = r(Math.max(0, totalAmount - sumBeforePadrinho));

  // application_fee sent to Mercado Pago = everything except the prestador's share
  const application_fee = r(totalAmount - prestador_amount);

  return {
    total_amount:        totalAmount,
    prestador_amount,
    ubt_amount,
    comunidade_amount,
    premio_trabalhador,
    premio_consumidor,
    padrinho_amount,
    application_fee,
  };
}

// ============================================================
// VALIDATION HELPERS (used by Edge Function input validation)
// ============================================================

export function validateSplitConfig(config: SplitConfig): { valid: boolean; error?: string } {
  const sum = r2(
    config.prestador_pct +
    config.ubt_pct +
    config.comunidade_pct +
    config.premio_trabalhador_pct +
    config.premio_consumidor_pct +
    config.padrinho_pct
  );

  if (Math.abs(sum - 100) > 0.01) {
    return {
      valid: false,
      error: `Split percentages must sum to 100%, got ${sum}%`,
    };
  }
  return { valid: true };
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
