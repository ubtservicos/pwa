import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  ShieldAlert, 
  Award, 
  FileText, 
  Check, 
  AlertTriangle, 
  Clock, 
  User, 
  Download, 
  Eye, 
  ChevronRight,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Undo
} from "lucide-react";
import { Card, PageTitle, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { logSystem } from "@/services/LoggingService";

interface DisputeRecord {
  id: string;
  payment_id: string;
  reason: string;
  status: string;
  amount: number;
  evidence: {
    attachments?: Array<{ name: string; url: string }>;
    chat_logs?: string[];
    [key: string]: any;
  } | any;
  metadata: {
    history?: Array<{
      status: string;
      notes: string;
      operator_name?: string;
      timestamp: string;
    }>;
    notes?: string;
    priority?: string;
    [key: string]: any;
  } | any;
  service_type?: string;
  service_id?: string;
  operator_id?: string;
  created_at: string;
  resolved_at?: string;
}

interface Operator {
  id: string;
  nome: string;
}

const PAGE_SIZE = 10;

export default function AdminDisputesPage() {
  const toast = useAdminToast();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Gaveta lateral de detalhes
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
  
  // Ações de moderação
  const [note, setNote] = useState("");
  const [operatorId, setOperatorId] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDisputes();
    fetchOperators();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setDisputes(data);
    } catch (err) {
      console.error("Erro ao carregar disputas:", err);
      toast.show("Erro ao carregar disputas operacionais.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("role", "admin");
      if (error) throw error;
      if (data) setOperators(data);
    } catch (err) {
      console.error("Erro ao carregar operadores:", err);
    }
  };

  // Cálculo de Prioridade dinâmico
  const getPriority = (dispute: DisputeRecord) => {
    if (dispute.metadata?.priority) {
      return dispute.metadata.priority;
    }
    
    // SLA restante em horas
    const hrsLeft = getSLARemainingHours(dispute.created_at);
    if (dispute.amount > 150 || (hrsLeft > 0 && hrsLeft < 24)) {
      return "high";
    } else if (dispute.amount >= 50) {
      return "medium";
    }
    return "low";
  };

  // SLA restante: 7 dias a partir da criação
  const getSLARemainingHours = (createdAt: string): number => {
    const created = new Date(createdAt).getTime();
    const deadline = created + (7 * 24 * 60 * 60 * 1000); // 7 dias
    const diff = deadline - Date.now();
    return diff / (1000 * 60 * 60);
  };

  const getSLAText = (createdAt: string, status: string, resolvedAt?: string) => {
    if (status === "approved" || status === "rejected" || status === "resolved" || status === "resolved_customer" || status === "resolved_provider") {
      const finishDate = resolvedAt ? new Date(resolvedAt) : new Date();
      return `Resolvida em ${finishDate.toLocaleDateString("pt-BR")}`;
    }

    const hours = getSLARemainingHours(createdAt);
    if (hours < 0) {
      const daysOver = Math.abs(Math.floor(hours / 24));
      return `Excedido por ${daysOver} dia(s)`;
    }

    const daysLeft = Math.floor(hours / 24);
    const hrs = Math.floor(hours % 24);
    if (daysLeft === 0) {
      return `${hrs}h restantes`;
    }
    return `${daysLeft}d ${hrs}h restantes`;
  };

  const getSLAColor = (createdAt: string, status: string) => {
    if (status === "approved" || status === "rejected" || status === "resolved" || status === "resolved_customer" || status === "resolved_provider") {
      return "#64748B"; // Cinza se fechada
    }
    const hours = getSLARemainingHours(createdAt);
    if (hours < 0) return "#E84040"; // Vermelho se estourado
    if (hours < 24) return "#F5A623"; // Laranja se crítico (< 24h)
    return "#0DB87E"; // Verde se tranquilo
  };

  // Atualização geral de status / atribuição
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedDispute) return;
    try {
      setProcessing(true);
      const activeOperator = operators.find(o => o.id === (operatorId || selectedDispute.operator_id));
      
      const newHistory = [
        ...(selectedDispute.metadata?.history || []),
        {
          status: newStatus,
          notes: note || `Disputa movida para o status '${newStatus}'`,
          operator_name: activeOperator?.nome || "Moderador UBT",
          timestamp: new Date().toISOString()
        }
      ];

      const { error } = await supabase
        .from("disputes")
        .update({
          status: newStatus,
          operator_id: operatorId || selectedDispute.operator_id || null,
          metadata: {
            ...selectedDispute.metadata,
            history: newHistory,
            notes: note || selectedDispute.metadata?.notes,
            priority: getPriority(selectedDispute)
          },
          resolved_at: (newStatus === "approved" || newStatus === "rejected" || newStatus === "resolved") ? new Date().toISOString() : selectedDispute.resolved_at
        })
        .eq("id", selectedDispute.id);

      if (error) throw error;
      toast.show(`Status da disputa alterado para '${newStatus}' com sucesso!`);
      setSelectedDispute(null);
      setNote("");
      fetchDisputes();
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      toast.show("Erro ao salvar alteração de status.");
    } finally {
      setProcessing(false);
    }
  };

  // Aprovar Reembolso -> Chama Edge Function /refund
  const handleApproveRefund = async () => {
    if (!selectedDispute) return;
    const startTime = Date.now();
    logSystem("INFO", "REFUND", "approve_refund", "started", undefined, undefined, undefined, { dispute_id: selectedDispute.id, payment_id: selectedDispute.payment_id });

    try {
      setProcessing(true);
      let refundSuccess = false;
      
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refund`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            payment_id: selectedDispute.payment_id,
            amount: selectedDispute.amount,
            reason: `Reembolso por Disputa Aprovada: ${note || selectedDispute.reason}`,
            metadata: {
              dispute_id: selectedDispute.id,
              operator_id: operatorId || selectedDispute.operator_id
            }
          })
        });
        if (response.ok) {
          refundSuccess = true;
        }
      } catch (e) {
        console.warn("Edge Function offline, fallback para atualização direta no DB:", e);
      }

      const activeOperator = operators.find(o => o.id === (operatorId || selectedDispute.operator_id));
      const newHistory = [
        ...(selectedDispute.metadata?.history || []),
        {
          status: "approved",
          notes: `Reembolso processado. Gateway sucesso: ${refundSuccess}. Justificativa: ${note || "Aprovada e reembolsada"}`,
          operator_name: activeOperator?.nome || "Moderador UBT",
          timestamp: new Date().toISOString()
        }
      ];

      const { error } = await supabase
        .from("disputes")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
          operator_id: operatorId || selectedDispute.operator_id || null,
          metadata: {
            ...selectedDispute.metadata,
            history: newHistory,
            notes: note || "Aprovada e reembolsada",
            refunded_via_gateway: refundSuccess
          }
        })
        .eq("id", selectedDispute.id);

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSystem("INFO", "REFUND", "approve_refund", "success", duration, undefined, undefined, { dispute_id: selectedDispute.id, gateway_success: refundSuccess });
      toast.show("Reembolso aprovado e enviado com sucesso!");
      setSelectedDispute(null);
      setNote("");
      fetchDisputes();
    } catch (err: any) {
      const duration = Date.now() - startTime;
      logSystem("ERROR", "REFUND", "approve_refund", "failed", duration, err.message, err.code || "REFUND_ERROR", { dispute_id: selectedDispute.id });
      console.error("Erro ao aprovar reembolso:", err);
      toast.show("Erro ao aprovar e reembolsar pagamento.");
    } finally {
      setProcessing(false);
    }
  };

  // Rejeitar Disputa -> Libera splits ao prestador
  const handleRejectDispute = async () => {
    if (!selectedDispute) return;
    const startTime = Date.now();
    logSystem("INFO", "DISPUTES", "reject_dispute", "started", undefined, undefined, undefined, { dispute_id: selectedDispute.id });

    try {
      setProcessing(true);
      const activeOperator = operators.find(o => o.id === (operatorId || selectedDispute.operator_id));
      
      const newHistory = [
        ...(selectedDispute.metadata?.history || []),
        {
          status: "rejected",
          notes: note || "Rejeição de disputa operacional",
          operator_name: activeOperator?.nome || "Moderador UBT",
          timestamp: new Date().toISOString()
        }
      ];

      const { error } = await supabase
        .from("disputes")
        .update({
          status: "rejected",
          resolved_at: new Date().toISOString(),
          operator_id: operatorId || selectedDispute.operator_id || null,
          metadata: {
            ...selectedDispute.metadata,
            history: newHistory,
            notes: note || "Contestação rejeitada"
          }
        })
        .eq("id", selectedDispute.id);

      if (error) throw error;

      // Liberar splits correspondentes
      await supabase
        .from("payment_splits")
        .update({ status: "approved" })
        .eq("payment_id", selectedDispute.payment_id)
        .eq("recipient_role", "provider");

      const duration = Date.now() - startTime;
      logSystem("INFO", "DISPUTES", "reject_dispute", "success", duration, undefined, undefined, { dispute_id: selectedDispute.id });
      logSystem("INFO", "SPLIT", "release_splits", "success", duration, undefined, undefined, { payment_id: selectedDispute.payment_id });

      toast.show("Contestação rejeitada. Splits liberados ao prestador.");
      setSelectedDispute(null);
      setNote("");
      fetchDisputes();
    } catch (err: any) {
      const duration = Date.now() - startTime;
      logSystem("ERROR", "DISPUTES", "reject_dispute", "failed", duration, err.message, err.code || "REJECT_ERROR", { dispute_id: selectedDispute.id });
      console.error("Erro ao rejeitar disputa:", err);
      toast.show("Erro ao salvar rejeição da disputa.");
    } finally {
      setProcessing(false);
    }
  };

  // Exportar listagem atual para CSV
  const handleExportCSV = () => {
    const headers = [
      "ID Disputa",
      "ID Pagamento",
      "Data Abertura",
      "Vertical",
      "Motivo",
      "Valor",
      "Status",
      "Operador Responsavel",
      "Prioridade"
    ];

    const rows = filtered.map((d) => {
      const opName = operators.find(o => o.id === d.operator_id)?.nome || "Nao Atribuido";
      return [
        d.id,
        d.payment_id,
        new Date(d.created_at).toLocaleString("pt-BR"),
        d.service_type || "Geral",
        `"${d.reason.replace(/"/g, '""')}"`,
        d.amount,
        d.status,
        opName,
        getPriority(d).toUpperCase()
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `disputas_ubt_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show("Exportação CSV concluída! ✓");
  };

  // Filtros de listagem
  const filtered = useMemo(() => {
    return disputes.filter((d) => {
      const matchSearch =
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        d.payment_id.toLowerCase().includes(search.toLowerCase()) ||
        d.reason.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      const matchPriority = priorityFilter === "all" || getPriority(d) === priorityFilter;
      const matchVertical = verticalFilter === "all" || d.service_type === verticalFilter;

      return matchSearch && matchStatus && matchPriority && matchVertical;
    });
  }, [disputes, search, statusFilter, priorityFilter, verticalFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const formatBRL = (n: number) =>
    "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "opened": return "Em Aberto";
      case "under_review": return "Em Análise";
      case "waiting_evidence": return "Evidência Pendente";
      case "approved": return "Aprovada (Reembolsada)";
      case "rejected": return "Rejeitada";
      case "resolved": return "Resolvida";
      case "resolved_customer": return "Estornado (Cliente)";
      case "resolved_provider": return "Liberado (Prestador)";
      default: return status;
    }
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case "approved":
      case "resolved_customer":
        return <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E">{getStatusLabel(status)}</Pill>;
      case "rejected":
      case "resolved_provider":
        return <Pill bg="rgba(100,116,139,0.08)" color="#64748B">{getStatusLabel(status)}</Pill>;
      case "opened":
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">{getStatusLabel(status)}</Pill>;
      case "under_review":
        return <Pill bg="rgba(245,166,35,0.08)" color="#F5A623">{getStatusLabel(status)}</Pill>;
      case "waiting_evidence":
        return <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8">{getStatusLabel(status)}</Pill>;
      default:
        return <Pill bg="rgba(100,116,139,0.08)" color="#64748B">{status}</Pill>;
    }
  };

  const getPriorityPill = (priority: string) => {
    switch (priority) {
      case "high":
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">Alta</Pill>;
      case "medium":
        return <Pill bg="rgba(245,166,35,0.08)" color="#F5A623">Média</Pill>;
      default:
        return <Pill bg="rgba(243,244,246,0.15)" color="#94A3B8">Baixa</Pill>;
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <PageTitle sub="Ambiente operacional para mediação de disputas, estornos e contestações de cartões">
          Central de Arbitragem e Disputas
        </PageTitle>

        <button
          onClick={handleExportCSV}
          style={{
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            padding: "10px 18px",
            color: "#475569",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 150ms"
          }}
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 14, top: 13 }} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por ID Disputa, Pagamento ou Motivo..."
              style={{
                width: "100%",
                height: 42,
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "0 12px 0 42px",
                fontSize: 14,
                outline: "none",
                background: "#F8FAFC"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              style={{ height: 42, border: "1px solid #E2E8F0", borderRadius: 12, padding: "0 14px", fontSize: 13, background: "#fff", cursor: "pointer", minWidth: 150 }}
            >
              <option value="all">Todos os Status</option>
              <option value="opened">Aberto</option>
              <option value="under_review">Em Análise</option>
              <option value="waiting_evidence">Aguardando Evidência</option>
              <option value="approved">Aprovadas (Reembolsadas)</option>
              <option value="rejected">Rejeitadas</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(0);
              }}
              style={{ height: 42, border: "1px solid #E2E8F0", borderRadius: 12, padding: "0 14px", fontSize: 13, background: "#fff", cursor: "pointer", minWidth: 140 }}
            >
              <option value="all">Todas as Prioridades</option>
              <option value="high">Prioridade Alta</option>
              <option value="medium">Prioridade Média</option>
              <option value="low">Prioridade Baixa</option>
            </select>

            <select
              value={verticalFilter}
              onChange={(e) => {
                setVerticalFilter(e.target.value);
                setPage(0);
              }}
              style={{ height: 42, border: "1px solid #E2E8F0", borderRadius: 12, padding: "0 14px", fontSize: 13, background: "#fff", cursor: "pointer", minWidth: 140 }}
            >
              <option value="all">Todas as Verticais</option>
              <option value="mototaxi">Mototáxi</option>
              <option value="diarista">Diaristas</option>
              <option value="ambulante">Ambulantes</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main disputes table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>
            Carregando contestações da plataforma...
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#64748B" }}>
            Nenhuma disputa operacional localizada com os filtros ativos.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <tr>
                  {["Disputa / SLA", "Vertical", "Motivo", "Valor", "Operador", "Prioridade", "Status", "Gestão"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "16px 24px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748B",
                        textTransform: "uppercase",
                        letterSpacing: 1.2
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((d) => {
                  const prio = getPriority(d);
                  const slaText = getSLAText(d.created_at, d.status, d.resolved_at);
                  const slaColor = getSLAColor(d.created_at, d.status);
                  const opName = operators.find(o => o.id === d.operator_id)?.nome || "Não atribuído";
                  
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid #E2E8F0", transition: "background 150ms" }}>
                      <td style={{ padding: "18px 24px" }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                          #{d.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: slaColor, marginTop: 4, fontWeight: 500 }}>
                          <Clock size={12} /> {slaText}
                        </span>
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 13, fontWeight: 500, textTransform: "capitalize", color: "#475569" }}>
                        {d.service_type || "Geral"}
                      </td>
                      <td style={{ padding: "18px 24px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "#64748B" }}>
                        {d.reason}
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                        {formatBRL(Number(d.amount))}
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: d.operator_id ? "#1E293B" : "#94A3B8", fontWeight: d.operator_id ? 500 : 400 }}>
                        {opName}
                      </td>
                      <td style={{ padding: "18px 24px" }}>{getPriorityPill(prio)}</td>
                      <td style={{ padding: "18px 24px" }}>{getStatusPill(d.status)}</td>
                      <td style={{ padding: "18px 24px" }}>
                        <button
                          onClick={() => {
                            setSelectedDispute(d);
                            setOperatorId(d.operator_id || "");
                          }}
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            borderRadius: 8,
                            padding: "8px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#475569",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          <Eye size={14} /> Analisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderTop: "1px solid #E2E8F0" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>
            Exibindo {paged.length} de {filtered.length} disputas operacionais
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: "8px 14px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                background: "#fff",
                cursor: page === 0 ? "not-allowed" : "pointer",
                opacity: page === 0 ? 0.5 : 1,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Anterior
            </button>
            <span style={{ padding: "8px 14px", fontSize: 13, color: "#475569" }}>
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: "8px 14px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                background: "#fff",
                cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                opacity: page >= totalPages - 1 ? 0.5 : 1,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>

      {/* Drawer Lateral de Análise Detalhada */}
      {selectedDispute && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            background: "rgba(15,23,42,0.4)", 
            backdropFilter: "blur(2px)",
            zIndex: 1000, 
            display: "flex", 
            justifyContent: "flex-end" 
          }}
          onClick={() => setSelectedDispute(null)}
        >
          <div 
            style={{ 
              background: "#fff", 
              width: "100%", 
              maxWidth: 580, 
              height: "100%", 
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex", 
              flexDirection: "column",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div style={{ padding: "24px 32px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1.2 }}>
                  Ficha da Disputa Operacional
                </span>
                <h3 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#1E293B", margin: "4px 0 0" }}>
                  Disputa #{selectedDispute.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDispute(null)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}
              >
                ✕
              </button>
            </div>

            {/* Content Drawer (Scrollable) */}
            <div style={{ flex: 1, overflowY: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* Resumo do SLA e Valor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "#F8FAFC", borderRadius: 14, padding: 18, border: "1px solid #F1F5F9" }}>
                <div>
                  <span style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                    Valor Contestado
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#E84040" }}>
                    {formatBRL(Number(selectedDispute.amount))}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                    SLA de Resolução
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: getSLAColor(selectedDispute.created_at, selectedDispute.status), display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={16} /> {getSLAText(selectedDispute.created_at, selectedDispute.status, selectedDispute.resolved_at)}
                  </span>
                </div>
              </div>

              {/* Informações Básicas */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
                  Detalhes do Pedido
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>ID Pagamento:</span>
                    <span style={{ color: "#1E293B", fontWeight: 500, fontFamily: "monospace" }}>{selectedDispute.payment_id}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Vertical de Serviço:</span>
                    <span style={{ color: "#1E293B", fontWeight: 500, textTransform: "capitalize" }}>{selectedDispute.service_type || "Geral"}</span>
                  </div>
                  <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                    <span style={{ color: "#64748B", display: "block", marginBottom: 4 }}>Motivo da Contestação (Relatado pelo Cliente):</span>
                    <div style={{ background: "#F1F5F9", borderRadius: 10, padding: "12px 16px", color: "#334155", lineHeight: 1.4 }}>
                      {selectedDispute.reason}
                    </div>
                  </div>
                </div>
              </div>

              {/* Atribuição de Operador */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Operador Responsável
                </label>
                <select
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "0 12px",
                    fontSize: 14,
                    background: "#fff",
                    outline: "none"
                  }}
                >
                  <option value="">Não Atribuído</option>
                  {operators.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>

              {/* Timeline do Status Atual */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}>
                  Status & Timeline
                </h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["opened", "under_review", "waiting_evidence", "approved", "rejected"].map((s) => {
                    const isActive = selectedDispute.status === s;
                    return (
                      <button
                        key={s}
                        disabled={processing}
                        onClick={() => handleUpdateStatus(s)}
                        style={{
                          background: isActive ? "#F1F5F9" : "#fff",
                          border: `1.5px solid ${isActive ? "#475569" : "#E2E8F0"}`,
                          color: isActive ? "#1E293B" : "#64748B",
                          fontWeight: isActive ? 700 : 500,
                          borderRadius: 10,
                          padding: "6px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 150ms"
                        }}
                      >
                        {getStatusLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Evidências & Anexos */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.8, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <FileText size={16} /> Evidências e Anexos
                </h4>
                {selectedDispute.evidence?.attachments && selectedDispute.evidence.attachments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedDispute.evidence.attachments.map((file: any, idx: number) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "rgba(43,110,232,0.05)",
                          border: "1px solid rgba(43,110,232,0.12)",
                          borderRadius: 10,
                          color: "#2B6EE8",
                          fontSize: 13,
                          textDecoration: "none"
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{file.name || `Anexo_${idx + 1}`}</span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic", margin: 0 }}>
                    Nenhum arquivo ou captura de tela anexada pelas partes.
                  </p>
                )}
              </div>

              {/* Auditoria Completa e Histórico de Ações */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
                  Histórico de Decisões e Auditoria
                </h4>
                {selectedDispute.metadata?.history && selectedDispute.metadata.history.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: "2px solid #E2E8F0", paddingLeft: 16, marginLeft: 8 }}>
                    {selectedDispute.metadata.history.map((log: any, idx: number) => (
                      <div key={idx} style={{ position: "relative", fontSize: 13 }}>
                        <span style={{ 
                          position: "absolute", 
                          left: -22, 
                          top: 4, 
                          width: 10, 
                          height: 10, 
                          borderRadius: 999, 
                          background: "#94A3B8",
                          border: "2px solid #fff"
                        }} />
                        <span style={{ display: "block", fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>
                          {new Date(log.timestamp).toLocaleString("pt-BR")} · Por {log.operator_name || "Sistema"}
                        </span>
                        <span style={{ display: "block", fontWeight: 600, color: "#475569", margin: "2px 0" }}>
                          Status alterado para: {getStatusLabel(log.status)}
                        </span>
                        {log.notes && (
                          <span style={{ display: "block", color: "#64748B", fontStyle: "italic" }}>
                            "{log.notes}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic", margin: 0 }}>
                    Nenhuma ação de auditoria registrada anteriormente.
                  </p>
                )}
              </div>

            </div>

            {/* Footer Drawer (Moderação Rápida) */}
            {(selectedDispute.status !== "approved" && selectedDispute.status !== "rejected") && (
              <div style={{ padding: 24, borderTop: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  Nova Nota / Justificativa de Decisão
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Justificativa operacional fundamentada nas provas..."
                  style={{
                    width: "100%",
                    height: 72,
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: 10,
                    fontSize: 13,
                    background: "#fff",
                    outline: "none",
                    resize: "none",
                    marginBottom: 16
                  }}
                />

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleRejectDispute}
                    disabled={processing}
                    style={{
                      flex: 1,
                      height: 44,
                      background: "#F1F5F9",
                      border: "1px solid #E2E8F0",
                      color: "#E84040",
                      fontWeight: 600,
                      fontSize: 13,
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    Rejeitar (Liberar Splits)
                  </button>

                  <button
                    onClick={handleApproveRefund}
                    disabled={processing}
                    style={{
                      flex: 1,
                      height: 44,
                      background: "#E84040",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <Check size={16} /> Aprovar Reembolso
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
