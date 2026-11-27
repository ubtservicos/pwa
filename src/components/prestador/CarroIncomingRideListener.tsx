import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Package, MapPin, Navigation } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/utils/ride";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import {
  parseChamadoData,
  playChamadoSound,
  type Chamado,
} from "@/components/prestador/MototaxiIncomingRideListener";

const isDevOrHomolog =
  import.meta.env.DEV ||
  (typeof window !== "undefined" &&
    (window.location.hostname.includes("vercel.app") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"));

const CarroChamadoModal = ({
  chamado,
  onAccept,
  onReject,
}: {
  chamado: Chamado;
  onAccept: () => void;
  onReject: () => void;
}) => {
  const calculateRemaining = useCallback(() => {
    if (!chamado?.createdAt) return 60;
    const elapsed = Math.floor((Date.now() - new Date(chamado.createdAt).getTime()) / 1000);
    if (isDevOrHomolog) {
      return Math.max(10, 60 - (isNaN(elapsed) ? 0 : elapsed % 60));
    }
    return Math.max(0, 60 - (isNaN(elapsed) ? 0 : elapsed));
  }, [chamado?.createdAt]);

  const [seconds, setSeconds] = useState<number>(calculateRemaining);

  useEffect(() => {
    playChamadoSound();
  }, []);

  useEffect(() => {
    if (!chamado || !chamado.id) return;
    const initialRem = calculateRemaining();
    if (initialRem <= 0) {
      onReject();
      return;
    }
    setSeconds(initialRem);
    const intervalId = setInterval(() => {
      const rem = calculateRemaining();
      setSeconds(rem);
      if (rem <= 0) {
        clearInterval(intervalId);
        onReject();
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [chamado?.id, chamado?.createdAt, calculateRemaining, onReject]);

  if (!chamado || !chamado.id || !chamado.origin || !chamado.destination) {
    return null;
  }

  const C = 175.93;
  const dash = (seconds / 60) * C;
  const youReceive = (chamado.price || 0) * 0.9;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-[1100]"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1100 }}
    >
      <div
        className="w-full max-w-md pb-28"
        style={{
          background: "var(--prestador-card, #121215)",
          borderTop: "2px solid var(--prestador-border, rgba(255,255,255,0.1))",
          borderRadius: "24px 24px 0 0",
          padding: "24px 24px 100px 24px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-1"
              style={{ background: "rgba(0,230,118,0.15)", color: "#00E676", border: "1px solid rgba(0,230,118,0.3)" }}
            >
              Novo Pedido · Carros
            </span>
            <h3 className="font-display text-[20px] font-bold text-white">Chamado Disponível! 🔔</h3>
          </div>
          <svg width="60" height="60" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#00E676"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="38" textAnchor="middle" fill="#FFFFFF" fontSize="17" fontWeight="700" fontFamily="Syne">
              {seconds}s
            </text>
          </svg>
        </div>

        <div
          className="mt-4 rounded-2xl"
          style={{ background: "var(--prestador-bg, #09090B)", border: "1px solid var(--prestador-border, rgba(255,255,255,0.1))", padding: 18 }}
        >
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-sans text-[12px] font-semibold"
            style={{ background: "rgba(0,230,118,0.15)", color: "#00E676" }}
          >
            {chamado.type === "entrega" ? <Package size={12} /> : <Car size={12} />}
            {chamado.type === "entrega" ? "Entrega · Carro" : "Carona · Carro"}
          </span>

          <div className="mt-3 flex items-start gap-2">
            <MapPin size={16} color="#00E676" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px] text-white">{chamado.origin}</span>
          </div>
          <div className="my-1 flex justify-center">
            <Navigation size={15} color="rgba(255,255,255,0.30)" />
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} color="#E84040" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px] text-white">{chamado.destination}</span>
          </div>

          <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <p className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            {chamado.distanceKm} km · ~{chamado.durationMin} min
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Você recebe (90%)
            </span>
            <span className="font-display text-[22px] font-bold" style={{ color: "#00E676" }}>
              {formatBRL(youReceive)}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAccept}
            className="w-full h-12 rounded-xl font-display font-semibold text-[#09090B] flex items-center justify-center transition-transform active:scale-98 shadow-md"
            style={{ background: "#00E676" }}
          >
            Aceitar Corrida ({seconds}s)
          </button>
          <button
            type="button"
            onClick={onReject}
            className="w-full h-11 rounded-xl font-sans text-[14px] font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
};

export const CarroIncomingRideListener = ({ isOnline }: { isOnline: boolean }) => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const rejectedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOnline) {
      setChamado(null);
      return;
    }

    const fetchActiveChamado = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const timeLimitMs = isDevOrHomolog ? 15 * 60 * 1000 : 60000;
        const timeLimitIso = new Date(Date.now() - timeLimitMs).toISOString();
        const { data, error } = await supabase
          .from("carro_corridas")
          .select("*")
          .in("status", ["searching", "pending", "buscando", "solicitado"])
          .gte("created_at", timeLimitIso)
          .or(`prestador_id.is.null,prestador_id.eq.${user.uid}`)
          .order("created_at", { ascending: false })
          .limit(5);

        if (error || !data) return;

        const firstEligible = data.find((r: any) => r?.id && !rejectedRef.current.has(r.id));
        if (firstEligible) {
          const parsed = parseChamadoData(firstEligible);
          if (parsed) {
            setChamado((prev) => {
              if (prev && prev.id === parsed.id) return prev;
              playChamadoSound();
              return parsed;
            });
          }
        }
      } catch {
        // noop
      }
    };

    void fetchActiveChamado();
    const pollInterval = setInterval(fetchActiveChamado, 2500);
    return () => clearInterval(pollInterval);
  }, [isOnline, user.uid]);

  const handleNewCorrida = useCallback(
    (payload: any) => {
      if (!isOnline) return;
      const c = payload.new;
      const isPending = c && ["searching", "pending", "buscando", "solicitado"].includes(c.status);
      const isTargetPrestador = c && (!c.prestador_id || c.prestador_id === user.uid);
      if (c && isPending && isTargetPrestador && !rejectedRef.current.has(c.id)) {
        const parsed = parseChamadoData(c);
        if (parsed) {
          setChamado(parsed);
          playChamadoSound();
        }
      } else if (c && !isPending) {
        setChamado((prev) => (prev && prev.id === c.id ? null : prev));
      }
    },
    [isOnline, user.uid],
  );

  useRealtimeChannel(
    isOnline ? `public:carro_corridas_listener_${user.uid || "online"}` : null,
    { event: "*", table: "carro_corridas" },
    handleNewCorrida,
  );

  useEffect(() => {
    if (!isOnline) return;
    const broadcastChan = supabase
      .channel("carro_chamados_broadcast")
      .on("broadcast", { event: "new_chamado" }, ({ payload }) => {
        if (payload && payload.id && !rejectedRef.current.has(payload.id)) {
          const parsed = parseChamadoData(payload);
          if (parsed) {
            setChamado(parsed);
            playChamadoSound();
          }
        }
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(broadcastChan);
      } catch { /* noop */ }
    };
  }, [isOnline]);

  const accept = async () => {
    if (!chamado) return;
    let currentUid = user.uid;
    if (!currentUid) {
      const { data: authData } = await supabase.auth.getUser();
      currentUid = authData?.user?.id || "";
    }

    try {
      const { data: carProf } = await supabase
        .from("prestador_carro")
        .select(
          "plate, brand_model, carro_photo_url, carro_interno_photo_url, cor, ano, portas, ar_condicionado, cnh_categoria, possui_ear, alvara_municipal, vehicle_subtype",
        )
        .eq("user_id", currentUid)
        .maybeSingle();

      const { data, error } = await supabase
        .from("carro_corridas")
        .update({
          status: "accepted",
          prestador_id: currentUid,
          accepted_at: new Date().toISOString(),
          vehicle_snapshot: carProf || {},
        })
        .eq("id", chamado.id)
        .in("status", ["searching", "pending", "buscando", "solicitado"])
        .is("prestador_id", null)
        .select()
        .maybeSingle();

      if (error || !data) {
        alert(`Erro ao aceitar corrida: ${error?.message || "Outro motorista pode ter aceitado."}`);
        setChamado(null);
        return;
      }

      sessionStorage.setItem(
        "ubt_active_carro_ride",
        JSON.stringify({ ...chamado, id: data.id, prestador_id: currentUid }),
      );
      setChamado(null);
      navigate(`/app/prestador/carros/corrida/${data.id}`);
    } catch {
      alert("Erro ao aceitar corrida! Tente novamente.");
      setChamado(null);
    }
  };

  const reject = () => {
    if (chamado?.id) rejectedRef.current.add(chamado.id);
    setChamado(null);
  };

  if (!chamado) return null;

  return <CarroChamadoModal chamado={chamado} onAccept={accept} onReject={reject} />;
};

export default CarroIncomingRideListener;
