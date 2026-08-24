import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Star, Filter, ChevronRight, Award, Gift, Heart, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { MOCK_USERS, AdminUser } from "@/mocks/adminData";
import { Card, Avatar, Pill, KYC_PILL, GhostButton, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";

type Tab = "todos" | "tomadores" | "prestadores";

const getBirthMonth = (id: string) => {
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return (sum % 12) + 1;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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

export default function AdminClientesPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbPedidos, setDbPedidos] = useState<any[]>([]);
  const [diaristasMap, setDiaristasMap] = useState<Map<string, any>>(new Map());
  const [caminhoesMap, setCaminhoesMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("todos");
  const [q, setQ] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [rules, setRules] = useState<StatusRule[]>([]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (q) count++;
    if (filterMonth !== "all") count++;
    if (filterCategory !== "all") count++;
    if (filterPeriod !== "all") count++;
    return count;
  }, [q, filterMonth, filterCategory, filterPeriod]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: rawUsers, error } = await supabase
          .from("usuarios")
          .select("*");
        if (error) throw error;
        
        if (rawUsers) {
          // Buscar avaliações/serviços de diarista_perfis
          const { data: diaristas } = await supabase
            .from("diarista_perfis")
            .select("user_id, rating, total_servicos");
          
          const dMap = new Map<string, any>();
          if (diaristas) {
            diaristas.forEach((d) => dMap.set(d.user_id, d));
          }

          // Buscar placas de coco_caminhoes
          const { data: caminhoes } = await supabase
            .from("coco_caminhoes")
            .select("prestador_id, plate");
          
          const cMap = new Map<string, any>();
          if (caminhoes) {
            caminhoes.forEach((c) => cMap.set(c.prestador_id, c));
          }

          // Buscar todos os pedidos para calcular recebidos e pagos (selecionando created_at para filtrar período!)
          const { data: rawPedidos } = await supabase
            .from("pedidos")
            .select("tomador_id, prestador_id, total, status, created_at");

          setDbUsers(rawUsers);
          setDiaristasMap(dMap);
          setCaminhoesMap(cMap);
          setDbPedidos(rawPedidos || []);
        }
      } catch (e) {
        console.error("Erro ao buscar usuários no admin:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    setRules(getStatusRules());
  }, []);

  const users = useMemo(() => {
    if (dbUsers.length === 0) return [];
    
    const now = new Date();
    const filteredPedidos = dbPedidos.filter((p: any) => {
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

    return dbUsers.map((u: any) => {
      const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
      const isDiarista = diaristasMap.has(u.id);
      const caminhao = caminhoesMap.get(u.id);
      
      const categories: string[] = [];
      if (isColab) {
        categories.push("Reciclagem");
      }
      if (isDiarista) {
        categories.push("Diarista");
      } else {
        if (isColab) categories.push("Reciclagem");
        if (isDiarista) categories.push("Diarista");
        if (u.role === "prestador" && !isColab && !isDiarista) categories.push("Mototaxi");
        if (categories.length === 0 && u.role === "prestador") categories.push("Geral");
      }

      const cleanName = u.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
      const ratingVal = isDiarista ? Number(diaristasMap.get(u.id).rating || 5.0) : null;
      const totalRidesVal = isDiarista ? Number(diaristasMap.get(u.id).total_servicos || 0) : undefined;

      const userPedidos = filteredPedidos || [];
      const validStatuses = ["completed", "confirmed", "rating", "preparing", "ready"];

      const pagos = userPedidos
        .filter((p: any) => p.tomador_id === u.id && validStatuses.includes(p.status))
        .reduce((acc: number, p: any) => acc + Number(p.total || 0), 0);

      const recebidos = userPedidos
        .filter((p: any) => p.prestador_id === u.id && validStatuses.includes(p.status))
        .reduce((acc: number, p: any) => acc + Number(p.total || 0), 0);

      const birthMonth = getBirthMonth(u.id);
      const ticketsConsumidor = userPedidos.filter((p: any) => p.tomador_id === u.id && validStatuses.includes(p.status)).length;
      const ticketsTrabalhador = (u.role === "prestador" || isColab || isDiarista)
        ? userPedidos.filter((p: any) => p.prestador_id === u.id && validStatuses.includes(p.status)).length
        : 0;
      const contribComunidade = (pagos + recebidos) * 0.01;
      const donations = getDonations(u.id, contribComunidade);
      const status = u.status || "active";

      return {
        id: u.id,
        name: u.nome,
        role: u.role.startsWith("cocoecia") || u.role === "prestador" ? "prestador" : "tomador",
        email: u.email || "Não informado",
        phone: u.phone || "Não cadastrado",
        createdAt: u.created_at || new Date().toISOString(),
        kycStatus: u.role === "prestador" || isColab ? "approved" : "pending",
        categories: categories.length > 0 ? categories : undefined,
        plate: caminhao?.plate || undefined,
        rating: ratingVal,
        totalRides: totalRidesVal,
        status,
        pagos,
        recebidos,
        birthMonth,
        ticketsConsumidor,
        ticketsTrabalhador,
        contribComunidade,
        donations,
      };
    });
  }, [dbUsers, dbPedidos, diaristasMap, caminhoesMap, filterPeriod]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return users.filter((u) => {
      const okTab = tab === "todos" || 
        (tab === "tomadores" && u.role === "tomador") || 
        (tab === "prestadores" && (u.role === "prestador" || (u.recebidos ?? 0) > 0));
      const okQ = !ql || u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql);
      const okMonth = filterMonth === "all" || u.birthMonth === Number(filterMonth);
      const okCategory = filterCategory === "all" || (u.categories ?? []).includes(filterCategory);
      return okTab && okQ && okMonth && okCategory;
    });
  }, [users, tab, q, filterMonth, filterCategory]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "tomadores", label: "Tomadores" },
    { key: "prestadores", label: "Prestadores" },
  ];

  const total = filtered.length;
  const paged = useMemo(() => {
    return filtered.slice(page * pageSize, (page + 1) * pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 32 }}>
      {/* Desktop Title & Filters Bar */}
      <div className="hidden md:flex" style={{ flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Clientes</h1>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Buscar por nome"
              style={{
                width: "100%",
                height: 40,
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: "0 14px 0 38px",
                fontFamily: "DM Sans",
                fontSize: 14,
                color: "var(--admin-text)",
                outline: "none",
              }}
            />
          </div>

          <select
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(0); }}
            style={{
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "var(--admin-subtle)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Mês de Aniversário: Todos</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
            style={{
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "var(--admin-subtle)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Serviço: Todos</option>
            <option value="Reciclagem">Reciclagem</option>
            <option value="Diarista">Diarista</option>
            <option value="Mototaxi">Mototaxi</option>
            <option value="Geral">Geral (Outros)</option>
          </select>

          <select
            value={filterPeriod}
            onChange={(e) => { setFilterPeriod(e.target.value); setPage(0); }}
            style={{
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "var(--admin-subtle)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Período: Todo o período</option>
            <option value="today">Período: Hoje</option>
            <option value="week">Período: Última Semana</option>
            <option value="month">Período: Último Mês</option>
            <option value="year">Período: Último Ano</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            style={{
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "var(--admin-subtle)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value={10}>Exibir 10 por página</option>
            <option value={25}>Exibir 25 por página</option>
            <option value={50}>Exibir 50 por página</option>
            <option value={100}>Exibir 100 por página</option>
          </select>
        </div>
      </div>

      {/* Mobile Title & Filters Bar */}
      <div className="flex md:hidden" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Clientes</h1>
        
        <button
          onClick={() => setShowMobileFilters(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            background: "var(--admin-bg)",
            border: "1px solid var(--admin-border)",
            borderRadius: 10,
            padding: "0 16px",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--admin-subtle)",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <Filter size={16} color="var(--admin-subtle)" />
          Filtros
          {activeFiltersCount > 0 && (
            <span style={{
              background: "#0DB87E",
              color: "#fff",
              borderRadius: 99,
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--admin-border)", marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(0); }}
            style={{
              background: "none",
              border: "none",
              padding: "10px 0",
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 600,
              color: tab === t.key ? "#0DB87E" : "var(--admin-subtle)",
              borderBottom: tab === t.key ? "2px solid #0DB87E" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop view: Table */}
      <div className="hidden md:block">
        <Card style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["Nome", "Papel", "Cadastro", "Serviços", "Prêmio 1/5", "Prêmio 1/11", "Categoria", "Coletivo", "Recebidos", "Pagos"]
                    .map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: ["Prêmio 1/5", "Prêmio 1/11", "Coletivo", "Recebidos", "Pagos"].includes(h) ? "right" : "left",
                          padding: "12px 14px",
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
                {paged.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/clientes/${u.id}`)}
                    style={{ borderBottom: "1px solid var(--admin-border)", transition: "background 100ms", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} />
                        <div>
                          <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 500 }}>{u.name}</div>
                          {u.status !== "active" && (() => {
                            const rule = rules.find((r) => r.key === u.status);
                            if (!rule) return null;
                            const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                            return (
                              <Pill bg={colors.bg} color={colors.color} border={colors.border} size="sm" style={{ marginTop: 2, display: "inline-block" }}>
                                {rule.label}
                              </Pill>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Pill bg="rgba(43,110,232,0.10)" color="#2B6EE8" size="sm">
                          tomador
                        </Pill>
                        {(u.role === "prestador" || (u.recebidos ?? 0) > 0) && (
                          <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                            prestador
                          </Pill>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {u.role === "prestador" && u.kycStatus ? (
                        <Pill {...KYC_PILL[u.kycStatus]} size="sm">
                          {KYC_PILL[u.kycStatus].label}
                        </Pill>
                      ) : (
                        <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(u.categories ?? []).map((c) => (
                          <Pill key={c} bg="var(--admin-bg)" color="var(--admin-subtle)" size="sm">
                            {c}
                          </Pill>
                        ))}
                        {(u.categories ?? []).length === 0 && (
                          <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 600 }}>
                      {u.ticketsTrabalhador ?? 0}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 600 }}>
                      {u.ticketsConsumidor ?? 0}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(u.donations ?? []).map((d, i) => (
                          <div key={i} style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                            {d.entity}
                          </div>
                        ))}
                        {(u.donations ?? []).length === 0 && (
                          <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                        {(u.donations ?? []).map((d, i) => (
                          <div key={i} style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "#9B59B6" }}>
                            {formatBR(d.amount)}
                          </div>
                        ))}
                        {(u.donations ?? []).length === 0 && (
                          <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>
                      {formatBR(u.recebidos || 0)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#E84040" }}>
                      {formatBR(u.pagos || 0)}
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile view: Cards list */}
      <div className="flex flex-col gap-4 md:hidden">
        {paged.map((u) => (
          <Card
            key={u.id}
            onClick={() => navigate(`/admin/clientes/${u.id}`)}
            style={{
              padding: 16,
              cursor: "pointer",
              background: "var(--admin-bg)",
              borderRadius: 16,
              border: "1px solid var(--admin-bg)",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.02)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              transition: "transform 150ms, box-shadow 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(15, 23, 42, 0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.02)";
            }}
          >
            {/* Header: Avatar & Names & Roles */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={u.name} size={42} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>
                      {u.name}
                    </div>
                    {u.status !== "active" && (() => {
                      const rule = rules.find((r) => r.key === u.status);
                      if (!rule) return null;
                      const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                      return (
                        <span style={{ fontSize: 9, fontWeight: 600, background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "1px 4px" }}>
                          {rule.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: "DM Sans",
                      fontSize: 10,
                      fontWeight: 600,
                      background: "rgba(43, 110, 232, 0.08)",
                      color: "#2B6EE8",
                      borderRadius: 6,
                      padding: "2px 6px"
                    }}>
                      tomador
                    </span>
                    {(u.role === "prestador" || (u.recebidos ?? 0) > 0) && (
                      <span style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        background: "rgba(13, 184, 126, 0.08)",
                        color: "#0DB87E",
                        borderRadius: 6,
                        padding: "2px 6px"
                      }}>
                        prestador
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {u.role === "prestador" && u.kycStatus && (
                  <span style={{
                    fontFamily: "DM Sans",
                    fontSize: 11,
                    fontWeight: 600,
                    background: u.kycStatus === "approved" ? "rgba(13, 184, 126, 0.1)" : "rgba(245, 166, 35, 0.1)",
                    color: u.kycStatus === "approved" ? "#0DB87E" : "#F5A623",
                    borderRadius: 99,
                    padding: "2px 10px"
                  }}>
                    {u.kycStatus === "approved" ? "Aprovado" : "Pendente"}
                  </span>
                )}
                <ChevronRight size={18} color="var(--admin-muted)" />
              </div>
            </div>

            {/* Services / Categories Tags */}
            {(u.categories ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(u.categories ?? []).map((c) => (
                  <span key={c} style={{
                    fontFamily: "DM Sans",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--admin-bg)",
                    color: "var(--admin-subtle)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 6,
                    padding: "2px 8px"
                  }}>
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* 2x2 KPIs Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* Prêmio 1/5 */}
              <div style={{ background: "var(--admin-bg)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--admin-bg)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(13, 184, 126, 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Award size={14} color="#0DB87E" />
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 9, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Prêmio 1/5</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginTop: 1 }}>
                    {u.ticketsTrabalhador ?? 0}
                  </div>
                </div>
              </div>

              {/* Prêmio 1/11 */}
              <div style={{ background: "var(--admin-bg)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--admin-bg)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(43, 110, 232, 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gift size={14} color="#2B6EE8" />
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 9, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Prêmio 1/11</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginTop: 1 }}>
                    {u.ticketsConsumidor ?? 0}
                  </div>
                </div>
              </div>

              {/* Recebidos */}
              <div style={{ background: "var(--admin-bg)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--admin-bg)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(13, 184, 126, 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowUpRight size={14} color="#0DB87E" />
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 9, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Recebidos</div>
                  <div style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: "#0DB87E", marginTop: 1 }}>
                    {formatBR(u.recebidos || 0)}
                  </div>
                </div>
              </div>

              {/* Pagos */}
              <div style={{ background: "var(--admin-bg)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--admin-bg)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(232, 64, 64, 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowDownLeft size={14} color="#E84040" />
                </div>
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 9, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Pagos</div>
                  <div style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: "#E84040", marginTop: 1 }}>
                    {formatBR(u.pagos || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Coletivo (Doações) Box */}
            {(u.donations ?? []).length > 0 && (
              <div style={{
                background: "rgba(155, 89, 182, 0.02)",
                border: "1px solid rgba(155, 89, 182, 0.08)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Heart size={13} color="#9B59B6" fill="#9B59B6" style={{ opacity: 0.8 }} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 10, fontWeight: 700, color: "#9B59B6", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Doações Coletivo
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(u.donations ?? []).map((d, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>{d.entity}</span>
                      <span style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: "#9B59B6" }}>
                        {formatBR(d.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
        {paged.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <>
          <div
            onClick={() => setShowMobileFilters(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 1050,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "var(--admin-bg)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "24px 20px 32px",
              zIndex: 1060,
              boxShadow: "0 -10px 25px -5px rgba(15, 23, 42, 0.1), 0 -8px 10px -6px rgba(15, 23, 42, 0.1)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Filtros de Clientes
              </h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={20} color="var(--admin-subtle)" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Search Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Buscar por nome</span>
                <div style={{ position: "relative" }}>
                  <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
                  <input
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(0); }}
                    placeholder="Digite o nome..."
                    style={{
                      width: "100%",
                      height: 40,
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 10,
                      padding: "0 14px 0 38px",
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      color: "var(--admin-text)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Category Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Serviço / Categoria</span>
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                  style={{
                    width: "100%",
                    height: 42,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "var(--admin-subtle)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">Todos os Serviços</option>
                  <option value="Reciclagem">Reciclagem</option>
                  <option value="Diarista">Diarista</option>
                  <option value="Mototaxi">Mototaxi</option>
                  <option value="Geral">Geral (Outros)</option>
                </select>
              </div>

              {/* Month Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Mês de Aniversário</span>
                <select
                  value={filterMonth}
                  onChange={(e) => { setFilterMonth(e.target.value); setPage(0); }}
                  style={{
                    width: "100%",
                    height: 42,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "var(--admin-subtle)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">Todos os Meses</option>
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Period Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Período dos Dados</span>
                <select
                  value={filterPeriod}
                  onChange={(e) => { setFilterPeriod(e.target.value); setPage(0); }}
                  style={{
                    width: "100%",
                    height: 42,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "var(--admin-subtle)",
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

              {/* Page Size Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Clientes por Página</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  style={{
                    width: "100%",
                    height: 42,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "var(--admin-subtle)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value={10}>10 Clientes</option>
                  <option value={25}>25 Clientes</option>
                  <option value={50}>50 Clientes</option>
                  <option value={100}>100 Clientes</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <button
                onClick={() => {
                  setQ("");
                  setFilterCategory("all");
                  setFilterMonth("all");
                  setFilterPeriod("all");
                  setPageSize(10);
                  setPage(0);
                }}
                style={{
                  flex: 1,
                  height: 44,
                  background: "var(--admin-bg)",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--admin-subtle)",
                  cursor: "pointer",
                }}
              >
                Limpar Filtros
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                style={{
                  flex: 1,
                  height: 44,
                  background: "#0DB87E",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Pagination Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-muted)" }}>
          Mostrando {total === 0 ? 0 : page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} de {total} clientes
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 8,
              padding: "6px 12px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "var(--admin-subtle)",
              cursor: page === 0 ? "not-allowed" : "pointer",
              opacity: page === 0 ? 0.5 : 1
            }}
          >
            ← Anterior
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 8,
              padding: "6px 12px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "var(--admin-subtle)",
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
              opacity: page >= totalPages - 1 ? 0.5 : 1
            }}
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  );
}
