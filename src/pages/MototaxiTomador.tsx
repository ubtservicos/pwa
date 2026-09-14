import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Clock,
  Crosshair,
  MapPin,
  Navigation,
  Package,
  ShieldAlert,
  Star,
  Trophy,
  CheckCircle2,
  QrCode,
  CreditCard,
  X,
  User,
  MessageSquare,
  Scan,
  Smartphone,
  Banknote,
  Copy,
  Check,
} from "lucide-react";
import MototaxiMap from "@/components/mototaxi/MototaxiMap";
import SplitBreakdown from "@/components/mototaxi/SplitBreakdown";
import QuickStatusMessages from "@/components/mototaxi/QuickStatusMessages";
import Confetti from "react-confetti";
import { fetchGatewayFeeSettings, calculatePaymentWithFee, type GatewayFeeSettings, DEFAULT_FEE_SETTINGS } from "@/services/FinancialFeeService";
import { calcPrice, formatBRL } from "@/utils/ride";
import { useRide, type RideType } from "@/contexts/RideContext";
import { searchAddressesWithSessionToken, getPlaceDetails, createAutocompleteSessionToken, type AutocompleteSuggestion } from "@/lib/geoService";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createPreference, calculateSplit } from "@/lib/mercadoPago";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { validateGeofence } from "@/services/GeofenceService";
import { collectPaymentMetadata } from "@/services/PaymentSecurityService";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

const UBATUBA_FALLBACK = { lat: -23.4336, lng: -45.0838 };

const Sheet = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`absolute left-0 right-0 bottom-0 z-[1000] ${className}`}
    style={{
      background: "#18181B",
      borderTop: "1px solid #27272A",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
    }}
  >
    <div
      className="mx-auto mb-3 rounded-full"
      style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)" }}
    />
    {children}
  </div>
);

