import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation, Bike, Package, ArrowLeft, Settings } from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import GhostButtonLight from "@/components/prestador/GhostButtonLight";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { calcPrice, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";

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
      background: "#FFFFFF",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -4px 24px rgba(11,27,62,0.12)",
      zIndex: 1000,
    }}
  >
    <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "#D8DBE5" }} />
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
      style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(4px)", zIndex: 1050 }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          padding: 24,
          animation: "ubt-slide-up 300ms ease-out",
        }}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display text-[20px] font-bold" style={{ color: "#0B1B3E" }}>
            Novo chamado! 🔔
          </h3>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#EFF0F3" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none" stroke="#0DB87E" strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="38" textAnchor="middle" fill="#0B1B3E" fontSize="18" fontWeight="700" fontFamily="Syne">
              {seconds}
            </text>
          </svg>
        </div>

        <div
          className="mt-4 rounded-2xl"
          style={{ background: "#F7F8FA", padding: 20 }}
        >
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans text-[12px] font-semibold"
            style={{ background: "#E6FAF4", color: "#0DB87E" }}
          >
            {chamado.type === "entrega" ? <Package size={12} /> : <Bike size={12} />}
            {chamado.type === "entrega" ? "Entrega" : "Carona"}
          </span>

          <div className="mt-3 flex items-start gap-2">
            <MapPin size={16} color="#0DB87E" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px]" style={{ color: "#0B1B3E" }}>
              {chamado.origin}
            </span>
          </div>
          <div className="my-1 flex justify-center">
            <Navigation size={16} color="#9399AD" />
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} color="#E84040" className="mt-0.5 shrink-0" />
            <span className="font-sans text-[14px]" style={{ color: "#0B1B3E" }}>
              {chamado.destination}
            </span>
          </div>

          <div className="my-3 h-px" style={{ background: "#EFF0F3" }} />

          <p className="font-sans text-[13px]" style={{ color: "#5B6178" }}>
            {chamado.distanceKm} km · ~{chamado.durationMin} min
          </p>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-sans text-[13px]" style={{ color: "#9399AD" }}>
              Você recebe
            </span>
            <span className="font-display text-[22px] font-bold" style={{ color: "#0DB87E" }}>
              {formatBRL(youReceive)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="w-full min-h-[52px] rounded-full font-display font-semibold text-sm"
            style={{ background: "#0DB87E", color: "#fff" }}
          >
            Aceitar
          </button>
          <GhostButtonLight onClick={onReject}>Recusar</GhostButtonLight>
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

    const channel = supabase
      .channel('public:mototaxi_corridas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mototaxi_corridas', filter: 'status=eq.searching' },
        (payload: any) => {
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.uid]);

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
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({
          status: 'accepted',
          prestador_id: user.uid,
          accepted_at: new Date().toISOString()
        })
        .eq('id', chamado.id);

      if (error) throw error;

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
    <div className="relative min-h-[100svh]" style={{ background: "#F7F8FA" }}>
      {/* Floating Header */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          borderRadius: 16,
          padding: "12px 16px",
          boxShadow: "0 4px 18px rgba(11, 27, 62, 0.08)",
          border: "1px solid rgba(11, 27, 62, 0.06)",
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
            color: "#0B1B3E",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
          Mototáxi Online
        </h1>

        <button
          onClick={() => navigate("/app/prestador/mototaxi/onboarding")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#0B1B3E",
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
            style={{ background: "#0DB87E", animation: "ubt-pulse-dot 1.4s ease-in-out infinite" }}
          />
          <h2 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>
            Online — aguardando chamados
          </h2>
        </div>
        <p className="mt-1 font-sans text-[13px]" style={{ color: "#5B6178" }}>
          Raio de atendimento: 5 km
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center px-2 py-1 rounded-full font-sans text-[12px] font-semibold"
            style={{ background: "#E6FAF4", border: "1px solid #0DB87E", color: "#0DB87E" }}
          >
            Carona e Entrega
          </span>
        </div>

        <div
          className="mt-3 rounded-xl flex items-center justify-between"
          style={{ background: "#EFF0F3", padding: "12px 16px" }}
        >
          <span className="font-sans text-[14px]" style={{ color: "#0B1B3E" }}>
            Hoje: <strong>R$ 0,00</strong>
          </span>
          <span className="font-sans text-[12px]" style={{ color: "#9399AD" }}>
            0 corridas
          </span>
        </div>

        <div className="mt-4">
          <GhostButtonLight onClick={goOffline}>Ficar Offline</GhostButtonLight>
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
