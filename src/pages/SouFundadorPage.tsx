import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  AlertCircle,
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileCheck2,
  Handshake,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";
import { trackEvent } from "@/services/AnalyticsService";
import { maskCPF, maskCNPJ, isValidEmail } from "@/utils/masks";
import { toast } from "sonner";

interface FounderProfile {
  id: string;
  nome: string;
  razao_social: string | null;
  tipo_pessoa: "PF" | "PJ";
  role: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  cnpj: string | null;
  referral_code: string;
  cadastro_completo: boolean;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  possui_chave_pix: boolean;
}

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

function sanitizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
}

export default function SouFundadorPage() {
  const navigate = useNavigate();

  // Estado de sessão e perfil real (fonte única: public.usuarios via get_my_cadastral_profile)
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<FounderProfile | null>(null);

  // Login unificado: PF (E-mail ou CPF + Senha) | Entidade/PJ (CNPJ + Senha)
  const [authMode, setAuthMode] = useState<"PF" | "PJ">("PF");
  const [pfIdentifier, setPfIdentifier] = useState("");
  const [pjCnpj, setPjCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<"password_reset" | "magic_link">("password_reset");
  const [showGoogleOption, setShowGoogleOption] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  // Customizador de Slug & Cópia
  const [slugInput, setSlugInput] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [slugSavedFeedback, setSlugSavedFeedback] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadAuthenticatedProfile = useCallback(
    async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }) => {
      try {
        const { data: rpcProfile, error: rpcErr } = await supabase.rpc("get_my_cadastral_profile");

        let row: any = !rpcErr && rpcProfile && typeof rpcProfile === "object" ? rpcProfile : null;

        if (!row) {
          const { data: directRow } = await supabase
            .from("usuarios")
            .select(
              "id, nome, razao_social, tipo_pessoa, role, email, telefone, cpf, cnpj, referral_code, cadastro_completo, chave_pix, tipo_chave_pix, metadata",
            )
            .eq("id", authUser.id)
            .maybeSingle();
          row = directRow;
        }

        if (!row) {
          const fallbackName =
            String(authUser.user_metadata?.nome || authUser.user_metadata?.full_name || "").trim() ||
            String(authUser.email || "").split("@")[0] ||
            "Fundador UBT";
          const fallbackSlug = sanitizeSlugInput(fallbackName).replace(/^-+|-+$/g, "") || "fundador";
          setProfile({
            id: authUser.id,
            nome: fallbackName,
            razao_social: null,
            tipo_pessoa: "PF",
            role: "tomador",
            email: authUser.email || "",
            telefone: null,
            cpf: null,
            cnpj: null,
            referral_code: fallbackSlug,
            cadastro_completo: false,
            chave_pix: null,
            tipo_chave_pix: null,
            possui_chave_pix: false,
          });
          setSlugInput(fallbackSlug);
          return;
        }

        const isPJ =
          String(row.tipo_pessoa || "").toUpperCase() === "PJ" ||
          String(row.role || "").toLowerCase() === "associacao" ||
          ["pj", "associacao"].includes(String(row.metadata?.tipo_cadastro || "").toLowerCase()) ||
          Boolean(String(row.cnpj || "").replace(/\D/g, ""));

        const cadastroCompleto = Boolean(
          row.cadastro_completo === true ||
            row.metadata?.cadastro_completo === true ||
            String(row.metadata?.cadastro_completo || "").toLowerCase() === "true",
        );

        const realName =
          String(row.nome || "").trim() ||
          String(row.razao_social || "").trim() ||
          String(authUser.user_metadata?.nome || authUser.user_metadata?.full_name || "").trim() ||
          String(row.email || authUser.email || "").split("@")[0];

        const realSlug = String(row.referral_code || row.metadata?.referral_code || "").trim();

        setProfile({
          id: row.id || authUser.id,
          nome: realName,
          razao_social: row.razao_social ? String(row.razao_social).trim() : null,
          tipo_pessoa: isPJ ? "PJ" : "PF",
          role: String(row.role || "tomador").toLowerCase(),
          email: String(row.email || authUser.email || "").trim(),
          telefone: row.telefone || null,
          cpf: row.cpf || null,
          cnpj: row.cnpj || null,
          referral_code: realSlug,
          cadastro_completo: cadastroCompleto,
          chave_pix: row.chave_pix || null,
          tipo_chave_pix: row.tipo_chave_pix || null,
          possui_chave_pix: Boolean(row.possui_chave_pix ?? (row.chave_pix && String(row.chave_pix).trim())),
        });
        setSlugInput(realSlug);
      } catch (err) {
        console.error("[SouFundadorPage] Erro ao carregar perfil cadastral:", err);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        setAuthLoading(true);
        // Validação estrita server-side via getUser() + getSession() (nunca confia apenas em cache local)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (active) setProfile(null);
          return;
        }

        const {
          data: { user: verifiedUser },
          error: verifyErr,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (verifyErr || !verifiedUser) {
          await supabase.auth.signOut();
          setProfile(null);
          return;
        }

        await loadAuthenticatedProfile(verifiedUser);
      } catch (err) {
        console.error("[SouFundadorPage] Erro ao verificar sessão:", err);
        if (active) setProfile(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "TOKEN_REFRESHED") && session?.user) {
        void loadAuthenticatedProfile(session.user);
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadAuthenticatedProfile]);

  // Input inteligente PF (E-mail ou CPF)
  const handlePfIdentifierChange = (raw: string) => {
    setLoginError("");
    setRecoveryEmail(null);
    setRecoverySent(false);
    setShowGoogleOption(false);

    const hasLetters = /[a-zA-Z]/.test(raw);
    const onlyDigits = raw.replace(/\D/g, "");
    if (!raw.includes("@") && !hasLetters && onlyDigits.length > 0) {
      setPfIdentifier(maskCPF(raw));
    } else {
      setPfIdentifier(raw);
    }
  };

  const handleSendRecovery = async () => {
    const targetEmail = (recoveryEmail || (pfIdentifier.includes("@") ? pfIdentifier : "")).trim().toLowerCase();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      toast.error("Informe um e-mail válido para receber o link de acesso.");
      return;
    }

    setIsSendingRecovery(true);
    try {
      const origin = getAppOrigin();
      const redirectTo = `${origin}/sou-fundador`;

      if (recoveryMode === "magic_link") {
        const { error } = await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setRecoverySent(true);
        toast.success("Link de acesso enviado para seu e-mail! Verifique sua caixa de entrada.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo });
        if (error) throw error;
        setRecoverySent(true);
        toast.success("Link de criação/redefinição de senha enviado para seu e-mail!");
      }
    } catch (err) {
      console.error("[SouFundadorPage] Erro ao enviar recuperação:", err);
      toast.error("Não foi possível enviar o link agora. Tente entrar com Google ou fale com o suporte.");
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const origin = getAppOrigin();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/sou-fundador` },
      });
      if (error) throw error;
    } catch (err) {
      console.error("[SouFundadorPage] Erro no OAuth Google:", err);
      toast.error("Não foi possível iniciar o acesso com Google.");
      setIsSigningInGoogle(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setRecoveryEmail(null);
    setRecoverySent(false);
    setShowGoogleOption(false);

    if (!password) {
      setLoginError("Digite sua senha de acesso.");
      return;
    }

    setIsLoggingIn(true);

    try {
      let rpcParams: Record<string, string> = {};
      let fallbackEmail = "";

      if (authMode === "PF") {
        const trimmed = pfIdentifier.trim();
        if (!trimmed) {
          setLoginError("Informe seu e-mail ou CPF cadastrado.");
          setIsLoggingIn(false);
          return;
        }

        if (trimmed.includes("@")) {
          if (!isValidEmail(trimmed)) {
            setLoginError("Informe um endereço de e-mail válido.");
            setIsLoggingIn(false);
            return;
          }
          fallbackEmail = trimmed.toLowerCase();
          rpcParams = { p_email: fallbackEmail };
        } else {
          const digits = trimmed.replace(/\D/g, "");
          if (digits.length !== 11) {
            setLoginError("Informe um CPF válido (11 dígitos) ou seu e-mail cadastrado.");
            setIsLoggingIn(false);
            return;
          }
          rpcParams = { p_cpf: digits };
        }
      } else {
        const cleanCnpj = pjCnpj.replace(/\D/g, "");
        if (cleanCnpj.length !== 14) {
          setLoginError("Informe um CNPJ válido com 14 dígitos.");
          setIsLoggingIn(false);
          return;
        }
        rpcParams = { p_cnpj: cleanCnpj };
      }

      const { data: resolved, error: rpcError } = await supabase.rpc(
        "resolve_cadastral_login_email",
        rpcParams,
      );

      let emailToAuth = fallbackEmail;

      if (!rpcError && resolved) {
        const resolvedEmail =
          typeof resolved.email === "string" ? resolved.email.trim().toLowerCase() : "";
        const hasAuth = Boolean(resolved.has_auth_account);
        const hasPwd = Boolean(resolved.has_password);
        const hasLegacy = Boolean(resolved.has_legacy_profile);
        const provider = String(resolved.auth_provider || "").toLowerCase();

        if (!resolvedEmail && !hasAuth && !hasLegacy) {
          setLoginError(
            authMode === "PJ"
              ? "CNPJ não localizado na base da UBT. Confira os números ou fale com o suporte."
              : "Cadastro não localizado com os dados informados. Verifique seu e-mail ou CPF.",
          );
          setIsLoggingIn(false);
          return;
        }

        if (!hasAuth && hasLegacy && resolvedEmail) {
          setRecoveryEmail(resolvedEmail);
          setRecoveryMode("magic_link");
          setShowGoogleOption(resolvedEmail.endsWith("@gmail.com"));
          setLoginError(
            "Encontramos seu cadastro na UBT, mas sua conta ainda não possui senha definida. Solicite o link de acesso abaixo" +
              (resolvedEmail.endsWith("@gmail.com") ? " ou entre com sua conta Google." : "."),
          );
          setIsLoggingIn(false);
          return;
        }

        if (hasAuth && !hasPwd && resolvedEmail) {
          setRecoveryEmail(resolvedEmail);
          setRecoveryMode("password_reset");
          setShowGoogleOption(provider === "google" || resolvedEmail.endsWith("@gmail.com"));
          setLoginError(
            "Sua conta foi criada via Google ou ainda não possui senha definida. Solicite o link de criação de senha abaixo ou entre com sua conta Google.",
          );
          setIsLoggingIn(false);
          return;
        }

        if (resolvedEmail) {
          emailToAuth = resolvedEmail;
        }
      }

      if (!emailToAuth) {
        setLoginError("Não foi possível localizar o e-mail vinculado a este cadastro.");
        setIsLoggingIn(false);
        return;
      }

      let { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (authErr && authErr.message.toLowerCase().includes("email not confirmed")) {
        try {
          await supabase.rpc("confirmar_email_lead", { p_email: emailToAuth });
          const retry = await supabase.auth.signInWithPassword({
            email: emailToAuth,
            password,
          });
          authData = retry.data;
          authErr = retry.error;
        } catch {
          // Segue para tratamento padrão abaixo
        }
      }

      if (authErr || !authData?.user) {
        setRecoveryEmail(emailToAuth);
        setRecoveryMode("password_reset");
        setShowGoogleOption(emailToAuth.endsWith("@gmail.com"));
        setLoginError(
          authMode === "PJ"
            ? "Senha incorreta para este CNPJ. Verifique sua senha ou solicite a redefinição abaixo."
            : "Credenciais incorretas. Verifique sua senha ou solicite a redefinição abaixo.",
        );
        setIsLoggingIn(false);
        return;
      }

      await loadAuthenticatedProfile(authData.user);
      toast.success("Bem-vindo(a) de volta à UBT!");
      trackEvent("founder_unified_login_success", "marketing", {
        userId: authData.user.id,
        mode: authMode,
      });
    } catch (err) {
      console.error("[SouFundadorPage] Erro no login:", err);
      setLoginError("Ocorreu um erro ao validar seu acesso. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPfIdentifier("");
    setPjCnpj("");
    setPassword("");
    setLoginError("");
  };

  // Preview e link oficial de apadrinhamento
  const appOrigin = getAppOrigin();
  const normalizedDraftSlug = sanitizeSlugInput(slugInput).replace(/^-+|-+$/g, "");
  const activeSlug = profile?.referral_code || normalizedDraftSlug || "";
  const previewSlug = normalizedDraftSlug || activeSlug;
  const officialReferralUrl = activeSlug ? `${appOrigin}/cadastro?ref=${activeSlug}` : `${appOrigin}/cadastro`;
  const previewReferralUrl = previewSlug ? `${appOrigin}/cadastro?ref=${previewSlug}` : `${appOrigin}/cadastro`;

  const isSlugDirty = Boolean(profile && normalizedDraftSlug && normalizedDraftSlug !== profile.referral_code);
  const isSlugFormatValid =
    normalizedDraftSlug.length >= 3 &&
    normalizedDraftSlug.length <= 40 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalizedDraftSlug);

  const handleSaveSlug = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;

    setSlugError("");
    setSlugSavedFeedback(false);

    if (normalizedDraftSlug.length < 3 || normalizedDraftSlug.length > 40) {
      setSlugError("O slug deve ter entre 3 e 40 caracteres.");
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalizedDraftSlug)) {
      setSlugError("Use apenas letras minúsculas, números e hífens (sem espaços).");
      return;
    }

    setIsSavingSlug(true);
    try {
      const { data: res, error: rpcErr } = await supabase.rpc("update_my_referral_slug", {
        p_slug: normalizedDraftSlug,
      });

      if (rpcErr) throw rpcErr;

      if (!res?.success) {
        setSlugError(res?.error || "Este slug já está em uso. Escolha outro identificador.");
        return;
      }

      const savedSlug = String(res.slug || normalizedDraftSlug);
      setProfile((prev) => (prev ? { ...prev, referral_code: savedSlug } : prev));
      setSlugInput(savedSlug);
      setSlugSavedFeedback(true);
      toast.success(`Slug @${savedSlug} salvo com sucesso!`);
      trackEvent("founder_unified_slug_saved", "referral", { slug: savedSlug });
      setTimeout(() => setSlugSavedFeedback(false), 3000);
    } catch (err: any) {
      console.error("[SouFundadorPage] Erro ao salvar slug:", err);
      setSlugError(err?.message || "Não foi possível salvar o slug agora.");
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(officialReferralUrl);
      setCopiedLink(true);
      toast.success("Link de apadrinhamento copiado!");
      trackEvent("founder_unified_link_copied", "referral", { slug: activeSlug });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const displayName = profile
    ? profile.tipo_pessoa === "PJ"
      ? profile.razao_social || profile.nome
      : profile.nome
    : "";

  const whatsAppMessage = `Olá! Conheça a UBT, a plataforma local de Ubatuba que conecta moradores, prestadores e entidades.\n\nFaça seu cadastro pelo meu link de apadrinhamento:\n${officialReferralUrl}`;
  const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50 flex flex-col selection:bg-[#00E676] selection:text-zinc-950">
      {/* Glow sutil Dark Gamer / Bets */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[720px] h-[320px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-30 border-b border-zinc-800 bg-[#09090B]/95 backdrop-blur-md sticky top-0 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-xl text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-mono font-medium"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg tracking-wider text-zinc-50">
              UBT <span className="text-[#00E676] text-sm font-sans font-semibold">SERVIÇOS</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          {profile ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121215] border border-zinc-800 text-[11px] font-mono text-zinc-300 max-w-[260px]">
                <span className="w-2 h-2 rounded-full bg-[#00E676] shrink-0" />
                <span className="truncate">{profile.email}</span>
                {["admin", "superadmin", "super_admin"].includes(profile.role) && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold uppercase shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3.5 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Sair desta conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </>
          ) : (
            <Link
              to="/#cadastro-fundadores-cap"
              className="text-xs text-[#00E676] hover:underline font-mono font-semibold"
            >
              Quero ser Fundador
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 my-auto">
            <Loader2 className="w-9 h-9 text-[#00E676] animate-spin" />
            <span className="text-xs font-mono text-zinc-400 tracking-wider">
              Carregando seu espaço de fundador...
            </span>
          </div>
        ) : !profile ? (
          /* ===================================================================== */
          /* LOGIN UNIFICADO: PF (E-mail ou CPF + Senha) | ENTIDADE PJ (CNPJ+Senha)*/
          /* ===================================================================== */
          <section className="w-full max-w-md mx-auto my-auto flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#00E676] text-[11px] font-mono uppercase tracking-widest font-semibold mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Área do Fundador • UBT</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-50 tracking-tight">
                Acesse seu Espaço UBT
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-1.5 max-w-sm">
                {authMode === "PF"
                  ? "Entre com seu e-mail ou CPF e sua senha para acessar seu link de apadrinhamento."
                  : "Entre com o CNPJ da entidade e a senha cadastrada."}
              </p>
            </div>

            <form
              onSubmit={handleLoginSubmit}
              className="p-6 sm:p-8 rounded-3xl bg-[#121215] border border-zinc-800 shadow-2xl flex flex-col gap-5"
            >
              {/* Seletor PF vs Entidade/PJ */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#09090B] border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("PF");
                    setLoginError("");
                    setRecoveryEmail(null);
                    setRecoverySent(false);
                    setShowGoogleOption(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === "PF"
                      ? "bg-emerald-500/15 text-[#00E676] border border-emerald-500/40"
                      : "text-zinc-400 hover:text-zinc-100 border border-transparent"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Pessoa Física</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("PJ");
                    setLoginError("");
                    setRecoveryEmail(null);
                    setRecoverySent(false);
                    setShowGoogleOption(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === "PJ"
                      ? "bg-emerald-500/15 text-[#00E676] border border-emerald-500/40"
                      : "text-zinc-400 hover:text-zinc-100 border border-transparent"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Entidade / PJ</span>
                </button>
              </div>

              {authMode === "PF" ? (
                <div>
                  <label
                    htmlFor="founder-pf-id"
                    className="block text-xs font-mono text-zinc-300 uppercase tracking-wider mb-2"
                  >
                    E-mail ou CPF:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="founder-pf-id"
                      type="text"
                      value={pfIdentifier}
                      onChange={(e) => handlePfIdentifierChange(e.target.value)}
                      placeholder="seu.email@exemplo.com ou 000.000.000-00"
                      autoComplete="username"
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#09090B] border border-zinc-800 focus:border-[#00E676] text-zinc-50 text-sm outline-none transition-colors placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="founder-pj-cnpj"
                    className="block text-xs font-mono text-zinc-300 uppercase tracking-wider mb-2"
                  >
                    CNPJ da Entidade:
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="founder-pj-cnpj"
                      type="text"
                      inputMode="numeric"
                      value={pjCnpj}
                      onChange={(e) => {
                        setPjCnpj(maskCNPJ(e.target.value));
                        setLoginError("");
                      }}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#09090B] border border-zinc-800 focus:border-[#00E676] text-zinc-50 text-sm font-mono outline-none transition-colors placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="founder-password"
                    className="block text-xs font-mono text-zinc-300 uppercase tracking-wider"
                  >
                    Senha:
                  </label>
                  <Link
                    to="/recuperar-senha"
                    className="text-[11px] font-mono text-[#00E676] hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="founder-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    placeholder="Digite sua senha de acesso"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#09090B] border border-zinc-800 focus:border-[#00E676] text-zinc-50 text-sm font-mono outline-none transition-colors placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-xs text-red-300 flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <span>{loginError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recoveryEmail && !recoverySent && (
                      <button
                        type="button"
                        disabled={isSendingRecovery}
                        onClick={() => void handleSendRecovery()}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-[#00E676] text-zinc-50 hover:text-[#00E676] text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSendingRecovery ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>
                              {recoveryMode === "magic_link"
                                ? "Enviar link de acesso por e-mail"
                                : "Enviar link para criar/redefinir senha"}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    {showGoogleOption && (
                      <button
                        type="button"
                        disabled={isSigningInGoogle}
                        onClick={() => void handleGoogleSignIn()}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSigningInGoogle ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Conectando...</span>
                          </>
                        ) : (
                          <span>Entrar com Google</span>
                        )}
                      </button>
                    )}
                  </div>
                  {recoverySent && (
                    <span className="text-[#00E676] text-[11px] font-semibold">
                      Link enviado! Verifique sua caixa de entrada e spam.
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 rounded-xl bg-[#00E676] hover:bg-[#10B981] text-zinc-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-zinc-950" />
                    <span>Entrar no Espaço do Fundador</span>
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-zinc-800 text-center flex flex-col gap-2">
                <Link
                  to="/atualizacao-cadastral"
                  className="text-xs text-[#00E676] hover:underline font-mono font-semibold"
                >
                  Precisa atualizar seu cadastro? Acesse a Atualização Cadastral →
                </Link>
                <Link
                  to="/#cadastro-fundadores-cap"
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
                >
                  Ainda não se cadastrou? Quero ser Fundador
                </Link>
              </div>
            </form>
          </section>
        ) : (
          /* ===================================================================== */
          /* PÁGINA ÚNICA UNIFICADA DO FUNDADOR / MEMBRO (5 BLOCOS EXATOS)         */
          /* ===================================================================== */
          <div className="flex flex-col gap-5 animate-in fade-in duration-300">
            {/* BLOCO 1 — BOAS-VINDAS PERSONALIZADAS */}
            <section className="p-6 rounded-3xl bg-[#121215] border border-zinc-800 shadow-xl flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[#00E676] text-[11px] font-mono uppercase tracking-wider font-bold">
                  <Award className="w-3.5 h-3.5" />
                  Membro Fundador
                </span>
                {profile.tipo_pessoa === "PJ" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-mono uppercase tracking-wider font-semibold">
                    <Building2 className="w-3 h-3 text-[#00E676]" />
                    Entidade / PJ
                  </span>
                )}
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-50 tracking-tight leading-tight m-0">
                Olá, {displayName}!
              </h1>
              <p className="text-sm text-zinc-400 font-sans m-0">
                Bem-vindo(a) ao seu painel oficial da UBT. Gerencie seu identificador de apadrinhamento e compartilhe seu convite.
              </p>
            </section>

            {/* BLOCO 2 — BOTÃO CONDICIONAL DE ATUALIZAÇÃO CADASTRAL (APENAS SE cadastro_completo === false) */}
            {!profile.cadastro_completo && (
              <section className="p-6 rounded-3xl bg-[#121215] border-2 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.12)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-[#00E676] shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-zinc-50 m-0">
                      Finalize sua Atualização Cadastral
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 mb-0 leading-relaxed">
                      Complete suas informações de bairros, atuação e dados de recebimento para deixar seu perfil 100% pronto na plataforma.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/atualizacao-cadastral", { state: { fromSouFundador: true } })
                  }
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#00E676] hover:bg-[#10B981] text-zinc-950 font-display font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-zinc-950" />
                  <span>Completar Atualização Cadastral</span>
                </button>
              </section>
            )}

            {/* BLOCO 3 — BREVE EXPLICAÇÃO SOBRE O APADRINHAMENTO (SEM DADOS FINANCEIROS) */}
            <section className="p-6 rounded-3xl bg-[#121215] border border-zinc-800 flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00E676] shrink-0">
                <Handshake className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display font-bold text-base sm:text-lg text-zinc-50 m-0">
                  Como funciona o Apadrinhamento UBT
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed m-0">
                  Compartilhe seu link exclusivo com amigos, prestadores, moradores e entidades de Ubatuba. Todo novo cadastro realizado através do seu link fica automaticamente vinculado ao seu perfil na comunidade fundadora da UBT.
                </p>
              </div>
            </section>

            {/* BLOCO 4 — CUSTOMIZADOR DE SLUG DE APADRINHAMENTO */}
            <section className="p-6 rounded-3xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-5 h-5 text-[#00E676]" />
                <div>
                  <h2 className="font-display font-bold text-base sm:text-lg text-zinc-50 m-0">
                    Seu Slug de Apadrinhamento
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans m-0">
                    Personalize o identificador do seu link oficial de convite.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSlug} className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex items-center rounded-xl bg-[#09090B] border border-zinc-800 focus-within:border-[#00E676] px-3.5 transition-colors">
                  <span className="font-mono text-sm text-zinc-500 select-none mr-1">@</span>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugInput(sanitizeSlugInput(e.target.value));
                      setSlugError("");
                      setSlugSavedFeedback(false);
                    }}
                    placeholder="seu-slug-aqui"
                    maxLength={40}
                    className="flex-1 py-3 bg-transparent font-mono text-sm text-zinc-50 font-semibold outline-none placeholder:text-zinc-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingSlug || !isSlugFormatValid || !isSlugDirty}
                  className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#00E676] text-zinc-950 font-display font-extrabold text-xs uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSavingSlug ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-zinc-950" />
                      <span>Salvar Slug</span>
                    </>
                  )}
                </button>
              </form>

              {slugError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/35 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{slugError}</span>
                </div>
              )}

              {slugSavedFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-xs text-[#00E676] flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Slug atualizado com sucesso! Seu link oficial já está ativo.</span>
                </div>
              )}

              {/* Preview em tempo real da URL oficial */}
              <div className="p-3.5 rounded-xl bg-[#09090B] border border-zinc-800 flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Preview da URL Oficial de Apadrinhamento
                </span>
                <span className="font-mono text-xs sm:text-sm text-[#00E676] font-semibold break-all select-all">
                  {previewReferralUrl}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-500 m-0">
                Use entre 3 e 40 caracteres: apenas letras minúsculas, números e hífens.
              </p>
            </section>

            {/* BLOCO 5 — COMPARTILHAMENTO VIA WHATSAPP + COPIAR LINK */}
            <section className="p-6 rounded-3xl bg-[#121215] border border-zinc-800 flex flex-col gap-3">
              <a
                href={whatsAppShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("founder_unified_whatsapp_share", "referral", { slug: activeSlug })
                }
                className="w-full py-4 px-6 rounded-2xl bg-[#00E676] hover:bg-[#10B981] text-zinc-950 font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(0,230,118,0.28)] transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <WhatsAppIcon className="w-5 h-5 text-zinc-950" />
                <span>Compartilhar no WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="w-full py-3.5 px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-50 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-[#00E676]" />
                    <span className="text-[#00E676]">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-300" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
