import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  X,
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { SecurityAuditService, SecurityFinding, SecuritySummaryData } from "@/services/SecurityAuditService";
import { useCan } from "@/hooks/usePermissions";
import { HelpTooltip } from "@/components/admin/HelpTooltip";

const CATEGORIES = [
  "Todas",
  "Autenticacao",
  "Autorizacao",
  "Banco de Dados",
  "Supabase",
  "Storage",
  "API",
  "Edge Functions",
  "Financeiro",
  "LGPD",
  "Telemetria",
  "Marketplace",
  "Infraestrutura",
];

const SEAL_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  "Production Secure": { bg: "rgba(13,184,126,0.15)", color: "#0DB87E", border: "rgba(13,184,126,0.40)" },
  "Pilot Secure": { bg: "rgba(43,110,232,0.15)", color: "#2B6EE8", border: "rgba(43,110,232,0.40)" },
  "Attention Required": { bg: "rgba(245,166,35,0.15)", color: "#F5A623", border: "rgba(245,166,35,0.40)" },
  "Critical Risk": { bg: "rgba(232,64,64,0.15)", color: "#E84040", border: "rgba(232,64,64,0.40)" },
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CRITICA: { bg: "rgba(232,64,64,0.12)", color: "#E84040", border: "rgba(232,64,64,0.30)" },
  ALTA: { bg: "rgba(245,166,35,0.12)", color: "#F5A623", border: "rgba(245,166,35,0.30)" },
  MEDIA: { bg: "rgba(43,110,232,0.12)", color: "#2B6EE8", border: "rgba(43,110,232,0.30)" },
  BAIXA: { bg: "rgba(13,184,126,0.12)", color: "#0DB87E", border: "rgba(13,184,126,0.30)" },
  INFO: { bg: "rgba(148,163,184,0.12)", color: "#64748B", border: "rgba(148,163,184,0.30)" },
};

