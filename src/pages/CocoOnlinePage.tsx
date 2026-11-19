import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { getMaterial } from "@/mocks/cocoMateriais";
import { CaminhaoMarker, ColetaMarker } from "@/lib/mapIcons";
import { formatDist, haversineKm } from "@/utils/geo";
import UBTMap, { isValidLatLng } from "@/components/UBTMap";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSimpleToast } from "@/hooks/useToast2";
import { useGeolocation } from "@/hooks/useGeolocation";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import Toast from "@/components/auth/Toast";

interface CaminhaoVinculado {
  id: string;
  plate: string;
  apelido: string;
  prestador_id?: string | null;
  colaboradores_ids?: string[] | null;
  areas_atendidas?: string[] | null;
  hora_saida?: string | null;
  expectativa_retorno?: string | null;
  status_aprovacao: string;
  is_online?: boolean;
  lat?: number | null;
  lng?: number | null;
  collections_today?: number | null;
  total_collections?: number | null;
}

interface PontoOperacional {
  id: string;
  tomador_id?: string | null;
  lat: number;
  lng: number;
  address: string;
  material: string;
  status: string;
  createdAt: number;
  coletadoAt: number | null;
  fotoUrl?: string | null;
  horarioPrevisto?: string | null;
  quantidadeEstimada?: string | null;
  localArmazenamento?: string | null;
  caminhaoId?: string | null;
}

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

  const [caminhao, setCaminhao] = useState<CaminhaoVinculado | null>(null);
  const [myTrucks, setMyTrucks] = useState<CaminhaoVinculado[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [pontos, setPontos] = useState<PontoOperacional[]>([]);
  const [myLocation, setMyLocation] = useState({ lat: -23.4332, lng: -45.0834 });
  const [collectionsToday, setCollectionsToday] = useState(0);
  const [selectedPonto, setSelectedPonto] = useState<PontoOperacional | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const { coords: geoCoords } = useGeolocation(isOnline);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Carregar vínculo de colaborador e caminhões vinculados (colaboradores_ids ou prestador_id)
  const fetchLinkedTrucks = async () => {
    if (!user.uid) return;
    try {
      const [{ data: colabData }, { data: allApprovedTrucks, error }] = await Promise.all([
        supabase
          .from("coco_colaboradores")
          .select("id, nome, perfil, is_ativo, status_aprovacao")
          .eq("user_id", user.uid)
          .eq("is_ativo", true)
          .eq("status_aprovacao", "aprovado")
          .maybeSingle(),
        supabase
          .from("coco_caminhoes")
          .select(
            "id, plate, apelido, prestador_id, colaboradores_ids, areas_atendidas, hora_saida, expectativa_retorno, status_aprovacao, is_online, lat, lng, collections_today, total_collections"
          )
          .eq("status_aprovacao", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (error) throw error;

      const colabId = colabData?.id || null;
      const isAdminOrGestao =
        user.role === "admin" ||
        user.role === "superadmin" ||
        user.role === "cocoecia-dirigentes" ||
        colabData?.perfil === "alta_gestao";

      const linked = (allApprovedTrucks || []).filter((tr: any) => {
        if (tr.prestador_id === user.uid) return true;
        if (colabId && Array.isArray(tr.colaboradores_ids) && tr.colaboradores_ids.includes(colabId)) {
          return true;
        }
        return isAdminOrGestao;
      }) as CaminhaoVinculado[];

      setMyTrucks(linked);

      // Resolver caminhão ativo
      let targetId = activeCaminhaoId;
      if (targetId && !linked.some((t) => t.id === targetId)) {
        targetId = "";
        localStorage.removeItem("caminhaoId");
      }
      if (!targetId && linked.length === 1) {
        targetId = linked[0].id;
        localStorage.setItem("caminhaoId", targetId);
        setActiveCaminhaoId(targetId);
      }

      if (targetId) {
        const found = linked.find((t) => t.id === targetId) || null;
        setCaminhao(found);
        if (found) {
          setIsOnline(Boolean(found.is_online));
          setCollectionsToday(found.collections_today || 0);
          if (found.lat && found.lng) {
            setMyLocation({ lat: Number(found.lat), lng: Number(found.lng) });
          }
        }
      } else {
        setCaminhao(null);
      }
    } catch (err) {
      console.error("Erro ao carregar caminhões vinculados:", err);
    } finally {
      setLoadingInit(false);
    }
  };

  // 2. Carregar pontos de coleta pendentes (aguardando ou confirmados)
  const fetchPontos = async () => {
    try {
      const { data, error } = await supabase
        .from("coco_pontos")
        .select(
          "id, tomador_id, lat, lng, address, material, status, created_at, coletado_at, foto_url, horario_previsto, quantidade_estimada, local_armazenamento, caminhao_id"
        )
        .in("status", ["aguardando", "confirmado"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (data) {
        setPontos(
          data.map((p: any) => ({
            id: p.id,
            tomador_id: p.tomador_id,
            lat: Number(p.lat),
            lng: Number(p.lng),
            address: p.address || "Endereço não informado",
            material: p.material || "misto",
            status: p.status,
            createdAt: new Date(p.created_at).getTime(),
            coletadoAt: p.coletado_at ? new Date(p.coletado_at).getTime() : null,
            fotoUrl: p.foto_url,
            horarioPrevisto: p.horario_previsto,
            quantidadeEstimada: p.quantidade_estimada,
            localArmazenamento: p.local_armazenamento,
            caminhaoId: p.caminhao_id,
          }))
        );
      }
    } catch (err) {
      console.error("Erro ao buscar pontos de coleta:", err);
    }
  };

  useEffect(() => {
    if (!user.uid) {
      if (!user.isLoading) setLoadingInit(false);
      return;
    }
    fetchLinkedTrucks();
    fetchPontos();

    const channelPontos = supabase
      .channel("realtime-pontos-online-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_pontos" }, () => {
        fetchPontos();
      })
      .subscribe();

    const channelTrucks = supabase
      .channel("realtime-caminhoes-online-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_caminhoes" }, () => {
        fetchLinkedTrucks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelPontos);
      supabase.removeChannel(channelTrucks);
    };
  }, [user.uid, user.isLoading, activeCaminhaoId]);

  useEffect(() => {
    if (isOnline && geoCoords && activeCaminhaoId) {
      setMyLocation({ lat: geoCoords.lat, lng: geoCoords.lng });
      supabase
        .from("coco_caminhoes")
        .update({ lat: geoCoords.lat, lng: geoCoords.lng, updated_at: new Date().toISOString() })
        .eq("id", activeCaminhaoId)
        .then(({ error }) => {
          if (error) console.warn("Erro ao atualizar GPS do caminhão:", error.message);
        });
    }
  }, [isOnline, geoCoords, activeCaminhaoId]);

  const toggleOnline = async () => {
    if (!activeCaminhaoId) return;
    const next = !isOnline;
    setIsOnline(next);
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ is_online: next, updated_at: new Date().toISOString() })
        .eq("id", activeCaminhaoId);
      if (error) throw error;
      showToast(next ? "🟢 Caminhão ONLINE na rota!" : "⚪ Caminhão OFFLINE.");
    } catch (err: any) {
      setIsOnline(!next);
      showToast(`Erro ao alterar status: ${err?.message || "tente novamente"}`);
    }
  };

  // Dar OK / Confirmar Coleta -> atualiza coco_pontos e dispara notificação ao Tomador
  const handleConfirmarColeta = async (ponto: PontoOperacional) => {
    if (confirmingId) return;
    setConfirmingId(ponto.id);
    const startTime = Date.now();
    try {
      const { error } = await supabase.rpc("confirmar_coleta_ponto_coco", {
        p_ponto_id: ponto.id,
        p_caminhao_id: activeCaminhaoId || null,
      });
      if (error) throw error;

      const newToday = collectionsToday + 1;
      setCollectionsToday(newToday);
      setPontos((prev) => prev.filter((item) => item.id !== ponto.id));
      if (selectedPonto?.id === ponto.id) {
        setSelectedPonto(null);
      }

      const duration = Date.now() - startTime;
      trackEvent("pickup_completed", "operational", {
        vertical: "coco",
        ponto_id: ponto.id,
        collections_today: newToday,
      });
      logSystem("INFO", "COCO", "pickup_completed", "success", duration, undefined, undefined, {
        ponto_id: ponto.id,
        collections_today: newToday,
      });

      showToast("✅ Coleta confirmada! O morador foi notificado.");
    } catch (err: any) {
      logSystem("ERROR", "COCO", "pickup_completed", "failed", undefined, err?.message, err?.code, {
        ponto_id: ponto.id,
      });
      showToast(`Erro ao confirmar coleta: ${err?.message || "tente novamente"}`);
    } finally {
      setConfirmingId(null);
    }
  };

  // Ordenação dos pontos seguindo a rota ordenada (bairro a bairro) do caminhão + distância
  const sortedPontos = useMemo(() => {
    const rota = caminhao?.areas_atendidas || [];
    const getBairroRank = (address: string) => {
      const lower = (address || "").toLowerCase();
      const idx = rota.findIndex((b) => lower.includes(b.toLowerCase()));
      return idx === -1 ? 999 : idx;
    };

    return [...pontos].sort((a, b) => {
      const rankA = getBairroRank(a.address);
      const rankB = getBairroRank(b.address);
      if (rankA !== rankB) return rankA - rankB;
      return (
        haversineKm(myLocation.lat, myLocation.lng, a.lat, a.lng) -
        haversineKm(myLocation.lat, myLocation.lng, b.lat, b.lng)
      );
    });
  }, [pontos, caminhao?.areas_atendidas, myLocation]);

  const handleSelectTruck = (truck: CaminhaoVinculado) => {
    localStorage.setItem("caminhaoId", truck.id);
    setActiveCaminhaoId(truck.id);
    setCaminhao(truck);
    setIsOnline(Boolean(truck.is_online));
    setCollectionsToday(truck.collections_today || 0);
  };

  const handleTrocarVeiculo = async () => {
    if (isOnline && activeCaminhaoId) {
      await toggleOnline();
    }
    localStorage.removeItem("caminhaoId");
    setActiveCaminhaoId("");
    setCaminhao(null);
  };

  if (loadingInit) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: "#0B0F14",
          color: "#9CA3AF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans",
        }}
      >
        Carregando Central de Coletas...
      </div>
    );
  }

  // Tela de Seleção de Caminhão (quando vinculado a 0 ou múltiplos veículos)
  if (!caminhao) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: "#0B0F14",
          color: "#F9FAFB",
          padding: "20px 18px 96px",
          fontFamily: "DM Sans",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate("/app/prestador/home")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "#111827",
              border: "1px solid rgba(16,185,129,0.30)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#10B981" }}>
              Côco &amp; Cia · Operação de Campo
            </span>
            <h1 style={{ fontFamily: "Syne", fontSize: 19, fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
              Meus Caminhões &amp; Rotas
            </h1>
          </div>
        </header>

        {myTrucks.length === 0 ? (
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(16,185,129,0.28)",
              borderRadius: 18,
              padding: 28,
              textAlign: "center",
              maxWidth: 440,
              margin: "32px auto",
            }}
          >
            <Truck size={40} color="#10B981" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              Nenhum caminhão vinculado ainda
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8, lineHeight: 1.5 }}>
              Peça ao administrativo da <strong>Côco &amp; Cia</strong> para vincular você a um veículo em <strong>Gestão de Frota</strong>.
            </p>
            <button
              type="button"
              onClick={fetchLinkedTrucks}
              style={{
                marginTop: 18,
                padding: "11px 18px",
                borderRadius: 12,
                background: "#10B981",
                color: "#0B0F14",
                border: "none",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RefreshCw size={15} /> Verificar Vínculos
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520, margin: "0 auto" }}>
            {myTrucks.map((tr) => (
              <div
                key={tr.id}
                onClick={() => handleSelectTruck(tr)}
                style={{
                  background: "#111827",
                  border: "1px solid rgba(16,185,129,0.32)",
                  boxShadow: "0 0 22px rgba(16,185,129,0.08)",
                  borderRadius: 18,
                  padding: 18,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(16,185,129,0.14)",
                        color: "#10B981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Truck size={22} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                        {tr.apelido}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#10B981" }}>
                        {tr.plate}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: tr.is_online ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)",
                      color: tr.is_online ? "#10B981" : "#9CA3AF",
                    }}
                  >
                    {tr.is_online ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>

                {(tr.hora_saida || tr.expectativa_retorno) && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#D1D5DB", fontFamily: "monospace" }}>
                    <Clock size={13} color="#10B981" />
                    Saída: {tr.hora_saida || "--:--"} → Retorno: {tr.expectativa_retorno || "--:--"}
                  </div>
                )}

                {tr.areas_atendidas && tr.areas_atendidas.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {tr.areas_atendidas.map((b, idx) => (
                      <span
                        key={`${b}-${idx}`}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "#0B0F14",
                          border: "1px solid rgba(16,185,129,0.25)",
                          color: "#E5E7EB",
                        }}
                      >
                        <strong style={{ color: "#10B981" }}>{idx + 1}º</strong> {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Toast message={toastState.message} visible={toastState.visible} />
      </div>
    );
  }

  const rotaOrdenada = caminhao.areas_atendidas || [];

  return (
    <div style={{ minHeight: "100svh", background: "#0B0F14", color: "#F9FAFB", position: "relative" }}>
      {/* Botão Voltar */}
      <button
        type="button"
        onClick={() => navigate("/app/prestador/home")}
        aria-label="voltar"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 1020,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(11,15,20,0.88)",
          border: "1px solid rgba(16,185,129,0.35)",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <ArrowLeft size={19} />
      </button>

      {/* Mapa Operacional */}
      <div style={{ height: "42svh", position: "relative" }}>
        {mounted && (
          <UBTMap
            center={{ lat: myLocation.lat, lng: myLocation.lng }}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
          >
            <AdvancedMarker position={{ lat: myLocation.lat, lng: myLocation.lng }}>
              <CaminhaoMarker isOnline={isOnline} />
            </AdvancedMarker>
            {sortedPontos.map((p) => {
              if (!isValidLatLng(p.lat, p.lng)) return null;
              return (
                <AdvancedMarker
                  key={p.id}
                  position={{ lat: p.lat, lng: p.lng }}
                  onClick={() => setSelectedPonto(p)}
                >
                  <ColetaMarker material={p.material} />
                </AdvancedMarker>
              );
            })}
          </UBTMap>
        )}
      </div>

      {/* Painel Dark Gamer / Bets de Operação */}
      <div
        style={{
          position: "relative",
          marginTop: -20,
          zIndex: 1010,
          background: "#0B0F14",
          borderTop: "1px solid rgba(16,185,129,0.35)",
          borderRadius: "24px 24px 0 0",
          padding: "16px 18px 96px",
          minHeight: "60svh",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            width: 42,
            height: 4,
            borderRadius: 999,
            background: "rgba(16,185,129,0.35)",
            margin: "0 auto 14px",
          }}
        />

        {/* Card do Caminhão + Toggle Online/Offline + Rota Ordenada + Horários */}
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(16,185,129,0.30)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 0 24px rgba(16,185,129,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "rgba(16,185,129,0.16)",
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Truck size={20} />
              </div>
              <div>
                <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                  {caminhao.apelido}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#10B981" }}>
                  {caminhao.plate} · Coletas hoje: {collectionsToday}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleOnline}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: isOnline ? "#10B981" : "rgba(255,255,255,0.18)",
                background: isOnline ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)",
                color: isOnline ? "#10B981" : "#9CA3AF",
                fontFamily: "Syne",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {isOnline ? "● ONLINE" : "○ OFFLINE"}
            </button>
          </div>

          {/* Horários de Saída / Retorno */}
          {(caminhao.hora_saida || caminhao.expectativa_retorno) && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 10,
                background: "#0B0F14",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontFamily: "monospace",
                color: "#E5E7EB",
              }}
            >
              <Clock size={14} color="#10B981" />
              <span>Saída: {caminhao.hora_saida || "--:--"}</span>
              <span style={{ color: "#6B7280" }}>→</span>
              <span>Retorno previsto: {caminhao.expectativa_retorno || "--:--"}</span>
            </div>
          )}

          {/* Rota Ordenada (Bairro a Bairro) */}
          {rotaOrdenada.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#10B981",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Rota Ordenada (Bairro a Bairro)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {rotaOrdenada.map((b, idx) => (
                  <span
                    key={`${b}-${idx}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "#0B0F14",
                      border: "1px solid rgba(16,185,129,0.28)",
                      color: "#F3F4F6",
                    }}
                  >
                    <strong style={{ color: "#10B981", fontFamily: "monospace" }}>{idx + 1}º</strong> {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {myTrucks.length > 1 && (
            <button
              type="button"
              onClick={handleTrocarVeiculo}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#D1D5DB",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Trocar de Veículo
            </button>
          )}
        </div>

        {/* Detalhes do Ponto Selecionado no Mapa */}
        {selectedPonto && (
          <div
            style={{
              marginTop: 14,
              background: "#111827",
              border: "1px solid rgba(16,185,129,0.45)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10B981" }}>
                  Ponto Selecionado
                </span>
                <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#FFFFFF", margin: "4px 0 0" }}>
                  {selectedPonto.address}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPonto(null)}
                style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {(selectedPonto.quantidadeEstimada || selectedPonto.localArmazenamento) && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#D1D5DB" }}>
                {selectedPonto.quantidadeEstimada && <div>Volume: {selectedPonto.quantidadeEstimada}</div>}
                {selectedPonto.localArmazenamento && <div>Local: {selectedPonto.localArmazenamento}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPonto.lat},${selectedPonto.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  textDecoration: "none",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#E5E7EB",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Navigation size={14} /> Abrir Rota
              </a>
              <button
                type="button"
                disabled={confirmingId === selectedPonto.id}
                onClick={() => handleConfirmarColeta(selectedPonto)}
                style={{
                  flex: 1.4,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#10B981",
                  border: "none",
                  color: "#0B0F14",
                  fontFamily: "Syne",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: confirmingId === selectedPonto.id ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={15} />
                {confirmingId === selectedPonto.id ? "Confirmando..." : "OK · Confirmar Coleta"}
              </button>
            </div>
          </div>
        )}

        {/* Lista de Pontos de Coleta Pendentes */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#10B981",
              }}
            >
              Pontos de Coleta na Rota ({sortedPontos.length})
            </span>
            <button
              type="button"
              onClick={fetchPontos}
              style={{
                background: "none",
                border: "none",
                color: "#9CA3AF",
                fontSize: 11,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>

          {sortedPontos.length === 0 ? (
            <div
              style={{
                background: "#111827",
                border: "1px dashed rgba(16,185,129,0.28)",
                borderRadius: 14,
                padding: 24,
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              Nenhum ponto pendente de coleta no momento. Bom trabalho! 🌱
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedPontos.map((p) => {
                const m = getMaterial(p.material);
                const dist = haversineKm(myLocation.lat, myLocation.lng, p.lat, p.lng);
                const isBusy = confirmingId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPonto(p)}
                    style={{
                      background: "#111827",
                      border: "1px solid rgba(16,185,129,0.25)",
                      borderRadius: 14,
                      padding: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: `${m.cor}22`,
                        border: `1px solid ${m.cor}55`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {m.emoji}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MapPin size={12} color="#10B981" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.address}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
                        {formatDist(dist)} · {m.nome}
                        {p.quantidadeEstimada ? ` · ${p.quantidadeEstimada}` : ""}
                      </div>
                      {p.localArmazenamento && (
                        <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 2 }}>
                          📍 {p.localArmazenamento}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmarColeta(p);
                      }}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 10,
                        background: "#10B981",
                        border: "none",
                        color: "#0B0F14",
                        fontFamily: "Syne",
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        cursor: isBusy ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                        boxShadow: "0 0 14px rgba(16,185,129,0.28)",
                      }}
                    >
                      <Check size={14} />
                      {isBusy ? "..." : "OK"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Toast message={toastState.message} visible={toastState.visible} />
    </div>
  );
};

export default CocoOnlinePage;
