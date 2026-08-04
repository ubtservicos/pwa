import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { HelpTooltip } from "@/components/admin/HelpTooltip";

export interface AuditLogItem {
  id: string;
  created_at: string;
  admin_id: string | null;
  admin_nome: string | null;
  admin_email: string | null;
  acao: string;
  categoria: string;
  modulo: string | null;
  entidade: string | null;
  registro_id: string | null;
  valor_anterior: any;
  valor_novo: any;
  motivo: string | null;
  ip: string | null;
  user_agent: string | null;
  session_id: string | null;
  resultado: string;
  criticidade: "INFO" | "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  metadata: any;
}

interface AuditSummaryKPIs {
  total_hoje: number;
  ultima_hora: number;
  criticas: number;
  falhas: number;
}

const CATEGORIES = [
  "Todas",
  "Financeiro",
  "Usuarios",
  "KYC",
  "Marketplace",
  "Conteudo",
  "Operacoes",
  "LGPD",
  "Sistema",
  "Seguranca",
  "Analytics",
];

const SEVERITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CRITICA: { bg: "rgba(232,64,64,0.12)", color: "#E84040", border: "rgba(232,64,64,0.30)" },
  ALTA: { bg: "rgba(245,166,35,0.12)", color: "#F5A623", border: "rgba(245,166,35,0.30)" },
  MEDIA: { bg: "rgba(43,110,232,0.12)", color: "#2B6EE8", border: "rgba(43,110,232,0.30)" },
  BAIXA: { bg: "rgba(13,184,126,0.12)", color: "#0DB87E", border: "rgba(13,184,126,0.30)" },
  INFO: { bg: "rgba(148,163,184,0.12)", color: "#64748B", border: "rgba(148,163,184,0.30)" },
};

const PAGE_SIZE = 15;

