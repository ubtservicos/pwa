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
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Edit3,
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

type ModalStep = "lookup" | "password" | "dashboard";

export default function JaSouFundadorModal({
  isOpen,
  onClose,
  onRegisterClick,
}: JaSouFundadorModalProps) {
  // Step navigation
  const [step, setStep] = useState<ModalStep>("lookup");

  // Step 1: Lookup state
  const [identificador, setIdentificador] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [candidateFounder, setCandidateFounder] = useState<FounderData | null>(null);

  // Step 2: Password Authentication Barrier state
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Step 3: Dashboard & Custom Slug state
  const [founder, setFounder] = useState<FounderData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [slugSuccessMsg, setSlugSuccessMsg] = useState("");

  if (!isOpen) return null;

  const resetAll = () => {
    setStep("lookup");
    setIdentificador("");
    setErrorMsg("");
    setCandidateFounder(null);
    setPassword("");
    setPasswordError("");
    setFounder(null);
    setIsEditingSlug(false);
    setSlugError("");
    setSlugSuccessMsg("");
  };

  const handleModalClose = () => {
    resetAll();
    onClose();
  };

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

  const handleFoundCandidate = (candidate: FounderData) => {
    setCandidateFounder(candidate);
    setStep("password");
    setPassword("");
    setPasswordError("");
    trackEvent("founder_lookup_success", "marketing", { id: candidate.id });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = identificador.trim();
    if (!rawQuery) {
      setErrorMsg("Informe seu e-mail ou CPF para localizar seu cadastro.");
      return;
    }

    const isEmail = rawQuery.includes("@");
    const sanitizedQuery = isEmail ? rawQuery.toLowerCase() : rawQuery.replace(/\D/g, "");
    const queryForSearch = sanitizedQuery.length > 0 ? sanitizedQuery : rawQuery;

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Tentar chamar a RPC buscar_fundador_identificador testando ambos os formatos de parâmetro:
      // { p_identificador: valorLimpo } e fallback para { identificador: valorLimpo }
      let rpcResultData: any = null;

      // Tentativa A: { p_identificador: valorLimpo }
      const resP = await supabase.rpc("buscar_fundador_identificador", {
        p_identificador: queryForSearch,
      });

      if (!resP.error && resP.data && resP.data.length > 0) {
        rpcResultData = resP.data;
      } else {
        // Tentativa B: { identificador: valorLimpo }
        const resId = await supabase.rpc("buscar_fundador_identificador", {
          identificador: queryForSearch,
        });

        if (!resId.error && resId.data && resId.data.length > 0) {
          rpcResultData = resId.data;
        }
      }

      if (rpcResultData && rpcResultData.length > 0) {
        const found = rpcResultData[0];
        handleFoundCandidate({
          id: found.id,
          nome: found.nome || "Fundador(a)",
          email: found.email || "",
          telefone: found.telefone || "",
          referral_code: found.referral_code || generateReferralSlug(found.nome, found.id),
        });
        setLoading(false);
        return;
      }

      // 2. Fallback: busca direta em usuarios
      let usersQuery = supabase.from("usuarios").select("id, nome, email, telefone, cpf, referral_code");
      if (isEmail) {
        usersQuery = usersQuery.ilike("email", sanitizedQuery);
      } else if (sanitizedQuery.length >= 11) {
        usersQuery = usersQuery.ilike("cpf", `%${sanitizedQuery}%`);
      } else {
        usersQuery = usersQuery.or(`telefone.ilike.%${sanitizedQuery}%,referral_code.ilike.%${sanitizedQuery}%`);
      }

      const { data: userData, error: userError } = await usersQuery.limit(1);
      if (!userError && userData && userData.length > 0) {
        const item = userData[0];
        handleFoundCandidate({
          id: item.id,
          nome: item.nome || "Fundador(a)",
          email: item.email || "",
          telefone: item.telefone || "",
          referral_code: item.referral_code || generateReferralSlug(item.nome, item.id),
        });
        setLoading(false);
        return;
      }

      // 3. Fallback: busca direta em waitlist
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
        handleFoundCandidate({
          id: item.id,
          nome: item.nome || "Fundador(a)",
          email: item.email || "",
          telefone: item.telefone || "",
          referral_code: item.referral_code || generateReferralSlug(item.nome, item.id),
        });
        setLoading(false);
        return;
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError("Digite sua senha para prosseguir.");
      return;
    }
    if (!candidateFounder) return;

    setIsVerifyingPassword(true);
    setPasswordError("");

    try {
      const emailToUse = candidateFounder.email;

      if (!emailToUse) {
        // Se a conta não tem e-mail registrado, permitir prosseguir com fallback
        setFounder(candidateFounder);
        setCustomSlug(candidateFounder.referral_code || "");
        setStep("dashboard");
        return;
      }

      // Validação real da senha via Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });

      if (authError) {
        if (
          authError.message.includes("Invalid login credentials") ||
          authError.message.includes("invalid") ||
          authError.status === 400
        ) {
          setPasswordError("Senha incorreta. Verifique os dados digitados ou recupere sua senha.");
        } else {
          setPasswordError(authError.message || "Erro ao verificar senha.");
        }
        return;
      }

      // Autenticação bem sucedida
      setFounder(candidateFounder);
      setCustomSlug(candidateFounder.referral_code || "");
      setStep("dashboard");
      trackEvent("founder_authenticated_success", "marketing", { id: candidateFounder.id });
    } catch (err: any) {
      console.error("Erro ao validar senha do fundador:", err);
      setPasswordError("Ocorreu um erro ao verificar sua senha. Tente novamente.");
    } finally {
      setIsVerifyingPassword(false);
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

  const handleSaveCustomSlug = async () => {
    if (!founder) return;
    const cleanSlug = customSlug.trim().toLowerCase();

    if (!cleanSlug) {
      setSlugError("Informe o código desejado.");
      return;
    }

    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      setSlugError("O código deve ter entre 3 e 30 caracteres.");
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)) {
      setSlugError("Use apenas letras minúsculas, números e hífens.");
      return;
    }

    setIsSavingSlug(true);
    setSlugError("");
    setSlugSuccessMsg("");

    try {
      // 1. Tentar RPC segura set_user_referral_code
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("set_user_referral_code", {
        p_user_id: founder.id,
        p_code: cleanSlug,
      });

      if (!rpcErr && rpcRes) {
        if (rpcRes.success === false) {
          setSlugError(rpcRes.error || "Este código já está em uso por outro fundador.");
          setIsSavingSlug(false);
          return;
        }
      } else {
        // Fallback: validação direta no banco
        const { data: existingUser } = await supabase
          .from("usuarios")
          .select("id")
          .ilike("referral_code", cleanSlug)
          .neq("id", founder.id)
          .maybeSingle();

        if (existingUser) {
          setSlugError("Este código já está em uso por outro fundador.");
          setIsSavingSlug(false);
          return;
        }

        const { data: existingWl } = await supabase
          .from("waitlist")
          .select("id")
          .ilike("referral_code", cleanSlug)
          .neq("id", founder.id)
          .maybeSingle();

        if (existingWl) {
          setSlugError("Este código já está em uso na lista de espera.");
          setIsSavingSlug(false);
          return;
        }

        // Atualização direta
        await supabase.from("usuarios").update({ referral_code: cleanSlug }).eq("id", founder.id);
        await supabase.from("waitlist").update({ referral_code: cleanSlug }).eq("id", founder.id);
        if (founder.email) {
          await supabase.from("waitlist").update({ referral_code: cleanSlug }).ilike("email", founder.email);
        }
      }

      setFounder((prev) => (prev ? { ...prev, referral_code: cleanSlug } : prev));
      setSlugSuccessMsg("Link personalizado com sucesso! 🎉");
      trackEvent("founder_custom_slug_saved", "marketing", { id: founder.id, slug: cleanSlug });

      setTimeout(() => {
        setIsEditingSlug(false);
        setSlugSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Erro ao salvar código de indicação:", err);
      setSlugError(err.message || "Erro ao salvar código.");
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleRegisterRedirect = () => {
    handleModalClose();
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
        {/* Botão Fechar */}
        <button
          onClick={handleModalClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10 cursor-pointer"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#0DB87E]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#005BFF]/15 rounded-full blur-3xl pointer-events-none" />

        {/* ========================================================================= */}
        {/* STEP 1: IDENTIFICAÇÃO (E-MAIL OU CPF) */}
        {/* ========================================================================= */}
        {step === "lookup" && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
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
        )}

        {/* ========================================================================= */}
        {/* STEP 2: BARREIRA DE AUTENTICAÇÃO LEVE (SENHA) */}
        {/* ========================================================================= */}
        {step === "password" && candidateFounder && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-green mb-4 shadow-lg">
              <ShieldCheck className="w-8 h-8 text-green" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0DB87E]/15 border border-[#0DB87E]/30 text-[#0DB87E] text-[10px] font-mono uppercase tracking-widest font-semibold mb-3">
              <Lock className="w-3.5 h-3.5 text-[#0DB87E]" />
              Validação de Segurança
            </div>

            <h3 className="font-display font-extrabold text-2xl text-white mb-2">
              Olá, {candidateFounder.nome.split(" ")[0]}! 🔐
            </h3>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans mb-6 max-w-md text-center">
              Para proteger seu link exclusivo de indicação e suas futuras comissões, por favor confirme a sua senha cadastrada.
            </p>

            <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-4 text-left">
              <div>
                <div className="flex justify-between items-center mb-2 pl-1">
                  <label
                    htmlFor="founder-password"
                    className="block text-xs font-mono text-white/60 uppercase tracking-widest"
                  >
                    Sua Senha de Acesso
                  </label>
                  {candidateFounder.email && (
                    <span className="text-[11px] text-white/40 font-mono truncate max-w-[200px]">
                      {candidateFounder.email}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="founder-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    placeholder="Digite sua senha cadastrada"
                    className="w-full pl-4 pr-11 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-green text-white text-sm outline-none transition-all placeholder:text-white/30 font-sans"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                    aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingPassword || !password.trim()}
                className="w-full py-4 rounded-2xl font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-[#0DB87E] to-[#22C55E] hover:from-[#0DB87E] hover:to-[#16a34a] text-navy flex items-center justify-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifyingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    <span>Validando Senha...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Senha & Acessar Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="w-full mt-5 pt-5 border-t border-white/5 flex flex-col items-center gap-3">
              <a
                href="/recuperar-senha"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/50 hover:text-green underline underline-offset-4 transition-colors"
              >
                Esqueci minha senha
              </a>

              <button
                type="button"
                onClick={() => {
                  setStep("lookup");
                  setCandidateFounder(null);
                  setPassword("");
                  setPasswordError("");
                }}
                className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Voltar e consultar outro cadastro
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: DASHBOARD DO FUNDADOR & PERSONALIZAÇÃO DE LINK */}
        {/* ========================================================================= */}
        {step === "dashboard" && founder && (
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
              Você já faz parte do grupo pioneiro de fundadores da UBT. Comece agora mesmo a indicar novos prestadores e tomadores para receber recompensas a cada transação!
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

            {/* Referral Link Box com Botão de Personalização Visível */}
            <div className="w-full flex flex-col gap-2 text-left mb-4">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-mono text-white/50 uppercase tracking-wider">
                  Seu Link Exclusivo de Indicação:
                </label>
              </div>

              {/* Linha principal com Input + Botão Copiar + Botão Personalizar Link */}
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
                  className="px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-white/10 cursor-pointer active:scale-95"
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
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingSlug(!isEditingSlug);
                    setSlugError("");
                    setSlugSuccessMsg("");
                  }}
                  className={`px-3.5 py-3 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer active:scale-95 border ${
                    isEditingSlug
                      ? "bg-green text-navy border-green"
                      : "bg-[#0DB87E]/15 hover:bg-[#0DB87E]/25 text-[#0DB87E] border-[#0DB87E]/30"
                  }`}
                  aria-label="Personalizar Link"
                  title="Personalizar seu Link de Indicação"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{isEditingSlug ? "Fechar" : "Personalizar"}</span>
                </button>
              </div>

              {/* Box Expansível de Personalização de Slug */}
              {isEditingSlug && (
                <div className="w-full mt-2 p-4 rounded-2xl bg-black/70 border border-green/30 text-left flex flex-col gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-green uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-green" />
                      Escolha seu código exclusivo (Slug)
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">3 a 30 caracteres</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                        setCustomSlug(val);
                        setSlugError("");
                        setSlugSuccessMsg("");
                      }}
                      placeholder="ex: pousada-brisa"
                      maxLength={30}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-green text-white text-xs font-mono outline-none"
                    />
                    <button
                      type="button"
                      disabled={isSavingSlug || !customSlug.trim()}
                      onClick={handleSaveCustomSlug}
                      className="px-4 py-2.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSavingSlug ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingSlug(false)}
                      className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-sans transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  {slugError && (
                    <p className="text-[11px] text-red-400 font-sans flex items-center gap-1">
                      <span>⚠</span> {slugError}
                    </p>
                  )}

                  {slugSuccessMsg && (
                    <p className="text-[11px] text-green font-sans flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {slugSuccessMsg}
                    </p>
                  )}

                  <p className="text-[10px] text-white/40 font-mono">
                    Prévia: {typeof window !== "undefined" ? window.location.origin : ""}/cadastro?ref={customSlug || "seu-codigo"}
                  </p>
                </div>
              )}
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
              onClick={resetAll}
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
