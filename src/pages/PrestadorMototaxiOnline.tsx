import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Bike, Package, ArrowLeft, Settings } from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import GhostButtonLight from "@/components/prestador/GhostButtonLight";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { calcPrice, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isLocationInUbatuba } from "@/services/GeofenceService";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

const UBATUBA = { lat: -23.4336, lng: -45.0838 };

interface Chamado {
  id: string;
  type: "carona" | "entrega";
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  price: number;
}

const MOCK_CHAMADO: Chamado = {
  id: "ride-001",
  type: "carona",
  origin: "Rua das Toninhas, 120",
  destination: "Praia Grande, Quiosque 8",
  distanceKm: 3.4,
  durationMin: 11,
  price: calcPrice(3.4),
};

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div
    className="absolute left-0 right-0 bottom-0 z-10"
    style={{
      background: "var(--prestador-card)",
      borderTop: "1px solid var(--prestador-border)",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
      zIndex: 1000,
    }}
  >
    <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)" }} />
    {children}
  </div>
);

const ChamadoModal = ({
  chamado,
  onAccept,
  onReject,
}: { chamado: Chamado; onAccept: () => void; onReject: () => void }) => {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as Navigator).vibrate?.([200, 100, 200]); } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    if (seconds <= 0) { onReject(); return; }
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds, onReject]);

  const C = 175.93; // 2 * pi * 28
  const dash = (seconds / 60) * C;
  const youReceive = chamado.price * 0.9;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)", zIndex: 1050 }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: "var(--prestador-card)",
          borderTop: "2px solid var(--prestador-border)",
          borderRadius: "24px 24px 0 0",
          padding: 24,
          animation: "ubt-slide-up 300ms ease-out",
        }}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display text-[20px] font-bold text-white">
            Novo chamado! 🔔
          </h3>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none" stroke="#00FF66" strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="38" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="700" fontFamily="Syne">
              {seconds}
            </text>
          </svg>
        </div>

        <div
          className="mt-4 rounded-2xl"
          style={{ background: "var(--prestador-bg)", border: "1px solid var(--prestador-border)", padding: 20 }}
        >
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-sans text-[12px] font-semibold"
            style={{ background: "rgba(0,255,102,0.10)", color: "#00FF66" }}
          >
            {chamado.type === "entrega" ? <Package size={12} /> : <Bike size={12} />}
            {chamado.type === "entrega" ? "Entrega" : "Carona"}
          </span>

          <div className="mt-3 flex items-start gap-2">
            <MapPin size={16} color="#00FF66" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px] text-white">
              {chamado.origin}
            </span>
          </div>
          <div className="my-1 flex justify-center">
            <Navigation size={16} color="rgba(255,255,255,0.30)" />
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} color="#E84040" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px] text-white">
              {chamado.destination}
            </span>
          </div>

          <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <p className="font-sans text-[13px] text-white/60">
            {chamado.distanceKm} km · ~{chamado.durationMin} min
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-sans text-[13px] text-white/50">
              Você recebe
            </span>
            <span className="font-display text-[22px] font-bold text-[#00FF66]">
              {formatBRL(youReceive)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="w-full min-h-[52px] rounded-full font-display font-bold text-sm text-[#09090B] animate-pulse"
            style={{ background: "#00FF66" }}
          >
            Aceitar
          </button>
          <button
            type="button"
            onClick={onReject}
            className="w-full min-h-[52px] rounded-full font-sans font-medium text-sm text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Recusar
          </button>
        </div>

        <style>{`
          @keyframes ubt-slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
};

const PrestadorMototaxiOnline = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(UBATUBA);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (user.uid && user.kycStatus !== "approved") {
      navigate("/app/prestador/mototaxi/onboarding");
    }
  }, [user.uid, user.kycStatus, navigate]);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    } catch { /* noop */ }
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Sincronizar sessão online no Supabase
  useEffect(() => {
    if (!user.uid || !myLocation) return;
    async function syncSession() {
      const isInside = isLocationInUbatuba(myLocation.lat, myLocation.lng);
      if (!isInside) {
        toast.error("Serviço indisponível: Você está fora dos limites de atendimento de Ubatuba-SP.");
        goOffline();
        return;
      }
      await supabase
        .from('mototaxi_sessoes')
        .upsert({
          prestador_id: user.uid,
          is_online: true,
          lat: myLocation.lat,
          lng: myLocation.lng,
          updated_at: new Date().toISOString()
        });
    }
    syncSession();
  }, [user.uid, myLocation]);

  // Escutar chamados reais em tempo real
  useEffect(() => {
    if (!user.uid) return;

    const fetchActiveChamado = async () => {
      const { data, error } = await supabase
        .from('mototaxi_corridas')
        .select('*')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const c = data[0];
        const originObj = typeof c.origin === 'string' ? JSON.parse(c.origin) : c.origin;
        const destObj = typeof c.destination === 'string' ? JSON.parse(c.destination) : c.destination;
        setChamado({
          id: c.id,
          type: c.type,
          origin: originObj.address || 'Origem',
          destination: destObj.address || 'Destino',
          distanceKm: Number(c.distance_km),
          durationMin: c.duration_min,
          price: Number(c.estimated_price)
        });
      }
    };

    fetchActiveChamado();
  }, [user.uid]);

  // Realtime subscription with auto-reconnect (replaces raw .subscribe())
  const handleNewCorrida = useCallback((payload: any) => {
    if (payload.new) {
      const c = payload.new;
      const originObj = typeof c.origin === 'string' ? JSON.parse(c.origin) : c.origin;
      const destObj = typeof c.destination === 'string' ? JSON.parse(c.destination) : c.destination;
      setChamado({
        id: c.id,
        type: c.type,
        origin: originObj.address || 'Origem',
        destination: destObj.address || 'Destino',
        distanceKm: Number(c.distance_km),
        durationMin: c.duration_min,
        price: Number(c.estimated_price)
      });
    }
  }, []);

  useRealtimeChannel(
    'public:mototaxi_corridas',
    { event: 'INSERT', table: 'mototaxi_corridas', filter: 'status=eq.searching' },
    handleNewCorrida,
    (status) => {
      if (status === 'reconnecting') toast.info('Reconectando ao servidor...');
      if (status === 'error') toast.error('Conexão perdida. Atualize a página.');
    }
  );

  const goOffline = async () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (user.uid) {
      try {
        await supabase
          .from('mototaxi_sessoes')
          .update({ is_online: false })
          .eq('prestador_id', user.uid);
      } catch (err) {
        console.error('Erro ao desativar sessão:', err);
      }
    }
    navigate("/app/prestador/home");
  };

  const accept = async () => {
    if (!chamado) return;
    try {
      const { data, error } = await supabase
        .from('mototaxi_corridas')
        .update({
          status: 'accepted',
          prestador_id: user.uid,
          accepted_at: new Date().toISOString()
        })
        .eq('id', chamado.id)
        .eq('status', 'searching')
        .is('prestador_id', null)
        .select('id')
        .single();

      if (error || !data) {
        alert('Esta corrida já foi aceita por outro motorista.');
        setChamado(null);
        return;
      }

      sessionStorage.setItem("ubt_active_ride", JSON.stringify(chamado));
      setChamado(null);
      navigate("/app/prestador/mototaxi/active");
    } catch (e) {
      console.error('Erro ao aceitar corrida:', e);
      alert('Erro ao aceitar corrida! Outro motorista pode ter aceitado.');
      setChamado(null);
    }
  };

  return (
    <div className="relative min-h-[100svh]" style={{ background: "var(--prestador-bg)" }}>
      {/* Floating Header */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000,
          background: "rgba(39, 39, 42, 0.9)",
          backdropFilter: "blur(10px)",
          borderRadius: 16,
          padding: "12px 16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          border: "1px solid var(--prestador-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <button
          onClick={goOffline}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#FFFFFF",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
          Mototáxi Online
        </h1>

        <button
          onClick={() => navigate("/app/prestador/mototaxi/onboarding")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#FFFFFF",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Ajustes"
        >
          <Settings size={22} />
        </button>
      </div>

      <div className="absolute inset-0">
        <PrestadorMapLight myLocation={myLocation} />
      </div>

      <Sheet>
        <div className="flex items-center gap-2">
          <span
            className="block w-2.5 h-2.5 rounded-full"
            style={{ background: "#00FF66", animation: "ubt-pulse-dot 1.4s ease-in-out infinite" }}
          />
          <h2 className="font-display text-[16px] font-bold text-white">
            Online — aguardando chamados
          </h2>
        </div>
        <p className="mt-1 font-sans text-[13px] text-white/50">
          Raio de atendimento: 5 km
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center px-2 py-1 rounded-full font-sans text-[12px] font-semibold"
            style={{ background: "rgba(0,255,102,0.1)", border: "1px solid #00FF66", color: "#00FF66" }}
          >
            Carona e Entrega
          </span>
        </div>

        <div
          className="mt-3 rounded-xl flex items-center justify-between"
          style={{ background: "var(--prestador-bg)", border: "1px solid var(--prestador-border)", padding: "12px 16px" }}
        >
          <span className="font-sans text-[14px] text-white">
            Hoje: <strong>R$ 0,00</strong>
          </span>
          <span className="font-sans text-[12px] text-white/50">
            0 corridas
          </span>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={goOffline}
            className="w-full min-h-[48px] rounded-full font-sans font-medium text-sm text-white/70 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--prestador-border)" }}
          >
            Ficar Offline
          </button>
        </div>

        <style>{`
          @keyframes ubt-pulse-dot {
            0%,100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
        `}</style>
      </Sheet>

      {chamado && (
        <ChamadoModal
          chamado={chamado}
          onAccept={accept}
          onReject={() => setChamado(null)}
        />
      )}
    </div>
  );
};

export default PrestadorMototaxiOnline;