/* -------------------- IDLE Sheet -------------------- */
const IdleSheet = ({
  type, setType,
  origin, setOriginAddress, recenter,
  destination, setDestination,
  onConfirm,
}: {
  type: RideType | null;
  setType: (t: RideType) => void;
  origin: { lat: number; lng: number; address: string } | null;
  setOriginAddress: (s: string) => void;
  recenter: () => void;
  destination: { lat: number; lng: number; address: string } | null;
  setDestination: (d: { lat: number; lng: number; address: string }) => void;
  onConfirm: () => void;
}) => {
  const distanceKm = useMemo(() => {
    if (!origin || !destination) return 0;
    // simple haversine
    const R = 6371;
    const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
    const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((origin.lat * Math.PI) / 180) *
        Math.cos((destination.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return +(2 * R * Math.asin(Math.sqrt(a))).toFixed(1);
  }, [origin, destination]);

  const price = distanceKm > 0 ? calcPrice(distanceKm) : 0;
  const durationMin = Math.max(3, Math.round(distanceKm * 3));

  const canConfirm = !!type && !!origin && !!destination;

  const [destQuery, setDestQuery] = useState(destination?.address || "");
  const [destResults, setDestResults] = useState<AutocompleteSuggestion[]>([]);
  const [searchingDest, setSearchingDest] = useState(false);
  const destSessionTokenRef = useRef<any>(null);

  const initDestSessionToken = () => {
    destSessionTokenRef.current = createAutocompleteSessionToken();
  };

  useEffect(() => {
    initDestSessionToken();
  }, []);

  useEffect(() => {
    // If the input matches the confirmed destination, we don't search again
    if (destination && destQuery === destination.address) {
      setDestResults([]);
      return;
    }
    if (destQuery.length < 2) {
      setDestResults([]);
      return;
    }
    if (!destSessionTokenRef.current) {
      initDestSessionToken();
    }
    const timer = setTimeout(() => {
      setSearchingDest(true);
      searchAddressesWithSessionToken(destQuery, destSessionTokenRef.current).then((res) => {
        setDestResults(res);
        setSearchingDest(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [destQuery, destination]);

  const handleSelectDest = async (r: AutocompleteSuggestion) => {
    setSearchingDest(true);
    const token = destSessionTokenRef.current;
    const details = await getPlaceDetails(r.placeId, token);
    initDestSessionToken();

    const userNumberMatch = destQuery.match(/(?:,\s*|n[º°]?\s*|\s+)(\d+[a-zA-Z]?)(?:\b|$)/i) || destQuery.match(/(\d+)/);
    const userTypedNumber = userNumberMatch ? userNumberMatch[1] : null;

    let finalAddress = details?.formattedAddress || r.label;
    if (userTypedNumber && !finalAddress.match(new RegExp(`\\b${userTypedNumber}\\b`))) {
      const parts = finalAddress.split(',');
      if (parts.length > 1) {
        parts[0] = `${parts[0].trim()}, ${userTypedNumber}`;
        finalAddress = parts.join(', ');
      } else {
        finalAddress = `${finalAddress}, ${userTypedNumber}`;
      }
    }

    const lat = details?.lat ?? UBATUBA_FALLBACK.lat;
    const lng = details?.lng ?? UBATUBA_FALLBACK.lng;

    setDestination({ lat, lng, address: finalAddress });
    setDestQuery(finalAddress);
    setDestResults([]);
    setSearchingDest(false);
  };

  return (
    <Sheet>
      {/* Type selector */}
      <div className="flex gap-2.5">
        {([
          { key: "carona", label: "Carona", Icon: User },
          { key: "entrega", label: "Entrega", Icon: Package },
        ] as const).map(({ key, label, Icon }) => {
          const selected = type === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-colors"
              style={{
                padding: "14px",
                background: selected ? "#0DB87E" : "rgba(255,255,255,0.05)",
                border: `1px solid ${selected ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
                color: selected ? "#fff" : "rgba(255,255,255,0.55)",
              }}
            >
              <Icon size={18} />
              <span className="font-sans text-[14px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Origem */}
      <div className="mt-4">
        <label className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          De onde?
        </label>
        <div
          className="mt-1 flex items-center gap-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            height: 48,
            padding: "0 12px",
          }}
        >
          <Navigation size={16} style={{ color: "#0DB87E" }} />
          <input
            value={origin?.address || ""}
            onChange={(e) => setOriginAddress(e.target.value)}
            placeholder="Sua localização"
            className="flex-1 bg-transparent outline-none font-sans text-[15px] text-white placeholder:text-white/30"
          />
          <button type="button" onClick={recenter} aria-label="Recentralizar">
            <Crosshair size={18} style={{ color: "rgba(255,255,255,0.55)" }} />
          </button>
        </div>
      </div>

      {/* Destino */}
      <div className="mt-3">
        <label className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Para onde?
        </label>
        <div
          className="mt-1 flex items-center gap-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            height: 48,
            padding: "0 12px",
          }}
        >
          <MapPin size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
          <input
            value={destQuery}
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Endereço, ponto de referência..."
            className="flex-1 bg-transparent outline-none font-sans text-[15px] text-white placeholder:text-white/30"
          />
        </div>
        
        {/* Dropdown de resultados */}
        {destResults.length > 0 && (
          <div
            className="mt-2 rounded-xl overflow-hidden"
            style={{
              background: "#18181B",
              border: "1px solid #27272A",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {destResults.map((r, i) => (
              <button
                key={r.placeId || `${r.label}-${i}`}
                type="button"
                onClick={() => handleSelectDest(r)}
                className="w-full text-left px-3 py-2.5 border-b border-white/5 last:border-none hover:bg-white/10"
              >
                <div className="font-sans text-[13px] font-semibold text-white/90">{r.mainText || r.label}</div>
                {r.secondaryText && <div className="font-sans text-[11px] text-white/50">{r.secondaryText}</div>}
              </button>
            ))}
          </div>
        )}
        
        {searchingDest && (
          <div className="mt-2 text-center text-[12px] text-white/50">
            Buscando endereços...
          </div>
        )}
      </div>

      {/* Preview preço */}
      {origin && destination && (
        <div
          className="mt-3.5 rounded-xl animate-in fade-in"
          style={{
            background: "rgba(13,184,126,0.08)",
            border: "1px solid rgba(13,184,126,0.20)",
            padding: "14px 16px",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Estimativa
            </span>
            <span className="font-display text-[20px] font-bold" style={{ color: "#0DB87E" }}>
              {formatBRL(price)}
            </span>
          </div>
          <p className="font-sans text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
            {distanceKm}km · ~{durationMin} min
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!canConfirm}
        onClick={onConfirm}
        className="mt-4 w-full rounded-xl font-display font-semibold text-navy transition-opacity animate-pulse"
        style={{
          height: 52,
          background: "#00FF66",
          opacity: canConfirm ? 1 : 0.4,
        }}
      >
        Confirmar pedido
      </button>
    </Sheet>
  );
};

/* -------------------- SEARCHING Sheet -------------------- */
const SearchingSheet = ({
  estimatedPrice,
  origin,
  destination,
  type,
  onCancel,
  onMatch,
}: {
  estimatedPrice: number;
  origin: { address: string } | null;
  destination: { address: string } | null;
  type: RideType | null;
  onCancel: () => void;
  onMatch: () => void;
}) => {
  const [seconds, setSeconds] = useState(90);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // Auto-match removed - waiting for real-time match from Supabase

  const C = 213.6; // 2 * pi * 34
  const dash = (seconds / 90) * C;

  return (
    <Sheet>
      {seconds > 0 ? (
        <>
          <h2 className="font-display text-[18px] font-bold text-white text-center">
            Buscando mototaxista...
          </h2>
          <div className="flex justify-center mt-4">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke="#00FF66" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
                transform="rotate(-90 40 40)"
              />
              <text x="40" y="48" textAnchor="middle" fill="#00FF66" className="font-mono text-bet-neon" fontSize="22" fontWeight="800">
                {seconds}
              </text>
            </svg>
          </div>
        </>
      ) : (
        <div className="text-center py-2">
          <Clock size={32} style={{ color: "#F5A623" }} className="mx-auto" />
          <p className="font-display text-[16px] font-bold text-white mt-2">
            Nenhum mototaxista disponível no momento.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => setSeconds(90)} className="rounded-xl h-11 font-display font-bold text-navy" style={{ background: "#00FF66" }}>
              Tentar novamente
            </button>
            <button onClick={() => setSeconds(90)} className="rounded-xl h-11 font-sans font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
              Continuar aguardando
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.04)" }}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans text-[11px] font-semibold"
          style={{ background: "rgba(13,184,126,0.15)", color: "#0DB87E" }}
        >
          {type === "entrega" ? <Package size={12} /> : <Bike size={12} />}
          {type === "entrega" ? "Entrega" : "Carona"}
        </span>
        <p className="mt-2 font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          De: <span className="text-white">{origin?.address || "—"}</span>
        </p>
        <p className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          Para: <span className="text-white">{destination?.address || "—"}</span>
        </p>
        <p className="mt-1 font-display text-[16px] font-bold" style={{ color: "#0DB87E" }}>
          {formatBRL(estimatedPrice)}
        </p>
      </div>

      {seconds > 0 && (
        <button onClick={onCancel} className="mt-3 w-full h-11 rounded-xl font-sans text-[14px] font-medium" style={{ background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
          Cancelar
        </button>
      )}
    </Sheet>
  );
};

/* -------------------- ACCEPTED Sheet -------------------- */
const AcceptedSheet = ({
  prestador,
  durationMin,
  acceptedAt,
  onCancel,
  onArrive,
  onSendMessage,
}: {
  prestador: { name?: string; plate?: string; rating?: number };
  durationMin: number;
  acceptedAt: number;
  onCancel: () => void;
  onArrive: () => void;
  onSendMessage: (text: string) => void;
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const safeAcceptedAt = (acceptedAt && !isNaN(acceptedAt) && acceptedAt > 0) ? acceptedAt : now;
  const elapsed = Math.max(0, Math.floor((now - safeAcceptedAt) / 1000));
  const canCancelFree = elapsed < 60;
  const remaining = Math.max(0, 60 - elapsed);

  const prestadorName = prestador?.name || "Prestador";
  const initials = prestadorName.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "UB";
  const ratingVal = typeof prestador?.rating === "number" ? prestador.rating : 5.0;
  const plateVal = prestador?.plate || "UBT";

  return (
    <Sheet>
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(13,184,126,0.18)", border: "2px solid #0DB87E" }}
        >
          <span className="font-display font-bold text-white text-[18px]">{initials}</span>
        </div>
        <div className="flex-1">
          <p className="font-display text-[17px] font-bold text-white">{prestadorName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={12} fill={i <= Math.round(ratingVal) ? "#F5A623" : "transparent"} style={{ color: "#F5A623" }} />
            ))}
            <span className="ml-1 font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {ratingVal.toFixed(1)}
            </span>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full font-sans text-[12px] font-semibold text-white"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {plateVal}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Clock size={16} style={{ color: "#0DB87E" }} />
        <span className="font-sans text-[15px] font-medium text-white">
          Chegando em ~{durationMin || 5} min
        </span>
      </div>
      <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full" style={{ background: "#0DB87E", width: `${Math.min(100, (elapsed / ((durationMin || 5) * 60)) * 100)}%`, transition: "width 1s linear" }} />
      </div>

      <QuickStatusMessages role="tomador" onSendMessage={onSendMessage} className="mt-4" />

      {canCancelFree && (
        <button
          onClick={onCancel}
          className="mt-4 w-full h-11 rounded-xl font-sans text-[14px] font-semibold"
          style={{ background: "transparent", color: "#E84040", border: "1px solid rgba(232,64,64,0.35)" }}
        >
          Cancelar (gratuito por mais {remaining}s)
        </button>
      )}
    </Sheet>
  );
};

/* -------------------- IN_PROGRESS Sheet -------------------- */
const InProgressSheet = ({
  durationMin,
  onComplete,
  onSendMessage,
}: {
  durationMin: number;
  onComplete: () => void;
  onSendMessage: (text: string) => void;
}) => {
  const [showEmergency, setShowEmergency] = useState(false);

  return (
    <Sheet>
      <div className="flex items-center justify-between">
        <span
          className="px-3 py-1 rounded-full font-sans text-[12px] font-semibold"
          style={{ background: "rgba(13,184,126,0.15)", border: "1px solid #0DB87E", color: "#0DB87E" }}
        >
          Em andamento
        </span>
        <span className="font-sans text-[13px] text-white">
          Chegando em ~{durationMin || 5} min
        </span>
      </div>

      <QuickStatusMessages role="tomador" onSendMessage={onSendMessage} className="mt-4" />

      <button
        onClick={() => setShowEmergency(true)}
        className="mt-4 w-full h-11 rounded-xl flex items-center justify-center gap-2 font-sans text-[14px] font-semibold"
        style={{ background: "rgba(232,64,64,0.10)", border: "1px solid rgba(232,64,64,0.30)", color: "#E84040" }}
      >
        <ShieldAlert size={20} />
        Emergência
      </button>

      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6" onClick={() => setShowEmergency(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: "#132348" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[18px] font-bold text-white">Emergência</h3>
              <button onClick={() => setShowEmergency(false)} aria-label="Fechar">
                <X size={20} className="text-white" />
              </button>
            </div>
            <a href="tel:190" className="mt-4 block w-full h-12 rounded-xl flex items-center justify-center font-display font-semibold text-white" style={{ background: "#E84040" }}>
              Ligar 190
            </a>
            <button className="mt-2 w-full h-12 rounded-xl font-sans font-medium text-white" style={{ background: "rgba(255,255,255,0.06)" }}>
              Avisar contato
            </button>
            <button onClick={() => setShowEmergency(false)} className="mt-2 w-full h-12 rounded-xl font-sans" style={{ color: "rgba(255,255,255,0.6)" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
};

type PaymentMethodOption = "pix_scanner" | "pix_checkout" | "card" | "cash";

const CompletedScreen = ({
  price,
  distanceKm,
  durationMin,
  rideId,
  prestadorInfo,
  onPay,
}: {
  price: number;
  distanceKm: number;
  durationMin: number;
  rideId?: string;
  prestadorInfo?: any;
  onPay: () => void;
}) => {
  const user = useCurrentUser();
  const [method, setMethod] = useState<PaymentMethodOption>("pix_checkout");
  const [confirming, setConfirming] = useState(false);
  const [pixSeconds, setPixSeconds] = useState(300);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string>("");
  const [pixCopiaCola, setPixCopiaCola] = useState<string>("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [feeSettings, setFeeSettings] = useState<GatewayFeeSettings>(DEFAULT_FEE_SETTINGS);

  useEffect(() => {
    fetchGatewayFeeSettings().then(setFeeSettings);
  }, []);

  const rawBase = price > 0 ? price : 10.00;
  // Calculate fee mapping for split display
  const feeMethodType = (method === "card" ? "card" : "pix") as "pix" | "card";
  const feeCalc = calculatePaymentWithFee(rawBase, feeMethodType, feeSettings);

  useEffect(() => {
    if (method !== "pix_checkout") return;
    const id = setInterval(() => setPixSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [method]);
  const mm = String(Math.floor(pixSeconds / 60)).padStart(2, "0");
  const ss = String(pixSeconds % 60).padStart(2, "0");

  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const formatCardNumber = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatCardExpiry = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
  };

  const applyTestCard = (preset: "master" | "visa") => {
    if (preset === "master") {
      setCardNumber("4242 4242 4242 4242");
      setCardHolder("Felipe Santander");
      setCardExpiry("11/28");
      setCardCvv("123");
    } else {
      setCardNumber("5031 7557 3450 1234");
      setCardHolder("Silvina Luz");
      setCardExpiry("05/29");
      setCardCvv("789");
    }
  };

  // Broadcast & DB notify when selecting Pix Scanner, Cash, Card, etc.
  const handleSelectMethod = async (m: PaymentMethodOption) => {
    setMethod(m);
    setPaymentError(null);
    setQrCodeBase64("");
    setPixCopiaCola("");

    const methodMap: Record<PaymentMethodOption, string | null> = {
      cash: null,
      pix_scanner: "pix",
      pix_checkout: "pix",
      card: "card",
    };

    const dbMethod = methodMap[m] !== undefined ? methodMap[m] : null;

    if (rideId) {
      try {
        const updatePayload: { payment_method: string | null } = {
          payment_method: dbMethod,
        };
        
        const { error } = await supabase
          .from("mototaxi_corridas")
          .update(updatePayload)
          .eq("id", rideId);

        if (error) {
          console.error("Erro Supabase PATCH:", error.message, error.details, error.hint);
        }

        const channel = supabase
          .channel(`ride_msg_${rideId}`)
          .on("broadcast", { event: "payment_method_selected" }, () => {})
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              channel.send({
                type: "broadcast",
                event: "payment_method_selected",
                payload: { method: m, dbMethod, rideId, amount: feeCalc.totalAmount },
              });
            }
          });
      } catch (e: any) {
        console.error("Erro ao sincronizar escolha de pagamento:", e?.message || e);
      }
    }

    // Se for Pix (Scanner ou no Celular), aciona automaticamente a Edge Function para gerar o QR Code real transparente
    if (m === "pix_scanner" || m === "pix_checkout") {
      await handleProcessPayment("pix", m);
    }
  };

  // Helper para tokenizar cartão diretamente no Mercado Pago API
  const tokenizeCard = async (cleanNum: string, name: string, expMonth: number, expYear: number, cvv: string): Promise<string> => {
    const mpPublicKey =
      import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY ||
      import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY;

    if (!mpPublicKey || !mpPublicKey.trim() || mpPublicKey.trim() === "undefined") {
      throw new Error("Chave pública do Mercado Pago (VITE_MERCADOPAGO_PUBLIC_KEY) não está configurada no ambiente.");
    }

    const cleanKey = mpPublicKey.trim();
    const payload = {
      cardNumber: cleanNum,
      card_number: cleanNum,
      cardholder: {
        name: name || "APRO TEST USER",
        identification: {
          type: "CPF",
          number: "19119119100",
        },
      },
      cardExpirationMonth: expMonth,
      card_expiration_month: expMonth,
      expiration_month: expMonth,
      cardExpirationYear: expYear,
      card_expiration_year: expYear,
      expiration_year: expYear,
      securityCode: cvv || "123",
      security_code: cvv || "123",
    };

    console.log("[MercadoPago Tokenize] Enviando payload para /v1/card_tokens:", {
      ...payload,
      cardNumber: `***${cleanNum.slice(-4)}`,
      card_number: `***${cleanNum.slice(-4)}`,
    });

    const res = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(cleanKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[MercadoPago Tokenize] Resposta MP:", res.status, data);

    if (res.ok && data?.id) {
      return data.id;
    }

    const errMessage =
      data?.message ||
      (Array.isArray(data?.cause) && data.cause[0]?.description) ||
      data?.error ||
      `Erro ${res.status} ao tokenizar cartão no Mercado Pago`;

    console.error("Erro na tokenização Mercado Pago (Status " + res.status + "):", data);
    throw new Error(`Falha na tokenização do cartão: ${errMessage}`);
  };

  // Direct fetch to payment-gateway Edge Function (unmasking 400 details)
  const handleProcessPayment = async (paymentType: "pix" | "card", targetMethod?: PaymentMethodOption) => {
    setIsLoading(true);
    setPaymentError(null);
    const finalAmount = Number(feeCalc.totalAmount.toFixed(2));
    try {
      const cardClean = cardNumber.replace(/\s+/g, "");
      const [rawMonth, rawYear] = (cardExpiry || "").split("/");
      const expMonth = parseInt(rawMonth || "12", 10);
      const expYear = parseInt(rawYear ? (rawYear.length === 2 ? `20${rawYear}` : rawYear) : "2028", 10);

      const paymentMethodId = paymentType === "pix" ? "pix" : (cardClean.startsWith("5") ? "master" : "visa");
      
      let cardToken: string | undefined = undefined;
      if (paymentType === "card") {
        if (!cardClean || cardClean.length < 13) {
          setIsLoading(false);
          setPaymentError("Por favor, informe os dados completos do cartão.");
          return;
        }

        const generatedToken = await tokenizeCard(cardClean, cardHolder, expMonth, expYear, cardCvv);
        if (!generatedToken || typeof generatedToken !== "string" || generatedToken.length < 15) {
          throw new Error("Token de cartão inválido ou vazio retornado pelo gateway.");
        }
        cardToken = generatedToken;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bexbgvsqgjhjuhupkdfp.supabase.co";
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJleGJndnNxZ2poanVodXBrZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NDY1MDgsImV4cCI6MjA2MjMyMjUwOH0.B8L4tLlhK8Q-8M5rZ1M6Vq1bZkE6Z8c7zK2g5jY1e7E";
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token || anonKey;

      const payloadParaEdge = {
        action: "create_payment_intent",
        service_type: "mototaxi",
        service_id: rideId || "00000000-0000-0000-0000-000000000001",
        external_reference: rideId || undefined,
        transaction_amount: finalAmount,
        provider_id: prestadorInfo?.id || "0a5edf64-7585-401f-b310-126529607da0",
        provider_name: prestadorInfo?.name || "Silvina Luz",
        payer_email: "TESTUSER367958859718560557@testuser.com",
        payer_first_name: "APRO",
        payer_last_name: "TEST USER",
        payer_identification: {
          type: "CPF",
          number: "85311283087",
        },
        description: `Corrida UBT Mototáxi - ${formatBRL(finalAmount)} (Split 7 Vias)`,
        payment_method_id: paymentMethodId,
        // INJEÇÃO OBRIGATÓRIA DO TOKEN AQUI:
        token: cardToken,
        card_token: cardToken,
        card_token_id: cardToken,
        card_data: paymentType === "card" ? {
          number: cardClean,
          cardholder_name: cardHolder || "APRO TEST USER",
          expiration_month: expMonth,
          expiration_year: expYear,
          security_code: cardCvv || "123",
        } : undefined,
      };

      console.log("PAYLOAD COMPLETO PARA EDGE (COM TOKEN):", payloadParaEdge);

      const { data, error: invokeError } = await supabase.functions.invoke("payment-gateway", {
        body: payloadParaEdge,
      });

      if (invokeError || !data || data.error) {
        const errMain = data?.error || invokeError?.message || "Pagamento rejeitado pelo gateway";
        let errDetails = "";
        if (data?.details) {
          errDetails = typeof data.details === "object" ? JSON.stringify(data.details) : String(data.details);
        } else if (data?.detail) {
          errDetails = data.detail;
        } else if (data?.message) {
          errDetails = data.message;
        }
        throw new Error(errDetails ? `${errMain} (${errDetails})` : errMain);
      }

      if (data?.split?.statement) {
        console.log("✅ [UBT Split Engine 7 Vias Extrato]:\n" + data.split.statement);
      }

      if (data?.pix?.qr_code_base64 || data?.pix?.qr_code) {
        if (data.pix.qr_code_base64) {
          setQrCodeBase64(data.pix.qr_code_base64);
        }
        if (data.pix.qr_code) {
          setPixCopiaCola(data.pix.qr_code);
        }

        // Se o método for Pix Scanner, transmite os dados do QR code gerado para a tela do motorista via Realtime
        const currentMethod = targetMethod || method;
        if (currentMethod === "pix_scanner" && rideId) {
          try {
            const channel = supabase
              .channel(`ride_msg_${rideId}`)
              .on("broadcast", { event: "pix_qr_ready" }, () => {})
              .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                  channel.send({
                    type: "broadcast",
                    event: "pix_qr_ready",
                    payload: {
                      rideId,
                      qr_code_base64: data.pix.qr_code_base64,
                      qr_code: data.pix.qr_code,
                      amount: finalAmount,
                    },
                  });
                }
              });
          } catch (bErr) {
            console.warn("Aviso ao transmitir pix_qr_ready:", bErr);
          }
        }
      } else {
        if (rideId) {
          try {
            const { error: updateErr } = await supabase
              .from("mototaxi_corridas")
              .update({ status: "paid" })
              .eq("id", rideId);
            if (updateErr) {
              console.error("Erro Supabase PATCH ao marcar paid:", updateErr.message, updateErr.details, updateErr.hint);
            }
          } catch (e: any) {
            console.error("Erro ao atualizar status para paid:", e?.message || e);
          }
        }
        setConfirming(true);
        setTimeout(onPay, 1500);
      }
    } catch (err: any) {
      console.error("Payment failed:", err);
      const msg = err?.message || "Erro no processamento do pagamento.";
      setPaymentError(msg);
      toast.error(`Falha no pagamento: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixCopiaCola) {
      navigator.clipboard.writeText(pixCopiaCola);
      setCopiedPix(true);
      toast.success("Código Pix copiado com sucesso!");
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleConfirmManualPaid = async () => {
    if (rideId) {
      try {
        const { error: updateErr } = await supabase
          .from("mototaxi_corridas")
          .update({ status: "paid" })
          .eq("id", rideId);
        if (updateErr) {
          console.error("Erro Supabase PATCH manual paid:", updateErr.message, updateErr.details, updateErr.hint);
        }
      } catch (e: any) {
        console.error("Erro ao atualizar status para paid:", e?.message || e);
      }
    }
    setConfirming(true);
    setTimeout(onPay, 1500);
  };

  return (
    <div className="min-h-[100svh] bg-navy text-white overflow-y-auto" style={{ padding: "24px 24px 96px" }}>
      <h1 className="font-display text-[22px] font-bold">Resumo e Pagamento</h1>

      <div className="mt-4 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="flex justify-between font-sans text-[14px]">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Tipo</span>
          <span>Carona</span>
        </div>
        <div className="flex justify-between font-sans text-[14px] mt-1.5">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Distância</span>
          <span>{distanceKm}km</span>
        </div>
        <div className="flex justify-between font-sans text-[14px] mt-1.5">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Duração aprox.</span>
          <span>{durationMin} min</span>
        </div>
        <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        
        {/* Dynamic Split Breakdown */}
        <SplitBreakdown total={feeCalc.totalAmount} />
        
        <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Detailed Price & Fee Display */}
        <div className="space-y-1">
          <div className="flex justify-between font-sans text-[13px] text-white/60">
            <span>Tarifa base:</span>
            <span>{formatBRL(feeCalc.baseAmount)}</span>
          </div>
          {feeCalc.feeAmount > 0 && (
            <div className="flex justify-between font-sans text-[13px] text-[#F5A623]">
              <span>Taxa gateway ({feeCalc.feePercentage}%):</span>
              <span>+ {formatBRL(feeCalc.feeAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-[18px] font-bold text-white pt-1">
            <span>Total a pagar</span>
            <span style={{ color: "#0DB87E" }}>{formatBRL(feeCalc.totalAmount)}</span>
          </div>
        </div>
      </div>

      <p className="mt-6 font-sans text-[12px] font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
        Escolha como deseja pagar
      </p>

      {/* 3 DIRECT PAYMENT BUTTONS (Opção Em Dinheiro ocultada temporariamente para testes de Gateway) */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {/* 1. Pix Scanner */}
        <button
          type="button"
          onClick={() => handleSelectMethod("pix_scanner")}
          className="rounded-2xl p-3 flex flex-col items-start text-left transition-all active:scale-[0.98]"
          style={{
            background: method === "pix_scanner" ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)",
            border: method === "pix_scanner" ? "2px solid #0DB87E" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: method === "pix_scanner" ? "#0DB87E" : "rgba(255,255,255,0.08)" }}>
            <Scan size={18} className={method === "pix_scanner" ? "text-white" : "text-white/70"} />
          </div>
          <span className="font-display text-[12px] font-bold leading-tight">Pix Scanner</span>
          <span className="font-sans text-[10px] text-white/50 mt-0.5">QR no motorista</span>
        </button>

        {/* 2. Pix Checkout */}
        <button
          type="button"
          onClick={() => handleSelectMethod("pix_checkout")}
          className="rounded-2xl p-3 flex flex-col items-start text-left transition-all active:scale-[0.98]"
          style={{
            background: method === "pix_checkout" ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)",
            border: method === "pix_checkout" ? "2px solid #0DB87E" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: method === "pix_checkout" ? "#0DB87E" : "rgba(255,255,255,0.08)" }}>
            <Smartphone size={18} className={method === "pix_checkout" ? "text-white" : "text-white/70"} />
          </div>
          <span className="font-display text-[12px] font-bold leading-tight">Pix Celular</span>
          <span className="font-sans text-[10px] text-white/50 mt-0.5">Copia e Cola</span>
        </button>

        {/* 3. Cartão de Crédito */}
        <button
          type="button"
          onClick={() => handleSelectMethod("card")}
          className="rounded-2xl p-3 flex flex-col items-start text-left transition-all active:scale-[0.98]"
          style={{
            background: method === "card" ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)",
            border: method === "card" ? "2px solid #0DB87E" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: method === "card" ? "#0DB87E" : "rgba(255,255,255,0.08)" }}>
            <CreditCard size={18} className={method === "card" ? "text-white" : "text-white/70"} />
          </div>
          <span className="font-display text-[12px] font-bold leading-tight">Cartão</span>
          <span className="font-sans text-[10px] text-white/50 mt-0.5">Crédito online</span>
        </button>
      </div>

      {/* METHOD CONTENT 1: PIX SCANNER */}
      {method === "pix_scanner" && (
        <div className="mt-4 rounded-2xl p-5 bg-white/5 border border-white/10 text-center flex flex-col items-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#0DB87E]/20 border border-[#0DB87E]/40 flex items-center justify-center mb-3">
            <Scan size={28} className="text-[#0DB87E]" />
          </div>
          <h3 className="font-display text-[16px] font-bold text-white">QR Code no celular do motorista</h3>
          
          {isLoading ? (
            <div className="my-4 py-4 flex flex-col items-center justify-center">
              <span className="w-8 h-8 rounded-full border-2 border-[#0DB87E] border-t-transparent animate-spin mb-2" />
              <p className="font-sans text-[13px] text-white/70">Gerando cobrança Pix transparente no Mercado Pago...</p>
            </div>
          ) : (
            <>
              <p className="font-sans text-[13px] text-white/70 mt-1.5 leading-relaxed">
                O QR Code gerado pelo Mercado Pago já foi enviado para a tela do motorista. Abra o aplicativo do seu banco, escolha <strong>Pix &gt; Ler QR Code</strong> e aponte a câmera.
              </p>
              {pixCopiaCola && (
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="mt-3 w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-sans text-[12px] flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  {copiedPix ? <Check size={14} className="text-[#0DB87E]" /> : <Copy size={14} />}
                  {copiedPix ? "Código Pix Copiado!" : "Ou copiar código Copia e Cola"}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleConfirmManualPaid}
            className="mt-5 w-full h-12 rounded-xl font-display font-semibold text-white bg-[#0DB87E] active:scale-[0.98] transition-all"
          >
            Já realizei o Pix no QR Code
          </button>
        </div>
      )}

      {/* METHOD CONTENT 2: PIX CHECKOUT (NO CELULAR - COPIA E COLA APENAS, SEM QR CODE VISUAL) */}
      {method === "pix_checkout" && (
        <div className="mt-4 rounded-2xl p-5 flex flex-col items-center bg-white/5 border border-white/10">
          <div className="w-12 h-12 rounded-full bg-[#0DB87E]/20 flex items-center justify-center mb-2">
            <Smartphone size={24} className="text-[#0DB87E]" />
          </div>
          <h3 className="font-display text-[16px] font-bold text-white">Pix no Celular (Copia e Cola)</h3>
          <p className="font-sans text-[12px] text-white/70 text-center mt-1 mb-3">
            Copie o código abaixo e cole no aplicativo do seu banco:
          </p>

          {isLoading ? (
            <div className="w-full py-6 rounded-xl flex flex-col items-center justify-center bg-white/5 border border-white/10 my-2">
              <span className="w-8 h-8 rounded-full border-2 border-[#0DB87E] border-t-transparent animate-spin mb-3" />
              <p className="font-sans text-[12px] text-white/70 text-center px-2">Gerando chave Pix no Mercado Pago...</p>
            </div>
          ) : pixCopiaCola ? (
            <div className="w-full space-y-3">
              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  value={pixCopiaCola}
                  className="w-full rounded-xl p-3 bg-black/40 border border-white/15 text-white font-mono text-[11px] leading-relaxed resize-none outline-none select-all"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full py-3 px-4 rounded-xl bg-[#0DB87E] hover:bg-[#0DB87E]/90 text-white font-sans text-[13px] font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
              >
                {copiedPix ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                {copiedPix ? "Código Pix Copiado!" : "Copiar Código Pix Copia e Cola"}
              </button>

              <p className="font-mono text-[12px] font-semibold text-center text-[#F5A623]">
                Expira em {mm}:{ss}
              </p>
            </div>
          ) : (
            <div className="w-full py-4 rounded-xl flex flex-col items-center justify-center bg-white/5 border border-white/10">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleProcessPayment("pix", "pix_checkout")}
                className="px-5 py-2.5 rounded-xl bg-[#0DB87E] text-white font-sans text-[13px] font-semibold active:scale-95 transition-all shadow-md"
              >
                Gerar Código Pix
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmManualPaid}
            className="mt-4 w-full h-11 rounded-xl font-display font-semibold text-white/90 border border-white/20 hover:bg-white/10 active:scale-98 transition-all text-[13px]"
          >
            Já Paguei no meu Banco
          </button>
        </div>
      )}

      {/* METHOD CONTENT 3: CARTÃO DE CRÉDITO */}
      {method === "card" && (
        <div className="mt-4 rounded-2xl p-4 bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-sans text-[12px] font-semibold text-white/70">Cartão de Crédito</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => applyTestCard("master")}
                className="px-2 py-0.5 rounded bg-emerald-500/20 text-[#0DB87E] text-[10px] font-mono hover:bg-emerald-500/30"
              >
                Teste Master
              </button>
              <button
                type="button"
                onClick={() => applyTestCard("visa")}
                className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono hover:bg-blue-500/30"
              >
                Teste Visa
              </button>
            </div>
          </div>

          <div>
            <label className="block font-sans text-[11px] text-white/60 mb-1">Número do Cartão</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000"
              className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[14px] outline-none focus:border-[#0DB87E]"
              maxLength={19}
            />
          </div>

          <div>
            <label className="block font-sans text-[11px] text-white/60 mb-1">Nome no Cartão</label>
            <input
              type="text"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              placeholder="NOME COMO NO CARTÃO"
              className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-sans text-[13px] uppercase outline-none focus:border-[#0DB87E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-sans text-[11px] text-white/60 mb-1">Validade (MM/AA)</label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                placeholder="MM/AA"
                className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[13px] outline-none focus:border-[#0DB87E]"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block font-sans text-[11px] text-white/60 mb-1">CVV</label>
              <input
                type="password"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[13px] outline-none focus:border-[#0DB87E]"
                maxLength={4}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleProcessPayment("card")}
            className="mt-3 w-full h-12 rounded-xl font-display font-semibold text-white flex items-center justify-center bg-[#0DB87E] active:scale-[0.98] transition-all"
            style={{ opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : (
              `Pagar com Cartão (${formatBRL(feeCalc.totalAmount)})`
            )}
          </button>
        </div>
      )}

      {/* METHOD CONTENT 4: EM DINHEIRO */}
      {method === "cash" && (
        <div className="mt-4 rounded-2xl p-5 bg-white/5 border border-white/10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#F5A623]/20 border border-[#F5A623]/40 flex items-center justify-center mb-3">
            <Banknote size={28} className="text-[#F5A623]" />
          </div>
          <h3 className="font-display text-[16px] font-bold text-white">Pagamento Presencial em Dinheiro</h3>
          <p className="font-sans text-[13px] text-white/70 mt-1.5 leading-relaxed">
            Entregue o valor de <strong>{formatBRL(feeCalc.baseAmount)}</strong> em cédula ou moeda ao motorista.
          </p>
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans text-[12px] flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            Aguardando confirmação do motorista...
          </div>
        </div>
      )}

      {paymentError && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium flex items-center justify-between gap-2">
          <span>⚠️ {paymentError}</span>
          <button
            type="button"
            onClick={() => setPaymentError(null)}
            className="text-red-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center relative overflow-hidden" style={{ background: "rgba(11,27,62,0.95)" }}>
          <Confetti numberOfPieces={200} recycle={false} />
          <CheckCircle2 size={80} style={{ color: "#0DB87E", animation: "ubt-scale-in 400ms ease-out" }} />
          <p className="mt-4 font-display text-[20px] font-bold text-white">Pagamento confirmado!</p>
        </div>
      )}
    </div>
  );
};

/* -------------------- RATING Screen -------------------- */
const RatingScreen = ({
  prestador,
  onSubmit,
}: {
  prestador: { name: string };
  onSubmit: () => void;
}) => {
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);
  const [comment, setComment] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        onSubmit();
        sessionStorage.removeItem("ubt_active_ride");
        navigate("/app/home");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [done, navigate, onSubmit]);

  const initials = prestador.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  if (done) {
    return (
      <div className="min-h-[100svh] bg-navy text-white flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        <Confetti numberOfPieces={250} recycle={false} />
        <Trophy size={64} style={{ color: "#F5A623" }} />
        <h2 className="mt-4 font-display text-[22px] font-bold">Obrigado!</h2>
        <p className="mt-2 font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          Você está no sorteio de R$ 10.000 em 01/05! 🎉
        </p>
        <span className="mt-3 px-3 py-1 rounded-full font-sans text-[12px] font-semibold" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid #F5A623", color: "#F5A623" }}>
          Sorteio: 01/05
        </span>
        <button
          onClick={() => {
            onSubmit();
            sessionStorage.removeItem("ubt_active_ride");
            navigate("/app/home");
          }}
          className="mt-6 w-full max-w-xs h-12 rounded-xl font-display font-semibold text-white"
          style={{ background: "#0DB87E" }}
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-navy text-white overflow-y-auto" style={{ padding: "24px 24px 96px" }}>
      <div className="flex flex-col items-center mt-10">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
          style={{ background: "rgba(13,184,126,0.18)", border: "3px solid #0DB87E" }}
        >
          <span className="font-display font-bold text-white text-[22px]">{initials}</span>
        </div>
        <p className="mt-3 font-display text-[20px] font-bold">{prestador.name}</p>
        <p className="mt-1 font-sans text-[15px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          Como foi sua experiência?
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {[1,2,3,4,5].map((i) => (
          <button key={i} onClick={() => setRating(i)} aria-label={`${i} estrelas`}>
            <Star
              size={40}
              fill={i <= rating ? "#F5A623" : "transparent"}
              style={{ color: i <= rating ? "#F5A623" : "rgba(255,255,255,0.15)", transition: "transform 200ms" }}
            />
          </button>
        ))}
      </div>

      <label className="mt-6 block font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
        Comentário (opcional)
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-1 w-full rounded-xl p-3 font-sans text-[14px] text-white outline-none resize-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", height: 100 }}
      />

      <button
        disabled={rating === 0}
        onClick={() => setDone(true)}
        className="mt-6 w-full h-12 rounded-xl font-display font-semibold text-white"
        style={{ background: "#0DB87E", opacity: rating === 0 ? 0.4 : 1 }}
      >
        Enviar avaliação
      </button>
    </div>
  );
};

/* ====================================================== */
/* Main page                                              */
/* ====================================================== */
const MototaxiTomadorPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { state, setState, resetRide } = useRide();
  const [center, setCenter] = useState(UBATUBA_FALLBACK);
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<string>("");
  const [prefData, setPrefData] = useState<any>(null);
  const [incomingMessage, setIncomingMessage] = useState<{ text: string; sender: string } | null>(null);
  const initOnce = useRef(false);
  const msgChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!state.rideId) return;

    let channel: any = null;

    const setupMsgChannel = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      channel = supabase.channel(`ride_msg_${state.rideId}`);
      channel
        .on('broadcast', { event: 'quick_message' }, ({ payload }) => {
          if (payload?.from === 'prestador') {
            setState((prev) => ({
              ...prev,
              messages: [...(prev.messages || []), payload]
            }));
            if (payload?.text) {
              setIncomingMessage({
                text: payload.text,
                sender: 'Motorista',
              });
            }
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            msgChannelRef.current = channel;
          }
        });
    };

    setupMsgChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
          msgChannelRef.current = null;
        }
      } else if (document.visibilityState === "visible") {
        setupMsgChannel();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
        msgChannelRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", setupMsgChannel);

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      msgChannelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", setupMsgChannel);
    };
  }, [state.rideId]);

  useEffect(() => {
    if (incomingMessage) {
      const timer = setTimeout(() => setIncomingMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingMessage]);

  // Monitor ride state transitions to "completed" to trigger the Mercado Pago Split simulated flow
  useEffect(() => {
    if (state.status === "completed" && !prefData && !isProcessingPayment) {
      const runPaymentMock = async () => {
        setIsProcessingPayment(true);
        setPaymentStep("Conectando ao Sandbox do Mercado Pago...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPaymentStep("Criando preferência de checkout com rateio de split...");
        try {
          const res = await createPreference(
            state.finalPrice || state.estimatedPrice,
            state.rideId || "mock-ride-id",
            state.paymentMethod || "pix"
          );
          setPrefData(res);
        } catch (err) {
          console.error(err);
        }
        
        setPaymentStep("Validando credenciais do Motor Financeiro...");
        await new Promise(resolve => setTimeout(resolve, 800));

        setPaymentStep("Finalizando integração de split...");
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setIsProcessingPayment(false);
      };
      runPaymentMock();
    }
  }, [state.status, state.finalPrice, state.estimatedPrice, state.rideId, state.paymentMethod, prefData, isProcessingPayment]);

  // Geolocation init
  useEffect(() => {
    if (initOnce.current) return;
    initOnce.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(c);
        if (!state.origin) {
          setState({ origin: { ...c, address: "Sua localização atual" } });
        }
      },
      () => {
        if (!state.origin) {
          setState({ origin: { ...UBATUBA_FALLBACK, address: "Ubatuba, SP" } });
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Distance/duration when both points are set
  useEffect(() => {
    if (!state.origin || !state.destination) return;
    const R = 6371;
    const dLat = ((state.destination.lat - state.origin.lat) * Math.PI) / 180;
    const dLng = ((state.destination.lng - state.origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((state.origin.lat * Math.PI) / 180) *
        Math.cos((state.destination.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const km = +(2 * R * Math.asin(Math.sqrt(a))).toFixed(1);
    setState({
      distanceKm: km,
      durationMin: Math.max(3, Math.round(km * 3)),
      estimatedPrice: calcPrice(km),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.origin, state.destination]);

  // Buscar motoristas online em tempo real com polling de contingência e suporte a bfcache
  useEffect(() => {
    let channel: any = null;

    const fetchOnlineDrivers = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data, error } = await supabase
        .from('mototaxi_sessoes')
        .select('*')
        .eq('is_online', true);
      if (!error && data) {
        setOnlineDrivers(data);
      }
    };

    fetchOnlineDrivers();
    const pollInterval = setInterval(fetchOnlineDrivers, 3000);

    const setupSessionChannel = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      channel = supabase
        .channel('mototaxi_sessoes_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mototaxi_sessoes' },
          () => {
            fetchOnlineDrivers();
          }
        )
        .subscribe();
    };

    setupSessionChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
        }
      } else if (document.visibilityState === "visible") {
        fetchOnlineDrivers();
        setupSessionChannel();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", setupSessionChannel);

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", setupSessionChannel);
    };
  }, []);

  // Escuta atualizações da corrida em tempo real com polling contínuo de 2s e suporte a bfcache
  useEffect(() => {
    if (!state.rideId) return;

    let channel: any = null;

    const syncCurrentStatus = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data: dbRide, error } = await supabase
        .from('mototaxi_corridas')
        .select('*')
        .eq('id', state.rideId)
        .single();

      if (dbRide && !error) {
        if (dbRide.status === 'accepted') {
          let prestadorInfo = null;
          if (dbRide.prestador_id) {
            const { data: userData } = await supabase
              .from('usuarios')
              .select('nome')
              .eq('id', dbRide.prestador_id)
              .single();

            const { data: sessData } = await supabase
              .from('mototaxi_sessoes')
              .select('lat, lng')
              .eq('prestador_id', dbRide.prestador_id)
              .single();

            prestadorInfo = {
              name: userData?.nome || 'Motorista UBT',
              photo: '',
              plate: 'MTX-' + dbRide.prestador_id.slice(0, 4).toUpperCase(),
              rating: 4.8
            };

            setState({
              status: 'accepted',
              acceptedAt: dbRide.accepted_at ? new Date(dbRide.accepted_at).getTime() : Date.now(),
              prestadorInfo,
              prestadorLocation: sessData ? { lat: Number(sessData.lat), lng: Number(sessData.lng) } : (state.origin ? { lat: state.origin.lat - 0.005, lng: state.origin.lng - 0.005 } : null)
            });
          }
        } else if (dbRide.status === 'in_progress') {
          setState({ status: 'in_progress' });
        } else if (dbRide.status === 'completed') {
          setState({
            status: 'completed',
            finalPrice: dbRide.final_price || dbRide.estimated_price
          });
        } else if (dbRide.status === 'cancelled') {
          alert('A corrida foi cancelada.');
          resetRide();
        }
      }
    };

    syncCurrentStatus();
    const pollInterval = setInterval(syncCurrentStatus, 2000);

    const setupStatusChannel = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      channel = supabase
        .channel(`ride_status_${state.rideId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mototaxi_corridas', filter: `id=eq.${state.rideId}` },
          async (payload: any) => {
            if (payload.new) {
              const dbRide = payload.new;
              if (dbRide.status === 'accepted') {
                let prestadorInfo = null;
                if (dbRide.prestador_id) {
                  const { data: userData } = await supabase
                    .from('usuarios')
                    .select('nome')
                    .eq('id', dbRide.prestador_id)
                    .single();

                  const { data: sessData } = await supabase
                    .from('mototaxi_sessoes')
                    .select('lat, lng')
                    .eq('prestador_id', dbRide.prestador_id)
                    .single();

                  prestadorInfo = {
                    name: userData?.nome || 'Motorista UBT',
                    photo: '',
                    plate: 'MTX-' + dbRide.prestador_id.slice(0, 4).toUpperCase(),
                    rating: 4.8
                  };

                  setState({
                    status: 'accepted',
                    acceptedAt: dbRide.accepted_at ? new Date(dbRide.accepted_at).getTime() : Date.now(),
                    prestadorInfo,
                    prestadorLocation: sessData ? { lat: Number(sessData.lat), lng: Number(sessData.lng) } : (state.origin ? { lat: state.origin.lat - 0.005, lng: state.origin.lng - 0.005 } : null)
                  });
                }
              } else if (dbRide.status === 'in_progress') {
                setState({ status: 'in_progress' });
              } else if (dbRide.status === 'completed') {
                setState({
                  status: 'completed',
                  finalPrice: dbRide.final_price || dbRide.estimated_price
                });
              } else if (dbRide.status === 'cancelled') {
                alert('A corrida foi cancelada.');
                resetRide();
              }
            }
          }
        )
        .subscribe();
    };

    setupStatusChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
        }
      } else if (document.visibilityState === "visible") {
        syncCurrentStatus();
        setupStatusChannel();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", setupStatusChannel);

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", setupStatusChannel);
    };
  }, [state.rideId]);

  // Escuta a localização em tempo real do prestador aceito e em andamento com suporte a bfcache
  useEffect(() => {
    if ((state.status !== 'accepted' && state.status !== 'in_progress') || !state.prestadorInfo || !state.rideId) return;

    let activePrestadorId: string | null = null;
    let channel: any = null;

    const fetchAndSubscribePrestadorLoc = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const { data: dbRide } = await supabase
        .from('mototaxi_corridas')
        .select('prestador_id')
        .eq('id', state.rideId)
        .single();

      if (dbRide?.prestador_id) {
        activePrestadorId = dbRide.prestador_id;
        
        const { data: sessData } = await supabase
          .from('mototaxi_sessoes')
          .select('lat, lng')
          .eq('prestador_id', activePrestadorId)
          .single();

        if (sessData) {
          setState({ prestadorLocation: { lat: Number(sessData.lat), lng: Number(sessData.lng) } });
        }

        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
        }

        channel = supabase
          .channel(`driver_loc_${activePrestadorId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'mototaxi_sessoes', filter: `prestador_id=eq.${activePrestadorId}` },
            (payload: any) => {
              if (payload.new) {
                const driverLat = Number(payload.new.lat);
                const driverLng = Number(payload.new.lng);
                setState({ prestadorLocation: { lat: driverLat, lng: driverLng } });

                // Regra 1: Distancia cliente-motorista superior a 100m durante a corrida
                if (state.status === 'in_progress' && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const clientLat = pos.coords.latitude;
                    const clientLng = pos.coords.longitude;
                    
                    const R = 6371000; // metros
                    const dLat = ((driverLat - clientLat) * Math.PI) / 180;
                    const dLng = ((driverLng - clientLng) * Math.PI) / 180;
                    const a =
                      Math.sin(dLat / 2) ** 2 +
                      Math.cos((clientLat * Math.PI) / 180) *
                        Math.cos((driverLat * Math.PI) / 180) *
                        Math.sin(dLng / 2) ** 2;
                    const distMeters = 2 * R * Math.asin(Math.sqrt(a));

                    if (distMeters > 100) {
                      supabase
                        .from('telemetry_flags')
                        .insert({
                          ride_id: state.rideId,
                          flag_type: 'driver_client_distance',
                          severity: 'critical',
                          metadata: {
                            driver_lat: driverLat,
                            driver_lng: driverLng,
                            client_lat: clientLat,
                            client_lng: clientLng,
                            distance_meters: distMeters,
                            message: 'Distancia cliente-motorista superior a 100 metros durante corrida.'
                          }
                        })
                        .then(({ error }) => {
                          if (error) console.error('Erro ao registrar flag de telemetria:', error);
                        });
                    }
                  });
                }
              }
            }
          )
          .subscribe();
      }
    };

    fetchAndSubscribePrestadorLoc();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
        }
      } else if (document.visibilityState === "visible") {
        fetchAndSubscribePrestadorLoc();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", fetchAndSubscribePrestadorLoc);

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", fetchAndSubscribePrestadorLoc);
    };
  }, [state.status, state.rideId]);

  const handleConfirm = async () => {
    if (!state.origin || !state.destination) return;
    const startTime = Date.now();

    let tomadorId = user.uid;
    if (!tomadorId) {
      const { data: authData } = await supabase.auth.getUser();
      tomadorId = authData?.user?.id || "";
    }

    if (!tomadorId) {
      toast.error("Por favor, faça login para solicitar a corrida.");
      return;
    }

    // Validar Geofence de Origem e Destino (Aviso informativo para permitir testes)
    const originGeo = validateGeofence(state.origin.address, { lat: state.origin.lat, lng: state.origin.lng });
    const destGeo = validateGeofence(state.destination.address, { lat: state.destination.lat, lng: state.destination.lng });

    if (!originGeo.inside && !destGeo.inside) {
      console.warn("[Geofence] Chamada iniciada fora do perímetro padrão de Ubatuba:", { origin: state.origin, destination: state.destination });
    }

    const newRide = {
      tomador_id: tomadorId,
      status: 'searching',
      type: state.type || 'carona',
      origin: {
        lat: state.origin.lat,
        lng: state.origin.lng,
        address: state.origin.address
      },
      destination: {
        lat: state.destination.lat,
        lng: state.destination.lng,
        address: state.destination.address
      },
      distance_km: state.distanceKm,
      duration_min: state.durationMin,
      estimated_price: state.estimatedPrice,
      payment_method: state.paymentMethod || 'pix'
    };

    console.log('[AUDIT MototaxiTomador] Enviando INSERT em mototaxi_corridas:', newRide);

    const { data, error } = await supabase
      .from('mototaxi_corridas')
      .insert(newRide)
      .select()
      .single();

    const duration = Date.now() - startTime;

    console.log('[AUDIT MototaxiTomador] Resposta do Supabase INSERT:', {
      success: !error,
      data,
      error,
      insertedId: data?.id,
      status: data?.status
    });

    if (error) {
      console.error('[AUDIT MototaxiTomador] Erro fatal no INSERT de corrida:', error);
      logSystem("ERROR", "MOTOTAXI", "ride_requested", "failed", duration, error.message, error.code, { type: state.type });
      alert(`Erro ao solicitar mototáxi: ${error.message || 'Falha no banco de dados'}`);
      return;
    }

    // Broadcast de contingência instantâneo para prestadores online
    try {
      const broadcastChan = supabase
        .channel('mototaxi_chamados_broadcast')
        .on('broadcast', { event: 'new_chamado' }, () => {})
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            broadcastChan.send({
              type: 'broadcast',
              event: 'new_chamado',
              payload: {
                id: data.id,
                type: data.type || state.type,
                origin: data.origin,
                destination: data.destination,
                distance_km: data.distance_km,
                duration_min: data.duration_min,
                estimated_price: data.estimated_price,
              }
            });
          }
        });
    } catch (e) {
      console.warn('Erro ao enviar broadcast do chamado:', e);
    }

    trackEvent("ride_requested", "operational", { vertical: "mototaxi", type: state.type, price: state.estimatedPrice, distance_km: state.distanceKm });
    logSystem("INFO", "MOTOTAXI", "ride_requested", "success", duration, undefined, undefined, { type: state.type, price: state.estimatedPrice });

    setState({
      status: 'searching',
      rideId: data.id
    });
  };

  const handleCancel = async () => {
    if (state.rideId) {
      trackEvent("ride_cancelled", "operational", { vertical: "mototaxi", ride_id: state.rideId });
      logSystem("INFO", "MOTOTAXI", "ride_cancelled", "success", undefined, undefined, undefined, { ride_id: state.rideId });
      await supabase
        .from('mototaxi_corridas')
        .update({ status: 'cancelled' })
        .eq('id', state.rideId);
    }
    resetRide();
  };

  const handleMatch = () => {
    // Left as fallback signature, logic is handled via Supabase subscription
  };

  const handleArrive = () => setState({ status: "in_progress" });
  const handleComplete = () => setState({ status: "completed", finalPrice: state.estimatedPrice });
  const handlePay = async () => {
    if (!user.uid) {
      toast.error("Sessão expirada. Faça login novamente.");
      window.location.href = "/login";
      return;
    }
    // Tenta chamar a Edge Function segura no backend
    try {
      const securityMetadata = collectPaymentMetadata();
      await supabase.functions.invoke("checkout", {
        body: {
          service_type: "mototaxi",
          service_id: state.rideId,
          customer_id: user.uid,
          provider_id: state.prestadorId || "",
          amount: state.finalPrice || state.estimatedPrice,
          payment_method: state.paymentMethod || "pix",
          metadata: securityMetadata
        }
      });
    } catch (funcErr) {
      console.warn("Falha ao chamar Edge Function, usando fallback local:", funcErr);
    }
    setState({ status: "rating", paymentMethod: state.paymentMethod || "pix" });
  };

  const sendMessage = (text: string) => {
    const newMsg = { text, from: "tomador" as const, ts: Date.now() };
    setState((prev) => ({
      ...prev,
      messages: [...(prev.messages || []), newMsg],
    }));
    if (state.rideId) {
      try {
        if (msgChannelRef.current) {
          msgChannelRef.current.send({
            type: 'broadcast',
            event: 'quick_message',
            payload: newMsg
          });
        } else {
          const channel = supabase
            .channel(`ride_msg_${state.rideId}`)
            .on('broadcast', { event: 'quick_message' }, () => {})
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                channel.send({
                  type: 'broadcast',
                  event: 'quick_message',
                  payload: newMsg
                });
              }
            });
        }
      } catch (e) {
        console.warn("Falha ao transmitir mensagem do tomador:", e);
      }
    }
  };

  const handleReset = () => {
    setPrefData(null);
    setIsProcessingPayment(false);
    setPaymentStep("");
    resetRide();
  };

  // Processing Payment Fullscreen simulation overlay
  if (isProcessingPayment && state.prestadorInfo) {
    const price = state.finalPrice || state.estimatedPrice;
    const split = calculateSplit(price);
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090B] p-6 text-white">
        <div className="w-16 h-16 border-4 border-t-transparent border-[#00FF66] rounded-full animate-spin mb-6" />
        
        <h2 className="font-display text-[20px] font-bold text-center mb-2">Processando Pagamento</h2>
        <p className="font-sans text-[14px] text-center text-[#A1A1AA] mb-8">{paymentStep}</p>
        
        {/* Animated values panel */}
        <div className="w-full max-w-sm bg-[#18181B] border border-[#27272A] rounded-2xl p-5 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <span className="font-sans text-[13px] text-[#A1A1AA]">Valor da Corrida:</span>
            <span className="font-display text-[18px] font-bold text-[#00FF66]">{formatBRL(price)}</span>
          </div>
          
          <div className="h-px bg-[#27272A] my-3" />
          
          <p className="font-sans text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Distribuição do Split UBT</p>
          
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#A1A1AA]">Prestador (90%)</span>
              <span className="font-semibold text-white">{formatBRL(split.prestador)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#A1A1AA]">Plataforma UBT (4%)</span>
              <span className="font-semibold text-white">{formatBRL(split.ubt)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#A1A1AA]">Prêmios & Sorteios (3%)</span>
              <span className="font-semibold text-white">{formatBRL(split.premios)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#A1A1AA]">Fundo Comunidade (2%)</span>
              <span className="font-semibold text-white">{formatBRL(split.comunidade)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#A1A1AA]">Associação / Padrinho (1%)</span>
              <span className="font-semibold text-white">{formatBRL(split.associacao)}</span>
            </div>
          </div>
        </div>
        
        <p className="mt-8 font-sans text-[11px] text-[#A1A1AA]/60 text-center uppercase tracking-widest">Mercado Pago Sandbox Environment</p>
      </div>
    );
  }

  // Completed and rating are full-screen
  if (state.status === "completed" && state.prestadorInfo) {
    return (
      <CompletedScreen
        price={state.finalPrice || state.estimatedPrice}
        distanceKm={state.distanceKm}
        durationMin={state.durationMin}
        rideId={state.rideId}
        prestadorInfo={state.prestadorInfo}
        onPay={handlePay}
      />
    );
  }
  if (state.status === "rating" && state.prestadorInfo) {
    return (
      <RatingScreen
        prestador={state.prestadorInfo}
        onSubmit={handleReset}
      />
    );
  }

  return (
    <div className="relative w-full h-[100svh] overflow-hidden bg-navy">
      {/* Floating incoming quick message banner */}
      {incomingMessage && (
        <div
          className="fixed top-4 left-4 right-4 z-[1200] max-w-md mx-auto p-3.5 rounded-2xl bg-zinc-900/95 border border-[#0DB87E] shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
          onClick={() => setIncomingMessage(null)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0DB87E]/20 border border-[#0DB87E]/40 flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-[#0DB87E]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#0DB87E] uppercase tracking-wider">{incomingMessage.sender}</p>
              <p className="text-[13px] font-medium text-white">{incomingMessage.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIncomingMessage(null);
            }}
            className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      <MototaxiMap
        origin={state.origin}
        destination={state.destination}
        prestadorLocation={state.prestadorLocation}
        status={state.status}
        center={center}
        onlineDrivers={onlineDrivers}
      />

      {/* Back button */}
      <button
        onClick={() => {
          if (state.status === "idle") navigate("/app/home");
          else if (state.status === "searching") handleCancel();
          else navigate("/app/home");
        }}
        className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(24,24,27,0.90)", border: "1px solid #27272A" }}
        aria-label="Voltar"
      >
        <ArrowLeft size={18} className="text-white" />
      </button>

      {state.status === "idle" && (
        <IdleSheet
          type={state.type}
          setType={(t) => setState({ type: t })}
          origin={state.origin}
          setOriginAddress={(s) =>
            state.origin && setState({ origin: { ...state.origin, address: s } })
          }
          recenter={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCenter(c);
                setState({ origin: { ...c, address: state.origin?.address || "Sua localização atual" } });
              });
            }
          }}
          destination={state.destination}
          setDestination={(d) => setState({ destination: d })}
          onConfirm={handleConfirm}
        />
      )}

      {state.status === "searching" && (
        <SearchingSheet
          estimatedPrice={state.estimatedPrice}
          origin={state.origin}
          destination={state.destination}
          type={state.type}
          onCancel={handleCancel}
          onMatch={handleMatch}
        />
      )}

      {state.status === "accepted" && state.prestadorInfo && (
        <AcceptedSheet
          prestador={state.prestadorInfo}
          durationMin={state.durationMin}
          acceptedAt={state.acceptedAt || Date.now()}
          onCancel={handleCancel}
          onArrive={handleArrive}
          onSendMessage={sendMessage}
        />
      )}

      {state.status === "in_progress" && (
        <InProgressSheet
          durationMin={state.durationMin}
          onComplete={handleComplete}
          onSendMessage={sendMessage}
        />
      )}

      <style>{`
        @keyframes ubt-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes ubt-scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default MototaxiTomadorPage;
