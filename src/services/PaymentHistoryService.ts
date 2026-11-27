import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/mocks/transactions";

export interface PaymentHistoryRow {
  payment_id: string;
  transaction_id: string;
  payment_status: string;
  service_id: string;
  service_type: string;
  total_amount: number | string;
  provider_amount: number | string;
  ubt_amount: number | string;
  entity_amount: number | string;
  prize_worker_amount: number | string;
  prize_consumer_amount: number | string;
  godparent_amount: number | string;
  payment_route: string | null;
  paid_at: string;
  participant_role: "tomador" | "prestador";
  origin: { address?: string } | null;
  destination: { address?: string } | null;
  distance_km: number | string | null;
  duration_min: number | null;
  ride_type: string;
  ride_status: string;
  payment_method: string | null;
}

export async function fetchUserPaymentHistory(): Promise<PaymentHistoryRow[]> {
  const { data, error } = await (supabase as any).rpc("get_user_payment_history");
  if (error) throw error;
  return (data || []) as PaymentHistoryRow[];
}

export function isSettledPaymentStatus(status?: string | null): boolean {
  return ["approved", "paid", "confirmed", "captured"].includes(String(status || "").toLowerCase());
}

export function isExcludedPaymentStatus(status?: string | null): boolean {
  return ["rejected", "failed", "cancelled", "expired", "voided"].includes(String(status || "").toLowerCase());
}

/**
 * Deduplicates payment history rows by service_id:
 * - Excludes failed/rejected/cancelled/expired attempts.
 * - Never promotes a pending row to confirmed just because ride_status === 'paid'.
 * - If a service_id already has a settled payment, hides all pending attempts for that same service_id.
 */
export function deduplicatePaymentHistory(rows: PaymentHistoryRow[]): PaymentHistoryRow[] {
  const nonExcluded = rows.filter((row) => !isExcludedPaymentStatus(row.payment_status));
  const settledServiceKeys = new Set<string>();
  for (const row of nonExcluded) {
    if (isSettledPaymentStatus(row.payment_status) && row.service_id) {
      settledServiceKeys.add(`${row.service_type || "mototaxi"}:${row.service_id}`);
    }
  }

  const seenIds = new Set<string>();
  const result: PaymentHistoryRow[] = [];
  for (const row of nonExcluded) {
    const uniqueKey = row.payment_id || row.transaction_id;
    if (uniqueKey && seenIds.has(uniqueKey)) continue;
    const serviceKey = row.service_id ? `${row.service_type || "mototaxi"}:${row.service_id}` : "";
    if (!isSettledPaymentStatus(row.payment_status) && serviceKey && settledServiceKeys.has(serviceKey)) {
      continue;
    }
    if (uniqueKey) seenIds.add(uniqueKey);
    result.push(row);
  }
  return result;
}

export function paymentToTransaction(row: PaymentHistoryRow): Transaction {
  const isProvider = row.participant_role === "prestador";
  const normalizedStatus = String(row.payment_status || "").toLowerCase();
  const mappedStatus: Transaction["status"] = isSettledPaymentStatus(normalizedStatus)
    ? "confirmed"
    : isExcludedPaymentStatus(normalizedStatus)
      ? "cancelled"
      : "pending";
  const shortId = row.service_id ? `#${String(row.service_id).slice(0, 8).toUpperCase()}` : "";
  const isCarro = String(row.service_type || "").toLowerCase() === "carro";
  const baseDesc = isCarro
    ? row.ride_type === "entrega"
      ? "Entrega Carros UBT"
      : "Corrida Carros UBT"
    : row.ride_type === "entrega"
      ? "Entrega Mototáxi UBT"
      : "Corrida Mototáxi UBT";

  return {
    id: row.payment_id,
    type: isProvider ? "entrada" : "saida",
    date: row.paid_at,
    description: shortId ? `${baseDesc} · ${shortId}` : baseDesc,
    amount: Number(isProvider ? row.provider_amount : row.total_amount),
    status: mappedStatus,
    transactionId: row.transaction_id,
    serviceId: row.service_id,
    serviceType: row.service_type,
    origin: row.origin?.address || "Origem não informada",
    destination: row.destination?.address || "Destino não informado",
    paymentMethod: row.payment_method || undefined,
    durationMin: row.duration_min || undefined,
    distanceKm: row.distance_km == null ? undefined : Number(row.distance_km),
    splitAmounts: {
      provider: Number(row.provider_amount),
      ubt: Number(row.ubt_amount),
      entity: Number(row.entity_amount),
      prizeWorker: Number(row.prize_worker_amount),
      prizeConsumer: Number(row.prize_consumer_amount),
      godparent: Number(row.godparent_amount),
    },
  };
}
