import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  applyPixMask,
  getPixMaxLength,
  getPixPlaceholder,
  isValidCNPJ,
  isValidCPF,
  isValidEVP,
  isValidEmail,
  isValidPixPhone,
} from "@/utils/masks";
import { toast } from "sonner";

export type PixKeyType = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";

interface PixContingencyBannerProps {
  userId: string;
  possuiChavePix: boolean;
  chavePixAtual?: string | null;
  tipoChavePix?: string | null;
  saldoContingenciado?: number;
  variant?: "dark" | "adaptive";
  isDarkTheme?: boolean;
  onSaved?: (res: { chave_pix: string; tipo_chave_pix: string; repasses_liberados: number }) => void;
}

export function validatePixKeyValue(tipo: PixKeyType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Informe sua chave PIX.";

  switch (tipo) {
    case "cpf":
      return isValidCPF(trimmed) ? null : "CPF inválido para chave PIX.";
    case "cnpj":
      return isValidCNPJ(trimmed) ? null : "CNPJ inválido para chave PIX.";
    case "telefone":
      return isValidPixPhone(trimmed) ? null : "Telefone inválido (informe DDD + número).";
    case "email":
      return isValidEmail(trimmed) ? null : "E-mail inválido para chave PIX.";
    case "aleatoria":
      return isValidEVP(trimmed) ? null : "Chave aleatória (EVP) inválida.";
    default:
      return null;
  }
}

export default function PixContingencyBanner({
  userId,
  possuiChavePix,
  chavePixAtual,
  tipoChavePix,
  saldoContingenciado = 0,
  variant = "dark",
  isDarkTheme = true,
  onSaved,
}: PixContingencyBannerProps) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState<PixKeyType>(() => {
    const t = (tipoChavePix || "telefone").toLowerCase();
    if (t === "cpf" || t === "cnpj" || t === "telefone" || t === "email" || t === "aleatoria") {
      return t;
    }
    return "telefone";
  });
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const validationErr = validatePixKeyValue(tipo, valor);
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("salvar_chave_pix_usuario", {
        p_user_id: userId,
        p_chave_pix: valor.trim(),
        p_tipo_chave_pix: tipo,
      });

      if (error) throw error;

      const liberados = Number(data?.repasses_liberados || 0);
      toast.success(
        liberados > 0
          ? `Chave PIX salva! ${liberados} repasse(s) contingenciado(s) liberado(s) automaticamente.`
          : "Chave PIX salva com sucesso! Seus repasses por apadrinhamento estão habilitados."
      );
      setShowForm(false);
      setValor("");
      onSaved?.({
        chave_pix: valor.trim(),
        tipo_chave_pix: tipo,
        repasses_liberados: liberados,
      });
    } catch (err: any) {
      const msg = err?.message || "Não foi possível salvar a chave PIX.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (possuiChavePix && !showForm) {
    return (
      <div
        className={`rounded-2xl p-4 border flex items-center justify-between gap-3 flex-wrap ${
          variant === "adaptive" && !isDarkTheme
            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : "bg-emerald-950/20 border-emerald-500/30 text-white"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#0DB87E]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0DB87E]">
              Chave PIX Ativa para Repasses (0,5%)
            </p>
            <p className="text-xs opacity-80 font-mono truncate">
              {tipoChavePix ? `${tipoChavePix.toUpperCase()}: ` : ""}
              {chavePixAtual || "Cadastrada"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-[#0DB87E] hover:bg-emerald-500/20 transition-all cursor-pointer"
        >
          Alterar Chave
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 border shadow-lg transition-all ${
        variant === "adaptive" && !isDarkTheme
          ? "bg-amber-50 border-amber-300 text-amber-950"
          : "bg-amber-950/25 border-amber-500/50 text-white shadow-[0_0_25px_rgba(245,158,11,0.12)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-[220px]">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-amber-400 tracking-tight">
                {possuiChavePix ? "Atualizar Chave PIX de Recebimento" : "Chave PIX pendente — Repasses contingenciados"}
              </h3>
              {saldoContingenciado > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  R$ {saldoContingenciado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} retidos
                </span>
              )}
            </div>
            <p className={`text-xs leading-relaxed ${variant === "adaptive" && !isDarkTheme ? "text-amber-900" : "text-zinc-300"}`}>
              Sem uma chave PIX cadastrada, seus repasses de <strong className="text-amber-300">0,5% por apadrinhamento</strong> ficam{" "}
              <strong className="text-amber-300">contingenciados</strong> (retidos em segurança para você, sem expirar) até a regularização da chave.
            </p>
          </div>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.35)] transition-all cursor-pointer shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{possuiChavePix ? "Editar Chave PIX" : "Cadastrar Chave PIX Agora"}</span>
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-amber-500/25 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider opacity-75 block mb-1">
                Tipo da Chave
              </label>
              <select
                value={tipo}
                onChange={(e) => {
                  const next = e.target.value as PixKeyType;
                  setTipo(next);
                  setValor("");
                  setErrorMsg(null);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-xs font-medium border outline-none ${
                  variant === "adaptive" && !isDarkTheme
                    ? "bg-white border-amber-300 text-zinc-900"
                    : "bg-black border-zinc-700 text-white"
                }`}
              >
                <option value="telefone">Telefone (Celular)</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-mono uppercase tracking-wider opacity-75 block mb-1">
                Chave PIX
              </label>
              <input
                type="text"
                value={valor}
                maxLength={getPixMaxLength(tipo)}
                placeholder={getPixPlaceholder(tipo)}
                onChange={(e) => {
                  setValor(applyPixMask(e.target.value, tipo));
                  setErrorMsg(null);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono border outline-none ${
                  variant === "adaptive" && !isDarkTheme
                    ? "bg-white border-amber-300 text-zinc-900"
                    : "bg-black border-zinc-700 text-white focus:border-[#00FF66]"
                }`}
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
          )}

          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErrorMsg(null);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800/60 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#00e65c] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{saving ? "Salvando..." : "Salvar Chave PIX e Liberar"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
