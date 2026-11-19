import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { applyPixMask, getPixMaxLength, getPixPlaceholder } from "@/utils/masks";
import { PixKeyType, validatePixKeyValue } from "@/components/finance/PixContingencyBanner";

export const MERCADO_PAGO_REGISTRATION_URL =
  "https://www.mercadopago.com.br/hub/registration/landing";

interface MercadoPagoOnboardingCardProps {
  userId: string;
  possuiMercadoPago: boolean;
  possuiChavePix?: boolean;
  chavePixAtual?: string | null;
  tipoChavePix?: string | null;
  saldoContingenciado?: number;
  isDarkTheme?: boolean;
  onStatusChange?: (possui: boolean) => void;
  onPixSaved?: () => void;
}

export default function MercadoPagoOnboardingCard({
  userId,
  possuiMercadoPago,
  possuiChavePix = true,
  chavePixAtual = null,
  tipoChavePix = null,
  saldoContingenciado = 0,
  onStatusChange,
  onPixSaved,
}: MercadoPagoOnboardingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [updatingMp, setUpdatingMp] = useState(false);
  const [showPixForm, setShowPixForm] = useState(false);
  const [pixTipo, setPixTipo] = useState<PixKeyType>(() => {
    const t = String(tipoChavePix || "telefone").toLowerCase();
    if (t === "cpf" || t === "cnpj" || t === "telefone" || t === "email" || t === "aleatoria") {
      return t;
    }
    return "telefone";
  });
  const [pixValor, setPixValor] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);

  const needsAction = !possuiMercadoPago || !possuiChavePix;

  const handleToggleHasAccount = async () => {
    if (!userId || updatingMp) return;
    const nextValue = !possuiMercadoPago;
    setUpdatingMp(true);
    try {
      const { error } = await supabase.rpc("atualizar_status_mercadopago_usuario", {
        p_user_id: userId,
        p_possui: nextValue,
      });
      if (error) throw error;
      onStatusChange?.(nextValue);
      toast.success(
        nextValue
          ? "Conta Mercado Pago confirmada com sucesso!"
          : "Status da conta Mercado Pago atualizado."
      );
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar status do Mercado Pago.");
    } finally {
      setUpdatingMp(false);
    }
  };

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    setPixError(null);
    const err = validatePixKeyValue(pixTipo, pixValor);
    if (err) {
      setPixError(err);
      return;
    }

    setSavingPix(true);
    try {
      const { data, error } = await supabase.rpc("salvar_chave_pix_usuario", {
        p_user_id: userId,
        p_chave_pix: pixValor.trim(),
        p_tipo_chave_pix: pixTipo,
      });
      if (error) throw error;
      const liberados = Number(data?.repasses_liberados || 0);
      toast.success(
        liberados > 0
          ? `Chave PIX salva! ${liberados} repasse(s) contingenciado(s) liberado(s).`
          : "Chave PIX salva com sucesso!"
      );
      setPixValor("");
      setShowPixForm(false);
      onPixSaved?.();
    } catch (e: any) {
      const msg = e?.message || "Erro ao salvar chave PIX.";
      setPixError(msg);
      toast.error(msg);
    } finally {
      setSavingPix(false);
    }
  };

  return (
    <div
      className={`mt-3 rounded-2xl bg-[#0b0f14] border transition-all duration-300 overflow-hidden ${
        needsAction
          ? "border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.16)]"
          : "border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.16)]"
      }`}
    >
      {/* Header compacto clicável (estilo gamer/bets) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left bg-gradient-to-r from-[#0b0f14] via-[#111827] to-[#0b0f14] hover:brightness-110 transition-all cursor-pointer border-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              needsAction
                ? "bg-amber-500/15 border-amber-400/40 text-amber-400"
                : "bg-emerald-500/15 border-emerald-400/40 text-emerald-400"
            }`}
          >
            {needsAction ? <AlertTriangle className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                  needsAction
                    ? "bg-amber-500/15 text-amber-300 border-amber-400/40"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-400/40"
                }`}
              >
                MERCADO PAGO
              </span>
              {!possuiChavePix ? (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  PIX PENDENTE
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  PIX ATIVO
                </span>
              )}
              {possuiMercadoPago && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30">
                  CONTA OK
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-white truncate m-0">
              {!possuiMercadoPago
                ? "Abra sua conta gratuita Mercado Pago para receber na UBT"
                : !possuiChavePix
                  ? "Cadastre sua chave PIX para liberar repasses de 0,5%"
                  : "Recebimentos Mercado Pago & PIX configurados"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 shrink-0">
          <span className="hidden sm:inline">{expanded ? "Recolher" : "Detalhes"}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <ChevronDown className={`w-4 h-4 ${needsAction ? "text-amber-400" : "text-emerald-400"}`} />
          )}
        </div>
      </button>

      {/* Painel expansível suave */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-3 border-t border-zinc-800/80 bg-[#0b0f14] flex flex-col gap-3">
            {/* Instruções Mercado Pago */}
            <p className="text-xs text-zinc-300 leading-relaxed m-0">
              Para movimentar valores, receber serviços e comissões na UBT, crie sua conta no{" "}
              <strong className="text-sky-400">Mercado Pago</strong>.{" "}
              <strong className="text-emerald-400">
                A abertura da conta é fundamental para movimentar e receber na plataforma e é totalmente gratuita.
              </strong>
            </p>

            {/* Ações Mercado Pago */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={MERCADO_PAGO_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs uppercase tracking-wider no-underline shadow-[0_0_14px_rgba(52,211,153,0.35)] transition-all"
              >
                <span>Abrir Conta Gratuita no Mercado Pago</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleToggleHasAccount}
                disabled={updatingMp}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  possuiMercadoPago
                    ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-300"
                    : "bg-[#111827] border-zinc-700 text-zinc-200 hover:border-zinc-500"
                }`}
              >
                {updatingMp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : possuiMercadoPago ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>{possuiMercadoPago ? "Conta Confirmada" : "Já possuo conta"}</span>
              </button>
            </div>

            {/* Controle de Chave PIX / Contingenciamento */}
            <div className="pt-2.5 border-t border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <KeyRound className={`w-3.5 h-3.5 ${possuiChavePix ? "text-emerald-400" : "text-amber-400"}`} />
                  {possuiChavePix ? (
                    <span className="text-zinc-300">
                      Chave PIX ativa:{" "}
                      <strong className="font-mono text-emerald-400">{chavePixAtual || "Cadastrada"}</strong>
                    </span>
                  ) : (
                    <span className="text-amber-300 font-medium">
                      Repasses de 0,5% por apadrinhamento ficam contingenciados até cadastrar sua chave PIX
                      {saldoContingenciado > 0
                        ? ` (R$ ${saldoContingenciado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} retidos).`
                        : "."}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPixForm((v) => !v);
                    setPixError(null);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider bg-[#111827] border border-amber-400/40 text-amber-300 hover:bg-amber-500/15 transition-all cursor-pointer"
                >
                  {showPixForm ? "Fechar" : possuiChavePix ? "Alterar PIX" : "Cadastrar PIX"}
                </button>
              </div>

              {showPixForm && (
                <form onSubmit={handleSavePix} className="flex flex-col gap-2 mt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={pixTipo}
                      onChange={(e) => {
                        setPixTipo(e.target.value as PixKeyType);
                        setPixValor("");
                        setPixError(null);
                      }}
                      className="rounded-xl px-2.5 py-2 text-xs bg-[#111827] border border-zinc-700 text-white outline-none"
                    >
                      <option value="telefone">Telefone</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="aleatoria">Aleatória (EVP)</option>
                    </select>

                    <input
                      type="text"
                      value={pixValor}
                      maxLength={getPixMaxLength(pixTipo)}
                      placeholder={getPixPlaceholder(pixTipo)}
                      onChange={(e) => {
                        setPixValor(applyPixMask(e.target.value, pixTipo));
                        setPixError(null);
                      }}
                      className="sm:col-span-2 rounded-xl px-3 py-2 text-xs font-mono bg-[#111827] border border-zinc-700 text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                  {pixError && <span className="text-[11px] text-red-400 font-medium">{pixError}</span>}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPix}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60"
                    >
                      {savingPix ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{savingPix ? "Salvando..." : "Salvar Chave PIX"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
