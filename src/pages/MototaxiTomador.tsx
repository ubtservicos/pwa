import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CheckCircle2,
  CreditCard,
  X,
  User,
  MessageSquare,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import MototaxiMap from "@/components/mototaxi/MototaxiMap";
import SplitBreakdown from "@/components/mototaxi/SplitBreakdown";
import QuickStatusMessages, { type QuickMessageItem } from "@/components/mototaxi/QuickStatusMessages";
import { useMototaxiQuickMessages, type MototaxiChatStatus } from "@/hooks/useMototaxiQuickMessages";
import { FullscreenConfetti } from "@/components/ui/FullscreenConfetti";
import { fetchGatewayFeeSettings, calculatePaymentWithFee, type GatewayFeeSettings, DEFAULT_FEE_SETTINGS } from "@/services/FinancialFeeService";
import {
  calcPrice,
  calculateMototaxiQuote,
  DEFAULT_MOTOTAXI_PRICING_CONFIG,
  formatBRL,
  type MototaxiPricingConfig,
} from "@/utils/ride";
import { fetchMototaxiPricingConfig } from "@/services/MototaxiPricingService";
import { useRide, type RideType } from "@/contexts/RideContext";
import { searchAddressesWithSessionToken, getPlaceDetails, createAutocompleteSessionToken, reverseGeocode, geocodeAddress, getRouteInfo, type AutocompleteSuggestion } from "@/lib/geoService";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { validateGeofence } from "@/services/GeofenceService";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import CheckoutUniversal from "@/components/Payment/CheckoutUniversal";
import type { PaymentResult } from "@/components/Payment/types";
import { RidePaymentSummary } from "@/components/mototaxi/RidePaymentSummary";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

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
const appendTypedNumberIfMissing = (typed: string, finalAddress: string): string => {
  const userNumberMatch =
    typed.match(/(?:,\s*|n[º°]?\s*|\s+)(\d+[a-zA-Z]?)(?:\b|$)/i) || typed.match(/(\d+)/);
  const userTypedNumber = userNumberMatch ? userNumberMatch[1] : null;
  if (!userTypedNumber || finalAddress.match(new RegExp(`\\b${userTypedNumber}\\b`))) {
    return finalAddress;
  }
  const parts = finalAddress.split(",");
  if (parts.length > 1) {
    parts[0] = `${parts[0].trim()}, ${userTypedNumber}`;
    return parts.join(", ");
  }
  return `${finalAddress}, ${userTypedNumber}`;
};

