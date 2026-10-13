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

export function paymentToTransaction(row: PaymentHistoryRow): Transaction {
  const isProvider = row.participant_role === "prestador";
  return {
    id: row.payment_id,
    type: isProvider ? "entrada" : "saida",
    date: row.paid_at,
    description: row.ride_type === "entrega" ? "Entrega Mototáxi UBT" : "Corrida Mototáxi UBT",
    amount: Number(isProvider ? row.provider_amount : row.total_amount),
    status: row.payment_status === "approved" || row.ride_status === "paid" ? "confirmed" : "pending",
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
