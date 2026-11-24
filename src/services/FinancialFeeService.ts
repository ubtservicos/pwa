import { supabase } from "@/lib/supabase";

export interface GatewayFeeSettings {
  taxaPixPct: number;      // e.g. 0.00 (0%)
  taxaCardPct: number;     // e.g. 2.99 (2.99%)
  source: "database" | "regulatory_defaults";
}

export interface FeeCalculation {
  basePrice: number;
  feePct: number;
  feeAmount: number;
  totalAmount: number;
  paymentMethod: "pix" | "card";
}

export const DEFAULT_FEE_SETTINGS: GatewayFeeSettings = {
  taxaPixPct: 0.0,
  taxaCardPct: 2.99,
  source: "regulatory_defaults",
};

let cachedFeeSettings: GatewayFeeSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export async function fetchGatewayFeeSettings(): Promise<GatewayFeeSettings> {
  const now = Date.now();
  if (cachedFeeSettings && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedFeeSettings;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('chave, valor')
      .in('chave', ['taxa_pix', 'taxa_cartao', 'taxa_gateway_pix', 'taxa_gateway_cartao', 'taxa_credito']);

    if (error || !data || data.length === 0) {
      cachedFeeSettings = DEFAULT_FEE_SETTINGS;
      lastFetchTime = now;
      return DEFAULT_FEE_SETTINGS;
    }

    let pixPct = DEFAULT_FEE_SETTINGS.taxaPixPct;
    let cardPct = DEFAULT_FEE_SETTINGS.taxaCardPct;
    let found = false;

    data.forEach((row: { chave: string; valor: any }) => {
      let raw = row.valor;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { /* noop */ }
      }
      const numVal = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!isNaN(numVal) && numVal >= 0 && numVal <= 30) {
        const normalizedPct = numVal > 0 && numVal < 0.2 ? Math.round((numVal * 100 + Number.EPSILON) * 100) / 100 : numVal;
        if (row.chave === 'taxa_pix' || row.chave === 'taxa_gateway_pix') {
          pixPct = normalizedPct;
          found = true;
        } else if (row.chave === 'taxa_cartao' || row.chave === 'taxa_gateway_cartao' || row.chave === 'taxa_credito') {
          cardPct = normalizedPct;
          found = true;
        }
      }
    });

    cachedFeeSettings = {
      taxaPixPct: pixPct,
      taxaCardPct: cardPct,
      source: found ? "database" : "regulatory_defaults",
    };
    lastFetchTime = now;
    return cachedFeeSettings;
  } catch (err) {
    console.warn("[FinancialFeeService] Error loading fee settings from DB:", err);
    return DEFAULT_FEE_SETTINGS;
  }
}

export function calculatePaymentWithFee(
  basePrice: number,
  method: "pix" | "card",
  settings: GatewayFeeSettings = DEFAULT_FEE_SETTINGS
): FeeCalculation {
  const feePct = method === "pix" ? settings.taxaPixPct : settings.taxaCardPct;
  const feeAmount = Math.round((basePrice * (feePct / 100) + Number.EPSILON) * 100) / 100;
  const totalAmount = Math.round((basePrice + feeAmount + Number.EPSILON) * 100) / 100;

  return {
    basePrice,
    feePct,
    feeAmount,
    totalAmount,
    paymentMethod: method,
  };
}
