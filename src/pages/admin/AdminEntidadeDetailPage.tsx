import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AtSign,
  Ban,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  CreditCard,
  History,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Waves,
} from "lucide-react";
import { Card } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import AdminPixQuickEditor from "@/components/admin/AdminPixQuickEditor";
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
import { getAppOrigin } from "@/lib/appUrl";
import { maskCNPJ, maskCPF, maskPhone, generateReferralSlug } from "@/utils/masks";

interface MembroItem {
  id: string;
  nome: string;
  papel: string;
  cadastroCompleto: boolean;
}

export default function AdminEntidadeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [dbUser, setDbUser] = useState<any | null>(null);
  const [dbWaitlist, setDbWaitlist] = useState<any | null>(null);
  const [mpConnected, setMpConnected] = useState(false);
  const [membros, setMembros] = useState<MembroItem[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [loading, setLoading] = useState(true);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customSlug, setCustomSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState("");

  // Action modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleCopy = async (text: string, key: string, label = "Copiado!") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.show(`${label} ✓`);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      toast.show("Não foi possível copiar.");
    }
  };

  useEffect(() => {
    const loadEntidade = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: userRow, error: userErr } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (userErr) throw userErr;

        let wlRow: any = null;
        if (userRow) {
          const orClauses: string[] = [`user_id.eq.${id}`];
          if (userRow.email) orClauses.push(`email.eq.${userRow.email}`);
          if (userRow.cnpj) orClauses.push(`cnpj.eq.${userRow.cnpj}`);
          if (userRow.telefone) orClauses.push(`telefone.eq.${userRow.telefone}`);
          const { data: wlData } = await supabase
            .from("waitlist")
            .select("*")
            .or(orClauses.join(","))
            .limit(1)
            .maybeSingle();
          wlRow = wlData;
        } else {
          // Fallback caso venha apenas da waitlist
          const { data: wlDirect } = await supabase
            .from("waitlist")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          wlRow = wlDirect;
        }

        if (!userRow && !wlRow) {
          setDbUser(null);
          setDbWaitlist(null);
          setLoading(false);
          return;
        }

        const targetId = userRow?.id || wlRow?.user_id || wlRow?.id;
        const { data: mpAcc } = await supabase
          .from("marketplace_accounts")
          .select("id, status")
          .eq("user_id", targetId)
          .eq("status", "CONNECTED")
          .limit(1);

        setDbUser(userRow);
        setDbWaitlist(wlRow);
        setMpConnected(
          Boolean((mpAcc || []).length > 0) ||
            Boolean(userRow?.possui_mercadopago) ||
            Boolean(userRow?.metadata?.possui_mercado_pago) ||
            Boolean(wlRow?.possui_mp) ||
            Boolean(wlRow?.possui_mercado_pago),
        );

        const initialSlug =
          userRow?.referral_code ||
          wlRow?.referral_code ||
          wlRow?.referral_slug ||
          wlRow?.slug ||
          userRow?.metadata?.referral_code ||
          "";
        setCustomSlug(initialSlug);

        // Carregar membros / apadrinhados vinculados (somente cadastral, sem valores financeiros)
        setLoadingMembros(true);
        try {
          const { data: apadData } = await supabase.rpc("obter_meus_apadrinhados", {
            p_padrinho_id: targetId,
          });
          const mapped: MembroItem[] = Array.isArray(apadData)
            ? apadData.map((a: any) => ({
                id: String(a.id),
                nome: String(a.nome || "Membro"),
                papel: String(a.tipo_cadastro || "membro"),
                cadastroCompleto: Boolean(a.cadastro_completo),
              }))
            : [];
          setMembros(mapped);
        } catch {
          setMembros([]);
        } finally {
          setLoadingMembros(false);
        }
      } catch (err) {
        console.error("Erro ao carregar entidade:", err);
        toast.show("Erro ao carregar ficha da entidade.");
      } finally {
        setLoading(false);
      }
    };

    void loadEntidade();
  }, [id]);

  const entidade = useMemo(() => {
    if (!dbUser && !dbWaitlist) return null;
    const u = dbUser || {};
    const w = dbWaitlist || {};

    const razaoSocial =
      u.razao_social || u.metadata?.razao_social || w.razao_social || u.nome || w.nome || "Entidade Sem Razão Social";
    const nomeFantasia = u.nome_fantasia || u.nome || w.nome_fantasia || w.nome || razaoSocial;
    const cnpjRaw = String(u.cnpj || u.metadata?.cnpj || w.cnpj || "").replace(/\D/g, "");
    const cnpj = cnpjRaw ? maskCNPJ(cnpjRaw) : "Não informado";
    const email = u.email || w.email || "Não informado";
    const telefoneRaw = u.telefone || w.telefone || "";
    const telefone = telefoneRaw ? maskPhone(telefoneRaw) : "Não cadastrado";

    const responsavelNome =
      u.responsavel_legal || u.responsavel_nome || w.responsavel_nome || w.responsavel_legal || "Não informado";
    const responsavelCpfRaw = String(
      u.cpf_responsavel || w.responsavel_cpf || w.cpf_responsavel || u.cpf || "",
    ).replace(/\D/g, "");
    const responsavelCpf = responsavelCpfRaw ? maskCPF(responsavelCpfRaw) : "Não informado";
    const responsavelCargo = u.metadata?.cargo_responsavel || "Representante Legal";
    const responsavelContato = u.metadata?.telefone_responsavel
      ? maskPhone(u.metadata.telefone_responsavel)
      : telefone;

    const cadastroCompleto =
      u.cadastro_completo === true || u.metadata?.cadastro_completo === true || w.cadastro_completo === true;
    const slug = String(
      u.referral_code ||
        w.referral_code ||
        w.referral_slug ||
        w.slug ||
        u.metadata?.referral_code ||
        generateReferralSlug(nomeFantasia || razaoSocial, cnpjRaw || u.id || w.id) ||
        "",
    ).trim();

    const chavePix = String(u.chave_pix || w.pix_chave || w.chave_pix || "").trim();
    const tipoChavePix = String(u.tipo_chave_pix || w.pix_tipo || w.tipo_chave_pix || "").trim();

    const cidade = u.metadata?.cidade || w.cidade || "Ubatuba - SP";
    const bairro = u.bairro || u.bairro_residencia || u.bairro_moradia || u.regiao_atuacao || w.bairro_moradia || null;
    const endereco = u.metadata?.endereco || w.endereco || null;
    const bairrosAtuacao: string[] = Array.isArray(u.bairros_atuacao)
      ? u.bairros_atuacao
      : Array.isArray(w.bairros_atuacao)
        ? w.bairros_atuacao
        : [];
    const praias: string[] = Array.isArray(u.praias) ? u.praias : Array.isArray(w.praias) ? w.praias : [];

    const isBlocked = Boolean(u.is_blocked);
    const blockedUntil = u.blocked_until || null;
    const blockDurationLabel = u.block_duration_label || null;
    const blockedReason = u.blocked_reason || null;

    return {
      id: u.id || w.user_id || w.id,
      razaoSocial,
      nomeFantasia,
      cnpj,
      email,
      telefone,
      telefoneRaw,
      responsavelNome,
      responsavelCpf,
      responsavelCargo,
      responsavelContato,
      cadastroCompleto,
      slug,
      createdAt: u.created_at || w.created_at_utc || new Date().toISOString(),
      updatedAt: u.updated_at || null,
      cidade,
      bairro,
      endereco,
      bairrosAtuacao,
      praias,
      chavePix,
      tipoChavePix,
      hasPix: Boolean(chavePix),
      mpConnected,
      isBlocked,
      blockedUntil,
      blockDurationLabel,
      blockedReason,
      isBlockedActive: isUserBlockedActive({ isBlocked, blockedUntil }),
    };
  }, [dbUser, dbWaitlist, mpConnected]);

  const handleSaveSlug = async () => {
    if (!entidade) return;
    const clean = customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!clean || clean.length < 3 || clean.length > 40) {
      setSlugError("O slug deve ter entre 3 e 40 caracteres (letras minúsculas, números e hífens).");
      return;
    }
    setSavingSlug(true);
    setSlugError("");
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("set_user_referral_code", {
        p_user_id: entidade.id,
        p_code: clean,
      });
      if (!rpcErr && rpcRes && rpcRes.success === false) {
        setSlugError(rpcRes.error || "Slug indisponível.");
        return;
      }
      if (rpcErr && dbUser?.id) {
        const { error: updErr } = await supabase
          .from("usuarios")
          .update({ referral_code: clean })
          .eq("id", dbUser.id);
        if (updErr) throw updErr;
      }
      if (dbWaitlist?.id) {
        await supabase
          .from("waitlist")
          .update({ referral_code: clean, referral_slug: clean, slug: clean })
          .eq("id", dbWaitlist.id);
      }
      setDbUser((prev: any) => (prev ? { ...prev, referral_code: clean } : prev));
      setDbWaitlist((prev: any) => (prev ? { ...prev, referral_code: clean, slug: clean } : prev));
      setCustomSlug(clean);
      toast.show("Slug UBT da entidade atualizado! ✓");
    } catch (err: any) {
      setSlugError(err?.message || "Erro ao salvar slug.");
    } finally {
      setSavingSlug(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center min-h-[60vh] gap-2.5 text-zinc-400">
        <Loader2 size={18} className="animate-spin text-emerald-400" />
        <span>Carregando ficha cadastral da entidade...</span>
      </div>
    );
  }

  if (!entidade) {
    return (
      <div style={{ padding: 32 }}>
        <button
          type="button"
          onClick={() => navigate("/admin/entidades")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-zinc-100 mb-6"
        >
          <ArrowLeft size={16} /> Voltar para Entidades
        </button>
        <Card style={{ padding: 40, textAlign: "center", background: "#121215", border: "1px solid rgba(239,68,68,0.4)" }}>
          <div className="font-display text-lg font-bold text-red-400">Entidade não encontrada</div>
          <div className="text-sm text-zinc-400 mt-2">O registro solicitado não existe ou foi removido.</div>
        </Card>
      </div>
    );
  }

  const actionTarget: AdminActionClientTarget = {
    id: entidade.id,
    name: entidade.nomeFantasia || entidade.razaoSocial,
    razaoSocial: entidade.razaoSocial,
    cnpj: entidade.cnpj,
    email: entidade.email,
    phone: entidade.telefoneRaw || entidade.telefone,
    slug: entidade.slug,
    entityType: "entidade",
    createdAt: entidade.createdAt,
    updatedAt: entidade.updatedAt,
    cadastroCompleto: entidade.cadastroCompleto,
    isBlocked: entidade.isBlocked,
    blockedUntil: entidade.blockedUntil,
    blockDurationLabel: entidade.blockDurationLabel,
    blockedReason: entidade.blockedReason,
  };

  const referralInviteUrl = `${getAppOrigin()}/${entidade.slug}`;
  const rawPhoneDigits = String(entidade.telefoneRaw || entidade.telefone || "").replace(/\D/g, "");
  const cleanEntidadeEmail =
    entidade.email && entidade.email.includes("@") ? entidade.email.trim().toLowerCase() : "";
  const cadastralUpdateUrl =
    rawPhoneDigits.length >= 8
      ? `${getAppOrigin()}/atualizacao-cadastral?telefone=${encodeURIComponent(rawPhoneDigits)}`
      : cleanEntidadeEmail
        ? `${getAppOrigin()}/atualizacao-cadastral?email=${encodeURIComponent(cleanEntidadeEmail)}`
        : `${getAppOrigin()}/atualizacao-cadastral`;

  const sectionCardStyle = {
    padding: 22,
    background: "#121215",
    border: "1px solid #27272A",
    borderRadius: 16,
  } as const;

  const fieldRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-800/80 last:border-none">
      <div className="mt-0.5 text-zinc-400 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">{label}</div>
        <div className="text-[14px] text-zinc-100 font-medium mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1220, margin: "0 auto" }}>
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate("/admin/entidades")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para Entidades
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="h-9 px-3.5 rounded-xl bg-[#09090B] border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <History size={14} /> Histórico
          </button>
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="h-9 px-3.5 rounded-xl bg-[#09090B] border border-emerald-500/45 text-emerald-400 hover:bg-emerald-950/40 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className={`h-9 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              entidade.isBlockedActive
                ? "bg-[#09090B] border-emerald-500 text-emerald-400 hover:bg-emerald-950/40"
                : "bg-[#09090B] border-red-500 text-red-400 hover:bg-red-950/50"
            }`}
          >
            {entidade.isBlockedActive ? <ShieldCheck size={14} /> : <Ban size={14} />}
            {entidade.isBlockedActive ? "Desbloquear Entidade" : "Bloquear Entidade"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="h-9 px-3.5 rounded-xl bg-red-950/35 border border-red-500/60 text-red-400 hover:bg-red-950/70 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} /> Deletar
          </button>
        </div>
      </div>

      {/* Header Cadastral (Preto & Cinza — ZERO dados financeiros) */}
      <Card
        style={{
          padding: 24,
          marginBottom: 24,
          background: "linear-gradient(135deg, #09090B 0%, #121215 100%)",
          border: entidade.isBlockedActive ? "1px solid rgba(239,68,68,0.5)" : "1px solid #27272A",
          borderRadius: 18,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#09090B] border border-zinc-800 flex items-center justify-center shrink-0">
              <Building2 size={30} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-zinc-100 m-0">
                  {entidade.razaoSocial}
                </h1>
                {entidade.isBlockedActive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/60 text-red-400 border border-red-500/50">
                    Bloqueado · {formatBlockedSummary(entidade)}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Acesso Ativo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-900 text-zinc-300 border border-zinc-700">
                  Pessoa Jurídica / Associação
                </span>
                {entidade.cadastroCompleto ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Cadastro Completo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Cadastro Incompleto
                  </span>
                )}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#09090B] text-zinc-200 border border-zinc-800">
                  @{entidade.slug}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-400 font-mono">
            <div>CNPJ: {entidade.cnpj}</div>
            <div className="mt-1">
              Entidade desde {new Date(entidade.createdAt).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
      </Card>

      {/* Grid das Seções Cadastrais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. DADOS DA PESSOA JURÍDICA */}
        <Card style={sectionCardStyle}>
          <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
            1. Dados da Pessoa Jurídica
          </h2>
          <div>
            {fieldRow(<Building2 size={15} />, "Razão Social", entidade.razaoSocial)}
            {fieldRow(<Building2 size={15} />, "Nome Fantasia", entidade.nomeFantasia)}
            {fieldRow(<CreditCard size={15} />, "CNPJ", entidade.cnpj)}
            {fieldRow(<Mail size={15} />, "E-mail Institucional", entidade.email)}
            {fieldRow(
              <Calendar size={15} />,
              "Entidade desde",
              new Date(entidade.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }),
            )}
          </div>

          {/* BLOCO SEPARADO A: SLUG UBT */}
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-zinc-300">
              <AtSign size={13} className="text-emerald-400" />
              Slug UBT (Identificador da Entidade)
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center rounded-lg bg-[#09090B] border border-zinc-800 px-3">
                <span className="font-mono text-xs text-zinc-500 mr-0.5">@</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => {
                    setCustomSlug(e.target.value);
                    setSlugError("");
                  }}
                  placeholder="slug-da-entidade"
                  className="flex-1 h-9 bg-transparent font-mono text-xs text-zinc-100 outline-none"
                />
              </div>
              <button
                type="button"
                disabled={savingSlug}
                onClick={handleSaveSlug}
                className="h-9 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold disabled:opacity-50"
              >
                {savingSlug ? "Salvando..." : "Salvar Slug"}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy(entidade.slug, "slug", "Slug copiado")}
                className="h-9 px-3 rounded-lg bg-[#09090B] border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {copiedKey === "slug" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                Copiar
              </button>
            </div>
            {slugError && <p className="text-xs text-red-400 m-0">{slugError}</p>}
          </div>

          {/* BLOCO SEPARADO B: LINK DE APADRINHAMENTO / CONVITE */}
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-zinc-300">
              <Link2 size={13} className="text-emerald-400" />
              Link de Apadrinhamento / Convite
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#09090B] border border-zinc-800 p-2 pl-3">
              <span className="font-mono text-xs text-zinc-300 truncate flex-1 select-all">
                {referralInviteUrl}
              </span>
              <button
                type="button"
                onClick={() => void handleCopy(referralInviteUrl, "reflink", "Link de convite copiado")}
                className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
              >
                {copiedKey === "reflink" ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === "reflink" ? "Copiado!" : "Copiar Link"}
              </button>
            </div>
          </div>

          {/* BLOCO SEPARADO C: LINK DE ATUALIZAÇÃO CADASTRAL */}
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-zinc-300">
              <Link2 size={13} className="text-emerald-400" />
              Link de Atualização Cadastral
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#09090B] border border-zinc-800 p-2 pl-3">
              <span className="font-mono text-xs text-zinc-300 truncate flex-1 select-all">
                {cadastralUpdateUrl}
              </span>
              <button
                type="button"
                onClick={() =>
                  void handleCopy(
                    cadastralUpdateUrl,
                    "updatelink",
                    "Link de atualização cadastral copiado",
                  )
                }
                className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
              >
                {copiedKey === "updatelink" ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === "updatelink" ? "Copiado!" : "Copiar Link"}
              </button>
            </div>
          </div>
        </Card>

        {/* 2 & 3. RESPONSÁVEL LEGAL + CONTATO & LOCALIZAÇÃO */}
        <div className="flex flex-col gap-6">
          <Card style={sectionCardStyle}>
            <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
              2. Responsável Legal
            </h2>
            <div>
              {fieldRow(<User size={15} />, "Nome Completo", entidade.responsavelNome)}
              {fieldRow(<CreditCard size={15} />, "CPF do Representante", entidade.responsavelCpf)}
              {fieldRow(<Users size={15} />, "Cargo / Vínculo", entidade.responsavelCargo)}
              {fieldRow(<Phone size={15} />, "Contato do Representante", entidade.responsavelContato)}
            </div>
          </Card>

          <Card style={sectionCardStyle}>
            <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
              3. Contato & Localização
            </h2>
            <div>
              {fieldRow(<Phone size={15} />, "Telefone / WhatsApp", entidade.telefone)}
              {fieldRow(<MapPin size={15} />, "Cidade", entidade.cidade)}
              {fieldRow(<MapPin size={15} />, "Bairro / Região", entidade.bairro || "Não informado")}
              {fieldRow(<MapPin size={15} />, "Endereço Sede", entidade.endereco || "Não informado")}
              {entidade.bairrosAtuacao.length > 0 &&
                fieldRow(<MapPin size={15} />, "Bairros de Atuação", entidade.bairrosAtuacao.join(", "))}
              {entidade.praias.length > 0 &&
                fieldRow(<Waves size={15} />, "Praias / Área de Atuação", entidade.praias.join(", "))}
            </div>
          </Card>
        </div>

        {/* 4. MEMBROS / APADRINHADOS VINCULADOS (SEM VALORES FINANCEIROS) */}
        <Card style={sectionCardStyle}>
          <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
            4. Membros / Apadrinhados Vinculados ({membros.length})
          </h2>
          {loadingMembros ? (
            <p className="text-xs text-zinc-500">Carregando membros vinculados...</p>
          ) : membros.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Nenhum membro ou apadrinhado vinculado a esta entidade até o momento.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {membros.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#09090B] border border-zinc-800 text-xs"
                >
                  <div className="min-w-0">
                    <div className="text-zinc-100 font-semibold truncate">{m.nome}</div>
                    <div className="text-[11px] text-zinc-500 uppercase">{m.papel}</div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold border shrink-0 ${
                      m.cadastroCompleto
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                    }`}
                  >
                    {m.cadastroCompleto ? "Completo" : "Incompleto"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 5 & 6. SITUAÇÃO CADASTRAL PIX & MP + STATUS DE ACESSO / BLOQUEIO */}
        <div className="flex flex-col gap-6">
          <Card style={sectionCardStyle}>
            <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
              5. Situação Cadastral PIX & Mercado Pago
            </h2>
            <p className="text-xs text-zinc-400 mb-3">
              Exibição exclusivamente cadastral (sem saldos, extratos ou repasses financeiros).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div
                className="p-3.5 rounded-xl border bg-[#09090B]"
                style={{
                  borderColor: entidade.hasPix ? "rgba(16,185,129,0.40)" : "rgba(245,158,11,0.40)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Chave PIX Cadastrada
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {entidade.hasPix ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={18} className="text-amber-400" />
                  )}
                  <span className={`text-base font-bold ${entidade.hasPix ? "text-emerald-400" : "text-amber-400"}`}>
                    {entidade.hasPix ? "Sim" : "Não"}
                  </span>
                </div>
                {entidade.hasPix && entidade.tipoChavePix && (
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Tipo: <strong className="text-zinc-200 uppercase">{entidade.tipoChavePix}</strong>
                  </div>
                )}
              </div>

              <div
                className="p-3.5 rounded-xl border bg-[#09090B]"
                style={{
                  borderColor: entidade.mpConnected ? "rgba(16,185,129,0.40)" : "#27272A",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Conta Mercado Pago
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {entidade.mpConnected ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={18} className="text-zinc-500" />
                  )}
                  <span className={`text-base font-bold ${entidade.mpConnected ? "text-emerald-400" : "text-zinc-300"}`}>
                    {entidade.mpConnected ? "Sim (Conectada)" : "Não conectada"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">
                <KeyRound size={13} className="text-emerald-400" /> Atualização Cadastral da Chave PIX
              </div>
              <AdminPixQuickEditor
                userId={entidade.id}
                initialPix={entidade.chavePix}
                initialTipo={entidade.tipoChavePix}
                onSaved={(newPix, newTipo) => {
                  setDbUser((prev: any) =>
                    prev ? { ...prev, chave_pix: newPix, tipo_chave_pix: newTipo } : prev,
                  );
                }}
              />
            </div>
          </Card>

          <Card
            style={{
              ...sectionCardStyle,
              border: entidade.isBlockedActive ? "1px solid rgba(239,68,68,0.5)" : "1px solid #27272A",
            }}
          >
            <h2 className="font-display text-sm font-bold text-zinc-200 uppercase tracking-wider mb-3">
              6. Status de Acesso / Bloqueio
            </h2>
            {entidade.isBlockedActive ? (
              <div className="rounded-xl p-4 bg-red-950/30 border border-red-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <Ban size={16} /> Entidade Bloqueada
                  </span>
                  <span className="text-xs font-semibold text-red-200 bg-red-500/20 px-2.5 py-0.5 rounded-full">
                    {formatBlockedSummary(entidade)}
                  </span>
                </div>
                {entidade.blockDurationLabel && (
                  <div className="text-xs text-zinc-300">
                    Modalidade: <strong>{entidade.blockDurationLabel}</strong>
                  </div>
                )}
                {entidade.blockedReason && (
                  <div className="text-xs text-zinc-300">
                    Motivo: <strong>{entidade.blockedReason}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl p-4 bg-[#09090B] border border-zinc-800 flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-400">Acesso Liberado</div>
                  <div className="text-xs text-zinc-400">
                    Esta entidade está ativa e operando normalmente na plataforma UBT.
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowBlockModal(true)}
                className={`h-10 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 border transition-colors ${
                  entidade.isBlockedActive
                    ? "bg-emerald-500 hover:bg-emerald-400 border-emerald-500 text-zinc-950"
                    : "bg-[#09090B] border-red-500 text-red-400 hover:bg-red-950/50"
                }`}
              >
                {entidade.isBlockedActive ? <ShieldCheck size={15} /> : <Ban size={15} />}
                {entidade.isBlockedActive ? "Desbloquear / Alterar Prazo" : "Bloquear Entidade"}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Modais Compartilhados */}
      <DeleteClientAlertModal
        client={showDeleteModal ? actionTarget : null}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          toast.show("Entidade excluída definitivamente com sucesso! ✓");
          navigate("/admin/entidades", { replace: true });
        }}
      />

      <BlockClientModal
        client={showBlockModal ? actionTarget : null}
        onClose={() => setShowBlockModal(false)}
        onUpdated={(_userId, patch) => {
          setDbUser((prev: any) =>
            prev
              ? {
                  ...prev,
                  is_blocked: patch.isBlocked,
                  blocked_until: patch.blockedUntil,
                  block_duration_label: patch.blockDurationLabel,
                  blocked_reason: patch.blockedReason,
                  status: patch.status,
                }
              : prev,
          );
          toast.show(
            patch.isBlocked
              ? `Entidade bloqueada (${patch.blockDurationLabel || "ativo"}).`
              : "Entidade desbloqueada com sucesso! ✓",
          );
        }}
      />

      <WhatsAppClientModal
        client={showWhatsAppModal ? actionTarget : null}
        onClose={() => setShowWhatsAppModal(false)}
      />

      <ClientHistoryModal
        client={showHistoryModal ? actionTarget : null}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  );
}