export default function AdminAuditPage() {
  const toast = useAdminToast();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [summary, setSummary] = useState<AuditSummaryKPIs>({
    total_hoje: 0,
    ultima_hora: 0,
    criticas: 0,
    falhas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSeverity, setSelectedSeverity] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLogModal, setSelectedLogModal] = useState<AuditLogItem | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const { data: sumRpc } = await supabase.rpc("get_admin_audit_logs_summary");
      if (sumRpc) setSummary(sumRpc as AuditSummaryKPIs);
    } catch (e) {
      console.error("Erro ao carregar resumo de auditoria:", e);
    }
  }, []);

  const fetchLogs = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setLoading(true);
      let query = supabase
        .from("admin_audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedCategory !== "Todas") {
        query = query.eq("categoria", selectedCategory);
      }

      if (selectedSeverity !== "Todas") {
        query = query.eq("criticidade", selectedSeverity);
      }

      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00Z`);
      }

      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59Z`);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`acao.ilike.${term},admin_nome.ilike.${term},admin_email.ilike.${term},entidade.ilike.${term},registro_id.ilike.${term}`);
      }

      const { data: logsData, count, error } = await query;
      if (error) throw error;

      if (logsData) {
        setLogs(logsData as AuditLogItem[]);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error("Erro ao buscar registros de auditoria:", err);
      toast.show("Erro ao carregar trilha de auditoria.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedCategory, selectedSeverity, startDate, endDate, searchQuery, toast]);

  useEffect(() => {
    fetchSummary();
    fetchLogs();

    // Realtime listener
    const channel = supabase
      .channel("admin_audit_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_audit_logs" }, () => {
        fetchSummary();
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSummary, fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const exportCsv = () => {
    if (logs.length === 0) {
      toast.show("Nenhum registro para exportar.");
      return;
    }
    const headers = "ID,Data,Operador,Email,Acao,Categoria,Entidade,RegistroID,Resultado,Criticidade\n";
    const csvRows = logs
      .map(
        (l) =>
          `${l.id},${l.created_at},"${l.admin_nome || ''}","${l.admin_email || ''}",${l.acao},${l.categoria},"${l.entidade || ''}","${l.registro_id || ''}",${l.resultado},${l.criticidade}`
      )
      .join("\n");

    const blob = new Blob([headers + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Relatório de Auditoria CSV exportado!");
  };

  const exportJson = () => {
    if (logs.length === 0) {
      toast.show("Nenhum registro para exportar.");
      return;
    }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Exportação JSON de Auditoria concluída!");
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Trilha de Auditoria administrativa imutável (compliance LGPD e rastreabilidade)">
        Auditoria & Compliance
      </PageTitle>

      {/* Warning banner */}
      <div
        style={{
          background: "rgba(13,184,126,0.06)",
          border: "1px solid rgba(13,184,126,0.18)",
          borderRadius: 12,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          fontFamily: "DM Sans",
        }}
      >
        <ShieldCheck size={20} color="#0DB87E" />
        <span style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
          <strong>Imutabilidade RLS Ativa:</strong> Esta trilha de auditoria é protegida contra alterações na API Supabase. Operações de modificação (`UPDATE`) ou exclusão (`DELETE`) são permanentemente bloqueadas no PostgreSQL.
        </span>
      </div>

      {/* KPI Cards Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
            Total Registrado Hoje
            <HelpTooltip concept="admin.audit.total_hoje" />
          </span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
            {summary.total_hoje}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Última Hora</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#2B6EE8", marginTop: 4 }}>
            {summary.ultima_hora}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
            Ações Críticas
            <HelpTooltip concept="admin.audit.acoes_criticas" />
          </span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: summary.criticas > 0 ? "#E84040" : "#0DB87E", marginTop: 4 }}>
            {summary.criticas}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Falhas de Operação</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: summary.falhas > 0 ? "#F5A623" : "#0DB87E", marginTop: 4 }}>
            {summary.falhas}
          </div>
        </Card>
      </div>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          {/* Start Date */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
              style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none" }}
            />
          </div>

          {/* End Date */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
              style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none" }}
            />
          </div>

          {/* Severity */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Criticidade</label>
            <select
              value={selectedSeverity}
              onChange={(e) => { setSelectedSeverity(e.target.value); setPage(0); }}
              style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none" }}
            >
              {["Todas", "CRITICA", "ALTA", "MEDIA", "BAIXA", "INFO"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Text Search */}
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Pesquisar Ação / Operador / Entidade</label>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: 12 }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Ação, Nome, Email, ID de registro..."
                style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px 0 34px", fontFamily: "DM Sans", fontSize: 13, outline: "none" }}
              />
            </div>
          </div>
        </div>

        {/* Category Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>Categorias:</span>
          {CATEGORIES.map((cat) => {
            const sel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { setSelectedCategory(cat); setPage(0); }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: sel ? "1px solid #0DB87E" : "1px solid #E2E8F0",
                  background: sel ? "rgba(13,184,126,0.12)" : "#F8FAFC",
                  color: sel ? "#0DB87E" : "#64748B",
                  fontFamily: "DM Sans",
                  fontSize: 12,
                  fontWeight: sel ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Main Table Card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              Registros Encontrados ({totalCount})
            </span>
            <Pill bg="rgba(71,85,105,0.08)" color="#475569" size="sm">
              Página {page + 1} de {totalPages}
            </Pill>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton onClick={exportCsv} style={{ padding: "5px 10px", fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FileSpreadsheet size={14} /> CSV
              </span>
            </GhostButton>
            <GhostButton onClick={exportJson} style={{ padding: "5px 10px", fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FileJson size={14} /> JSON
              </span>
            </GhostButton>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            Carregando trilha de auditoria...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            Nenhum evento registrado com os parâmetros informados.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans" }}>
              <thead style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <tr style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Criticidade</th>
                  <th style={{ padding: "12px 16px" }}>Horário</th>
                  <th style={{ padding: "12px 16px" }}>Operador</th>
                  <th style={{ padding: "12px 16px" }}>Categoria</th>
                  <th style={{ padding: "12px 16px" }}>Ação & Entidade</th>
                  <th style={{ padding: "12px 16px" }}>Resultado</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const sevStyle = SEVERITY_COLORS[log.criticidade] || SEVERITY_COLORS.INFO;
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 100ms" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: sevStyle.bg,
                            color: sevStyle.color,
                            border: `1px solid ${sevStyle.border}`,
                          }}
                        >
                          {log.criticidade}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
                        {new Date(log.created_at).toLocaleDateString("pt-BR")} às {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{log.admin_nome || "Sistema"}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{log.admin_email || "system@ubt"}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#475569" }}>
                          {log.categoria}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{log.acao}</div>
                        {log.entidade && (
                          <div style={{ fontSize: 11, color: "#64748B" }}>
                            {log.entidade} {log.registro_id ? `(#${log.registro_id.slice(0, 8)})` : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {log.resultado === "sucesso" ? (
                          <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">Sucesso</Pill>
                        ) : (
                          <Pill bg="rgba(232,64,64,0.12)" color="#E84040" size="sm">Falha</Pill>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLogModal(log)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: "1px solid #E2E8F0",
                            background: "#fff",
                            color: "#2B6EE8",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye size={14} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B" }}>
            Mostrando {logs.length} de {totalCount} eventos
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#0F172A", alignSelf: "center", fontWeight: 700 }}>
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>

      {/* Detail Modal (Diff view & metadata) */}
      {selectedLogModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}>
            <button
              onClick={() => setSelectedLogModal(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="#64748B" />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: SEVERITY_COLORS[selectedLogModal.criticidade]?.bg,
                  color: SEVERITY_COLORS[selectedLogModal.criticidade]?.color,
                }}
              >
                {selectedLogModal.criticidade}
              </span>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{selectedLogModal.categoria}</span>
            </div>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>
              {selectedLogModal.acao}
            </h3>

            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
              Executado por <strong>{selectedLogModal.admin_nome}</strong> ({selectedLogModal.admin_email}) em {new Date(selectedLogModal.created_at).toLocaleString("pt-BR")}
            </p>

            {/* Diff View: Valor Anterior vs Valor Novo */}
            {(selectedLogModal.valor_anterior || selectedLogModal.valor_novo) && (
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                  Comparativo de Alteração (Diff)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "rgba(232,64,64,0.04)", border: "1px solid rgba(232,64,64,0.15)", borderRadius: 8, padding: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#E84040", display: "block", marginBottom: 4 }}>Valor Anterior</span>
                    <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap" }}>
                      {selectedLogModal.valor_anterior ? JSON.stringify(selectedLogModal.valor_anterior, null, 2) : "—"}
                    </pre>
                  </div>
                  <div style={{ background: "rgba(13,184,126,0.04)", border: "1px solid rgba(13,184,126,0.15)", borderRadius: 8, padding: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0DB87E", display: "block", marginBottom: 4 }}>Valor Novo</span>
                    <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap" }}>
                      {selectedLogModal.valor_novo ? JSON.stringify(selectedLogModal.valor_novo, null, 2) : "—"}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Motivo */}
            {selectedLogModal.motivo && (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block" }}>Motivo Informado:</span>
                <span style={{ fontSize: 13, color: "#0F172A", fontFamily: "DM Sans" }}>{selectedLogModal.motivo}</span>
              </div>
            )}

            {/* Context Technical info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12, fontSize: 11, color: "#64748B", fontFamily: "monospace", marginBottom: 16 }}>
              <div>IP: {selectedLogModal.ip || "127.0.0.1"}</div>
              <div>Session ID: {selectedLogModal.session_id || "sess_live"}</div>
              <div style={{ gridColumn: "span 2" }}>User-Agent: {selectedLogModal.user_agent || "Desconhecido"}</div>
            </div>

            {/* Metadata */}
            {selectedLogModal.metadata && Object.keys(selectedLogModal.metadata).length > 0 && (
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 }}>Metadados Adicionais:</span>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12, overflowX: "auto" }}>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#334155" }}>
                    {JSON.stringify(selectedLogModal.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <GhostButton onClick={() => setSelectedLogModal(null)}>Fechar</GhostButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
