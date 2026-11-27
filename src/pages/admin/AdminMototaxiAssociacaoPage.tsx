import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";

export interface MototaxiAssociacaoItem {
  id: string;
  cnpj: string;
  nome: string;
  endereco_sede: string;
  presidente_nome: string;
  presidente_cpf: string;
  email_oficial: string;
  telefone_responsavel: string;
  categoria: string;
  total_motoristas: number;
}

export interface MototaxiAssociacaoMotorista {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  status: string;
  associacao_id: string;
  associacao_nome: string;
  data_filiacao: string | null;
}

export interface AssociacaoMensagemRecente {
  id: string;
  associacao_id: string | null;
  associacao_nome: string;
  titulo: string;
  conteudo: string;
  total_destinatarios: number;
  created_at: string;
}

interface OverviewResponse {
  caller_role: "super_admin" | "admin" | "associacao" | string;
  caller_associacao_id: string | null;
  associacoes: MototaxiAssociacaoItem[];
  motoristas: MototaxiAssociacaoMotorista[];
  mensagens_recentes: AssociacaoMensagemRecente[];
}

export function formatDataFiliacao(iso?: string | null): string {
  if (!iso) return "desde —";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "desde —";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `desde ${dd}/${mm}/${yyyy}`;
}

export function formatPhoneDisplay(raw?: string | null): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "Não informado";
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw || "Não informado";
}

