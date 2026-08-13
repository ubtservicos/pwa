import { useState, useEffect, useMemo } from "react";
import { Search, Filter, CreditCard, Calendar, User, ShoppingBag } from "lucide-react";
import { Card, PageTitle, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface PaymentRecord {
  id: string;
  service_type: string;
  service_id: string;
  customer_id: string;
  provider_id: string;
  gateway: string;
  gateway_payment_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  idempotency_key: string;
  created_at: string;
}

const PAGE_SIZE = 10;

export default function AdminPaymentsPage() {
  const toast = useAdminToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Split details modal
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [paymentSplits, setPaymentSplits] = useState<any[]>([]);
  const [loadingSplits, setLoadingSplits] = useState(false);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (data) setPayments(data);
      } catch (err) {
        console.error("Erro ao carregar pagamentos:", err);
        toast.show("Erro ao carregar pagamentos.");
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const fetchSplits = async (paymentId: string) => {
    try {
      setLoadingSplits(true);
      const { data, error } = await supabase
        .from("payment_splits")
        .select("*")
        .eq("payment_id", paymentId);
      if (error) throw error;
      setPaymentSplits(data || []);
    } catch (err) {
      console.error("Erro ao carregar splits:", err);
      toast.show("Erro ao carregar divisões do pagamento.");
    } finally {
      setLoadingSplits(false);
    }
  };

  const openDetails = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    fetchSplits(payment.id);
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        (p.gateway_payment_id && p.gateway_payment_id.toLowerCase().includes(search.toLowerCase())) ||
        p.customer_id.toLowerCase().includes(search.toLowerCase()) ||
        p.provider_id.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchMethod = methodFilter === "all" || p.payment_method === methodFilter;
      const matchService = serviceFilter === "all" || p.service_type === serviceFilter;

      return matchSearch && matchStatus && matchMethod && matchService;
    });
  }, [payments, search, statusFilter, methodFilter, serviceFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const formatBR = (n: number) =>
    "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusPill = (status: string) => {
    switch (status) {
      case "captured":
      case "authorized":
        return <Pill bg="rgba(13,184,126,0.1)" color="#0DB87E">Aprovado</Pill>;
      case "pending":
        return <Pill bg="rgba(245,166,35,0.1)" color="#F5A623">Pendente</Pill>;
      case "refunded":
        return <Pill bg="rgba(43,110,232,0.1)" color="#2B6EE8">Estornado</Pill>;
      default:
        return <Pill bg="rgba(232,64,64,0.08)" color="#E84040">{status}</Pill>;
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Registro completo de pagamentos capturados no Mercado Pago">Pagamentos</PageTitle>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por ID, Gateway ID ou Usuário..."
            style={{
              width: "100%",
              height: 40,
              border: "1px solid var(--admin-border)",
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
          style={{ height: 40, border: "1px solid var(--admin-border)", borderRadius: 10, padding: "0 12px", fontFamily: "DM Sans" }}
        >
          <option value="all">Todos os Status</option>
          <option value="captured">Aprovado (Captured)</option>
          <option value="pending">Pendente</option>
          <option value="refunded">Estornado</option>
          <option value="failed">Falhou</option>
        </select>

        <select
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            setPage(0);
          }}
          style={{ height: 40, border: "1px solid var(--admin-border)", borderRadius: 10, padding: "0 12px", fontFamily: "DM Sans" }}
        >
          <option value="all">Todos os Métodos</option>
          <option value="pix">Pix</option>
          <option value="credit_card">Cartão de Crédito</option>
        </select>

        <select
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setPage(0);
          }}
          style={{ height: 40, border: "1px solid var(--admin-border)", borderRadius: 10, padding: "0 12px", fontFamily: "DM Sans" }}
        >
          <option value="all">Todas as Verticais</option>
          <option value="mototaxi">Mototáxi</option>
          <option value="diarista">Diaristas</option>
          <option value="ambulante">Ambulantes</option>
          <option value="coco">Reciclagem (Côco)</option>
        </select>
      </Card>

      {/* Payments Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Carregando transações financeiras...
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhum pagamento correspondente encontrado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["ID", "Data", "Vertical", "Cliente / Prestador", "Método", "Valor", "Status", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--admin-muted)",
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
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                      #{p.id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ textTransform: "capitalize", fontFamily: "DM Sans", fontSize: 13, fontWeight: 500 }}>
                        {p.service_type}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>Cliente: #{p.customer_id.slice(0, 6)}</span>
                        <span>Prestador: #{p.provider_id.slice(0, 6)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", textTransform: "uppercase", fontFamily: "DM Sans", fontSize: 13 }}>
                      {p.payment_method}
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>
                      {formatBR(Number(p.amount))}
                    </td>
                    <td style={{ padding: "14px 20px" }}>{getStatusPill(p.status)}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <button
                        onClick={() => openDetails(p)}
                        style={{
                          background: "var(--admin-bg)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--admin-subtle)",
                          cursor: "pointer",
                        }}
                      >
                        Ver Splits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid #E2E8F0" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
            Total de {filtered.length} pagamentos
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: "6px 12px", border: "1px solid var(--admin-border)", borderRadius: 8, cursor: "pointer", opacity: page === 0 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ padding: "6px 12px", fontFamily: "DM Sans", fontSize: 13 }}>
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: "6px 12px", border: "1px solid var(--admin-border)", borderRadius: 8, cursor: "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>

      {/* Splits Detail Drawer / Modal */}
      {selectedPayment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--admin-bg)", borderRadius: 16, width: "100%", maxWidth: 600, padding: 32, position: "relative" }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Detalhes do Pagamento</h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", marginBottom: 20 }}>
              ID: {selectedPayment.id}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--admin-muted)", fontWeight: 600 }}>Valor Bruto</span>
                <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", marginTop: 4 }}>
                  {formatBR(Number(selectedPayment.amount))}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--admin-muted)", fontWeight: 600 }}>Status</span>
                <div style={{ marginTop: 4 }}>{getStatusPill(selectedPayment.status)}</div>
              </div>
            </div>

            <h4 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, marginBottom: 12, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
              Divisão de Split (payment_splits)
            </h4>

            {loadingSplits ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--admin-muted)" }}>Buscando splits...</div>
            ) : paymentSplits.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--admin-muted)" }}>Nenhum split gravado para este pagamento.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {paymentSplits.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--admin-bg)", borderRadius: 10 }}>
                    <div>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)", textTransform: "capitalize" }}>
                        {s.recipient_role === "ubt" ? "Taxa UBT" : s.recipient_role === "comunidade" ? "Fundo Social" : s.recipient_role === "provider" ? "Prestador" : s.recipient_role}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 2 }}>ID Recipient: #{s.recipient_id.slice(0, 8)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                        {formatBR(Number(s.amount))}
                      </span>
                      <div style={{ marginTop: 2 }}>
                        <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E" size="sm">{s.status}</Pill>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setSelectedPayment(null)}
              style={{
                width: "100%",
                height: 44,
                background: "var(--admin-text)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontFamily: "DM Sans",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 24,
              }}
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
