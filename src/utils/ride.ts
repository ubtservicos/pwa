import { calculateSplitAmounts } from "@/lib/finance/splitEngine";

export interface MototaxiPricingConfig {
  taxaUnica: number;
  valorPorKm: number;
  kmGatilhoIdaVolta: number;
  fatorDemanda: number;
  fatorHorario: number;
  fatorClima: number;
}

export const DEFAULT_MOTOTAXI_PRICING_CONFIG: MototaxiPricingConfig = {
  taxaUnica: 4.0,
  valorPorKm: 2.5,
  kmGatilhoIdaVolta: 8.0,
  fatorDemanda: 1.0,
  fatorHorario: 1.0,
  fatorClima: 1.0,
};

export interface MototaxiQuoteBreakdown {
  distanciaKm: number;
  idaEVoltaAtivada: boolean;
  kmCobrados: number;
  taxaUnica: number;
  valorPorKm: number;
  kmGatilhoIdaVolta: number;
  fatorDemanda: number;
  fatorHorario: number;
  fatorClima: number;
  multiplicadorTotal: number;
  precoBase: number;
  precoFinal: number;
  repasseMototaxista: number;
  taxaPlataforma: number;
}

export function calculateMototaxiQuote(
  distanceKm: number,
  config?: Partial<MototaxiPricingConfig> | null,
): MototaxiQuoteBreakdown {
  const distanciaKm = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  const taxaUnica = Math.max(0, Number(config?.taxaUnica ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.taxaUnica) || 0);
  const valorPorKm = Math.max(0, Number(config?.valorPorKm ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.valorPorKm) || 0);
  const kmGatilhoIdaVolta = Math.max(
    0,
    Number(config?.kmGatilhoIdaVolta ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.kmGatilhoIdaVolta) || 0,
  );
  const fatorDemanda = Math.max(
    0.5,
    Number(config?.fatorDemanda ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorDemanda) || 1.0,
  );
  const fatorHorario = Math.max(
    0.5,
    Number(config?.fatorHorario ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorHorario) || 1.0,
  );
  const fatorClima = Math.max(
    0.5,
    Number(config?.fatorClima ?? DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorClima) || 1.0,
  );

  const idaEVoltaAtivada = kmGatilhoIdaVolta > 0 && distanciaKm >= kmGatilhoIdaVolta;
  const kmCobrados = idaEVoltaAtivada ? +(distanciaKm * 2).toFixed(2) : +distanciaKm.toFixed(2);
  const precoBase = Math.round((taxaUnica + valorPorKm * kmCobrados) * 100) / 100;
  const multiplicadorTotal = +(fatorDemanda * fatorHorario * fatorClima).toFixed(4);
  const precoFinal = Math.round(precoBase * multiplicadorTotal * 100) / 100;
  const repasseMototaxista = Math.round(precoFinal * 0.9 * 100) / 100;
  const taxaPlataforma = Math.round((precoFinal - repasseMototaxista) * 100) / 100;

  return {
    distanciaKm,
    idaEVoltaAtivada,
    kmCobrados,
    taxaUnica,
    valorPorKm,
    kmGatilhoIdaVolta,
    fatorDemanda,
    fatorHorario,
    fatorClima,
    multiplicadorTotal,
    precoBase,
    precoFinal,
    repasseMototaxista,
    taxaPlataforma,
  };
}

export const calcPrice = (
  distanceKm: number,
  config?: Partial<MototaxiPricingConfig> | null,
): number => {
  return calculateMototaxiQuote(distanceKm, config).precoFinal;
};

export const calcSplit = (total: number) => {
  if (total <= 0) {
    return {
      prestador: 0,
      ubt: 0,
      padrinhoPrestador: 0,
      padrinhoTomador: 0,
      associacao: 0,
      premioTrabalhador: 0,
      premioConsumidor: 0,
      comunidade: 0,
      padrinho: 0,
    };
  }
  const split = calculateSplitAmounts(total);
  return {
    prestador: split.prestador_amount,
    ubt: split.ubt_amount,
    padrinhoPrestador: split.padrinho_prestador_amount,
    padrinhoTomador: split.padrinho_tomador_amount,
    associacao: split.comunidade_amount,
    premioTrabalhador: split.premio_trabalhador,
    premioConsumidor: split.premio_consumidor,
    // Backwards compatibility aliases
    comunidade: split.comunidade_amount,
    padrinho: split.padrinho_amount || +(split.padrinho_prestador_amount + split.padrinho_tomador_amount).toFixed(2),
  };
};

export type SplitKey =
  | "prestador"
  | "ubt"
  | "padrinhoPrestador"
  | "padrinhoTomador"
  | "associacao"
  | "premioTrabalhador"
  | "premioConsumidor";

export const SPLIT_META: Array<{
  key: SplitKey;
  label: string;
  icon: "User" | "Building2" | "Users" | "Gift" | "Star" | "Heart";
  color: string;
}> = [
  { key: "prestador", label: "Prestador (90%)", icon: "User", color: "#0DB87E" },
  { key: "ubt", label: "UBT Plataforma (7,5%)", icon: "Building2", color: "#F5A623" },
  { key: "padrinhoPrestador", label: "Padrinho Prestador (0,5%)", icon: "Heart", color: "#0DB87E" },
  { key: "padrinhoTomador", label: "Padrinho Tomador (0,5%)", icon: "Heart", color: "#10B981" },
  { key: "associacao", label: "Associação (0,5%)", icon: "Users", color: "#2B6EE8" },
  { key: "premioTrabalhador", label: "Prêmio Trabalhador (0,5%)", icon: "Gift", color: "#9B59B6" },
  { key: "premioConsumidor", label: "Prêmio Consumidor (0,5%)", icon: "Star", color: "#E84040" },
];

export const formatBRL = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

