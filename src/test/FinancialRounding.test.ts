import { describe, it, expect } from "vitest";

// Port of the checkout Edge Function rounding logic for test validation
function calculateSplits(amount: number, config: {
  prestador: number;
  ubt: number;
  comunidade: number;
  premioTrabalhador: number;
  premioConsumidor: number;
  padrinho: number;
}) {
  const pPct = config.prestador / 100;
  const uPct = config.ubt / 100;
  const cPct = config.comunidade / 100;
  const tPct = config.premioTrabalhador / 100;
  const oPct = config.premioConsumidor / 100;
  const gPct = config.padrinho / 100;

  const amountCents = Math.round(amount * 100);
  const centsProvider = Math.round(amountCents * pPct);
  const centsUbt = Math.round(amountCents * uPct);
  const centsComunidade = Math.round(amountCents * cPct);
  const centsTrab = Math.round(amountCents * tPct);
  const centsCons = Math.round(amountCents * oPct);
  const centsPadrinho = Math.round(amountCents * gPct);

  const sumCents = centsProvider + centsUbt + centsComunidade + centsTrab + centsCons + centsPadrinho;
  const diffCents = amountCents - sumCents;

  const finalProviderCents = centsProvider + diffCents;

  return {
    provider: Number((finalProviderCents / 100).toFixed(2)),
    ubt: Number((centsUbt / 100).toFixed(2)),
    comunidade: Number((centsComunidade / 100).toFixed(2)),
    prize_worker: Number((centsTrab / 100).toFixed(2)),
    prize_consumer: Number((centsCons / 100).toFixed(2)),
    godparent: Number((centsPadrinho / 100).toFixed(2)),
  };
}

describe("Financial Rounding & Cents Reconciliation", () => {
  const officialConfig = {
    prestador: 90,
    ubt: 5,
    comunidade: 2,
    premioTrabalhador: 1,
    premioConsumidor: 1,
    padrinho: 1,
  };

  it("should split R$ 100.00 exactly with no residual cents", () => {
    const splits = calculateSplits(100.00, officialConfig);
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);
    
    expect(splits.provider).toBe(90.00);
    expect(splits.ubt).toBe(5.00);
    expect(splits.comunidade).toBe(2.00);
    expect(splits.prize_worker).toBe(1.00);
    expect(splits.prize_consumer).toBe(1.00);
    expect(splits.godparent).toBe(1.00);
    expect(Number(sum.toFixed(2))).toBe(100.00);
  });

  it("should split R$ 13.37 adjusting the residual 1 cent to the provider", () => {
    const splits = calculateSplits(13.37, officialConfig);
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);

    // Sum without adjustment: 12.03 + 0.67 + 0.27 + 0.13 + 0.13 + 0.13 = 13.36
    // Difference is +1 cent, allocated to provider: 12.03 + 0.01 = 12.04
    expect(splits.provider).toBe(12.04);
    expect(splits.ubt).toBe(0.67);
    expect(splits.comunidade).toBe(0.27);
    expect(splits.prize_worker).toBe(0.13);
    expect(splits.prize_consumer).toBe(0.13);
    expect(splits.godparent).toBe(0.13);
    expect(Number(sum.toFixed(2))).toBe(13.37);
  });

  it("should split R$ 10.01 precisely", () => {
    const splits = calculateSplits(10.01, officialConfig);
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);

    expect(splits.provider).toBe(9.01);
    expect(splits.ubt).toBe(0.50);
    expect(splits.comunidade).toBe(0.20);
    expect(splits.prize_worker).toBe(0.10);
    expect(splits.prize_consumer).toBe(0.10);
    expect(splits.godparent).toBe(0.10);
    expect(Number(sum.toFixed(2))).toBe(10.01);
  });

  it("should handle R$ 0.01 without creating money out of thin air", () => {
    const splits = calculateSplits(0.01, officialConfig);
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);

    expect(splits.provider).toBe(0.01);
    expect(splits.ubt).toBe(0.00);
    expect(splits.comunidade).toBe(0.00);
    expect(splits.prize_worker).toBe(0.00);
    expect(splits.prize_consumer).toBe(0.00);
    expect(splits.godparent).toBe(0.00);
    expect(Number(sum.toFixed(2))).toBe(0.01);
  });
});
