import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Bike,
  TrendingUp,
  Clock,
  AlertTriangle,
  UserCheck,
  Building2,
  Gift,
  Sparkles,
  Trash2,
  User,
  ShoppingBag,
} from "lucide-react";
import { MOCK_USERS, MOCK_TICKETS, MOCK_ENTIDADES, AdminUser } from "@/mocks/adminData";
import { MOCK_TRANSACTIONS } from "@/mocks/transactions";
import { Card, Avatar } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getNextDrawDateAndDays = (targetMonth: number) => {
  const now = new Date();
  let targetYear = now.getFullYear();
  if (now.getMonth() > targetMonth || (now.getMonth() === targetMonth && now.getDate() > 1)) {
    targetYear += 1;
  }
  const targetDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    date: targetDate,
    daysRemaining: diffDays,
  };
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [diaristasCount, setDiaristasCount] = useState(0);
  const [caminhoesCount, setCaminhoesCount] = useState(0);
  const [coletasCount, setColetasCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(54200);
  const [todayVolume, setTodayVolume] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: dbUsers, error } = await supabase
          .from("usuarios")
          .select("*");
        if (error) throw error;
        
        if (dbUsers) {
          // Buscar avaliações/serviços de diarista_perfis
          const { data: diaristas } = await supabase
            .from("diarista_perfis")
            .select("user_id, rating, total_servicos");
          
          const diaristasMap = new Map<string, any>();
          if (diaristas) {
            setDiaristasCount(diaristas.length);
            diaristas.forEach((d) => diaristasMap.set(d.user_id, d));
          }

          // Buscar placas de coco_caminhoes
          const { data: caminhoes } = await supabase
            .from("coco_caminhoes")
            .select("prestador_id, plate");
          
          const caminhoesMap = new Map<string, any>();
          if (caminhoes) {
            setCaminhoesCount(caminhoes.length);
            caminhoes.forEach((c) => caminhoesMap.set(c.prestador_id, c));
          }

          // Buscar ambulante_sessions
          const { data: ambulantes } = await supabase
            .from("ambulante_sessions")
            .select("prestador_id, is_online");
          
          const ambulantesMap = new Map<string, any>();
          if (ambulantes) {
            ambulantes.forEach((a) => ambulantesMap.set(a.prestador_id, a));
          }

          // Buscar coletas indicadas
          const { count: exactColetas } = await supabase
            .from("coco_pontos")
            .select("*", { count: "exact", head: true });
          setColetasCount(exactColetas || 0);

          const mapped: AdminUser[] = dbUsers.map((u: any) => {
            const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
            const isDiarista = diaristasMap.has(u.id);
            const isAmbulante = ambulantesMap.has(u.id);
            const caminhao = caminhoesMap.get(u.id);
            
            const categories: string[] = [];
            if (isColab) categories.push("Reciclagem");
            if (isDiarista) categories.push("Diarista");
            if (isAmbulante) categories.push("Ambulante");
            if (u.role === "prestador" && !isColab && !isDiarista && !isAmbulante) categories.push("Mototaxi");
            if (categories.length === 0 && u.role === "prestador") categories.push("Geral");

            const cleanName = u.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
            const ratingVal = isDiarista ? Number(diaristasMap.get(u.id).rating || 5.0) : (u.role === "prestador" ? 4.8 : null);
            const totalRidesVal = isDiarista ? Number(diaristasMap.get(u.id).total_servicos || 0) : (u.role === "prestador" ? 15 : undefined);

            return {
              id: u.id,
              name: u.nome,
              role: u.role.startsWith("cocoecia") || u.role === "prestador" ? "prestador" : "tomador",
              email: `${cleanName}@example.com`,
              phone: u.phone || "(24) 99999-9999",
              createdAt: u.created_at || new Date().toISOString(),
              kycStatus: u.role === "prestador" || isColab ? "approved" : "pending",
              categories: categories.length > 0 ? categories : undefined,
              plate: caminhao?.plate || (u.role === "prestador" && !isDiarista ? "MOTO-1234" : undefined),
              rating: ratingVal,
              totalRides: totalRidesVal,
            };
          });
          setUsers(mapped);

          // Buscar pedidos para cálculo financeiro
          const { data: dbPedidos } = await supabase
            .from("pedidos")
            .select("total, status, created_at");
          
          if (dbPedidos) {
            const validStatuses = ["confirmed", "completed", "rating"];
            const confirmedPedidos = dbPedidos;
            
            const dbVol = confirmedPedidos
              .filter((p) => validStatuses.includes(p.status))
              .reduce((acc, p) => acc + Number(p.total || 0), 0);
            
            const baseVolume = 54200.00;
            setTotalVolume(baseVolume + dbVol);

            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const todayVol = confirmedPedidos
              .filter((p) => validStatuses.includes(p.status) && new Date(p.created_at) >= startOfToday)
              .reduce((acc, p) => acc + Number(p.total || 0), 0);
            
            setTodayVolume(todayVol);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar usuários no admin:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Financial splits
  const entradasUbt = totalVolume * 0.04;
  const entradasPremio1_5 = totalVolume * 0.015;
  const premio1_11 = totalVolume * 0.015;
  const entradasPrestadores = totalVolume * 0.90;
  const entradasEntidades = totalVolume * 0.02;

  const pendingKyc = users.filter((u) => u.kycStatus === "pending");
  const openTickets = MOCK_TICKETS.filter((t) => t.status === "open").length;
  
  // Categorias counts
  const activeMototaxis = users.filter(u => u.categories?.includes("Mototaxi") && u.kycStatus === "approved").length;
  const activeDiaristas = users.filter(u => u.categories?.includes("Diarista") && u.kycStatus === "approved").length;
  const activeAmbulantes = users.filter(u => u.categories?.includes("Ambulante") && u.kycStatus === "approved").length;
  const entidadesCadastradas = MOCK_ENTIDADES.length;

  const adminKPIs = [
    { label: "Usuários totais", value: users.length, Icon: Users, color: "#2B6EE8", path: "/admin/clientes" },
    { label: "KYCs pendentes", value: pendingKyc.length, Icon: Clock, color: "#F5A623", path: "/admin/kyc-pendentes" },
    { label: "Tickets abertos", value: openTickets, Icon: AlertTriangle, color: "#E84040", path: "/admin/arbitragem" },
    { label: "Prêmio 1/5", value: `${getNextDrawDateAndDays(4).daysRemaining} dias`, Icon: Gift, color: "#9B59B6", path: "/admin/sorteio/1-5" },
    { label: "Prêmio 1/11", value: `${getNextDrawDateAndDays(10).daysRemaining} dias`, Icon: Gift, color: "#E84040", path: "/admin/sorteio/1-11" },
  ];

  const categoryKPIs = [
    { label: "Mototaxis Ativos", value: activeMototaxis, Icon: Bike, color: "#0DB87E", path: "/admin/clientes" },
    { label: "Diaristas ativos", value: activeDiaristas, Icon: Sparkles, color: "#9B59B6", path: "/admin/diaristas" },
    { label: "Entidades cadastradas", value: entidadesCadastradas, Icon: Building2, color: "#9B59B6", path: "/admin/entidades" },
    { label: "Ambulantes ativos", value: activeAmbulantes, Icon: ShoppingBag, color: "#F5A623", path: "/admin/clientes" },
    { label: "Coletas\nindicadas", value: coletasCount, Icon: Trash2, color: "#0DB87E", path: "/admin/coco" },
  ];

  const financeKPIs = [
    { label: "UBT", value: formatBR(entradasUbt), Icon: Building2, color: "#F5A623", path: "/admin/financeiro" },
    { label: "Prêmio 1/5", value: formatBR(entradasPremio1_5), Icon: Gift, color: "#9B59B6", path: "/admin/sorteio/1-5" },
    { label: "Prêmio 1/11", value: formatBR(premio1_11), Icon: Gift, color: "#E84040", path: "/admin/sorteio/1-11" },
    { label: "Prestadores", value: formatBR(entradasPrestadores), Icon: User, color: "#0DB87E", path: "/admin/financeiro" },
    { label: "Entidades", value: formatBR(entradasEntidades), Icon: Users, color: "#2B6EE8", path: "/admin/entidades" },
  ];

  const weekData = [4, 7, 12, 8, 11, 9, 8];
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const maxV = Math.max(...weekData);

  const recent = [...MOCK_TRANSACTIONS]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5);

  const setKyc = async (id: string, status: "approved" | "rejected") => {
    try {
      const newRole = status === "approved" ? "prestador" : "tomador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", id);

      if (error) throw error;

      setUsers((arr) => arr.map((u) => (u.id === id ? { ...u, kycStatus: status, role: newRole } : u)));
      toast.show(status === "approved" ? "KYC aprovado! Papel atualizado para Prestador." : "KYC reprovado.");
    } catch (e) {
      console.error("Erro ao atualizar KYC no dashboard:", e);
      toast.show("Erro ao atualizar status do KYC.");
    }
  };

  const renderKPICards = (kpisList: any[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {kpisList.map((k) => (
        <Card
          key={k.label}
          onClick={() => navigate(k.path)}
          style={{
            padding: 20,
            position: "relative",
            cursor: "pointer",
            transition: "transform 150ms, box-shadow 150ms",
            border: "1px solid #E2E8F0",
            background: "#fff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(15, 23, 42, 0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 10,
              background: k.color + "26",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <k.Icon size={20} color={k.color} />
          </div>
          <div
            style={{
              fontFamily: "DM Sans",
              fontSize: 12,
              fontWeight: 600,
              color: "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: 1,
              paddingRight: 48,
              whiteSpace: "pre-line",
            }}
          >
            {k.label}
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 700, color: "#0F172A", marginTop: 8 }}>
            {k.value}
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: "0 0 24px" }}>
        Dashboard
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Section 1: Administrativo */}
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#475569", margin: "0 0 12px" }}>
            Administrativo
          </h2>
          {renderKPICards(adminKPIs)}
        </div>

        {/* Section 2: Categorias */}
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#475569", margin: "0 0 12px" }}>
            Categorias UBT
          </h2>
          {renderKPICards(categoryKPIs)}
        </div>

        {/* Section 3: Financeiro */}
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#475569", margin: "0 0 12px" }}>
            Financeiro
          </h2>
          {renderKPICards(financeKPIs)}
        </div>
      </div>

      {/* Week chart */}
      <Card style={{ padding: 24, marginTop: 24 }}>
        <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
          Corridas — últimos 7 dias
        </div>
        <svg width="100%" height={140} style={{ marginTop: 16 }}>
          {weekData.map((v, i) => {
            const colW = 100 / weekData.length;
            const barH = (v / maxV) * 90;
            return (
              <g key={i}>
                <text
                  x={`${colW * i + colW / 2}%`}
                  y={110 - barH - 6}
                  textAnchor="middle"
                  style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, fill: "#0F172A" }}
                >
                  {v}
                </text>
                <rect
                  x={`${colW * i + colW / 2 - 3}%`}
                  y={110 - barH}
                  width="6%"
                  height={barH}
                  rx={4}
                  fill="#0DB87E"
                />
                <text
                  x={`${colW * i + colW / 2}%`}
                  y={130}
                  textAnchor="middle"
                  style={{ fontFamily: "DM Sans", fontSize: 11, fill: "#475569" }}
                >
                  {weekDays[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>

      {/* Two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              Últimas transações
            </div>
            <button
              onClick={() => navigate("/admin/financeiro")}
              style={{ background: "none", border: "none", color: "#0DB87E", fontFamily: "DM Sans", fontSize: 13, cursor: "pointer" }}
            >
              Ver todas →
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            {recent.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #F1F5F9",
                }}
              >
                <div style={{ flex: 1, fontFamily: "DM Sans", fontSize: 13, color: "#0F172A" }}>{t.description}</div>
                <div style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>
                  {formatBR(t.amount)}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", minWidth: 50, textAlign: "right" }}>
                  {new Date(t.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>KYCs pendentes</div>
            <span
              style={{
                background: "rgba(232,64,64,0.10)",
                color: "#E84040",
                borderRadius: 999,
                padding: "2px 10px",
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {pendingKyc.length}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            {pendingKyc.length === 0 && (
              <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", padding: "16px 0" }}>
                Nenhum KYC pendente.
              </div>
            )}
            {pendingKyc.map((u) => (
              <div
                key={u.id}
                onClick={() => navigate(`/admin/kyc/${u.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  borderBottom: "1px solid #F1F5F9",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Avatar name={u.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A" }}>{u.name}</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8" }}>
                    Cadastro {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setKyc(u.id, "approved"); }}
                  style={{
                    background: "rgba(13,184,126,0.10)",
                    border: "1px solid rgba(13,184,126,0.25)",
                    color: "#0DB87E",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "5px 12px",
                    cursor: "pointer",
                  }}
                >
                  Aprovar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setKyc(u.id, "rejected"); }}
                  style={{
                    background: "rgba(232,64,64,0.08)",
                    border: "1px solid rgba(232,64,64,0.20)",
                    color: "#E84040",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "5px 12px",
                    cursor: "pointer",
                  }}
                >
                  Reprovar
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
