import { Transaction, TransactionType } from "@/mocks/transactions";

export type Periodo = "dia" | "semana" | "mes" | "custom";

export const filterByPeriod = (
  txs: Transaction[],
  periodo: Periodo,
  customStart?: Date,
  customEnd?: Date,
): Transaction[] => {
  const now = new Date();
  if (periodo === "dia") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return txs.filter((t) => new Date(t.date) >= start);
  }
  if (periodo === "semana") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return txs.filter((t) => new Date(t.date) >= start);
  }
  if (periodo === "mes") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return txs.filter((t) => new Date(t.date) >= start);
  }
  if (periodo === "custom" && customStart && customEnd) {
    return txs.filter((t) => {
      const d = new Date(t.date);
      return d >= customStart && d <= customEnd;
    });
  }
  return txs;
};

export const sumByType = (txs: Transaction[], type: TransactionType): number =>
  txs
    .filter((t) => t.type === type && t.status === "confirmed")
    .reduce((acc, t) => acc + t.amount, 0);

export const groupByDay = (
  txs: Transaction[],
): Record<string, Transaction[]> =>
  txs.reduce(
    (acc, t) => {
      const key = new Date(t.date).toDateString();
      acc[key] = [...(acc[key] || []), t];
      return acc;
    },
    {} as Record<string, Transaction[]>,
  );

export const formatDayLabel = (dateStr: string): string => {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d >= today) return "Hoje";
  if (d >= yesterday) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
};

export const formatTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatBRLNumber = (v: number): string =>
  Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
