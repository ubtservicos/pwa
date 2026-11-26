import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Plus,
  Copy,
  Check,
  Star,
  Edit3,
  Power,
  KeyRound,
  ShieldCheck,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  applyPixMask,
  getPixMaxLength,
  getPixPlaceholder,
  isValidCPF,
  isValidCNPJ,
  isValidEmail,
  isValidPixPhone,
  isValidEVP,
} from "@/utils/masks";

export type PlatformPixType = "cnpj" | "cpf" | "email" | "telefone" | "aleatoria";
export type PlatformAccountFinalidade =
  | "principal_recebimento"
  | "fundo_comunidade"
  | "fundo_premios"
  | "reserva_operacional"
  | "outro";

export interface PlatformBankAccount {
  id: string;
  apelido: string;
  instituicao: string;
  titular_nome: string;
  titular_documento: string;
  tipo_chave_pix: PlatformPixType;
  chave_pix: string;
  finalidade: PlatformAccountFinalidade;
  mp_user_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

const FINALIDADE_LABELS: Record<PlatformAccountFinalidade, string> = {
  principal_recebimento: "Principal (Recebimento & Split)",
  fundo_comunidade: "Fundo Comunidade (0,5%)",
  fundo_premios: "Fundo Prêmios / Sorteios (1,0%)",
  reserva_operacional: "Reserva Operacional",
  outro: "Outra Finalidade",
};

const PIX_TYPE_LABELS: Record<PlatformPixType, string> = {
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "E-MAIL",
  telefone: "TELEFONE",
  aleatoria: "ALEATÓRIA (EVP)",
};

interface AccountFormState {
  id: string | null;
  apelido: string;
  instituicao: string;
  titular_nome: string;
  titular_documento: string;
  tipo_chave_pix: PlatformPixType;
  chave_pix: string;
  finalidade: PlatformAccountFinalidade;
  mp_user_id: string;
  is_primary: boolean;
  is_active: boolean;
  observacoes: string;
}

const EMPTY_FORM: AccountFormState = {
  id: null,
  apelido: "",
  instituicao: "Mercado Pago (323)",
  titular_nome: "UBT Plataforma Digital Ltda",
  titular_documento: "68.394.558/0001-32",
  tipo_chave_pix: "cnpj",
  chave_pix: "",
  finalidade: "outro",
  mp_user_id: "",
  is_primary: false,
  is_active: true,
  observacoes: "",
};

function validatePixByType(tipo: PlatformPixType, valor: string): string | null {
  const v = valor.trim();
  if (!v) return "Informe a Chave PIX.";
  if (tipo === "cnpj" && !isValidCNPJ(v)) return "CNPJ inválido. Confira os 14 dígitos.";
  if (tipo === "cpf" && !isValidCPF(v)) return "CPF inválido. Confira os 11 dígitos.";
  if (tipo === "email" && !isValidEmail(v)) return "E-mail inválido.";
  if (tipo === "telefone" && !isValidPixPhone(v)) return "Telefone inválido. Informe DDD + número.";
  if (tipo === "aleatoria" && !isValidEVP(v)) {
    return "Chave Aleatória (EVP) inválida. Informe UUID de 36 caracteres ou 32 caracteres hexadecimais.";
  }
  return null;
}

export default function AdminContasUbtPage() {
  const toast = useAdminToast();
  const [accounts, setAccounts] = useState<PlatformBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFinalidade, setFilterFinalidade] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_bank_accounts")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts((data || []) as PlatformBankAccount[]);
    } catch (err: any) {
      console.error("Erro ao carregar contas UBT:", err);
      toast.show(err?.message || "Erro ao carregar contas da plataforma UBT.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const primaryAccount = useMemo(
    () => accounts.find((a) => a.is_primary && a.is_active) || accounts[0] || null,
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    if (filterFinalidade === "all") return accounts;
    return accounts.filter((a) => a.finalidade === filterFinalidade);
  }, [accounts, filterFinalidade]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      toast.show("Chave PIX copiada! ✓");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.show("Não foi possível copiar.");
    }
  };

  const openNewModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (acc: PlatformBankAccount) => {
    setForm({
      id: acc.id,
      apelido: acc.apelido,
      instituicao: acc.instituicao,
      titular_nome: acc.titular_nome,
      titular_documento: acc.titular_documento,
      tipo_chave_pix: acc.tipo_chave_pix,
      chave_pix: acc.chave_pix,
      finalidade: acc.finalidade,
      mp_user_id: acc.mp_user_id || "",
      is_primary: acc.is_primary,
      is_active: acc.is_active,
      observacoes: acc.observacoes || "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.apelido.trim().length < 2) {
      setFormError("Informe o apelido da conta (mínimo 2 caracteres).");
      return;
    }
    if (form.instituicao.trim().length < 2) {
      setFormError("Informe a instituição financeira.");
      return;
    }
    const pixErr = validatePixByType(form.tipo_chave_pix, form.chave_pix);
    if (pixErr) {
      setFormError(pixErr);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_upsert_platform_bank_account", {
        p_id: form.id,
        p_apelido: form.apelido.trim(),
        p_instituicao: form.instituicao.trim(),
        p_titular_nome: form.titular_nome.trim(),
        p_titular_documento: form.titular_documento.trim(),
        p_tipo_chave_pix: form.tipo_chave_pix,
        p_chave_pix:
          form.tipo_chave_pix === "aleatoria"
            ? form.chave_pix.trim().toLowerCase()
            : form.chave_pix.trim(),
        p_finalidade: form.finalidade,
        p_mp_user_id: form.mp_user_id.trim() || null,
        p_is_primary: form.is_primary,
        p_is_active: form.is_active,
        p_observacoes: form.observacoes.trim() || null,
      });

      if (error) throw error;
      toast.show(form.id ? "Conta UBT atualizada com sucesso! ✓" : "Nova conta UBT cadastrada! ✓");
      setShowModal(false);
      await loadAccounts();
    } catch (err: any) {
      setFormError(err?.message || "Erro ao salvar conta UBT.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (acc: PlatformBankAccount) => {
    setBusyId(acc.id);
    try {
      const { error } = await supabase.rpc("admin_set_primary_platform_bank_account", {
        p_account_id: acc.id,
      });
      if (error) throw error;
      toast.show(`"${acc.apelido}" definida como Conta Principal da UBT! ✓`);
      await loadAccounts();
    } catch (err: any) {
      toast.show(err?.message || "Erro ao definir conta principal.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (acc: PlatformBankAccount) => {
    setBusyId(acc.id);
    try {
      const { error } = await supabase.rpc("admin_toggle_platform_bank_account", {
        p_account_id: acc.id,
        p_is_active: !acc.is_active,
      });
      if (error) throw error;
      toast.show(acc.is_active ? "Conta desativada." : "Conta reativada! ✓");
      await loadAccounts();
    } catch (err: any) {
      toast.show(err?.message || "Erro ao alterar status da conta.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50 p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] text-[11px] font-bold uppercase tracking-wider mb-2">
            <Landmark size={13} /> Financeiro · Multi-Conta UBT
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 m-0">
            Contas & Chaves PIX UBT
          </h1>
          <p className="text-sm text-zinc-400 mt-1 m-0">
            Gerencie a conta principal de recebimento e cadastre múltiplas contas/chaves PIX para fundos e reservas da plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="h-11 px-5 rounded-xl bg-[#00E676] hover:bg-emerald-400 text-zinc-950 font-bold text-sm inline-flex items-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.25)] transition-all cursor-pointer"
        >
          <Plus size={18} />
          Adicionar Nova Conta UBT
        </button>
      </div>

      {/* Highlight Card: Active Primary Account */}
      {primaryAccount && (
        <div className="rounded-2xl bg-[#121215] border border-[#00E676]/40 p-6 shadow-[0_0_30px_rgba(0,230,118,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/35">
                  <Star size={12} /> CONTA PRINCIPAL ATIVA
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                  {FINALIDADE_LABELS[primaryAccount.finalidade] || primaryAccount.finalidade}
                </span>
              </div>
              <h2 className="font-display text-xl font-bold text-zinc-50 m-0">
                {primaryAccount.apelido}
              </h2>
              <p className="text-xs text-zinc-400 m-0">
                {primaryAccount.instituicao} · Titular: <strong className="text-zinc-200">{primaryAccount.titular_nome}</strong> ({primaryAccount.titular_documento})
              </p>
              {primaryAccount.mp_user_id && (
                <p className="text-xs text-zinc-400 m-0">
                  Mercado Pago Collector ID:{" "}
                  <strong className="font-mono text-[#00E676]">{primaryAccount.mp_user_id}</strong>
                </p>
              )}
            </div>

            <div className="min-w-[260px] rounded-xl bg-[#09090B] border border-zinc-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound size={12} className="text-[#00E676]" /> Chave PIX ({PIX_TYPE_LABELS[primaryAccount.tipo_chave_pix]})
                </span>
                <ShieldCheck size={14} className="text-[#00E676]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-zinc-50 break-all flex-1 select-all">
                  {primaryAccount.chave_pix}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy(primaryAccount.chave_pix, `primary-${primaryAccount.id}`)}
                  className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-[#00E676] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedId === `primary-${primaryAccount.id}` ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === `primary-${primaryAccount.id}` ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar + Accounts List */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-200 m-0">
            Todas as Contas Cadastradas ({filteredAccounts.length})
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Finalidade:</span>
            <select
              value={filterFinalidade}
              onChange={(e) => setFilterFinalidade(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-xs text-zinc-100 outline-none"
            >
              <option value="all">Todas</option>
              <option value="principal_recebimento">Principal (Recebimento)</option>
              <option value="fundo_comunidade">Fundo Comunidade</option>
              <option value="fundo_premios">Fundo Prêmios</option>
              <option value="reserva_operacional">Reserva Operacional</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 size={18} className="animate-spin text-[#00E676]" />
            Carregando contas UBT...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            Nenhuma conta encontrada para este filtro.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAccounts.map((acc) => {
              const isBusy = busyId === acc.id;
              return (
                <div
                  key={acc.id}
                  className={`rounded-xl bg-[#09090B] border p-4 flex flex-col justify-between gap-3 ${
                    acc.is_primary
                      ? "border-[#00E676]/45"
                      : acc.is_active
                        ? "border-zinc-800"
                        : "border-zinc-800/60 opacity-65"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-zinc-50">{acc.apelido}</span>
                          {acc.is_primary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                              Principal
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              acc.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {acc.is_active ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {acc.instituicao} · {FINALIDADE_LABELS[acc.finalidade] || acc.finalidade}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400">
                      Titular: <span className="text-zinc-200">{acc.titular_nome}</span> ({acc.titular_documento})
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-[#121215] border border-zinc-800 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                          PIX · {PIX_TYPE_LABELS[acc.tipo_chave_pix]}
                        </div>
                        <div className="font-mono text-xs text-zinc-100 break-all select-all">
                          {acc.chave_pix}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(acc.chave_pix, acc.id)}
                        className="h-7 px-2.5 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-[#00E676] text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedId === acc.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === acc.id ? "Copiado" : "Copiar"}
                      </button>
                    </div>

                    {acc.mp_user_id && (
                      <div className="text-[11px] text-zinc-400">
                        MP User ID: <span className="font-mono text-zinc-200">{acc.mp_user_id}</span>
                      </div>
                    )}
                    {acc.observacoes && (
                      <div className="text-[11px] text-zinc-500">{acc.observacoes}</div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                    {!acc.is_primary && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSetPrimary(acc)}
                        className="h-8 px-3 rounded-lg bg-[#00E676]/15 hover:bg-[#00E676]/25 border border-[#00E676]/35 text-[#00E676] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Star size={12} /> Definir Principal
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openEditModal(acc)}
                      className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={12} /> Editar
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleActive(acc)}
                      className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Power size={12} /> {acc.is_active ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Adicionar / Editar Conta UBT */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#121215] border border-zinc-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-zinc-50 m-0">
                {form.id ? "Editar Conta UBT" : "Adicionar Nova Conta UBT"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 cursor-pointer"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Apelido da Conta *</label>
                <input
                  type="text"
                  value={form.apelido}
                  onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))}
                  placeholder="Ex.: Conta Fundo Prêmios — Banco Inter"
                  className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Instituição *</label>
                  <input
                    type="text"
                    value={form.instituicao}
                    onChange={(e) => setForm((f) => ({ ...f, instituicao: e.target.value }))}
                    placeholder="Ex.: Mercado Pago (323)"
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Finalidade *</label>
                  <select
                    value={form.finalidade}
                    onChange={(e) => setForm((f) => ({ ...f, finalidade: e.target.value as PlatformAccountFinalidade }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-[#00E676]"
                  >
                    <option value="principal_recebimento">Principal (Recebimento)</option>
                    <option value="fundo_comunidade">Fundo Comunidade</option>
                    <option value="fundo_premios">Fundo Prêmios / Sorteios</option>
                    <option value="reserva_operacional">Reserva Operacional</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Titular *</label>
                  <input
                    type="text"
                    value={form.titular_nome}
                    onChange={(e) => setForm((f) => ({ ...f, titular_nome: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">CNPJ / CPF Titular *</label>
                  <input
                    type="text"
                    value={form.titular_documento}
                    onChange={(e) => setForm((f) => ({ ...f, titular_documento: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm font-mono text-zinc-100 outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Tipo Chave PIX *</label>
                  <select
                    value={form.tipo_chave_pix}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        tipo_chave_pix: e.target.value as PlatformPixType,
                        chave_pix: "",
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-[#00E676]"
                  >
                    <option value="cnpj">CNPJ</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatória (EVP)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Chave PIX *</label>
                  <input
                    type="text"
                    value={form.chave_pix}
                    maxLength={getPixMaxLength(form.tipo_chave_pix)}
                    placeholder={getPixPlaceholder(form.tipo_chave_pix)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        chave_pix: applyPixMask(e.target.value, f.tipo_chave_pix),
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm font-mono text-zinc-100 outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Mercado Pago User ID (opcional)</label>
                  <input
                    type="text"
                    value={form.mp_user_id}
                    onChange={(e) => setForm((f) => ({ ...f, mp_user_id: e.target.value }))}
                    placeholder="Ex.: 3593998633"
                    className="w-full h-10 px-3 rounded-xl bg-[#09090B] border border-zinc-800 text-sm font-mono text-zinc-100 outline-none focus:border-[#00E676]"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_primary}
                      onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                      className="accent-[#00E676] w-4 h-4"
                    />
                    Definir como Conta Principal UBT
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Observações (opcional)</label>
                <textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Notas internas de uso desta conta..."
                  className="w-full p-3 rounded-xl bg-[#09090B] border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-[#00E676] resize-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-xl bg-[#00E676] hover:bg-emerald-400 text-zinc-950 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Salvando..." : form.id ? "Salvar Alterações" : "Cadastrar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