const IdleSheet = ({
  type, setType,
  origin, setOrigin, recenter,
  destination, setDestination,
  distanceKm, durationMin,
  pricingConfig,
  confirming,
  onConfirm,
}: {
  type: RideType | null;
  setType: (t: RideType) => void;
  origin: { lat: number; lng: number; address: string } | null;
  setOrigin: (o: { lat: number; lng: number; address: string }) => void;
  recenter: () => void;
  destination: { lat: number; lng: number; address: string } | null;
  setDestination: (d: { lat: number; lng: number; address: string } | null) => void;
  distanceKm: number;
  durationMin: number;
  pricingConfig: MototaxiPricingConfig;
  confirming: boolean;
  onConfirm: (overrideDest?: { lat: number; lng: number; address: string }) => void | Promise<void>;
}) => {
  const quote = useMemo(
    () => (origin && destination && distanceKm > 0 ? calculateMototaxiQuote(distanceKm, pricingConfig) : null),
    [origin, destination, distanceKm, pricingConfig],
  );
  const price = quote ? quote.precoFinal : 0;

  // Origin autocomplete state
  const [originQuery, setOriginQuery] = useState(origin?.address || "");
  const [originResults, setOriginResults] = useState<AutocompleteSuggestion[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [originFocused, setOriginFocused] = useState(false);
  const originSessionTokenRef = useRef<any>(null);

  // Destination autocomplete state
  const [destQuery, setDestQuery] = useState(destination?.address || "");
  const [destResults, setDestResults] = useState<AutocompleteSuggestion[]>([]);
  const [searchingDest, setSearchingDest] = useState(false);
  const [destFocused, setDestFocused] = useState(false);
  const [resolvingManualDest, setResolvingManualDest] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const destSessionTokenRef = useRef<any>(null);

  useEffect(() => {
    if (origin?.address && !originFocused) {
      setOriginQuery(origin.address);
    }
  }, [origin?.address, originFocused]);

  useEffect(() => {
    if (destination?.address && !destFocused) {
      setDestQuery(destination.address);
    }
  }, [destination?.address, destFocused]);

  const initOriginSessionToken = () => {
    originSessionTokenRef.current = createAutocompleteSessionToken();
  };

  const initDestSessionToken = () => {
    destSessionTokenRef.current = createAutocompleteSessionToken();
  };

  useEffect(() => {
    initOriginSessionToken();
    initDestSessionToken();
  }, []);

  // Origin search debounce
  useEffect(() => {
    if (!originFocused) {
      setOriginResults([]);
      return;
    }
    const trimmed = originQuery.trim();
    if (origin && trimmed === origin.address.trim()) {
      setOriginResults([]);
      return;
    }
    if (trimmed.length < 3) {
      setOriginResults([]);
      setSearchingOrigin(false);
      return;
    }
    if (!originSessionTokenRef.current) initOriginSessionToken();
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearchingOrigin(true);
      searchAddressesWithSessionToken(trimmed, originSessionTokenRef.current)
        .then((res) => {
          if (!cancelled) setOriginResults(res);
        })
        .finally(() => {
          if (!cancelled) setSearchingOrigin(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [originQuery, origin, originFocused]);

  // Destination search debounce
  useEffect(() => {
    const trimmed = destQuery.trim();
    if (destination && trimmed === destination.address.trim()) {
      setDestResults([]);
      return;
    }
    if (trimmed.length < 3) {
      setDestResults([]);
      setSearchingDest(false);
      return;
    }
    if (!destSessionTokenRef.current) initDestSessionToken();
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearchingDest(true);
      searchAddressesWithSessionToken(trimmed, destSessionTokenRef.current)
        .then((res) => {
          if (!cancelled) setDestResults(res);
        })
        .finally(() => {
          if (!cancelled) setSearchingDest(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [destQuery, destination]);

  const handleSelectOrigin = async (r: AutocompleteSuggestion) => {
    setLocalError(null);
    setSearchingOrigin(true);
    let lat = r.lat;
    let lng = r.lng;
    let resolvedLabel = r.label;

    if (lat == null || lng == null) {
      const details = await getPlaceDetails(r.placeId, originSessionTokenRef.current);
      initOriginSessionToken();
      if (details) {
        lat = details.lat;
        lng = details.lng;
        resolvedLabel = details.formattedAddress || r.label;
      }
    }

    const finalAddress = appendTypedNumberIfMissing(originQuery, resolvedLabel);
    setOrigin({
      lat: lat ?? UBATUBA_FALLBACK.lat,
      lng: lng ?? UBATUBA_FALLBACK.lng,
      address: finalAddress,
    });
    setOriginQuery(finalAddress);
    setOriginResults([]);
    setOriginFocused(false);
    setSearchingOrigin(false);
  };

  const handleSelectDest = async (r: AutocompleteSuggestion) => {
    setLocalError(null);
    setSearchingDest(true);
    let lat = r.lat;
    let lng = r.lng;
    let resolvedLabel = r.label;

    if (lat == null || lng == null) {
      const details = await getPlaceDetails(r.placeId, destSessionTokenRef.current);
      initDestSessionToken();
      if (details) {
        lat = details.lat;
        lng = details.lng;
        resolvedLabel = details.formattedAddress || r.label;
      }
    }

    const finalAddress = appendTypedNumberIfMissing(destQuery, resolvedLabel);
    setDestination({
      lat: lat ?? UBATUBA_FALLBACK.lat,
      lng: lng ?? UBATUBA_FALLBACK.lng,
      address: finalAddress,
    });
    setDestQuery(finalAddress);
    setDestResults([]);
    setDestFocused(false);
    setSearchingDest(false);
  };

  const canConfirm = !!type && !!origin && (!!destination || destQuery.trim().length >= 3);

  const handleConfirmClick = async () => {
    setLocalError(null);
    if (!type) {
      setLocalError("Selecione Carona ou Entrega.");
      return;
    }
    if (!origin) {
      setLocalError("Aguarde a localização de origem ou digite o endereço em 'De onde?'.");
      return;
    }

    // Se o usuário já selecionou um destino com coordenadas, confirma direto
    if (destination && destQuery.trim() === destination.address.trim()) {
      await onConfirm();
      return;
    }

    // Caso o usuário tenha digitado manualmente e clicado em "Confirmar pedido", geocodifica automaticamente
    const typedDest = destQuery.trim();
    if (typedDest.length < 3) {
      setLocalError("Digite o endereço de destino em 'Para onde?'.");
      return;
    }

    setResolvingManualDest(true);
    try {
      const geo = await geocodeAddress(typedDest);
      if (!geo) {
        const msg = "Não encontramos esse endereço em Ubatuba. Selecione uma sugestão da lista ou adicione o bairro.";
        setLocalError(msg);
        toast.error(msg);
        return;
      }
      const finalAddress = appendTypedNumberIfMissing(typedDest, geo.label || typedDest);
      const resolvedDest = { lat: geo.lat, lng: geo.lng, address: finalAddress };
      setDestination(resolvedDest);
      setDestQuery(finalAddress);
      setDestResults([]);
      await onConfirm(resolvedDest);
    } finally {
      setResolvingManualDest(false);
    }
  };

  return (
    <Sheet className="overflow-visible">
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
      <div className="mt-4 relative z-40">
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
            value={originQuery}
            onFocus={() => setOriginFocused(true)}
            onBlur={() => setTimeout(() => setOriginFocused(false), 180)}
            onChange={(e) => {
              const v = e.target.value;
              setOriginQuery(v);
              if (origin) setOrigin({ ...origin, address: v });
            }}
            placeholder="Sua localização ou rua em Ubatuba..."
            className="flex-1 bg-transparent outline-none font-sans text-[15px] text-white placeholder:text-white/30"
          />
          <button type="button" onClick={recenter} aria-label="Recentralizar">
            <Crosshair size={18} style={{ color: "rgba(255,255,255,0.55)" }} />
          </button>
        </div>

        {originResults.length > 0 && (
          <div
            className="mt-1.5 rounded-xl bg-[#121215] border border-zinc-800 shadow-2xl z-50 relative"
            style={{ maxHeight: 190, overflowY: "auto" }}
          >
            {originResults.map((r, i) => (
              <button
                key={r.placeId || `${r.label}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectOrigin(r)}
                className="w-full text-left px-3.5 py-2.5 border-b border-zinc-800/80 last:border-none hover:bg-zinc-800/70 active:bg-zinc-800 transition-colors flex items-start gap-2.5"
              >
                <Navigation size={14} className="text-[#00FF66] shrink-0 mt-1" />
                <div className="min-w-0">
                  <div className="font-sans text-[13px] font-semibold text-zinc-50 truncate">{r.mainText || r.label}</div>
                  {r.secondaryText && <div className="font-sans text-[11px] text-zinc-400 truncate">{r.secondaryText}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
        {searchingOrigin && (
          <div className="mt-1.5 text-[11px] text-zinc-400 px-1">Buscando endereços em Ubatuba...</div>
        )}
      </div>

      {/* Destino */}
      <div className="mt-3 relative z-30">
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
          <MapPin size={16} style={{ color: destination ? "#00FF66" : "rgba(255,255,255,0.35)" }} />
          <input
            value={destQuery}
            onFocus={() => setDestFocused(true)}
            onBlur={() => setTimeout(() => setDestFocused(false), 180)}
            onChange={(e) => {
              const v = e.target.value;
              setDestQuery(v);
              setLocalError(null);
              if (destination && v !== destination.address) {
                setDestination(null);
              }
            }}
            placeholder="Rua, bairro ou praia em Ubatuba..."
            className="flex-1 bg-transparent outline-none font-sans text-[15px] text-white placeholder:text-white/30"
          />
          {destQuery && (
            <button
              type="button"
              onClick={() => {
                setDestQuery("");
                setDestination(null);
                setDestResults([]);
                setLocalError(null);
              }}
              aria-label="Limpar destino"
              className="text-zinc-400 hover:text-white p-1"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Dropdown de resultados (Dark Gamer / Bets, z-50 sem recorte) */}
        {destResults.length > 0 && (
          <div
            className="mt-1.5 rounded-xl bg-[#121215] border border-zinc-800 shadow-2xl z-50 relative"
            style={{ maxHeight: 210, overflowY: "auto" }}
          >
            {destResults.map((r, i) => (
              <button
                key={r.placeId || `${r.label}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectDest(r)}
                className="w-full text-left px-3.5 py-2.5 border-b border-zinc-800/80 last:border-none hover:bg-zinc-800/70 active:bg-zinc-800 transition-colors flex items-start gap-2.5"
              >
                <MapPin size={14} className="text-[#00FF66] shrink-0 mt-1" />
                <div className="min-w-0">
                  <div className="font-sans text-[13px] font-semibold text-zinc-50 truncate">{r.mainText || r.label}</div>
                  {r.secondaryText && <div className="font-sans text-[11px] text-zinc-400 truncate">{r.secondaryText}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        {searchingDest && (
          <div className="mt-1.5 text-[11px] text-zinc-400 px-1">
            Buscando endereços em Ubatuba...
          </div>
        )}
      </div>

      {localError && (
        <div className="mt-2.5 rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-200">
          {localError}
        </div>
      )}

      {/* Preview preço */}
      {origin && destination && quote && (
        <div
          className="mt-3.5 rounded-xl animate-in fade-in"
          style={{
            background: "rgba(13,184,126,0.08)",
            border: "1px solid rgba(13,184,126,0.20)",
            padding: "14px 16px",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Estimativa
              </span>
              {quote.idaEVoltaAtivada && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                  Ida e Volta (2× km)
                </span>
              )}
            </div>
            <span className="font-display text-[20px] font-bold" style={{ color: "#00FF66" }}>
              {formatBRL(price)}
            </span>
          </div>
          <p className="font-sans text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {distanceKm.toFixed(1)} km · ~{durationMin} min
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!canConfirm || confirming || resolvingManualDest}
        onClick={handleConfirmClick}
        className="mt-4 w-full rounded-xl font-display font-semibold text-navy transition-opacity"
        style={{
          height: 52,
          background: "#00FF66",
          opacity: canConfirm && !confirming && !resolvingManualDest ? 1 : 0.4,
        }}
      >
        {resolvingManualDest
          ? "Localizando endereço..."
          : confirming
          ? "Solicitando mototáxi..."
          : "Confirmar pedido"}
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
  messages,
  chatStatus,
  isSendingMessage,
  chatError,
}: {
  prestador: { name?: string; plate?: string; rating?: number };
  durationMin: number;
  acceptedAt: number;
  onCancel: () => void;
  onArrive: () => void;
  onSendMessage: (text: string) => void | Promise<void>;
  messages: QuickMessageItem[];
  chatStatus: MototaxiChatStatus;
  isSendingMessage: boolean;
  chatError: string | null;
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

      <QuickStatusMessages
        role="tomador"
        onSendMessage={onSendMessage}
        messages={messages}
        connectionStatus={chatStatus}
        isSending={isSendingMessage}
        error={chatError}
        className="mt-4"
      />

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
  messages,
  chatStatus,
  isSendingMessage,
  chatError,
}: {
  durationMin: number;
  onComplete: () => void;
  onSendMessage: (text: string) => void | Promise<void>;
  messages: QuickMessageItem[];
  chatStatus: MototaxiChatStatus;
  isSendingMessage: boolean;
  chatError: string | null;
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

      <QuickStatusMessages
        role="tomador"
        onSendMessage={onSendMessage}
        messages={messages}
        connectionStatus={chatStatus}
        isSending={isSendingMessage}
        error={chatError}
        className="mt-4"
      />

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

type PaymentMethodOption = "pix_checkout" | "card";

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
  const [method, setMethod] = useState<PaymentMethodOption | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pixCopiaCola, setPixCopiaCola] = useState<string>("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [feeSettings, setFeeSettings] = useState<GatewayFeeSettings>(DEFAULT_FEE_SETTINGS);
  const paidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchGatewayFeeSettings().then(setFeeSettings);
  }, []);

  const rawBase = price > 0 ? price : 10.00;
  const pixCalc = calculatePaymentWithFee(rawBase, "pix", feeSettings);
  const cardCalc = calculatePaymentWithFee(rawBase, "card", feeSettings);
  const activeFeeCalc = method === "card" ? cardCalc : method === "pix_checkout" ? pixCalc : null;
  const formatPct = (pct: number) => `${pct.toFixed(2).replace(".", ",")}%`;

  const transitionToPaid = useCallback(() => {
    setConfirming(true);
    if (paidTimerRef.current) return;
    paidTimerRef.current = setTimeout(onPay, 1800);
  }, [onPay]);

  const applyRidePaymentState = useCallback((dbRide: any) => {
    if (!dbRide) return;
    if (dbRide.pix_copy_paste) setPixCopiaCola(String(dbRide.pix_copy_paste));
    if (dbRide.status === "paid") transitionToPaid();
  }, [transitionToPaid]);

  useRealtimeChannel(
    rideId ? `tomador_payment_${rideId}` : null,
    { event: "UPDATE", table: "mototaxi_corridas", filter: rideId ? `id=eq.${rideId}` : undefined },
    (payload) => applyRidePaymentState(payload.new)
  );

  useEffect(() => {
    if (!rideId) return;
    const syncPayment = async () => {
      if (document.hidden) return;
      const { data } = await supabase
        .from("mototaxi_corridas")
        .select("status, pix_copy_paste")
        .eq("id", rideId)
        .maybeSingle();
      applyRidePaymentState(data);
    };
    void syncPayment();
    const timer = window.setInterval(syncPayment, 5000);
    return () => window.clearInterval(timer);
  }, [rideId, applyRidePaymentState]);

  useEffect(() => () => {
    if (paidTimerRef.current) clearTimeout(paidTimerRef.current);
  }, []);

  // Persist the selected method; Pix creation itself belongs to the provider.
  const handleSelectMethod = async (m: PaymentMethodOption) => {
    setMethod(m);
    setPaymentError(null);

    const dbMethod = m === "pix_checkout" ? "pix" : "card";

    if (rideId) {
      try {
        const { error } = await supabase
          .from("mototaxi_corridas")
          .update({ payment_method: dbMethod })
          .eq("id", rideId);

        if (error) {
          console.error("Erro Supabase PATCH:", error.message, error.details, error.hint);
        }
      } catch (e: any) {
        console.error("Erro ao sincronizar escolha de pagamento:", e?.message || e);
      }
    }
  };

  // ─── Card payment callbacks (delegated to <CheckoutUniversal />) ───
  const handleCardPaymentSuccess = async (result: PaymentResult) => {
    const status = String(result?.status || (result?.payment as { status?: string } | undefined)?.status || "").toLowerCase();
    if (status !== "approved") return;
    if (result?.split?.statement) {
      console.log("✅ [UBT Split Engine 7 Vias Extrato]:\n" + result.split.statement);
    }
    // payment-gateway is the only authority allowed to mark the ride as paid.
    transitionToPaid();
  };

  const handleCardPaymentError = (errorMsg: string) => {
    setPaymentError(errorMsg);
    toast.error(`Falha no pagamento: ${errorMsg}`);
  };

  const handleCopyPix = () => {
    if (pixCopiaCola) {
      navigator.clipboard.writeText(pixCopiaCola);
      setCopiedPix(true);
      toast.success("Código Pix copiado com sucesso!");
      setTimeout(() => setCopiedPix(false), 3000);
    }
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

        {/* Dynamic Split Breakdown (always computed over base ride fare) */}
        <SplitBreakdown total={rawBase} />

        <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Detailed Price & Payment Method Fee Display (paid by Tomador) */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-sans text-[13px] text-white/70">
            <span>Valor base da corrida:</span>
            <span>{formatBRL(rawBase)}</span>
          </div>

          {activeFeeCalc ? (
            <>
              <div className="flex justify-between font-sans text-[13px] text-[#F5A623]">
                <span>
                  Taxa {method === "card" ? "Cartão de Crédito" : "PIX"} ({formatPct(activeFeeCalc.feePct)} · arcada pelo Tomador):
                </span>
                <span>+ {formatBRL(activeFeeCalc.feeAmount)}</span>
              </div>
              <p className="font-sans text-[11px] text-white/45 leading-snug">
                A taxa do meio de pagamento varia entre PIX ({formatPct(pixCalc.feePct)}) e Cartão ({formatPct(cardCalc.feePct)}) e garante que o mototaxista receba 90% líquidos da tarifa base.
              </p>
              <div className="flex justify-between font-display text-[18px] font-bold text-white pt-1.5 border-t border-white/10">
                <span>Total a pagar</span>
                <span style={{ color: "#0DB87E" }}>{formatBRL(activeFeeCalc.totalAmount)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between font-sans text-[12px] text-white/55">
                <span>Taxa PIX ({formatPct(pixCalc.feePct)} · Tomador):</span>
                <span>+ {formatBRL(pixCalc.feeAmount)} (Total {formatBRL(pixCalc.totalAmount)})</span>
              </div>
              <div className="flex justify-between font-sans text-[12px] text-white/55">
                <span>Taxa Cartão ({formatPct(cardCalc.feePct)} · Tomador):</span>
                <span>+ {formatBRL(cardCalc.feeAmount)} (Total {formatBRL(cardCalc.totalAmount)})</span>
              </div>
              <div className="flex justify-between font-display text-[18px] font-bold text-white pt-1.5 border-t border-white/10">
                <span>Tarifa base</span>
                <span style={{ color: "#0DB87E" }}>{formatBRL(rawBase)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 font-sans text-[12px] font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
        Escolha como deseja pagar
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
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
          <span className="font-display text-[12px] font-bold leading-tight">Pix presencial</span>
          <span className="font-sans text-[10px] text-white/55 mt-0.5">
            Taxa {formatPct(pixCalc.feePct)} · Total {formatBRL(pixCalc.totalAmount)}
          </span>
        </button>

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
          <span className="font-sans text-[10px] text-white/55 mt-0.5">
            Taxa {formatPct(cardCalc.feePct)} · Total {formatBRL(cardCalc.totalAmount)}
          </span>
        </button>
      </div>

      {!method && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center">
          <p className="font-sans text-[13px] text-white/70">
            Selecione manualmente Pix presencial ou Cartão para continuar.
          </p>
        </div>
      )}

      {method === "pix_checkout" && (
        <div className="mt-4 rounded-2xl p-5 flex flex-col items-center bg-white/5 border border-white/10">
          <div className="w-12 h-12 rounded-full bg-[#0DB87E]/20 flex items-center justify-center mb-2">
            <Smartphone size={24} className="text-[#0DB87E]" />
          </div>
          <h3 className="font-display text-[16px] font-bold text-white">Pix Presencial ({formatBRL(pixCalc.totalAmount)})</h3>
          <p className="font-sans text-[12px] text-white/70 text-center mt-1 mb-3">
            {pixCopiaCola
              ? "Escaneie o QR Code no celular do mototaxista ou copie o código abaixo para pagar no app do seu banco:"
              : "O QR Code está sendo gerado automaticamente na tela do mototaxista..."}
          </p>

          {pixCopiaCola ? (
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
              <p className="text-[12px] text-center text-[#F5A623]">A confirmação acontece automaticamente após o pagamento.</p>
            </div>
          ) : (
            <div className="w-full py-6 rounded-xl flex flex-col items-center justify-center bg-white/5 border border-white/10">
              <span className="w-8 h-8 rounded-full border-2 border-[#0DB87E] border-t-transparent animate-spin mb-3" />
              <p className="text-[12px] text-white/60">Sincronizando a cobrança em tempo real</p>
            </div>
          )}
        </div>
      )}

      {/* METHOD CONTENT: CARTÃO DE CRÉDITO — Delegated to CheckoutUniversal (with Wallet) */}
      {method === "card" && (
        prestadorInfo?.id ? (
          <CheckoutUniversal
            amount={cardCalc.totalAmount}
            providerId={prestadorInfo.id}
            providerName={prestadorInfo.name || "Motorista UBT"}
            serviceType="mototaxi"
            serviceId={rideId}
            onSuccess={handleCardPaymentSuccess}
            onError={handleCardPaymentError}
          />
        ) : (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium">
            O prestador desta corrida não foi identificado. Atualize a página antes de pagar.
          </div>
        )
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
          <FullscreenConfetti numberOfPieces={200} />
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
  rideId,
  origin,
  destination,
  total,
  onSubmit,
}: {
  prestador: { name: string };
  rideId?: string | null;
  origin?: string;
  destination?: string;
  total: number;
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
        <FullscreenConfetti numberOfPieces={250} />
        <CheckCircle2 size={64} style={{ color: "#0DB87E" }} />
        <h2 className="mt-4 font-display text-[22px] font-bold">Obrigado!</h2>
        <p className="mt-2 font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          Avaliação enviada com sucesso.
        </p>
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

      <RidePaymentSummary
        rideId={rideId}
        origin={origin}
        destination={destination}
        total={total}
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
  const [pricingConfig, setPricingConfig] = useState<MototaxiPricingConfig>(
    DEFAULT_MOTOTAXI_PRICING_CONFIG,
  );
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState<{ text: string; sender: string } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMototaxiPricingConfig().then((cfg) => {
      if (active) setPricingConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, []);
  const initOnce = useRef(false);
  const mototaxiChat = useMototaxiQuickMessages(state.rideId, "tomador", (message) => {
    setIncomingMessage({ text: message.text, sender: "Motorista" });
  });

  useEffect(() => {
    if (incomingMessage) {
      const timer = setTimeout(() => setIncomingMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingMessage]);

  // Geolocation init
  useEffect(() => {
    if (initOnce.current) return;
    initOnce.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(c);
        if (!state.origin) {
          const physicalAddress = await reverseGeocode(c.lat, c.lng);
          setState({ origin: { ...c, address: physicalAddress } });
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

  // Distance/duration via road route (Google Routes -> OSRM -> Haversine × 1.3)
  useEffect(() => {
    if (!state.origin || !state.destination) return;
    let active = true;

    // Immediate Haversine × 1.3 estimate so quote appears without latency
    const R = 6371;
    const dLat = ((state.destination.lat - state.origin.lat) * Math.PI) / 180;
    const dLng = ((state.destination.lng - state.origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((state.origin.lat * Math.PI) / 180) *
        Math.cos((state.destination.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const fallbackKm = Math.max(0.5, +(2 * R * Math.asin(Math.sqrt(a)) * 1.3).toFixed(1));
    setState({
      distanceKm: fallbackKm,
      durationMin: Math.max(3, Math.round(fallbackKm * 2.5)),
      estimatedPrice: calcPrice(fallbackKm, pricingConfig),
    });

    // Refine with real road route (OSRM / Google Routes)
    void getRouteInfo(state.origin, state.destination).then((route) => {
      if (!active || !route) return;
      const km = +route.distanceKm.toFixed(1);
      setState({
        distanceKm: km,
        durationMin: Math.max(3, route.durationMin),
        estimatedPrice: calcPrice(km, pricingConfig),
      });
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.origin?.lat, state.origin?.lng, state.destination?.lat, state.destination?.lng, pricingConfig]);

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

  // Recupera corrida ativa/concluída pendente de pagamento caso a página seja recarregada
  const recoveredOnceRef = useRef(false);
  useEffect(() => {
    if (recoveredOnceRef.current || state.rideId || state.status !== "idle") return;
    let active = true;

    const recoverPendingRide = async () => {
      let tomadorId = user.uid;
      if (!tomadorId) {
        const { data: authData } = await supabase.auth.getUser();
        tomadorId = authData?.user?.id || "";
      }
      if (!tomadorId || !active) return;
      recoveredOnceRef.current = true;

      const { data: dbRide, error } = await supabase
        .from("mototaxi_corridas")
        .select("*")
        .eq("tomador_id", tomadorId)
        .in("status", ["searching", "accepted", "in_progress", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !dbRide || !active) return;

      const parsePoint = (raw: any) => {
        const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!obj) return null;
        return {
          lat: Number(obj.lat ?? UBATUBA_FALLBACK.lat),
          lng: Number(obj.lng ?? UBATUBA_FALLBACK.lng),
          address: String(obj.address || ""),
        };
      };

      let prestadorInfo = null;
      let prestadorLocation = null;
      if (dbRide.prestador_id) {
        const [{ data: userData }, { data: sessData }] = await Promise.all([
          supabase.from("usuarios").select("nome").eq("id", dbRide.prestador_id).maybeSingle(),
          supabase.from("mototaxi_sessoes").select("lat, lng").eq("prestador_id", dbRide.prestador_id).maybeSingle(),
        ]);
        prestadorInfo = {
          id: dbRide.prestador_id,
          name: userData?.nome || "Motorista UBT",
          photo: "",
          plate: "MTX-" + dbRide.prestador_id.slice(0, 4).toUpperCase(),
          rating: 4.8,
        };
        if (sessData) {
          prestadorLocation = { lat: Number(sessData.lat), lng: Number(sessData.lng) };
        }
      }

      if (!active) return;
      setState({
        rideId: dbRide.id,
        status: dbRide.status as any,
        type: (dbRide.type === "entrega" ? "entrega" : "carona") as RideType,
        origin: parsePoint(dbRide.origin),
        destination: parsePoint(dbRide.destination),
        distanceKm: Number(dbRide.distance_km || 0),
        durationMin: Number(dbRide.duration_min || 5),
        estimatedPrice: Number(dbRide.estimated_price || 0),
        finalPrice: Number(dbRide.final_price || dbRide.estimated_price || 0),
        acceptedAt: dbRide.accepted_at ? new Date(dbRide.accepted_at).getTime() : null,
        prestadorInfo,
        prestadorLocation,
        paymentMethod: dbRide.payment_method === "card" ? "card" : dbRide.payment_method === "pix" ? "pix" : null,
      });
    };

    void recoverPendingRide();
    return () => { active = false; };
  }, [user.uid, state.rideId, state.status, setState]);

  // Escuta atualizações da corrida em tempo real com polling contínuo de 2s e suporte a bfcache
  useEffect(() => {
    if (!state.rideId || state.status === "rating") return;

    let channel: any = null;

    const applyDbRideTransition = async (dbRide: any) => {
      if (!dbRide) return;
      if (dbRide.status === "accepted") {
        let prestadorInfo = null;
        if (dbRide.prestador_id) {
          const { data: userData } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", dbRide.prestador_id)
            .single();

          const { data: sessData } = await supabase
            .from("mototaxi_sessoes")
            .select("lat, lng")
            .eq("prestador_id", dbRide.prestador_id)
            .single();

          prestadorInfo = {
            id: dbRide.prestador_id,
            name: userData?.nome || "Motorista UBT",
            photo: "",
            plate: "MTX-" + dbRide.prestador_id.slice(0, 4).toUpperCase(),
            rating: 4.8,
          };

          setState({
            status: "accepted",
            acceptedAt: dbRide.accepted_at ? new Date(dbRide.accepted_at).getTime() : Date.now(),
            prestadorInfo,
            prestadorLocation: sessData
              ? { lat: Number(sessData.lat), lng: Number(sessData.lng) }
              : (state.origin ? { lat: state.origin.lat - 0.005, lng: state.origin.lng - 0.005 } : null),
          });
        }
      } else if (dbRide.status === "in_progress") {
        setState({ status: "in_progress" });
      } else if (dbRide.status === "completed") {
        setState({
          status: "completed",
          finalPrice: dbRide.final_price || dbRide.estimated_price,
        });
      } else if (dbRide.status === "paid") {
        setState({
          status: "rating",
          finalPrice: dbRide.final_price || dbRide.estimated_price,
          paymentMethod: dbRide.payment_method === "card" ? "card" : "pix",
        });
      } else if (dbRide.status === "cancelled") {
        alert("A corrida foi cancelada.");
        resetRide();
      }
    };

    const syncCurrentStatus = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data: dbRide, error } = await supabase
        .from("mototaxi_corridas")
        .select("*")
        .eq("id", state.rideId)
        .single();

      if (dbRide && !error) {
        await applyDbRideTransition(dbRide);
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
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "mototaxi_corridas", filter: `id=eq.${state.rideId}` },
          async (payload: any) => {
            if (payload.new) {
              await applyDbRideTransition(payload.new);
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
  }, [state.rideId, state.status]);

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

  const handleConfirm = async (overrideDest?: { lat: number; lng: number; address: string }) => {
    const effectiveDest = overrideDest || state.destination;
    if (!state.origin || !effectiveDest) return;
    setConfirmingOrder(true);
    const startTime = Date.now();

    try {
      let tomadorId = user.uid;
      if (!tomadorId) {
        const { data: authData } = await supabase.auth.getUser();
        tomadorId = authData?.user?.id || "";
      }

      if (!tomadorId) {
        toast.error("Por favor, faça login para solicitar a corrida.");
        return;
      }

      // Calcular rota e preço finais se overrideDest foi passado ou se estimatedPrice ainda não foi calculado
      let finalDistanceKm = state.distanceKm;
      let finalDurationMin = state.durationMin;
      let finalEstimatedPrice = state.estimatedPrice;

      if (overrideDest || !finalDistanceKm || !finalEstimatedPrice) {
        const route = await getRouteInfo(state.origin, effectiveDest);
        if (route) {
          finalDistanceKm = +route.distanceKm.toFixed(1);
          finalDurationMin = Math.max(3, route.durationMin);
          finalEstimatedPrice = calcPrice(finalDistanceKm, pricingConfig);
          setState({
            destination: effectiveDest,
            distanceKm: finalDistanceKm,
            durationMin: finalDurationMin,
            estimatedPrice: finalEstimatedPrice,
          });
        }
      }

      // Validar Geofence de Origem e Destino (Aviso informativo para permitir testes)
      const originGeo = validateGeofence(state.origin.address, { lat: state.origin.lat, lng: state.origin.lng });
      const destGeo = validateGeofence(effectiveDest.address, { lat: effectiveDest.lat, lng: effectiveDest.lng });

      if (!originGeo.inside && !destGeo.inside) {
        console.warn("[Geofence] Chamada iniciada fora do perímetro padrão de Ubatuba:", { origin: state.origin, destination: effectiveDest });
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
          lat: effectiveDest.lat,
          lng: effectiveDest.lng,
          address: effectiveDest.address
        },
        distance_km: finalDistanceKm,
        duration_min: finalDurationMin,
        estimated_price: finalEstimatedPrice,
        payment_method: null
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
        toast.error(`Erro ao solicitar mototáxi: ${error.message || 'Falha no banco de dados'}`);
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

      trackEvent("ride_requested", "operational", { vertical: "mototaxi", type: state.type, price: finalEstimatedPrice, distance_km: finalDistanceKm });
      logSystem("INFO", "MOTOTAXI", "ride_requested", "success", duration, undefined, undefined, { type: state.type, price: finalEstimatedPrice });

      setState({
        status: 'searching',
        rideId: data.id
      });
    } finally {
      setConfirmingOrder(false);
    }
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
    // A confirmação financeira já foi persistida pelo fluxo de pagamento.
    // Evita uma segunda escrita pela função legada `checkout` após o sucesso.
    setState({ status: "rating", paymentMethod: state.paymentMethod || "pix" });
  };

  const sendMessage = async (text: string) => {
    try {
      await mototaxiChat.sendMessage(text);
    } catch (error) {
      console.warn("Falha ao enviar mensagem do tomador:", error);
      toast.error("Não foi possível enviar a mensagem.");
    }
  };

  const handleReset = () => {
    resetRide();
  };

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
        rideId={state.rideId}
        origin={state.origin?.address}
        destination={state.destination?.address}
        total={state.finalPrice || state.estimatedPrice}
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
          setOrigin={(o) => {
            setCenter({ lat: o.lat, lng: o.lng });
            setState({ origin: o });
          }}
          recenter={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(async (pos) => {
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCenter(c);
                const addr = await reverseGeocode(c.lat, c.lng);
                setState({ origin: { ...c, address: addr || "Sua localização atual" } });
              });
            }
          }}
          destination={state.destination}
          setDestination={(d) => setState({ destination: d })}
          distanceKm={state.distanceKm}
          durationMin={state.durationMin}
          pricingConfig={pricingConfig}
          confirming={confirmingOrder}
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
          messages={mototaxiChat.messages}
          chatStatus={mototaxiChat.status}
          isSendingMessage={mototaxiChat.isSending}
          chatError={mototaxiChat.error}
        />
      )}

      {state.status === "in_progress" && (
        <InProgressSheet
          durationMin={state.durationMin}
          onComplete={handleComplete}
          onSendMessage={sendMessage}
          messages={mototaxiChat.messages}
          chatStatus={mototaxiChat.status}
          isSendingMessage={mototaxiChat.isSending}
          chatError={mototaxiChat.error}
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
