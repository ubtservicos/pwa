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
  History,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { maskCPF, generateReferralSlug } from "@/utils/masks";
import { Card, Avatar, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  DeleteClientAlertModal,
  BlockClientModal,
  WhatsAppClientModal,
  ClientHistoryModal,
  isUserBlockedActive,
  formatBlockedSummary,
  type AdminActionClientTarget,
} from "@/components/admin/AdminClienteActionsModals";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";

type Tab = "todos" | "tomadores" | "prestadores";
type PixFilter = "all" | "com_pix" | "sem_pix";
type SortField = "name" | "slug" | "role" | "cadastro" | "services" | "createdAt" | "status";
type SortDir = "asc" | "desc";

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

const formatDateDDMMYYYY = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
  const [dbWaitlist, setDbWaitlist] = useState<any[]>([]);
  const [mototaxisMap, setMototaxisMap] = useState<Map<string, any>>(new Map());
  const [diaristasMap, setDiaristasMap] = useState<Map<string, any>>(new Map());
  const [caminhoesMap, setCaminhoesMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("todos");
  const [q, setQ] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterPix, setFilterPix] = useState<PixFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [rules, setRules] = useState<StatusRule[]>([]);
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);

  // Action Modals
  const [deleteTarget, setDeleteTarget] = useState<AdminActionClientTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminActionClientTarget | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<AdminActionClientTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminActionClientTarget | null>(null);

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
          waitlistRes,
        ] = await Promise.allSettled([
          supabase.from("profiles").select("*"),
          supabase.from("prestador_mototaxi").select("user_id, kyc_status, modalidade, plate, is_online"),
          supabase.from("diarista_perfis").select("user_id, rating, total_servicos, is_online"),
          supabase.from("coco_caminhoes").select("prestador_id, plate, status_aprovacao, is_online"),
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
        const createdAt = u.created_at || prof?.created_at || new Date().toISOString();
        const updatedAt = u.updated_at || null;

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
          createdAt,
          updatedAt,
          services,
          servicesLabel: services.join(", "),
          status,
          birthMonth,
          cadastroCompleto: isCadastroCompleto,
          isPendente,
          cadastroRank: isPendente ? 0 : isCadastroCompleto ? 2 : 1,
          chavePix,
          hasPix: Boolean(chavePix),
          isBlocked,
          blockedUntil,
          blockDurationLabel,
          blockedReason,
          isBlockedActive: isUserBlockedActive({ isBlocked, blockedUntil }),
        };
      });
  }, [dbUsers, dbProfiles, mototaxisMap, diaristasMap, caminhoesMap, dbWaitlist]);

  const filteredAndSorted = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const now = Date.now();
    const list = users.filter((u) => {
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

      let okPeriod = true;
      if (filterPeriod !== "all") {
        const diffDays = (now - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (filterPeriod === "today") okPeriod = diffDays <= 1;
        else if (filterPeriod === "week") okPeriod = diffDays <= 7;
        else if (filterPeriod === "month") okPeriod = diffDays <= 30;
        else if (filterPeriod === "year") okPeriod = diffDays <= 365;
      }

      return okTab && okQ && okMonth && okCategory && okPix && okPeriod;
    });

    const mult = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name, "pt-BR") * mult;
        case "slug":
          return a.referralSlug.localeCompare(b.referralSlug, "pt-BR") * mult;
        case "role":
          return a.role.localeCompare(b.role, "pt-BR") * mult;
        case "cadastro":
          return (a.cadastroRank - b.cadastroRank) * mult;
        case "services":
          return a.servicesLabel.localeCompare(b.servicesLabel, "pt-BR") * mult;
        case "status":
          return (Number(a.isBlockedActive) - Number(b.isBlockedActive)) * mult;
        case "createdAt":
        default: {
          const ta = new Date(a.createdAt).getTime() || 0;
          const tb = new Date(b.createdAt).getTime() || 0;
          return (ta - tb) * mult;
        }
      }
    });
  }, [users, tab, q, filterMonth, filterCategory, filterPix, filterPeriod, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
    setPage(0);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-zinc-600 inline-block ml-1" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-emerald-400 inline-block ml-1" />
    ) : (
      <ArrowDown size={12} className="text-emerald-400 inline-block ml-1" />
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "tomadores", label: "Tomadores" },
    { key: "prestadores", label: "Prestadores" },
  ];

  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filteredAndSorted.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filteredAndSorted, safePage, pageSize],
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
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    cadastroCompleto: u.cadastroCompleto,
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

  const selectClass =
    "h-10 bg-[#09090B] border border-zinc-800 rounded-xl px-3 font-sans text-[13px] text-zinc-200 outline-none cursor-pointer focus:border-zinc-600";

  const COLUMNS: Array<{ field: SortField; label: string; align?: "left" | "center" }> = [
    { field: "name", label: "Nome" },
    { field: "slug", label: "Slug" },
    { field: "role", label: "Papel" },
    { field: "cadastro", label: "Cadastro" },
    { field: "services", label: "Serviços" },
    { field: "createdAt", label: "Cliente desde", align: "center" },
    { field: "status", label: "Status", align: "center" },
  ];

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
          <h1 className="font-display text-[22px] font-bold text-zinc-100 m-0">
            Cadastro de Clientes
          </h1>
          <p className="font-sans text-xs text-zinc-400 mt-0.5 mb-0">
            Gestão cadastral, slug UBT, chave PIX, histórico, bloqueios e comunicação direta
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search size={15} className="text-zinc-500 absolute left-3 top-3" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar nome, e-mail ou slug"
              className="w-full h-10 bg-[#09090B] border border-zinc-800 rounded-xl pl-9 pr-3 font-sans text-[13px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600"
            />
          </div>

          <select
            value={filterPix}
            onChange={(e) => {
              setFilterPix(e.target.value as PixFilter);
              setPage(0);
            }}
            className={selectClass}
            style={{
              borderColor:
                filterPix === "sem_pix"
                  ? "rgba(245, 158, 11, 0.7)"
                  : filterPix === "com_pix"
                    ? "rgba(16, 185, 129, 0.7)"
                    : undefined,
              color:
                filterPix === "sem_pix"
                  ? "#FBBF24"
                  : filterPix === "com_pix"
                    ? "#34D399"
                    : undefined,
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
            className={selectClass}
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
            className={selectClass}
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
            className={selectClass}
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
            className={selectClass}
          >
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* Mobile Title & Filters Bar */}
      <div className="flex md:hidden items-center justify-between mb-4">
        <h1 className="font-display text-[21px] font-bold text-zinc-100 m-0">
          Cadastro de Clientes
        </h1>
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          className="flex items-center gap-2 h-10 bg-[#09090B] border border-zinc-800 rounded-xl px-3.5 text-[13px] font-semibold text-zinc-200"
        >
          <Filter size={15} className="text-emerald-400" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="bg-emerald-500 text-zinc-950 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-extrabold">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-zinc-800 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(0);
            }}
            className={`bg-transparent border-0 py-2.5 font-sans text-sm font-semibold cursor-pointer -mb-px transition-colors ${
              tab === t.key
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-zinc-400 hover:text-zinc-200 border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop view: Table (Preto/Cinza + Ordenação por coluna) */}
      <div className="hidden md:block">
        <Card
          style={{
            overflow: "hidden",
            padding: 0,
            background: "#121215",
            border: "1px solid #27272A",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#09090B" }}>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      title={`Ordenar por ${col.label}`}
                      style={{
                        textAlign: col.align || "left",
                        padding: "12px 14px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 700,
                        color: sortField === col.field ? "#34D399" : "#A1A1AA",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        borderBottom: "1px solid #27272A",
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label}
                      {renderSortIcon(col.field)}
                    </th>
                  ))}
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 14px",
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#A1A1AA",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      borderBottom: "1px solid #27272A",
                    }}
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-zinc-400 font-sans text-sm"
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
                      className={`border-b border-zinc-800/80 transition-colors cursor-pointer ${
                        u.isBlockedActive
                          ? "bg-red-950/15 hover:bg-red-950/30"
                          : "hover:bg-zinc-900/80"
                      }`}
                    >
                      {/* NOME + PIX */}
                      <td style={{ padding: "11px 14px" }}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} />
                          <div>
                            <div className="font-sans text-sm text-zinc-100 font-semibold">
                              {u.name}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {u.hasPix ? (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                                  PIX OK
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                                  Sem chave PIX
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SLUG */}
                      <td style={{ padding: "11px 14px" }} onClick={(e) => e.stopPropagation()}>
                        {u.referralSlug ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#09090B] border border-zinc-800">
                            <span className="font-mono text-[12px] text-zinc-200">
                              @{u.referralSlug}
                            </span>
                            <button
                              type="button"
                              title="Copiar slug"
                              onClick={() => void handleCopySlug(u.referralSlug, u.id)}
                              className="text-zinc-500 hover:text-emerald-400 transition-colors"
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
                        <div className="flex gap-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-900 text-zinc-300 border border-zinc-700">
                            tomador
                          </span>
                          {(u.role === "prestador" || (u.services ?? []).length > 0) && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              prestador
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CADASTRO */}
                      <td style={{ padding: "11px 14px" }}>
                        {u.isPendente ? (
                          <span className="bg-zinc-900 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-xs font-semibold inline-block">
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
                        <div className="flex gap-1 flex-wrap">
                          {(u.services ?? []).map((s: string) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#09090B] text-zinc-300 border border-zinc-800"
                            >
                              {s}
                            </span>
                          ))}
                          {(u.services ?? []).length === 0 && (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* CLIENTE DESDE */}
                      <td
                        style={{ padding: "11px 14px", textAlign: "center" }}
                        className="font-mono text-xs text-zinc-300 whitespace-nowrap"
                      >
                        {formatDateDDMMYYYY(u.createdAt)}
                      </td>

                      {/* STATUS / BLOQUEIO */}
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        {u.isBlockedActive ? (
                          <span className="text-[11px] font-bold text-red-400 bg-red-950/60 border border-red-500/50 px-2 py-0.5 rounded inline-block whitespace-nowrap">
                            Bloqueado · {formatBlockedSummary(u)}
                          </span>
                        ) : u.status !== "active" &&
                          (() => {
                            const rule = rules.find((r) => r.key === u.status);
                            if (!rule) return false;
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
                          })() ? (
                          (() => {
                            const rule = rules.find((r) => r.key === u.status)!;
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
                          })()
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded inline-block">
                            Ativo
                          </span>
                        )}
                      </td>

                      {/* AÇÕES (5 ações: Visualizar, Histórico, Bloquear com borda vermelha, WhatsApp, Deletar) */}
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
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition-colors"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            title="Histórico do cliente"
                            aria-label="Histórico"
                            onClick={() => setHistoryTarget(toActionTarget(u))}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            <History size={15} />
                          </button>

                          <button
                            type="button"
                            title={u.isBlockedActive ? "Desbloquear / Gerenciar bloqueio" : "Bloquear Usuário"}
                            aria-label={u.isBlockedActive ? "Desbloquear" : "Bloquear Usuário"}
                            onClick={() => setBlockTarget(toActionTarget(u))}
                            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border transition-colors ${
                              u.isBlockedActive
                                ? "border-emerald-500 text-emerald-400 hover:bg-emerald-950/40"
                                : "border-red-500 text-red-400 hover:bg-red-950/50"
                            }`}
                          >
                            {u.isBlockedActive ? <ShieldCheck size={15} /> : <Ban size={15} />}
                          </button>

                          <button
                            type="button"
                            title="Enviar mensagem por WhatsApp"
                            aria-label="WhatsApp"
                            onClick={() => setWhatsAppTarget(toActionTarget(u))}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-emerald-500/45 text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                          >
                            <MessageCircle size={15} />
                          </button>

                          <button
                            type="button"
                            title="Deletar cliente (requer senha do Superadmin)"
                            aria-label="Deletar"
                            onClick={() => setDeleteTarget(toActionTarget(u))}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-red-500/50 text-red-400 hover:bg-red-950/50 transition-colors"
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
                      colSpan={8}
                      className="py-10 text-center text-zinc-400 font-sans text-sm"
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

      {/* Mobile view: Cards (Preto/Cinza + 5 ações) */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading && (
          <Card style={{ padding: 32, textAlign: "center", background: "#121215", border: "1px solid #27272A", color: "#A1A1AA" }}>
            Carregando clientes...
          </Card>
        )}

        {!loading &&
          paged.map((u) => (
            <Card
              key={u.id}
              style={{
                padding: 16,
                background: "#121215",
                border: u.isBlockedActive
                  ? "1px solid rgba(239,68,68,0.5)"
                  : "1px solid #27272A",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={u.name} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-zinc-100 truncate">{u.name}</div>
                    <div className="font-mono text-[11px] text-zinc-400 truncate">
                      {u.referralSlug ? `@${u.referralSlug}` : "Sem slug"} · Desde {formatDateDDMMYYYY(u.createdAt)}
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
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-zinc-300 border border-zinc-700">
                  tomador
                </span>
                {u.role === "prestador" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    prestador
                  </span>
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
                  <span className="text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-500/50 px-2 py-0.5 rounded">
                    Bloqueado · {formatBlockedSummary(u)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5 mt-3.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/clientes/${u.id}`)}
                  className="h-9 rounded-lg bg-[#09090B] border border-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center justify-center"
                  title="Visualizar"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#09090B] border border-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center justify-center"
                  title="Histórico"
                >
                  <History size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setBlockTarget(toActionTarget(u))}
                  className={`h-9 rounded-lg bg-[#09090B] border text-[11px] font-semibold flex items-center justify-center ${
                    u.isBlockedActive
                      ? "border-emerald-500 text-emerald-400"
                      : "border-red-500 text-red-400"
                  }`}
                  title={u.isBlockedActive ? "Desbloquear" : "Bloquear Usuário"}
                >
                  {u.isBlockedActive ? <ShieldCheck size={14} /> : <Ban size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsAppTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#09090B] border border-emerald-500/45 text-emerald-400 text-[11px] font-semibold flex items-center justify-center"
                  title="WhatsApp"
                >
                  <MessageCircle size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(toActionTarget(u))}
                  className="h-9 rounded-lg bg-[#09090B] border border-red-500/50 text-red-400 text-[11px] font-semibold flex items-center justify-center"
                  title="Deletar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}

        {!loading && paged.length === 0 && (
          <Card style={{ padding: 32, textAlign: "center", background: "#121215", border: "1px solid #27272A", color: "#A1A1AA" }}>
            Nenhum cliente encontrado.
          </Card>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap gap-3 items-center justify-between mt-4 font-sans text-[13px] text-zinc-400">
        <div>
          Exibindo <strong className="text-zinc-100">{paged.length}</strong> de{" "}
          <strong className="text-zinc-100">{total}</strong> clientes · Página{" "}
          <strong className="text-emerald-400">{safePage + 1}</strong> de {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-9 px-3.5 rounded-lg border border-zinc-800 bg-[#09090B] text-zinc-200 disabled:text-zinc-600 disabled:cursor-not-allowed font-semibold"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="h-9 px-3.5 rounded-lg border border-zinc-700 bg-[#09090B] text-emerald-400 disabled:text-zinc-600 disabled:cursor-not-allowed font-semibold"
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-[900] flex items-end justify-center p-4 md:hidden"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-3 border border-zinc-800 bg-[#121215]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-zinc-100 m-0">Filtros</h3>
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
              className="w-full h-10 bg-[#09090B] border border-zinc-800 rounded-xl px-3 text-sm text-zinc-100 outline-none"
            />

            <select
              value={filterPix}
              onChange={(e) => {
                setFilterPix(e.target.value as PixFilter);
                setPage(0);
              }}
              className={`${selectClass} w-full`}
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
              className={`${selectClass} w-full`}
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
              className={`${selectClass} w-full`}
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
              className={`${selectClass} w-full`}
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
                className="flex-1 h-10 rounded-xl border border-zinc-800 text-zinc-300 text-sm font-semibold"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 h-10 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold"
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

      <ClientHistoryModal
        client={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
