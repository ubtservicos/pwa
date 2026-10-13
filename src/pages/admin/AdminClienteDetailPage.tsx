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
  Copy,
  Check,
  MapPin,
  Building2,
  Waves,
  Home,
} from "lucide-react";
import { Card, Avatar, Pill, KYC_PILL, GhostButton, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";
import { getStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";
import { maskCPF } from "@/utils/masks";

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
  cpf?: string;
  email: string;
  phone: string;
  bairro_moradia?: string;
  bairro_trabalho?: string;
  praias_frequenta?: string;
  createdAt: string;
  kycStatus?: "approved" | "pending" | "rejected";
  services?: string[];
  associacao?: string | null;
  plate?: string;
  rating?: number | null;
  totalRides?: number;
  pagos: number;
  recebidos: number;
  ticketsTrabalhador?: number;
  ticketsConsumidor?: number;
  contribComunidade?: number;
}

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [dbProfile, setDbProfile] = useState<any | null>(null);
  const [dbWaitlist, setDbWaitlist] = useState<any | null>(null);
  const [mototaxi, setMototaxi] = useState<any | null>(null);
  const [diarista, setDiarista] = useState<any | null>(null);
  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [associacaoNome, setAssociacaoNome] = useState<string | null>(null);
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleCopyLink = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      toast.show("Link copiado para a área de transferência! ✓");
      setTimeout(() => setCopiedLink(null), 2500);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
      toast.show("Erro ao copiar link.");
    }
  };

  const fetchUserDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Buscar usuário
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

      // 2. Buscar profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      // Buscar waitlist correspondente se existir
      let waitlistRow = null;
      try {
        const emailFilter = userData?.email || profileData?.email;
        const phoneFilter = userData?.phone || profileData?.phone;
        const orClauses = [];
        if (emailFilter) orClauses.push(`email.eq.${emailFilter}`);
        if (phoneFilter) orClauses.push(`telefone.eq.${phoneFilter}`);
        if (orClauses.length > 0) {
          const { data: wlData } = await supabase
            .from("waitlist")
            .select("*")
            .or(orClauses.join(","))
            .maybeSingle();
          waitlistRow = wlData;
        }
      } catch (wlErr) {
        console.warn("Aviso ao buscar dados complementares de waitlist:", wlErr);
      }

      // 3. Buscar mototáxi
      const { data: motoData } = await supabase
        .from("prestador_mototaxi")
        .select("kyc_status, modalidade, plate, is_online")
        .eq("user_id", id)
        .maybeSingle();

      // 4. Buscar diarista
      const { data: diaristaData } = await supabase
        .from("diarista_perfis")
        .select("rating, total_servicos")
        .eq("user_id", id)
        .maybeSingle();

      // 5. Buscar caminhão
      const { data: caminhaoData } = await supabase
        .from("coco_caminhoes")
        .select("plate, status_aprovacao")
        .eq("prestador_id", id)
        .maybeSingle();

      // 6. Buscar associação
      let assocName: string | null = null;
      const { data: provAssoc } = await supabase
        .from("provider_associations")
        .select("association_id")
        .eq("provider_id", id)
        .maybeSingle();

      const { data: membAssoc } = await supabase
        .from("associacao_membros")
        .select("association_id")
        .eq("prestador_id", id)
        .maybeSingle();

      const assocId = provAssoc?.association_id || membAssoc?.association_id;
      if (assocId) {
        const { data: assocData } = await supabase
          .from("associations")
          .select("name")
          .eq("id", assocId)
          .maybeSingle();
        if (assocData) assocName = assocData.name;
      }

      // 7. Buscar pedidos relacionados
      const { data: dbPedidos, error: errPedidos } = await supabase
        .from("pedidos")
        .select("*")
        .or(`tomador_id.eq.${id},prestador_id.eq.${id}`)
        .order("created_at", { ascending: false });

      if (errPedidos) throw errPedidos;

      setDbUser(userData);
      setDbProfile(profileData);
      setDbWaitlist(waitlistRow);
      setMototaxi(motoData);
      setCaminhao(caminhaoData);
      setDiarista(diaristaData);
      setAssociacaoNome(assocName);
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

    const services: string[] = [];
    if (mototaxi && mototaxi.kyc_status === "approved") {
      services.push(mototaxi.modalidade === "entrega" ? "Entrega" : "Mototáxi");
    }
    if (diarista) {
      services.push("Diarista");
    }
    if (isColab || (caminhao && caminhao.status_aprovacao === "approved")) {
      services.push("Reciclagem");
    }

    let kycStatus: "approved" | "pending" | "rejected" | undefined = undefined;
    if (mototaxi) {
      kycStatus = mototaxi.kyc_status;
    } else if (caminhao) {
      kycStatus = caminhao.status_aprovacao === "approved" ? "approved" : "pending";
    } else if (diarista) {
      kycStatus = "approved";
    } else if (dbUser.role === "prestador" || isColab) {
      kycStatus = "pending";
    }

    const ratingVal = diarista ? Number(diarista.rating || 5.0) : null;
    const totalRidesVal = diarista ? Number(diarista.total_servicos || 0) : undefined;

    const ticketsConsumidor = filtered.filter((p: any) => p.tomador_id === id && validStatuses.includes(p.status)).length;
    const ticketsTrabalhador = (dbUser.role === "prestador" || isColab || diarista || mototaxi)
      ? filtered.filter((p: any) => p.prestador_id === id && validStatuses.includes(p.status)).length
      : 0;
    const contribComunidade = (pagos + recebidos) * 0.01;

    const name = dbUser.nome || dbProfile?.name || "Sem nome";
    const email = dbProfile?.email || dbUser.email || "Não informado";
    const phone = dbProfile?.phone || dbUser.phone || "Não cadastrado";
    const rawCpf = dbProfile?.cpf || dbUser?.cpf || dbWaitlist?.cpf || null;
    const cpf = rawCpf ? maskCPF(rawCpf) : "Não informado";

    const extractPraias = (obs?: string | null) => {
      if (!obs) return null;
      const match = obs.match(/Praias:\s*([^|]+)/i);
      return match ? match[1].trim() : null;
    };

    const bairroMoradia = dbProfile?.bairro_moradia || dbUser?.bairro_moradia || dbWaitlist?.bairro_moradia || null;
    const bairroTrabalho = dbProfile?.bairro_trabalho || dbUser?.bairro_trabalho || dbWaitlist?.bairro_trabalho || null;
    const praiasFrequenta = dbProfile?.praias_frequenta || dbUser?.praias_frequenta || extractPraias(dbWaitlist?.observacoes) || null;

    const detailUser: DetailUser = {
      id: dbUser.id,
      name,
      role: (dbUser.role && (dbUser.role.startsWith("cocoecia") || dbUser.role === "prestador")) || services.length > 0 ? "prestador" : "tomador",
      cpf,
      email,
      phone,
      bairro_moradia: bairroMoradia,
      bairro_trabalho: bairroTrabalho,
      praias_frequenta: praiasFrequenta,
      createdAt: dbUser.created_at || dbProfile?.created_at || new Date().toISOString(),
      kycStatus,
      services,
      associacao: associacaoNome,
      plate: mototaxi?.plate || caminhao?.plate || undefined,
      rating: ratingVal,
      totalRides: totalRidesVal,
      pagos,
      recebidos,
      ticketsConsumidor,
      ticketsTrabalhador,
      contribComunidade,
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
  }, [dbUser, dbProfile, dbOrders, mototaxi, diarista, caminhao, associacaoNome, filterPeriod, id]);

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
        <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Carregando informações do usuário...</div>
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
            color: "var(--admin-subtle)",
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
          <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)", marginTop: 8 }}>O ID solicitado não existe no sistema.</div>
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
          color: "var(--admin-subtle)",
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
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--admin-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--admin-subtle)")}
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
        background: "var(--admin-bg)",
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid var(--admin-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)" }}>Período dos Dados:</span>
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          style={{
            height: 36,
            background: "var(--admin-bg)",
            border: "1px solid var(--admin-border)",
            borderRadius: 8,
            padding: "0 12px",
            fontFamily: "DM Sans",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--admin-text)",
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
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
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
            <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Recebido
            </div>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
              {formatBR(user.recebidos)}
            </div>
          </Card>
          <Card style={{ padding: "14px 20px", background: "rgba(232,64,64,0.03)", border: "1px solid rgba(232,64,64,0.10)" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
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
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
              Dados do Usuário
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CreditCard size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>CPF</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 600, marginTop: 1 }}>{user.cpf || "Não informado"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Mail size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>E-mail</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>{user.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Phone size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Telefone</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>{user.phone}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Calendar size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Cadastro no Sistema</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>
                    {new Date(user.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Shield size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>ID do Usuário</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-subtle)", marginTop: 1 }}>{user.id}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Home size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Bairro de Moradia</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>{user.bairro_moradia || "Não informado"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Building2 size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Bairro de Trabalho</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>{user.bairro_trabalho || "Não informado"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Waves size={16} color="var(--admin-muted)" />
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Praias que Frequenta</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 1 }}>{user.praias_frequenta || "Não informado"}</div>
                </div>
              </div>

              {/* Links de Acesso e Indicação */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 700, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Links de Acesso e Indicação
                </div>

                {/* Link de Onboarding */}
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Link de Onboarding:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      readOnly
                      type="text"
                      value={`${getAppOrigin()}/onboarding?token=${user.id}`}
                      style={{
                        flex: 1,
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "var(--admin-text)",
                        outline: "none",
                        cursor: "text",
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(`${getAppOrigin()}/onboarding?token=${user.id}`, "onboarding")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        background: copiedLink === "onboarding" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                        color: copiedLink === "onboarding" ? "#0DB87E" : "var(--admin-text)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {copiedLink === "onboarding" ? (
                        <>
                          <Check size={13} color="#0DB87E" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Link Padrinho/Madrinha */}
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Link Padrinho/Madrinha:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      readOnly
                      type="text"
                      value={`${getAppOrigin()}/cadastro?ref=${user.id}`}
                      style={{
                        flex: 1,
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "var(--admin-text)",
                        outline: "none",
                        cursor: "text",
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(`${getAppOrigin()}/cadastro?ref=${user.id}`, "padrinho")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        background: copiedLink === "padrinho" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                        color: copiedLink === "padrinho" ? "#0DB87E" : "var(--admin-text)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {copiedLink === "padrinho" ? (
                        <>
                          <Check size={13} color="#0DB87E" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
              Prêmios & Fundo Coletivo
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Tickets Prêmio 1/5</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", marginTop: 4 }}>
                  {user.ticketsTrabalhador ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Tickets Prêmio 1/11</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", marginTop: 4 }}>
                  {user.ticketsConsumidor ?? 0}
                </div>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--admin-bg)", paddingTop: 12 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)", marginBottom: 6 }}>Associação & Fundo Coletivo</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)" }}>
                    {user.associacao || "Sem associação vinculada"}
                  </span>
                  <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#9B59B6" }}>
                    {(user.contribComunidade ?? 0) > 0 ? formatBR(user.contribComunidade ?? 0) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {user.role === "prestador" && (
            <Card style={{ padding: 24 }}>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
                Dados de Prestador
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Placa</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: "var(--admin-text)", marginTop: 4 }}>
                    {user.plate || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Avaliação Média</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    {user.rating ? (
                      <>
                        <Star size={14} fill="#F5A623" color="#F5A623" />
                        {user.rating.toFixed(1)}
                      </>
                    ) : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Total de Serviços</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", marginTop: 4 }}>
                    {user.totalRides ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>Serviços Ativos</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {(user.services ?? []).map((s) => (
                      <Pill key={s} bg="var(--admin-bg)" color="var(--admin-subtle)" size="sm">
                        {s}
                      </Pill>
                    ))}
                    {(user.services ?? []).length === 0 && (
                      <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Verification / KYC Actions */}
          {user.role === "tomador" && (
            <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Ações de KYC / Credenciamento
              </h2>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", margin: "0 0 4px" }}>
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
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Arbitragem / Status da Conta
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", margin: "0 0 4px" }}>
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
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
            Histórico de Transações
          </h2>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
                Sem transações ou pedidos registrados para este usuário.
              </div>
            ) : (
              orders.map((o) => {
                const sp = STATUS_PILL[o.status] || { bg: "var(--admin-bg)", color: "var(--admin-subtle)", label: o.status };
                return (
                  <div
                    key={o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      border: "1px solid var(--admin-bg)",
                      borderRadius: 12,
                      background: "var(--admin-bg)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>
                        {o.description}
                      </span>
                      <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-muted)" }}>
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
