import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Copy,
  Check,
  Building2,
  Eye,
  RefreshCw,
  History,
  Ban,
  ShieldCheck,
  MessageCircle,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card } from "@/components/admin/ui";
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
import { maskCNPJ, maskPhone, generateReferralSlug } from "@/utils/masks";

export interface EntidadeItem {
  id: string;
  name: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  responsavelNome: string;
  responsavelCpf: string;
  telefone: string;
  email: string;
  cadastroCompleto: boolean;
  status: string;
  referralSlug: string;
  chavePix: string;
  tipoChavePix: string;
  hasPix: boolean;
  createdAt: string;
  updatedAt?: string | null;
  isBlocked: boolean;
  blockedUntil?: string | null;
  blockDurationLabel?: string | null;
  blockedReason?: string | null;
  isBlockedActive: boolean;
}

type PixFilter = "all" | "com_pix" | "sem_pix";
type SortField =
  | "razaoSocial"
  | "slug"
  | "cnpj"
  | "responsavel"
  | "contato"
  | "cadastro"
  | "createdAt"
  | "status";
type SortDir = "asc" | "desc";

const cleanDigits = (val?: string | null) => String(val || "").replace(/\D/g, "");

const formatDateDDMMYYYY = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function AdminEntidadesPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [entidades, setEntidades] = useState<EntidadeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completo" | "incompleto">("all");
  const [filterPix, setFilterPix] = useState<PixFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);

  // 4 Modais de Ação
  const [deleteTarget, setDeleteTarget] = useState<AdminActionClientTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminActionClientTarget | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<AdminActionClientTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminActionClientTarget | null>(null);

  const fetchEntidades = async () => {
    setLoading(true);
    try {
      const { data: rawUsers, error: errUsers } = await supabase
        .from("usuarios")
        .select("*")
        .or("role.eq.associacao,tipo_pessoa.eq.PJ,metadata->>tipo_cadastro.eq.pj,metadata->>tipo_cadastro.eq.PJ")
        .order("created_at", { ascending: false });

      if (errUsers) throw errUsers;

      const { data: rawWaitlist } = await supabase.from("waitlist").select("*");

      const wlPhoneMap = new Map<string, any>();
      const wlCnpjMap = new Map<string, any>();
      const wlUserIdMap = new Map<string, any>();

      (rawWaitlist || []).forEach((w: any) => {
        const cleanTel = cleanDigits(w.telefone);
        const cleanDoc = cleanDigits(w.cnpj);
        if (cleanTel) wlPhoneMap.set(cleanTel, w);
        if (cleanDoc) wlCnpjMap.set(cleanDoc, w);
        if (w.user_id) wlUserIdMap.set(w.user_id, w);
        if (w.id) wlUserIdMap.set(w.id, w);
      });

      const mappedList: EntidadeItem[] = (rawUsers || []).map((u: any) => {
        const cleanTel = cleanDigits(u.telefone || u.phone);
        const cleanDoc = cleanDigits(u.cnpj || u.metadata?.cnpj);
        const matchedWl =
          wlUserIdMap.get(u.id) ||
          (cleanDoc ? wlCnpjMap.get(cleanDoc) : null) ||
          (cleanTel ? wlPhoneMap.get(cleanTel) : null);

        const razaoSocial =
          u.razao_social ||
          u.metadata?.razao_social ||
          matchedWl?.razao_social ||
          u.nome ||
          "Entidade Sem Razão Social";
        const nomeFantasia =
          u.nome_fantasia || u.nome || matchedWl?.nome_fantasia || matchedWl?.nome || razaoSocial;
        const cnpjVal = cleanDoc || cleanDigits(matchedWl?.cnpj);
        const responsavelNome =
          u.responsavel_legal ||
          u.responsavel_nome ||
          matchedWl?.responsavel_nome ||
          matchedWl?.responsavel_legal ||
          "Não informado";
        const responsavelCpf =
          u.cpf_responsavel || matchedWl?.responsavel_cpf || matchedWl?.cpf_responsavel || u.cpf || "";
        const telefoneVal = u.telefone || matchedWl?.telefone || "";
        const emailVal = u.email || matchedWl?.email || "Não informado";
        const isCompleto =
          u.cadastro_completo === true ||
          u.metadata?.cadastro_completo === true ||
          matchedWl?.cadastro_completo === true;
        const statusVal = u.status === "ativo" || u.status === "active" ? "ativo" : u.status || "ativo";

        const rawSlug =
          u.referral_code ||
          matchedWl?.referral_code ||
          matchedWl?.referral_slug ||
          matchedWl?.slug ||
          u.metadata?.referral_code ||
          "";
        const referralSlug = String(
          rawSlug || generateReferralSlug(nomeFantasia || razaoSocial, cnpjVal || u.id) || "",
        ).trim();

        const chavePix = String(
          u.chave_pix || matchedWl?.pix_chave || matchedWl?.chave_pix || "",
        ).trim();
        const tipoChavePix = String(
          u.tipo_chave_pix || matchedWl?.pix_tipo || matchedWl?.tipo_chave_pix || "",
        ).trim();

        const isBlocked = Boolean(u.is_blocked);
        const blockedUntil = u.blocked_until || null;
        const blockDurationLabel = u.block_duration_label || null;
        const blockedReason = u.blocked_reason || null;

        return {
          id: u.id,
          name: nomeFantasia,
          razaoSocial,
          nomeFantasia,
          cnpj: cnpjVal,
          responsavelNome,
          responsavelCpf,
          telefone: telefoneVal,
          email: emailVal,
          cadastroCompleto: isCompleto,
          status: statusVal,
          referralSlug,
          chavePix,
          tipoChavePix,
          hasPix: Boolean(chavePix),
          createdAt: u.created_at || matchedWl?.created_at_utc || new Date().toISOString(),
          updatedAt: u.updated_at || null,
          isBlocked,
          blockedUntil,
          blockDurationLabel,
          blockedReason,
          isBlockedActive: isUserBlockedActive({ isBlocked, blockedUntil }),
        };
      });

      // Leads aprovados como PJ na waitlist que ainda não estão em usuarios
      (rawWaitlist || []).forEach((w: any) => {
        const isPJ =
          w.tipo_cadastro === "pj" ||
          w.tipo_cadastro === "PJ" ||
          w.tipo_cadastro === "associacao" ||
          Boolean(w.cnpj) ||
          Boolean(w.razao_social);
        const isApproved =
          w.status === "aprovado" || w.status === "approved" || w.cadastro_completo === true;

        if (isPJ && isApproved) {
          const cleanTel = cleanDigits(w.telefone);
          const cleanDoc = cleanDigits(w.cnpj);
          const alreadyExists = mappedList.some(
            (item) =>
              (cleanTel && cleanDigits(item.telefone) === cleanTel) ||
              (cleanDoc && cleanDigits(item.cnpj) === cleanDoc),
          );
          if (!alreadyExists) {
            const rSocial = w.razao_social || w.nome || "Entidade Sem Razão Social";
            const nFantasia = w.nome_fantasia || w.nome || rSocial;
            const chavePix = String(w.pix_chave || w.chave_pix || "").trim();
            mappedList.push({
              id: w.user_id || w.id,
              name: nFantasia,
              razaoSocial: rSocial,
              nomeFantasia: nFantasia,
              cnpj: cleanDoc,
              responsavelNome: w.responsavel_nome || w.responsavel_legal || "Não informado",
              responsavelCpf: w.responsavel_cpf || w.cpf_responsavel || "",
              telefone: w.telefone || "",
              email: w.email || "Não informado",
              cadastroCompleto: Boolean(w.cadastro_completo),
              status: "ativo",
              referralSlug:
                w.referral_code ||
                w.referral_slug ||
                w.slug ||
                generateReferralSlug(nFantasia, cleanDoc || w.id),
              chavePix,
              tipoChavePix: String(w.pix_tipo || w.tipo_chave_pix || "").trim(),
              hasPix: Boolean(chavePix),
              createdAt: w.created_at_utc || new Date().toISOString(),
              updatedAt: null,
              isBlocked: false,
              blockedUntil: null,
              blockDurationLabel: null,
              blockedReason: null,
              isBlockedActive: false,
            });
          }
        }
      });

      setEntidades(mappedList);
    } catch (err) {
      console.error("Erro ao buscar entidades:", err);
      toast.show("Erro ao carregar entidades.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEntidades();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const cleanQ = ql.replace(/\D/g, "");

    const list = entidades.filter((e) => {
      const okCadastro =
        filterStatus === "all" ||
        (filterStatus === "completo" && e.cadastroCompleto) ||
        (filterStatus === "incompleto" && !e.cadastroCompleto);
      if (!okCadastro) return false;

      const okPix =
        filterPix === "all" ||
        (filterPix === "com_pix" && e.hasPix) ||
        (filterPix === "sem_pix" && !e.hasPix);
      if (!okPix) return false;

      if (!ql) return true;
      const matchCnpj = cleanQ && cleanDigits(e.cnpj).includes(cleanQ);
      const matchTel = cleanQ && cleanDigits(e.telefone).includes(cleanQ);
      const matchText =
        e.name.toLowerCase().includes(ql) ||
        e.razaoSocial.toLowerCase().includes(ql) ||
        e.email.toLowerCase().includes(ql) ||
        e.responsavelNome.toLowerCase().includes(ql) ||
        e.referralSlug.toLowerCase().includes(ql);
      return Boolean(matchCnpj || matchTel || matchText);
    });

    const mult = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortField) {
        case "razaoSocial":
          return a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR") * mult;
        case "slug":
          return a.referralSlug.localeCompare(b.referralSlug, "pt-BR") * mult;
        case "cnpj":
          return a.cnpj.localeCompare(b.cnpj) * mult;
        case "responsavel":
          return a.responsavelNome.localeCompare(b.responsavelNome, "pt-BR") * mult;
        case "contato":
          return (a.telefone || a.email).localeCompare(b.telefone || b.email, "pt-BR") * mult;
        case "cadastro":
          return (Number(a.cadastroCompleto) - Number(b.cadastroCompleto)) * mult;
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
  }, [entidades, q, filterStatus, filterPix, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
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

  const handleCopySlug = async (slug: string, id: string) => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopiedSlugId(id);
      toast.show(`Slug "@${slug}" copiado! ✓`);
      setTimeout(() => setCopiedSlugId(null), 2000);
    } catch {
      toast.show("Erro ao copiar slug.");
    }
  };

  const toActionTarget = (e: EntidadeItem): AdminActionClientTarget => ({
    id: e.id,
    name: e.nomeFantasia || e.razaoSocial,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj ? maskCNPJ(e.cnpj) : null,
    email: e.email,
    phone: e.telefone,
    slug: e.referralSlug,
    entityType: "entidade",
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    cadastroCompleto: e.cadastroCompleto,
    isBlocked: e.isBlocked,
    blockedUntil: e.blockedUntil,
    blockDurationLabel: e.blockDurationLabel,
    blockedReason: e.blockedReason,
  });

  const handleDeleted = (deletedId: string) => {
    setEntidades((prev) => prev.filter((item) => item.id !== deletedId));
    toast.show("Entidade excluída definitivamente com sucesso! ✓");
  };

  const handleBlockUpdated = (
    userId: string,
    patch: {
      isBlocked: boolean;
      blockedUntil: string | null;
      blockDurationLabel: string | null;
      blockedReason: string | null;
      status: string;
    },
  ) => {
    setEntidades((prev) =>
      prev.map((item) =>
        item.id === userId
          ? {
              ...item,
              isBlocked: patch.isBlocked,
              blockedUntil: patch.blockedUntil,
              blockDurationLabel: patch.blockDurationLabel,
              blockedReason: patch.blockedReason,
              status: patch.status,
              isBlockedActive: isUserBlockedActive({
                isBlocked: patch.isBlocked,
                blockedUntil: patch.blockedUntil,
              }),
            }
          : item,
      ),
    );
    toast.show(
      patch.isBlocked
        ? `Entidade bloqueada (${patch.blockDurationLabel || "ativo"}).`
        : "Entidade desbloqueada com sucesso! ✓",
    );
  };

  const COLUMNS: Array<{ field: SortField; label: string; align?: "left" | "center" }> = [
    { field: "razaoSocial", label: "Entidade / Razão Social" },
    { field: "slug", label: "Slug" },
    { field: "cnpj", label: "CNPJ" },
    { field: "responsavel", label: "Responsável Legal" },
    { field: "contato", label: "Contato" },
    { field: "cadastro", label: "Cadastro", align: "center" },
    { field: "createdAt", label: "Entidade desde", align: "center" },
    { field: "status", label: "Status", align: "center" },
  ];

  const selectClass =
    "h-10 bg-[#09090B] border border-zinc-800 rounded-xl px-3 font-sans text-[13px] text-zinc-200 outline-none cursor-pointer focus:border-zinc-600";

  return (
    <div style={{ padding: "28px 24px" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Building2 size={22} className="text-emerald-400" />
            <h1 className="font-display text-[22px] font-bold text-zinc-100 m-0">
              Entidades & Associações (PJ)
            </h1>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-semibold">
              {filteredAndSorted.length}{" "}
              {filteredAndSorted.length === 1 ? "entidade" : "entidades"}
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-400 mt-1 mb-0">
            Gestão cadastral de associações, ONGs e pessoas jurídicas credenciadas na UBT.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchEntidades()}
          disabled={loading}
          className="h-9 px-3.5 rounded-xl bg-[#09090B] border border-zinc-800 hover:bg-zinc-900 text-zinc-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
          Atualizar
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-wrap gap-2.5 mb-5 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, razão social, CNPJ, slug ou telefone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-10 bg-[#09090B] border border-zinc-800 rounded-xl pl-9 pr-3 font-sans text-[13px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600"
          />
        </div>

        <select
          value={filterPix}
          onChange={(e) => setFilterPix(e.target.value as PixFilter)}
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

        <div className="flex gap-1.5">
          {(["all", "completo", "incompleto"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`h-10 px-3.5 rounded-xl border text-xs font-semibold transition-colors ${
                filterStatus === st
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                  : "bg-[#09090B] border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {st === "all" ? "Todos os Cadastros" : st === "completo" ? "Completos" : "Incompletos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela Desktop (Preto/Cinza + Ordenação Clicável + 5 Ações) */}
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
                  <td colSpan={9} className="py-10 text-center text-zinc-400 text-sm">
                    Carregando entidades...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredAndSorted.map((ent) => (
                  <tr
                    key={ent.id}
                    onClick={() => navigate(`/admin/entidades/${ent.id}`)}
                    className={`border-b border-zinc-800/80 transition-colors cursor-pointer ${
                      ent.isBlockedActive
                        ? "bg-red-950/15 hover:bg-red-950/30"
                        : "hover:bg-zinc-900/80"
                    }`}
                  >
                    {/* ENTIDADE / RAZÃO SOCIAL */}
                    <td style={{ padding: "11px 14px" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#09090B] border border-zinc-800 flex items-center justify-center shrink-0">
                          <Building2 size={16} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-100 truncate max-w-[230px]">
                            {ent.razaoSocial}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {ent.nomeFantasia && ent.nomeFantasia !== ent.razaoSocial && (
                              <span className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                                {ent.nomeFantasia}
                              </span>
                            )}
                            {ent.hasPix ? (
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
                      {ent.referralSlug ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#09090B] border border-zinc-800">
                          <span className="font-mono text-[12px] text-zinc-200">
                            @{ent.referralSlug}
                          </span>
                          <button
                            type="button"
                            title="Copiar slug"
                            onClick={() => void handleCopySlug(ent.referralSlug, ent.id)}
                            className="text-zinc-500 hover:text-emerald-400 transition-colors"
                          >
                            {copiedSlugId === ent.id ? (
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

                    {/* CNPJ */}
                    <td
                      style={{ padding: "11px 14px" }}
                      className="font-mono text-xs text-zinc-300 whitespace-nowrap"
                    >
                      {ent.cnpj ? maskCNPJ(ent.cnpj) : "—"}
                    </td>

                    {/* RESPONSÁVEL LEGAL */}
                    <td style={{ padding: "11px 14px" }} className="text-xs text-zinc-200">
                      {ent.responsavelNome}
                    </td>

                    {/* CONTATO */}
                    <td style={{ padding: "11px 14px" }}>
                      <div className="text-xs text-zinc-200 whitespace-nowrap">
                        {ent.telefone ? maskPhone(ent.telefone) : "Não cadastrado"}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                        {ent.email}
                      </div>
                    </td>

                    {/* CADASTRO */}
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      {ent.cadastroCompleto ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                          Completo
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                          Incompleto
                        </span>
                      )}
                    </td>

                    {/* ENTIDADE DESDE */}
                    <td
                      style={{ padding: "11px 14px", textAlign: "center" }}
                      className="font-mono text-xs text-zinc-300 whitespace-nowrap"
                    >
                      {formatDateDDMMYYYY(ent.createdAt)}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      {ent.isBlockedActive ? (
                        <span className="text-[11px] font-bold text-red-400 bg-red-950/60 border border-red-500/50 px-2 py-0.5 rounded inline-block whitespace-nowrap">
                          Bloqueado · {formatBlockedSummary(ent)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded inline-block">
                          Ativo
                        </span>
                      )}
                    </td>

                    {/* 5 AÇÕES */}
                    <td
                      style={{ padding: "11px 14px", textAlign: "right" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Visualizar ficha cadastral da entidade"
                          aria-label="Visualizar"
                          onClick={() => navigate(`/admin/entidades/${ent.id}`)}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          title="Histórico da entidade"
                          aria-label="Histórico"
                          onClick={() => setHistoryTarget(toActionTarget(ent))}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <History size={15} />
                        </button>

                        <button
                          type="button"
                          title={ent.isBlockedActive ? "Desbloquear / Gerenciar bloqueio" : "Bloquear Entidade"}
                          aria-label={ent.isBlockedActive ? "Desbloquear" : "Bloquear"}
                          onClick={() => setBlockTarget(toActionTarget(ent))}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border transition-colors ${
                            ent.isBlockedActive
                              ? "border-emerald-500 text-emerald-400 hover:bg-emerald-950/40"
                              : "border-red-500 text-red-400 hover:bg-red-950/50"
                          }`}
                        >
                          {ent.isBlockedActive ? <ShieldCheck size={15} /> : <Ban size={15} />}
                        </button>

                        <button
                          type="button"
                          title="Enviar mensagem por WhatsApp"
                          aria-label="WhatsApp"
                          onClick={() => setWhatsAppTarget(toActionTarget(ent))}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-emerald-500/45 text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                        >
                          <MessageCircle size={15} />
                        </button>

                        <button
                          type="button"
                          title="Deletar entidade (requer senha do Superadmin)"
                          aria-label="Deletar"
                          onClick={() => setDeleteTarget(toActionTarget(ent))}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-[#09090B] border border-red-500/50 text-red-400 hover:bg-red-950/50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-400 text-sm">
                    Nenhuma entidade encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modais Compartilhados (PJ / Entidades) */}
      <DeleteClientAlertModal
        client={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />

      <BlockClientModal
        client={blockTarget}
        onClose={() => setBlockTarget(null)}
        onUpdated={handleBlockUpdated}
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
