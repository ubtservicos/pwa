import { useState, useEffect, useMemo } from "react";
import { BarChart3, Users, ClipboardList, Activity, RefreshCw, Calendar, Eye, FileJson, X } from "lucide-react";
import { Card, PageTitle, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { HelpTooltip } from "@/components/admin/HelpTooltip";

interface AnalyticsEventRecord {
  id: string;
  user_id: string | null;
  event_name: string;
  event_category: string;
  created_at_utc: string;
  timezone: string;
  session_id: string;
  device_id: string;
  anonymous_id: string | null;
  platform: string | null;
  app_version: string | null;
  origin: string | null;
  vertical: string | null;
  properties: any;
}

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  signup_started: { bg: "rgba(43,110,232,0.1)", text: "#2B6EE8" },
  signup_completed: { bg: "rgba(13,184,126,0.1)", text: "#0DB87E" },
  request_created: { bg: "rgba(245,166,35,0.1)", text: "#F5A623" },
  request_accepted: { bg: "rgba(147,51,234,0.1)", text: "#9333EA" },
  request_cancelled: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
  payment_started: { bg: "rgba(16,185,129,0.1)", text: "#10B981" },
  payment_success: { bg: "rgba(16,185,129,0.2)", text: "#059669" },
  payout_completed: { bg: "rgba(59,130,246,0.2)", text: "#2563EB" }
};

