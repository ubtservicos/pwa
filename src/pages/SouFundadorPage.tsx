import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Users,
  Award,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Edit3,
  LogOut,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";
import { trackEvent } from "@/services/AnalyticsService";
import { maskCPF, generateReferralSlug } from "@/utils/masks";

interface FounderData {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  referral_code?: string;
}

// Ícone oficial do WhatsApp
const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function SouFundadorPage() {
  const navigate = useNavigate();

  // Estado de autenticação do fundador
  const [authLoading, setAuthLoading] = useState(true);
  const [founder, setFounder] = useState<FounderData | null>(null);

  // Formulário de Login / Desbloqueio (para não autenticados)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Customização de link de indicação (Vanity Slug)
  const [customSlug, setCustomSlug] = useState("");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [slugSuccess, setSlugSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  // 1. Carrega dados do fundador se já autenticado no Supabase Auth
  const loadFounderData = async (userId?: string | null, emailHint?: string | null) => {
    // Blindagem rigorosa contra undefined, null ou ID vazio
    if (!userId || typeof userId !== "string" || !userId.trim() || userId === "undefined" || userId === "null") {
      return;
    }
    const cleanUserId = userId.trim();

    try {
      // Busca em public.usuarios com o schema exato: id, nome, email, telefone, cpf, referral_code
      const { data: userData, error: userError } = await supabase
        .from("usuarios")
        .select("id, nome, email, telefone, cpf, referral_code")
        .eq("id", cleanUserId)
        .maybeSingle();

      if (userError) {
        console.warn("[SouFundadorPage] Aviso ao buscar usuário:", userError.message);
      }

      if (userData) {
        const code = userData.referral_code || generateReferralSlug(userData.nome, userData.id);
        setFounder({
          id: userData.id,
          nome: userData.nome || "Membro Fundador",
          email: userData.email || emailHint || "",
          telefone: userData.telefone || "",
          cpf: userData.cpf || "",
          referral_code: code,
        });
        setCustomSlug(code);
        return;
      }

      // Fallback seguro para public.waitlist
      const cleanEmail = emailHint?.trim()?.toLowerCase();
      let wlQuery = supabase
        .from("waitlist")
        .select("id, nome, email, telefone, cpf, referral_code");

      if (cleanEmail) {
        wlQuery = wlQuery.or(`user_id.eq.${cleanUserId},id.eq.${cleanUserId},email.ilike.${cleanEmail}`);
      } else {
        wlQuery = wlQuery.or(`user_id.eq.${cleanUserId},id.eq.${cleanUserId}`);
      }

      const { data: wlData, error: wlError } = await wlQuery.limit(1).maybeSingle();

      if (wlError) {
        console.warn("[SouFundadorPage] Aviso ao buscar waitlist:", wlError.message);
      }

      if (wlData) {
        const code = wlData.referral_code || generateReferralSlug(wlData.nome, wlData.id);
        setFounder({
          id: wlData.id,
          nome: wlData.nome || "Membro Fundador",
          email: wlData.email || emailHint || "",
          telefone: wlData.telefone || "",
          cpf: wlData.cpf || "",
          referral_code: code,
        });
        setCustomSlug(code);
        return;
      }

      // Se autenticado mas sem registro explícito em usuarios/waitlist
      const fallbackCode = generateReferralSlug("fundador", cleanUserId);
      setFounder({
        id: cleanUserId,
        nome: "Membro Fundador",
        email: emailHint || "",
        referral_code: fallbackCode,
      });
      setCustomSlug(fallbackCode);
    } catch (err) {
      console.error("[SouFundadorPage] Erro ao carregar dados do fundador:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        setAuthLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          // Sem sessão ativa: apenas remove loading para exibir o formulário de login
          if (isMounted) setAuthLoading(false);
          return;
        }

        // Blindagem contra undefined antes de invocar a consulta
        if (user?.id && isMounted) {
          await loadFounderData(user.id, user.email);
        }
      } catch (err) {
        console.error("[SouFundadorPage] Erro na checagem de sessão:", err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) {
        await loadFounderData(session.user.id, session.user.email);
      } else if (event === "SIGNED_OUT") {
        setFounder(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Formatação do identificador de login (CPF ou E-mail)
  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (loginError) setLoginError("");

    const onlyDigits = rawVal.replace(/\D/g, "");
    const hasLetters = /[a-zA-Z]/.test(rawVal);
    const isEmailLike = rawVal.includes("@") || hasLetters;

    if (!isEmailLike && onlyDigits.length > 0) {
      setIdentifier(maskCPF(rawVal));
    } else {
      setIdentifier(rawVal);
    }
  };

  // 2. Submissão de identificação / login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawId = identifier.trim();

    if (!rawId) {
      setLoginError("Informe seu e-mail ou CPF cadastrado.");
      return;
    }
    if (!password.trim()) {
      setLoginError("Digite sua senha de acesso.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      let emailToAuth = rawId;

      // Se for CPF, localiza o e-mail associado
      if (!rawId.includes("@")) {
        const cleanDoc = rawId.replace(/\D/g, "");

        // Tenta RPC buscar_fundador_identificador
        const { data: rpcData } = await supabase.rpc("buscar_fundador_identificador", {
          p_identificador: cleanDoc,
        });

        if (rpcData && rpcData.length > 0 && rpcData[0].email) {
          emailToAuth = rpcData[0].email;
        } else {
          // Busca direta em usuarios por CPF
          const { data: userByCpf } = await supabase
            .from("usuarios")
            .select("email")
            .ilike("cpf", `%${cleanDoc}%`)
            .maybeSingle();

          if (userByCpf?.email) {
            emailToAuth = userByCpf.email;
          } else {
            // Busca direta em waitlist por CPF
            const { data: wlByCpf } = await supabase
              .from("waitlist")
              .select("email")
              .ilike("cpf", `%${cleanDoc}%`)
              .maybeSingle();

            if (wlByCpf?.email) {
              emailToAuth = wlByCpf.email;
            } else {
              setLoginError("Cadastro não localizado com este CPF. Verifique os dados informados.");
              setIsLoggingIn(false);
              return;
            }
          }
        }
      }

      // Autenticação oficial no Supabase
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: emailToAuth.toLowerCase().trim(),
        password,
      });

      if (authErr) {
        if (
          authErr.message.includes("Invalid login credentials") ||
          authErr.message.includes("invalid") ||
          authErr.status === 400
        ) {
          setLoginError("Senha incorreta. Verifique sua senha e tente novamente.");
        } else {
          setLoginError(authErr.message || "Erro ao autenticar. Tente novamente.");
        }
        setIsLoggingIn(false);
        return;
      }

      if (authData?.user?.id) {
        await loadFounderData(authData.user.id, authData.user.email);
        trackEvent("founder_login_success", "marketing", { userId: authData.user.id });
      }
    } catch (err: any) {
      console.error("[SouFundadorPage] Erro no login:", err);
      setLoginError("Ocorreu um erro ao validar seus dados. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFounder(null);
    setIdentifier("");
    setPassword("");
  };

  // URL de indicação
  const getReferralUrl = () => {
    if (!founder) return "";
    const origin = getAppOrigin() || window.location.origin;
    const refCode = founder.referral_code || generateReferralSlug(founder.nome, founder.id);
    return `${origin}/cadastro?ref=${refCode}`;
  };

  // Cópia para o clipboard
  const handleCopyLink = () => {
    const url = getReferralUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    trackEvent("founder_hub_referral_copy", "marketing", { id: founder?.id });
  };

  // Mensagem e URL do WhatsApp
  const whatsAppMessage = `🚀 Olá! Conheça a UBT, a plataforma que conecta prestadores de serviço locais com taxas justas em Ubatuba.\n\nCadastre-se como pioneiro(a) pelo meu link exclusivo de fundador e garanta benefícios:\n${getReferralUrl()}`;
  const whatsAppShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessage)}`;

  // Salvar slug personalizado
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
    setSlugSuccess("");

    try {
      // 1. Tenta RPC segura set_user_referral_code
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
      setSlugSuccess("Link personalizado com sucesso! 🎉");
      trackEvent("founder_hub_custom_slug_saved", "marketing", { id: founder.id, slug: cleanSlug });

      setTimeout(() => {
        setIsEditingSlug(false);
        setSlugSuccess("");
      }, 2500);
    } catch (err: any) {
      console.error("[SouFundadorPage] Erro ao salvar slug:", err);
      setSlugError(err.message || "Erro ao salvar código de indicação.");
    } finally {
      setIsSavingSlug(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060B18] text-white flex flex-col selection:bg-green selection:text-navy">
      {/* Glows de Fundo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00FF66]/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#005BFF]/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Barra de Navegação Superior */}
      <header className="relative z-30 border-b border-white/10 bg-[#0B1329]/80 backdrop-blur-md sticky top-0 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-mono font-medium"
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg tracking-wider text-white">
              UBT <span className="text-green text-sm font-sans font-semibold">SERVIÇOS</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {founder ? (
            <button
              onClick={handleSignOut}
              className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-white/70 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          ) : (
            <Link
              to="/#cadastro-fundadores-cap"
              className="text-xs text-green hover:underline font-mono font-semibold"
            >
              Quero ser Fundador
            </Link>
          )}
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-10">
        {/* ========================================================================= */}
        {/* SEÇÃO 1: MANIFESTO & STATUS DE IMPLANTAÇÃO */}
        {/* ========================================================================= */}
        <section className="text-center flex flex-col items-center">
          {/* Badge Superior */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-6 shadow-[0_0_20px_rgba(0,255,102,0.15)]">
            <span className="w-2 h-2 rounded-full bg-green animate-ping" />
            <span>FASE FINAL DE IMPLANTAÇÃO • UBATUBA, SP</span>
          </div>

          {/* Título Principal */}
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-[1.15] max-w-2xl mb-6">
            Estamos nos ajustes finais para transformar a economia de Ubatuba.
          </h1>

          {/* Texto Manifesto */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0B1329]/90 border border-white/10 shadow-2xl text-left max-w-2xl backdrop-blur-sm">
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-sans mb-4">
              Mais do que um aplicativo, a UBT nasce como um movimento de valorização do trabalhador local. Estamos calibrando os últimos detalhes técnicos e regulatórios para entregar uma plataforma ágil, justa e construída para quem vive e move a nossa cidade — de ponta a ponta, do Perequê-Açú ao Maranduba, da serra ao mar.
            </p>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-sans">
              Aqui, o dinheiro circula onde deve: dentro da comunidade caiçara, fortalecendo ambulantes, mototaxistas, diaristas, pequenos comerciantes e famílias da região. Você, como membro fundador, tem papel central nessa história.
            </p>
          </div>
        </section>

        {/* Loading inicial de verificação de autenticação */}
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-green animate-spin" />
            <span className="text-xs font-mono text-white/50 tracking-wider">
              Verificando credenciais de fundador...
            </span>
          </div>
        ) : !founder ? (
          /* Seção 2: FORMULÁRIO DE IDENTIFICAÇÃO E LOGIN DIRETO NO SISTEMA */
          <section className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0E1528] border border-white/10 shadow-2xl flex flex-col gap-5 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green/10 border border-green/30 flex items-center justify-center text-green shrink-0">
                  <Lock className="w-5 h-5 text-green" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-white">
                    Acesse seu Espaço de Fundador
                  </h2>
                  <p className="text-xs text-white/50 font-sans">
                    Informe seu E-mail ou CPF e sua senha cadastrada.
                  </p>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 mt-1">
                <div>
                  <label
                    htmlFor="hub-identificador"
                    className="block text-xs font-mono text-white/60 uppercase tracking-widest mb-1.5 pl-1"
                  >
                    E-mail ou CPF
                  </label>
                  <input
                    id="hub-identificador"
                    type="text"
                    value={identifier}
                    onChange={handleIdentifierChange}
                    placeholder="Digite seu e-mail ou CPF"
                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-green text-white text-sm outline-none transition-all placeholder:text-white/30 font-sans"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 pl-1">
                    <label
                      htmlFor="hub-senha"
                      className="block text-xs font-mono text-white/60 uppercase tracking-widest"
                    >
                      Senha
                    </label>
                    <Link
                      to="/recuperar-senha"
                      className="text-[11px] text-green hover:underline font-mono"
                    >
                      Esqueci a senha
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="hub-senha"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (loginError) setLoginError("");
                      }}
                      placeholder="Sua senha de acesso"
                      className="w-full pl-4 pr-11 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-green text-white text-sm outline-none transition-all placeholder:text-white/30 font-sans"
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

                {loginError && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn || !identifier.trim() || !password.trim()}
                  className="w-full py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-green hover:bg-green-dark text-navy flex items-center justify-center gap-2 shadow-lg shadow-green/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-1"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-navy" />
                      <span>Validando acesso...</span>
                    </>
                  ) : (
                    <span>Acessar Painel do Fundador</span>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-white/5 text-center flex flex-col gap-1.5">
                <span className="text-xs text-white/40 font-sans">
                  Ainda não fez sua inscrição pioneira?
                </span>
                <Link
                  to="/#cadastro-fundadores-cap"
                  className="text-xs text-green hover:text-green-dark font-bold underline underline-offset-4 font-sans"
                >
                  Quero ser um Fundador agora
                </Link>
              </div>
            </div>
          </section>
        ) : (
          /* Seção 3: PROGRAMA PADRINHO & MADRINHA (PAINEL DO FUNDADOR AUTENTICADO) */
          <section className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Card de Boas-Vindas */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0DB87E]/20 via-[#005BFF]/10 to-transparent border border-[#0DB87E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-green/20 border border-green/40 flex items-center justify-center text-green shrink-0 shadow-lg">
                  <Award className="w-6 h-6 text-green" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-green font-semibold">
                      Fundador(a) Confirmado(a)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-green/10 text-green text-[10px] font-mono border border-green/20">
                      PIONEIRO
                    </span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    Olá, {founder.nome.split(" ")[0]}! 🎉
                  </h2>
                </div>
              </div>
            </div>

            {/* Mecânica do Programa Padrinho & Madrinha */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0B1329] border border-white/10 flex flex-col gap-6">
              <div>
                <span className="text-xs font-mono text-green uppercase tracking-widest font-semibold block mb-1">
                  Programa de Apadrinhamento
                </span>
                <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
                  Sua Rede de Fundador: Cresça Conosco
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                    0,5%
                  </div>
                  <h4 className="font-display font-bold text-sm text-white">Comissão Direta Vitalícia</h4>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Você recebe 0,5% do valor de cada corrida, entrega ou serviço contratado pelos usuários que ingressarem com seu link.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center text-green">
                    <TrendingUp className="w-4 h-4 text-green" />
                  </div>
                  <h4 className="font-display font-bold text-sm text-white">Fundo Coletivo de Ubatuba</h4>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    Cada movimentação também alimenta o fundo compartilhado da cidade, fortalecendo associações locais de trabalhadores.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="font-display font-bold text-sm text-white">Vínculo Permanente</h4>
                  <p className="text-xs text-white/60 font-sans leading-relaxed">
                    A indicação fica gravada em definitivo na blockchain de regras do Superapp. Você cresce junto com a nossa cidade.
                  </p>
                </div>
              </div>

              {/* Área de Customização do Link (Vanity Slug) */}
              <div className="mt-2 p-5 sm:p-6 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-mono text-white/50 uppercase tracking-wider block">
                      Seu Link Exclusivo de Indicação:
                    </label>
                    <span className="text-[11px] text-white/40 font-sans">
                      Compartilhe com prestadores, vizinhos e turistas.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingSlug(!isEditingSlug);
                      setSlugError("");
                      setSlugSuccess("");
                    }}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-green/30 bg-green/10 hover:bg-green/20 text-green font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingSlug ? "Fechar Edição" : "Personalizar Link"}</span>
                  </button>
                </div>

                {/* Exibição do Link e Ações */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    readOnly
                    value={getReferralUrl()}
                    className="flex-1 px-4 py-3 rounded-xl bg-black/80 border border-white/10 text-white text-xs sm:text-sm font-mono select-all outline-none text-ellipsis overflow-hidden"
                  />

                  <div className="flex items-center gap-2">
                    {/* Botão de Cópia Rápida */}
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/10 cursor-pointer active:scale-95"
                      aria-label="Copiar link"
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

                    {/* Botão de Ação Direta para WhatsApp (apenas ícone oficial + "Enviar") */}
                    <a
                      href={whatsAppShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent("founder_hub_whatsapp_send", "marketing", { id: founder.id })}
                      className="flex-1 sm:flex-initial px-5 py-3 rounded-xl font-display font-bold text-xs tracking-wider uppercase bg-[#25D366] hover:bg-[#20bd5a] text-black shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      title="Enviar via WhatsApp"
                    >
                      <WhatsAppIcon className="w-4 h-4 text-black shrink-0" />
                      <span>Enviar</span>
                    </a>
                  </div>
                </div>

                {/* Painel Expansível de Edição do Vanity Slug */}
                {isEditingSlug && (
                  <div className="mt-3 p-4 rounded-xl bg-[#0E1528] border border-green/30 flex flex-col gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-green uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-green" />
                        Personalize seu Código (Vanity URL)
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">
                        Apenas minúsculas, números e hífens
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={customSlug}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                            setCustomSlug(val);
                            setSlugError("");
                            setSlugSuccess("");
                          }}
                          placeholder="ex: pousada-brisa ou seu-nome"
                          maxLength={30}
                          className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs font-mono outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingSlug || !customSlug.trim()}
                          onClick={handleSaveCustomSlug}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isSavingSlug ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-navy" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsEditingSlug(false)}
                          className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-sans transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {slugError && (
                      <p className="text-xs text-red-400 font-sans flex items-center gap-1">
                        <span>⚠</span> {slugError}
                      </p>
                    )}

                    {slugSuccess && (
                      <p className="text-xs text-green font-sans flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {slugSuccess}
                      </p>
                    )}

                    <p className="text-[11px] text-white/40 font-mono">
                      Prévia do seu link: {getAppOrigin() || window.location.origin}/cadastro?ref={customSlug || "seu-codigo"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Rodapé Simples */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-4 text-center text-xs text-white/40 font-mono">
        UBT Serviços • O Superapp da Praia • Ubatuba, SP
      </footer>
    </div>
  );
}
