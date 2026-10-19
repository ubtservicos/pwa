import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Bike,
  Package,
  ArrowLeft,
  Settings,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  TrendingUp,
  Radio
} from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isLocationInUbatuba } from "@/services/GeofenceService";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { parseChamadoData } from "@/components/prestador/MototaxiIncomingRideListener";

const UBATUBA = { lat: -23.4336, lng: -45.0838 };

type Modalidade = "carona_entrega" | "so_entrega" | "so_carona";

interface Chamado {
  id: string;
  type: "carona" | "entrega";
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  createdAt?: string;
}

const playChamadoSound = () => {
  try {
    const userHasInteracted =
      typeof navigator !== "undefined" &&
      ((navigator as any).userActivation?.hasBeenActive ?? false);

    if (userHasInteracted) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          (navigator as Navigator).vibrate?.([200, 100, 200, 100, 500]);
        } catch {}
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.3); // D6
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        try {
          osc.start();
          osc.stop(audioCtx.currentTime + 0.6);
        } catch {}
      }
    }
  } catch {}
};

const ChamadoModal = ({
  chamado,
  onAccept,
  onReject,
}: { chamado: Chamado; onAccept: () => void; onReject: () => void }) => {
  if (!chamado || !chamado.id || !chamado.origin || !chamado.destination) {
    return null;
  }

  const youReceive = chamado.price * 0.82;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-zinc-900 border border-[#00FF66]/40 p-6 shadow-[0_0_40px_rgba(0,255,102,0.15)] animate-in slide-in-from-bottom-8 duration-300"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00FF66] animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-[#00FF66]">
              Novo Chamado Disponível!
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase">
            {chamado.type === "carona" ? "Passageiro" : "Entrega"}
          </span>
        </div>

        <div className="space-y-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-start gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] mt-1.5 shrink-0 shadow-[0_0_8px_#00FF66]" />
            <div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase">Origem / Embarque</p>
              <p className="text-sm font-bold text-white leading-tight">{chamado.origin}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-zinc-800/80">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase">Destino Final</p>
              <p className="text-sm font-bold text-white leading-tight">{chamado.destination}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {chamado.distanceKm} km · ~{chamado.durationMin} min
            </span>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block">Você recebe</span>
              <span className="text-xl font-black text-[#00FF66]">
                {formatBRL(youReceive)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReject}
            className="py-3.5 rounded-xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="py-3.5 rounded-xl font-black text-sm bg-[#00FF66] text-black hover:bg-[#00FF66]/90 transition shadow-lg shadow-[#00FF66]/30 cursor-pointer animate-pulse"
          >
            Aceitar Corrida
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PrestadorMototaxiOnline() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Estados principais
  const [isOnline, setIsOnline] = useState(false);
  const [modalidade, setModalidade] = useState<Modalidade>("carona_entrega");
  const [cidade, setCidade] = useState("Ubatuba, SP");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(UBATUBA);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [filaCount, setFilaCount] = useState(0);
  const [ganhosHoje, setGanhosHoje] = useState(0);
  const [corridasHoje, setCorridasHoje] = useState(0);
  const [updatingGps, setUpdatingGps] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  // Redirecionamento se não tem cadastro KYC
  useEffect(() => {
    if (!user.isLoading && user.uid && user.kycStatus === "none") {
      navigate("/app/prestador/mototaxi/onboarding");
    }
  }, [user.isLoading, user.uid, user.kycStatus, navigate]);

  // Carrega configurações prévias do mototaxista do banco de dados
  useEffect(() => {
    if (!user.uid) return;

    const loadMototaxiProfile = async () => {
      try {
        // 1. Carrega dados cadastrais do prestador_mototaxi
        const { data: motoPerfil } = await supabase
          .from("prestador_mototaxi")
          .select("modalidade, is_online")
          .eq("user_id", user.uid)
          .maybeSingle();

        if (motoPerfil) {
          if (motoPerfil.modalidade) {
            setModalidade(motoPerfil.modalidade as Modalidade);
          }
        }

        // 2. Carrega estado da sessão operacional
        const { data: sessionData } = await supabase
          .from("mototaxi_sessoes")
          .select("is_online, lat, lng")
          .eq("prestador_id", user.uid)
          .maybeSingle();

        if (sessionData) {
          setIsOnline(!!sessionData.is_online);
          if (sessionData.lat && sessionData.lng) {
            setMyLocation({ lat: Number(sessionData.lat), lng: Number(sessionData.lng) });
          }
        }

        // 3. Carrega fila de chamados pendentes
        const { count: filaTotal } = await supabase
          .from("mototaxi_corridas")
          .select("id", { count: "exact", head: true })
          .in("status", ["searching", "pending", "buscando", "solicitado"])
          .is("prestador_id", null);

        setFilaCount(filaTotal || 0);

        // 4. Carrega métricas do dia
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: corridasConcluidas } = await supabase
          .from("mototaxi_corridas")
          .select("estimated_price, final_price, total_amount")
          .eq("prestador_id", user.uid)
          .eq("status", "finished")
          .gte("created_at", startOfDay.toISOString());

        if (corridasConcluidas && corridasConcluidas.length > 0) {
          setCorridasHoje(corridasConcluidas.length);
          const total = corridasConcluidas.reduce((acc, c) => {
            const val = Number(c.final_price || c.total_amount || c.estimated_price || 0) * 0.82;
            return acc + val;
          }, 0);
          setGanhosHoje(total);
        }
      } catch (err) {
        console.error("Erro ao carregar perfil do mototáxi:", err);
      }
    };

    loadMototaxiProfile();
  }, [user.uid]);

  // GPS watch
  useEffect(() => {
    if (!user.uid || !isOnline) return;
    if (!navigator.geolocation) return;

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    } catch {}

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user.uid, isOnline]);

  // Sincroniza sessão online no Supabase quando isOnline ou myLocation mudam
  const syncSessionOnline = async (onlineState: boolean) => {
    if (!user.uid) return;
    const coords = myLocation || UBATUBA;

    try {
      const { data: existingSession } = await supabase
        .from("mototaxi_sessoes")
        .select("id")
        .eq("prestador_id", user.uid)
        .maybeSingle();

      if (existingSession) {
        await supabase
          .from("mototaxi_sessoes")
          .update({
            is_online: onlineState,
            lat: coords.lat,
            lng: coords.lng,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingSession.id);
      } else {
        await supabase
          .from("mototaxi_sessoes")
          .insert({
            prestador_id: user.uid,
            is_online: onlineState,
            lat: coords.lat,
            lng: coords.lng,
            updated_at: new Date().toISOString()
          });
      }

      // Também sincroniza na tabela prestador_mototaxi
      await supabase
        .from("prestador_mototaxi")
        .update({ is_online: onlineState, updated_at: new Date().toISOString() })
        .eq("user_id", user.uid);
    } catch (err) {
      console.error("Erro ao sincronizar sessão operacional:", err);
    }
  };

  // Alternar Online / Offline
  const toggleOnline = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    await syncSessionOnline(nextStatus);

    if (nextStatus) {
      toast.success("Você está ONLINE no radar de Ubatuba!");
    } else {
      toast.info("Você está OFFLINE.");
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    }
  };

  // Alterar Modalidade de Trabalho
  const handleSelectModalidade = async (mod: Modalidade) => {
    setModalidade(mod);
    if (!user.uid) return;

    try {
      await supabase
        .from("prestador_mototaxi")
        .update({ modalidade: mod, updated_at: new Date().toISOString() })
        .eq("user_id", user.uid);

      await supabase.auth.updateUser({
        data: { modalidade_moto: mod }
      });

      toast.success(`Modalidade atualizada: ${
        mod === "carona_entrega" ? "Carona & Entrega" : mod === "so_entrega" ? "Só Entrega" : "Só Carona"
      }`);
    } catch (err) {
      console.error("Erro ao atualizar modalidade:", err);
    }
  };

  // Atualizar GPS
  const handleRefreshGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada no seu dispositivo.");
      return;
    }
    setUpdatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUpdatingGps(false);
        toast.success("Localização GPS atualizada com sucesso!");
        if (isOnline) {
          syncSessionOnline(true);
        }
      },
      (err) => {
        setUpdatingGps(false);
        console.warn("Aviso GPS:", err);
        toast.info("Posição mantida em Ubatuba, SP.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Listener Realtime de Chamados
  const handleNewCorrida = useCallback((payload: any) => {
    const c = payload.new;
    const isPending = c && ["searching", "pending", "buscando", "solicitado"].includes(c.status);
    const isTargetPrestador = c && (!c.prestador_id || c.prestador_id === user.uid);
    const isRecent = c?.created_at
      ? Date.now() - new Date(c.created_at).getTime() <= 60000
      : true;

    // Filtra pela modalidade escolhida
    const matchesModalidade =
      modalidade === "carona_entrega" ||
      (modalidade === "so_carona" && c?.type === "carona") ||
      (modalidade === "so_entrega" && c?.type === "entrega");

    if (c && isPending && isTargetPrestador && isRecent && matchesModalidade) {
      try {
        const parsed = parseChamadoData(c);
        if (parsed) {
          setChamado(parsed);
          playChamadoSound();
        }
      } catch (err) {
        console.error("Erro ao parsear chamada:", err);
      }
    } else if (c && !isPending) {
      setChamado((prev) => (prev && prev.id === c.id ? null : prev));
    }
  }, [user.uid, modalidade]);

  useRealtimeChannel(
    `public:mototaxi_corridas_prestador_${user.uid || "online"}`,
    { event: "*", table: "mototaxi_corridas" },
    handleNewCorrida
  );

  // Broadcast Contingência
  useEffect(() => {
    const broadcastChan = supabase
      .channel("mototaxi_chamados_broadcast")
      .on("broadcast", { event: "new_chamado" }, ({ payload }) => {
        if (payload && payload.id && isOnline) {
          const matchesModalidade =
            modalidade === "carona_entrega" ||
            (modalidade === "so_carona" && payload.type === "carona") ||
            (modalidade === "so_entrega" && payload.type === "entrega");

          if (matchesModalidade) {
            const originObj = typeof payload.origin === "string" ? JSON.parse(payload.origin) : payload.origin;
            const destObj = typeof payload.destination === "string" ? JSON.parse(payload.destination) : payload.destination;
            setChamado({
              id: payload.id,
              type: payload.type || "carona",
              origin: originObj?.address || (typeof originObj === "string" ? originObj : "Origem"),
              destination: destObj?.address || (typeof destObj === "string" ? destObj : "Destino"),
              distanceKm: Number(payload.distance_km || 0),
              durationMin: Number(payload.duration_min || 0),
              price: Number(payload.estimated_price || 0)
            });
            playChamadoSound();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChan);
    };
  }, [isOnline, modalidade]);

  // Aceitar Corrida
  const acceptCorrida = async () => {
    if (!chamado) return;
    let currentUid = user.uid;
    if (!currentUid) {
      const { data: authData } = await supabase.auth.getUser();
      currentUid = authData?.user?.id || "";
    }

    try {
      const { data, error } = await supabase
        .from("mototaxi_corridas")
        .update({
          status: "accepted",
          prestador_id: currentUid,
          accepted_at: new Date().toISOString()
        })
        .eq("id", chamado.id)
        .select()
        .single();

      if (error || !data) {
        toast.error("Outro motorista pode ter aceitado o chamado primeiro.");
        setChamado(null);
        return;
      }

      sessionStorage.setItem("ubt_active_ride", JSON.stringify({ ...chamado, prestador_id: currentUid }));
      setChamado(null);
      navigate("/app/prestador/mototaxi/active");
    } catch (e) {
      console.error("Exceção ao aceitar corrida:", e);
      toast.error("Erro ao aceitar corrida! Tente novamente.");
      setChamado(null);
    }
  };

  // Se o cadastro estiver pendente
  if (user.kycStatus === "pending" || user.status === "pending") {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex flex-col justify-between p-6">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/app/prestador/home")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-white cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-extrabold text-sm text-[#00FF66]">UBT.</span>
          <div className="w-10" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center my-8 max-w-sm mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5">
            <Clock size={38} className="text-amber-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Documentação em Análise</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Seus documentos de Mototáxi (CNH, CRLV e Selfie) estão sob validação da equipe UBT. Você receberá uma notificação assim que for aprovado.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/prestador/mototaxi/config")}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-700 transition cursor-pointer"
          >
            Ver Meus Documentos
          </button>
        </main>

        <footer className="text-center text-xs text-zinc-600">
          UBT Mototáxi &bull; Fila Operacional
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-24">
      {/* ========================================================================= */}
      {/* HEADER SUPERIOR DO HUB OPERACIONAL                                       */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app/prestador/home")}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer transition active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">
                Hub Mototáxi
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider">
                Operacional
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app/prestador/mototaxi/config")}
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition"
          aria-label="Configurações e Documentos"
          title="Meus Documentos e Regras"
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* ========================================================================= */}
        {/* BLOCO SUPERIOR: COMO VOCÊ QUER TRABALHAR? (MODALIDADE)                   */}
        {/* ========================================================================= */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="mb-3">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#00FF66]" />
              Como você quer trabalhar?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Defina os chamados que o radar pode enviar para você agora
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Card 1: Carona & Entrega */}
            <button
              type="button"
              onClick={() => handleSelectModalidade("carona_entrega")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                modalidade === "carona_entrega"
                  ? "bg-zinc-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.12)]"
                  : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[#00FF66]">
                  <Bike size={18} />
                  <Package size={14} />
                </div>
                {modalidade === "carona_entrega" && (
                  <span className="w-4 h-4 rounded-full bg-[#00FF66] text-black flex items-center justify-center text-[10px] font-black">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs font-black ${modalidade === "carona_entrega" ? "text-white" : "text-zinc-300"}`}>
                  Carona & Entrega
                </p>
                <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  Mais chamados
                </p>
              </div>
            </button>

            {/* Card 2: Só Entrega */}
            <button
              type="button"
              onClick={() => handleSelectModalidade("so_entrega")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                modalidade === "so_entrega"
                  ? "bg-zinc-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.12)]"
                  : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <Package size={18} className={modalidade === "so_entrega" ? "text-[#00FF66]" : "text-zinc-400"} />
                {modalidade === "so_entrega" && (
                  <span className="w-4 h-4 rounded-full bg-[#00FF66] text-black flex items-center justify-center text-[10px] font-black">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs font-black ${modalidade === "so_entrega" ? "text-white" : "text-zinc-300"}`}>
                  Só Entrega
                </p>
                <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  Delivery rápido
                </p>
              </div>
            </button>

            {/* Card 3: Só Carona */}
            <button
              type="button"
              onClick={() => handleSelectModalidade("so_carona")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                modalidade === "so_carona"
                  ? "bg-zinc-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.12)]"
                  : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <Bike size={18} className={modalidade === "so_carona" ? "text-[#00FF66]" : "text-zinc-400"} />
                {modalidade === "so_carona" && (
                  <span className="w-4 h-4 rounded-full bg-[#00FF66] text-black flex items-center justify-center text-[10px] font-black">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs font-black ${modalidade === "so_carona" ? "text-white" : "text-zinc-300"}`}>
                  Só Carona
                </p>
                <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  Passageiros
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BLOCO INFERIOR: CONTROLE REALTIME OPERACIONAL                             */}
        {/* ========================================================================= */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          {/* Sub-bloco 1: Toggle Online / Offline */}
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  isOnline
                    ? "bg-[#00FF66] shadow-[0_0_12px_#00FF66] animate-pulse"
                    : "bg-zinc-600"
                }`}
              />
              <div>
                <h3 className="text-base font-black text-white leading-tight">
                  {isOnline ? "Você está ONLINE" : "Você está OFFLINE"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isOnline ? "Pronto para receber chamados na sua moto" : "Conecte-se para ativar seu radar"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleOnline}
              className="rounded-full relative p-0.5 transition-colors cursor-pointer"
              style={{
                width: 56,
                height: 32,
                background: isOnline ? "#00FF66" : "#27272a",
                boxShadow: isOnline ? "0 0 15px rgba(0,255,102,0.3)" : "none"
              }}
              aria-label={isOnline ? "Ficar offline" : "Ficar online"}
            >
              <span
                className="block rounded-full bg-white transition-transform"
                style={{
                  width: 28,
                  height: 28,
                  transform: isOnline ? "translateX(24px)" : "translateX(0)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              />
            </button>
          </div>

          {/* Sub-bloco 2: Cidade Atual */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00FF66]/15 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Cidade Atual
                </p>
                <p className="text-sm font-bold text-white">
                  {cidade}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshGps}
              disabled={updatingGps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw size={13} className={updatingGps ? "animate-spin text-[#00FF66]" : ""} />
              {updatingGps ? "Buscando..." : "Atualizar"}
            </button>
          </div>

          {/* Sub-bloco 3: Fila de Pedidos */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <Radio size={16} className={isOnline ? "text-[#00FF66] animate-pulse" : ""} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Fila de Chamados
                </p>
                <p className="text-sm font-bold text-white">
                  Fila de Pedidos ({filaCount})
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-zinc-500">
              {filaCount === 0 ? "Aguardando chamados" : `${filaCount} na região`}
            </span>
          </div>

          {/* Sub-bloco 4: Mini Ganhos (Hoje) */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00FF66]/15 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Rendimento do Dia
                </p>
                <p className="text-sm font-black text-white">
                  Hoje: {formatBRL(ganhosHoje)}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-zinc-400">
              {corridasHoje} {corridasHoje === 1 ? "corrida" : "corridas"}
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MINI RADAR / MAPA DA REGIÃO                                              */}
        {/* ========================================================================= */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative shadow-lg">
          <div className="h-44 w-full relative">
            <PrestadorMapLight myLocation={myLocation} />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-black/80 backdrop-blur-md border border-zinc-800 text-zinc-300">
                Radar Ativo: Ubatuba (Raio 5 km)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Corrida Recebida em Tempo Real */}
      {chamado && (
        <ChamadoModal
          chamado={chamado}
          onAccept={acceptCorrida}
          onReject={() => setChamado(null)}
        />
      )}
    </div>
  );
}
