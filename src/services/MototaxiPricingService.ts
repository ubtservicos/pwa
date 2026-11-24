import { supabase } from "@/lib/supabase";
import {
  DEFAULT_MOTOTAXI_PRICING_CONFIG,
  type MototaxiPricingConfig,
} from "@/utils/ride";

export interface StoredMototaxiPricingConfig extends MototaxiPricingConfig {
  updatedAt: string | null;
}

function mapDbRowToConfig(row: any): StoredMototaxiPricingConfig {
  if (!row || typeof row !== "object") {
    return { ...DEFAULT_MOTOTAXI_PRICING_CONFIG, updatedAt: null };
  }
  return {
    taxaUnica: Number.isFinite(Number(row.taxa_unica))
      ? Number(row.taxa_unica)
      : DEFAULT_MOTOTAXI_PRICING_CONFIG.taxaUnica,
    valorPorKm: Number.isFinite(Number(row.valor_por_km))
      ? Number(row.valor_por_km)
      : DEFAULT_MOTOTAXI_PRICING_CONFIG.valorPorKm,
    kmGatilhoIdaVolta:
      row.km_gatilho_ida_volta === null || row.km_gatilho_ida_volta === undefined
        ? 0
        : Math.max(0, Number(row.km_gatilho_ida_volta) || 0),
    fatorDemanda: Number.isFinite(Number(row.fator_demanda))
      ? Number(row.fator_demanda)
      : DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorDemanda,
    fatorHorario: Number.isFinite(Number(row.fator_horario))
      ? Number(row.fator_horario)
      : DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorHorario,
    fatorClima: Number.isFinite(Number(row.fator_clima))
      ? Number(row.fator_clima)
      : DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorClima,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function fetchMototaxiPricingConfig(): Promise<StoredMototaxiPricingConfig> {
  try {
    const { data, error } = await supabase
      .from("mototaxi_pricing_config")
      .select(
        "taxa_unica, valor_por_km, km_gatilho_ida_volta, fator_demanda, fator_horario, fator_clima, updated_at",
      )
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_MOTOTAXI_PRICING_CONFIG, updatedAt: null };
    }
    return mapDbRowToConfig(data);
  } catch {
    return { ...DEFAULT_MOTOTAXI_PRICING_CONFIG, updatedAt: null };
  }
}

export async function saveMototaxiPricingConfig(
  cfg: MototaxiPricingConfig,
): Promise<StoredMototaxiPricingConfig> {
  const { data, error } = await supabase.rpc("admin_update_mototaxi_pricing_config", {
    p_taxa_unica: Number(cfg.taxaUnica.toFixed(2)),
    p_valor_por_km: Number(cfg.valorPorKm.toFixed(2)),
    p_km_gatilho_ida_volta: Number(Math.max(0, cfg.kmGatilhoIdaVolta).toFixed(2)),
    p_fator_demanda: Number(cfg.fatorDemanda.toFixed(2)),
    p_fator_horario: Number(cfg.fatorHorario.toFixed(2)),
    p_fator_clima: Number(cfg.fatorClima.toFixed(2)),
  });

  if (error) {
    throw error;
  }

  return mapDbRowToConfig(data);
}
