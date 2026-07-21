import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Check, X, Landmark, User, CreditCard } from "lucide-react";
import { Card, PageTitle, Pill, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface PayoutRecord {
  id: string;
  recipient_id: string;
  amount: number;
  status: string;
  gateway_payout_id?: string;
  created_at: string;
  paid_at?: string;
}

const PAGE_SIZE = 10;

export default function AdminPayoutsPage() {
  const toast = useAdminToast();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Manage Payout Modal
  const [selectedPayout, setSelectedPayout] = useState<PayoutRecord | null>(null);
  const [gatewayTxId, setGatewayTxId] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setPayouts(data);
    } catch (err) {
      console.error("Erro ao carregar payouts:", err);
      toast.show("Erro ao carregar solicitações de saque.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedPayout || !actionType) return;
    try {
      const newStatus = actionType === "approve" ? "paid" : "failed";
      const { error } = await supabase
        .from("payouts")
        .update({
          status: newStatus,
          gateway_payout_id: actionType === "approve" ? gatewayTxId : null,
          paid_at: actionType === "approve" ? new Date().toISOString() : null
        })
        .eq("id", selectedPayout.id);

      if (error) throw error;
      toast.show(actionType === "approve" ? "Saque confirmado com sucesso!" : "Saque marcado como falhado.");
      setSelectedPayout(null);
      setGatewayTxId("");
      setActionType(null);
      fetchPayouts();
    } catch (err) {
      console.error("Erro ao atualizar payout:", err);
      toast.show("Erro ao processar atualização do saque.");
    }
  };

  const filtered = useMemo(() => {
    return payouts.filter((p) => {
      const matchSearch =
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.recipient_id.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || p.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [payouts, search, statusFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const formatBR = (n: number) =>
    "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusPill = (status: string) => {
    switch (status) {
      case "paid":
        return <Pill bg="rgba(13,184,126,0.1)" color="#0DB87E">Pago</Pill>;
      case "pending":
        return <Pill bg="rgba(245,166,35,0.1)" color="#F5A623">Pendente</Pill>;
      case "processing":
        return <Pill bg="rgba(43,110,232,0.1)" color="#2B6EE8">Processando</Pill>;
      default:
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">Falhou</Pill>;
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Controle Pix de saques e repasses destinados a colaboradores e prestadores">
        Saques / Payouts
      </PageTitle>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por ID de Payout ou Favorecido..."
            style={{
              width: "100%",
              height: 40,
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: "0 12px 0 38px",
              fontFamily: "DM Sans",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          style={{ height: 40, border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 12px", fontFamily: "DM Sans" }}
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="processing">Processando</option>
          <option value="paid">Pago</option>
          <option value="failed">Falhou</option>
        </select>
      </Card>

      {/* Payouts Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Carregando fila de saques...
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Nenhuma solicitação de saque encontrada.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#F8FAFC" }}>
                <tr>
                  {["ID Saque", "Data Solicitação", "Favorecido (ID)", "Valor", "Status", "Gateway ID", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                      #{p.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                      #{p.recipient_id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
                      {formatBR(Number(p.amount))}
                    </td>
                    <td style={{ padding: "14px 20px" }}>{getStatusPill(p.status)}</td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#64748B" }}>
                      {p.gateway_payout_id || "—"}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {p.status === "pending" || p.status === "processing" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setSelectedPayout(p);
                              setActionType("approve");
                            }}
                            style={{
                              background: "#0DB87E",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontFamily: "DM Sans",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Check size={14} /> Aprovar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayout(p);
                              setActionType("reject");
                            }}
                            style={{
                              background: "rgba(232,64,64,0.1)",
                              color: "#E84040",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontFamily: "DM Sans",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <X size={14} /> Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>Concluído</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B" }}>
            Total de {filtered.length} saques
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", opacity: page === 0 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ padding: "6px 12px", fontFamily: "DM Sans", fontSize: 13 }}>
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {selectedPayout && actionType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, padding: 32 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {actionType === "approve" ? "Confirmar Repasse Pix" : "Recusar Solicitação de Saque"}
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#64748B", marginBottom: 20 }}>
              Você está prestes a {actionType === "approve" ? "confirmar o pagamento de" : "rejeitar a transferência de"}{" "}
              <strong>{formatBR(Number(selectedPayout.amount))}</strong> para o colaborador de ID #{selectedPayout.recipient_id.slice(0, 8)}...
            </p>

            {actionType === "approve" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>
                  ID do Comprovante / Gateway Payout ID
                </label>
                <input
                  value={gatewayTxId}
                  onChange={(e) => setGatewayTxId(e.target.value)}
                  placeholder="Ex: E20260715123456789ABC"
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => {
                  setSelectedPayout(null);
                  setActionType(null);
                  setGatewayTxId("");
                }}
                style={{
                  flex: 1,
                  height: 44,
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleUpdateStatus}
                style={{
                  flex: 1,
                  height: 44,
                  background: actionType === "approve" ? "#0DB87E" : "#E84040",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {actionType === "approve" ? "Aprovar Repasse" : "Rejeitar Saque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