export function buildWhatsAppLink(rawPhone?: string | null, presetText?: string): string | null {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const query = presetText ? `?text=${encodeURIComponent(presetText)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}

export default function AdminMototaxiAssociacaoPage() {
  const toast = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse>({
    caller_role: "super_admin",
    caller_associacao_id: null,
    associacoes: [],
    motoristas: [],
    mensagens_recentes: [],
  });

  // Superadmin filter: "all" or a specific associacao.id
  const [selectedAssociacaoId, setSelectedAssociacaoId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Edit Association Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    cnpj: "",
    nome: "",
    endereco_sede: "",
    presidente_nome: "",
    presidente_cpf: "",
    email_oficial: "",
    telefone_responsavel: "",
  });

  // Mass Message Modal
  const [massModalOpen, setMassModalOpen] = useState(false);
  const [sendingMass, setSendingMass] = useState(false);
  const [massTitle, setMassTitle] = useState("");
  const [massContent, setMassContent] = useState("");

  const isSuperAdmin = overview.caller_role === "super_admin" || overview.caller_role === "admin";
  const isAssociacaoProfile = overview.caller_role === "associacao";

  const loadOverview = async (assocFilterId?: string | null) => {
    setLoading(true);
    try {
      const targetParam =
        assocFilterId && assocFilterId !== "all" ? assocFilterId : null;
      const { data, error } = await (supabase as any).rpc(
        "admin_get_mototaxi_associacao_overview",
        { p_associacao_id: targetParam },
      );
      if (error) throw error;
      const parsed = (data || {}) as OverviewResponse;
      setOverview({
        caller_role: parsed.caller_role || "super_admin",
        caller_associacao_id: parsed.caller_associacao_id || null,
        associacoes: Array.isArray(parsed.associacoes) ? parsed.associacoes : [],
        motoristas: Array.isArray(parsed.motoristas) ? parsed.motoristas : [],
        mensagens_recentes: Array.isArray(parsed.mensagens_recentes)
          ? parsed.mensagens_recentes
          : [],
      });
    } catch (err: any) {
      console.error("[AdminMototaxiAssociacaoPage] Erro ao carregar overview:", err);
      toast.show(err?.message || "Erro ao carregar dados da associação.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview(selectedAssociacaoId === "all" ? null : selectedAssociacaoId);
    setSelectedDriverIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssociacaoId]);

  const activeAssociacao: MototaxiAssociacaoItem | null = useMemo(() => {
    if (isAssociacaoProfile) {
      return overview.associacoes[0] || null;
    }
    if (selectedAssociacaoId === "all") return null;
    return overview.associacoes.find((a) => a.id === selectedAssociacaoId) || null;
  }, [isAssociacaoProfile, overview.associacoes, selectedAssociacaoId]);

  const showAssociacaoColumn = isSuperAdmin && selectedAssociacaoId === "all";

  const filteredMotoristas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return overview.motoristas.filter((m) => {
      if (selectedAssociacaoId !== "all" && m.associacao_id !== selectedAssociacaoId) {
        return false;
      }
      if (!q) return true;
      return (
        m.nome.toLowerCase().includes(q) ||
        m.telefone.toLowerCase().includes(q) ||
        m.associacao_nome.toLowerCase().includes(q)
      );
    });
  }, [overview.motoristas, selectedAssociacaoId, searchQuery]);

  const allVisibleSelected =
    filteredMotoristas.length > 0 &&
    filteredMotoristas.every((m) => selectedDriverIds.has(m.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(filteredMotoristas.map((m) => m.id)));
    }
  };

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const massTargetCount =
    selectedDriverIds.size > 0 ? selectedDriverIds.size : filteredMotoristas.length;

  const massTargetLabel = useMemo(() => {
    const scopeName = activeAssociacao
      ? activeAssociacao.nome
      : "Todas as Associações";
    if (selectedDriverIds.size > 0) {
      return `${selectedDriverIds.size} motorista(s) selecionado(s) · ${scopeName}`;
    }
    return `${filteredMotoristas.length} motorista(s) · ${scopeName}`;
  }, [activeAssociacao, selectedDriverIds.size, filteredMotoristas.length]);

  const openEditModal = (assoc: MototaxiAssociacaoItem) => {
    setEditForm({
      id: assoc.id,
      cnpj: assoc.cnpj || "",
      nome: assoc.nome || "",
      endereco_sede: assoc.endereco_sede || "",
      presidente_nome: assoc.presidente_nome || "",
      presidente_cpf: assoc.presidente_cpf || "",
      email_oficial: assoc.email_oficial || "",
      telefone_responsavel: assoc.telefone_responsavel || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveAssociacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.nome.trim()) {
      toast.show("Informe o nome da associação.");
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await (supabase as any).rpc(
        "admin_update_mototaxi_associacao_dados",
        {
          p_associacao_id: editForm.id,
          p_cnpj: editForm.cnpj,
          p_nome: editForm.nome,
          p_endereco_sede: editForm.endereco_sede,
          p_presidente_nome: editForm.presidente_nome,
          p_presidente_cpf: editForm.presidente_cpf,
          p_email_oficial: editForm.email_oficial,
          p_telefone_responsavel: editForm.telefone_responsavel,
        },
      );
      if (error) throw error;
      toast.show("Dados da associação atualizados com sucesso! ✓");
      setEditModalOpen(false);
      await loadOverview(selectedAssociacaoId === "all" ? null : selectedAssociacaoId);
    } catch (err: any) {
      console.error("[AdminMototaxiAssociacaoPage] Erro ao salvar associação:", err);
      toast.show(err?.message || "Erro ao atualizar dados da associação.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendMassMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!massTitle.trim() || !massContent.trim()) {
      toast.show("Preencha o assunto e a mensagem do comunicado.");
      return;
    }
    if (massTargetCount === 0) {
      toast.show("Não há motoristas elegíveis para receber este comunicado.");
      return;
    }
    setSendingMass(true);
    try {
      const targetAssocId = activeAssociacao ? activeAssociacao.id : null;
      const explicitIds =
        selectedDriverIds.size > 0 ? Array.from(selectedDriverIds) : null;
      const { data, error } = await (supabase as any).rpc(
        "admin_send_associacao_mass_message",
        {
          p_associacao_id: targetAssocId,
          p_titulo: massTitle.trim(),
          p_conteudo: massContent.trim(),
          p_destinatario_ids: explicitIds,
        },
      );
      if (error) throw error;
      const sentCount = Number(data?.total_destinatarios ?? massTargetCount);
      toast.show(`Comunicado in-app disparado para ${sentCount} motorista(s)! ✓`);
      setMassModalOpen(false);
      setMassTitle("");
      setMassContent("");
      setSelectedDriverIds(new Set());
      await loadOverview(selectedAssociacaoId === "all" ? null : selectedAssociacaoId);
    } catch (err: any) {
      console.error("[AdminMototaxiAssociacaoPage] Erro ao disparar comunicado:", err);
      toast.show(err?.message || "Erro ao disparar comunicado em massa.");
    } finally {
      setSendingMass(false);
    }
  };

  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone).catch(() => {});
    setCopiedPhone(true);
    toast.show("Telefone copiado!");
    setTimeout(() => setCopiedPhone(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50 px-4 sm:px-8 py-7">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-[#00E676]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-zinc-50 tracking-tight m-0">
                  Associação de Mototaxistas
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[#00E676] text-[11px] font-mono uppercase font-bold">
                  {isSuperAdmin ? "Visão Superadmin" : "Visão Associação"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 mb-0">
                Gestão cadastral da associação, lista de motoristas filiados e comunicados em massa no app.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 bg-[#121215] border border-zinc-800 rounded-xl px-3 h-10">
                <label
                  htmlFor="filtro-associacao-select"
                  className="text-[11px] font-mono uppercase text-zinc-400 whitespace-nowrap"
                >
                  Filtrar Associação:
                </label>
                <select
                  id="filtro-associacao-select"
                  aria-label="Filtrar Associação"
                  value={selectedAssociacaoId}
                  onChange={(e) => setSelectedAssociacaoId(e.target.value)}
                  className="bg-transparent text-zinc-100 text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#121215] text-zinc-100">
                    Todas as Associações
                  </option>
                  {overview.associacoes.map((assoc) => (
                    <option key={assoc.id} value={assoc.id} className="bg-[#121215] text-zinc-100">
                      {assoc.nome} ({assoc.total_motoristas})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void loadOverview(selectedAssociacaoId === "all" ? null : selectedAssociacaoId)
              }
              className="h-10 px-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:bg-zinc-900 text-zinc-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#00E676]" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* A) Resumo Consolidado (Superadmin em "Todas as Associações") */}
        {isSuperAdmin && selectedAssociacaoId === "all" && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 m-0">
                  Total de Associações
                </p>
                <p className="font-display text-2xl font-extrabold text-zinc-50 mt-1 mb-0">
                  {overview.associacoes.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00E676]">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 m-0">
                  Motoristas Filiados
                </p>
                <p className="font-display text-2xl font-extrabold text-[#00E676] mt-1 mb-0">
                  {overview.motoristas.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00E676]">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 m-0">
                  Últimos Comunicados
                </p>
                <p className="font-display text-2xl font-extrabold text-zinc-50 mt-1 mb-0">
                  {overview.mensagens_recentes.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00E676]">
                <Megaphone className="w-5 h-5" />
              </div>
            </div>
          </section>
        )}

        {/* B) Card "Dados da Associação" (quando associação específica selecionada ou Perfil Associação) */}
        {activeAssociacao && (
          <section className="p-6 rounded-2xl bg-[#121215] border border-zinc-800 shadow-xl flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#00E676]" />
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-zinc-50 m-0">
                    Dados da Associação
                  </h2>
                  <p className="text-xs text-zinc-400 m-0">
                    Cadastro oficial da entidade vinculada aos mototaxistas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditModal(activeAssociacao)}
                className="h-9 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-[#00E676] text-zinc-100 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#00E676]" />
                Editar Dados
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500">CNPJ</span>
                <p className="font-mono text-sm font-semibold text-zinc-100 mt-1 mb-0">
                  {activeAssociacao.cnpj || "Não informado"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500">
                  Nome da Associação
                </span>
                <p className="text-sm font-bold text-[#00E676] mt-1 mb-0">
                  {activeAssociacao.nome}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Endereço da Sede
                </span>
                <p className="text-sm font-medium text-zinc-100 mt-1 mb-0">
                  {activeAssociacao.endereco_sede || "Não informado"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500 inline-flex items-center gap-1">
                  <User className="w-3 h-3" /> Nome do Presidente
                </span>
                <p className="text-sm font-medium text-zinc-100 mt-1 mb-0">
                  {activeAssociacao.presidente_nome || "Não informado"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500">
                  CPF do Presidente
                </span>
                <p className="font-mono text-sm font-medium text-zinc-100 mt-1 mb-0">
                  {activeAssociacao.presidente_cpf || "Não informado"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                <span className="text-[11px] font-mono uppercase text-zinc-500 inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" /> E-mail Oficial
                </span>
                <p className="text-sm font-medium text-zinc-100 mt-1 mb-0 truncate">
                  {activeAssociacao.email_oficial || "Não informado"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 md:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-zinc-500 inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefone / WhatsApp do Responsável
                  </span>
                  <p className="font-mono text-sm font-semibold text-zinc-100 mt-1 mb-0">
                    {formatPhoneDisplay(activeAssociacao.telefone_responsavel)}
                  </p>
                </div>

                {activeAssociacao.telefone_responsavel && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(activeAssociacao.telefone_responsavel)}
                      className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedPhone ? (
                        <Check className="w-3.5 h-3.5 text-[#00E676]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copiar
                    </button>
                    {buildWhatsAppLink(
                      activeAssociacao.telefone_responsavel,
                      `Olá! Contato da gestão UBT Serviços sobre a associação ${activeAssociacao.nome}.`,
                    ) && (
                      <a
                        href={
                          buildWhatsAppLink(
                            activeAssociacao.telefone_responsavel,
                            `Olá! Contato da gestão UBT Serviços sobre a associação ${activeAssociacao.nome}.`,
                          ) || "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg bg-[#00E676]/15 border border-[#00E676]/40 hover:bg-[#00E676]/25 text-[#00E676] text-xs font-bold inline-flex items-center gap-1.5 no-underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* C) Tabela "Motoristas da Associação" + D) Botão de Ação em Massa */}
        <section className="rounded-2xl bg-[#121215] border border-zinc-800 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#00E676]" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base sm:text-lg font-bold text-zinc-50 m-0">
                    Motoristas da Associação
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono font-semibold">
                    {filteredMotoristas.length} filiado(s)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 m-0">
                  Selecione motoristas para disparo segmentado ou envie para toda a lista filtrada.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar nome ou telefone..."
                  className="h-10 pl-9 pr-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-xs text-zinc-100 placeholder:text-zinc-500 outline-none w-56"
                />
              </div>

              <button
                type="button"
                disabled={massTargetCount === 0}
                onClick={() => setMassModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar Mensagem em Massa (App) ({massTargetCount})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-950/70 border-b border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os motoristas"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="accent-[#00E676] w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Nome do Motorista</th>
                  {showAssociacaoColumn && <th className="py-3 px-4">Associação</th>}
                  <th className="py-3 px-4">Data de Filiação</th>
                  <th className="py-3 px-4">Telefone / WhatsApp</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={showAssociacaoColumn ? 6 : 5}
                      className="py-12 text-center text-zinc-400 text-sm"
                    >
                      <Loader2 className="w-5 h-5 animate-spin text-[#00E676] inline-block mr-2" />
                      Carregando motoristas filiados...
                    </td>
                  </tr>
                ) : filteredMotoristas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showAssociacaoColumn ? 6 : 5}
                      className="py-12 text-center text-zinc-500 text-sm"
                    >
                      Nenhum motorista filiado encontrado para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredMotoristas.map((m) => {
                    const waLink = buildWhatsAppLink(
                      m.telefone,
                      `Olá ${m.nome}, contato da associação ${m.associacao_nome} via UBT Serviços.`,
                    );
                    const checked = selectedDriverIds.has(m.id);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-zinc-800/70 hover:bg-zinc-900/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${m.nome}`}
                            checked={checked}
                            onChange={() => toggleDriverSelection(m.id)}
                            className="accent-[#00E676] w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-sm text-zinc-100">{m.nome}</div>
                          {m.email && (
                            <div className="text-[11px] text-zinc-500">{m.email}</div>
                          )}
                        </td>
                        {showAssociacaoColumn && (
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#00E676] text-xs font-semibold">
                              <Building2 className="w-3 h-3" />
                              {m.associacao_nome}
                            </span>
                          </td>
                        )}
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                          {formatDataFiliacao(m.data_filiacao)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                          {formatPhoneDisplay(m.telefone)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00E676]/15 border border-[#00E676]/40 hover:bg-[#00E676]/25 text-[#00E676] text-xs font-bold no-underline transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-600">Sem telefone</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Histórico Recente de Comunicados In-App */}
        <section className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#00E676]" />
            <h3 className="font-display text-sm sm:text-base font-bold text-zinc-100 m-0">
              Comunicados In-App Recentes
            </h3>
          </div>
          {overview.mensagens_recentes.length === 0 ? (
            <p className="text-xs text-zinc-500 m-0">
              Nenhum comunicado em massa enviado ainda para este escopo.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {overview.mensagens_recentes.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-100">{msg.titulo}</span>
                    <span className="text-[11px] font-mono text-[#00E676] shrink-0">
                      {msg.total_destinatarios} dest.
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 m-0 line-clamp-2">{msg.conteudo}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-1">
                    <span>{msg.associacao_nome}</span>
                    <span>
                      {new Date(msg.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Editar Dados da Associação */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-zinc-50 m-0">
                Editar Dados da Associação
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 bg-transparent border-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAssociacao} className="p-5 flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={editForm.cnpj}
                    onChange={(e) => setEditForm((f) => ({ ...f, cnpj: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    Nome da Associação *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                  Endereço da Sede
                </label>
                <input
                  type="text"
                  value={editForm.endereco_sede}
                  onChange={(e) => setEditForm((f) => ({ ...f, endereco_sede: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    Nome do Presidente
                  </label>
                  <input
                    type="text"
                    value={editForm.presidente_nome}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, presidente_nome: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    CPF do Presidente
                  </label>
                  <input
                    type="text"
                    value={editForm.presidente_cpf}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, presidente_cpf: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    E-mail Oficial
                  </label>
                  <input
                    type="email"
                    value={editForm.email_oficial}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email_oficial: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    Telefone / WhatsApp do Responsável
                  </label>
                  <input
                    type="text"
                    value={editForm.telefone_responsavel}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, telefone_responsavel: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="h-10 px-5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Comunicado In-App em Massa */}
      {massModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#00E676]" />
                <h3 className="font-display text-base font-bold text-zinc-50 m-0">
                  Comunicado In-App em Massa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMassModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 bg-transparent border-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendMassMessage} className="p-5 flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                Destinatários: <strong className="text-[#00E676]">{massTargetLabel}</strong>
              </div>

              <div>
                <label
                  htmlFor="mass-msg-title"
                  className="text-[11px] font-mono uppercase text-zinc-400 block mb-1"
                >
                  Assunto / Título *
                </label>
                <input
                  id="mass-msg-title"
                  type="text"
                  required
                  value={massTitle}
                  onChange={(e) => setMassTitle(e.target.value)}
                  placeholder="Ex.: Reunião geral da associação nesta sexta-feira"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="mass-msg-content"
                  className="text-[11px] font-mono uppercase text-zinc-400 block mb-1"
                >
                  Mensagem *
                </label>
                <textarea
                  id="mass-msg-content"
                  required
                  rows={4}
                  value={massContent}
                  onChange={(e) => setMassContent(e.target.value)}
                  placeholder="Escreva o comunicado que será entregue na central de notificações do app do motorista..."
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMassModalOpen(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingMass}
                  className="h-10 px-5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendingMass ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Disparar Comunicado no App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
