import { useState, useEffect, useMemo } from "react";
import { Search, Filter, RefreshCw, Calendar, FileText } from "lucide-react";
import { Card, PageTitle, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface RefundRecord {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  gateway_refund_id?: string;
  created_at: string;
}

const PAGE_SIZE = 10;

export default function AdminRefundsPage() {
  const toast = useAdminToast();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const fetchRefunds = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("refunds")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (data) setRefunds(data);
      } catch (err) {
        console.error("Erro ao carregar estornos:", err);
        toast.show("Erro ao carregar registros de estorno.");
      } finally {
        setLoading(false);
      }
    };
    fetchRefunds();
  }, []);

  const filtered = useMemo(() => {
    return refunds.filter((p) => {
      const matchSearch =
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.payment_id.toLowerCase().includes(search.toLowerCase()) ||
        p.reason.toLowerCase().includes(search.toLowerCase()) ||
        (p.gateway_refund_id && p.gateway_refund_id.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || p.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [refunds, search, statusFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const formatBR = (n: number) =>
    "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusPill = (status: string) => {
    switch (status) {
      case "processed":
        return <Pill bg="rgba(13,184,126,0.1)" color="#0DB87E">Processado</Pill>;
      case "pending":
        return <Pill bg="rgba(245,166,35,0.1)" color="#F5A623">Pendente</Pill>;
      default:
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">Falhou</Pill>;
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Histórico de reembolsos de transações autorizadas e estornos bancários processados">
        Estornos / Reembolsos
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
            placeholder="Buscar por ID de Reembolso, Gateway ID, Pagamento..."
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
          <option value="processed">Processado (processed)</option>
          <option value="pending">Pendente (pending)</option>
          <option value="failed">Falhou (failed)</option>
        </select>
      </Card>

      {/* Refunds Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Carregando log de estornos...
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
            Nenhum registro de reembolso localizado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#F8FAFC" }}>
                <tr>
                  {["ID Reembolso", "Data", "ID Pagamento", "Motivo do Estorno", "Valor Reembolsado", "Status", "Gateway ID"].map((h) => (
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
                      #{p.payment_id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.reason}
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#2B6EE8" }}>
                      {formatBR(Number(p.amount))}
                    </td>
                    <td style={{ padding: "14px 20px" }}>{getStatusPill(p.status)}</td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#64748B" }}>
                      {p.gateway_refund_id || "—"}
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
            Total de {filtered.length} reembolsos efetuados
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
    </div>
  );
}
