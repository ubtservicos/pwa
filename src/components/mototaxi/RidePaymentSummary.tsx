import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Navigation, ReceiptText } from "lucide-react";
import { calcSplit, formatBRL } from "@/utils/ride";
import { fetchUserPaymentHistory, type PaymentHistoryRow } from "@/services/PaymentHistoryService";
import { reverseGeocode } from "@/lib/geoService";
import { supabase } from "@/lib/supabase";

interface RidePaymentSummaryProps {
  rideId?: string | null;
  origin?: string;
  destination?: string;
  total: number;
}

interface StoredLocation {
  address?: string;
  lat?: number | string;
  lng?: number | string;
}

interface RideReceiptSnapshot {
  origin: StoredLocation | string | null;
  destination: StoredLocation | string | null;
  created_at: string | null;
  accepted_at: string | null;
  updated_at: string | null;
}

const parseLocation = (value: StoredLocation | string | null | undefined): StoredLocation | null => {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : { address: value };
  } catch {
    return { address: value };
  }
};

const isGenericCurrentLocation = (value?: string | null) =>
  !value || /^sua localiza[cç][aã]o atual$/i.test(value.trim());

const formatElapsedTime = (minutes: number | null) => {
  if (minutes == null) return "Não registrada";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
};

export function RidePaymentSummary({ rideId, origin, destination, total }: RidePaymentSummaryProps) {
  const [payment, setPayment] = useState<PaymentHistoryRow | null>(null);
  const [rideSnapshot, setRideSnapshot] = useState<RideReceiptSnapshot | null>(null);
  const [geocodedOrigin, setGeocodedOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (!rideId) return;
    let active = true;
    const hydrateReceipt = async () => {
      const [historyResult, rideResult] = await Promise.allSettled([
        fetchUserPaymentHistory(),
        supabase
          .from("mototaxi_corridas")
          .select("origin, destination, created_at, accepted_at, updated_at")
          .eq("id", rideId)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (historyResult.status === "fulfilled") {
        setPayment(historyResult.value.find((row) => row.service_id === rideId) || null);
      }

      if (rideResult.status === "fulfilled" && !rideResult.value.error && rideResult.value.data) {
        const snapshot = rideResult.value.data as RideReceiptSnapshot;
        setRideSnapshot(snapshot);

        const storedOrigin = parseLocation(snapshot.origin);
        const lat = Number(storedOrigin?.lat);
        const lng = Number(storedOrigin?.lng);
        if (isGenericCurrentLocation(storedOrigin?.address) && Number.isFinite(lat) && Number.isFinite(lng)) {
          const resolved = await reverseGeocode(lat, lng);
          if (active && resolved) setGeocodedOrigin(resolved);
        }
      }
    };

    void hydrateReceipt();
    return () => { active = false; };
  }, [rideId]);

  const fallbackSplit = useMemo(() => calcSplit(total), [total]);
  const provider = payment ? Number(payment.provider_amount) : fallbackSplit.prestador;
  const platform = payment
    ? Math.max(0, Number(payment.total_amount) - Number(payment.provider_amount))
    : total - fallbackSplit.prestador;
  const storedOrigin = parseLocation(rideSnapshot?.origin);
  const storedDestination = parseLocation(rideSnapshot?.destination);
  const originCandidates = [geocodedOrigin, storedOrigin?.address, payment?.origin?.address, origin];
  const resolvedOrigin = originCandidates.find((candidate) => !isGenericCurrentLocation(candidate)) || "Origem não informada";
  const resolvedDestination = storedDestination?.address || payment?.destination?.address || destination || "Destino não informado";
  const trackingId = payment?.transaction_id || rideId;
  const elapsedMinutes = useMemo(() => {
    const start = rideSnapshot?.accepted_at || rideSnapshot?.created_at;
    const end = rideSnapshot?.updated_at;
    if (!start || !end) return null;
    const elapsedMs = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
    return Math.max(1, Math.round(elapsedMs / 60_000));
  }, [rideSnapshot]);

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
        <div className="flex gap-2"><Clock3 size={14} className="mt-0.5 shrink-0 text-[#60A5FA]" /><span>Duração total: {formatElapsedTime(elapsedMinutes)}</span></div>
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
