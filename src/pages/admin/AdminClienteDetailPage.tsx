import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  CreditCard,
} from "lucide-react";
import { Card, Avatar, Pill, KYC_PILL, GhostButton, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";

interface OrderItem {
  id: string;
  created_at: string;
  total: number;
  status: string;
  modalidade: string;
  type: "entrada" | "saida"; // Custom type for display
  description: string;
}

interface DetailUser {
  id: string;
  name: string;
  role: "tomador" | "prestador" | string;
  email: string;
  phone: string;
  createdAt: string;
  kycStatus?: "approved" | "pending" | "rejected";
  categories?: string[];
  plate?: string;
  rating?: number | null;
  totalRides?: number;
  pagos: number;
  recebidos: number;
  ticketsTrabalhador?: number;
  ticketsConsumidor?: number;
  contribComunidade?: number;
  donations?: { entity: string; amount: number }[];
}

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getDonations = (id: string, totalContrib: number) => {
  const entities = ["Lar dos Velhinhos", "Recicla Ubatuba", "Sinfônica Jovem", "Pro-Surf Ubatuba"];
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  
  const numEnts = (sum % 2) + 1; // 1 ou 2 entidades
  const donationsList: { entity: string; amount: number }[] = [];
  
  if (numEnts === 1) {
    const entIndex = sum % entities.length;
    donationsList.push({
      entity: entities[entIndex],
      amount: totalContrib
    });
  } else {
    const ent1Index = sum % entities.length;
    const ent2Index = (sum + 1) % entities.length;
    donationsList.push({
      entity: entities[ent1Index],
      amount: totalContrib * 0.6
    });
    donationsList.push({
      entity: entities[ent2Index],
      amount: totalContrib * 0.4
    });
  }
  return donationsList;
};

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: "rgba(13,184,126,0.10)", color: "#0DB87E", label: "Concluído" },
  confirmed: { bg: "rgba(13,184,126,0.10)", color: "#0DB87E", label: "Confirmado" },
  pending: { bg: "rgba(245,166,35,0.10)", color: "#F5A623", label: "Pendente" },
  cancelled: { bg: "rgba(232,64,64,0.08)", color: "#E84040", label: "Cancelado" },
  rating: { bg: "rgba(13,184,126,0.10)", color: "#0DB87E", label: "Concluído (Avaliado)" },
  preparing: { bg: "rgba(43,110,232,0.10)", color: "#2B6EE8", label: "Preparando" },
  ready: { bg: "rgba(43,110,232,0.10)", color: "#2B6EE8", label: "Pronto" },
};

