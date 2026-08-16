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

    it("UBT receives 5% = R$5.00", () => {
      expect(split.ubt_amount).toBe(5.00);
    });

    it("comunidade receives 2% = R$2.00", () => {
      expect(split.comunidade_amount).toBe(2.00);
    });

    it("prize_trabalhador receives 1% = R$1.00", () => {
      expect(split.premio_trabalhador).toBe(1.00);
    });

    it("prize_consumidor receives 1% = R$1.00", () => {
      expect(split.premio_consumidor).toBe(1.00);
    });

    it("padrinho (residual bucket) receives R$1.00", () => {
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
        split.padrinho_amount;
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
        split.padrinho_amount;
      expect(sum).toBeCloseTo(33.33, 2);
    });

    it("no bucket is negative", () => {
      expect(split.prestador_amount).toBeGreaterThan(0);
      expect(split.ubt_amount).toBeGreaterThanOrEqual(0);
      expect(split.comunidade_amount).toBeGreaterThanOrEqual(0);
      expect(split.padrinho_amount).toBeGreaterThanOrEqual(0);
    });
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

    it("ubt receives R$75.00", () => {
      expect(split.ubt_amount).toBe(75.00);
    });

    it("Σ(all buckets) === R$1500.00", () => {
      const sum =
        split.prestador_amount + split.ubt_amount +
        split.comunidade_amount + split.premio_trabalhador +
        split.premio_consumidor + split.padrinho_amount;
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
      padrinho_pct:            1.000,
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
        split.prestador_amount + split.ubt_amount +
        split.comunidade_amount + split.premio_trabalhador +
        split.premio_consumidor + split.padrinho_amount;
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
      expect(result.error).toContain("100%");
    });

    it("rejects a config that sums to more than 100%", () => {
      const bad: SplitConfig = { ...REGULATORY_DEFAULTS, prestador_pct: 95.000 };
      const result = validateSplitConfig(bad);
      expect(result.valid).toBe(false);
    });
  });
});
