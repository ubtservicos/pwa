import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, ReceiptText } from "lucide-react";
import { calcSplit, formatBRL } from "@/utils/ride";
import { fetchUserPaymentHistory, type PaymentHistoryRow } from "@/services/PaymentHistoryService";

interface RidePaymentSummaryProps {
  rideId?: string | null;
  origin?: string;
  destination?: string;
  total: number;
}

export function RidePaymentSummary({ rideId, origin, destination, total }: RidePaymentSummaryProps) {
  const [payment, setPayment] = useState<PaymentHistoryRow | null>(null);

  useEffect(() => {
    if (!rideId) return;
    let active = true;
    fetchUserPaymentHistory()
      .then((rows) => {
        if (active) setPayment(rows.find((row) => row.service_id === rideId) || null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [rideId]);

  const fallbackSplit = useMemo(() => calcSplit(total), [total]);
  const provider = payment ? Number(payment.provider_amount) : fallbackSplit.prestador;
  const platform = payment
    ? Math.max(0, Number(payment.total_amount) - Number(payment.provider_amount))
    : total - fallbackSplit.prestador;
  const resolvedOrigin = payment?.origin?.address || origin || "Origem não informada";
  const resolvedDestination = payment?.destination?.address || destination || "Destino não informado";
  const trackingId = payment?.transaction_id || rideId;

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-white">Resumo da corrida</h3>
        {trackingId && (
          <span className="font-mono text-[10px] text-white/50">#{trackingId.slice(0, 8).toUpperCase()}</span>
        )}
      </div>
      <div className="mt-3 space-y-2 text-xs text-white/70">
        <div className="flex gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-[#0DB87E]" /><span>{resolvedOrigin}</span></div>
        <div className="flex gap-2"><Navigation size={14} className="mt-0.5 shrink-0 text-[#F5A623]" /><span>{resolvedDestination}</span></div>
      </div>
      <div className="my-3 h-px bg-white/10" />
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-white/70"><span>Prestador (90%)</span><strong className="text-[#0DB87E]">{formatBRL(provider)}</strong></div>
        <div className="flex justify-between text-white/70"><span>Plataforma e fundos (10%)</span><span>{formatBRL(platform)}</span></div>
        <div className="flex items-center justify-between pt-1 font-semibold text-white"><span className="flex items-center gap-1.5"><ReceiptText size={13} />Total</span><span>{formatBRL(payment ? Number(payment.total_amount) : total)}</span></div>
      </div>
    </section>
  );
}
