/**
 * CENÁRIO A — Split Engine: Unit Tests
 *
 * Tests the pure calculateSplitAmounts() function with no external dependencies.
 * Validates: correct distribution, cent-precision, residual bucket integrity,
 * application_fee calculation, and config validation.
 */

import { describe, it, expect } from "vitest";
import {
  calculateSplitAmounts,
  buildNominal7WayLedger,
  validateSplitConfig,
  REGULATORY_DEFAULTS,
  type SplitConfig,
} from "../../lib/finance/splitEngine";

describe("UBT Finance — Split Engine (Pure Unit Tests)", () => {

  // ---- A1: Standard split with regulatory defaults ----
  describe("A1 · calculateSplitAmounts() with regulatory defaults (R$100)", () => {
    const split = calculateSplitAmounts(100.00);

    it("total_amount equals the input exactly", () => {
      expect(split.total_amount).toBe(100.00);
    });

    it("prestador receives 90% = R$90.00", () => {
      expect(split.prestador_amount).toBe(90.00);
    });

    it("UBT receives 7.5% = R$7.50", () => {
      expect(split.ubt_amount).toBe(7.50);
    });

    it("comunidade receives 0.5% = R$0.50", () => {
      expect(split.comunidade_amount).toBe(0.50);
    });

    it("prize_trabalhador receives 0.5% = R$0.50", () => {
      expect(split.premio_trabalhador).toBe(0.50);
    });

    it("prize_consumidor receives 0.5% = R$0.50", () => {
      expect(split.premio_consumidor).toBe(0.50);
    });

    it("padrinho_prestador receives 0.5% = R$0.50", () => {
      expect(split.padrinho_prestador_amount).toBe(0.50);
    });

    it("padrinho_tomador (residual bucket) receives 0.5% = R$0.50", () => {
      expect(split.padrinho_tomador_amount).toBe(0.50);
    });

    it("padrinho_amount alias equals sum = R$1.00", () => {
      expect(split.padrinho_amount).toBe(1.00);
    });

    it("application_fee = total - prestador = R$10.00", () => {
      expect(split.application_fee).toBe(10.00);
    });

    it("Σ(all buckets) === total_amount (zero drift guarantee)", () => {
      const sum =
        split.prestador_amount +
        split.ubt_amount +
        split.comunidade_amount +
        split.premio_trabalhador +
        split.premio_consumidor +
        split.padrinho_prestador_amount +
        split.padrinho_tomador_amount;
      expect(sum).toBeCloseTo(split.total_amount, 2);
    });

    it("application_fee + prestador_amount === total_amount", () => {
      expect(split.application_fee + split.prestador_amount).toBeCloseTo(split.total_amount, 2);
    });
  });

  // ---- A2: Non-round amounts (cent precision) ----
  describe("A2 · calculateSplitAmounts() with non-round amount (R$33.33)", () => {
    const split = calculateSplitAmounts(33.33);

    it("prestador receives 90% with cent precision", () => {
      expect(split.prestador_amount).toBe(Math.round(33.33 * 0.90 * 100) / 100);
    });

    it("Σ(all buckets) === R$33.33 (residual bucket absorbs drift)", () => {
      const sum =
        split.prestador_amount +
        split.ubt_amount +
        split.comunidade_amount +
        split.premio_trabalhador +
        split.premio_consumidor +
        split.padrinho_prestador_amount +
        split.padrinho_tomador_amount;
      expect(sum).toBeCloseTo(33.33, 2);
    });

    it("no bucket is negative", () => {
      expect(split.prestador_amount).toBeGreaterThan(0);
      expect(split.ubt_amount).toBeGreaterThanOrEqual(0);
      expect(split.comunidade_amount).toBeGreaterThanOrEqual(0);
      expect(split.padrinho_prestador_amount).toBeGreaterThanOrEqual(0);
      expect(split.padrinho_tomador_amount).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- A2b: Micro/Low-value amounts (R$1.35 / R$1.36 — regression test for cent overflow) ----
  describe("A2b · calculateSplitAmounts() with low amounts (R$1.35 & R$1.36)", () => {
    for (const amount of [1.35, 1.36, 1.00, 0.50]) {
      it(`closes exactly at 100% with zero negative buckets for R$${amount.toFixed(2)}`, () => {
        const split = calculateSplitAmounts(amount);
        const sum =
          split.prestador_amount +
          split.ubt_amount +
          split.comunidade_amount +
          split.premio_trabalhador +
          split.premio_consumidor +
          split.padrinho_prestador_amount +
          split.padrinho_tomador_amount;

        expect(Math.round(sum * 100)).toBe(Math.round(amount * 100));
        expect(split.prestador_amount).toBeGreaterThanOrEqual(0);
        expect(split.ubt_amount).toBeGreaterThanOrEqual(0);
        expect(split.comunidade_amount).toBeGreaterThanOrEqual(0);
        expect(split.premio_trabalhador).toBeGreaterThanOrEqual(0);
        expect(split.premio_consumidor).toBeGreaterThanOrEqual(0);
        expect(split.padrinho_prestador_amount).toBeGreaterThanOrEqual(0);
        expect(split.padrinho_tomador_amount).toBeGreaterThanOrEqual(0);
        expect(Math.round((split.prestador_amount + split.application_fee) * 100)).toBe(Math.round(amount * 100));
      });
    }
  });

  // ---- A3: High-value transaction (R$1500.00) ----
  describe("A3 · calculateSplitAmounts() with large amount (R$1500.00)", () => {
    const split = calculateSplitAmounts(1500.00);

    it("prestador receives R$1350.00", () => {
      expect(split.prestador_amount).toBe(1350.00);
    });

    it("application_fee = R$150.00", () => {
      expect(split.application_fee).toBe(150.00);
    });

    it("ubt receives R$112.50", () => {
      expect(split.ubt_amount).toBe(112.50);
    });

    it("Σ(all buckets) === R$1500.00", () => {
      const sum =
        split.prestador_amount +
        split.ubt_amount +
        split.comunidade_amount +
        split.premio_trabalhador +
        split.premio_consumidor +
        split.padrinho_prestador_amount +
        split.padrinho_tomador_amount;
      expect(sum).toBeCloseTo(1500.00, 2);
    });
  });

  // ---- A4: Custom config (different percentages) ----
  describe("A4 · calculateSplitAmounts() with custom config", () => {
    const customConfig: SplitConfig = {
      prestador_pct:          80.000,
      ubt_pct:                10.000,
      comunidade_pct:          5.000,
      premio_trabalhador_pct:  2.000,
      premio_consumidor_pct:   2.000,
      padrinho_tomador_pct:    0.500,
      padrinho_prestador_pct:  0.500,
    };
    const split = calculateSplitAmounts(100.00, customConfig);

    it("prestador receives 80% = R$80.00", () => {
      expect(split.prestador_amount).toBe(80.00);
    });

    it("application_fee = R$20.00", () => {
      expect(split.application_fee).toBe(20.00);
    });

    it("Σ still equals total with custom config", () => {
      const sum =
        split.prestador_amount +
        split.ubt_amount +
        split.comunidade_amount +
        split.premio_trabalhador +
        split.premio_consumidor +
        split.padrinho_prestador_amount +
        split.padrinho_tomador_amount;
      expect(sum).toBeCloseTo(100.00, 2);
    });
  });

  // ---- A5: Guard rails ----
  describe("A5 · Input guards", () => {
    it("throws RangeError for zero amount", () => {
      expect(() => calculateSplitAmounts(0)).toThrow(RangeError);
    });

    it("throws RangeError for negative amount", () => {
      expect(() => calculateSplitAmounts(-50)).toThrow(RangeError);
    });
  });

  // ---- A6: Config validation ----
  describe("A6 · validateSplitConfig()", () => {
    it("accepts a valid config that sums to 100%", () => {
      const result = validateSplitConfig(REGULATORY_DEFAULTS);
      expect(result.valid).toBe(true);
    });

    it("rejects a config that sums to less than 100%", () => {
      const bad: SplitConfig = { ...REGULATORY_DEFAULTS, prestador_pct: 80.000 };
      const result = validateSplitConfig(bad);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100.000%");
    });

    it("rejects a config that sums to more than 100%", () => {
      const bad: SplitConfig = { ...REGULATORY_DEFAULTS, prestador_pct: 95.000 };
      const result = validateSplitConfig(bad);
      expect(result.valid).toBe(false);
    });
  });

  // ---- A7: UBT Standard R$ 10.00 Sandbox Ride Test ----
  describe("A7 · calculateSplitAmounts() on R$ 10.00 Ride (UBT Test Spec)", () => {
    const split = calculateSplitAmounts(10.00);

    it("distributes R$ 9.00 to Prestador (90%)", () => {
      expect(split.prestador_amount).toBe(9.00);
    });

    it("distributes R$ 0.75 to UBT Platform (7.5%)", () => {
      expect(split.ubt_amount).toBe(0.75);
    });

    it("distributes R$ 0.05 to Padrinho Prestador (0.5%)", () => {
      expect(split.padrinho_prestador_amount).toBe(0.05);
    });

    it("distributes R$ 0.05 to Padrinho Tomador (0.5%)", () => {
      expect(split.padrinho_tomador_amount).toBe(0.05);
    });

    it("distributes R$ 0.05 to Associação / Fundo Social (0.5%)", () => {
      expect(split.comunidade_amount).toBe(0.05);
    });

    it("distributes R$ 0.05 to Prêmio Trabalhador (0.5%)", () => {
      expect(split.premio_trabalhador).toBe(0.05);
    });

    it("distributes R$ 0.05 to Prêmio Consumidor (0.5%)", () => {
      expect(split.premio_consumidor).toBe(0.05);
    });

    it("application_fee equals exactly R$ 1.00 (10%)", () => {
      expect(split.application_fee).toBe(1.00);
    });

    it("sums exactly to R$ 10.00 with zero drift", () => {
      const sum =
        split.prestador_amount +
        split.ubt_amount +
        split.padrinho_prestador_amount +
        split.padrinho_tomador_amount +
        split.comunidade_amount +
        split.premio_trabalhador +
        split.premio_consumidor;
      expect(sum).toBeCloseTo(10.00, 2);
    });
  });

  // ---- A8: buildNominal7WayLedger verification ----
  describe("A8 · buildNominal7WayLedger() nominal ledger resolution", () => {
    it("generates 7 structured nominal entries for Felipe -> Silvina transaction", () => {
      const ledger = buildNominal7WayLedger({
        totalAmount: 10.00,
        providerName: "Silvina Luz",
        providerId: "0a5edf64-7585-401f-b310-126529607da0",
      });

      expect(ledger.entries).toHaveLength(7);
      expect(ledger.total_amount).toBe(10.00);
      expect(ledger.entries[0].amount).toBe(9.00);
      expect(ledger.entries[0].name).toContain("Silvina Luz");
      expect(ledger.entries[1].amount).toBe(0.75);
      expect(ledger.entries[4].name).toContain("caixinha-mototaxista-sem-associação");
      expect(ledger.entries[5].wallet_identifier).toBe("premio-trabalhador-2026");
      expect(ledger.entries[6].wallet_identifier).toBe("premio-consumidor-2026");
      expect(ledger.formatted_summary).toContain("SOMA TOTAL DAS 7 VIAS:                              R$  10.00 (100.0%)");
    });
  });
});

