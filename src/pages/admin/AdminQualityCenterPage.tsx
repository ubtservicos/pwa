import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  X,
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { QualityRunnerService, QualityRunSummary, TestResultItem } from "@/services/QualityRunnerService";
import { E2ECertificationService, E2ESuiteRunSummary } from "@/services/E2ECertificationService";
import { useCan } from "@/hooks/usePermissions";

const CATEGORIES = [
  "Todas",
  "Acesso & Conta",
  "Prestadores & KYC",
  "Mototáxi",
  "Ambulantes",
  "Diaristas",
  "Côco & Cia",
  "Financeiro",
  "Analytics",
  "Administração",
  "Resiliência",
  "Configuração",
  "Banco & Infra",
  "Storage",
  "Realtime",
  "RPCs",
  "RBAC",
];

const SEAL_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  "Enterprise Ready": { bg: "rgba(13,184,126,0.20)", color: "#0DB87E", border: "rgba(13,184,126,0.50)" },
  "Production Ready": { bg: "rgba(13,184,126,0.15)", color: "#0DB87E", border: "rgba(13,184,126,0.40)" },
  "Pilot Ready": { bg: "rgba(43,110,232,0.15)", color: "#2B6EE8", border: "rgba(43,110,232,0.40)" },
  "Attention Required": { bg: "rgba(245,166,35,0.15)", color: "#F5A623", border: "rgba(245,166,35,0.40)" },
  "Critical Issues": { bg: "rgba(232,64,64,0.15)", color: "#E84040", border: "rgba(232,64,64,0.40)" },
};

