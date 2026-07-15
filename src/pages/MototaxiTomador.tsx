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
} from "lucide-react";
import MototaxiMap from "@/components/mototaxi/MototaxiMap";
import SplitBreakdown from "@/components/mototaxi/SplitBreakdown";
import { calcPrice, formatBRL } from "@/utils/ride";
import { useRide, type RideType } from "@/contexts/RideContext";
import { searchAddresses } from "@/lib/geoService";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

const UBATUBA_FALLBACK = { lat: -23.4336, lng: -45.0838 };

const Sheet = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`absolute left-0 right-0 bottom-0 z-[1000] ${className}`}
    style={{
      background: "#132348",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
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
  const [destResults, setDestResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [searchingDest, setSearchingDest] = useState(false);

  useEffect(() => {
    // If the input matches the confirmed destination, we don't search again
    if (destination && destQuery === destination.address) {
      setDestResults([]);
      return;
    }
    if (destQuery.length < 3) {
      setDestResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchingDest(true);
      searchAddresses(destQuery).then((res) => {
        setDestResults(res);
        setSearchingDest(false);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [destQuery, destination]);

  const handleSelectDest = (r: { label: string; lat: number; lng: number }) => {
    setDestination({ lat: r.lat, lng: r.lng, address: r.label });
    setDestQuery(r.label);
    setDestResults([]);
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
              background: "#1C3261",
              border: "1px solid rgba(255,255,255,0.15)",
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {destResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectDest(r)}
                className="w-full text-left px-3 py-3 border-b border-white/5 last:border-none font-sans text-[13px] text-white/90 hover:bg-white/10"
              >
                {r.label}
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
        className="mt-4 w-full rounded-xl font-display font-semibold text-white transition-opacity"
        style={{
          height: 52,
          background: "#0DB87E",
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
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // Auto-match removed - waiting for real-time match from Supabase

  const C = 213.6; // 2 * pi * 34
  const dash = (seconds / 60) * C;

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
                cx="40" cy="40" r="34" fill="none" stroke="#0DB87E" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
                transform="rotate(-90 40 40)"
              />
              <text x="40" y="48" textAnchor="middle" fill="#fff" className="font-display" fontSize="22" fontWeight="800">
                {seconds}
              </text>
            </svg>
          </div>
        </>
      ) : (
        <div className="text-center py-2">
          <Clock size={32} style={{ color: "#F5A623" }} className="mx-auto" />
          <p className="font-display text-[16px] font-bold text-white mt-2">
            Nenhum mototaxista disponível.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => setSeconds(60)} className="rounded-xl h-11 font-display font-semibold text-white" style={{ background: "#0DB87E" }}>
              Tentar novamente
            </button>
            <button onClick={() => setSeconds(60)} className="rounded-xl h-11 font-sans font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
              Aguardar
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
  prestador: { name: string; plate: string; rating: number };
  durationMin: number;
  acceptedAt: number;
  onCancel: () => void;
  onArrive: () => void;
  onSendMessage: (text: string) => void;
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - acceptedAt) / 1000);
  const canCancelFree = elapsed < 60;
  const remaining = Math.max(0, 60 - elapsed);

  // Auto-arrive removed - waiting for driver updates via Supabase

  const initials = prestador.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

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
          <p className="font-display text-[17px] font-bold text-white">{prestador.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={12} fill={i <= Math.round(prestador.rating) ? "#F5A623" : "transparent"} style={{ color: "#F5A623" }} />
            ))}
            <span className="ml-1 font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {prestador.rating.toFixed(1)}
            </span>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full font-sans text-[12px] font-semibold text-white"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {prestador.plate}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Clock size={16} style={{ color: "#0DB87E" }} />
        <span className="font-sans text-[15px] font-medium text-white">
          Chegando em ~{durationMin} min
        </span>
      </div>
      <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full" style={{ background: "#0DB87E", width: `${Math.min(100, (elapsed / (durationMin * 60)) * 100)}%`, transition: "width 1s linear" }} />
      </div>

      {/* Chat chips */}
      <p className="mt-4 font-sans text-[10px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: 1.2 }}>
        Mensagem rápida
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {["Já estou aqui 📍", "Aguarde um momento ⏱", "Onde exatamente? 🗺"].map((m) => (
          <button
            key={m}
            onClick={() => onSendMessage(m)}
            className="shrink-0 px-3 h-9 rounded-full font-sans text-[13px] text-white"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {m}
          </button>
        ))}
      </div>

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

  // Auto-complete removed - waiting for driver to complete trip via Supabase

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
          Chegando em ~{durationMin} min
        </span>
      </div>

      <p className="mt-4 font-sans text-[10px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: 1.2 }}>
        Mensagem rápida
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {["Ok, pode ir 👍", "Preciso parar 🛑", "Estou no destino ✅"].map((m) => (
          <button
            key={m}
            onClick={() => onSendMessage(m)}
            className="shrink-0 px-3 h-9 rounded-full font-sans text-[13px] text-white"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {m}
          </button>
        ))}
      </div>

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

/* -------------------- COMPLETED Screen -------------------- */
const CompletedScreen = ({
  price,
  distanceKm,
  durationMin,
  onPay,
}: {
  price: number;
  distanceKm: number;
  durationMin: number;
  onPay: () => void;
}) => {
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [confirming, setConfirming] = useState(false);
  const [pixSeconds, setPixSeconds] = useState(300);
  useEffect(() => {
    if (method !== "pix") return;
    const id = setInterval(() => setPixSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [method]);
  const mm = String(Math.floor(pixSeconds / 60)).padStart(2, "0");
  const ss = String(pixSeconds % 60).padStart(2, "0");

  return (
    <div className="min-h-[100svh] bg-navy text-white overflow-y-auto" style={{ padding: "24px 24px 96px" }}>
      <h1 className="font-display text-[22px] font-bold">Resumo da corrida</h1>

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
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Tempo</span>
          <span>{durationMin} min</span>
        </div>
        <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex justify-between items-center">
          <span className="font-display text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            Total
          </span>
          <span className="font-display text-[20px] font-bold" style={{ color: "#0DB87E" }}>
            {formatBRL(price)}
          </span>
        </div>
        <SplitBreakdown total={price} />
      </div>

      <h2 className="mt-6 font-display text-[16px] font-bold">Forma de pagamento</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {([
          { key: "pix", label: "PIX", Icon: QrCode },
          { key: "card", label: "Cartão", Icon: CreditCard },
        ] as const).map(({ key, label, Icon }) => {
          const sel = method === key;
          return (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className="rounded-xl p-3 flex items-center gap-2"
              style={{
                background: sel ? "rgba(13,184,126,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sel ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
              }}
            >
              <Icon size={20} style={{ color: sel ? "#0DB87E" : "rgba(255,255,255,0.6)" }} />
              <span className="font-sans text-[14px] font-semibold text-white">{label}</span>
            </button>
          );
        })}
      </div>

      {method === "pix" ? (
        <div className="mt-4 flex flex-col items-center">
          <div className="bg-white rounded-lg p-3" style={{ width: 160, height: 160 }}>
            {/* Mock QR */}
            <svg viewBox="0 0 10 10" className="w-full h-full">
              {Array.from({ length: 100 }).map((_, i) => {
                const x = i % 10; const y = Math.floor(i / 10);
                const fill = (x + y * 3 + (x * y) % 5) % 2 === 0;
                return <rect key={i} x={x} y={y} width="1" height="1" fill={fill ? "#0B1B3E" : "#fff"} />;
              })}
            </svg>
          </div>
          <p className="mt-3 font-display text-[20px] font-semibold" style={{ color: "#0DB87E" }}>
            {mm}:{ss}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <p className="font-sans text-[14px] text-white">Visa •••• 4242</p>
        </div>
      )}

      <button
        onClick={() => {
          setConfirming(true);
          setTimeout(onPay, 1500);
        }}
        className="mt-6 w-full h-12 rounded-xl font-display font-semibold text-white"
        style={{ background: "#0DB87E" }}
      >
        Confirmar pagamento
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "rgba(11,27,62,0.95)" }}>
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
  const initials = prestador.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  if (done) {
    return (
      <div className="min-h-[100svh] bg-navy text-white flex flex-col items-center justify-center px-6 text-center">
        <Trophy size={64} style={{ color: "#F5A623" }} />
        <h2 className="mt-4 font-display text-[22px] font-bold">Obrigado!</h2>
        <p className="mt-2 font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
          Você está no sorteio de R$ 10.000 em 01/05! 🎉
        </p>
        <span className="mt-3 px-3 py-1 rounded-full font-sans text-[12px] font-semibold" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid #F5A623", color: "#F5A623" }}>
          Sorteio: 01/05
        </span>
        <button
          onClick={() => { onSubmit(); navigate("/app/home"); }}
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
  const initOnce = useRef(false);

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

  // Buscar motoristas online em tempo real
  useEffect(() => {
    const fetchOnlineDrivers = async () => {
      const { data, error } = await supabase
        .from('mototaxi_sessoes')
        .select('*')
        .eq('is_online', true);
      if (!error && data) {
        setOnlineDrivers(data);
      }
    };

    fetchOnlineDrivers();

    const channel = supabase
      .channel('mototaxi_sessoes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mototaxi_sessoes' },
        () => {
          fetchOnlineDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Escuta atualizações da corrida em tempo real
  useEffect(() => {
    if (!state.rideId) return;

    const syncCurrentStatus = async () => {
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

    const channel = supabase
      .channel(`ride_${state.rideId}`)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.rideId, state.origin]);

  // Escuta a localização em tempo real do prestador aceito
  useEffect(() => {
    if (state.status !== 'accepted' || !state.prestadorInfo || !state.rideId) return;

    let activePrestadorId: string | null = null;
    let channel: any = null;

    const fetchAndSubscribePrestadorLoc = async () => {
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

        channel = supabase
          .channel(`driver_loc_${activePrestadorId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'mototaxi_sessoes', filter: `prestador_id=eq.${activePrestadorId}` },
            (payload: any) => {
              if (payload.new) {
                setState({ prestadorLocation: { lat: Number(payload.new.lat), lng: Number(payload.new.lng) } });
              }
            }
          )
          .subscribe();
      }
    };

    fetchAndSubscribePrestadorLoc();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [state.status, state.rideId]);

  const handleConfirm = async () => {
    if (!state.origin || !state.destination || !user.uid) return;

    const newRide = {
      tomador_id: user.uid,
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

    const { data, error } = await supabase
      .from('mototaxi_corridas')
      .insert(newRide)
      .select()
      .single();

    if (error) {
      console.error('Error creating ride:', error);
      alert('Erro ao solicitar mototáxi.');
      return;
    }

    setState({
      status: 'searching',
      rideId: data.id
    });
  };

  const handleCancel = async () => {
    if (state.rideId) {
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
    // Tenta chamar a Edge Function segura no backend
    try {
      await supabase.functions.invoke("checkout", {
        body: {
          service_type: "mototaxi",
          service_id: state.rideId,
          customer_id: user.uid || "mock-customer",
          provider_id: "mock-driver-id",
          amount: state.finalPrice || state.estimatedPrice,
          payment_method: state.paymentMethod || "pix"
        }
      });
    } catch (funcErr) {
      console.warn("Falha ao chamar Edge Function, usando fallback local:", funcErr);
    }
    setState({ status: "rating", paymentMethod: state.paymentMethod || "pix" });
  };

  const sendMessage = (text: string) => {
    setState({
      messages: [...state.messages, { text, from: "tomador", ts: Date.now() }],
    });
  };

  // Completed and rating are full-screen
  if (state.status === "completed" && state.prestadorInfo) {
    return (
      <CompletedScreen
        price={state.finalPrice || state.estimatedPrice}
        distanceKm={state.distanceKm}
        durationMin={state.durationMin}
        onPay={handlePay}
      />
    );
  }
  if (state.status === "rating" && state.prestadorInfo) {
    return (
      <RatingScreen
        prestador={state.prestadorInfo}
        onSubmit={resetRide}
      />
    );
  }

  return (
    <div className="relative w-full h-[100svh] overflow-hidden bg-navy">
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
        style={{ background: "rgba(11,27,62,0.85)", border: "1px solid rgba(255,255,255,0.10)" }}
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

      {state.status === "accepted" && state.prestadorInfo && state.acceptedAt && (
        <AcceptedSheet
          prestador={state.prestadorInfo}
          durationMin={state.durationMin}
          acceptedAt={state.acceptedAt}
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