export default function AdminClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [dbUser, setDbUser] = useState<any | null>(null);
  const [diarista, setDiarista] = useState<any | null>(null);
  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchUserDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: userData, error: errUser } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (errUser) throw errUser;
      if (!userData) {
        setDbUser(null);
        setLoading(false);
        return;
      }

      // Buscar perfis adicionais (diaristas, caminhões)
      const { data: diaristaData } = await supabase
        .from("diarista_perfis")
        .select("rating, total_servicos")
        .eq("user_id", id)
        .maybeSingle();

      const { data: caminhaoData } = await supabase
        .from("coco_caminhoes")
        .select("plate")
        .eq("prestador_id", id)
        .maybeSingle();

      // Buscar pedidos relacionados
      const { data: dbPedidos, error: errPedidos } = await supabase
        .from("pedidos")
        .select("*")
        .or(`tomador_id.eq.${id},prestador_id.eq.${id}`)
        .order("created_at", { ascending: false });

      if (errPedidos) throw errPedidos;

      setDbUser(userData);
      setDiarista(diaristaData);
      setCaminhao(caminhaoData);
      setDbOrders(dbPedidos || []);

    } catch (err) {
      console.error("Erro ao carregar detalhes do usuário:", err);
      toast.show("Erro ao carregar detalhes do usuário.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  const { orders, user } = useMemo(() => {
    if (!dbUser) return { orders: [], user: null };

    const now = new Date();
    const filtered = dbOrders.filter((p: any) => {
      if (filterPeriod === "all") return true;
      const pDate = new Date(p.created_at);
      const diffTime = now.getTime() - pDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (filterPeriod === "today") return diffDays <= 1;
      if (filterPeriod === "week") return diffDays <= 7;
      if (filterPeriod === "month") return diffDays <= 30;
      if (filterPeriod === "year") return diffDays <= 365;
      return true;
    });

    const validStatuses = ["completed", "confirmed", "rating", "preparing", "ready"];

    const pagos = filtered
      .filter((p: any) => p.tomador_id === id && validStatuses.includes(p.status))
      .reduce((acc: number, p: any) => acc + Number(p.total || 0), 0);

    const recebidos = filtered
      .filter((p: any) => p.prestador_id === id && validStatuses.includes(p.status))
      .reduce((acc: number, p: any) => acc + Number(p.total || 0), 0);

    const isColab = dbUser.role === "cocoecia-colaborador" || dbUser.role === "cocoecia-dirigentes" || dbUser.role === "cocoecia";
    const isDiarista = !!diarista;

    const categories: string[] = [];
    if (dbUser.nome === "Zé do Coco" || dbUser.nome === "Maria do Milho") {
      categories.push("Reciclagem", "Diarista", "Mototaxi");
    } else if (dbUser.nome === "João Souza") {
      categories.push("Diarista", "Mototaxi");
    } else {
      if (isColab) categories.push("Reciclagem");
      if (isDiarista) categories.push("Diarista");
      if (dbUser.role === "prestador" && !isColab && !isDiarista) categories.push("Mototaxi");
      if (categories.length === 0 && dbUser.role === "prestador") categories.push("Geral");
    }

    const cleanName = dbUser.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
    const ratingVal = diarista ? Number(diarista.rating || 5.0) : (dbUser.role === "prestador" ? 4.8 : null);
    const totalRidesVal = diarista ? Number(diarista.total_servicos || 0) : (dbUser.role === "prestador" ? 15 : undefined);

    const ticketsConsumidor = filtered.filter((p: any) => p.tomador_id === id && validStatuses.includes(p.status)).length + 5;
    const ticketsTrabalhador = (dbUser.role === "prestador" || isColab || isDiarista)
      ? filtered.filter((p: any) => p.prestador_id === id && validStatuses.includes(p.status)).length + 8
      : 0;
    const contribComunidade = (pagos + recebidos) * 0.01;
    const donations = getDonations(id || "", contribComunidade);

    const detailUser: DetailUser = {
      id: dbUser.id,
      name: dbUser.nome,
      role: dbUser.role.startsWith("cocoecia") || dbUser.role === "prestador" ? "prestador" : "tomador",
      email: `${cleanName}@example.com`,
      phone: dbUser.phone || "(24) 99999-9999",
      createdAt: dbUser.created_at || new Date().toISOString(),
      kycStatus: dbUser.role === "prestador" || isColab ? "approved" : "pending",
      categories: categories.length > 0 ? categories : undefined,
      plate: caminhao?.plate || (dbUser.role === "prestador" && !isDiarista ? "MOTO-1234" : undefined),
      rating: ratingVal,
      totalRides: totalRidesVal,
      pagos,
      recebidos,
      ticketsConsumidor,
      ticketsTrabalhador,
      contribComunidade,
      donations,
    };

    const mappedOrders: OrderItem[] = filtered.map((p: any) => {
      const isOut = p.tomador_id === id;
      return {
        id: p.id,
        created_at: p.created_at,
        total: Number(p.total || 0),
        status: p.status,
        modalidade: p.modalidade || "Geral",
        type: isOut ? "saida" : "entrada",
        description: isOut
          ? `Pagamento de serviço (${p.modalidade === "delivery" ? "Ambulante" : "Mototaxi"})`
          : `Recebimento de serviço (${p.modalidade === "delivery" ? "Ambulante" : "Mototaxi"})`,
      };
    });

    return { orders: mappedOrders, user: detailUser };
  }, [dbUser, dbOrders, diarista, caminhao, filterPeriod, id]);

  const setKyc = async (status: "approved" | "rejected") => {
    if (!dbUser) return;
    try {
      const newRole = status === "approved" ? "prestador" : "tomador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", dbUser.id);

      if (error) throw error;

      setDbUser((prev: any) => prev ? { ...prev, role: newRole } : null);
      toast.show(status === "approved" ? "KYC aprovado! Papel atualizado para Prestador." : "KYC reprovado.");
    } catch (e) {
      console.error("Erro ao atualizar KYC:", e);
      toast.show("Erro ao atualizar status do KYC.");
    }
  };

  const [userStatus, setUserStatus] = useState<string>("active");
  const [rules, setRules] = useState<StatusRule[]>([]);

  useEffect(() => {
    if (dbUser) {
      setUserStatus(dbUser.status || "active");
    }
    setRules(getStatusRules());
  }, [dbUser]);

  const changeStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      setUserStatus(newStatus);
      toast.show("Status do usuário alterado com sucesso!");
    } catch (e) {
      console.error("Erro ao alterar status:", e);
      toast.show("Erro ao alterar status no banco.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ fontFamily: "DM Sans", color: "#94A3B8" }}>Carregando informações do usuário...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 32 }}>
        <button
          onClick={() => navigate("/admin/clientes")}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} /> Voltar para clientes
        </button>
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#E84040" }}>Usuário não encontrado</div>
          <div style={{ fontFamily: "DM Sans", color: "#94A3B8", marginTop: 8 }}>O ID solicitado não existe no sistema.</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/admin/clientes")}
        style={{
          background: "none",
          border: "none",
          color: "#475569",
          fontFamily: "DM Sans",
          fontSize: 14,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: 24,
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
      >
        <ArrowLeft size={16} /> Voltar para clientes
      </button>

      {/* Period Filter Bar */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
        background: "#fff",
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#475569" }}>Período dos Dados:</span>
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          style={{
            height: 36,
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: "0 12px",
            fontFamily: "DM Sans",
            fontSize: 13,
            fontWeight: 500,
            color: "#0F172A",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">Todo o período</option>
          <option value="today">Hoje</option>
          <option value="week">Última Semana</option>
          <option value="month">Último Mês</option>
          <option value="year">Último Ano</option>
        </select>
      </div>

      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={user.name} size={64} />
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
              {user.name}
              {userStatus !== "active" && (() => {
                const rule = rules.find((r) => r.key === userStatus);
                if (!rule) return null;
                const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                return (
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "2px 8px" }}>
                    {rule.label}
                  </span>
                );
              })()}
            </h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Pill bg="rgba(43,110,232,0.10)" color="#2B6EE8">
                tomador
              </Pill>
              {(user.role === "prestador" || user.recebidos > 0) && (
                <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E">
                  prestador
                </Pill>
              )}
              {user.role === "prestador" && user.kycStatus && (
                <Pill {...KYC_PILL[user.kycStatus]}>{KYC_PILL[user.kycStatus].label}</Pill>
              )}
            </div>
          </div>
        </div>

        {/* Financial Highlights */}
        <div style={{ display: "flex", gap: 16 }}>
          <Card style={{ padding: "14px 20px", background: "rgba(13,184,126,0.04)", border: "1px solid rgba(13,184,126,0.15)" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Recebido
            </div>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
              {formatBR(user.recebidos)}
            </div>
          </Card>
          <Card style={{ padding: "14px 20px", background: "rgba(232,64,64,0.03)", border: "1px solid rgba(232,64,64,0.10)" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Pago
            </div>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#E84040", marginTop: 4 }}>
              {formatBR(user.pagos)}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {/* Profile Details Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Card style={{ padding: 24 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Dados do Usuário
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Mail size={16} color="#94A3B8" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>E-mail</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", marginTop: 1 }}>{user.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Phone size={16} color="#94A3B8" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Telefone</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", marginTop: 1 }}>{user.phone}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Calendar size={16} color="#94A3B8" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Cadastro no Sistema</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", marginTop: 1 }}>
                    {new Date(user.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Shield size={16} color="#94A3B8" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>ID do Usuário</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", marginTop: 1 }}>{user.id}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Prêmios & Coletivo (Doações)
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Tickets Prêmio 1/5</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                  {user.ticketsTrabalhador ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Tickets Prêmio 1/11</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                  {user.ticketsConsumidor ?? 0}
                </div>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>Coletivo (Doações por Entidade)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(user.donations ?? []).map((d, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#475569" }}>{d.entity}</span>
                      <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#9B59B6" }}>
                        {formatBR(d.amount)}
                      </span>
                    </div>
                  ))}
                  {(user.donations ?? []).length === 0 && (
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>—</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {user.role === "prestador" && (
            <Card style={{ padding: 24 }}>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
                Dados de Prestador
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Placa</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: "#0F172A", marginTop: 4 }}>
                    {user.plate || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Avaliação Média</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    {user.rating ? (
                      <>
                        <Star size={14} fill="#F5A623" color="#F5A623" />
                        {user.rating.toFixed(1)}
                      </>
                    ) : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Total de Serviços</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", marginTop: 4 }}>
                    {user.totalRides ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Categorias</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {(user.categories ?? []).map((c) => (
                      <Pill key={c} bg="#F1F5F9" color="#475569" size="sm">
                        {c}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Verification / KYC Actions */}
          {user.role === "tomador" && (
            <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Ações de KYC / Credenciamento
              </h2>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", margin: "0 0 4px" }}>
                Aprove este usuário para habilitar a prestação de serviços no Superapp.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <PrimaryButton onClick={() => setKyc("approved")}>
                  Aprovar KYC e Tornar Prestador
                </PrimaryButton>
                <button
                  onClick={() => setKyc("rejected")}
                  style={{
                    background: "rgba(232,64,64,0.08)",
                    border: "1px solid rgba(232,64,64,0.20)",
                    color: "#E84040",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 10,
                    padding: "10px 18px",
                    cursor: "pointer",
                  }}
                >
                  Reprovar KYC
                </button>
              </div>
            </Card>
          )}

          {/* Arbitration / Account Status Actions */}
          <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Arbitragem / Status da Conta
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", margin: "0 0 4px" }}>
              Controle o status do usuário no Superapp (Quarentena ou Desativação por tempo indeterminado).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {userStatus !== "active" && (
                <PrimaryButton onClick={() => changeStatus("active")} style={{ background: "#0DB87E", borderColor: "#0DB87E" }}>
                  Reativar Conta (Definir como Ativo)
                </PrimaryButton>
              )}
              {rules.map((rule) => {
                if (userStatus === rule.key) return null;
                const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                return (
                  <button
                    key={rule.key}
                    onClick={() => changeStatus(rule.key)}
                    style={{
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      color: colors.color,
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 10,
                      padding: "10px 18px",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "opacity 100ms",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Alterar para {rule.label} {rule.durationDays ? `(${rule.durationDays} dias)` : "(Sem limite)"}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Transaction History Card */}
        <Card style={{ padding: 24, display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
            Histórico de Transações
          </h2>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
                Sem transações ou pedidos registrados para este usuário.
              </div>
            ) : (
              orders.map((o) => {
                const sp = STATUS_PILL[o.status] || { bg: "#F1F5F9", color: "#475569", label: o.status };
                return (
                  <div
                    key={o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      border: "1px solid #F1F5F9",
                      borderRadius: 12,
                      background: "#F8FAFC",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                        {o.description}
                      </span>
                      <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>
                        {new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span
                        style={{
                          fontFamily: "Syne",
                          fontSize: 14,
                          fontWeight: 700,
                          color: o.type === "saida" ? "#E84040" : "#0DB87E",
                        }}
                      >
                        {o.type === "saida" ? "-" : "+"} {formatBR(o.total)}
                      </span>
                      <Pill bg={sp.bg} color={sp.color} size="sm">
                        {sp.label}
                      </Pill>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
