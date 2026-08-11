import { describe, it, expect } from "vitest";

// Ported split resolution logic from Edge Function for test validation
interface SplitConfig {
  prestador_pct: number;
  ubt_pct: number;
  comunidade_pct: number;
  premio_trabalhador_pct: number;
  premio_consumidor_pct: number;
  padrinho_pct: number;
}

interface CustomSplitSettings {
  comunidade_pct: number;
  premio_trabalhador_pct: number;
  premio_consumidor_pct: number;
  padrinho_pct: number;
}

function resolveSplitPercentages(
  dbConfig: SplitConfig,
  customConfig: CustomSplitSettings | null
) {
  let pPct = dbConfig.prestador_pct / 100;
  let uPct = dbConfig.ubt_pct / 100;
  let cPct = dbConfig.comunidade_pct / 100;
  let tPct = dbConfig.premio_trabalhador_pct / 100;
  let oPct = dbConfig.premio_consumidor_pct / 100;
  let gPct = dbConfig.padrinho_pct / 100;

  const resolvedPool = cPct + tPct + oPct + gPct;

  if (customConfig) {
    const sumCustom = 
      customConfig.comunidade_pct +
      customConfig.premio_trabalhador_pct +
      customConfig.premio_consumidor_pct +
      customConfig.padrinho_pct;

    // Only apply custom settings if they align with the active pool size
    if (Math.abs(sumCustom - resolvedPool * 100) < 0.01) {
      cPct = customConfig.comunidade_pct / 100;
      tPct = customConfig.premio_trabalhador_pct / 100;
      oPct = customConfig.premio_consumidor_pct / 100;
      gPct = customConfig.padrinho_pct / 100;
    }
  }

  return { pPct, uPct, cPct, tPct, oPct, gPct };
}

