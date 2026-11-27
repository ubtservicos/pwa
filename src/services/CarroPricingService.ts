import { supabase } from "@/lib/supabase";
import {
  DEFAULT_CARRO_PRICING_CONFIG,
  type CarroPricingConfig,
} from "@/utils/ride";

export interface StoredCarroPricingConfig extends CarroPricingConfig {
  updatedAt: string | null;
}

function parseSubtypeMultipliers(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { padrao: 1.0 };
  }
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) {
      result[k.toLowerCase()] = num;
    }
  }
  if (!result.padrao) result.padrao = 1.0;
  return result;
}

function mapDbRowToConfig(row: any): StoredCarroPricingConfig {
  if (!row || typeof row !== "object") {
    return { ...DEFAULT_CARRO_PRICING_CONFIG, updatedAt: null };
  }
  return {
    taxaUnica: Number.isFinite(Number(row.taxa_unica))
      ? Number(row.taxa_unica)
      : DEFAULT_CARRO_PRICING_CONFIG.taxaUnica,
    valorPorKm: Number.isFinite(Number(row.valor_por_km))
      ? Number(row.valor_por_km)
      : DEFAULT_CARRO_PRICING_CONFIG.valorPorKm,
    kmGatilhoIdaVolta:
      row.km_gatilho_ida_volta === null || row.km_gatilho_ida_volta === undefined
        ? 0
        : Math.max(0, Number(row.km_gatilho_ida_volta) || 0),
    fatorDemanda: Number.isFinite(Number(row.fator_demanda))
      ? Number(row.fator_demanda)
      : DEFAULT_CARRO_PRICING_CONFIG.fatorDemanda,
    fatorHorario: Number.isFinite(Number(row.fator_horario))
      ? Number(row.fator_horario)
      : DEFAULT_CARRO_PRICING_CONFIG.fatorHorario,
    fatorClima: Number.isFinite(Number(row.fator_clima))
      ? Number(row.fator_clima)
      : DEFAULT_CARRO_PRICING_CONFIG.fatorClima,
    subtypeMultipliers: parseSubtypeMultipliers(row.subtype_multipliers),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function fetchCarroPricingConfig(): Promise<StoredCarroPricingConfig> {
  try {
    const { data, error } = await supabase
      .from("carro_pricing_config")
      .select(
        "taxa_unica, valor_por_km, km_gatilho_ida_volta, fator_demanda, fator_horario, fator_clima, subtype_multipliers, updated_at",
      )
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_CARRO_PRICING_CONFIG, updatedAt: null };
    }
    return mapDbRowToConfig(data);
  } catch {
    return { ...DEFAULT_CARRO_PRICING_CONFIG, updatedAt: null };
  }
}

export async function saveCarroPricingConfig(
  cfg: CarroPricingConfig,
): Promise<StoredCarroPricingConfig> {
  const { data, error } = await supabase.rpc("admin_update_carro_pricing_config", {
    p_taxa_unica: Number(cfg.taxaUnica.toFixed(2)),
    p_valor_por_km: Number(cfg.valorPorKm.toFixed(2)),
    p_km_gatilho_ida_volta: Number(Math.max(0, cfg.kmGatilhoIdaVolta).toFixed(2)),
    p_fator_demanda: Number(cfg.fatorDemanda.toFixed(2)),
    p_fator_horario: Number(cfg.fatorHorario.toFixed(2)),
    p_fator_clima: Number(cfg.fatorClima.toFixed(2)),
    p_subtype_multipliers: cfg.subtypeMultipliers ?? { padrao: 1.0 },
  });

  if (error) {
    throw error;
  }

  return mapDbRowToConfig(data);
}
