import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";

export interface AdminActionClientTarget {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  slug?: string | null;
  entityType?: "cliente" | "entidade";
  cnpj?: string | null;
  razaoSocial?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  cadastroCompleto?: boolean;
  isBlocked?: boolean;
  blockedUntil?: string | null;
  blockDurationLabel?: string | null;
  blockedReason?: string | null;
}

export type BlockDurationOption = "24h" | "1_semana" | "1_mes" | "indefinido";

export type WhatsAppTemplateKey =
  | "completar_cadastro"
  | "abrir_mercadopago"
  | "cadastrar_pix"
  | "aniversario"
  | "livre";

export function isUserBlockedActive(target: {
  isBlocked?: boolean | null;
  is_blocked?: boolean | null;
  blockedUntil?: string | null;
  blocked_until?: string | null;
}): boolean {
  const blocked = Boolean(target.isBlocked ?? target.is_blocked);
  if (!blocked) return false;
  const until = target.blockedUntil ?? target.blocked_until;
  if (!until) return true;
  const ts = new Date(until).getTime();
  return !Number.isFinite(ts) || ts > Date.now();
}

export function formatBlockedSummary(target: {
  blockedUntil?: string | null;
  blocked_until?: string | null;
  blockDurationLabel?: string | null;
  block_duration_label?: string | null;
}): string {
  const until = target.blockedUntil ?? target.blocked_until;
  if (!until) return "Indefinido";
  const d = new Date(until);
  if (!Number.isFinite(d.getTime())) {
    return target.blockDurationLabel || target.block_duration_label || "Indefinido";
  }
  return `até ${d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return "Não registrada";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Não registrada";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function cleanBrazilPhone(raw?: string | null): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return `55${digits}`;
}

export const WHATSAPP_TEMPLATE_OPTIONS: Array<{
  key: WhatsAppTemplateKey;
  label: string;
  description: string;
}> = [
  {
    key: "completar_cadastro",
    label: "1. Completar o cadastro",
    description: "Link seguro de atualização cadastral por ID da conta (LGPD)",
  },
  {
    key: "abrir_mercadopago",
    label: "2. Abrir conta no Mercado Pago",
    description: "Orientação para abrir/conectar a conta Mercado Pago",
  },
  {
    key: "cadastrar_pix",
    label: "3. Cadastrar chave-pix",
    description: "Orientação para cadastrar chave PIX e receber repasses/prêmios",
  },
  {
    key: "aniversario",
    label: "4. Mensagem de Aniversário",
    description: "Parabéns especial em nome da equipe UBT",
  },
  {
    key: "livre",
    label: "5. Mensagem livre",
    description: "Escreva uma mensagem personalizada",
  },
];

export function buildCadastralUpdateUrl(userId?: string | null): string {
  const appOrigin = getAppOrigin();
  const cleanId = String(userId || "").trim();
  return cleanId
    ? `${appOrigin}/atualizacao-cadastral?id=${encodeURIComponent(cleanId)}`
    : `${appOrigin}/atualizacao-cadastral`;
}

export const WHATSAPP_ENTIDADE_TEMPLATE_OPTIONS: Array<{
  key: WhatsAppTemplateKey;
  label: string;
  description: string;
}> = [
  {
    key: "completar_cadastro",
    label: "1. Completar o cadastro",
    description: "Link seguro de atualização cadastral por ID da entidade (LGPD)",
  },
  {
    key: "abrir_mercadopago",
    label: "2. Abrir conta no Mercado Pago",
    description: "Orientação para abrir/conectar a conta PJ/Mercado Pago da entidade",
  },
  {
    key: "cadastrar_pix",
    label: "3. Cadastrar chave-pix",
    description: "Orientação para cadastrar chave PIX da entidade para repasses solidários",
  },
  {
    key: "aniversario",
    label: "4. Aniversário / Data Comemorativa",
    description: "Mensagem comemorativa parabenizando a entidade/responsável",
  },
  {
    key: "livre",
    label: "5. Mensagem livre",
    description: "Escreva uma mensagem personalizada",
  },
];

export function buildWhatsAppTemplate(
  key: WhatsAppTemplateKey,
  clientName: string,
  userId?: string | null,
  entityType: "cliente" | "entidade" = "cliente",
): string {
  const firstName = String(clientName || (entityType === "entidade" ? "Entidade" : "Cliente")).trim().split(/\s+/)[0] || "Cliente";
  const displayName = String(clientName || "Entidade").trim();
  const appOrigin = getAppOrigin();
  const updateUrl = buildCadastralUpdateUrl(userId);

  if (entityType === "entidade") {
    switch (key) {
      case "completar_cadastro":
        return `Olá, equipe ${displayName}! Tudo bem? Aqui é da UBT Serviços 🌴\n\nNotamos que o cadastro da entidade na plataforma ainda precisa ser completado. Acesse o link abaixo para atualizar os dados cadastrais da associação:\n${updateUrl}\n\nQualquer dúvida, estamos à disposição!`;
      case "abrir_mercadopago":
        return `Olá, equipe ${displayName}! Aqui é da UBT Serviços 💳\n\nPara receber os repasses solidários e benefícios da plataforma automaticamente, abra ou conecte a conta PJ do Mercado Pago da entidade:\n• Abrir conta PJ: https://www.mercadopago.com.br/hub/registration/landing\n• Conectar na UBT: ${appOrigin}/app/config/financeiro\n\nConte com nossa equipe se precisar de apoio!`;
      case "cadastrar_pix":
        return `Olá, equipe ${displayName}! Aqui é da UBT Serviços ⚡\n\nIdentificamos que a entidade ainda não possui chave PIX cadastrada na UBT. Cadastre a chave PIX da associação para liberar o recebimento dos repasses solidários:\n${appOrigin}/app/config/financeiro\n\nÉ rápido e seguro!`;
      case "aniversario":
        return `Parabéns à equipe ${displayName} por esta data especial! 🎉✨\n\nA UBT Serviços celebra junto com vocês e agradece pela parceria e pelo impacto positivo gerado na nossa comunidade em Ubatuba! 🌴🤝`;
      case "livre":
      default:
        return `Olá, equipe ${displayName}! `;
    }
  }

  switch (key) {
    case "completar_cadastro":
      return `Olá, ${firstName}! Tudo bem? Aqui é da equipe UBT Serviços 🌴\n\nNotamos que o seu cadastro na plataforma ainda precisa ser completado. Acesse o link abaixo para atualizar seus dados em poucos minutos:\n${updateUrl}\n\nQualquer dúvida, estamos por aqui!`;
    case "abrir_mercadopago":
      return `Olá, ${firstName}! Tudo bem? Aqui é da equipe UBT Serviços 💳\n\nPara receber seus pagamentos e repasses automaticamente com split na UBT, conecte ou abra sua conta no Mercado Pago:\n• Abrir conta: https://www.mercadopago.com.br/hub/registration/landing\n• Conectar no app UBT: ${appOrigin}/app/config/financeiro\n\nSe precisar de ajuda, conte com a gente!`;
    case "cadastrar_pix":
      return `Olá, ${firstName}! Aqui é da equipe UBT Serviços ⚡\n\nIdentificamos que você ainda não cadastrou sua chave PIX na UBT. Cadastre sua chave PIX no seu perfil para liberar o recebimento de repasses, apadrinhamento e prêmios:\n${appOrigin}/app/config/financeiro\n\nLeva menos de 1 minuto!`;
    case "aniversario":
      return `Parabéns pelo seu aniversário, ${firstName}! 🎉🎂\n\nA equipe da UBT Serviços deseja muita saúde, alegria e conquistas neste novo ciclo! Obrigado por fazer parte da nossa comunidade em Ubatuba. 🌴✨`;
    case "livre":
    default:
      return `Olá, ${firstName}! `;
  }
}