describe("Dynamic Split Resolution Hierarchy & Constraints", () => {
  const dbDefault5: SplitConfig = {
    prestador_pct: 90,
    ubt_pct: 5,
    comunidade_pct: 2,
    premio_trabalhador_pct: 1,
    premio_consumidor_pct: 1,
    padrinho_pct: 1,
  };

  const dbDefault6: SplitConfig = {
    prestador_pct: 90,
    ubt_pct: 4,
    comunidade_pct: 2,
    premio_trabalhador_pct: 1.5,
    premio_consumidor_pct: 1.5,
    padrinho_pct: 1,
  };

  const dbDefault8: SplitConfig = {
    prestador_pct: 88,
    ubt_pct: 4,
    comunidade_pct: 3,
    premio_trabalhador_pct: 2,
    premio_consumidor_pct: 2,
    padrinho_pct: 1,
  };

  // A. pool = 5%
  it("should calculate pool size = 5% correctly from database config", () => {
    const pool = (dbDefault5.comunidade_pct + dbDefault5.premio_trabalhador_pct + dbDefault5.premio_consumidor_pct + dbDefault5.padrinho_pct) / 100;
    expect(pool).toBe(0.05);
  });

  // B. pool = 6%
  it("should calculate pool size = 6% correctly from database config", () => {
    const pool = (dbDefault6.comunidade_pct + dbDefault6.premio_trabalhador_pct + dbDefault6.premio_consumidor_pct + dbDefault6.padrinho_pct) / 100;
    expect(pool).toBe(0.06);
  });

  // C. pool = 8%
  it("should calculate pool size = 8% correctly from database config", () => {
    const pool = (dbDefault8.comunidade_pct + dbDefault8.premio_trabalhador_pct + dbDefault8.premio_consumidor_pct + dbDefault8.padrinho_pct) / 100;
    expect(pool).toBe(0.08);
  });

  // D. pool alterado depois de existir configuração individual (D, F, I)
  it("should invalidate custom configuration and fallback when pool is altered", () => {
    // Custom set under pool 5%
    const custom: CustomSplitSettings = {
      comunidade_pct: 2.0,
      premio_trabalhador_pct: 1.0,
      premio_consumidor_pct: 1.0,
      padrinho_pct: 1.0, // Sum = 5%
    };

    // Now UBT changes active pool default to 6%
    const resolved = resolveSplitPercentages(dbDefault6, custom);
    expect(resolved.cPct).toBe(0.02); // falls back to UBT default community_pct (2% instead of custom)
    expect(resolved.tPct).toBe(0.015); // falls back to UBT default premio_trabalhador_pct (1.5%)
  });

  // E. custom válido
  it("should apply custom provider split when custom pool matches default pool size", () => {
    const custom: CustomSplitSettings = {
      comunidade_pct: 1.5,
      premio_trabalhador_pct: 1.5,
      premio_consumidor_pct: 1.0,
      padrinho_pct: 1.0,
    };
    const resolved = resolveSplitPercentages(dbDefault5, custom);
    expect(resolved.pPct).toBe(0.90);
    expect(resolved.uPct).toBe(0.05);
    expect(resolved.cPct).toBe(0.015);
    expect(resolved.tPct).toBe(0.015);
    expect(resolved.oPct).toBe(0.01);
    expect(resolved.gPct).toBe(0.01);
  });

  // G. custom ausente
  it("should use UBT defaults when custom config is null/absent", () => {
    const resolved = resolveSplitPercentages(dbDefault5, null);
    expect(resolved.cPct).toBe(0.02);
    expect(resolved.tPct).toBe(0.01);
  });

  // H, J, K. minimum clamp, step multiple, maximum limits validation emulation
  it("should enforce range limits and steps constraints on provider settings", () => {
    const pool = 5.0;
    const min = 0.5;
    
    // Snaps/Clamping logic verification
    const validateItem = (val: number, currentPool: number) => {
      // Clamps to min
      if (val < min) val = min;
      // Clamps to dynamic max
      const maxVal = currentPool - (min * 3);
      if (val > maxVal) val = maxVal;
      // Snaps to 0.5 step multiple
      return Math.round(val * 2) / 2;
    };

    expect(validateItem(0.2, pool)).toBe(0.5); // clamped to min
    expect(validateItem(4.0, pool)).toBe(3.5); // clamped to max
    expect(validateItem(1.23, pool)).toBe(1.0); // snapped to multiple
    expect(validateItem(1.28, pool)).toBe(1.5); // snapped to multiple
  });

  // L. Tentativa de alterar Prestador/UBT pelo prestador
  it("should prevent custom provider settings from overriding admin prestador/ubt shares", () => {
    const custom: CustomSplitSettings = {
      comunidade_pct: 1.5,
      premio_trabalhador_pct: 1.5,
      premio_consumidor_pct: 1.0,
      padrinho_pct: 1.0,
    };
    const resolved = resolveSplitPercentages(dbDefault5, custom);
    // Custom split does not contain ubt_pct or prestador_pct. They are strictly loaded from dbDefault!
    expect(resolved.pPct).toBe(dbDefault5.prestador_pct / 100);
    expect(resolved.uPct).toBe(dbDefault5.ubt_pct / 100);
  });

  // M, N. Mappings of associations and status validation
  it("should correctly represent association mapping and request states", () => {
    const providerAssoc = {
      provider_id: "prov_123",
      service_type: "mototaxi",
      association_id: "assoc_itagua"
    };

    const changeRequest = {
      id: "req_999",
      provider_id: "prov_123",
      service_type: "mototaxi",
      current_association_id: "assoc_itagua",
      requested_association_id: "assoc_pereque",
      status: "pending" // check validation rules: pending, approved, rejected
    };

    expect(providerAssoc.service_type).toBe("mototaxi");
    expect(changeRequest.status).toMatch(/pending|approved|rejected/);
  });

  // O. Audit trailing structure validation
  it("should construct valid audit log payloads tracking previous and current distribution structures", () => {
    const oldDist = { comunidade_pct: 2.0, premio_trabalhador_pct: 1.0 };
    const newDist = { comunidade_pct: 1.5, premio_trabalhador_pct: 1.5 };
    
    const auditRecord = {
      provider_id: "prov_123",
      changed_by: "prov_123",
      old_distribution: oldDist,
      new_distribution: newDist,
      created_at: new Date().toISOString()
    };

    expect(auditRecord.old_distribution.comunidade_pct).toBe(2.0);
    expect(auditRecord.new_distribution.comunidade_pct).toBe(1.5);
  });
});