export default function AdminSecurityCenterPage() {
  const toast = useAdminToast();
  const canResolve = useCan("security.resolve");

  const [data, setData] = useState<SecuritySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSeverity, setSelectedSeverity] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFindingModal, setSelectedFindingModal] = useState<SecurityFinding | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchSecuritySummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await SecurityAuditService.getSummary();
      if (res) setData(res);
    } catch (err: any) {
      console.error("Erro ao carregar Security Center:", err);
      toast.show("Erro ao carregar diagnósticos de segurança.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSecuritySummary();

    // Realtime subscription
    const channel = supabase
      .channel("security_findings_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "security_findings" }, () => {
        fetchSecuritySummary();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSecuritySummary]);

  const handleRunSecurityAudit = async () => {
    if (runningAudit) return;
    setRunningAudit(true);
    toast.show("Executando auditoria completa na superfície de ataque...");
    try {
      const ok = await SecurityAuditService.runAudit();
      if (ok) {
        await fetchSecuritySummary();
        toast.show("Auditoria de segurança concluída com sucesso! ✓");
      } else {
        toast.show("Erro ao processar auditoria de segurança.");
      }
    } finally {
      setRunningAudit(false);
    }
  };

  const handleResolveFinding = async (findingId: string) => {
    setResolvingId(findingId);
    try {
      const ok = await SecurityAuditService.resolveFinding(findingId, "Mitigação confirmada via Security Center");
      if (ok) {
        toast.show("Risco de segurança marcado como resolvido e registrado no Audit Log! ✓");
        setSelectedFindingModal(null);
        fetchSecuritySummary();
      } else {
        toast.show("Erro ao resolver risco de segurança.");
      }
    } finally {
      setResolvingId(null);
    }
  };

  const filteredFindings = useMemo(() => {
    if (!data?.findings) return [];
    return data.findings.filter((f) => {
      const catMatch = selectedCategory === "Todas" || f.categoria.toLowerCase() === selectedCategory.toLowerCase();
      const sevMatch = selectedSeverity === "Todas" || f.criticidade === selectedSeverity;
      const searchMatch =
        !searchQuery ||
        f.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.categoria.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && sevMatch && searchMatch;
    });
  }, [data, selectedCategory, selectedSeverity, searchQuery]);

  const exportCsv = () => {
    if (!data || data.findings.length === 0) {
      toast.show("Nenhum risco registrado para exportar.");
      return;
    }
    const headers = "ID,Categoria,Criticidade,Titulo,Descricao,Risco,Acao,Status\n";
    const csvRows = data.findings
      .map(
        (f) =>
          `${f.id},${f.categoria},${f.criticidade},"${f.titulo.replace(/"/g, '""')}","${f.descricao.replace(/"/g, '""')}",${f.risco || ''},"${(f.acao || '').replace(/"/g, '""')}",${f.status}`
      )
      .join("\n");

    const blob = new Blob([headers + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-security-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Relatório de Segurança CSV exportado!");
  };

  const exportJson = () => {
    if (!data) {
      toast.show("Nenhum relatório para exportar.");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-security-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Exportação JSON de Segurança concluída!");
  };

  const sealStyle = data?.selo ? SEAL_STYLES[data.selo] || SEAL_STYLES["Attention Required"] : SEAL_STYLES["Production Secure"];

  return (
    <div style={{ padding: 32 }}>
      {/* Header with Classification Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Security Center
            </h1>
            {data?.selo && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontFamily: "Syne",
                  fontSize: 12,
                  fontWeight: 800,
                  background: sealStyle.bg,
                  color: sealStyle.color,
                  border: `1px solid ${sealStyle.border}`,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                🛡️ {data.selo}
              </span>
            )}
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", marginTop: 4 }}>
            Monitoramento contínuo da superfície de ataque, riscos operacionais, financeiros e privacidade LGPD.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GhostButton onClick={exportCsv}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <FileSpreadsheet size={14} /> CSV
            </span>
          </GhostButton>
          <GhostButton onClick={exportJson}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <FileJson size={14} /> JSON
            </span>
          </GhostButton>
          <button
            type="button"
            onClick={handleRunSecurityAudit}
            disabled={runningAudit}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 10,
              background: "#0DB87E",
              color: "#fff",
              border: "none",
              fontFamily: "Syne",
              fontSize: 13,
              fontWeight: 700,
              cursor: runningAudit ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: runningAudit ? 0.7 : 1,
            }}
          >
            <ShieldCheck size={16} className={runningAudit ? "animate-spin" : ""} />
            {runningAudit ? "Escaneando..." : "Executar Auditoria de Segurança"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 28 }}>
        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
            Security Score
            <HelpTooltip concept="admin.security.score" />
          </span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 800, color: (data?.score || 0) >= 90 ? "#0DB87E" : (data?.score || 0) >= 75 ? "#2B6EE8" : "#E84040", marginTop: 4 }}>
            {data ? `${data.score}%` : "—"}
          </div>
          {data && (
            <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#F1F5F9", marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: `${data.score}%`, height: "100%", background: (data?.score || 0) >= 90 ? "#0DB87E" : "#2B6EE8", transition: "width 500ms" }} />
            </div>
          )}
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
            Riscos Críticos
            <HelpTooltip concept="admin.security.riscos_criticos" />
          </span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: (data?.riscos_criticos || 0) > 0 ? "#E84040" : "#0DB87E", marginTop: 4 }}>
            {data ? data.riscos_criticos : 0}
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", marginTop: 4, margin: 0 }}>Ação imediata requerida</p>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Riscos Médios / Baixos</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#F5A623", marginTop: 4 }}>
            {data ? data.riscos_medios + data.riscos_baixos : 0}
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", marginTop: 4, margin: 0 }}>Ocorrências monitoradas</p>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Riscos Resolvidos</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
            {data ? data.riscos_resolvidos : 0}
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", marginTop: 4, margin: 0 }}>Vulnerabilidades mitigadas</p>
        </Card>
      </div>

      {/* Filters Card */}
      <Card style={{ padding: 18, marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Buscar ocorrências de segurança por título, descrição ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                height: 40,
                paddingLeft: 38,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                fontFamily: "DM Sans",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Criticidade:</span>
            {["Todas", "CRITICA", "ALTA", "MEDIA", "BAIXA", "INFO"].map((sev) => {
              const sel = selectedSeverity === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSelectedSeverity(sev)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: sel ? "1px solid #0DB87E" : "1px solid #E2E8F0",
                    background: sel ? "rgba(13,184,126,0.12)" : "#fff",
                    color: sel ? "#0DB87E" : "#475569",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: sel ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>Superfície:</span>
          {CATEGORIES.map((cat) => {
            const sel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: sel ? "1px solid #2B6EE8" : "1px solid #E2E8F0",
                  background: sel ? "rgba(43,110,232,0.10)" : "#F8FAFC",
                  color: sel ? "#2B6EE8" : "#64748B",
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

      {/* Findings Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
            Ocorrências de Segurança ({filteredFindings.length})
          </span>
          <Pill bg="rgba(71,85,105,0.08)" color="#475569" size="sm">
            {selectedCategory} · {selectedSeverity}
          </Pill>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            Auditando superfície de ataque e políticas de segurança...
          </div>
        ) : filteredFindings.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            <ShieldCheck size={40} color="#0DB87E" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#334155", margin: 0 }}>Superfície de ataque segura!</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Nenhum risco de segurança aberto identificado com os parâmetros selecionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Criticidade</th>
                  <th style={{ padding: "12px 16px" }}>Superfície</th>
                  <th style={{ padding: "12px 16px" }}>Título & Detalhes</th>
                  <th style={{ padding: "12px 16px" }}>Nível de Risco</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((finding) => {
                  const sevStyle = SEVERITY_COLORS[finding.criticidade] || SEVERITY_COLORS.INFO;
                  const isResolved = finding.status === "resolved";
                  return (
                    <tr key={finding.id} style={{ borderBottom: "1px solid #F1F5F9", background: isResolved ? "#F8FAFC" : "#fff", opacity: isResolved ? 0.75 : 1 }}>
                      <td style={{ padding: "14px 16px" }}>
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
                          {finding.criticidade}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#475569" }}>
                          {finding.categoria}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", maxWidth: 360 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{finding.titulo}</div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{finding.descricao}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, fontWeight: 700, color: finding.risco === "ALTO" || finding.risco === "EXTREMO" ? "#E84040" : "#64748B" }}>
                        {finding.risco || "MEDIO"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {isResolved ? (
                          <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">Mitigado</Pill>
                        ) : (
                          <Pill bg="rgba(245,166,35,0.12)" color="#D97706" size="sm">Em Aberto</Pill>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedFindingModal(finding)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid #E2E8F0",
                              background: "#fff",
                              color: "#475569",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Ver Plano
                          </button>
                          {!isResolved && canResolve && (
                            <button
                              type="button"
                              onClick={() => handleResolveFinding(finding.id)}
                              disabled={resolvingId === finding.id}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "1px solid rgba(13,184,126,0.30)",
                                background: "#0DB87E",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Resolver
                            </button>
                          )}
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

      {/* Finding Remediation Detail Modal */}
      {selectedFindingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 540, padding: 24, position: "relative" }}>
            <button
              onClick={() => setSelectedFindingModal(null)}
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
                  background: SEVERITY_COLORS[selectedFindingModal.criticidade]?.bg,
                  color: SEVERITY_COLORS[selectedFindingModal.criticidade]?.color,
                }}
              >
                {selectedFindingModal.criticidade}
              </span>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{selectedFindingModal.categoria}</span>
            </div>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
              {selectedFindingModal.titulo}
            </h3>

            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
              {selectedFindingModal.descricao}
            </p>

            {selectedFindingModal.impacto && (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block" }}>Impacto Potencial:</span>
                <span style={{ fontSize: 13, color: "#0F172A", fontFamily: "DM Sans" }}>{selectedFindingModal.impacto}</span>
              </div>
            )}

            {selectedFindingModal.acao && (
              <div style={{ background: "rgba(13,184,126,0.06)", border: "1px solid rgba(13,184,126,0.20)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 700, color: "#0DB87E", textTransform: "uppercase" }}>Plano de Ação Recomendado</span>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#1E293B", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {selectedFindingModal.acao}
                </p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <GhostButton onClick={() => setSelectedFindingModal(null)}>Fechar</GhostButton>
              {selectedFindingModal.status !== "resolved" && canResolve && (
                <button
                  type="button"
                  onClick={() => handleResolveFinding(selectedFindingModal.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    background: "#0DB87E",
                    color: "#fff",
                    border: "none",
                    fontFamily: "Syne",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Confirmar Resolução
                </button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
