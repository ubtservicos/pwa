import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Filter, ChevronRight, Award, Gift, ArrowUpRight, ArrowDownLeft, Building2, Eye, Copy, Check } from "lucide-react";
import { getAppOrigin } from "@/lib/appUrl";
import { maskCPF } from "@/utils/masks";
import { Card, Avatar, Pill, KYC_PILL } from "@/components/admin/ui";
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

export default function AdminClientesPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbProfiles, setDbProfiles] = useState<any[]>([]);
  const [dbPedidos, setDbPedidos] = useState<any[]>([]);
  const [dbWaitlist, setDbWaitlist] = useState<any[]>([]);
  const [mototaxisMap, setMototaxisMap] = useState<Map<string, any>>(new Map());
  const [diaristasMap, setDiaristasMap] = useState<Map<string, any>>(new Map());
  const [caminhoesMap, setCaminhoesMap] = useState<Map<string, any>>(new Map());
  const [userAssocMap, setUserAssocMap] = useState<Map<string, string>>(new Map());
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
  const [selectedUserModal, setSelectedUserModal] = useState<any | null>(null);
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
        // 1. Buscar usuários
        const { data: rawUsers, error: errUsers } = await supabase
          .from("usuarios")
          .select("*");
        if (errUsers) throw errUsers;

        // 2. Buscar profiles para complementar dados
        const { data: rawProfiles } = await supabase
          .from("profiles")
          .select("*");
        
        // 3. Buscar mototaxi
        const { data: rawMototaxis } = await supabase
          .from("prestador_mototaxi")
          .select("user_id, kyc_status, modalidade, plate, is_online");
        const motoMap = new Map<string, any>();
        if (rawMototaxis) {
          rawMototaxis.forEach((m) => motoMap.set(m.user_id, m));
        }

        // 4. Buscar diarista_perfis
        const { data: diaristas } = await supabase
          .from("diarista_perfis")
          .select("user_id, rating, total_servicos, is_online");
        const dMap = new Map<string, any>();
        if (diaristas) {
          diaristas.forEach((d) => dMap.set(d.user_id, d));
        }

        // 5. Buscar coco_caminhoes
        const { data: caminhoes } = await supabase
          .from("coco_caminhoes")
          .select("prestador_id, plate, status_aprovacao, is_online");
        const cMap = new Map<string, any>();
        if (caminhoes) {
          caminhoes.forEach((c) => cMap.set(c.prestador_id, c));
        }

        // 6. Buscar associações reais
        const { data: assocs } = await supabase
          .from("associations")
          .select("id, name");
        const assocNames = new Map<string, string>();
        if (assocs) {
          assocs.forEach((a) => assocNames.set(a.id, a.name));
        }

        const { data: provAssocs } = await supabase
          .from("provider_associations")
          .select("provider_id, association_id");
        const { data: membAssocs } = await supabase
          .from("associacao_membros")
          .select("prestador_id, associacao_id");

        const uAssocMap = new Map<string, string>();
        if (provAssocs) {
          provAssocs.forEach((pa) => {
            if (assocNames.has(pa.association_id)) {
              uAssocMap.set(pa.provider_id, assocNames.get(pa.association_id)!);
            }
          });
        }
        if (membAssocs) {
          membAssocs.forEach((ma) => {
            if (assocNames.has(ma.association_id)) {
              uAssocMap.set(ma.prestador_id, assocNames.get(ma.association_id)!);
            }
          });
        }

        // 7. Buscar pedidos para cálculo financeiro
        const { data: rawPedidos } = await supabase
          .from("pedidos")
          .select("tomador_id, prestador_id, total, status, created_at");

        const { data: rawWaitlist } = await supabase.from("waitlist").select("id, email, telefone, user_id, cadastro_completo, status");
        if (rawWaitlist) setDbWaitlist(rawWaitlist);
        setDbUsers(rawUsers || []);
        setDbProfiles(rawProfiles || []);
        setMototaxisMap(motoMap);
        setDiaristasMap(dMap);
        setCaminhoesMap(cMap);
        setUserAssocMap(uAssocMap);
        setDbPedidos(rawPedidos || []);
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
    if (dbUsers.length === 0 && dbProfiles.length === 0) return [];
    
    const profMap = new Map<string, any>();
    dbProfiles.forEach((p) => profMap.set(p.id, p));

    const cleanPhone = (p: string) => String(p || "").replace(/\D/g, "");
    const wlPhoneMap = new Map<string, any>();
    const wlEmailMap = new Map<string, any>();
    const wlUserIdMap = new Map<string, any>();
    dbWaitlist.forEach((w) => {
      if (w.telefone) wlPhoneMap.set(cleanPhone(w.telefone), w);
      if (w.email) wlEmailMap.set(String(w.email).toLowerCase().trim(), w);
      if (w.user_id) wlUserIdMap.set(w.user_id, w);
      if (w.id) wlUserIdMap.set(w.id, w);
    });

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
      const prof = profMap.get(u.id);
      const moto = mototaxisMap.get(u.id);
      const diarista = diaristasMap.get(u.id);
      const caminhao = caminhoesMap.get(u.id);

      // Serviços Ativos Reais
      const services: string[] = [];

      // Mototáxi: apenas se aprovado na tabela de mototáxi
      if (moto && moto.kyc_status === "approved") {
        services.push(moto.modalidade === "entrega" ? "Entrega" : "Mototáxi");
      }

      // Diarista: se cadastrado em diarista_perfis
      if (diarista) {
        services.push("Diarista");
      }

      // Reciclagem: se aprovado em coco_caminhoes ou com papel cocoecia
      const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
      if (isColab || (caminhao && caminhao.status_aprovacao === "approved")) {
        services.push("Reciclagem");
      }

      // KYC Status
      let kycStatus: "approved" | "pending" | "rejected" | undefined = undefined;
      if (moto) {
        kycStatus = moto.kyc_status;
      } else if (caminhao) {
        kycStatus = caminhao.status_aprovacao === "approved" ? "approved" : "pending";
      } else if (diarista) {
        kycStatus = "approved";
      } else if (u.role === "prestador" || isColab) {
        kycStatus = "pending";
      }

      // Associação Real
      const associacao = userAssocMap.get(u.id) || null;

      const ratingVal = diarista ? Number(diaristasMap.get(u.id).rating || 5.0) : null;
      const totalRidesVal = diarista ? Number(diaristasMap.get(u.id).total_servicos || 0) : undefined;

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
      const ticketsTrabalhador = (u.role === "prestador" || isColab || diarista || moto)
        ? userPedidos.filter((p: any) => p.prestador_id === u.id && validStatuses.includes(p.status)).length
        : 0;
      
      const contribComunidade = (pagos + recebidos) * 0.01;
      const status = u.status || (prof?.is_active === false ? "inactive" : "active");
      const name = u.nome || u.razao_social || prof?.name || "Sem nome";
      const email = u.email || prof?.email || "Não informado";
      const phone = u.telefone || prof?.phone || u.phone || "Não cadastrado";
      const rawCpf = u.cpf || prof?.cpf || null;
      const cpf = rawCpf ? maskCPF(rawCpf) : "Não informado";
      const userPhoneDigits = cleanPhone(u.telefone || prof?.phone || u.phone || "");
      const userEmailClean = String(u.email || prof?.email || "").toLowerCase().trim();
      const matchedWl = wlUserIdMap.get(u.id) || (userPhoneDigits ? wlPhoneMap.get(userPhoneDigits) : null) || (userEmailClean ? wlEmailMap.get(userEmailClean) : null);
      const isCadastroCompleto = u.cadastro_completo === true || u.metadata?.cadastro_completo === true || matchedWl?.cadastro_completo === true;
      const isPendente = u.status === "pendente_aprovacao" || u.status === "pending" || matchedWl?.status === "pendente_aprovacao" || matchedWl?.status === "pending";

      return {
        id: u.id,
        name,
        role: (u.role && (u.role.startsWith("cocoecia") || u.role === "prestador")) || services.length > 0 ? "prestador" : "tomador",
        email,
        phone,
        cpf,
        createdAt: u.created_at || prof?.created_at || new Date().toISOString(),
        kycStatus,
        services,
        associacao,
        plate: moto?.plate || caminhao?.plate || undefined,
        rating: ratingVal,
        totalRides: totalRidesVal,
        status,
        pagos,
        recebidos,
        birthMonth,
        ticketsConsumidor,
        ticketsTrabalhador,
        contribComunidade,
        cadastroCompleto: isCadastroCompleto,
        isPendente,
      };
    });
  }, [dbUsers, dbProfiles, dbPedidos, mototaxisMap, diaristasMap, caminhoesMap, userAssocMap, dbWaitlist, filterPeriod]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return users.filter((u) => {
      const okTab = tab === "todos" || 
        (tab === "tomadores" && u.role === "tomador") || 
        (tab === "prestadores" && (u.role === "prestador" || (u.recebidos ?? 0) > 0));
      const okQ = !ql || u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql);
      const okMonth = filterMonth === "all" || u.birthMonth === Number(filterMonth);
      const okCategory = filterCategory === "all" || (u.services ?? []).includes(filterCategory);
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
            <option value="Mototáxi">Mototáxi</option>
            <option value="Diarista">Diarista</option>
            <option value="Reciclagem">Reciclagem</option>
            <option value="Entrega">Entrega</option>
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
                  {["Nome", "Papel", "Cadastro", "Serviços", "Prêmio 1/5", "Prêmio 1/11", "Associação", "Coletivo", "Recebidos", "Pagos", "Ações"]
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
                        {(u.role === "prestador" || (u.recebidos ?? 0) > 0 || (u.services ?? []).length > 0) && (
                          <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                            prestador
                          </Pill>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {u.isPendente ? (
                        <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                          Pendente
                        </span>
                      ) : u.cadastroCompleto ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                          Completo
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                          Incompleto
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(u.services ?? []).map((s: string) => (
                          <Pill key={s} bg="var(--admin-bg)" color="var(--admin-subtle)" size="sm">
                            {s}
                          </Pill>
                        ))}
                        {(u.services ?? []).length === 0 && (
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
                      {u.associacao ? (
                        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", fontWeight: 500 }}>
                          {u.associacao}
                        </span>
                      ) : (
                        <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {u.contribComunidade > 0 ? (
                        <span style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "#9B59B6" }}>
                          {formatBR(u.contribComunidade)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>
                      {formatBR(u.recebidos || 0)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#E84040" }}>
                      {formatBR(u.pagos || 0)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUserModal(u);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--admin-border)",
                          background: "var(--admin-bg)",
                          color: "#2B6EE8",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Eye size={13} /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
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
                    {(u.role === "prestador" || (u.recebidos ?? 0) > 0 || (u.services ?? []).length > 0) && (
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
                {u.isPendente ? (
                  <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-xs font-semibold">
                    Pendente
                  </span>
                ) : u.cadastroCompleto ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold">
                    Completo
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold">
                    Incompleto
                  </span>
                )}
                <ChevronRight size={18} color="var(--admin-muted)" />
              </div>
            </div>

            {/* Services Tags */}
            {(u.services ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(u.services ?? []).map((s: string) => (
                  <span key={s} style={{
                    fontFamily: "DM Sans",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--admin-bg)",
                    color: "var(--admin-subtle)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 6,
                    padding: "2px 8px"
                  }}>
                    {s}
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

            {/* Associação & Coletivo Box */}
            {(u.associacao || u.contribComunidade > 0) && (
              <div style={{
                background: "rgba(155, 89, 182, 0.03)",
                border: "1px solid rgba(155, 89, 182, 0.1)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={13} color="#9B59B6" style={{ opacity: 0.8 }} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 10, fontWeight: 700, color: "#9B59B6", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Associação & Fundo Coletivo
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>{u.associacao || "Sem associação vinculada"}</span>
                  <span style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: "#9B59B6" }}>
                    {formatBR(u.contribComunidade)}
                  </span>
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
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)" }}>Serviço</span>
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
                  <option value="Mototáxi">Mototáxi</option>
                  <option value="Diarista">Diarista</option>
                  <option value="Reciclagem">Reciclagem</option>
                  <option value="Entrega">Entrega</option>
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

      {/* Modal de Detalhes do Cliente com Link de Atualização Cadastral */}
      {selectedUserModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedUserModal(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.70)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}
          >
            <button
              onClick={() => setSelectedUserModal(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="var(--admin-subtle)" />
            </button>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
              Detalhes do Cliente
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "DM Sans" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={selectedUserModal.name} size={42} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)" }}>{selectedUserModal.name}</div>
                  <div style={{ fontSize: 12, color: "var(--admin-subtle)", marginTop: 2 }}>
                    {selectedUserModal.email} | {selectedUserModal.phone}
                  </div>
                </div>
              </div>

              {/* Grid 2 colunas com dados principais */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 12, borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Papel / Perfil</span>
                  <div style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600, marginTop: 2 }}>{selectedUserModal.role}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>CPF / Documento</span>
                  <div style={{ fontSize: 13, color: "var(--admin-subtle)", fontWeight: 600, marginTop: 2 }}>{selectedUserModal.cpf || "Não informado"}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
                  <div style={{ fontSize: 13, color: "#0DB87E", fontWeight: 600, marginTop: 2 }}>{selectedUserModal.status || "ativo"}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Associação</span>
                  <div style={{ fontSize: 13, color: "var(--admin-subtle)", marginTop: 2 }}>{selectedUserModal.associacao || "Nenhuma"}</div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status do Cadastro</span>
                  <div style={{ marginTop: 4 }}>
                    {selectedUserModal.isPendente ? (
                      <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                        Pendente de Aprovação
                      </span>
                    ) : selectedUserModal.cadastroCompleto ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5">
                        ✓ Cadastro Completo (Aprovado)
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5">
                        ⚠ Incompleto (Aguardando dados complementares)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Links de Acesso e Atualização Cadastral */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                  Ações e Links Operacionais
                </div>

                {/* Link de Atualização Cadastral */}
                {(() => {
                  const telLimpo = String(selectedUserModal.phone ?? "").replace(/\D/g, "");
                  const linkAtualizacao = `${getAppOrigin()}/atualizacao-cadastral?tel=${telLimpo}`;
                  const firstName = String(selectedUserModal.name ?? "Cliente").trim().split(" ")[0];
                  const waMsg = `Olá, ${firstName}! Aqui é da equipe UBT Serviços. Para dar continuidade ao seu cadastro e configuração de localização, acesse este link seguro: ${linkAtualizacao}`;
                  const formattedPhone = telLimpo.length >= 10 && !telLimpo.startsWith("55") ? `55${telLimpo}` : telLimpo;
                  const waLink = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waMsg)}`;

                  return (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Link de Atualização Cadastral (Fluxo Geográfico):</span>
                        {telLimpo ? (
                          <span style={{ fontSize: 10, color: "#0DB87E", fontWeight: 600 }}>Pronto para envio</span>
                        ) : (
                          <span style={{ fontSize: 10, color: "#E84040", fontWeight: 600 }}>Telefone não cadastrado</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <input
                          readOnly
                          type="text"
                          value={telLimpo ? linkAtualizacao : "Telefone do usuário não informado"}
                          style={{
                            flex: 1,
                            minWidth: 200,
                            background: "var(--admin-bg)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "var(--admin-text)",
                            outline: "none",
                            cursor: telLimpo ? "text" : "not-allowed",
                            opacity: telLimpo ? 1 : 0.6,
                          }}
                          onClick={(e) => telLimpo && (e.target as HTMLInputElement).select()}
                        />
                        <button
                          type="button"
                          disabled={!telLimpo}
                          onClick={() => handleCopyLink(linkAtualizacao, "atualizacao")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--admin-border)",
                            background: copiedLink === "atualizacao" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                            color: copiedLink === "atualizacao" ? "#0DB87E" : "var(--admin-text)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: telLimpo ? "pointer" : "not-allowed",
                            opacity: telLimpo ? 1 : 0.5,
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {copiedLink === "atualizacao" ? (
                            <>
                              <Check size={13} color="#0DB87E" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copiar
                            </>
                          )}
                        </button>
                        {telLimpo && (
                          <>
                            <a
                              href={linkAtualizacao}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--admin-border)",
                                background: "var(--admin-bg)",
                                color: "#2B6EE8",
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Abrir
                            </a>
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "6px 12px",
                                borderRadius: 6,
                                background: "#25D366",
                                color: "#000000",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                textDecoration: "none",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Link de Onboarding */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Link de Onboarding:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      readOnly
                      type="text"
                      value={`${getAppOrigin()}/onboarding?token=${selectedUserModal.id}`}
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
                      onClick={() => handleCopyLink(`${getAppOrigin()}/onboarding?token=${selectedUserModal.id}`, "onboarding")}
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
              </div>

              {/* Botões do Rodapé do Modal */}
              <div style={{ borderTop: "1px solid var(--admin-border)", marginTop: 8, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/clientes/${selectedUserModal.id}`)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--admin-border)",
                    background: "var(--admin-surface)",
                    color: "var(--admin-text)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver Perfil Financeiro Completo →
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserModal(null)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--admin-border)",
                    background: "var(--admin-bg)",
                    color: "var(--admin-subtle)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
