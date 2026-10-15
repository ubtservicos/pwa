import React, { useState } from "react";
import {
  X,
  Sparkles,
  Share2,
  Copy,
  Check,
  Search,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Users,
  Award,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/AnalyticsService";
import { maskCPF, generateReferralSlug } from "@/utils/masks";

interface JaSouFundadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterClick?: () => void;
}

interface FounderData {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  referral_code?: string;
}

export default function JaSouFundadorModal({
  isOpen,
  onClose,
  onRegisterClick,
}: JaSouFundadorModalProps) {
  const [identificador, setIdentificador] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [founder, setFounder] = useState<FounderData | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (errorMsg) setErrorMsg("");

    const onlyDigits = rawVal.replace(/\D/g, "");
    const hasLetters = /[a-zA-Z]/.test(rawVal);
    const isEmailLike = rawVal.includes("@") || hasLetters;

    if (!isEmailLike && onlyDigits.length > 0) {
      setIdentificador(maskCPF(rawVal));
    } else {
      setIdentificador(rawVal);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = identificador.trim();
    if (!rawQuery) {
      setErrorMsg("Informe seu e-mail ou CPF para localizar seu cadastro.");
      return;
    }

    // Sanitização estrita antes da busca: remove pontos, traços e caracteres especiais se não for email
    const isEmail = rawQuery.includes("@");
    const sanitizedQuery = isEmail ? rawQuery.toLowerCase() : rawQuery.replace(/\D/g, "");
    const queryForSearch = sanitizedQuery.length > 0 ? sanitizedQuery : rawQuery;

    setLoading(true);
    setErrorMsg("");
    setFounder(null);

    try {
      // 1. Tentar chamar a RPC buscar_fundador_identificador com o valor sanitizado
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "buscar_fundador_identificador",
        { p_identificador: queryForSearch }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        const found = rpcData[0];
        setFounder({
          id: found.id,
          nome: found.nome || "Fundador(a)",
          email: found.email || "",
          referral_code: found.referral_code || generateReferralSlug(found.nome, found.id),
        });
        trackEvent("founder_lookup_success", "marketing", { id: found.id });
        setLoading(false);
        return;
      }

      // 2. Fallback caso a RPC não retorne nada: busca direta em waitlist ou profiles
      const cleanDoc = rawQuery.replace(/\D/g, "");
      const cleanEmail = rawQuery.toLowerCase();

      let directQuery = supabase.from("waitlist").select("id, nome, email, telefone, referral_code");

      if (cleanEmail.includes("@")) {
        directQuery = directQuery.ilike("email", cleanEmail);
      } else if (cleanDoc.length >= 8) {
        directQuery = directQuery.ilike("telefone", `%${cleanDoc}%`);
      } else {
        directQuery = directQuery.or(`referral_code.ilike.%${rawQuery}%,nome.ilike.%${rawQuery}%`);
      }

      const { data: waitlistData, error: waitlistError } = await directQuery.limit(1);

      if (!waitlistError && waitlistData && waitlistData.length > 0) {
        const item = waitlistData[0];
        setFounder({
          id: item.id,
          nome: item.nome || "Fundador(a)",
          email: item.email || "",
          telefone: item.telefone || "",
          referral_code: item.referral_code || generateReferralSlug(item.nome, item.id),
        });
        trackEvent("founder_lookup_success", "marketing", { id: item.id });
        setLoading(false);
        return;
      }

      // 3. Busca em profiles por CPF ou telefone
      if (cleanDoc.length >= 10) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, cpf, phone, referral_code")
          .or(`cpf.eq.${cleanDoc},phone.ilike.%${cleanDoc}%`)
          .limit(1);

        if (profileData && profileData.length > 0) {
          const item = profileData[0];
          setFounder({
            id: item.id,
            nome: item.name || "Fundador(a)",
            referral_code: item.referral_code || generateReferralSlug(item.name, item.id),
          });
          trackEvent("founder_lookup_success", "marketing", { id: item.id });
          setLoading(false);
          return;
        }
      }

      // Não encontrado
      setErrorMsg(
        "Não encontramos nenhum cadastro com este e-mail ou CPF. Verifique os dados ou faça sua inscrição pioneira!"
      );
      trackEvent("founder_lookup_not_found", "marketing", { query: rawQuery });
    } catch (err: any) {
      console.error("Erro na busca de fundador:", err);
      setErrorMsg("Ocorreu um erro ao consultar seus dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getReferralUrl = () => {
    if (!founder) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : (import.meta.env.VITE_APP_URL || "");
    const refCode = founder.referral_code || generateReferralSlug(founder.nome, founder.id);
    return `${origin}/cadastro?ref=${refCode}`;
  };

  const handleCopyLink = () => {
    const url = getReferralUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    trackEvent("founder_referral_copy", "marketing", { id: founder?.id });
  };

  const getWhatsAppShareUrl = () => {
    const url = getReferralUrl();
    const text = `🚀 Olá! Conheça a UBT, a plataforma que conecta prestadores de serviço locais com taxas justas em Ubatuba.\n\nCadastre-se como pioneiro(a) pelo meu link exclusivo de fundador e garanta benefícios:\n${url}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const handleRegisterRedirect = () => {
    onClose();
    if (onRegisterClick) {
      onRegisterClick();
    } else {
      const el = document.getElementById("cadastro-fundadores-cap") || document.getElementById("fundadores-cap");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (typeof window !== "undefined") {
        window.location.href = "/#cadastro-fundadores-cap";
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 select-none overflow-y-auto"
    >
      <div className="relative z-10 w-full max-w-lg bg-[#0E0F12]/95 border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(13,184,126,0.15)] flex flex-col items-center animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10 cursor-pointer"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#0DB87E]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#005BFF]/15 rounded-full blur-3xl pointer-events-none" />

        {!founder ? (
          /* STEP 1: WELCOME MESSAGE & LOOKUP */
          <div className="w-full flex flex-col items-center">
            {/* Friendly Hero Badge */}
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-green mb-4 shadow-lg">
              <Sparkles className="w-8 h-8 text-green" />
            </div>

            <span className="text-[10px] tracking-[0.2em] font-mono text-green uppercase font-semibold block mb-2">
              Espaço do Fundador
            </span>

            <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-white mb-3">
              Calma, a culpa não é sua! ✨
            </h3>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans mb-6 max-w-md text-center">
              Nossa plataforma ainda está recebendo os últimos ajustes para te entregar a melhor experiência.
              Enquanto preparamos o lançamento oficial, você já tem acesso ao seu link exclusivo de indicação para montar sua rede pioneira!
            </p>

            <form onSubmit={handleSearch} className="w-full flex flex-col gap-4 text-left">
              <div>
                <label
                  htmlFor="founder-identificador"
                  className="block text-xs font-mono text-white/60 uppercase tracking-widest mb-2 pl-1"
                >
                  Localize seu cadastro (E-mail ou CPF)
                </label>
                <div className="relative">
                  <input
                    id="founder-identificador"
                    type="text"
                    value={identificador}
                    onChange={handleInputChange}
                    placeholder="Digite seu e-mail ou CPF cadastrado"
                    className="w-full pl-4 pr-11 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-green text-white text-sm outline-none transition-all placeholder:text-white/30 font-sans"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading || !identificador.trim()}
                    className="absolute right-2 top-2 bottom-2 px-3 rounded-xl bg-green hover:bg-green-dark text-navy font-bold flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Buscar cadastro"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !identificador.trim()}
                className="w-full py-4 rounded-2xl font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-[#005BFF] to-[#22C55E] hover:from-[#00A3FF] hover:to-[#22C55E] text-white flex items-center justify-center gap-2 shadow-lg shadow-[#005BFF]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buscando Cadastro...</span>
                  </>
                ) : (
                  <>
                    <span>Consultar meu Link de Indicação</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="w-full mt-6 pt-6 border-t border-white/5 flex flex-col items-center gap-2">
              <span className="text-xs text-white/40 font-sans">Ainda não fez sua inscrição?</span>
              <button
                type="button"
                onClick={handleRegisterRedirect}
                className="text-xs text-green hover:text-green/80 font-bold underline underline-offset-4 transition-colors cursor-pointer"
              >
                Quero ser um Fundador agora
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: REFERRAL & SPONSORSHIP DASHBOARD */
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            {/* Pioneer Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0DB87E]/15 border border-[#0DB87E]/30 text-[#0DB87E] text-[10px] font-mono uppercase tracking-widest font-semibold mb-3">
              <Award className="w-3.5 h-3.5 text-[#F5A623]" />
              Fundador(a) Confirmado(a)
            </div>

            <h3 className="font-display font-extrabold text-2xl text-white mb-2">
              Olá, {founder.nome.split(" ")[0]}! 🎉
            </h3>

            <p className="text-xs text-white/70 leading-relaxed font-sans mb-5 max-w-md text-center">
              Você já faz parte do grupo de fundadores da UBT. Comece agora mesmo a indicar novos prestadores e tomadores para receber recompensas a cada transação!
            </p>

            {/* Rules card with 0,5% */}
            <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 mb-5 text-left flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Users className="w-4 h-4 text-green" />
                <span>Programa Padrinho & Madrinha</span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed font-sans">
                A cada corrida ou serviço concluído pelas pessoas cadastradas pelo seu link, você recebe <strong>0,5% de comissão</strong> direta, além de concorrer aos prêmios anuais dos Fundos UBT.
              </p>
            </div>

            {/* Referral Link Box */}
            <div className="w-full flex flex-col gap-2 text-left mb-5">
              <label className="text-xs font-mono text-white/50 uppercase tracking-wider pl-1">
                Seu Link Exclusivo de Indicação:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getReferralUrl()}
                  className="w-full px-3.5 py-3 rounded-xl bg-black/50 border border-white/10 text-white/90 text-xs font-mono select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-white/10 cursor-pointer active:scale-95"
                  aria-label="Copiar link de indicação"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green" />
                      <span className="text-green">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* WhatsApp Share Button */}
            <a
              href={getWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("founder_share_whatsapp", "marketing", { id: founder.id })}
              className="w-full py-4 rounded-2xl font-display font-extrabold text-sm tracking-wider uppercase bg-[#25D366] hover:bg-[#20bd5a] text-black shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 mb-3 active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartilhar no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => setFounder(null)}
              className="text-xs text-white/40 hover:text-white transition-colors mt-2 cursor-pointer"
            >
              Consultar outro cadastro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
