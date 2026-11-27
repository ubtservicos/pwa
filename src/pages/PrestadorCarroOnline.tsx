import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Car,
  Package,
  ArrowLeft,
  Settings,
  Clock,
  RefreshCw,
  Layers,
  TrendingUp,
  Radio,
} from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { parseChamadoData, playChamadoSound, type Chamado } from "@/components/prestador/MototaxiIncomingRideListener";

const UBATUBA = { lat: -23.4336, lng: -45.0838 };

type Modalidade = "carona_entrega" | "so_entrega" | "so_carona";

const ChamadoCarroModal = ({
  chamado,
  onAccept,
  onReject,
}: {
  chamado: Chamado;
  onAccept: () => void;
  onReject: () => void;
}) => {
  if (!chamado || !chamado.id || !chamado.origin || !chamado.destination) {
    return null;
  }

  const youReceive = chamado.price * 0.9;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-[#00FF66]/40 p-6 shadow-[0_0_40px_rgba(0,255,102,0.15)] animate-in slide-in-from-bottom-8 duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00FF66] animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-[#00FF66]">
              Novo Chamado de Carro!
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
              <span className="text-[10px] text-zinc-500 block">Você recebe (90%)</span>
              <span className="text-xl font-black text-[#00FF66]">{formatBRL(youReceive)}</span>
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

function buildVehicleSnapshot(profile: any) {
  if (!profile || typeof profile !== "object") return {};
  return {
    plate: profile.plate || null,
    brand_model: profile.brand_model || null,
    carro_photo_url: profile.carro_photo_url || null,
    carro_interno_photo_url: profile.carro_interno_photo_url || null,
    cor: profile.cor || null,
    ano: profile.ano ?? null,
    portas: profile.portas ?? null,
    ar_condicionado: typeof profile.ar_condicionado === "boolean" ? profile.ar_condicionado : null,
    cnh_categoria: profile.cnh_categoria || null,
    possui_ear: typeof profile.possui_ear === "boolean" ? profile.possui_ear : null,
    alvara_municipal: profile.alvara_municipal || null,
    vehicle_subtype: profile.vehicle_subtype || "padrao",
  };
}

export default function PrestadorCarroOnline() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [isOnline, setIsOnline] = useState(false);
  const [modalidade, setModalidade] = useState<Modalidade>("carona_entrega");
  const [cidade] = useState("Ubatuba, SP");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(UBATUBA);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [filaCount, setFilaCount] = useState(0);
  const [ganhosHoje, setGanhosHoje] = useState(0);
  const [corridasHoje, setCorridasHoje] = useState(0);
  const [updatingGps, setUpdatingGps] = useState(false);
  const [carProfile, setCarProfile] = useState<any | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const rejectedRideIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user.isLoading && user.uid && user.carroKycStatus === "none") {
      navigate("/app/prestador/carros/onboarding");
    }
  }, [user.isLoading, user.uid, user.carroKycStatus, navigate]);

  useEffect(() => {
    if (!user.uid) return;

    const loadCarroProfile = async () => {
      try {
        const { data: carroPerfil } = await supabase
          .from("prestador_carro")
          .select("*")
          .eq("user_id", user.uid)
          .maybeSingle();

        if (carroPerfil) {
          setCarProfile(carroPerfil);
          if (carroPerfil.modalidade) {
            setModalidade(carroPerfil.modalidade as Modalidade);
          }
        }

        const { data: sessionData } = await supabase
          .from("carro_sessoes")
          .select("is_online, lat, lng")
          .eq("prestador_id", user.uid)
          .maybeSingle();

        if (sessionData) {
          setIsOnline(!!sessionData.is_online);
          if (sessionData.lat && sessionData.lng) {
            setMyLocation({ lat: Number(sessionData.lat), lng: Number(sessionData.lng) });
          }
        }

        const { count: filaTotal } = await supabase
          .from("carro_corridas")
          .select("id", { count: "exact", head: true })
          .in("status", ["searching", "pending", "buscando", "solicitado"])
          .is("prestador_id", null);

        setFilaCount(filaTotal || 0);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: corridasConcluidas } = await supabase
          .from("carro_corridas")
          .select("estimated_price, final_price")
          .eq("prestador_id", user.uid)
          .in("status", ["completed", "paid"])
          .gte("created_at", startOfDay.toISOString());

        if (corridasConcluidas && corridasConcluidas.length > 0) {
          setCorridasHoje(corridasConcluidas.length);
          const total = corridasConcluidas.reduce(
            (acc, c) => acc + Number(c.final_price || c.estimated_price || 0) * 0.9,
            0,
          );
          setGanhosHoje(total);
        }
      } catch (err) {
        console.error("Erro ao carregar perfil de Carros:", err);
      }
    };

    void loadCarroProfile();
  }, [user.uid]);

  useEffect(() => {
    if (!user.uid || !isOnline) return;
    if (!navigator.geolocation) return;

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    } catch {}

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user.uid, isOnline]);

  const syncSessionOnline = async (onlineState: boolean): Promise<{ ok: boolean; error?: string }> => {
    if (!user.uid) return { ok: false, error: "Sessão expirada. Faça login novamente." };
    const coords = myLocation || UBATUBA;

    try {
      const { error: sessErr } = await supabase
        .from("carro_sessoes")
        .upsert(
          {
            prestador_id: user.uid,
            is_online: onlineState,
            lat: coords.lat,
            lng: coords.lng,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "prestador_id" },
        );

      if (sessErr) {
        return { ok: false, error: sessErr.message || "Falha ao gravar status online no servidor." };
      }

      await supabase
        .from("prestador_carro")
        .update({ is_online: onlineState, updated_at: new Date().toISOString() })
        .eq("user_id", user.uid);

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Erro de rede ao atualizar status online." };
    }
  };

  const toggleOnline = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    const res = await syncSessionOnline(nextStatus);

    if (!res.ok) {
      setIsOnline(!nextStatus);
      toast.error(res.error || "Não foi possível alterar seu status online.");
      return;
    }

    if (nextStatus) {
      toast.success("Você está ONLINE no radar de Carros de Ubatuba!");
    } else {
      toast.info("Você está OFFLINE.");
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    }
  };

  const handleSelectModalidade = async (mod: Modalidade) => {
    const prevMod = modalidade;
    setModalidade(mod);
    if (!user.uid) return;

    try {
      const { error } = await supabase
        .from("prestador_carro")
        .update({ modalidade: mod, updated_at: new Date().toISOString() })
        .eq("user_id", user.uid);

      if (error) {
        setModalidade(prevMod);
        toast.error(`Erro ao atualizar modalidade: ${error.message}`);
        return;
      }

      toast.success(
        `Modalidade atualizada: ${
          mod === "carona_entrega" ? "Carona & Entrega" : mod === "so_entrega" ? "Só Entrega" : "Só Carona"
        }`,
      );
    } catch (err: any) {
      setModalidade(prevMod);
      toast.error(err?.message || "Erro ao atualizar modalidade.");
    }
  };

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
          void syncSessionOnline(true);
        }
      },
      () => {
        setUpdatingGps(false);
        toast.info("Posição mantida em Ubatuba, SP.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleNewCorrida = useCallback(
    (payload: any) => {
      const c = payload.new;
      const isPending = c && ["searching", "pending", "buscando", "solicitado"].includes(c.status);
      const isTargetPrestador = c && (!c.prestador_id || c.prestador_id === user.uid);
      const isRecent = c?.created_at ? Date.now() - new Date(c.created_at).getTime() <= 60000 : true;
      const matchesModalidade =
        modalidade === "carona_entrega" ||
        (modalidade === "so_carona" && c?.type === "carona") ||
        (modalidade === "so_entrega" && c?.type === "entrega");

      if (c && isPending && isTargetPrestador && isRecent && matchesModalidade && !rejectedRideIdsRef.current.has(c.id)) {
        const parsed = parseChamadoData(c);
        if (parsed) {
          setChamado(parsed);
          playChamadoSound();
        }
      } else if (c && !isPending) {
        setChamado((prev) => (prev && prev.id === c.id ? null : prev));
      }
    },
    [user.uid, modalidade],
  );

  useRealtimeChannel(
    `public:carro_corridas_prestador_${user.uid || "online"}`,
    { event: "*", table: "carro_corridas" },
    handleNewCorrida,
  );

  useEffect(() => {
    const broadcastChan = supabase
      .channel("carro_chamados_broadcast")
      .on("broadcast", { event: "new_chamado" }, ({ payload }) => {
        if (payload && payload.id && isOnline && !rejectedRideIdsRef.current.has(payload.id)) {
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
              price: Number(payload.estimated_price || 0),
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

  // Polling de segurança (4s)
  useEffect(() => {
    if (!user.uid || !isOnline) return;
    let cancelled = false;

    const pollPendingRides = async () => {
      if (cancelled || (typeof document !== "undefined" && document.hidden)) return;
      try {
        const { data: pendingRides, error } = await supabase
          .from("carro_corridas")
          .select("*")
          .in("status", ["searching", "pending", "buscando", "solicitado"])
          .is("prestador_id", null)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error || cancelled) return;
        const list = pendingRides || [];
        setFilaCount(list.length);

        if (chamado || list.length === 0) return;

        const matching = list.find((c: any) => {
          if (!c?.id || rejectedRideIdsRef.current.has(c.id)) return false;
          const isRecent = c.created_at
            ? Date.now() - new Date(c.created_at).getTime() <= 10 * 60 * 1000
            : true;
          if (!isRecent) return false;
          return (
            modalidade === "carona_entrega" ||
            (modalidade === "so_carona" && c.type === "carona") ||
            (modalidade === "so_entrega" && c.type === "entrega")
          );
        });

        if (matching) {
          const parsed = parseChamadoData(matching);
          if (parsed) {
            setChamado(parsed);
            playChamadoSound();
          }
        }
      } catch (err) {
        console.warn("Aviso no polling de chamados de carro:", err);
      }
    };

    void pollPendingRides();
    const timer = window.setInterval(pollPendingRides, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user.uid, isOnline, modalidade, chamado]);

  // Aceite atômico gravando vehicle_snapshot atual do motorista
  const acceptCorrida = async () => {
    if (!chamado) return;
    let currentUid = user.uid;
    if (!currentUid) {
      const { data: authData } = await supabase.auth.getUser();
      currentUid = authData?.user?.id || "";
    }

    try {
      let profileForSnapshot = carProfile;
      if (!profileForSnapshot && currentUid) {
        const { data: freshProfile } = await supabase
          .from("prestador_carro")
          .select("*")
          .eq("user_id", currentUid)
          .maybeSingle();
        profileForSnapshot = freshProfile;
      }

      const vehicleSnapshot = buildVehicleSnapshot(profileForSnapshot);

      const { data, error } = await supabase
        .from("carro_corridas")
        .update({
          status: "accepted",
          prestador_id: currentUid,
          accepted_at: new Date().toISOString(),
          vehicle_snapshot: vehicleSnapshot,
        })
        .eq("id", chamado.id)
        .in("status", ["searching", "pending", "buscando", "solicitado"])
        .is("prestador_id", null)
        .select()
        .maybeSingle();

      if (error) {
        toast.error(`Erro ao aceitar corrida: ${error.message}`);
        return;
      }

      if (!data || !data.id || data.prestador_id !== currentUid) {
        toast.error("Outro motorista já aceitou ou o pedido foi cancelado.");
        setChamado(null);
        return;
      }

      sessionStorage.setItem(
        "ubt_active_carro_ride",
        JSON.stringify({ ...chamado, id: data.id, prestador_id: currentUid, status: data.status }),
      );
      setChamado(null);
      navigate(`/app/prestador/carros/corrida/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aceitar corrida! Tente novamente.");
      setChamado(null);
    }
  };

  if (user.carroKycStatus === "pending") {
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
          <span className="font-extrabold text-sm text-[#00FF66]">UBT · Carros</span>
          <div className="w-10" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center my-8 max-w-sm mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5">
            <Clock size={38} className="text-amber-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Documentação de Carros em Análise</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Seus documentos de Motorista de Carro (CNH, CRLV e Selfie) estão em validação pela equipe UBT. Você será notificado assim que for aprovado.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/prestador/carros/config")}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-700 transition cursor-pointer"
          >
            Ver Meus Documentos
          </button>
        </main>

        <footer className="text-center text-xs text-zinc-600">UBT Carros &bull; Fila Operacional</footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-24">
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
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-white">Hub Carros</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider">
              Operacional
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app/prestador/carros/config")}
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition"
          aria-label="Configurações e Documentos"
          title="Meus Documentos e Regras"
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="mb-3">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#00FF66]" />
              Como você quer trabalhar?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Defina os chamados que o radar de Carros pode enviar para você agora
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {([
              { key: "carona_entrega" as const, title: "Carona & Entrega", sub: "Mais chamados", icons: [Car, Package] },
              { key: "so_entrega" as const, title: "Só Entrega", sub: "Delivery rápido", icons: [Package] },
              { key: "so_carona" as const, title: "Só Carona", sub: "Passageiros", icons: [Car] },
            ]).map((item) => {
              const selected = modalidade === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void handleSelectModalidade(item.key)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                    selected
                      ? "bg-zinc-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.12)]"
                      : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[#00FF66]">
                      {item.icons.map((Icon, idx) => (
                        <Icon key={idx} size={idx === 0 ? 18 : 14} className={selected ? "text-[#00FF66]" : "text-zinc-400"} />
                      ))}
                    </div>
                    {selected && (
                      <span className="w-4 h-4 rounded-full bg-[#00FF66] text-black flex items-center justify-center text-[10px] font-black">
                        ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-black ${selected ? "text-white" : "text-zinc-300"}`}>{item.title}</p>
                    <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{item.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  isOnline ? "bg-[#00FF66] shadow-[0_0_12px_#00FF66] animate-pulse" : "bg-zinc-600"
                }`}
              />
              <div>
                <h3 className="text-base font-black text-white leading-tight">
                  {isOnline ? "Você está ONLINE" : "Você está OFFLINE"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isOnline ? "Pronto para receber chamados no seu carro" : "Conecte-se para ativar seu radar"}
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
                boxShadow: isOnline ? "0 0 15px rgba(0,255,102,0.3)" : "none",
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

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00FF66]/15 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cidade Atual</p>
                <p className="text-sm font-bold text-white">{cidade}</p>
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

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <Radio size={16} className={isOnline ? "text-[#00FF66] animate-pulse" : ""} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fila de Chamados</p>
                <p className="text-sm font-bold text-white">Fila de Pedidos ({filaCount})</p>
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-500">
              {filaCount === 0 ? "Aguardando chamados" : `${filaCount} na região`}
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00FF66]/15 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rendimento do Dia</p>
                <p className="text-sm font-black text-white">Hoje: {formatBRL(ganhosHoje)}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-400">
              {corridasHoje} {corridasHoje === 1 ? "corrida" : "corridas"}
            </span>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative shadow-lg">
          <div className="h-44 w-full relative">
            <PrestadorMapLight myLocation={myLocation} providerType="carro" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-black/80 backdrop-blur-md border border-zinc-800 text-zinc-300">
                Radar Ativo Carros: Ubatuba (Raio 5 km)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
            </div>
          </div>
        </section>
      </main>

      {chamado && (
        <ChamadoCarroModal
          chamado={chamado}
          onAccept={acceptCorrida}
          onReject={() => {
            rejectedRideIdsRef.current.add(chamado.id);
            setChamado(null);
          }}
        />
      )}
    </div>
  );
}
