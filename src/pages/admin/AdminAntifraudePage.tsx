import { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle, Search, Eye, X, Check, ArrowRight } from "lucide-react";
import { Card, PageTitle, Pill, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface TelemetryFlag {
  id: string;
  ride_id: string;
  flag_type: string;
  severity: string;
  metadata: any;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  driver_name?: string;
  driver_email?: string;
  client_name?: string;
  client_email?: string;
  resolved_by_name?: string;
}

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  driver_client_distance: { label: "Passageiro Distante", description: "Distância cliente-motorista > 100m durante a corrida" },
  overspeed: { label: "Velocidade Excessiva", description: "Velocidade calculada superior a 120 km/h" },
  short_displacement: { label: "Sem Deslocamento", description: "Corrida concluída sem deslocamento mínimo do passageiro" },
  route_divergence: { label: "Desvio de Rota", description: "Divergência expressiva entre rota estimada e GPS" }
};

export default function AdminAntifraudePage() {
  const toast = useAdminToast();
  const [flags, setFlags] = useState<TelemetryFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("unresolved");
  
  // Resolution modal state
  const [selectedFlag, setSelectedFlag] = useState<TelemetryFlag | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("telemetry_flags")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("flag_type", filterType);
      }

      if (filterStatus === "resolved") {
        query = query.not("resolved_at", "is", null);
      } else if (filterStatus === "unresolved") {
        query = query.is("resolved_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const flagList = data || [];
      
      // Enrich with ride, driver, client, and resolver names
      const rideIds = flagList.map(f => f.ride_id);
      const userIds = new Set<string>();
      
      let ridesMap = new Map<string, any>();
      if (rideIds.length > 0) {
        const { data: ridesData } = await supabase
          .from("mototaxi_corridas")
          .select("id, tomador_id, prestador_id")
          .in("id", rideIds);
        
        if (ridesData) {
          ridesData.forEach(r => {
            ridesMap.set(r.id, r);
            if (r.tomador_id) userIds.add(r.tomador_id);
            if (r.prestador_id) userIds.add(r.prestador_id);
          });
        }
      }

      flagList.forEach(f => {
        if (f.resolved_by) userIds.add(f.resolved_by);
      });

      let usersMap = new Map<string, { nome: string; email: string }>();
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from("usuarios")
          .select("id, nome, email")
          .in("id", Array.from(userIds));
        
        if (usersData) {
          usersData.forEach(u => usersMap.set(u.id, { nome: u.nome, email: u.email }));
        }
      }

      const enriched: TelemetryFlag[] = flagList.map(f => {
        const ride = ridesMap.get(f.ride_id);
        const driver = ride ? usersMap.get(ride.prestador_id) : null;
        const client = ride ? usersMap.get(ride.tomador_id) : null;
        const resolver = f.resolved_by ? usersMap.get(f.resolved_by) : null;

        return {
          ...f,
          driver_name: driver?.nome || "Motorista não atribuído",
          driver_email: driver?.email || "—",
          client_name: client?.nome || "Passageiro não atribuído",
          client_email: client?.email || "—",
          resolved_by_name: resolver?.nome || "Admin UBT"
        };
      });

      setFlags(enriched);
    } catch (err: any) {
      console.error("Erro ao buscar telemetria:", err);
      toast.show("Erro ao carregar alertas antifraude.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [filterType, filterStatus]);

  const handleResolveFlag = async () => {
    if (!selectedFlag || !resolutionNotes.trim() || submitting) return;
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("telemetry_flags")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes.trim()
        })
        .eq("id", selectedFlag.id);

      if (error) throw error;
      
      toast.show("Alerta de fraude resolvido com sucesso!");
      setSelectedFlag(null);
      setResolutionNotes("");
      fetchFlags();
    } catch (err: any) {
      console.error("Erro ao resolver flag:", err);
      toast.show("Erro ao salvar resolução.");
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalAlerts = flags.length;
  const criticalAlerts = flags.filter(f => f.severity === "critical" && !f.resolved_at).length;
  const resolvedAlerts = flags.filter(f => f.resolved_at).length;

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Auditoria em tempo real de velocidades, desvios e distâncias de segurança do Mototáxi">
        Antifraude & Telemetria
      </PageTitle>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 24 }}>
        <Card style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(43,110,232,0.1)", padding: 12, borderRadius: 12 }}>
            <ShieldAlert size={24} color="#2B6EE8" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0F172A" }}>{totalAlerts}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Alertas Totais</div>
          </div>
        </Card>
        
        <Card style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(232,64,64,0.08)", padding: 12, borderRadius: 12 }}>
            <AlertTriangle size={24} color="#E84040" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#E84040" }}>{criticalAlerts}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Críticos Pendentes (Saques bloqueados)</div>
          </div>
        </Card>
        
        <Card style={{ padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "rgba(13,184,126,0.1)", padding: 12, borderRadius: 12 }}>
            <CheckCircle size={24} color="#0DB87E" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0DB87E" }}>{resolvedAlerts}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Alertas Resolvidos</div>
          </div>
        </Card>
      </div>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        
        {/* Type filter */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
            Tipo de Alerta
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", fontFamily: "DM Sans" }}
          >
            <option value="all">Todos os tipos</option>
            <option value="driver_client_distance">Passageiro Distante (&gt;100m)</option>
            <option value="overspeed">Velocidade Excessiva (&gt;120 km/h)</option>
            <option value="short_displacement">Sem Deslocamento</option>
            <option value="route_divergence">Divergência de Rota</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", fontFamily: "DM Sans" }}
          >
            <option value="all">Todos os alertas</option>
            <option value="unresolved">Pendentes (Não Resolvidos)</option>
            <option value="resolved">Resolvidos</option>
          </select>
        </div>
      </Card>

      {/* Table grid */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Carregando registros de telemetria...
          </div>
        ) : flags.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Nenhuma divergência de telemetria encontrada.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#F8FAFC" }}>
                <tr>
                  {["Data/Hora", "Gravidade", "Tipo de Alerta", "Motorista", "Passageiro", "Resolução", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 18px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#94A3B8",
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
                {flags.map((f) => {
                  const typeMeta = TYPE_LABELS[f.flag_type] || { label: f.flag_type, description: "" };
                  return (
                    <tr key={f.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                      
                      {/* Date/Time */}
                      <td style={{ padding: "14px 18px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                        {new Date(f.created_at).toLocaleDateString("pt-BR")} às {new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      
                      {/* Severity Badge */}
                      <td style={{ padding: "14px 18px" }}>
                        {f.severity === "critical" ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#E84040", background: "rgba(232,64,64,0.08)", padding: "3px 8px", borderRadius: 99 }}>Crítico</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", background: "rgba(245,166,35,0.1)", padding: "3px 8px", borderRadius: 99 }}>Alerta</span>
                        )}
                      </td>
                      
                      {/* Alert Type */}
                      <td style={{ padding: "14px 18px", fontFamily: "DM Sans" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{typeMeta.label}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{typeMeta.description}</div>
                      </td>

                      {/* Driver */}
                      <td style={{ padding: "14px 18px", fontFamily: "DM Sans" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{f.driver_name}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{f.driver_email}</div>
                      </td>

                      {/* Client */}
                      <td style={{ padding: "14px 18px", fontFamily: "DM Sans" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{f.client_name}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{f.client_email}</div>
                      </td>

                      {/* Resolution State */}
                      <td style={{ padding: "14px 18px", fontFamily: "DM Sans" }}>
                        {f.resolved_at ? (
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#0DB87E", display: "block" }}>Resolvido</span>
                            <span style={{ fontSize: 10, color: "#94A3B8" }}>por {f.resolved_by_name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#F5A623" }}>Pendente</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setSelectedFlag(f)}
                            style={{
                              height: 30,
                              padding: "0 10px",
                              borderRadius: 6,
                              background: "rgba(43,110,232,0.1)",
                              color: "#2B6EE8",
                              border: "none",
                              fontFamily: "DM Sans",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <Eye size={12} /> Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Details & Resolution Modal */}
      {selectedFlag && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyBetween: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Auditoria de Alerta Antifraude
              </h3>
              <button onClick={() => setSelectedFlag(null)} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>
                <X size={20} color="#475569" />
              </button>
            </div>

            {/* Meta info boxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#64748B" }}>ID da Corrida:</span>
                <span style={{ fontFamily: "monospace", color: "#334155" }}>{selectedFlag.ride_id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#64748B" }}>Alerta:</span>
                <span style={{ fontWeight: 600, color: "#0F172A" }}>{TYPE_LABELS[selectedFlag.flag_type]?.label || selectedFlag.flag_type}</span>
              </div>

              {/* Dynamic Metadata Details */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>Dados de Telemetria</div>
                <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(selectedFlag.metadata, null, 2)}
                </pre>
              </div>
            </div>

            {/* Resolution Form or Result */}
            {selectedFlag.resolved_at ? (
              <div style={{ background: "rgba(13,184,126,0.06)", border: "1px solid rgba(13,184,126,0.2)", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0DB87E", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  <Check size={16} /> Resolvido por Auditoria
                </div>
                <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                  <strong>Notas:</strong> {selectedFlag.resolution_notes}
                </p>
                <span style={{ display: "block", fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
                  Resolvido em {new Date(selectedFlag.resolved_at).toLocaleString("pt-BR")} por {selectedFlag.resolved_by_name}
                </span>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Notas de Resolução / Parecer da Auditoria
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Justifique a aprovação ou bloqueio permanente do saque..."
                  style={{
                    width: "100%",
                    height: 80,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 13,
                    fontFamily: "DM Sans",
                    outline: "none",
                    resize: "none",
                    marginBottom: 16
                  }}
                />

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setSelectedFlag(null)}
                    style={{ flex: 1, height: 40, border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans" }}
                  >
                    Voltar
                  </button>
                  <button
                    disabled={!resolutionNotes.trim() || submitting}
                    onClick={handleResolveFlag}
                    style={{
                      flex: 1,
                      height: 40,
                      background: !resolutionNotes.trim() || submitting ? "#94A3B8" : "#0DB87E",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: !resolutionNotes.trim() || submitting ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontFamily: "DM Sans",
                      fontWeight: 600
                    }}
                  >
                    {submitting ? "Salvando..." : "Resolver e Desbloquear"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
