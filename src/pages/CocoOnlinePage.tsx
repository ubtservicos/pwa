import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { ArrowLeft, Settings, X, Calendar, Check, Compass, CheckCircle, MapPin } from "lucide-react";
import { MOCK_COCO_CONFIG, type PontoColeta } from "@/mocks/cocoMock";
import { getMaterial } from "@/mocks/cocoMateriais";
import { getPinIcon, getTruckIcon, getTruckIconUrl } from "@/utils/cocoIcons";
import { formatDist, haversineKm } from "@/utils/geo";
import { useSimpleToast } from "@/hooks/useToast2";
import { MapRef, DARK_TILES, ATTRIBUTION } from "@/components/UBTMap";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeolocation } from "@/hooks/useGeolocation";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";


const MapFallback = () => (
  <div className="absolute inset-0" style={{ background: "#E8ECF2" }}>
    <div
      className="absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "linear-gradient(rgba(180,190,210,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(180,190,210,0.6) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
    <div
      className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
      style={{
        width: 56,
        height: 56,
        background: "#0DB87E",
        border: "3px solid white",
        boxShadow: "0 4px 12px rgba(13,184,126,0.40)",
        fontSize: 24,
      }}
    >
      🚚
    </div>
  </div>
);

const formatarPlacaExibicao = (val: string) => {
  if (!val) return "";
  const limpo = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (limpo.length <= 3) return limpo;
  return `${limpo.slice(0, 3)}-${limpo.slice(3, 7)}`;
};

const CocoOnlinePage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { toast: toastState, showToast } = useSimpleToast();

  const [activeCaminhaoId, setActiveCaminhaoId] = useState<string>(() => {
    try {
      return localStorage.getItem("caminhaoId") || "";
    } catch {
      return "";
    }
  });

  const caminhaoId = activeCaminhaoId;

  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [loadingCaminhao, setLoadingCaminhao] = useState(true);
  const [myTrucks, setMyTrucks] = useState<any[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [pontos, setPontos] = useState<PontoColeta[]>([]);
  const [myLocation, setMyLocation] = useState({ lat: -23.432, lng: -45.083 });
  const [collectionsToday, setCollectionsToday] = useState(0);
  const [selectedPonto, setSelectedPonto] = useState<any | null>(null);
  const [showConfigAreas, setShowConfigAreas] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [showAgendarModal, setShowAgendarModal] = useState<string | null>(null);
  const [horarioSel, setHorarioSel] = useState("Em 30 minutos");
  const [tempPixKey, setTempPixKey] = useState("");
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [selectedTruckForBairros, setSelectedTruckForBairros] = useState<any | null>(null);
  const [tempAreas, setTempAreas] = useState<string[]>([]);

  const watchIdRef = useRef<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const { coords: geoCoords } = useGeolocation(isOnline);

  const NEIGHBORHOODS = ["Centro", "Itaguá", "Perequê-Açu", "Praia Grande", "Tenório", "Toninhas"];

  const fetchEquipe = async () => {
    if (user.role !== "cocoecia-dirigentes") return;
    setLoadingEquipe(true);
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, role")
        .in("role", ["cocoecia", "cocoecia-colaborador", "cocoecia-dirigentes"])
        .order("nome", { ascending: true });

      if (error) throw error;
      if (data) setEquipe(data);
    } catch (err) {
      console.error("Erro ao buscar equipe da ONG:", err);
    } finally {
      setLoadingEquipe(false);
    }
  };

  const alterarRoleMembro = async (membroId: string, novaRole: string) => {
    try {
      const { error: errU } = await supabase
        .from("usuarios")
        .update({ role: novaRole })
        .eq("id", membroId);
      
      if (errU) throw errU;

      const { error: errP } = await supabase
        .from("profiles")
        .update({ role: novaRole })
        .eq("id", membroId);

      if (errP) console.warn("Erro ao atualizar profiles do membro:", errP);

      showToast("Função alterada com sucesso!");
      fetchEquipe();
    } catch (err: any) {
      alert("Erro ao alterar função: " + err.message);
    }
  };

  const fetchCaminhao = async () => {
    if (!activeCaminhaoId) {
      setCaminhao(null);
      setLoadingCaminhao(false);
      return;
    }
    setLoadingCaminhao(true);
    try {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .eq("id", activeCaminhaoId)
        .single();
      if (data) {
        setCaminhao(data);
        setIsOnline(data.is_online);
        setCollectionsToday(data.collections_today || 0);
        setSelectedAreas(data.areas_atendidas || ["Centro"]);
        setTempPixKey(data.pix_key || "");
        if (data.lat && data.lng) {
          setMyLocation({ lat: Number(data.lat), lng: Number(data.lng) });
        }
      } else {
        setCaminhao(null);
      }
    } catch (err) {
      console.error("Erro ao buscar caminhão:", err);
      setCaminhao(null);
    } finally {
      setLoadingCaminhao(false);
    }
  };

  const fetchMyTrucks = async () => {
    if (!user.uid) return;
    try {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .eq("prestador_id", user.uid)
        .order("created_at", { ascending: false });

      if (data) {
        setMyTrucks(data);
      }
    } catch (err) {
      console.error("Erro ao buscar meus caminhões:", err);
    } finally {
      setLoadingTrucks(false);
    }
  };

  const fetchPontos = async () => {
    try {
      const { data, error } = await supabase
        .from("coco_pontos")
        .select("*")
        .or(`status.eq.aguardando,and(status.eq.confirmado,caminhao_id.eq.${caminhaoId})`)
        .order("created_at", { ascending: false });

      if (data) {
        const mapped = data.map((p) => ({
          id: p.id,
          lat: Number(p.lat),
          lng: Number(p.lng),
          address: p.address,
          material: p.material,
          status: p.status as any,
          createdAt: new Date(p.created_at).getTime(),
          coletadoAt: p.coletado_at ? new Date(p.coletado_at).getTime() : null,
          fotoUrl: p.foto_url,
          horarioPrevisto: p.horario_previsto,
          caminhaoId: p.caminhao_id
        }));
        setPontos(mapped);
      }
    } catch (err) {
      console.error("Erro ao buscar pontos:", err);
    }
  };

  useEffect(() => {
    fetchCaminhao();
    
    if (!activeCaminhaoId) return;
    
    fetchPontos();

    const channelCaminhao = supabase
      .channel("realtime-caminhao-online")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "coco_caminhoes", filter: `id=eq.${activeCaminhaoId}` },
        (payload) => {
          const u = payload.new as any;
          setCollectionsToday(u.collections_today || 0);
        }
      )
      .subscribe();

    const channelPontos = supabase
      .channel("realtime-pontos-online")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_pontos" },
        () => {
          fetchPontos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelCaminhao);
      supabase.removeChannel(channelPontos);
    };
  }, [activeCaminhaoId]);

  useEffect(() => {
    if (isOnline && geoCoords && caminhaoId) {
      setMyLocation({ lat: geoCoords.lat, lng: geoCoords.lng });
      supabase
        .from("coco_caminhoes")
        .update({ lat: geoCoords.lat, lng: geoCoords.lng })
        .eq("id", caminhaoId)
        .then(({ error }) => {
          if (error) console.error("Error updating location:", error.message);
        });
    }
  }, [isOnline, geoCoords, caminhaoId]);

  useEffect(() => {
    if (!user.uid) return;
    fetchMyTrucks();

    const channelMyTrucks = supabase
      .channel(`public:coco_caminhoes:prestador:${user.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_caminhoes", filter: `prestador_id=eq.${user.uid}` },
        () => {
          fetchMyTrucks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelMyTrucks);
    };
  }, [user.uid]);

  const goOnline = async () => {
    setIsOnline(true);
    try {
      await supabase
        .from("coco_caminhoes")
        .update({ is_online: true })
        .eq("id", caminhaoId);
      showToast("🟢 Caminhão está online!");
    } catch (err: any) {
      showToast("Erro ao ficar online");
    }
  };

  const goOffline = async () => {
    setIsOnline(false);
    try {
      await supabase
        .from("coco_caminhoes")
        .update({ is_online: false })
        .eq("id", caminhaoId);
      showToast("⚪ Caminhão está offline!");
    } catch (err) {
      console.error(err);
    }
  };

  const agendarColeta = async (pontoId: string) => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase
        .from("coco_pontos")
        .update({
          status: "confirmado",
          caminhao_id: caminhaoId,
          horario_previsto: horarioSel
        })
        .eq("id", pontoId)
        .eq("status", "aguardando")
        .is("caminhao_id", null)
        .select("id")
        .single();

      const duration = Date.now() - startTime;

      if (error || !data) {
        alert("Este ponto já foi agendado por outro caminhão.");
        setShowAgendarModal(null);
        setSelectedPonto(null);
        fetchPontos();
        return;
      }
      trackEvent("pickup_requested", "operational", { vertical: "coco", ponto_id: pontoId, caminhao_id: caminhaoId });
      logSystem("INFO", "COCO", "pickup_requested", "success", duration, undefined, undefined, { ponto_id: pontoId, caminhao_id: caminhaoId });
      showToast("🚚 Rota de coleta confirmada!");
      setShowAgendarModal(null);
      setSelectedPonto(null);
      fetchPontos();
    } catch (err: any) {
      logSystem("ERROR", "COCO", "pickup_requested", "failed", undefined, err.message, err.code, { ponto_id: pontoId });
      alert("Erro ao agendar: " + err.message);
    }
  };

  const cancelarAgendamento = async (pontoId: string) => {
    try {
      const { error } = await supabase
        .from("coco_pontos")
        .update({
          status: "aguardando",
          caminhao_id: null,
          horario_previsto: null
        })
        .eq("id", pontoId);

      if (error) throw error;
      showToast("Coleta cancelada");
      setSelectedPonto(null);
      fetchPontos();
    } catch (err: any) {
      alert("Erro ao cancelar: " + err.message);
    }
  };

  const marcarColetado = async (pontoId: string) => {
    const startTime = Date.now();
    try {
      const { error: errorP } = await supabase
        .from("coco_pontos")
        .update({
          status: "coletado",
          coletado_at: new Date().toISOString()
        })
        .eq("id", pontoId);

      if (errorP) throw errorP;

      const newToday = collectionsToday + 1;
      const newTotal = (caminhao?.total_collections || 0) + 1;

      await supabase
        .from("coco_caminhoes")
        .update({
          collections_today: newToday,
          total_collections: newTotal
        })
        .eq("id", caminhaoId);

      setCollectionsToday(newToday);
      if (caminhao) {
        setCaminhao((prev: any) => ({
          ...prev,
          collections_today: newToday,
          total_collections: newTotal
        }));
      }

      const duration = Date.now() - startTime;
      trackEvent("pickup_completed", "operational", { vertical: "coco", ponto_id: pontoId, collections_today: newToday });
      logSystem("INFO", "COCO", "pickup_completed", "success", duration, undefined, undefined, { ponto_id: pontoId, collections_today: newToday });

      showToast("♻️ Coleta registrada!");
      setSelectedPonto(null);
      fetchPontos();
    } catch (err: any) {
      logSystem("ERROR", "COCO", "pickup_completed", "failed", undefined, err.message, err.code, { ponto_id: pontoId });
      alert("Erro ao salvar coleta: " + err.message);
    }
  };

  const salvarConfiguracoes = async () => {
    try {
      const updateData: any = { areas_atendidas: selectedAreas };
      if (user.role === "cocoecia-dirigentes") {
        updateData.pix_key = tempPixKey.trim();
      }

      const { error } = await supabase
        .from("coco_caminhoes")
        .update(updateData)
        .eq("id", caminhaoId);

      if (error) throw error;
      setCaminhao((prev: any) => ({ ...prev, ...updateData }));
      showToast("🗺️ Configurações da ONG salvas!");
      setShowConfigAreas(false);
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message);
    }
  };

  const sortedPontos = [...pontos].sort(
    (a, b) =>
      haversineKm(myLocation.lat, myLocation.lng, a.lat, a.lng) -
      haversineKm(myLocation.lat, myLocation.lng, b.lat, b.lng)
  );

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleTrocarVeiculo = async () => {
    if (isOnline) {
      await goOffline();
    }
    localStorage.removeItem("caminhaoId");
    setActiveCaminhaoId("");
  };

  if (loadingCaminhao) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", justifyContent: "center", alignItems: "center", background: "#F7F8FA" }}>
        <p style={{ fontFamily: "DM Sans", color: "#5B6178" }}>Carregando dados do veículo...</p>
      </div>
    );
  }

  const handleSelectTruck = (truck: any) => {
    setSelectedTruckForBairros(truck);
    setTempAreas(truck.areas_atendidas || ["Centro"]);
  };

  if (!loadingCaminhao && !caminhao) {
    const pendingTrucks = myTrucks.filter((t) => t.status_aprovacao === "pending");
    const approvedTrucks = myTrucks.filter((t) => t.status_aprovacao === "approved");

    if (selectedTruckForBairros) {
      return (
        <div
          className="min-h-[100svh] overflow-y-auto"
          style={{
            background: "#F7F8FA",
            padding: "24px",
            paddingBottom: "96px",
            display: "flex",
            flexDirection: "column",
            fontFamily: "DM Sans",
          }}
        >
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <button
              onClick={() => setSelectedTruckForBairros(null)}
              aria-label="voltar"
              className="flex items-center justify-center rounded-full"
              style={{
                width: 40,
                height: 40,
                background: "white",
                border: "1px solid #D8DBE5",
                boxShadow: "0 2px 8px rgba(11,27,62,0.06)",
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={20} color="#0B1B3E" />
            </button>
            <h1
              className="font-display text-[18px] font-bold text-center flex-1 pr-10"
              style={{ color: "#0B1B3E" }}
            >
              Regiões de Atendimento
            </h1>
          </header>

          {/* Truck Card info */}
          <div
            className="bg-white rounded-[20px] p-5 mb-6 border border-[#EFF0F3]"
            style={{ boxShadow: "0 4px 16px rgba(11,27,62,0.04)" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "#E6FAF4" }}
              >
                <span style={{ fontSize: 24 }}>🚚</span>
              </div>
              <div>
                <h2 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>
                  {selectedTruckForBairros.apelido}
                </h2>
                <p className="text-[13px]" style={{ color: "#5B6178", marginTop: 2 }}>
                  Placa: <span className="font-semibold text-[#0B1B3E]">{selectedTruckForBairros.plate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Title / Description */}
          <div className="mb-6">
            <h3 className="font-display text-[15px] font-bold" style={{ color: "#0B1B3E" }}>
              Bairros a atender hoje
            </h3>
            <p className="text-[13px] mt-1" style={{ color: "#5B6178" }}>
              Selecione as regiões de Ubatuba que você irá percorrer para a coleta de hoje. Suas últimas seleções já estão pré-marcadas.
            </p>
          </div>

          {/* Neighborhood list checklist */}
          <div className="flex-grow flex flex-col gap-3 mb-8">
            {NEIGHBORHOODS.map((n) => {
              const isChecked = tempAreas.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setTempAreas((prev) =>
                      prev.includes(n) ? prev.filter((item) => item !== n) : [...prev, n]
                    );
                  }}
                  className="flex items-center justify-between w-full bg-white rounded-[16px] p-4 text-left border transition-all hover:border-[#0DB87E] active:scale-[0.98]"
                  style={{
                    borderColor: isChecked ? "#0DB87E" : "#EFF0F3",
                    boxShadow: "0 2px 8px rgba(11,27,62,0.03)",
                    background: isChecked ? "rgba(13,184,126,0.03)" : "white",
                  }}
                >
                  <span
                    className="font-display text-[15px] font-semibold transition-colors"
                    style={{ color: isChecked ? "#0DB87E" : "#0B1B3E" }}
                  >
                    {n}
                  </span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{
                      border: isChecked ? "2px solid #0DB87E" : "2px solid #D8DBE5",
                      background: isChecked ? "#0DB87E" : "transparent",
                    }}
                  >
                    {isChecked && <Check size={14} color="white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                if (tempAreas.length === 0) {
                  alert("Selecione pelo menos um bairro para atendimento.");
                  return;
                }
                try {
                  const { error } = await supabase
                    .from("coco_caminhoes")
                    .update({ areas_atendidas: tempAreas })
                    .eq("id", selectedTruckForBairros.id);

                  if (error) throw error;

                  localStorage.setItem("caminhaoId", selectedTruckForBairros.id);
                  localStorage.removeItem("ignorarAutoSelecaoCaminhao");
                  setActiveCaminhaoId(selectedTruckForBairros.id);
                  setSelectedTruckForBairros(null);
                  showToast("🚚 Rota iniciada com sucesso!");
                } catch (err: any) {
                  alert("Erro ao salvar os bairros de atendimento: " + err.message);
                }
              }}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 999,
                background: "#0DB87E",
                color: "white",
                border: "none",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(13,184,126,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Confirmar e Iniciar Rota
            </button>
            <button
              onClick={() => setSelectedTruckForBairros(null)}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 999,
                background: "transparent",
                border: "1px solid #D8DBE5",
                color: "#5B6178",
                fontFamily: "DM Sans",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="min-h-[100svh] overflow-y-auto"
        style={{
          background: "#F7F8FA",
          padding: "24px",
          paddingBottom: "96px",
          display: "flex",
          flexDirection: "column",
          fontFamily: "DM Sans",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/app/prestador/home")}
            aria-label="voltar"
            className="flex items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              background: "white",
              border: "1px solid #D8DBE5",
              boxShadow: "0 2px 8px rgba(11,27,62,0.06)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} color="#0B1B3E" />
          </button>
          <h1
            className="font-display text-[18px] font-bold text-center flex-1 pr-10"
            style={{ color: "#0B1B3E" }}
          >
            Central do Coletor
          </h1>
        </header>

        {/* Hero Section */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, #0DB87E 0%, #0AA06D 100%)",
              boxShadow: "0 8px 20px rgba(13,184,126,0.25)",
            }}
          >
            <span style={{ fontSize: 32 }}>🚚</span>
          </div>
          <h2
            className="font-display text-[22px] font-bold"
            style={{ color: "#0B1B3E" }}
          >
            Côco & Cia
          </h2>
          <p className="mt-2 text-[14px]" style={{ color: "#5B6178", padding: "0 10px" }}>
            Selecione o veículo aprovado para iniciar o trabalho ou cadastre um novo caminhão na ONG.
          </p>
        </div>

        {/* Loading state for trucks */}
        {loadingTrucks ? (
          <div className="flex-grow flex flex-col items-center justify-center py-10">
            <p style={{ color: "#9399AD", fontSize: 14 }}>Carregando seus veículos...</p>
          </div>
        ) : (
          <div className="flex-grow flex flex-col gap-6">
            {/* Pending Section */}
            {pendingTrucks.length > 0 && (
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "#9399AD" }}
                >
                  Autorizações Pendentes
                </p>
                <div className="flex flex-col gap-3">
                  {pendingTrucks.map((truck) => (
                    <div
                      key={truck.id}
                      className="bg-white rounded-[20px] p-4 border border-[#EFF0F3] shadow-sm relative overflow-hidden"
                      style={{ borderLeft: "4px solid #F5A623" }}
                    >
                      <div className="absolute top-0 right-0 bg-[#F5A623] text-white text-[9px] font-bold uppercase px-3 py-1 rounded-bl-xl">
                        Em análise
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px]"
                          style={{ background: "#FFF9E6" }}
                        >
                          🚚
                        </div>
                        <div>
                          <p className="font-display text-[15px] font-bold" style={{ color: "#0B1B3E" }}>
                            {truck.apelido}
                          </p>
                          <p className="text-[12px]" style={{ color: "#5B6178" }}>
                            Placa: {truck.plate} · Papel: {truck.role_solicitada === "cocoecia-dirigentes" ? "Dirigente" : "Colaborador"}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          background: "rgba(245,166,35,0.04)",
                          border: "1px solid rgba(245,166,35,0.1)",
                          borderRadius: 12,
                          padding: 10,
                          fontSize: 12,
                          color: "#D97706",
                          lineHeight: 1.4,
                        }}
                      >
                        Solicitação em análise pelo superadmin UBT. Assim que aprovada, o veículo estará disponível para operação.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "#9399AD" }}
                >
                  Veículos Aprovados
                </p>
                {user.role === "cocoecia-dirigentes" && (
                  <button
                    onClick={() => {
                      localStorage.setItem("ignorarAutoSelecaoCaminhao", "true");
                      navigate("/app/prestador/coco/onboarding");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0DB87E",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Novo Veículo
                  </button>
                )}
              </div>

              {approvedTrucks.length === 0 ? (
                <div
                  className="bg-white rounded-[20px] p-6 text-center border border-[#EFF0F3] shadow-sm flex flex-col items-center justify-center"
                  style={{ minHeight: 150 }}
                >
                  <p className="text-[13px]" style={{ color: "#5B6178", maxWidth: 240 }}>
                    {user.role === "cocoecia-dirigentes"
                      ? "Nenhum veículo aprovado encontrado. Cadastre um caminhão ou aguarde a aprovação."
                      : "Nenhum veículo aprovado encontrado. Entre em contato com um dirigente para cadastrar e aprovar um caminhão."}
                  </p>
                  {user.role === "cocoecia-dirigentes" && (
                    <button
                      onClick={() => {
                        localStorage.setItem("ignorarAutoSelecaoCaminhao", "true");
                        navigate("/app/prestador/coco/onboarding");
                      }}
                      style={{
                        marginTop: 16,
                        padding: "10px 20px",
                        background: "#0DB87E",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(13,184,126,0.15)",
                      }}
                    >
                      Cadastrar Veículo
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {approvedTrucks.map((truck) => (
                    <div
                      key={truck.id}
                      onClick={() => handleSelectTruck(truck)}
                      className="flex flex-col w-full bg-white rounded-[20px] p-5 border border-[#EFF0F3] cursor-pointer transition-all hover:border-[#0DB87E] hover:shadow-md active:scale-[0.99] group"
                      style={{
                        boxShadow: "0 4px 12px rgba(11,27,62,0.03)",
                      }}
                    >
                      {/* Top row: Icon, Apelido, and Toggle Selector */}
                      <div className="flex items-center justify-between w-full mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#E6FAF4] text-[20px]"
                          >
                            🚚
                          </div>
                          <div>
                            <h3 className="font-display text-[15px] font-bold text-[#0B1B3E]">
                              {truck.apelido}
                            </h3>
                            <span className="text-[11px] text-[#9399AD] font-semibold uppercase tracking-wider block mt-0.5">
                              Veículo Aprovado
                            </span>
                          </div>
                        </div>

                        {/* Custom Toggle Switch */}
                        <div
                          className="w-11 h-6 rounded-full transition-all relative flex items-center p-[2px]"
                          style={{
                            background: "#D8DBE5",
                            border: "none",
                          }}
                        >
                          <span
                            className="w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200"
                            style={{
                              transform: "translateX(0)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Middle row: License Plate */}
                      <div className="mb-4">
                        <span className="text-[11px] text-[#9399AD] font-semibold uppercase tracking-wider block mb-1.5">
                          Placa do Veículo
                        </span>
                        <div className="inline-flex flex-col items-center border-2 border-[#0B1B3E] rounded-[6px] overflow-hidden bg-white px-3 py-1 shadow-sm" style={{ minWidth: 120 }}>
                          <div className="w-full bg-[#0051A2] text-white text-[8px] font-bold text-center py-0.5 leading-none uppercase tracking-widest px-2">
                            BRASIL
                          </div>
                          <span className="font-mono text-[14px] font-extrabold text-[#0B1B3E] tracking-widest leading-none mt-1.5 mb-0.5 uppercase">
                            {formatarPlacaExibicao(truck.plate)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom section: Last serviced neighborhoods */}
                      <div className="pt-4 border-t border-[#EFF0F3] w-full">
                        <p className="text-[12px] font-semibold text-[#5B6178] mb-2 flex items-center gap-1">
                          <MapPin size={13} className="text-[#9399AD]" />
                          Últimos bairros atendidos:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {truck.areas_atendidas && truck.areas_atendidas.length > 0 ? (
                            truck.areas_atendidas.map((area: string) => (
                              <span
                                key={area}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E6FAF4] text-[#0DB87E] border border-emerald-100/50"
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#9399AD] italic">Nenhum bairro registrado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden text-zinc-100"
      style={{ height: "100svh", background: "var(--prestador-bg)" }}
    >
      {/* Botões do Topo */}
      <button
        onClick={() => navigate("/app/prestador/home")}
        aria-label="voltar"
        className="absolute z-[1010] flex items-center justify-center rounded-full"
        style={{
          top: 16,
          left: 16,
          width: 40,
          height: 40,
          background: "var(--prestador-card)",
          border: "1px solid var(--prestador-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.20)",
          cursor: "pointer"
        }}
      >
        <ArrowLeft size={20} color="#FFFFFF" />
      </button>



      <div style={{ height: "55svh", position: "relative" }}>
        <MapContainer
          center={[myLocation?.lat || -23.4332, myLocation?.lng || -45.0711]}
          zoom={15}
          style={{ width: "100%", height: "400px" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
          <MapRef mapRef={mapRef} />
          <Marker position={[myLocation?.lat || -23.4332, myLocation?.lng || -45.0711]} icon={getTruckIcon(isOnline, true)} />
          {pontos.map((p) => {
            if (!p.lat || !p.lng || isNaN(Number(p.lat)) || isNaN(Number(p.lng))) return null;
            const lat = Number(p.lat);
            const lng = Number(p.lng);
            return (
              <Marker
                key={p.id}
                position={[lat, lng]}
                icon={getPinIcon(p.material)}
                eventHandlers={{ click: () => setSelectedPonto(p) }}
              >
              {selectedPonto?.id === p.id && (
                <Popup eventHandlers={{ remove: () => setSelectedPonto(null) }}>
                  <div style={{ padding: 4, minWidth: 180, fontFamily: "DM Sans" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0B1B3E" }}>
                      {selectedPonto.address}
                    </p>
                    <p style={{ fontSize: 12, color: "#5B6178", marginTop: 4 }}>
                      {getMaterial(selectedPonto.material).emoji}{" "}
                      {getMaterial(selectedPonto.material).nome}
                    </p>
                    {selectedPonto.horarioPrevisto && (
                      <p style={{ fontSize: 11, color: "#0DB87E", fontWeight: 600, marginTop: 4 }}>
                        ⏰ Previsto: {selectedPonto.horarioPrevisto}
                      </p>
                    )}
                    {selectedPonto.status === "aguardando" ? (
                      <button
                        onClick={() => setShowAgendarModal(selectedPonto.id)}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "#0DB87E",
                          color: "white",
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        🚚 Agendar Coleta
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        <button
                          onClick={() => marcarColetado(selectedPonto.id)}
                          style={{
                            width: "100%",
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "#0DB87E",
                            color: "white",
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          ✅ Concluir Coleta
                        </button>
                        <button
                          onClick={() => cancelarAgendamento(selectedPonto.id)}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: "1px solid #E84040",
                            background: "transparent",
                            color: "#E84040",
                            fontFamily: "DM Sans",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[1010] text-zinc-100"
        style={{
          background: "var(--prestador-card)",
          borderRadius: "24px 24px 0 0",
          padding: "12px 20px 96px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.20)",
          maxHeight: "60svh",
          overflowY: "auto",
          border: "1px solid var(--prestador-border)"
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--prestador-border)",
            borderRadius: 999,
            margin: "0 auto 12px",
          }}
        />

        {/* Toggle Online/Offline */}
        <div
          style={{
            background: "var(--prestador-bg)",
            borderRadius: 16,
            border: "1px solid var(--prestador-border)",
            padding: 20,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <button
            onClick={() => (isOnline ? goOffline() : goOnline())}
            aria-label="toggle online"
            className="rounded-full transition-colors relative"
            style={{
              width: 60,
              height: 32,
              background: isOnline ? "#0DB87E" : "var(--prestador-border)",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span
              className="block rounded-full bg-white"
              style={{
                width: 28,
                height: 28,
                margin: 2,
                boxShadow: "0 2px 4px rgba(11,27,62,0.20)",
                transition: "transform 300ms",
                transform: isOnline ? "translateX(28px)" : "translateX(0)",
              }}
            />
          </button>
          <div style={{ flex: 1 }}>
            {isOnline ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#0DB87E",
                    animation: "ubt-pulse-dot 1.4s infinite",
                  }}
                />
                <p
                  style={{
                    fontFamily: "Syne",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0B1B3E",
                  }}
                >
                  Caminhão ONLINE
                </p>
              </div>
            ) : (
              <p
                style={{
                  fontFamily: "Syne",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#9399AD",
                }}
              >
                Caminhão OFFLINE
              </p>
            )}
          </div>
        </div>

        {/* Caminhao card */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              background: "#F7F8FA",
              borderRadius: "14px 14px 0 0",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img src={getTruckIconUrl(true)} width={40} height={30} alt="" />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#0B1B3E",
                }}
              >
                {caminhao.apelido}
              </p>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD" }}>
                {caminhao.plate} · {caminhao.areas_atendidas?.join(", ") || "Sem área"}
              </p>
            </div>
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#0DB87E",
                fontWeight: 600,
              }}
            >
              Hoje: {collectionsToday}
            </p>
          </div>
          <button
            onClick={handleTrocarVeiculo}
            style={{
              width: "100%",
              padding: "8px 16px",
              background: "#EFF0F3",
              color: "#5B6178",
              fontFamily: "DM Sans",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderRadius: "0 0 14px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderTop: "1px solid #E2E8F0",
              transition: "background 200ms",
            }}
          >
            🔄 Trocar de Veículo
          </button>
        </div>

        {/* Detalhes do Ponto Selecionado com FOTO */}
        {selectedPonto && (
          <div
            style={{
              marginTop: 14,
              background: "rgba(13,184,126,0.04)",
              border: "1px solid rgba(13,184,126,0.15)",
              borderRadius: 16,
              padding: 16,
              animation: "ubt-fadeIn 300ms ease"
            }}
          >
            <div style={{ display: "flex", justifyContent: "between", alignItems: "start", width: "100%", marginBottom: 10 }}>
              <div>
                <h4 style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0B1B3E" }}>
                  Detalhes do Ponto Selecionado
                </h4>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#5B6178", marginTop: 2 }}>
                  {selectedPonto.address}
                </p>
              </div>
              <button
                onClick={() => setSelectedPonto(null)}
                style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "auto", padding: 2 }}
              >
                <X size={18} color="#9399AD" />
              </button>
            </div>

            {/* FOTO DA EMBALAGEM */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#9399AD", textTransform: "uppercase" }}>
                Embalagem / Sacola
              </p>
              {selectedPonto.fotoUrl ? (
                selectedPonto.fotoUrl.startsWith("preset_") ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, background: "white", padding: 8, borderRadius: 8, border: "1px solid #EFF0F3" }}>
                    <span style={{ fontSize: 24 }}>
                      {selectedPonto.fotoUrl === "preset_saco_verde" ? "🟢" : selectedPonto.fotoUrl === "preset_caixa_papelao" ? "📦" : "🗑️"}
                    </span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0B1B3E", fontWeight: 600 }}>
                      {selectedPonto.fotoUrl === "preset_saco_verde" ? "Saco Verde" : selectedPonto.fotoUrl === "preset_caixa_papelao" ? "Caixa de Papelão" : "Caixote Plástico"}
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <img
                      src={selectedPonto.fotoUrl}
                      alt="Foto da embalagem"
                      style={{ width: "100%", maxHeight: 160, borderRadius: 12, objectFit: "cover", border: "1px solid #EFF0F3" }}
                    />
                  </div>
                )
              ) : (
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD", fontStyle: "italic", marginTop: 2 }}>
                  Nenhuma foto anexada pelo morador.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {selectedPonto.status === "aguardando" ? (
                <button
                  onClick={() => setShowAgendarModal(selectedPonto.id)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 999,
                    background: "#0DB87E",
                    color: "white",
                    border: "none",
                    fontFamily: "Syne",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(13,184,126,0.2)"
                  }}
                >
                  Confirmar e Agendar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => marcarColetado(selectedPonto.id)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 999,
                      background: "#0DB87E",
                      color: "white",
                      border: "none",
                      fontFamily: "Syne",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer"
                    }}
                  >
                    Concluir Coleta
                  </button>
                  <button
                    onClick={() => cancelarAgendamento(selectedPonto.id)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid #E84040",
                      color: "#E84040",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer"
                    }}
                  >
                    Desistir
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pontos próximos */}
        <p
          style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            color: "#9399AD",
            letterSpacing: 1,
            marginTop: 14,
            marginBottom: 4,
          }}
        >
          Pontos para coletar
        </p>

        {sortedPontos.length === 0 ? (
          <p
            style={{
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "#9399AD",
              textAlign: "center",
              padding: 16,
            }}
          >
            Nenhum ponto de coleta próximo. Continue sua rota! 🌱
          </p>
        ) : (
          sortedPontos.slice(0, 5).map((p) => {
            const m = getMaterial(p.material);
            const dist = haversineKm(myLocation.lat, myLocation.lng, p.lat, p.lng);
            const isPontoConfirmadoPorMim = p.status === "confirmado" && p.caminhaoId === caminhaoId;

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPonto(p);
                  mapRef.current?.flyTo([p.lat, p.lng], 17);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #E2E8F0",
                  cursor: "pointer",
                  background: isPontoConfirmadoPorMim ? "rgba(13,184,126,0.03)" : "transparent"
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: `${m.cor}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 550,
                      color: "#0B1B3E",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.address}
                  </p>
                  <p
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      color: "#9399AD",
                      marginTop: 2,
                    }}
                  >
                    {formatDist(dist)} · {m.nome}
                    {p.horarioPrevisto && ` · ⏰ Previsão: ${p.horarioPrevisto}`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {p.status === "aguardando" ? (
                    <button
                      onClick={() => setShowAgendarModal(p.id)}
                      style={{
                        borderRadius: 8,
                        padding: "6px 10px",
                        border: "none",
                        background: "#0DB87E",
                        cursor: "pointer",
                        flexShrink: 0,
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "white",
                      }}
                    >
                      Aceitar
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarColetado(p.id)}
                      style={{
                        borderRadius: 8,
                        padding: "6px 10px",
                        border: "1px solid #0DB87E",
                        background: "rgba(13,184,126,0.08)",
                        cursor: "pointer",
                        flexShrink: 0,
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#0DB87E",
                      }}
                    >
                      Coletar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mini stats */}
        <div
          style={{
            background: "#EFF0F3",
            borderRadius: 12,
            padding: 14,
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 11,
                color: "#9399AD",
                textTransform: "uppercase",
              }}
            >
              Hoje
            </p>
            <p
              style={{
                fontFamily: "Syne",
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1B3E",
              }}
            >
              {collectionsToday} coletas
            </p>
          </div>
          <div>
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 11,
                color: "#9399AD",
                textTransform: "uppercase",
              }}
            >
              Total acumulado
            </p>
            <p
              style={{
                fontFamily: "Syne",
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1B3E",
              }}
            >
              {caminhao?.total_collections || 0} coletas
            </p>
          </div>
        </div>

        {isOnline && (
          <button
            onClick={goOffline}
            style={{
              marginTop: 12,
              width: "100%",
              minHeight: 44,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid #D8DBE5",
              color: "#5B6178",
              fontFamily: "DM Sans",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Ir offline
          </button>
        )}
      </div>

      {/* Modal de Agendamento */}
      {showAgendarModal && (
        <>
          <div
            onClick={() => setShowAgendarModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(11,27,62,0.5)",
              zIndex: 1020,
            }}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              background: "white",
              borderRadius: "20px 20px 0 0",
              padding: 24,
              zIndex: 1021,
              animation: "ubt-fadeIn 200ms ease"
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "#D8DBE5",
                borderRadius: 999,
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E" }}>
              Previsão de Coleta
            </p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", marginTop: 4 }}>
              Selecione o horário estimado para realizar esta coleta. O morador será avisado.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {[
                "Em 15 minutos",
                "Em 30 minutos",
                "Em 1 hora",
                "Em 2 horas",
                "Período da Manhã (8h - 12h)",
                "Período da Tarde (14h - 18h)"
              ].map((h) => {
                const sel = horarioSel === h;
                return (
                  <button
                    key={h}
                    onClick={() => setHorarioSel(h)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      background: sel ? "rgba(13,184,126,0.08)" : "#F7F8FA",
                      border: "1px solid",
                      borderColor: sel ? "#0DB87E" : "transparent",
                      color: "#0B1B3E",
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      fontWeight: sel ? 600 : 400,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "between",
                      alignItems: "center"
                    }}
                  >
                    <span>{h}</span>
                    {sel && <Check size={16} color="#0DB87E" style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowAgendarModal(null)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  background: "transparent",
                  border: "1px solid #D8DBE5",
                  color: "#5B6178",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                Voltar
              </button>
              <button
                onClick={() => agendarColeta(showAgendarModal)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  background: "#0DB87E",
                  border: "none",
                  color: "white",
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(13,184,126,0.2)"
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </>
      )}



      {/* Toast */}
      {toastState.visible && (
        <div
          className="absolute z-[1030]"
          style={{
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0B1B3E",
            color: "white",
            padding: "10px 18px",
            borderRadius: 999,
            fontFamily: "DM Sans",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(11,27,62,0.30)",
          }}
        >
          {toastState.msg}
        </div>
      )}

      <style>{`
        @keyframes ubt-pulse-dot {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};

export default CocoOnlinePage;