export default function AdminQualityCenterPage() {
  const toast = useAdminToast();
  const canExecute = useCan("quality.execute");

  const [summary, setSummary] = useState<QualityRunSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedStatus, setSelectedStatus] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTestModal, setSelectedTestModal] = useState<TestResultItem | null>(null);

  const fetchLatestSummary = useCallback(async () => {
    try {
      setLoading(true);
      const { data: rpcData, error } = await supabase.rpc("get_latest_quality_summary");
      if (error) throw error;

      if (rpcData && rpcData.has_run && rpcData.run) {
        setSummary({
          ...rpcData.run,
          tests: rpcData.tests || [],
        });
      }
    } catch (err: any) {
      console.error("Erro ao buscar resumo do Quality Center:", err);
      toast.show("Erro ao carregar diagnósticos de qualidade.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLatestSummary();
  }, [fetchLatestSummary]);

  const handleExecuteDiagnosticSuite = async () => {
    if (running) return;
    setRunning(true);
    toast.show("Executando suíte completa de diagnósticos técnicos...");
    try {
      const runRes = await QualityRunnerService.executeDiagnosticSuite();
      setSummary(runRes);
      toast.show(`Validação concluída! Selo atribuído: ${runRes.selo} (Score ${runRes.score}%) ✓`);
    } catch (err: any) {
      console.error("Erro durante a execução do Quality Center:", err);
      toast.show("Erro ao executar diagnóstico técnico.");
    } finally {
      setRunning(false);
    }
  };

  const handleExecuteE2ESuite = async () => {
    if (running) return;
    setRunning(true);
    toast.show("Iniciando Certificação Funcional End-to-End (E2E) em 11 domínios...");
    try {
      const e2eRes = await E2ECertificationService.runFullSuite();
      toast.show(`Certificação E2E Concluída! Índice de Prontidão: ${e2eRes.readinessIndexPercent}% (${e2eRes.classification}) ★`);
      fetchLatestSummary();
    } catch (err: any) {
      console.error("Erro na certificação E2E:", err);
      toast.show("Erro ao executar certificação E2E.");
    } finally {
      setRunning(false);
    }
  };

  const filteredTests = useMemo(() => {
    if (!summary?.tests) return [];
    return summary.tests.filter((t) => {
      const catMatch = selectedCategory === "Todas" || t.categoria.toLowerCase() === selectedCategory.toLowerCase();
      const statusMatch = selectedStatus === "Todas" || t.status === selectedStatus;
      const searchMatch =
        !searchQuery ||
        t.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.mensagem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.categoria.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && statusMatch && searchMatch;
    });
  }, [summary, selectedCategory, selectedStatus, searchQuery]);

  const exportCsv = () => {
    if (!summary || summary.tests.length === 0) {
      toast.show("Nenhum teste para exportar.");
      return;
    }
    const headers = "Codigo,Nome,Categoria,Status,DuracaoMS,Mensagem\n";
    const csvRows = summary.tests
      .map((t) => `"${t.codigo}","${t.nome}","${t.categoria}",${t.status},${t.duration_ms},"${t.mensagem.replace(/"/g, '""')}"`)
      .join("\n");

    const blob = new Blob([headers + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-quality-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Relatório de Certificação CSV exportado!");
  };

  const exportJson = () => {
    if (!summary) {
      toast.show("Nenhum relatório para exportar.");
      return;
    }
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-quality-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Exportação JSON de Certificação concluída!");
  };

  const sealStyle = summary?.selo ? SEAL_STYLES[summary.selo] || SEAL_STYLES["Attention Required"] : SEAL_STYLES["Pilot Ready"];

  return (
    <div style={{ padding: 32 }}>
      {/* Header with Seal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Quality Center
            </h1>
            {summary?.selo && (
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
                ★ {summary.selo}
              </span>
            )}
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", marginTop: 4 }}>
            Centro oficial de certificação técnica e validação pré-deploy do UBT SuperApp.
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
            onClick={handleExecuteDiagnosticSuite}
            disabled={running || !canExecute}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              background: "#0DB87E",
              color: "#fff",
              border: "none",
              fontFamily: "Syne",
              fontSize: 13,
              fontWeight: 700,
              cursor: running || !canExecute ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: running || !canExecute ? 0.7 : 1,
            }}
          >
            <Play size={15} className={running ? "animate-spin" : ""} />
            {running ? "Executando..." : "Diagnóstico Técnico"}
          </button>

          <button
            type="button"
            onClick={handleExecuteE2ESuite}
            disabled={running || !canExecute}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              background: "#2B6EE8",
              color: "#fff",
              border: "none",
              fontFamily: "Syne",
              fontSize: 13,
              fontWeight: 700,
              cursor: running || !canExecute ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: running || !canExecute ? 0.7 : 1,
            }}
          >
            <Zap size={15} className={running ? "animate-spin" : ""} />
            {running ? "Certificando E2E..." : "Certificação E2E"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 28 }}>
        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Score Geral</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 800, color: (summary?.score || 0) >= 90 ? "#0DB87E" : (summary?.score || 0) >= 75 ? "#2B6EE8" : "#E84040", marginTop: 4 }}>
            {summary ? `${summary.score}%` : "—"}
          </div>
          {summary && (
            <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#F1F5F9", marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: `${summary.score}%`, height: "100%", background: (summary?.score || 0) >= 90 ? "#0DB87E" : "#2B6EE8", transition: "width 500ms" }} />
            </div>
          )}
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Testes Passaram</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
            {summary ? summary.passed_tests : 0} <span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>/ {summary?.total_tests || 0}</span>
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Testes Falharam</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: (summary?.failed_tests || 0) > 0 ? "#E84040" : "#0DB87E", marginTop: 4 }}>
            {summary ? summary.failed_tests : 0}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Duração da Suíte</span>
          <div style={{ fontFamily: "Syne", fontSize: 32, fontWeight: 700, color: "#2B6EE8", marginTop: 4 }}>
            {summary ? `${summary.duration_ms}ms` : "0ms"}
          </div>
        </Card>
      </div>

      {/* Filters Card */}
      <Card style={{ padding: 18, marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Buscar verificação por código, nome ou mensagem..."
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
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Status:</span>
            {["Todas", "passed", "failed", "warning"].map((st) => {
              const sel = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
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
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>Módulos:</span>
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

      {/* Results Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
            Resultado das Verificações ({filteredTests.length})
          </span>
          {summary?.created_at && (
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B" }}>
              Última execução: {new Date(summary.created_at).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            Carregando diagnósticos de certificação técnica...
          </div>
        ) : filteredTests.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
            <CheckCircle2 size={36} color="#0DB87E" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: 0 }}>Nenhuma execução encontrada.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Clique em "Executar Suíte de Testes" para iniciar o diagnóstico.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Módulo</th>
                  <th style={{ padding: "12px 16px" }}>Nome do Teste</th>
                  <th style={{ padding: "12px 16px" }}>Resultado / Mensagem</th>
                  <th style={{ padding: "12px 16px" }}>Tempo</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((t) => (
                  <tr key={t.codigo} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      {t.status === "passed" ? (
                        <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">PASSED</Pill>
                      ) : t.status === "warning" ? (
                        <Pill bg="rgba(245,166,35,0.12)" color="#D97706" size="sm">WARN</Pill>
                      ) : (
                        <Pill bg="rgba(232,64,64,0.12)" color="#E84040" size="sm">FAILED</Pill>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#475569" }}>
                        {t.categoria}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t.nome}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>{t.codigo}</div>
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 380 }}>
                      <div style={{ fontSize: 13, color: t.status === "failed" ? "#E84040" : "#475569" }}>
                        {t.mensagem}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748B", fontFamily: "monospace" }}>
                      {t.duration_ms}ms
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTestModal(t)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #E2E8F0",
                          background: "#fff",
                          color: "#475569",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Test Detail Modal */}
      {selectedTestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 520, padding: 24, position: "relative" }}>
            <button
              onClick={() => setSelectedTestModal(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="#64748B" />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {selectedTestModal.status === "passed" ? (
                <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">PASSED</Pill>
              ) : (
                <Pill bg="rgba(232,64,64,0.12)" color="#E84040" size="sm">FAILED</Pill>
              )}
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{selectedTestModal.categoria}</span>
            </div>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>
              {selectedTestModal.nome}
            </h3>
            <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace", display: "block", marginBottom: 12 }}>
              {selectedTestModal.codigo} · Duração: {selectedTestModal.duration_ms}ms
            </span>

            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>Resultado:</span>
              <p style={{ fontSize: 13, color: "#0F172A", margin: 0, fontFamily: "DM Sans" }}>
                {selectedTestModal.mensagem}
              </p>
            </div>

            {selectedTestModal.detalhes && Object.keys(selectedTestModal.detalhes).length > 0 && (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>Detalhes Técnicos:</span>
                <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#334155" }}>
                  {JSON.stringify(selectedTestModal.detalhes, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <GhostButton onClick={() => setSelectedTestModal(null)}>Fechar</GhostButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
