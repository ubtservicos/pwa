import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Shield,
  CreditCard,
  Copy,
  Check,
  MapPin,
  Building2,
  Waves,
  Home,
  Loader2,
  Users,
  Handshake,
  Ban,
  ShieldCheck,
  Trash2,
  MessageCircle,
  KeyRound,
  Award,
  Gift,
  Link2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, Avatar, Pill, KYC_PILL } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import AdminPixQuickEditor from "@/components/admin/AdminPixQuickEditor";
import {
  DeleteClientAlertModal,
  BlockClientModal,
  WhatsAppClientModal,
  isUserBlockedActive,
  formatBlockedSummary,
  type AdminActionClientTarget,
} from "@/components/admin/AdminClienteActionsModals";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";
import { maskCPF, generateReferralSlug } from "@/utils/masks";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface ApadrinhadoItem {
  id: string;
  nome: string;
  tipo_cadastro: string;
  status: string;
  cadastro_completo: boolean;
  criado_em: string;
}

const getBirthMonth = (id: string, dataNascimento?: string | null) => {
  if (dataNascimento) {
    const parsed = new Date(dataNascimento);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.getUTCMonth() + 1;
    }
  }
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (sum % 12) + 1;
};

export default function AdminClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [dbUser, setDbUser] = useState<any | null>(null);
  const [dbProfile, setDbProfile] = useState<any | null>(null);
  const [dbWaitlist, setDbWaitlist] = useState<any | null>(null);
  const [mototaxi, setMototaxi] = useState<any | null>(null);
  const [diarista, setDiarista] = useState<any | null>(null);
  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [associacaoNome, setAssociacaoNome] = useState<string | null>(null);
  const [padrinhoNome, setPadrinhoNome] = useState<string | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean>(false);
  const [dbPedidos, setDbPedidos] = useState<any[]>([]);
  const [apadrinhados, setApadrinhados] = useState<ApadrinhadoItem[]>([]);
  const [loadingApadrinhados, setLoadingApadrinhados] = useState(false);
  const [loading, setLoading] = useState(true);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customRefCode, setCustomRefCode] = useState<string>("");
  const [isSavingRefCode, setIsSavingRefCode] = useState(false);
  const [refCodeError, setRefCodeError] = useState("");

  // Action modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

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
    const fetchUserDetail = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: userData, error: errUser } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (errUser) throw errUser;
        if (!userData) {
          setDbUser(null);
          setLoading(false);
          return;
        }

        const [
          profileRes,
          motoRes,
          diaristaRes,
          caminhaoRes,
          provAssocRes,
          membAssocRes,
          pedidosRes,
          mpAccountRes,
        ] = await Promise.allSettled([
          supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
          supabase.from("prestador_mototaxi").select("kyc_status, modalidade, plate, is_online").eq("user_id", id).maybeSingle(),
          supabase.from("diarista_perfis").select("rating, total_servicos").eq("user_id", id).maybeSingle(),
          supabase.from("coco_caminhoes").select("plate, status_aprovacao").eq("prestador_id", id).maybeSingle(),
          supabase.from("provider_associations").select("association_id").eq("provider_id", id).maybeSingle(),
          supabase.from("associacao_membros").select("association_id").eq("prestador_id", id).maybeSingle(),
          supabase.from("pedidos").select("id, tomador_id, prestador_id, status").or(`tomador_id.eq.${id},prestador_id.eq.${id}`),
          supabase.from("marketplace_accounts").select("id, status").eq("user_id", id).eq("status", "CONNECTED").limit(1),
        ]);

        const profileData = profileRes.status === "fulfilled" ? profileRes.value.data : null;
        const motoData = motoRes.status === "fulfilled" ? motoRes.value.data : null;
        const diaristaData = diaristaRes.status === "fulfilled" ? diaristaRes.value.data : null;
        const caminhaoData = caminhaoRes.status === "fulfilled" ? caminhaoRes.value.data : null;
        const provAssoc = provAssocRes.status === "fulfilled" ? provAssocRes.value.data : null;
        const membAssoc = membAssocRes.status === "fulfilled" ? membAssocRes.value.data : null;
        const pedidosData = pedidosRes.status === "fulfilled" ? pedidosRes.value.data || [] : [];
        const mpAccounts = mpAccountRes.status === "fulfilled" ? mpAccountRes.value.data || [] : [];

        // Waitlist complementar
        let waitlistRow: any = null;
        try {
          const emailFilter = userData?.email || profileData?.email;
          const phoneFilter = userData?.telefone || userData?.phone || profileData?.phone;
          const orClauses: string[] = [];
          if (emailFilter) orClauses.push(`email.eq.${emailFilter}`);
          if (phoneFilter) orClauses.push(`telefone.eq.${phoneFilter}`);
          if (orClauses.length > 0) {
            const { data: wlData } = await supabase
              .from("waitlist")
              .select("*")
              .or(orClauses.join(","))
              .maybeSingle();
            waitlistRow = wlData;
          }
        } catch {
          // noop
        }

        // Associação
        let assocName: string | null = null;
        const assocId = provAssoc?.association_id || membAssoc?.association_id;
        if (assocId) {
          const { data: assocData } = await supabase
            .from("associations")
            .select("name")
            .eq("id", assocId)
            .maybeSingle();
          if (assocData?.name) assocName = assocData.name;
        }

        // Padrinho
        const padrinhoId = userData.padrinho_id || waitlistRow?.padrinho_id || null;
        let padrinhoLabel: string | null = null;
        if (padrinhoId) {
          const { data: padRow } = await supabase
            .from("usuarios")
            .select("nome, razao_social, referral_code")
            .eq("id", padrinhoId)
            .maybeSingle();
          if (padRow) {
            padrinhoLabel = padRow.nome || padRow.razao_social || padRow.referral_code || "Padrinho UBT";
          }
        }

        setDbUser(userData);
        setDbProfile(profileData);
        setDbWaitlist(waitlistRow);
        setMototaxi(motoData);
        setDiarista(diaristaData);
        setCaminhao(caminhaoData);
        setAssociacaoNome(assocName);
        setPadrinhoNome(padrinhoLabel);
        setDbPedidos(pedidosData);
        setMpConnected(
          Boolean(mpAccounts.length > 0) ||
            Boolean(userData.possui_mercadopago) ||
            Boolean(userData.metadata?.possui_mercado_pago) ||
            Boolean(userData.metadata?.possui_conta_mercado_pago),
        );

        const initialRef =
          userData?.referral_code ||
          waitlistRow?.referral_code ||
          waitlistRow?.slug ||
          profileData?.referral_code ||
          "";
        setCustomRefCode(initialRef);

        // Apadrinhados (apenas dados cadastrais, sem valores financeiros)
        setLoadingApadrinhados(true);
        try {
          const { data: apadData, error: apadErr } = await supabase.rpc("obter_meus_apadrinhados", {
            p_padrinho_id: id,
          });
          if (!apadErr && Array.isArray(apadData)) {
            setApadrinhados(apadData as ApadrinhadoItem[]);
          } else {
            setApadrinhados([]);
          }
        } catch {
          setApadrinhados([]);
        } finally {
          setLoadingApadrinhados(false);
        }
      } catch (err) {
        console.error("Erro ao carregar ficha cadastral do cliente:", err);
        toast.show("Erro ao carregar informações do cliente.");
      } finally {
        setLoading(false);
      }
    };

    void fetchUserDetail();
  }, [id]);

  const client = useMemo(() => {
    if (!dbUser) return null;

    const isColab =
      dbUser.role === "cocoecia-colaborador" ||
      dbUser.role === "cocoecia-dirigentes" ||
      dbUser.role === "cocoecia";

    const services: string[] = [];
    if (mototaxi && mototaxi.kyc_status === "approved") {
      services.push(mototaxi.modalidade === "entrega" ? "Entrega" : "Mototáxi");
    }
    if (diarista) services.push("Diarista");
    if (isColab || (caminhao && caminhao.status_aprovacao === "approved")) {
      services.push("Reciclagem");
    }

    let kycStatus: "approved" | "pending" | "rejected" | undefined;
    if (mototaxi) kycStatus = mototaxi.kyc_status;
    else if (caminhao) kycStatus = caminhao.status_aprovacao === "approved" ? "approved" : "pending";
    else if (diarista) kycStatus = "approved";
    else if (dbUser.role === "prestador" || isColab) kycStatus = "pending";

    const validStatuses = ["completed", "confirmed", "rating", "preparing", "ready"];
    const ticketsConsumidor = dbPedidos.filter(
      (p: any) => p.tomador_id === id && validStatuses.includes(p.status),
    ).length;
    const ticketsTrabalhador =
      dbUser.role === "prestador" || isColab || diarista || mototaxi
        ? dbPedidos.filter((p: any) => p.prestador_id === id && validStatuses.includes(p.status)).length
        : 0;

    const name = dbUser.nome || dbUser.razao_social || dbProfile?.name || "Sem nome";
    const email = dbUser.email || dbProfile?.email || "Não informado";
    const phone = dbUser.telefone || dbProfile?.phone || dbUser.phone || "Não cadastrado";
    const rawCpf = dbProfile?.cpf || dbUser?.cpf || dbWaitlist?.cpf || null;
    const cpf = rawCpf ? maskCPF(rawCpf) : "Não informado";
    const dataNascimento =
      dbUser.metadata?.data_nascimento ||
      dbWaitlist?.data_nascimento ||
      dbProfile?.data_nascimento ||
      null;
    const birthMonth = getBirthMonth(dbUser.id, dataNascimento);

    const isCadastroCompleto =
      dbUser.cadastro_completo === true ||
      dbUser.metadata?.cadastro_completo === true ||
      dbWaitlist?.cadastro_completo === true;
    const isPendente =
      dbUser.status === "pendente_aprovacao" ||
      dbUser.status === "pending" ||
      dbWaitlist?.status === "pendente_aprovacao" ||
      dbWaitlist?.status === "pending";

    const slug =
      dbUser.referral_code ||
      dbWaitlist?.referral_code ||
      dbWaitlist?.slug ||
      dbUser.metadata?.referral_code ||
      generateReferralSlug(name, dbUser.cpf || dbUser.id);

    const bairroMoradia =
      dbProfile?.bairro_moradia || dbUser?.bairro_moradia || dbUser?.bairro_residencia || dbUser?.bairro || dbWaitlist?.bairro_moradia || null;
    const bairroTrabalho =
      dbProfile?.bairro_trabalho || dbUser?.bairro_trabalho || dbWaitlist?.bairro_trabalho || null;
    const cidade = dbUser.metadata?.cidade || dbProfile?.cidade || "Ubatuba - SP";
    const endereco = dbUser.metadata?.endereco || dbProfile?.endereco || null;
    const praiasFrequenta =
      dbProfile?.praias_frequenta ||
      dbUser?.praias_frequenta ||
      (Array.isArray(dbUser?.praias) && dbUser.praias.length > 0 ? dbUser.praias.join(", ") : null);

    const chavePix = String(
      dbUser.chave_pix || dbProfile?.pix_key || dbWaitlist?.chave_pix || dbWaitlist?.pix_chave || "",
    ).trim();
    const tipoChavePix = String(dbUser.tipo_chave_pix || dbWaitlist?.tipo_chave_pix || "").trim();

    const isBlocked = Boolean(dbUser.is_blocked);
    const blockedUntil = dbUser.blocked_until || null;
    const blockDurationLabel = dbUser.block_duration_label || null;
    const blockedReason = dbUser.blocked_reason || null;

    return {
      id: dbUser.id,
      name,
      email,
      phone,
      cpf,
      dataNascimento,
      birthMonth,
      role:
        (dbUser.role && (dbUser.role.startsWith("cocoecia") || dbUser.role === "prestador")) ||
        services.length > 0
          ? "prestador"
          : "tomador",
      rawRole: dbUser.role || "tomador",
      slug,
      createdAt: dbUser.created_at || dbProfile?.created_at || new Date().toISOString(),
      isCadastroCompleto,
      isPendente,
      kycStatus,
      services,
      associacao: associacaoNome,
      coletivoParticipa: Boolean(associacaoNome) || ticketsConsumidor + ticketsTrabalhador > 0,
      padrinhoNome,
      ticketsConsumidor,
      ticketsTrabalhador,
      cidade,
      bairroMoradia,
      bairroTrabalho,
      endereco,
      praiasFrequenta,
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
  }, [dbUser, dbProfile, dbWaitlist, mototaxi, diarista, caminhao, associacaoNome, padrinhoNome, dbPedidos, mpConnected, id]);

  const handleSaveReferralCode = async () => {
    if (!id) return;
    const cleanCode = customRefCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 40) {
      setRefCodeError("O slug deve ter entre 3 e 40 caracteres (letras minúsculas, números e hífens).");
      return;
    }
    setIsSavingRefCode(true);
    setRefCodeError("");
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("set_user_referral_code", {
        p_user_id: id,
        p_code: cleanCode,
      });
      if (!rpcErr && rpcRes && rpcRes.success === false) {
        setRefCodeError(rpcRes.error || "Slug indisponível.");
        return;
      }
      if (rpcErr) {
        const { error: updErr } = await supabase
          .from("usuarios")
          .update({ referral_code: cleanCode })
          .eq("id", id);
        if (updErr) throw updErr;
      }
      setDbUser((prev: any) => (prev ? { ...prev, referral_code: cleanCode } : prev));
      setCustomRefCode(cleanCode);
      toast.show("Slug UBT atualizado com sucesso! ✓");
    } catch (err: any) {
      setRefCodeError(err?.message || "Erro ao salvar slug.");
    } finally {
      setIsSavingRefCode(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: 10, color: "#9CA3AF" }}>
        <Loader2 size={18} className="animate-spin text-emerald-400" />
        <span>Carregando ficha cadastral do cliente...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: 32 }}>
        <button
          type="button"
          onClick={() => navigate("/admin/clientes")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft size={16} /> Voltar para Cadastro de Clientes
        </button>
        <Card style={{ padding: 40, textAlign: "center", background: "#111827", border: "1px solid rgba(239,68,68,0.35)" }}>
          <div className="font-display text-lg font-bold text-red-400">Cliente não encontrado</div>
          <div className="text-sm text-zinc-400 mt-2">O registro solicitado não existe ou foi removido.</div>
        </Card>
      </div>
    );
  }

  const actionTarget: AdminActionClientTarget = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    slug: client.slug,
    isBlocked: client.isBlocked,
    blockedUntil: client.blockedUntil,
    blockDurationLabel: client.blockDurationLabel,
    blockedReason: client.blockedReason,
  };

  const sectionCardStyle = {
    padding: 22,
    background: "#111827",
    border: "1px solid rgba(16,185,129,0.22)",
    borderRadius: 16,
  } as const;

  const fieldRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2 border-b border-white/[0.06] last:border-none">
      <div className="mt-0.5 text-emerald-400/80 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">{label}</div>
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
          onClick={() => navigate("/admin/clientes")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para Cadastro de Clientes
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="h-9 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className={`h-9 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              client.isBlockedActive
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
            }`}
          >
            {client.isBlockedActive ? <ShieldCheck size={14} /> : <Ban size={14} />}
            {client.isBlockedActive ? "Desbloquear" : "Bloquear"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="h-9 px-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} /> Deletar
          </button>
        </div>
      </div>

      {/* Header Cadastral (ZERO valores financeiros) */}
      <Card
        style={{
          padding: 24,
          marginBottom: 24,
          background: "linear-gradient(135deg, #0B0F14 0%, #111827 100%)",
          border: client.isBlockedActive
            ? "1px solid rgba(239,68,68,0.45)"
            : "1px solid rgba(16,185,129,0.35)",
          borderRadius: 18,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} size={64} />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-white m-0">{client.name}</h1>
                {client.isBlockedActive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/45">
                    Bloqueado · {formatBlockedSummary(client)}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                    Acesso Ativo
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Pill bg="rgba(43,110,232,0.16)" color="#60A5FA" size="sm">
                  tomador
                </Pill>
                {client.role === "prestador" && (
                  <Pill bg="rgba(16,185,129,0.16)" color="#34D399" size="sm">
                    prestador
                  </Pill>
                )}
                {client.kycStatus && (
                  <Pill {...KYC_PILL[client.kycStatus]} size="sm">
                    {KYC_PILL[client.kycStatus].label}
                  </Pill>
                )}
                {client.isPendente ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Cadastro Pendente
                  </span>
                ) : client.isCadastroCompleto ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Cadastro Completo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Cadastro Incompleto
                  </span>
                )}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#0B0F14] text-emerald-300 border border-emerald-500/25">
                  @{client.slug}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-400 font-mono">
            <div>ID: {client.id}</div>
            <div className="mt-1">
              Desde {new Date(client.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
            </div>
          </div>
        </div>
      </Card>

      {/* Grid das 5 Seções Cadastrais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. IDENTIFICAÇÃO & PERFIL */}
        <Card style={sectionCardStyle}>
          <h2 className="font-display text-base font-bold text-emerald-300 uppercase tracking-wider mb-3">
            1. Identificação & Perfil
          </h2>
          <div>
            {fieldRow(<Users size={15} />, "Nome Completo", client.name)}
            {fieldRow(<Mail size={15} />, "E-mail", client.email)}
            {fieldRow(<CreditCard size={15} />, "CPF / Documento", client.cpf)}
            {fieldRow(
              <Calendar size={15} />,
              "Data de Nascimento / Mês de Aniversário",
              client.dataNascimento
                ? `${new Date(client.dataNascimento).toLocaleDateString("pt-BR")} (${MONTHS[client.birthMonth - 1]})`
                : `Mês de referência: ${MONTHS[client.birthMonth - 1]}`,
            )}
            {fieldRow(<Shield size={15} />, "Papel / Role na Plataforma", client.rawRole)}
            {fieldRow(
              <Calendar size={15} />,
              "Data de Cadastro",
              new Date(client.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }),
            )}
          </div>

          {/* Slug UBT Editável + Links */}
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
              Slug UBT & Links de Indicação
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customRefCode}
                onChange={(e) => {
                  setCustomRefCode(e.target.value);
                  setRefCodeError("");
                }}
                placeholder="slug-do-cliente"
                className="flex-1 h-9 rounded-lg px-3 bg-[#0B0F14] border border-white/15 font-mono text-xs text-emerald-300 outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                disabled={isSavingRefCode}
                onClick={handleSaveReferralCode}
                className="h-9 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04130D] text-xs font-bold disabled:opacity-50"
              >
                {isSavingRefCode ? "Salvando..." : "Salvar Slug"}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy(client.slug, "slug", "Slug copiado")}
                className="h-9 px-2.5 rounded-lg bg-[#0B0F14] border border-white/15 text-zinc-300 hover:text-emerald-300"
                title="Copiar slug"
              >
                {copiedKey === "slug" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            {refCodeError && <p className="text-xs text-red-400 m-0">{refCodeError}</p>}

            <div className="flex items-center gap-2 text-xs">
              <Link2 size={13} className="text-zinc-400 shrink-0" />
              <span className="font-mono text-zinc-300 truncate flex-1">
                {getAppOrigin()}/{client.slug}
              </span>
              <button
                type="button"
                onClick={() =>
                  void handleCopy(`${getAppOrigin()}/${client.slug}`, "reflink", "Link de indicação copiado")
                }
                className="text-emerald-400 hover:text-emerald-300 font-semibold shrink-0"
              >
                {copiedKey === "reflink" ? "Copiado ✓" : "Copiar link"}
              </button>
            </div>
          </div>
        </Card>

        {/* 2. CONTATO & ENDEREÇO */}
        <Card style={sectionCardStyle}>
          <h2 className="font-display text-base font-bold text-emerald-300 uppercase tracking-wider mb-3">
            2. Contato & Endereço
          </h2>
          <div>
            {fieldRow(<Phone size={15} />, "Telefone / WhatsApp", client.phone)}
            {fieldRow(<MapPin size={15} />, "Cidade", client.cidade)}
            {fieldRow(<Home size={15} />, "Bairro de Moradia", client.bairroMoradia || "Não informado")}
            {fieldRow(<Building2 size={15} />, "Bairro de Trabalho", client.bairroTrabalho || "Não informado")}
            {fieldRow(<MapPin size={15} />, "Endereço Cadastrado", client.endereco || "Não informado")}
            {fieldRow(<Waves size={15} />, "Praias que Frequenta", client.praiasFrequenta || "Não informado")}
          </div>
        </Card>

        {/* 3. VÍNCULOS NA PLATAFORMA (SEM VALORES FINANCEIROS) */}
        <Card style={sectionCardStyle}>
          <h2 className="font-display text-base font-bold text-emerald-300 uppercase tracking-wider mb-3">
            3. Vínculos na Plataforma
          </h2>
          <div>
            {fieldRow(<Building2 size={15} />, "Associação", client.associacao || "Sem vínculo")}
            {fieldRow(
              <Users size={15} />,
              "Coletivo / Comunidade",
              client.coletivoParticipa ? "Participante ativo na rede comunitária" : "Sem vínculo registrado",
            )}
            {fieldRow(<Handshake size={15} />, "Padrinho / Indicação", client.padrinhoNome || "Cadastro orgânico (sem padrinho)")}
            {fieldRow(
              <Award size={15} />,
              "Prêmios 1/5 (Trabalhador) · Prêmios 1/11 (Consumidor)",
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="px-2.5 py-1 rounded-lg bg-[#0B0F14] border border-white/10 text-xs">
                  <Gift size={12} className="inline mr-1 text-emerald-400" />
                  1/5: <strong>{client.ticketsTrabalhador}</strong> participações
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#0B0F14] border border-white/10 text-xs">
                  <Gift size={12} className="inline mr-1 text-sky-400" />
                  1/11: <strong>{client.ticketsConsumidor}</strong> participações
                </span>
              </div>,
            )}
            {fieldRow(
              <Shield size={15} />,
              "Serviços Utilizados / Habilitados",
              client.services.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {client.services.map((s) => (
                    <Pill key={s} bg="#0B0F14" color="#34D399" size="sm">
                      {s}
                    </Pill>
                  ))}
                </div>
              ) : (
                "Nenhum serviço de prestador habilitado"
              ),
            )}
          </div>

          {/* Lista de Apadrinhados (somente dados cadastrais) */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 mb-2">
              Apadrinhados Diretos ({apadrinhados.length})
            </div>
            {loadingApadrinhados ? (
              <p className="text-xs text-zinc-500">Carregando apadrinhados...</p>
            ) : apadrinhados.length === 0 ? (
              <p className="text-xs text-zinc-500">Nenhum apadrinhado registrado.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {apadrinhados.map((ap) => (
                  <div
                    key={ap.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B0F14] border border-white/[0.06] text-xs"
                  >
                    <span className="text-zinc-200 font-medium truncate">{ap.nome}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 shrink-0">
                      {ap.cadastro_completo ? "Completo" : "Incompleto"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 4 & 5. SITUAÇÃO CADASTRAL PIX & MERCADO PAGO + STATUS DE ACESSO / BLOQUEIO */}
        <div className="flex flex-col gap-6">
          {/* 4. SITUAÇÃO CADASTRAL PIX & MERCADO PAGO (APENAS STATUS BOOLEANO) */}
          <Card style={sectionCardStyle}>
            <h2 className="font-display text-base font-bold text-emerald-300 uppercase tracking-wider mb-3">
              4. Situação Cadastral PIX & Mercado Pago
            </h2>
            <p className="text-xs text-zinc-400 mb-3">
              Exibição exclusivamente cadastral (sem saldos, extratos ou valores financeiros).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div
                className="p-3.5 rounded-xl border"
                style={{
                  background: "#0B0F14",
                  borderColor: client.hasPix ? "rgba(16,185,129,0.40)" : "rgba(245,158,11,0.40)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Chave PIX Cadastrada
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {client.hasPix ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={18} className="text-amber-400" />
                  )}
                  <span className={`text-base font-bold ${client.hasPix ? "text-emerald-300" : "text-amber-300"}`}>
                    {client.hasPix ? "Sim" : "Não"}
                  </span>
                </div>
                {client.hasPix && client.tipoChavePix && (
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Tipo: <strong className="text-zinc-200 uppercase">{client.tipoChavePix}</strong>
                  </div>
                )}
              </div>

              <div
                className="p-3.5 rounded-xl border"
                style={{
                  background: "#0B0F14",
                  borderColor: client.mpConnected ? "rgba(16,185,129,0.40)" : "rgba(255,255,255,0.12)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Conta Mercado Pago
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {client.mpConnected ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={18} className="text-zinc-400" />
                  )}
                  <span className={`text-base font-bold ${client.mpConnected ? "text-emerald-300" : "text-zinc-300"}`}>
                    {client.mpConnected ? "Sim (Conectada)" : "Não conectada"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">
                <KeyRound size={13} className="text-emerald-400" /> Atualização Cadastral da Chave PIX
              </div>
              <AdminPixQuickEditor
                userId={client.id}
                initialPix={client.chavePix}
                initialTipo={client.tipoChavePix}
                onSaved={(newPix, newTipo) => {
                  setDbUser((prev: any) =>
                    prev ? { ...prev, chave_pix: newPix, tipo_chave_pix: newTipo } : prev,
                  );
                }}
              />
            </div>
          </Card>

          {/* 5. STATUS DE ACESSO / BLOQUEIO */}
          <Card
            style={{
              ...sectionCardStyle,
              border: client.isBlockedActive
                ? "1px solid rgba(239,68,68,0.45)"
                : "1px solid rgba(16,185,129,0.25)",
            }}
          >
            <h2 className="font-display text-base font-bold text-emerald-300 uppercase tracking-wider mb-3">
              5. Status de Acesso / Bloqueio
            </h2>

            {client.isBlockedActive ? (
              <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/35 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-red-300 flex items-center gap-2">
                    <Ban size={16} /> Conta Bloqueada
                  </span>
                  <span className="text-xs font-semibold text-red-200 bg-red-500/20 px-2.5 py-0.5 rounded-full">
                    {formatBlockedSummary(client)}
                  </span>
                </div>
                {client.blockDurationLabel && (
                  <div className="text-xs text-zinc-300">
                    Modalidade: <strong>{client.blockDurationLabel}</strong>
                  </div>
                )}
                {client.blockedReason && (
                  <div className="text-xs text-zinc-300">
                    Motivo: <strong>{client.blockedReason}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-300">Acesso Liberado</div>
                  <div className="text-xs text-zinc-400">
                    Este cliente pode acessar normalmente a plataforma UBT.
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setShowBlockModal(true)}
                className={`h-10 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors ${
                  client.isBlockedActive
                    ? "bg-emerald-500 hover:bg-emerald-400 text-[#04130D]"
                    : "bg-amber-400 hover:bg-amber-300 text-[#0B0F14]"
                }`}
              >
                {client.isBlockedActive ? <ShieldCheck size={15} /> : <Ban size={15} />}
                {client.isBlockedActive ? "Desbloquear / Alterar Prazo" : "Bloquear Cliente"}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Modais de Ação */}
      <DeleteClientAlertModal
        client={showDeleteModal ? actionTarget : null}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          toast.show("Cliente excluído definitivamente com sucesso! ✓");
          navigate("/admin/clientes", { replace: true });
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
              ? `Cliente bloqueado (${patch.blockDurationLabel || "ativo"}).`
              : "Cliente desbloqueado com sucesso! ✓",
          );
        }}
      />

      <WhatsAppClientModal
        client={showWhatsAppModal ? actionTarget : null}
        onClose={() => setShowWhatsAppModal(false)}
      />
    </div>
  );
}
