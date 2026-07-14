export const calcPrice = (distanceKm: number): number => {
  const BASE_FIXED = 4.0;
  const BASE_RATE = 2.5;
  return Math.round((BASE_FIXED + BASE_RATE * distanceKm) * 100) / 100;
};

export const calcSplit = (total: number) => ({
  prestador: +(total * 0.9).toFixed(2),
  ubt: +(total * 0.04).toFixed(2),
  comunidade: +(total * 0.02).toFixed(2),
  premioTrabalhador: +(total * 0.015).toFixed(2),
  premioConsumidor: +(total * 0.015).toFixed(2),
  padrinho: +(total * 0.01).toFixed(2),
});

export type SplitKey =
  | "prestador"
  | "ubt"
  | "comunidade"
  | "premioTrabalhador"
  | "premioConsumidor"
  | "padrinho";

export const SPLIT_META: Array<{
  key: SplitKey;
  label: string;
  icon: "User" | "Building2" | "Users" | "Gift" | "Star" | "Heart";
  color: string;
}> = [
  { key: "prestador", label: "Prestador", icon: "User", color: "#0DB87E" },
  { key: "ubt", label: "UBT", icon: "Building2", color: "#F5A623" },
  { key: "comunidade", label: "Comunidade", icon: "Users", color: "#2B6EE8" },
  { key: "premioTrabalhador", label: "Prêmio Trabalhador", icon: "Gift", color: "#9B59B6" },
  { key: "premioConsumidor", label: "Prêmio Consumidor", icon: "Star", color: "#E84040" },
  { key: "padrinho", label: "Padrinho/Madrinha", icon: "Heart", color: "#0DB87E" },
];

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
