import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Navigation, MapPin, CheckCircle2, Star,
  User as UserIcon, Building2, Users, Gift, Heart,
} from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { calcSplit, formatBRL, SPLIT_META } from "@/utils/ride";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

const ICONS = { User: UserIcon, Building2, Users, Gift, Star, Heart } as const;
type IconKey = keyof typeof ICONS;

const UBATUBA = { lat: -23.4336, lng: -45.0838 };
const ORIGIN = { lat: UBATUBA.lat + 0.005, lng: UBATUBA.lng + 0.003 };
const DESTINATION = { lat: UBATUBA.lat + 0.018, lng: UBATUBA.lng + 0.012 };

type Phase = "arriving" | "in_progress" | "completed";

interface ActiveRide {
  id: string;
  type: "carona" | "entrega";
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
}

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div
    className="absolute left-0 right-0 bottom-0 z-10"
    style={{
      background: "#FFFFFF",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -4px 24px rgba(11,27,62,0.12)",
    }}
  >
    <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "#D8DBE5" }} />
    {children}
  </div>
);

const PrestadorMototaxiActive = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [phase, setPhase] = useState<Phase>("arriving");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number }>(UBATUBA);
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  // Carregar dados da corrida do banco
  useEffect(() => {
    const loadRideFromDb = async (rideId: string) => {
      const { data, error } = await supabase
        .from('mototaxi_corridas')
        .select('*')
        .eq('id', rideId)
        .single();
      if (data && !error) {
        const originObj = typeof data.origin === 'string' ? JSON.parse(data.origin) : data.origin;
        const destObj = typeof data.destination === 'string' ? JSON.parse(data.destination) : data.destination;
        setRide({
          id: data.id,
          type: data.type,
          origin: originObj.address || 'Origem',
          destination: destObj.address || 'Destino',
          distanceKm: Number(data.distance_km),
          durationMin: data.duration_min,
          price: Number(data.estimated_price),
          originCoords: { lat: Number(originObj.lat), lng: Number(originObj.lng) },
          destinationCoords: { lat: Number(destObj.lat), lng: Number(destObj.lng) }
        });
        if (data.status === 'in_progress') {
          setPhase("in_progress");
        } else if (data.status === 'completed') {
          setPhase("completed");
        }
      }
    };

    const stored = sessionStorage.getItem("ubt_active_ride");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        loadRideFromDb(parsed.id);
      } catch { /* noop */ }
    } else {
      // fallback
      setRide({
        id: "ride-001",
        type: "carona",
        origin: "Rua das Toninhas, 120",
        destination: "Praia Grande, Quiosque 8",
        distanceKm: 3.4,
        durationMin: 11,
        price: 12.5,
        originCoords: ORIGIN,
        destinationCoords: DESTINATION
      });
    }
  }, []);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    let id: number | null = null;
    try {
      id = navigator.geolocation.watchPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    } catch { /* noop */ }
    return () => {
      if (id !== null && navigator.geolocation) navigator.geolocation.clearWatch(id);
    };
  }, []);

  // Sincronizar sessão GPS no Supabase
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

  // Escutar cancelamento da corrida pelo passageiro
  useEffect(() => {
    if (!ride?.id) return;

    const channel = supabase
      .channel(`active_ride_${ride.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mototaxi_corridas', filter: `id=eq.${ride.id}` },
        (payload: any) => {
          if (payload.new && payload.new.status === 'cancelled') {
            alert('A corrida foi cancelada pelo passageiro.');
            sessionStorage.removeItem("ubt_active_ride");
            navigate("/app/prestador/home");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id, navigate]);

  if (!ride) return null;

  const startRide = async () => {
    try {
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({ status: 'in_progress' })
        .eq('id', ride.id);
      if (error) throw error;
      setPhase("in_progress");
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar corrida.');
    }
  };

  const completeRide = async () => {
    try {
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({ status: 'completed', final_price: ride.price })
        .eq('id', ride.id);
      if (error) throw error;
      setPhase("completed");
    } catch (e) {
      console.error(e);
      alert('Erro ao concluir corrida.');
    }
  };

  const finalize = () => {
    sessionStorage.removeItem("ubt_active_ride");
    navigate("/app/prestador/home");
  };

  /* ---------------- COMPLETED ---------------- */
  if (phase === "completed") {
    const youReceive = ride.price * 0.9;
    const split = calcSplit(ride.price);
    return (
      <div
        className="min-h-[100svh] overflow-y-auto"
        style={{ background: "#F7F8FA", padding: 24, paddingBottom: 96 }}
      >
        <div className="text-center pt-4">
          <CheckCircle2 size={48} color="#0DB87E" className="mx-auto" />
          <h1 className="mt-3 font-display text-[22px] font-bold" style={{ color: "#0B1B3E" }}>
            Serviço concluído!
          </h1>
        </div>

        <div
          className="mt-5 rounded-2xl text-center"
          style={{ background: "#fff", padding: 20, boxShadow: "0 2px 8px rgba(11,27,62,0.06)" }}
        >
          <p className="font-sans text-[13px]" style={{ color: "#9399AD" }}>Você recebeu</p>
          <p className="mt-1 font-display text-[28px] font-bold" style={{ color: "#0DB87E" }}>
            {formatBRL(youReceive)}
          </p>

          <div className="my-3 h-px" style={{ background: "#EFF0F3" }} />

          <div className="space-y-1.5 text-left">
            {SPLIT_META.map((m) => {
              const Icon = ICONS[m.icon as IconKey];
              const value = split[m.key];
              const isPrest = m.key === "prestador";
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <Icon size={14} style={{ color: m.color }} />
                  <span className="font-sans text-[12px] flex-1" style={{ color: "#5B6178" }}>
                    {m.label}
                  </span>
                  <span
                    className="font-sans text-[12px]"
                    style={{ color: isPrest ? "#0DB87E" : "#5B6178", fontWeight: isPrest ? 600 : 400 }}
                  >
                    {formatBRL(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-sans text-[14px] font-semibold" style={{ color: "#0B1B3E" }}>
            Como foi o cliente?
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`Nota ${i}`}>
                <Star
                  size={32}
                  fill={i <= rating ? "#F5A623" : "transparent"}
                  color={i <= rating ? "#F5A623" : "#D8DBE5"}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentário opcional..."
            rows={4}
            className="mt-4 w-full rounded-xl outline-none font-sans text-[14px] resize-none"
            style={{
              background: "#FFFFFF",
              border: "1px solid #D8DBE5",
              padding: "12px 14px",
              color: "#0B1B3E",
              minHeight: 100,
            }}
          />
        </div>

        <div className="mt-5">
          <PrimaryButtonLight onClick={finalize}>
            Enviar e voltar ao trabalho
          </PrimaryButtonLight>
        </div>
      </div>
    );
  }

  /* ---------------- ARRIVING / IN_PROGRESS ---------------- */
  const routeFrom = phase === "arriving" ? myLocation : (ride.originCoords || ORIGIN);
  const routeTo = phase === "arriving" ? (ride.originCoords || ORIGIN) : (ride.destinationCoords || DESTINATION);

  return (
    <div className="relative min-h-[100svh]" style={{ background: "#F7F8FA" }}>
      <div className="absolute inset-0">
        <PrestadorMapLight
          myLocation={myLocation}
          origin={ride.originCoords || ORIGIN}
          destination={phase === "in_progress" ? (ride.destinationCoords || DESTINATION) : null}
          routeFrom={routeFrom}
          routeTo={routeTo}
        />
      </div>

      <Sheet>
        {phase === "arriving" ? (
          <>
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-sans text-[12px] font-semibold"
              style={{ background: "#E6FAF4", border: "1px solid #0DB87E", color: "#0DB87E" }}
            >
              A caminho do cliente
            </span>

            <div className="mt-3 flex items-start gap-2">
              <Navigation size={16} color="#0DB87E" className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-semibold" style={{ color: "#0B1B3E" }}>
                  {ride.origin}
                </p>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178" }}>
                  ~{ride.durationMin} min
                </p>
              </div>
            </div>

            <div
              className="mt-3 rounded-xl flex items-center gap-3"
              style={{ background: "#F7F8FA", padding: 12 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "#E6FAF4", color: "#0DB87E" }}
              >
                <span className="font-display font-bold text-[14px]">MS</span>
              </div>
              <p className="font-sans text-[14px] font-semibold" style={{ color: "#0B1B3E" }}>
                Maria Silva
              </p>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                className="shrink-0 px-3 h-9 rounded-full font-sans text-[13px]"
                style={{ background: "#EFF0F3", border: "1px solid #D8DBE5", color: "#0B1B3E" }}
              >
                Já estou chegando 🏍
              </button>
            </div>

            <div className="mt-4">
              <PrimaryButtonLight onClick={startRide}>
                Cheguei ao ponto de embarque
              </PrimaryButtonLight>
            </div>
          </>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-sans text-[12px] font-semibold"
              style={{ background: "#E6FAF4", border: "1px solid #0DB87E", color: "#0DB87E" }}
            >
              Em andamento
            </span>

            <div className="mt-3 flex items-start gap-2">
              <MapPin size={16} color="#E84040" className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-semibold" style={{ color: "#0B1B3E" }}>
                  {ride.destination}
                </p>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178" }}>
                  ~{ride.durationMin} min
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {["A caminho 🏍", "Quase lá ✅", "Aguarde 1 min ⏱"].map((m) => (
                <button
                  key={m}
                  className="shrink-0 px-3 h-9 rounded-full font-sans text-[13px]"
                  style={{ background: "#EFF0F3", border: "1px solid #D8DBE5", color: "#0B1B3E" }}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <PrimaryButtonLight onClick={completeRide}>
                Concluir serviço
              </PrimaryButtonLight>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
};

export default PrestadorMototaxiActive;