export default function AdminAnalyticsPage() {
  const toast = useAdminToast();
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<AnalyticsEventRecord | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("analytics_events")
        .select("*")
        .order("created_at_utc", { ascending: false });

      if (error) throw error;
      if (data) setEvents(data);
    } catch (err: any) {
      console.error("Erro ao carregar telemetria:", err);
      toast.show("Erro ao carregar dados de analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter events by period and vertical
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const periodThreshold = new Date();
    if (period === "24h") periodThreshold.setHours(now.getHours() - 24);
    else if (period === "7d") periodThreshold.setDate(now.getDate() - 7);
    else if (period === "30d") periodThreshold.setDate(now.getDate() - 30);

    return events.filter(e => {
      const date = new Date(e.created_at_utc);
      const matchPeriod = date >= periodThreshold;
      
      const eventVert = e.vertical || "generic";
      const matchVertical = verticalFilter === "all" || eventVert === verticalFilter;

      return matchPeriod && matchVertical;
    });
  }, [events, period, verticalFilter]);

  // Aggregate Funnels and KPIs
  const metrics = useMemo(() => {
    const totals: Record<string, number> = {
      signup_started: 0,
      signup_completed: 0,
      request_created: 0,
      request_accepted: 0,
      request_cancelled: 0,
      payment_started: 0,
      payment_success: 0,
      payout_completed: 0
    };

    const uniqueUsers = new Set<string>();

    filteredEvents.forEach(e => {
      if (totals[e.event_name] !== undefined) {
        totals[e.event_name]++;
      }
      if (e.user_id) uniqueUsers.add(e.user_id);
    });

    // Calculations
    const signupConversion = totals.signup_started > 0 
      ? (totals.signup_completed / totals.signup_started) * 100 
      : 0;

    const orderToAccept = totals.request_created > 0 
      ? (totals.request_accepted / totals.request_created) * 100 
      : 0;

    const orderToComplete = totals.request_created > 0 
      ? (totals.payout_completed / totals.request_created) * 100 
      : 0;

    return {
      totals,
      uniqueUsersCount: uniqueUsers.size,
      signupConversion,
      orderToAccept,
      orderToComplete
    };
  }, [filteredEvents]);

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Infraestrutura de analytics em tempo real de fluxos e conversão operacional">
        Analytics & Funis
      </PageTitle>

      {/* Filter and Period Picker */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
            Período
          </label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["24h", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 6,
                  border: "1px solid var(--admin-border)",
                  background: period === p ? "#0DB87E" : "#fff",
                  color: period === p ? "#fff" : "var(--admin-subtle)",
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                {p === "24h" ? "Últimas 24h" : p === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
            Vertical Operacional
          </label>
          <select
            value={verticalFilter}
            onChange={(e) => setVerticalFilter(e.target.value)}
            style={{ height: 34, border: "1px solid var(--admin-border)", borderRadius: 6, padding: "0 12px", fontFamily: "DM Sans" }}
          >
            <option value="all">Todas as Verticais</option>
            <option value="mototaxi">Mototáxi</option>
            <option value="ambulantes">Ambulantes</option>
            <option value="diaristas">Diaristas</option>
          </select>
        </div>

        <button
          onClick={fetchEvents}
          style={{
            marginLeft: "auto",
            alignSelf: "flex-end",
            height: 34,
            padding: "0 12px",
            border: "1px solid var(--admin-border)",
            borderRadius: 6,
            background: "var(--admin-bg)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "DM Sans",
            fontSize: 13
          }}
        >
          <RefreshCw size={14} /> Atualizar dados
        </button>
      </Card>

      {/* Main KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 24 }}>
        <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(43,110,232,0.1)", padding: 10, borderRadius: 10 }}>
            <Activity size={20} color="#2B6EE8" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)" }}>{filteredEvents.length}</div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)", display: "inline-flex", alignItems: "center" }}>
              Eventos Capturados
              <HelpTooltip concept="admin.analytics.eventos_capturados" />
            </div>
          </div>
        </Card>
        
        <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(13,184,126,0.1)", padding: 10, borderRadius: 10 }}>
            <Users size={20} color="#0DB87E" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)" }}>{metrics.uniqueUsersCount}</div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)", display: "inline-flex", alignItems: "center" }}>
              Usuários Ativos (Logados)
              <HelpTooltip concept="admin.analytics.usuarios_ativos" />
            </div>
          </div>
        </Card>

        <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(245,166,35,0.1)", padding: 10, borderRadius: 10 }}>
            <ClipboardList size={20} color="#F5A623" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)" }}>{metrics.totals.request_created}</div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)", display: "inline-flex", alignItems: "center" }}>
              Pedidos Criados
              <HelpTooltip concept="admin.analytics.pedidos_criados" />
            </div>
          </div>
        </Card>

        <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(59,130,246,0.1)", padding: 10, borderRadius: 10 }}>
            <BarChart3 size={20} color="#3B82F6" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)" }}>{metrics.totals.payout_completed}</div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)" }}>Serviços Concluídos</div>
          </div>
        </Card>
      </div>

      {/* Funnels Visualization */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginBottom: 24 }}>
        
        {/* Signup Funnel */}
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", marginBottom: 16 }}>
            Funil de Cadastro
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyBetween: "space-between", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>1. Iniciaram cadastro (signup_started)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)" }}>{metrics.totals.signup_started}</span>
              </div>
              <div style={{ width: "100%", height: 10, background: "var(--admin-bg)", borderRadius: 999 }}>
                <div style={{ width: "100%", height: "100%", background: "#2B6EE8", borderRadius: 999 }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyBetween: "space-between", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>2. Concluíram cadastro (signup_completed)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0DB87E" }}>
                  {metrics.totals.signup_completed} ({metrics.signupConversion.toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: "100%", height: 10, background: "var(--admin-bg)", borderRadius: 999 }}>
                <div style={{ width: `${metrics.signupConversion}%`, height: "100%", background: "#0DB87E", borderRadius: 999 }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Operational Order Funnel */}
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", marginBottom: 16 }}>
            Funil de Conversão de Pedidos
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "1. Criado (request_created)", val: metrics.totals.request_created, color: "#F5A623" },
              { label: "2. Aceito (request_accepted)", val: metrics.totals.request_accepted, color: "#9333EA" },
              { label: "3. Checkout (payment_started)", val: metrics.totals.payment_started, color: "#10B981" },
              { label: "4. Pago (payment_success)", val: metrics.totals.payment_success, color: "#059669" },
              { label: "5. Concluído (payout_completed)", val: metrics.totals.payout_completed, color: "#2563EB" }
            ].map((step, idx, arr) => {
              const base = arr[0].val || 1;
              const pct = (step.val / base) * 100;
              return (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{step.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: step.color }}>{step.val} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "var(--admin-bg)", borderRadius: 999 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: step.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Events Feed List */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
            Fluxo de Telemetria Recente (Live)
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Carregando eventos...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhum evento registrado no período.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["Data/Hora", "Tipo de Evento", "ID de Usuário", "Dados Extras", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 24px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--admin-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEvents.slice(0, 15).map((e) => {
                  const badge = EVENT_COLORS[e.event_name] || { bg: "var(--admin-bg)", text: "var(--admin-subtle)" };
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      
                      {/* Date/Time */}
                      <td style={{ padding: "14px 24px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                        {new Date(e.created_at_utc).toLocaleDateString("pt-BR")} às {new Date(e.created_at_utc).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      
                      {/* Event Type Badge */}
                      <td style={{ padding: "14px 24px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.text,
                            padding: "3px 10px",
                            borderRadius: 99,
                            fontFamily: "monospace"
                          }}
                        >
                          {e.event_name}
                        </span>
                      </td>

                      {/* User ID */}
                      <td style={{ padding: "14px 24px", fontFamily: "monospace", fontSize: 12, color: "var(--admin-subtle)" }}>
                        {e.user_id ? `#${e.user_id.slice(0, 8)}...` : "Anônimo"}
                      </td>

                      {/* Details preview */}
                      <td style={{ padding: "14px 24px", fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                        {e.vertical ? `Vertical: ${e.vertical}` : "Dispositivo / Sistema"}
                      </td>

                      {/* Inspector Action */}
                      <td style={{ padding: "14px 24px" }}>
                        <button
                          onClick={() => setSelectedEvent(e)}
                          style={{
                            border: "none",
                            background: "rgba(43,110,232,0.1)",
                            color: "#2B6EE8",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "DM Sans",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <Eye size={12} /> Detalhes
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

      {/* Inspector Modal */}
      {selectedEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--admin-bg)", borderRadius: 16, width: "100%", maxWidth: 500, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyBetween: "space-between", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Inspecionar Evento Operacional
              </h3>
              <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="var(--admin-subtle)" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--admin-subtle)" }}>Tipo do Evento:</span>
                <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{selectedEvent.event_name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--admin-subtle)" }}>Timestamp:</span>
                <span style={{ color: "var(--admin-subtle)" }}>{new Date(selectedEvent.created_at_utc).toLocaleString("pt-BR")}</span>
              </div>

              {/* Metadata */}
              <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                  <FileJson size={12} /> Metadados do Evento
                </div>
                <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: "var(--admin-subtle)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(selectedEvent.properties, null, 2)}
                </pre>
              </div>

              {/* Device info */}
              <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                  <Activity size={12} /> Dados do Navegador / Dispositivo
                </div>
                <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: "var(--admin-subtle)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify({
                    platform: selectedEvent.platform,
                    app_version: selectedEvent.app_version,
                    timezone: selectedEvent.timezone,
                    session_id: selectedEvent.session_id,
                    device_id: selectedEvent.device_id,
                    anonymous_id: selectedEvent.anonymous_id,
                    origin: selectedEvent.origin,
                    vertical: selectedEvent.vertical
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                width: "100%",
                height: 40,
                background: "var(--admin-bg)",
                color: "var(--admin-subtle)",
                border: "none",
                borderRadius: 8,
                fontFamily: "DM Sans",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Fechar Inspetor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
