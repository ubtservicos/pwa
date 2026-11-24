import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Filter,
  Eye,
  Trash2,
  Ban,
  ShieldCheck,
  MessageCircle,
  Copy,
  Check,
} from "lucide-react";
import { maskCPF, generateReferralSlug } from "@/utils/masks";
import { Card, Avatar, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  DeleteClientAlertModal,
  BlockClientModal,
  WhatsAppClientModal,
  isUserBlockedActive,
  formatBlockedSummary,
  type AdminActionClientTarget,
} from "@/components/admin/AdminClienteActionsModals";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";

type Tab = "todos" | "tomadores" | "prestadores";
type PixFilter = "all" | "com_pix" | "sem_pix";

const getBirthMonth = (id: string, dataNascimento?: string | null) => {
  if (dataNascimento) {
    const parsed = new Date(dataNascimento);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.getUTCMonth() + 1;
    }
  }
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return (sum % 12) + 1;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  const [filterPix, setFilterPix] = useState<PixFilter>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [rules, setRules] = useState<StatusRule[]>([]);
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);

  // Action Modals
  const [deleteTarget, setDeleteTarget] = useState<AdminActionClientTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminActionClientTarget | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<AdminActionClientTarget | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (q) count++;
    if (filterMonth !== "all") count++;
    if (filterCategory !== "all") count++;
    if (filterPeriod !== "all") count++;
    if (filterPix !== "all") count++;
    return count;
  }, [q, filterMonth, filterCategory, filterPeriod, filterPix]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data: rawUsers, error: errUsers } = await supabase
          .from("usuarios")
          .select("*");

        if (errUsers) {
          console.error("Erro ao buscar tabela usuarios:", errUsers);
        }
        setDbUsers(rawUsers || []);

        const [
          profilesRes,
          motoRes,
          diaristasRes,
          caminhoesRes,
          assocsRes,
          provAssocsRes,
          membAssocsRes,
          pedidosRes,
          waitlistRes,
        ] = await Promise.allSettled([
          supabase.from("profiles").select("*"),
          supabase.from("prestador_mototaxi").select("user_id, kyc_status, modalidade, plate, is_online"),
          supabase.from("diarista_perfis").select("user_id, rating, total_servicos, is_online"),
          supabase.from("coco_caminhoes").select("prestador_id, plate, status_aprovacao, is_online"),
          supabase.from("associations").select("id, name"),
          supabase.from("provider_associations").select("provider_id, association_id"),
          supabase.from("associacao_membros").select("*"),
          supabase.from("pedidos").select("tomador_id, prestador_id, status, created_at"),
          supabase
            .from("waitlist")
            .select("id, email, telefone, user_id, cadastro_completo, status, referral_code, referral_slug, slug, padrinho_id, tipo_cadastro, cnpj, chave_pix, pix_chave, tipo_chave_pix, data_nascimento"),
        ]);

        if (profilesRes.status === "fulfilled" && profilesRes.value.data) {
          setDbProfiles(profilesRes.value.data);
        }

        const motoMap = new Map<string, any>();
        if (motoRes.status === "fulfilled" && motoRes.value.data) {
          motoRes.value.data.forEach((m: any) => motoMap.set(m.user_id, m));
        }
        setMototaxisMap(motoMap);

        const dMap = new Map<string, any>();
        if (diaristasRes.status === "fulfilled" && diaristasRes.value.data) {
          diaristasRes.value.data.forEach((d: any) => dMap.set(d.user_id, d));
        }
        setDiaristasMap(dMap);

        const cMap = new Map<string, any>();
        if (caminhoesRes.status === "fulfilled" && caminhoesRes.value.data) {
          caminhoesRes.value.data.forEach((c: any) => cMap.set(c.prestador_id, c));
        }
        setCaminhoesMap(cMap);

        const assocNames = new Map<string, string>();
        if (assocsRes.status === "fulfilled" && assocsRes.value.data) {
          assocsRes.value.data.forEach((a: any) => assocNames.set(a.id, a.name));
        }

        const uAssocMap = new Map<string, string>();
        if (provAssocsRes.status === "fulfilled" && provAssocsRes.value.data) {
          provAssocsRes.value.data.forEach((pa: any) => {
            if (assocNames.has(pa.association_id)) {
              uAssocMap.set(pa.provider_id, assocNames.get(pa.association_id)!);
            }
          });
        }
        if (membAssocsRes.status === "fulfilled" && membAssocsRes.value.data) {
          membAssocsRes.value.data.forEach((ma: any) => {
            const assocId = ma.associacao_id || ma.association_id;
            if (assocId && assocNames.has(assocId)) {
              uAssocMap.set(ma.prestador_id, assocNames.get(assocId)!);
            }
          });
        }
        setUserAssocMap(uAssocMap);

        if (pedidosRes.status === "fulfilled" && pedidosRes.value.data) {
          setDbPedidos(pedidosRes.value.data);
        }

        if (waitlistRes.status === "fulfilled" && waitlistRes.value.data) {
          setDbWaitlist(waitlistRes.value.data);
        }
      } catch (e) {
        console.error("Erro geral no carregamento de usuários:", e);
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
      const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
      if (filterPeriod === "today") return diffDays <= 1;
      if (filterPeriod === "week") return diffDays <= 7;
      if (filterPeriod === "month") return diffDays <= 30;
      if (filterPeriod === "year") return diffDays <= 365;
      return true;
    });

    return dbUsers
      .filter((u: any) => {
        const userPhoneDigits = cleanPhone(u.telefone || u.phone || "");
        const userEmailClean = String(u.email || "").toLowerCase().trim();
        const matchedWl =
          wlUserIdMap.get(u.id) ||
          (userPhoneDigits ? wlPhoneMap.get(userPhoneDigits) : null) ||
          (userEmailClean ? wlEmailMap.get(userEmailClean) : null);

        const isPJ =
          u.role === "associacao" ||
          u.tipo_pessoa === "PJ" ||
          Boolean(u.cnpj) ||
          u.metadata?.tipo_cadastro === "pj" ||
          u.metadata?.tipo_cadastro === "PJ" ||
          matchedWl?.tipo_cadastro === "PJ" ||
          matchedWl?.tipo_cadastro === "pj" ||
          Boolean(matchedWl?.cnpj);
        return !isPJ;
      })
      .map((u: any) => {
        const prof = profMap.get(u.id);
        const moto = mototaxisMap.get(u.id);
        const diarista = diaristasMap.get(u.id);
        const caminhao = caminhoesMap.get(u.id);

        const services: string[] = [];
        if (moto && moto.kyc_status === "approved") {
          services.push(moto.modalidade === "entrega" ? "Entrega" : "Mototáxi");
        }
        if (diarista) {
          services.push("Diarista");
        }
        const isColab =
          u.role === "cocoecia-colaborador" ||
          u.role === "cocoecia-dirigentes" ||
          u.role === "cocoecia";
        if (isColab || (caminhao && caminhao.status_aprovacao === "approved")) {
          services.push("Reciclagem");
        }

        const associacao = userAssocMap.get(u.id) || null;
        const validStatuses = ["completed", "confirmed", "rating", "preparing", "ready"];

        const ticketsConsumidor = filteredPedidos.filter(
          (p: any) => p.tomador_id === u.id && validStatuses.includes(p.status),
        ).length;
        const ticketsTrabalhador =
          u.role === "prestador" || isColab || diarista || moto
            ? filteredPedidos.filter(
                (p: any) => p.prestador_id === u.id && validStatuses.includes(p.status),
              ).length
            : 0;

        const status = u.status || (prof?.is_active === false ? "inactive" : "active");
        const name = u.nome || u.razao_social || prof?.name || "Sem nome";
        const email = u.email || prof?.email || "Não informado";
        const phone = u.telefone || prof?.phone || u.phone || "Não cadastrado";
        const rawCpf = u.cpf || prof?.cpf || null;
        const cpf = rawCpf ? maskCPF(rawCpf) : "Não informado";

        const userPhoneDigits = cleanPhone(u.telefone || prof?.phone || u.phone || "");
        const userEmailClean = String(u.email || prof?.email || "").toLowerCase().trim();
        const matchedWl =
          wlUserIdMap.get(u.id) ||
          (userPhoneDigits ? wlPhoneMap.get(userPhoneDigits) : null) ||
          (userEmailClean ? wlEmailMap.get(userEmailClean) : null);

        const isCadastroCompleto =
          u.cadastro_completo === true ||
          u.metadata?.cadastro_completo === true ||
          matchedWl?.cadastro_completo === true;
        const isPendente =
          u.status === "pendente_aprovacao" ||
          u.status === "pending" ||
          matchedWl?.status === "pendente_aprovacao" ||
          matchedWl?.status === "pending";

        const rawSlug =
          u.referral_code ||
          matchedWl?.referral_code ||
          matchedWl?.slug ||
          u.metadata?.referral_code ||
          "";
        const referralSlug = String(rawSlug || generateReferralSlug(name, u.cpf || u.id) || "").trim();

        const dataNascimento =
          u.metadata?.data_nascimento || matchedWl?.data_nascimento || prof?.data_nascimento || null;
        const birthMonth = getBirthMonth(u.id, dataNascimento);

        const chavePix = String(
          u.chave_pix || prof?.pix_key || matchedWl?.chave_pix || matchedWl?.pix_chave || "",
        ).trim();

        const isBlocked = Boolean(u.is_blocked);
        const blockedUntil = u.blocked_until || null;
        const blockDurationLabel = u.block_duration_label || null;
        const blockedReason = u.blocked_reason || null;

        return {
          id: u.id,
          name,
          role:
            (u.role && (u.role.startsWith("cocoecia") || u.role === "prestador")) ||
            services.length > 0
              ? "prestador"
              : "tomador",
          email,
          phone,
          cpf,
          referralSlug,
          createdAt: u.created_at || prof?.created_at || new Date().toISOString(),
          services,
          associacao,
          status,
          birthMonth,
          ticketsConsumidor,
          ticketsTrabalhador,
          cadastroCompleto: isCadastroCompleto,
          isPendente,
          chavePix,
          hasPix: Boolean(chavePix),
          isBlocked,
          blockedUntil,
          blockDurationLabel,
          blockedReason,
          isBlockedActive: isUserBlockedActive({ isBlocked, blockedUntil }),
        };
      });
  }, [
    dbUsers,
    dbProfiles,
    dbPedidos,
    mototaxisMap,
    diaristasMap,
    caminhoesMap,
    userAssocMap,
    dbWaitlist,
    filterPeriod,
  ]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return users.filter((u) => {
      const okTab =
        tab === "todos" ||
        (tab === "tomadores" && u.role === "tomador") ||
        (tab === "prestadores" && u.role === "prestador");
      const okQ =
        !ql ||
        u.name.toLowerCase().includes(ql) ||
        u.email.toLowerCase().includes(ql) ||
        u.referralSlug.toLowerCase().includes(ql);
      const okMonth = filterMonth === "all" || u.birthMonth === Number(filterMonth);
      const okCategory = filterCategory === "all" || (u.services ?? []).includes(filterCategory);
      const okPix =
        filterPix === "all" ||
        (filterPix === "com_pix" && u.hasPix) ||
        (filterPix === "sem_pix" && !u.hasPix);
      return okTab && okQ && okMonth && okCategory && okPix;
    });
  }, [users, tab, q, filterMonth, filterCategory, filterPix]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "tomadores", label: "Tomadores" },
    { key: "prestadores", label: "Prestadores" },
  ];

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filtered, safePage, pageSize],
  );

  const handleCopySlug = async (slug: string, userId: string) => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopiedSlugId(userId);
      toast.show(`Slug "@${slug}" copiado! ✓`);
      setTimeout(() => setCopiedSlugId(null), 2000);
    } catch {
      toast.show("Não foi possível copiar o slug.");
    }
  };

  const toActionTarget = (u: any): AdminActionClientTarget => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    slug: u.referralSlug,
    isBlocked: u.isBlocked,
    blockedUntil: u.blockedUntil,
    blockDurationLabel: u.blockDurationLabel,
    blockedReason: u.blockedReason,
  });

  const handleClientDeleted = (deletedUserId: string) => {
    setDbUsers((prev) => prev.filter((item) => item.id !== deletedUserId));
    setDbProfiles((prev) => prev.filter((item) => item.id !== deletedUserId));
    toast.show("Cliente excluído definitivamente com sucesso! ✓");
  };

  const handleClientBlockUpdated = (
    userId: string,
    patch: {
      isBlocked: boolean;
      blockedUntil: string | null;
      blockDurationLabel: string | null;
      blockedReason: string | null;
      status: string;
    },
  ) => {
    setDbUsers((prev) =>
      prev.map((item) =>
        item.id === userId
          ? {
              ...item,
              is_blocked: patch.isBlocked,
              blocked_until: patch.blockedUntil,
              block_duration_label: patch.blockDurationLabel,
              blocked_reason: patch.blockedReason,
              status: patch.status,
            }
          : item,
      ),
    );
    toast.show(
      patch.isBlocked
        ? `Cliente bloqueado (${patch.blockDurationLabel || "ativo"}).`
        : "Cliente desbloqueado com sucesso! ✓",
    );
  };

  const selectStyle = {
    height: 40,
    background: "#0B0F14",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "0 12px",
    fontFamily: "DM Sans",
    fontSize: 13,
    color: "#E5E7EB",
    outline: "none",
    cursor: "pointer",
  } as const;

  return (
    <div style={{ padding: "28px 24px" }}>
      {/* Desktop Title & Filters Bar */}
      <div
        className="hidden md:flex"
        style={{
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "Syne",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--admin-text)",
              margin: 0,
            }}
          >
            Cadastro de Clientes
          </h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-muted)", margin: "2px 0 0" }}>
            Gestão cadastral, slug UBT, chave PIX, bloqueios e comunicação direta
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search size={15} color="#9CA3AF" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar nome, e-mail ou slug"
              style={{
                width: "100%",
                height: 40,
                background: "#0B0F14",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "0 14px 0 36px",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#F9FAFB",
                outline: "none",
              }}
            />
          </div>

          <select
            value={filterPix}
            onChange={(e) => {
              setFilterPix(e.target.value as PixFilter);
              setPage(0);
            }}
            style={{
              ...selectStyle,
              border:
                filterPix === "sem_pix"
                  ? "1px solid rgba(245, 158, 11, 0.7)"
                  : filterPix === "com_pix"
                    ? "1px solid rgba(16, 185, 129, 0.7)"
                    : "1px solid rgba(255,255,255,0.12)",
              color:
                filterPix === "sem_pix"
                  ? "#FBBF24"
                  : filterPix === "com_pix"
                    ? "#34D399"
                    : "#E5E7EB",
            }}
          >
            <option value="all">Chave PIX: Todos</option>
            <option value="com_pix">Com chave PIX</option>
            <option value="sem_pix">Sem chave PIX</option>
          </select>

          <select
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setPage(0);
            }}
            style={selectStyle}
          >
            <option value="all">Mês de Aniversário: Todos</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(0);
            }}
            style={selectStyle}
          >
            <option value="all">Serviço: Todos</option>
            <option value="Mototáxi">Mototáxi</option>
            <option value="Diarista">Diarista</option>
            <option value="Reciclagem">Reciclagem</option>
            <option value="Entrega">Entrega</option>
          </select>

          <select
            value={filterPeriod}
            onChange={(e) => {
              setFilterPeriod(e.target.value);
              setPage(0);
            }}
            style={selectStyle}
          >
            <option value="all">Período: Todo o período</option>
            <option value="today">Período: Hoje</option>
            <option value="week">Período: Última Semana</option>
            <option value="month">Período: Último Mês</option>
            <option value="year">Período: Último Ano</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            style={selectStyle}
          >
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* Mobile Title & Filters Bar */}
      <div
        className="flex md:hidden"
        style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}
      >
        <h1 style={{ fontFamily: "Syne", fontSize: 21, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
          Cadastro de Clientes
        </h1>
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            background: "#0B0F14",
            border: "1px solid rgba(16,185,129,0.35)",
            borderRadius: 10,
            padding: "0 14px",
            fontFamily: "DM Sans",
            fontSize: 13,
            fontWeight: 600,
            color: "#E5E7EB",
            cursor: "pointer",
          }}
        >
          <Filter size={15} color="#10B981" />
          Filtros
          {activeFiltersCount > 0 && (
            <span
              style={{
                background: "#10B981",
                color: "#04130D",
                borderRadius: 99,
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 24,
          borderBottom: "1px solid var(--admin-border)",
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(0);
            }}
            style={{
              background: "none",
              border: "none",
              padding: "10px 0",
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 600,
              color: tab === t.key ? "#10B981" : "var(--admin-subtle)",
              borderBottom: tab === t.key ? "2px solid #10B981" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop view: Table (ZERO financial columns) */}
      <div className="hidden md:block">
        <Card
          style={{
            overflow: "hidden",
            padding: 0,
            background: "#111827",
            border: "1px solid rgba(16,185,129,0.20)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0B0F14" }}>
                <tr>
                  {[
                    "Nome",
                    "Slug",
                    "Papel",
                    "Cadastro",
                    "Serviços",
                    "Prêmio 1/5",
                    "Prêmio 1/11",
                    "Associação",
                    "Ações",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign:
                          h === "Prêmio 1/5" || h === "Prêmio 1/11"
                            ? "center"
                            : h === "Ações"
                              ? "right"
                              : "left",
                        padding: "12px 14px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#9CA3AF",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#9CA3AF",
                        fontFamily: "DM Sans",
                        fontSize: 14,
                      }}
                    >
                      Carregando clientes...
                    </td>
                  </tr>
                )}

                {!loading &&
                  paged.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/admin/clientes/${u.id}`)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        transition: "background 120ms",
                        cursor: "pointer",
                        background: u.isBlockedActive ? "rgba(239,68,68,0.04)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = u.isBlockedActive
                          ? "rgba(239,68,68,0.09)"
                          : "rgba(16,185,129,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = u.isBlockedActive
                          ? "rgba(239,68,68,0.04)"
                          : "transparent";
                      }}
                    >
                      {/* NOME + PIX + BLOQUEIO */}
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={u.name} />
                          <div>
                            <div
                              style={{
                                fontFamily: "DM Sans",
                                fontSize: 14,
                                color: "#F9FAFB",
                                fontWeight: 600,
                              }}
                            >
                              {u.name}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                              {u.hasPix ? (
                                <span className="text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                                  PIX OK
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                                  Sem chave PIX
                                </span>
                              )}

                              {u.isBlockedActive && (
                                <span className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/40 px-1.5 py-0.5 rounded">
                                  Bloqueado · {formatBlockedSummary(u)}
                                </span>
                              )}

                              {!u.isBlockedActive &&
                                u.status !== "active" &&
                                (() => {
                                  const rule = rules.find((r) => r.key === u.status);
                                  if (!rule) return null;
                                  const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                                  return (
                                    <Pill
                                      bg={colors.bg}
                                      color={colors.color}
                                      border={colors.border}
                                      size="sm"
                                    >
                                      {rule.label}
                                    </Pill>
                                  );
                                })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SLUG */}
                      <td style={{ padding: "11px 14px" }} onClick={(e) => e.stopPropagation()}>
                        {u.referralSlug ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0B0F14] border border-emerald-500/25">
                            <span className="font-mono text-[12px] text-emerald-300">
                              @{u.referralSlug}
                            </span>
                            <button
                              type="button"
                              title="Copiar slug"
                              onClick={() => void handleCopySlug(u.referralSlug, u.id)}
                              className="text-zinc-400 hover:text-emerald-300 transition-colors"
                            >
                              {copiedSlugId === u.id ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">—</span>
                        )}
                      </td>

                      {/* PAPEL */}
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <Pill bg="rgba(43,110,232,0.14)" color="#60A5FA" size="sm">
                            tomador
                          </Pill>
                          {(u.role === "prestador" || (u.services ?? []).length > 0) && (
                            <Pill bg="rgba(16,185,129,0.14)" color="#34D399" size="sm">
                              prestador
                            </Pill>
                          )}
                        </div>
                      </td>

                      {/* CADASTRO */}
                      <td style={{ padding: "11px 14px" }}>
                        {u.isPendente ? (
                          <span className="bg-zinc-800/90 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded text-xs font-semibold inline-block">
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

                      {/* SERVIÇOS */}
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(u.services ?? []).map((s: string) => (
                            <Pill key={s} bg="#0B0F14" color="#D1D5DB" size="sm">
                              {s}
                            </Pill>
                          ))}
                          {(u.services ?? []).length === 0 && (
                            <span style={{ color: "#6B7280", fontSize: 13 }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* PRÊMIO 1/5 */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          color: "#F3F4F6",
                          fontWeight: 600,
                        }}
                      >
                        {u.ticketsTrabalhador ?? 0}
                      </td>

                      {/* PRÊMIO 1/11 */}
                      <td
                        style={{
                          padding: "11px 14px",
                          textAlign: "center",
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          color: "#F3F4F6",
                          fontWeight: 600,
                        }}
                      >
                        {u.ticketsConsumidor ?? 0}
                      </td>

                      {/* ASSOCIAÇÃO */}
                      <td style={{ padding: "11px 14px" }}>
                        {u.associacao ? (
                          <span style={{ fontSize: 13, color: "#D1D5DB", fontWeight: 500 }}>
                            {u.associacao}
                          </span>
                        ) : (
                          <span style={{ color: "#6B7280", fontSize: 13 }}>—</span>
                        )}
                      </td>

                      {/* AÇÕES (4 ações dedicadas) */}
                      <td
                        style={{ padding: "11px 14px", textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Visualizar ficha cadastral"
                            aria-label="Visualizar"
                            onClick={() => navigate(`/admin/clientes/${u.id}`)}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#0B0F14] border border-sky-500/30 text-sky-400 hover:bg-sky-500/15 transition-colors"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            title={u.isBlockedActive ? "Gerenciar / Desbloquear cliente" : "Bloquear cliente"}
                            aria-label={u.isBlockedActive ? "Desbloquear" : "Bloquear"}
                            onClick={() => setBlockTarget(toActionTarget(u))}
                            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#0B0F14] border transition-colors ${
                              u.isBlockedActive
                                ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15"
                                : "border-amber-500/35 text-amber-400 hover:bg-amber-500/15"
                            }`}
                          >
                            {u.isBlockedActive ? <ShieldCheck size={15} /> : <Ban size={15} />}
                          </button>

                          <button
                            type="button"
                            title="Enviar mensagem por WhatsApp"
                            aria-label="WhatsApp"
                            onClick={() => setWhatsAppTarget(toActionTarget(u))}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#0B0F14] border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                          >
                            <MessageCircle size={15} />
                          </button>

                          <button
                            type="button"
                            title="Deletar cliente (requer senha do Superadmin)"
                            aria-label="Deletar"
                            onClick={() => setDeleteTarget(toActionTarget(u))}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#0B0F14] border border-red-500/35 text-red-400 hover:bg-red-500/15 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && paged.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#9CA3AF",
                        fontFamily: "DM Sans",
                        fontSize: 14,
                      }}
                    >
                      Nenhum cliente encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile view: Cards (sem dados financeiros + 4 ações) */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading && (
          <Card style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>
            Carregando clientes...
          </Card>
        )}

        {!loading &&
          paged.map((u) => (
            <Card
              key={u.id}
              style={{
                padding: 16,
                background: "#111827",
                border: u.isBlockedActive
                  ? "1px solid rgba(239,68,68,0.45)"
                  : "1px solid rgba(16,185,129,0.20)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={u.name} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{u.name}</div>
                    <div className="font-mono text-[11px] text-emerald-300 truncate">
                      {u.referralSlug ? `@${u.referralSlug}` : "Sem slug"}
                    </div>
                  </div>
                </div>
                {u.cadastroCompleto ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0">
                    Completo
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0">
                    Incompleto
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <Pill bg="rgba(43,110,232,0.14)" color="#60A5FA" size="sm">
                  tomador
                </Pill>
                {u.role === "prestador" && (
                  <Pill bg="rgba(16,185,129,0.14)" color="#34D399" size="sm">
                    prestador
                  </Pill>
                )}
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    u.hasPix
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                  }`}
                >
                  {u.hasPix ? "PIX OK" : "Sem chave PIX"}
                </span>
                {u.isBlockedActive && (
                  <span className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/40 px-2 py-0.5 rounded">
                    Bloqueado · {formatBlockedSummary(u)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/clientes/${u.id}`)}
                  className="h-9 rounded-lg bg-[#0B0F14] border border-sky-500/30 text-sky-400 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Eye size={14} /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => setBlockTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#0B0F14] border border-amber-500/35 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  {u.isBlockedActive ? <ShieldCheck size={14} /> : <Ban size={14} />}
                  {u.isBlockedActive ? "Liberar" : "Bloq."}
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsAppTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#0B0F14] border border-emerald-500/35 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <MessageCircle size={14} /> Zap
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#0B0F14] border border-red-500/35 text-red-400 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} /> Del
                </button>
              </div>
            </Card>
          ))}

        {!loading && paged.length === 0 && (
          <Card style={{ padding: 32, textAlign: "center", color: "#9CA3AF" }}>
            Nenhum cliente encontrado.
          </Card>
        )}
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          fontFamily: "DM Sans",
          fontSize: 13,
          color: "#9CA3AF",
        }}
      >
        <div>
          Exibindo <strong style={{ color: "#F9FAFB" }}>{paged.length}</strong> de{" "}
          <strong style={{ color: "#F9FAFB" }}>{total}</strong> clientes · Página{" "}
          <strong style={{ color: "#10B981" }}>{safePage + 1}</strong> de {totalPages}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0B0F14",
              color: safePage === 0 ? "#4B5563" : "#F9FAFB",
              cursor: safePage === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "#0B0F14",
              color: safePage + 1 >= totalPages ? "#4B5563" : "#10B981",
              cursor: safePage + 1 >= totalPages ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-[900] flex items-end justify-center p-4 md:hidden"
          style={{ background: "rgba(4,7,12,0.8)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-3 border"
            style={{ background: "#111827", borderColor: "rgba(16,185,129,0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white m-0">Filtros</h3>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome, e-mail ou slug"
              style={{ ...selectStyle, width: "100%", cursor: "text" }}
            />

            <select
              value={filterPix}
              onChange={(e) => {
                setFilterPix(e.target.value as PixFilter);
                setPage(0);
              }}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="all">Chave PIX: Todos</option>
              <option value="com_pix">Com chave PIX</option>
              <option value="sem_pix">Sem chave PIX</option>
            </select>

            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setPage(0);
              }}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="all">Mês de Aniversário: Todos</option>
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(0);
              }}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="all">Serviço: Todos</option>
              <option value="Mototáxi">Mototáxi</option>
              <option value="Diarista">Diarista</option>
              <option value="Reciclagem">Reciclagem</option>
              <option value="Entrega">Entrega</option>
            </select>

            <select
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value);
                setPage(0);
              }}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="all">Período: Todo o período</option>
              <option value="today">Hoje</option>
              <option value="week">Última Semana</option>
              <option value="month">Último Mês</option>
              <option value="year">Último Ano</option>
            </select>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setFilterPix("all");
                  setFilterMonth("all");
                  setFilterCategory("all");
                  setFilterPeriod("all");
                  setPage(0);
                }}
                className="flex-1 h-10 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 h-10 rounded-xl bg-emerald-500 text-[#04130D] text-sm font-bold"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      <DeleteClientAlertModal
        client={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleClientDeleted}
      />

      <BlockClientModal
        client={blockTarget}
        onClose={() => setBlockTarget(null)}
        onUpdated={handleClientBlockUpdated}
      />

      <WhatsAppClientModal
        client={whatsAppTarget}
        onClose={() => setWhatsAppTarget(null)}
      />
    </div>
  );
}
