import { useState, useEffect, useMemo } from "react";
import { 
  Radio, 
  Shield, 
  ListCollapse, 
  MessageSquare, 
  AlertCircle, 
  ShoppingBag, 
  Truck, 
  Calendar, 
  Sparkles,
  MapPin,
  AlertTriangle,
  Clock,
  Eye
} from "lucide-react";
import { Card, PageTitle, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { HelpTooltip } from "@/components/admin/HelpTooltip";

interface LiveLogItem {
  id: string;
  timestamp: string;
  source: "pedidos" | "diaristas" | "reciclagem" | "ambulantes" | "antifraude";
  event: string;
  payload: any;
}

interface RideRecord {
  id: string;
  tomador_id: string;
  prestador_id: string;
  status: string;
  type: string;
  origin: { lat: number; lng: number } | any;
  destination: { lat: number; lng: number } | any;
  distance_km: number;
  duration_min: number;
  real_distance_km?: number;
  real_duration_min?: number;
  average_speed_kmh?: number;
  risk_level?: "risk_low" | "risk_medium" | "risk_high" | string;
  antifraud_flags?: string[];
  created_at: string;
}

export default function AdminOperacoesPage() {
  const toast = useAdminToast();
  const [stats, setStats] = useState({
    activePedidos: 0,
    activeAgendamentos: 0,
    activeCaminhoes: 0,
    activeAmbulantes: 0,
    highRiskRides: 0
  });
  const [liveLogs, setLiveLogs] = useState<LiveLogItem[]>([]);
  const [recentRides, setRecentRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<RideRecord | null>(null);

  useEffect(() => {
    loadStatsAndRides();

    // Subscribe to realtime changes on orders (pedidos)
    const channelPedidos = supabase
      .channel("realtime-pedidos-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          setStats(prev => ({ ...prev, activePedidos: prev.activePedidos + 1 }));
        } else if (payload.eventType === "DELETE") {
          setStats(prev => ({ ...prev, activePedidos: Math.max(0, prev.activePedidos - 1) }));
        }

        const newLog: LiveLogItem = {
          id: payload.new?.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          source: "pedidos",
          event: `Pedido de Mototáxi/Ambulante ${payload.eventType === "INSERT" ? "criado" : payload.eventType === "UPDATE" ? "atualizado para " + payload.new.status : "deletado"}.`,
          payload: payload.new || payload.old
        };
        setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
        toast.show("Atualização de Pedido recebida em tempo real!");
      })
      .subscribe();

    // Subscribe to realtime changes on diaristas
    const channelDiaristas = supabase
      .channel("realtime-diaristas-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "diarista_agendamentos" }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          setStats(prev => ({ ...prev, activeAgendamentos: prev.activeAgendamentos + 1 }));
        } else if (payload.eventType === "DELETE") {
          setStats(prev => ({ ...prev, activeAgendamentos: Math.max(0, prev.activeAgendamentos - 1) }));
        }

        const newLog: LiveLogItem = {
          id: payload.new?.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          source: "diaristas",
          event: `Agendamento de Diarista ${payload.eventType === "INSERT" ? "recebido" : payload.eventType === "UPDATE" ? "atualizado para " + payload.new.status : "removido"}.`,
          payload: payload.new || payload.old
        };
        setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
        toast.show("Atualização de Agendamento Diarista realtime!");
      })
      .subscribe();

    // Subscribe to recycling trucks
    const channelCaminhoes = supabase
      .channel("realtime-caminhoes-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_caminhoes" }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          setStats(prev => ({ ...prev, activeCaminhoes: prev.activeCaminhoes + 1 }));
        } else if (payload.eventType === "DELETE") {
          setStats(prev => ({ ...prev, activeCaminhoes: Math.max(0, prev.activeCaminhoes - 1) }));
        }

        const newLog: LiveLogItem = {
          id: payload.new?.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          source: "reciclagem",
          event: `Caminhão de Coleta ${payload.new?.nome || "Côco"} ${payload.eventType === "INSERT" ? "entrou em serviço" : payload.eventType === "DELETE" ? "saiu de serviço" : "atualizou telemetria"}.`,
          payload: payload.new || payload.old
        };
        setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
      })
      .subscribe();

    // Subscribe to active ambulante sessions
    const channelAmbulantes = supabase
      .channel("realtime-ambulantes-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulante_sessions" }, (payload: any) => {
        if (payload.eventType === "INSERT" && payload.new?.is_active) {
          setStats(prev => ({ ...prev, activeAmbulantes: prev.activeAmbulantes + 1 }));
        } else if (payload.eventType === "UPDATE") {
          if (payload.new?.is_active && !payload.old?.is_active) {
            setStats(prev => ({ ...prev, activeAmbulantes: prev.activeAmbulantes + 1 }));
          } else if (!payload.new?.is_active && payload.old?.is_active) {
            setStats(prev => ({ ...prev, activeAmbulantes: Math.max(0, prev.activeAmbulantes - 1) }));
          }
        }

        const newLog: LiveLogItem = {
          id: payload.new?.id || Math.random().toString(),
          timestamp: new Date().toISOString(),
          source: "ambulantes",
          event: `Carrinho Ambulante ${payload.eventType === "INSERT" ? "iniciou sessão de vendas" : "atualizou status"}.`,
          payload: payload.new || payload.old
        };
        setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
      })
      .subscribe();

    // Realtime Ghost Ride and Risk updates on mototaxi_corridas
    const channelCorridas = supabase
      .channel("realtime-corridas-risk-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "mototaxi_corridas" }, (payload: any) => {
        if (payload.eventType === "UPDATE" && payload.new?.status === "completed") {
          // Atualiza lista local
          setRecentRides(prev => [payload.new, ...prev.filter(r => r.id !== payload.new.id)].slice(0, 9));
          
          // Incrementar contador de alertas se for alto/medio risco
          if (payload.new?.risk_level === "risk_high" || payload.new?.risk_level === "risk_medium") {
            setStats(prev => ({ ...prev, highRiskRides: prev.highRiskRides + 1 }));
            
            // Log no feed geral
            const newLog: LiveLogItem = {
              id: payload.new.id,
              timestamp: new Date().toISOString(),
              source: "antifraude",
              event: `⚠️ Alerta Ghost Ride: Corrida #${payload.new.id.slice(0,8).toUpperCase()} classificada como ${payload.new.risk_level === "risk_high" ? "Alto Risco" : "Médio Risco"}!`,
              payload: {
                flags: payload.new.antifraud_flags,
                speed: payload.new.average_speed_kmh,
                distance: payload.new.real_distance_km
              }
            };
            setLiveLogs(prev => [newLog, ...prev.slice(0, 19)]);
            toast.show(`Alerta Ghost Ride detectado: risco ${payload.new.risk_level === "risk_high" ? "Alto" : "Médio"}`);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelPedidos);
      supabase.removeChannel(channelDiaristas);
      supabase.removeChannel(channelCaminhoes);
      supabase.removeChannel(channelAmbulantes);
      supabase.removeChannel(channelCorridas);
    };
  }, []);

  const loadStatsAndRides = async () => {
    try {
      setLoading(true);
      const [
        { count: pedCount },
        { count: agCount },
        { count: camCount },
        { count: ambCount },
        { count: riskCount },
        { data: ridesData }
      ] = await Promise.all([
        supabase.from("pedidos").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "accepted", "preparing"]),
        supabase.from("diarista_agendamentos").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("coco_caminhoes").select("*", { count: "exact", head: true }),
        supabase.from("ambulante_sessions").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("mototaxi_corridas").select("*", { count: "exact", head: true }).in("risk_level", ["risk_high", "risk_medium"]),
        supabase.from("mototaxi_corridas").select("*").eq("status", "completed").order("created_at", { ascending: false }).limit(10)
      ]);

      setStats({
        activePedidos: pedCount || 0,
        activeAgendamentos: agCount || 0,
        activeCaminhoes: camCount || 0,
        activeAmbulantes: ambCount || 0,
        highRiskRides: riskCount || 0
      });

      if (ridesData) {
        setRecentRides(ridesData);
      }

      setLiveLogs([
        {
          id: "system_init",
          timestamp: new Date().toISOString(),
          source: "pedidos",
          event: "Conexão Realtime estabelecida. Monitoramento de Ghost Ride ativo.",
          payload: { active_orders: pedCount, active_bookings: agCount, tracked_rides: ridesData?.length || 0 }
        }
      ]);

    } catch (err) {
      console.error("Erro ao carregar dados operacionais:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSourceStyle = (source: LiveLogItem["source"]) => {
    switch (source) {
      case "pedidos":
        return { color: "#2B6EE8", bg: "rgba(43,110,232,0.1)", label: "Pedidos / Mototáxi" };
      case "diaristas":
        return { color: "#9B59B6", bg: "rgba(155,89,182,0.1)", label: "Diaristas" };
      case "reciclagem":
        return { color: "#0DB87E", bg: "rgba(13,184,126,0.1)", label: "Reciclagem" };
      case "antifraude":
        return { color: "#E84040", bg: "rgba(232,64,64,0.1)", label: "Antifraude" };
      default:
        return { color: "#F5A623", bg: "rgba(245,166,35,0.1)", label: "Ambulantes" };
    }
  };

  const getRiskLabel = (level?: string) => {
    switch (level) {
      case "risk_high": return "Risco Alto";
      case "risk_medium": return "Risco Médio";
      default: return "Risco Baixo";
    }
  };

  const getRiskPill = (level?: string) => {
    switch (level) {
      case "risk_high":
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">Alto</Pill>;
      case "risk_medium":
        return <Pill bg="rgba(245,166,35,0.08)" color="#F5A623">Médio</Pill>;
      default:
        return <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E">Baixo</Pill>;
    }
  };

  const getFlagPill = (flag: string) => {
    switch (flag) {
      case "SPEED_LIMIT_EXCEEDED":
        return <span style={{ background: "rgba(232,64,64,0.08)", color: "#E84040", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>Velocidade &gt; 120km/h</span>;
      case "INCOMPATIBLE_DISTANCE":
        return <span style={{ background: "rgba(245,166,35,0.08)", color: "#F5A623", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>Desvio de Distância</span>;
      case "NO_DISPLACEMENT":
        return <span style={{ background: "rgba(43,110,232,0.08)", color: "#2B6EE8", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>Sem Deslocamento</span>;
      default:
        return <span style={{ background: "#F1F5F9", color: "#64748B", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{flag}</span>;
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <PageTitle sub="Central unificada de monitoramento e auditoria antifraude locacional (Ghost Ride)">
          Operações & Segurança Locacional
        </PageTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Radio className="animate-pulse" size={16} color="#0DB87E" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0DB87E" }}>
            Transmissão Conectada Realtime
          </span>
        </div>
      </div>

      {/* Realtime KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, display: "inline-flex", alignItems: "center" }}>
              Pedidos & Corridas Ativos
              <HelpTooltip concept="admin.operacoes.corridas_ativas" />
            </span>
            <ShoppingBag size={20} color="#2B6EE8" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#0F172A", marginTop: 12 }}>
            {loading ? "..." : stats.activePedidos}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, display: "inline-flex", alignItems: "center" }}>
              Alertas de Ghost Ride
              <HelpTooltip concept="admin.operacoes.ghost_ride_alerts" />
            </span>
            <AlertTriangle size={20} color="#E84040" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: stats.highRiskRides > 0 ? "#E84040" : "#0F172A", marginTop: 12 }}>
            {loading ? "..." : stats.highRiskRides}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>
              Carrinhos Ambulantes
            </span>
            <Shield size={20} color="#F5A623" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#0F172A", marginTop: 12 }}>
            {loading ? "..." : stats.activeAmbulantes}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>
              Veículos Reciclagem
            </span>
            <Truck size={20} color="#0DB87E" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#0F172A", marginTop: 12 }}>
            {loading ? "..." : stats.activeCaminhoes}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginBottom: 32 }}>
        
        {/* Ghost Ride Audit Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Auditoria Antifraude: Corridas Recentes (Mototáxi)
            </h3>
            <span style={{ fontSize: 12, color: "#64748B" }}>*Pagamentos nunca são bloqueados automaticamente</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
              Carregando auditoria de telemetria...
            </div>
          ) : recentRides.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
              Nenhuma corrida finalizada encontrada para auditoria locacional.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <tr>
                    {["Corrida / Horário", "Dist. Estimada", "Dist. Real", "Vel. Média", "Flags de Risco", "Nível Risco", "Ações"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 24px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRides.map((r) => {
                    const isHigh = r.risk_level === "risk_high";
                    const isMed = r.risk_level === "risk_medium";
                    const speed = r.average_speed_kmh ? Number(r.average_speed_kmh) : 0;
                    
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #E2E8F0", background: isHigh ? "rgba(232,64,64,0.02)" : "transparent" }}>
                        <td style={{ padding: "16px 24px" }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                            #{r.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span style={{ display: "block", fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px", fontSize: 13, color: "#475569" }}>
                          {r.distance_km} km
                        </td>
                        <td style={{ padding: "16px 24px", fontSize: 13, color: "#475569", fontWeight: 500 }}>
                          {r.real_distance_km !== undefined ? `${r.real_distance_km} km` : "N/A"}
                        </td>
                        <td style={{ padding: "16px 24px", fontSize: 13, fontWeight: speed > 120 ? 700 : 500, color: speed > 120 ? "#E84040" : "#475569" }}>
                          {speed} km/h
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          {r.antifraud_flags && r.antifraud_flags.length > 0 ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {r.antifraud_flags.map((f, idx) => (
                                <span key={idx}>{getFlagPill(f)}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Nenhum alerta</span>
                          )}
                        </td>
                        <td style={{ padding: "16px 24px" }}>{getRiskPill(r.risk_level)}</td>
                        <td style={{ padding: "16px 24px" }}>
                          <button
                            onClick={() => setSelectedRide(r)}
                            style={{
                              background: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#475569",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            <Eye size={12} /> Trajeto
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        
        {/* Realtime Live Logs feed */}
        <div>
          <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
            Feed Operacional de Eventos ao Vivo
          </h3>

          <Card style={{ padding: 24, background: "#fff" }}>
            {liveLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                Aguardando eventos realtime do Supabase...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {liveLogs.map((log) => {
                  const src = getSourceStyle(log.source);
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        paddingBottom: 14,
                        borderBottom: "1px solid #F1F5F9"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", paddingTop: 3 }}>
                        {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Pill bg={src.bg} color={src.color} size="sm">
                          {src.label}
                        </Pill>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: log.source === "antifraude" ? "#E84040" : "#1E293B" }}>
                          {log.event}
                        </div>
                        {log.payload && (
                          <pre
                            style={{
                              background: "#F8FAFC",
                              padding: 10,
                              borderRadius: 8,
                              fontSize: 11,
                              fontFamily: "monospace",
                              color: "#64748B",
                              marginTop: 6,
                              overflowX: "auto",
                              maxHeight: 100,
                            }}
                          >
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal de Detalhes do Trajeto */}
      {selectedRide && (
        <div 
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setSelectedRide(null)}
        >
          <div 
            style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, padding: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin color="#2B6EE8" />
              Trajeto da Corrida #{selectedRide.id.slice(0, 8).toUpperCase()}
            </h3>
            
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
              <div>
                <span style={{ color: "#64748B", display: "block", marginBottom: 2 }}>Origem GPS:</span>
                <span style={{ color: "#1E293B", fontWeight: 500 }}>
                  {selectedRide.origin ? `Lat: ${selectedRide.origin.lat}, Lng: ${selectedRide.origin.lng}` : "Não mapeado"}
                </span>
              </div>

              <div>
                <span style={{ color: "#64748B", display: "block", marginBottom: 2 }}>Destino GPS:</span>
                <span style={{ color: "#1E293B", fontWeight: 500 }}>
                  {selectedRide.destination ? `Lat: ${selectedRide.destination.lat}, Lng: ${selectedRide.destination.lng}` : "Não mapeado"}
                </span>
              </div>

              <div>
                <span style={{ color: "#64748B", display: "block", marginBottom: 4 }}>Telemetria Detalhada:</span>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 14, border: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Distância Estimada:</span>
                    <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedRide.distance_km} km</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Distância Real:</span>
                    <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedRide.real_distance_km} km</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Velocidade Média:</span>
                    <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedRide.average_speed_kmh} km/h</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Duração do Trajeto:</span>
                    <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedRide.real_duration_min} min</span>
                  </div>
                </div>
              </div>

              {selectedRide.trajectory_polyline && (
                <div>
                  <span style={{ color: "#64748B", display: "block", marginBottom: 2 }}>Polilinha do Trajeto:</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, background: "#F1F5F9", padding: 6, borderRadius: 6, wordBreak: "break-all", display: "block", maxHeight: 60, overflowY: "auto" }}>
                    {selectedRide.trajectory_polyline}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedRide(null)}
              style={{
                width: "100%",
                height: 42,
                background: "#2B6EE8",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                marginTop: 24
              }}
            >
              Fechar Auditoria
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
