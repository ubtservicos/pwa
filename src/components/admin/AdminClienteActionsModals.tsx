import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
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
  if (!Number.isFinite(d.getTime())) return target.blockDurationLabel || target.block_duration_label || "Indefinido";
  return `até ${d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
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
    description: "Convite para finalizar os dados cadastrais na plataforma UBT",
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

export function buildWhatsAppTemplate(key: WhatsAppTemplateKey, clientName: string): string {
  const firstName = String(clientName || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const appOrigin = getAppOrigin();
  switch (key) {
    case "completar_cadastro":
      return `Olá, ${firstName}! Tudo bem? Aqui é da equipe UBT Serviços 🌴\n\nNotamos que o seu cadastro na plataforma ainda está incompleto. Complete seus dados para aproveitar todos os benefícios, indicações e sorteios da UBT:\n${appOrigin}/login\n\nQualquer dúvida, estamos por aqui!`;
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
      style={{ background: "rgba(4, 7, 12, 0.82)", backdropFilter: "blur(6px)" }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: "#111827",
          borderColor: "rgba(239, 68, 68, 0.45)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "rgba(239, 68, 68, 0.10)",
            borderColor: "rgba(239, 68, 68, 0.25)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-red-300 m-0">
                Prevenção de Erros · Excluir Cliente
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
          <div
            className="rounded-xl p-4 border space-y-1.5"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.35)",
            }}
          >
            <div className="text-[11px] uppercase tracking-wider font-bold text-red-400">
              Cliente selecionado para exclusão
            </div>
            <div className="text-[15px] font-bold text-white">{client.name}</div>
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
                className="w-full h-10 rounded-xl pl-9 pr-10 text-sm text-white outline-none"
                style={{
                  background: "#0B0F14",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
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
              className="w-full h-10 rounded-xl px-3 text-sm text-white outline-none"
              style={{
                background: "#0B0F14",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
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
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-white/10 hover:bg-white/5"
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
      style={{ background: "rgba(4, 7, 12, 0.82)", backdropFilter: "blur(6px)" }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: "#111827",
          borderColor: currentlyBlocked ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.40)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "#0B0F14",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
              <Ban size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-white m-0">
                {currentlyBlocked ? "Gerenciar Bloqueio" : "Bloquear Cliente"}
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
            <div className="rounded-xl p-3.5 bg-red-500/10 border border-red-500/30 space-y-1.5">
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
                className="mt-2 w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#04130D] font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
                Desbloquear Cliente Agora
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
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background: selected ? "rgba(245, 158, 11, 0.16)" : "#0B0F14",
                      border: selected
                        ? "1.5px solid #F59E0B"
                        : "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                      <Clock size={13} className={selected ? "text-amber-400" : "text-zinc-500"} />
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
              className="w-full rounded-xl p-3 text-sm text-white outline-none resize-none"
              style={{
                background: "#0B0F14",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
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
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-white/10 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runRpc("block")}
              className="h-10 px-4 rounded-xl text-sm font-bold text-[#0B0F14] bg-amber-400 hover:bg-amber-300 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              Aplicar Bloqueio
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

  useEffect(() => {
    if (client) {
      setTemplateKey("completar_cadastro");
      setMessageText(buildWhatsAppTemplate("completar_cadastro", client.name));
    }
  }, [client?.id]);

  const normalizedPhone = useMemo(() => cleanBrazilPhone(client?.phone), [client?.phone]);

  if (!client) return null;

  const handleSelectTemplate = (key: WhatsAppTemplateKey) => {
    setTemplateKey(key);
    setMessageText(buildWhatsAppTemplate(key, client.name));
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
      style={{ background: "rgba(4, 7, 12, 0.82)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: "#111827",
          borderColor: "rgba(16, 185, 129, 0.40)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "#0B0F14",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
              <MessageCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-bold text-white m-0">
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
              {WHATSAPP_TEMPLATE_OPTIONS.map((opt) => {
                const selected = templateKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectTemplate(opt.key)}
                    className={`p-2.5 rounded-xl text-left transition-all ${
                      opt.key === "livre" ? "sm:col-span-2" : ""
                    }`}
                    style={{
                      background: selected ? "rgba(16, 185, 129, 0.16)" : "#0B0F14",
                      border: selected
                        ? "1.5px solid #10B981"
                        : "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div className="text-[12px] font-bold text-white">{opt.label}</div>
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
              className="w-full rounded-xl p-3 text-sm text-white outline-none resize-y leading-relaxed"
              style={{
                background: "#0B0F14",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-zinc-300 border border-white/10 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!normalizedPhone || !messageText.trim()}
              onClick={handleOpenWhatsApp}
              className="h-10 px-5 rounded-xl text-sm font-bold text-[#04130D] bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 flex items-center gap-2 transition-colors"
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