/* ========================================================================== */
/* 1. ALERT DIALOG DE EXCLUSÃO DEFINITIVA COM SENHA DO SUPERADMIN             */
/* ========================================================================== */
export function DeleteClientAlertModal({
  client,
  onClose,
  onDeleted,
}: {
  client: AdminActionClientTarget | null;
  onClose: () => void;
  onDeleted: (deletedUserId: string) => void;
}) {
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdminPassword("");
    setShowPassword(false);
    setReason("");
    setError(null);
    setLoading(false);
  }, [client?.id]);

  if (!client) return null;

  const handleConfirmDelete = async () => {
    if (!adminPassword.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("admin-delete-client", {
        body: {
          target_user_id: client.id,
          admin_password: adminPassword,
          reason: reason.trim() || "Exclusão definitiva solicitada pelo Superadmin",
        },
      });

      if (invokeErr || !data?.success) {
        let errMessage = data?.message || data?.error || invokeErr?.message;
        const ctx = (invokeErr as { context?: Response } | null)?.context;
        if (ctx && typeof ctx.clone === "function") {
          const parsed = await ctx.clone().json().catch(() => null);
          if (parsed?.message) errMessage = parsed.message;
        }
        throw new Error(errMessage || "Não foi possível excluir o cliente.");
      }

      onDeleted(client.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao excluir cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.84)", backdropFilter: "blur(6px)" }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-red-500/50 bg-[#121215] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-red-500/25 bg-red-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-red-300 m-0">
                Prevenção de Erros · Excluir {client.entityType === "entidade" ? "Entidade" : "Cliente"}
              </h3>
              <p className="text-[11px] text-red-200/75 uppercase tracking-wider font-semibold">
                Ação definitiva e irreversível
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl p-4 border border-red-500/35 bg-red-950/25 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider font-bold text-red-400">
              {client.entityType === "entidade" ? "Entidade selecionada para exclusão" : "Cliente selecionado para exclusão"}
            </div>
            <div className="text-[15px] font-bold text-zinc-100">
              {client.razaoSocial || client.name}
            </div>
            {client.entityType === "entidade" && client.cnpj && (
              <div className="text-[12px] font-mono text-red-200">CNPJ: {client.cnpj}</div>
            )}
            <div className="text-[13px] text-red-200/90">{client.email}</div>
            <div className="text-[12px] font-mono text-red-300">
              Slug: {client.slug ? `@${client.slug}` : "Não definido"}
            </div>
          </div>

          <p className="text-[12px] text-zinc-300 leading-relaxed">
            Esta operação removerá permanentemente o cadastro do cliente e sua conta de acesso da plataforma.
            Para confirmar, digite a <strong className="text-white">sua senha de login de Superadmin</strong>:
          </p>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Senha do Superadmin *
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-3 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Digite sua senha de acesso"
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-10 rounded-xl pl-9 pr-10 text-sm text-zinc-100 bg-[#09090B] border border-zinc-800 outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Motivo (opcional · gravado na auditoria)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: solicitação do titular / cadastro duplicado"
              disabled={loading}
              className="w-full h-10 rounded-xl px-3 text-sm text-zinc-100 bg-[#09090B] border border-zinc-800 outline-none focus:border-zinc-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-zinc-800 hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || !adminPassword.trim()}
              onClick={handleConfirmDelete}
              className="h-10 px-4 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Excluir Definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 2. MODAL DE BLOQUEIO (24H / 1 SEMANA / 1 MÊS / INDEFINIDO) E DESBLOQUEIO   */
/* ========================================================================== */
const BLOCK_DURATIONS: Array<{ key: BlockDurationOption; label: string; hint: string }> = [
  { key: "24h", label: "24 horas", hint: "Suspensão temporária de 1 dia" },
  { key: "1_semana", label: "1 semana", hint: "Suspensão temporária de 7 dias" },
  { key: "1_mes", label: "1 mês", hint: "Suspensão temporária de 30 dias" },
  { key: "indefinido", label: "Tempo indefinido", hint: "Bloqueio até liberação manual" },
];

export function BlockClientModal({
  client,
  onClose,
  onUpdated,
}: {
  client: AdminActionClientTarget | null;
  onClose: () => void;
  onUpdated: (
    userId: string,
    patch: {
      isBlocked: boolean;
      blockedUntil: string | null;
      blockDurationLabel: string | null;
      blockedReason: string | null;
      status: string;
    },
  ) => void;
}) {
  const [duration, setDuration] = useState<BlockDurationOption>("24h");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDuration("24h");
    setReason(client?.blockedReason || "");
    setError(null);
    setLoading(false);
  }, [client?.id]);

  if (!client) return null;

  const currentlyBlocked = isUserBlockedActive(client);

  const runRpc = async (action: "block" | "unblock") => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_bloquear_desbloquear_cliente", {
        p_user_id: client.id,
        p_action: action,
        p_duration: action === "block" ? duration : null,
        p_reason: reason.trim() || null,
      });
      if (rpcErr) throw rpcErr;

      onUpdated(client.id, {
        isBlocked: action === "block",
        blockedUntil: (data as any)?.blocked_until ?? null,
        blockDurationLabel: (data as any)?.block_duration_label ?? null,
        blockedReason: (data as any)?.blocked_reason ?? null,
        status: action === "block" ? "blocked" : "active",
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Não foi possível atualizar o bloqueio do cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.84)", backdropFilter: "blur(6px)" }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121215] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-800 bg-[#09090B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-950/50 border border-red-500/60 flex items-center justify-center">
              <Ban size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-zinc-100 m-0">
                {currentlyBlocked ? "Gerenciar Bloqueio" : "Bloquear Usuário"}
              </h3>
              <p className="text-[12px] text-zinc-400 truncate max-w-[260px]">{client.name}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {currentlyBlocked && (
            <div className="rounded-xl p-3.5 bg-red-950/30 border border-red-500/40 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-red-400">
                  Bloqueio ativo atualmente
                </span>
                <span className="text-[11px] font-semibold text-red-200">
                  {formatBlockedSummary(client)}
                </span>
              </div>
              {client.blockedReason && (
                <p className="text-[12px] text-zinc-300 m-0">Motivo: {client.blockedReason}</p>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => void runRpc("unblock")}
                className="mt-2 w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                Desbloquear Usuário Agora
              </button>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {currentlyBlocked ? "Ou redefinir prazo do bloqueio" : "Escolha a duração do bloqueio"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BLOCK_DURATIONS.map((opt) => {
                const selected = duration === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={loading}
                    onClick={() => setDuration(opt.key)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      selected
                        ? "bg-red-950/40 border-red-500 text-zinc-100"
                        : "bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[13px] font-bold">
                      <Clock size={13} className={selected ? "text-red-400" : "text-zinc-500"} />
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Motivo do bloqueio (opcional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva brevemente o motivo (visível na auditoria e aviso ao cliente)..."
              disabled={loading}
              className="w-full rounded-xl p-3 text-sm text-zinc-100 bg-[#09090B] border border-zinc-800 outline-none resize-none focus:border-zinc-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-zinc-800 hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runRpc("block")}
              className="h-10 px-4 rounded-xl text-sm font-bold border border-red-500 text-red-400 bg-red-950/35 hover:bg-red-950/70 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              Bloquear Usuário
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 3. MODAL DE ENVIO DE MENSAGEM POR WHATSAPP (5 TIPOS DE MENSAGEM)           */
/* ========================================================================== */
export function WhatsAppClientModal({
  client,
  onClose,
}: {
  client: AdminActionClientTarget | null;
  onClose: () => void;
}) {
  const [templateKey, setTemplateKey] = useState<WhatsAppTemplateKey>("completar_cadastro");
  const [messageText, setMessageText] = useState("");

  const entityType = client?.entityType || "cliente";
  const templateOptions =
    entityType === "entidade" ? WHATSAPP_ENTIDADE_TEMPLATE_OPTIONS : WHATSAPP_TEMPLATE_OPTIONS;

  useEffect(() => {
    if (client) {
      setTemplateKey("completar_cadastro");
      setMessageText(
        buildWhatsAppTemplate("completar_cadastro", client.name, client.id, client.entityType || "cliente"),
      );
    }
  }, [client?.id, client?.entityType]);

  const normalizedPhone = useMemo(() => cleanBrazilPhone(client?.phone), [client?.phone]);

  if (!client) return null;

  const handleSelectTemplate = (key: WhatsAppTemplateKey) => {
    setTemplateKey(key);
    setMessageText(buildWhatsAppTemplate(key, client.name, client.id, entityType));
  };

  const handleOpenWhatsApp = () => {
    if (!normalizedPhone || !messageText.trim()) return;
    const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(messageText.trim())}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.84)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121215] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-800 bg-[#09090B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
              <MessageCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-zinc-100 m-0">
                Enviar Mensagem por WhatsApp
              </h3>
              <p className="text-[12px] text-zinc-400">
                {client.name} · {client.phone && client.phone !== "Não cadastrado" ? client.phone : "Sem telefone"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!normalizedPhone && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-300 text-xs leading-relaxed">
              ⚠️ Este cliente não possui um número de telefone/WhatsApp válido cadastrado. Cadastre o telefone do cliente antes de disparar mensagens.
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Tipo de Mensagem
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templateOptions.map((opt) => {
                const selected = templateKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectTemplate(opt.key)}
                    className={`p-2.5 rounded-xl text-left transition-all border ${
                      opt.key === "livre" ? "sm:col-span-2" : ""
                    } ${
                      selected
                        ? "bg-emerald-500/15 border-emerald-500 text-zinc-100"
                        : "bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="text-[12px] font-bold">{opt.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Texto da Mensagem (editável antes de enviar)
            </label>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escreva sua mensagem..."
              className="w-full rounded-xl p-3 text-sm text-zinc-100 bg-[#09090B] border border-zinc-800 outline-none resize-y leading-relaxed focus:border-zinc-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-zinc-800 hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!normalizedPhone || !messageText.trim()}
              onClick={handleOpenWhatsApp}
              className="h-10 px-5 rounded-xl text-sm font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 flex items-center gap-2 transition-colors"
            >
              <Send size={15} />
              Abrir no WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 4. MODAL DE HISTÓRICO AMIGÁVEL DO CLIENTE (LINHA DO TEMPO CRONOLÓGICA)     */
/* ========================================================================== */
interface TimelineEntry {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actor?: string | null;
  tone: "emerald" | "red" | "amber" | "zinc";
}

function translateAuditAction(row: any): {
  title: string;
  description: string;
  tone: "emerald" | "red" | "amber" | "zinc";
} {
  const acao = String(row.acao || "").toLowerCase();
  const motivo = row.motivo ? String(row.motivo) : "";
  const durLabel = row.valor_novo?.block_duration_label || row.metadata?.duration_label || "";
  const untilIso = row.valor_novo?.blocked_until || null;

  if (acao === "bloquear_cliente") {
    const prazo = untilIso
      ? `até ${formatDateTimeBR(untilIso)}`
      : durLabel || "Tempo indefinido";
    return {
      title: "Conta bloqueada pela administração",
      description: [
        `Prazo aplicado: ${durLabel ? `${durLabel} (${prazo})` : prazo}.`,
        motivo ? `Motivo: ${motivo}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      tone: "red",
    };
  }
  if (acao === "desbloquear_cliente") {
    return {
      title: "Conta desbloqueada pela administração",
      description: motivo || "O acesso do cliente à plataforma foi restabelecido.",
      tone: "emerald",
    };
  }
  if (acao === "deletar_cliente" || acao === "deletar_cliente_concluido") {
    return {
      title: "Exclusão definitiva de conta",
      description: motivo || "Registro de exclusão administrativa.",
      tone: "red",
    };
  }
  if (acao.includes("pix")) {
    return {
      title: "Atualização de Chave PIX",
      description: motivo || "Dados cadastrais de chave PIX atualizados.",
      tone: "emerald",
    };
  }
  if (acao.includes("slug") || acao.includes("referral")) {
    return {
      title: "Atualização de Slug UBT",
      description: motivo || "Identificador/slug de indicação alterado.",
      tone: "zinc",
    };
  }
  if (acao.includes("kyc") || acao.includes("aprov")) {
    return {
      title: "Atualização de verificação / aprovação",
      description: motivo || `Evento registrado (${acao.replace(/_/g, " ")}).`,
      tone: "amber",
    };
  }
  return {
    title: acao ? acao.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Ação administrativa",
    description: motivo || "Alteração registrada na trilha de auditoria do sistema.",
    tone: "zinc",
  };
}

export function ClientHistoryModal({
  client,
  onClose,
}: {
  client: AdminActionClientTarget | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client?.id) {
      setEntries([]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: userRow }, { data: auditRows, error: auditErr }] = await Promise.all([
          supabase
            .from("usuarios")
            .select("created_at, updated_at, cadastro_completo, is_blocked, blocked_at, blocked_until, block_duration_label, blocked_reason")
            .eq("id", client.id)
            .maybeSingle(),
          supabase
            .from("admin_audit_logs")
            .select("id, created_at, admin_nome, admin_email, acao, motivo, resultado, valor_novo, metadata")
            .eq("registro_id", client.id)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (auditErr) {
          console.warn("[ClientHistoryModal] Aviso ao ler admin_audit_logs:", auditErr.message);
        }

        const timeline: TimelineEntry[] = [];

        const createdAt = userRow?.created_at || client.createdAt;
        if (createdAt) {
          timeline.push({
            id: `created-${client.id}`,
            timestamp: createdAt,
            title: "Conta criada na plataforma UBT",
            description: "Cadastro inicial do cliente registrado no sistema.",
            tone: "emerald",
          });
        }

        const updatedAt = userRow?.updated_at || client.updatedAt;
        if (
          updatedAt &&
          createdAt &&
          Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 60_000
        ) {
          timeline.push({
            id: `updated-${client.id}`,
            timestamp: updatedAt,
            title: userRow?.cadastro_completo || client.cadastroCompleto
              ? "Cadastro atualizado / concluído"
              : "Última atualização cadastral",
            description:
              userRow?.cadastro_completo || client.cadastroCompleto
                ? "Os dados cadastrais do cliente foram atualizados e constam como completos."
                : "Última modificação registrada na ficha do cliente.",
            tone: "zinc",
          });
        }

        for (const row of auditRows || []) {
          const translated = translateAuditAction(row);
          const actor = row.admin_nome || row.admin_email || null;
          timeline.push({
            id: String(row.id),
            timestamp: row.created_at,
            title: translated.title,
            description: translated.description,
            actor,
            tone: translated.tone,
          });
        }

        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (active) setEntries(timeline);
      } catch (err: any) {
        if (active) setError(err?.message || "Não foi possível carregar o histórico do cliente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [client?.id]);

  if (!client) return null;

  const toneBadge = (tone: TimelineEntry["tone"]) => {
    if (tone === "emerald") return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400";
    if (tone === "red") return "bg-red-950/60 border-red-500/50 text-red-400";
    if (tone === "amber") return "bg-amber-500/15 border-amber-500/40 text-amber-400";
    return "bg-zinc-900 border-zinc-700 text-zinc-300";
  };

  const toneIcon = (tone: TimelineEntry["tone"], title: string) => {
    if (title.includes("criada")) return <UserPlus size={14} />;
    if (tone === "red") return <Ban size={14} />;
    if (tone === "emerald") return <CheckCircle2 size={14} />;
    return <UserCheck size={14} />;
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.84)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-[#121215] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-800 bg-[#09090B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
              <History size={18} className="text-zinc-200" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-zinc-100 m-0">
                {client.entityType === "entidade" ? "Histórico da Entidade" : "Histórico do Cliente"}
              </h3>
              <p className="text-[12px] text-zinc-400">
                {client.name} {client.slug ? `· @${client.slug}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-zinc-400 text-sm">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
              Carregando linha do tempo...
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
              ⚠️ {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-sm">
              Nenhum evento registrado para este cliente até o momento.
            </div>
          ) : (
            <div className="relative pl-5 border-l border-zinc-800 space-y-4">
              {entries.map((item) => (
                <div key={item.id} className="relative">
                  <span
                    className={`absolute -left-[29px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${toneBadge(
                      item.tone,
                    )}`}
                  >
                    {toneIcon(item.tone, item.title)}
                  </span>
                  <div className="rounded-xl p-3.5 bg-[#09090B] border border-zinc-800/90">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-zinc-100">{item.title}</span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {formatDateTimeBR(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[12px] text-zinc-300 mt-1 mb-0 leading-relaxed">
                      {item.description}
                    </p>
                    {item.actor && (
                      <div className="text-[11px] text-zinc-500 mt-1.5">
                        Executado por: <span className="text-zinc-300 font-medium">{item.actor}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-zinc-800 bg-[#09090B] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-semibold text-zinc-200 border border-zinc-700 hover:bg-zinc-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
