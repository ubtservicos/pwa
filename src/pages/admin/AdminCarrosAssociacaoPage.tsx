import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Car,
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

export interface CarroAssociacaoDados {
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

export interface CarroMotoristaFiliado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  status: string;
  associacao_id: string | null;
  associacao_nome: string;
  data_filiacao: string | null;
}

export interface CarroMensagemRecente {
  id: string;
  associacao_id: string;
  titulo: string;
  conteudo: string;
  total_destinatarios: number;
  created_at: string;
}

interface OverviewPayload {
  caller_role: "super_admin" | "associacao";
  caller_associacao_id: string | null;
  caller_associacao_categoria?: string | null;
  associacoes: CarroAssociacaoDados[];
  motoristas: CarroMotoristaFiliado[];
  mensagens_recentes: CarroMensagemRecente[];
}

export function formatPhoneBR(raw?: string | null): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "Não informado";
  const local =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw || "Não informado";
}

export function buildWhatsAppLink(phone?: string | null, text?: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized =
    digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const base = `https://wa.me/${normalized}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function formatDataFiliacao(iso?: string | null): string {
  if (!iso) return "desde —";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "desde —";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `desde ${dd}/${mm}/${yyyy}`;
}

export default function AdminCarrosAssociacaoPage() {
  const toast = useAdminToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [callerRole, setCallerRole] = useState<"super_admin" | "associacao">("super_admin");
  const [selectedAssocId, setSelectedAssocId] = useState<string>("all");
  const [associacoes, setAssociacoes] = useState<CarroAssociacaoDados[]>([]);
  const [motoristas, setMotoristas] = useState<CarroMotoristaFiliado[]>([]);
  const [mensagensRecentes, setMensagensRecentes] = useState<CarroMensagemRecente[]>([]);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Modal Editar Dados da Associação
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    cnpj: "",
    nome: "",
    endereco_sede: "",
    presidente_nome: "",
    presidente_cpf: "",
    email_oficial: "",
    telefone_responsavel: "",
  });

  // Modal Comunicado In-App em Massa
  const [massModalOpen, setMassModalOpen] = useState(false);
  const [massTitle, setMassTitle] = useState("");
  const [massContent, setMassContent] = useState("");
  const [sendingMass, setSendingMass] = useState(false);

  const fetchOverview = useCallback(
    async (assocFilter: string, isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const rpcArg = assocFilter === "all" ? null : assocFilter;
        const { data, error } = await (supabase as any).rpc(
          "admin_get_carro_associacao_overview",
          { p_associacao_id: rpcArg },
        );

        if (error) throw error;
        const payload = data as OverviewPayload;
        const role = payload?.caller_role === "associacao" ? "associacao" : "super_admin";
        setCallerRole(role);
        setAssociacoes(Array.isArray(payload?.associacoes) ? payload.associacoes : []);
        setMotoristas(Array.isArray(payload?.motoristas) ? payload.motoristas : []);
        setMensagensRecentes(
          Array.isArray(payload?.mensagens_recentes) ? payload.mensagens_recentes : [],
        );

        if (role === "associacao" && payload?.caller_associacao_id) {
          setSelectedAssocId(payload.caller_associacao_id);
        }
        setSelectedIds(new Set());
      } catch (err: any) {
        console.error("Erro ao carregar associação de carros:", err);
        toastRef.current.show(err?.message || "Erro ao carregar dados da associação de carros.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchOverview(selectedAssocId);
  }, [fetchOverview, selectedAssocId]);

  const isSuperAdmin = callerRole === "super_admin";
  const isConsolidatedView = isSuperAdmin && selectedAssocId === "all";

  const currentAssoc = useMemo(() => {
    if (isConsolidatedView) return null;
    if (selectedAssocId !== "all") {
      return associacoes.find((a) => a.id === selectedAssocId) || associacoes[0] || null;
    }
    return associacoes[0] || null;
  }, [associacoes, selectedAssocId, isConsolidatedView]);

  const filteredMotoristas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return motoristas;
    return motoristas.filter(
      (m) =>
        m.nome.toLowerCase().includes(q) ||
        m.telefone.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.associacao_nome.toLowerCase().includes(q),
    );
  }, [motoristas, search]);

  const allVisibleSelected =
    filteredMotoristas.length > 0 &&
    filteredMotoristas.every((m) => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMotoristas.map((m) => m.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEditModal = () => {
    if (!currentAssoc) return;
    setEditForm({
      cnpj: currentAssoc.cnpj || "",
      nome: currentAssoc.nome || "",
      endereco_sede: currentAssoc.endereco_sede || "",
      presidente_nome: currentAssoc.presidente_nome || "",
      presidente_cpf: currentAssoc.presidente_cpf || "",
      email_oficial: currentAssoc.email_oficial || "",
      telefone_responsavel: currentAssoc.telefone_responsavel || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveAssoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssoc) return;
    setSavingEdit(true);
    try {
      const { error } = await (supabase as any).rpc(
        "admin_update_carro_associacao_dados",
        {
          p_associacao_id: currentAssoc.id,
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
      toast.show("Dados da associação de carros atualizados com sucesso! ✓");
      setEditModalOpen(false);
      await fetchOverview(selectedAssocId, true);
    } catch (err: any) {
      console.error("Erro ao atualizar associação de carros:", err);
      toast.show(err?.message || "Erro ao salvar dados da associação.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      toast.show("Telefone copiado para a área de transferência! ✓");
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      toast.show("Não foi possível copiar o telefone.");
    }
  };

  const handleSendMassMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!massTitle.trim() || !massContent.trim()) {
      toast.show("Preencha o título e o conteúdo do comunicado.");
      return;
    }

    const targetIds = Array.from(selectedIds);
    const targetAssocId =
      selectedAssocId !== "all"
        ? selectedAssocId
        : currentAssoc?.id ||
          (targetIds.length > 0
            ? motoristas.find((m) => m.id === targetIds[0])?.associacao_id || null
            : null);

    setSendingMass(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "admin_send_carro_associacao_mass_message",
        {
          p_associacao_id: targetAssocId,
          p_titulo: massTitle.trim(),
          p_conteudo: massContent.trim(),
          p_destinatario_ids: targetIds.length > 0 ? targetIds : null,
        },
      );
      if (error) throw error;
      const totalEnviados = Number(
        data?.total_destinatarios ?? (targetIds.length || motoristas.length),
      );
      toast.show(
        `Comunicado disparado no App para ${totalEnviados} motorista(s)! ✓`,
      );
      setMassTitle("");
      setMassContent("");
      setMassModalOpen(false);
      setSelectedIds(new Set());
      await fetchOverview(selectedAssocId, true);
    } catch (err: any) {
      console.error("Erro ao disparar comunicado em massa (Carros):", err);
      toast.show(err?.message || "Erro ao enviar comunicado em massa.");
    } finally {
      setSendingMass(false);
    }
  };

  const massTargetLabel =
    selectedIds.size > 0
      ? `${selectedIds.size} motorista(s) selecionado(s)`
      : isConsolidatedView
        ? `todos os ${motoristas.length} motoristas de carros filtrados`
        : `todos os ${motoristas.length} motoristas de ${currentAssoc?.nome || "sua associação"}`;

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#00E676] animate-spin" />
        <p className="text-sm text-zinc-400">
          Carregando gestão de associação de Carros...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-[#09090B] text-zinc-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#00E676]" />
            </div>
            <h1 className="font-display text-2xl font-bold text-zinc-50 m-0">
              Carros · Associação
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-zinc-900 border border-zinc-800 text-zinc-400">
              {isSuperAdmin ? "Visão Superadmin" : "Perfil Associação"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 mb-0">
            Cadastro oficial da entidade, quadro de motoristas de carro filiados e comunicados in-app em massa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="carro-assoc-select"
                className="text-xs font-mono uppercase text-zinc-400"
              >
                Filtrar Associação
              </label>
              <select
                id="carro-assoc-select"
                aria-label="Filtrar Associação"
                value={selectedAssocId}
                onChange={(e) => setSelectedAssocId(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#121215] border border-zinc-800 focus:border-[#00E676] text-xs font-semibold text-zinc-100 outline-none cursor-pointer"
              >
                <option value="all">Todas as Associações</option>
                {associacoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.total_motoristas})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => void fetchOverview(selectedAssocId, true)}
            disabled={refreshing}
            className="h-10 px-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#00E676]" : ""}`}
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* Card 1: Resumo Consolidado (Superadmin 'all') OU 7 Campos Cadastrais */}
      {isConsolidatedView ? (
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00E676]" />
              <h2 className="font-display text-base font-bold text-zinc-100 m-0">
                Resumo Consolidado · Associações de Carros
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              Selecione uma associação no filtro acima para visualizar/editar seus 7 campos cadastrais.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Associações de Carros
              </div>
              <div className="font-display text-3xl font-extrabold text-zinc-50 mt-1">
                {associacoes.length}
              </div>
            </div>
            <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Motoristas Filiados
              </div>
              <div className="font-display text-3xl font-extrabold text-[#00E676] mt-1">
                {motoristas.length}
              </div>
            </div>
            <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Comunicados Recentes
              </div>
              <div className="font-display text-3xl font-extrabold text-sky-400 mt-1">
                {mensagensRecentes.length}
              </div>
            </div>
          </div>
        </div>
      ) : currentAssoc ? (
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#00E676]" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase text-[#00E676] block">
                  Dados da Associação
                </span>
                <h2 className="font-display text-xl font-bold text-zinc-50 m-0">
                  {currentAssoc.nome}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={openEditModal}
              className="h-9 px-4 rounded-xl bg-[#09090B] border border-emerald-500/40 hover:border-[#00E676] text-[#00E676] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Dados da Associação
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1">
                1. CNPJ
              </div>
              <div className="font-mono font-semibold text-zinc-100">
                {currentAssoc.cnpj || "Não informado"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1">
                2. Nome Oficial
              </div>
              <div className="font-semibold text-zinc-100">
                {currentAssoc.nome || "Não informado"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#00E676]" />
                3. Endereço da Sede
              </div>
              <div className="text-zinc-200">
                {currentAssoc.endereco_sede || "Não informado"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1 inline-flex items-center gap-1">
                <User className="w-3 h-3 text-[#00E676]" />
                4. Nome do Presidente
              </div>
              <div className="font-semibold text-zinc-100">
                {currentAssoc.presidente_nome || "Não informado"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#00E676]" />
                5. CPF do Presidente
              </div>
              <div className="font-mono text-zinc-200">
                {currentAssoc.presidente_cpf || "Não informado"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80">
              <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1 inline-flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#00E676]" />
                6. E-mail Oficial
              </div>
              <div className="text-zinc-200 break-all">
                {currentAssoc.email_oficial || "Não informado"}
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3 p-3.5 rounded-xl bg-[#09090B] border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase text-zinc-500 mb-1 inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#00E676]" />
                  7. Telefone / WhatsApp do Responsável
                </div>
                <div className="font-mono font-bold text-zinc-100 text-base">
                  {formatPhoneBR(currentAssoc.telefone_responsavel)}
                </div>
              </div>

              {currentAssoc.telefone_responsavel && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyPhone(currentAssoc.telefone_responsavel)
                    }
                    className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedPhone ? (
                      <Check className="w-3.5 h-3.5 text-[#00E676]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedPhone ? "Copiado" : "Copiar"}
                  </button>
                  {buildWhatsAppLink(currentAssoc.telefone_responsavel) && (
                    <a
                      href={buildWhatsAppLink(currentAssoc.telefone_responsavel)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-[#00E676] text-xs font-bold inline-flex items-center gap-1.5 no-underline"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-6 text-center text-sm text-zinc-400">
          Nenhuma associação da categoria Carros cadastrada ainda.
        </div>
      )}

      {/* Card 2: Motoristas Filiados + Ações em Massa */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base font-bold text-zinc-100 m-0">
              Motoristas Filiados ({filteredMotoristas.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar motorista, telefone ou associação..."
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#09090B] border border-zinc-800 focus:border-[#00E676] text-xs text-zinc-100 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setMassModalOpen(true)}
              disabled={motoristas.length === 0}
              className="h-10 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Enviar Mensagem em Massa (App)
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        </div>

        {filteredMotoristas.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Nenhum motorista de carro vinculado encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-950/70 border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os motoristas"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-[#00E676] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Motorista</th>
                  {isConsolidatedView && <th className="py-3 px-4">Associação</th>}
                  <th className="py-3 px-4">Filiação</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {filteredMotoristas.map((m) => {
                  const waHref = buildWhatsAppLink(
                    m.telefone,
                    `Olá ${m.nome}, contato da administração UBT Carros.`,
                  );
                  return (
                    <tr key={m.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${m.nome}`}
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelectOne(m.id)}
                          className="w-4 h-4 accent-[#00E676] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-100">
                          {m.nome}
                        </div>
                        <div className="text-xs text-zinc-500">{m.email}</div>
                      </td>
                      {isConsolidatedView && (
                        <td className="py-3 px-4 text-xs font-medium text-zinc-300">
                          {m.associacao_nome}
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                        {formatDataFiliacao(m.data_filiacao)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-200">
                        {formatPhoneBR(m.telefone)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 capitalize">
                          {m.status || "ativo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 hover:bg-emerald-500/25 text-[#00E676] text-xs font-bold no-underline"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico de Comunicados In-App */}
      {mensagensRecentes.length > 0 && (
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#00E676]" />
            <h3 className="font-display text-base font-bold text-zinc-100 m-0">
              Histórico de Comunicados Enviados (App)
            </h3>
          </div>
          <div className="space-y-2.5">
            {mensagensRecentes.map((msg) => (
              <div
                key={msg.id}
                className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-zinc-100">
                    {msg.titulo}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 mb-0">
                    {msg.conteudo}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-[#00E676]">
                    {msg.total_destinatarios} destinatário(s)
                  </span>
                  <div className="text-[11px] font-mono text-zinc-500 mt-1">
                    {new Date(msg.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Editar 7 Campos da Associação */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#00E676]" />
                <h3 className="font-display text-base font-bold text-zinc-50 m-0">
                  Editar Dados da Associação (Carros)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 bg-transparent border-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssoc} className="p-5 flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={editForm.cnpj}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, cnpj: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, nome: e.target.value }))
                    }
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
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, endereco_sede: e.target.value }))
                  }
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
                      setEditForm((f) => ({
                        ...f,
                        presidente_nome: e.target.value,
                      }))
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
                      setEditForm((f) => ({
                        ...f,
                        presidente_cpf: e.target.value,
                      }))
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
                      setEditForm((f) => ({
                        ...f,
                        email_oficial: e.target.value,
                      }))
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
                      setEditForm((f) => ({
                        ...f,
                        telefone_responsavel: e.target.value,
                      }))
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
                  Comunicado In-App em Massa (Carros)
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

            <form
              onSubmit={handleSendMassMessage}
              className="p-5 flex flex-col gap-4"
            >
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                Destinatários:{" "}
                <strong className="text-[#00E676]">{massTargetLabel}</strong>
              </div>

              <div>
                <label
                  htmlFor="carro-mass-msg-title"
                  className="text-[11px] font-mono uppercase text-zinc-400 block mb-1"
                >
                  Assunto / Título *
                </label>
                <input
                  id="carro-mass-msg-title"
                  type="text"
                  required
                  value={massTitle}
                  onChange={(e) => setMassTitle(e.target.value)}
                  placeholder="Ex.: Reunião mensal dos motoristas de carros"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-[#00E676] text-sm text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="carro-mass-msg-content"
                  className="text-[11px] font-mono uppercase text-zinc-400 block mb-1"
                >
                  Mensagem *
                </label>
                <textarea
                  id="carro-mass-msg-content"
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
