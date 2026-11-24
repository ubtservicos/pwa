import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  User,
  Building2,
  MapPin,
  Waves,
  Wallet,
  Share2,
  Copy,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  Handshake,
  Mail,
  KeyRound
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  maskPhone,
  maskCPF,
  maskCNPJ,
  applyPixMask,
  getPixPlaceholder,
  isValidCPF,
  isValidCNPJ,
  isValidEmail,
  generateReferralSlug
} from "@/utils/masks";
import { trackEvent } from "@/services/AnalyticsService";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  BAIRROS_LIST,
  BAIRROS_COM_OUTRA_CIDADE_LIST,
  BAIRROS_RESIDENCIA_LIST,
  BAIRROS_ATUACAO_LIST,
  BAIRROS_HOSPEDAGEM_LIST,
  PRAIAS_LIST,
  REGIOES_UBATUBA,
  normalizePerfilList
} from "@/components/FounderForm";

export {
  BAIRROS_LIST,
  BAIRROS_COM_OUTRA_CIDADE_LIST,
  BAIRROS_RESIDENCIA_LIST,
  BAIRROS_ATUACAO_LIST,
  BAIRROS_HOSPEDAGEM_LIST,
  PRAIAS_LIST,
  REGIOES_UBATUBA
};

type WizardStep = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, title: "Dados Pessoais", icon: User },
  { id: 2, title: "Bairros", icon: MapPin },
  { id: 3, title: "Praias", icon: Waves },
  { id: 4, title: "Financeiro & Indicação", icon: Wallet },
];

export default function AtualizacaoCadastral() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados de Autenticação e Carregamento Cadastral (PF: E-mail+Senha | PJ: CNPJ+Senha)
  const [lookupState, setLookupState] = useState<"loading" | "auth" | "wizard">("loading");
  const [authMode, setAuthMode] = useState<"PF" | "PJ">("PF");
  const [authEmail, setAuthEmail] = useState("");
  const [authCnpj, setAuthCnpj] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [hintPhone, setHintPhone] = useState("");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [leadRecord, setLeadRecord] = useState<any>(null);

  // Estado de Padrinho de Entrada
  const [padrinhoNome, setPadrinhoNome] = useState<string | null>(null);

  // Estado de Desbloqueio do Wizard
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Estado do Wizard
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Etapa 1: Dados Pessoais
  const [isPersonalUnlocked, setIsPersonalUnlocked] = useState(false);
  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">("PF");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsavelLegal, setResponsavelLegal] = useState("");
  const [cpfResponsavel, setCpfResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [step1Error, setStep1Error] = useState("");

  // Etapa 2: Bairros & Geografia
  const [bairroResidencia, setBairroResidencia] = useState("");
  const [bairrosAtuacao, setBairrosAtuacao] = useState<string[]>([]);
  const [searchBairroAtuacao, setSearchBairroAtuacao] = useState("");
  // Novos estados PJ
  const [bairroMatriz, setBairroMatriz] = useState("");
  const [bairrosFiliais, setBairrosFiliais] = useState<string[]>([]);
  const [searchBairroFilial, setSearchBairroFilial] = useState("");
  const [regioesAtuacao, setRegioesAtuacao] = useState<string[]>([]);
  const [step2Error, setStep2Error] = useState("");

  // Etapa 3: Praias
  const [praias, setPraias] = useState<string[]>([]);
  const [searchPraia, setSearchPraia] = useState("");
  const [naoAtuaPraias, setNaoAtuaPraias] = useState(false);

  // Detecção se o cadastro atual é PJ
  const isPJ = useMemo(() => {
    return Boolean(
      tipoPessoa === "PJ" ||
      leadRecord?.cnpj ||
      leadRecord?.tipo_cadastro === "pj" ||
      leadRecord?.tipo_cadastro === "PJ" ||
      leadRecord?.tipo_cadastro === "associacao" ||
      leadRecord?.razao_social
    );
  }, [tipoPessoa, leadRecord]);

  // Etapa 4: Financeiro & Indicação
  const [possuiMercadoPago, setPossuiMercadoPago] = useState<boolean>(true);
  const [tipoChavePix, setTipoChavePix] = useState<string>("telefone");
  const [chavePix, setChavePix] = useState("");
  const [referralSlug, setReferralSlug] = useState("");
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [step4Error, setStep4Error] = useState("");

  // URL Base Oficial para Links de Apadrinhamento
  const getReferralBaseUrl = () => {
    const origin = typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://ubtservicos.vercel.app";
    return `${origin}/?ref=`;
  };

  const getFullReferralLink = () => {
    const origin = typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://ubtservicos.vercel.app";
    return `${origin}/?ref=${referralSlug || "fundador-ubatuba"}#cadastro-fundadores-cap`;
  };

  // Preenche todos os estados do Wizard a partir do lead completo
  const populateWizardFromLead = (leadData: any, rawQueryPhone: string) => {
    setLeadRecord(leadData);

    const isPJLead = Boolean(
      leadData.tipo_pessoa === "PJ" ||
      leadData.cnpj ||
      leadData.tipo_cadastro === "pj" ||
      leadData.tipo_cadastro === "PJ" ||
      leadData.tipo_cadastro === "associacao" ||
      leadData.razao_social
    );

    setTipoPessoa(isPJLead ? "PJ" : "PF");
    setNome(leadData.nome || "");
    setCpf(leadData.cpf ? maskCPF(leadData.cpf) : "");
    setRazaoSocial(leadData.razao_social || leadData.nome || "");
    setCnpj(leadData.cnpj ? maskCNPJ(leadData.cnpj) : "");
    setResponsavelLegal(leadData.responsavel_legal || "");
    setCpfResponsavel(
      leadData.cpf_responsavel 
        ? maskCPF(leadData.cpf_responsavel) 
        : (leadData.responsavel_cpf ? maskCPF(leadData.responsavel_cpf) : "")
    );
    setTelefone(leadData.telefone ? maskPhone(leadData.telefone) : maskPhone(rawQueryPhone));
    setEmail(leadData.email || "");

    // Bairros
    const bResidenciaSalvo = leadData.bairro_residencia
      || leadData.bairro_moradia
      || (Array.isArray(leadData.bairros) && leadData.bairros.length > 0 ? leadData.bairros[0] : (leadData.bairro_hospedagem || ""));
    setBairroResidencia(bResidenciaSalvo || "");
    setBairroMatriz(leadData.bairro_matriz || bResidenciaSalvo || "");
    setBairrosFiliais(Array.isArray(leadData.bairros_filiais) ? leadData.bairros_filiais : []);
    setRegioesAtuacao(Array.isArray(leadData.regioes_atuacao) ? leadData.regioes_atuacao : (Array.isArray(leadData.regioes) ? leadData.regioes : []));

    const bairrosTrabList: string[] = leadData.bairro_trabalho
      ? leadData.bairro_trabalho.split(",").map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(leadData.bairros_atuacao) ? leadData.bairros_atuacao : []);
    setBairrosAtuacao(bairrosTrabList);

    // Praias
    const praiasList: string[] = Array.isArray(leadData.praias_frequenta)
      ? leadData.praias_frequenta
      : (Array.isArray(leadData.praias) ? leadData.praias : []);
    const leadNaoAtuaPraias = Boolean(leadData.nao_atua_praias);
    setNaoAtuaPraias(leadNaoAtuaPraias);
    setPraias(leadNaoAtuaPraias ? [] : praiasList);

    // Financeiro
    setPossuiMercadoPago(
      typeof leadData.possui_conta_mercado_pago === "boolean"
        ? leadData.possui_conta_mercado_pago
        : (typeof leadData.possui_mercado_pago === "boolean" ? leadData.possui_mercado_pago : true)
    );
    setTipoChavePix(leadData.tipo_chave_pix || leadData.pix_tipo || "telefone");
    setChavePix(
      leadData.chave_pix || leadData.pix_chave
        ? applyPixMask(leadData.chave_pix || leadData.pix_chave, leadData.tipo_chave_pix || leadData.pix_tipo || "telefone")
        : (leadData.telefone ? maskPhone(leadData.telefone) : "")
    );

    // Resolução do Padrinho de Entrada
    if (leadData.padrinho_id) {
      supabase
        .from("usuarios")
        .select("nome")
        .eq("id", leadData.padrinho_id)
        .maybeSingle()
        .then(({ data: padrinho }) => {
          if (padrinho?.nome) setPadrinhoNome(padrinho.nome);
        });
    } else {
      setPadrinhoNome(null);
    }

    // Referral Slug
    const savedSlug = leadData.referral_code || leadData.referral_slug || leadData.slug || "";
    if (savedSlug) {
      setReferralSlug(savedSlug);
    } else {
      const generated = generateReferralSlug(leadData.nome || leadData.razao_social, leadData.cpf || leadData.cnpj || leadData.id);
      setReferralSlug(generated);
    }
  };

  // Carrega dados cadastrais do usuário autenticado a partir de public.usuarios + complemento opcional em waitlist
  const loadAuthenticatedProfile = async (
    authUser: { id: string; email?: string | null; user_metadata?: Record<string, any> },
    fallbackPhone = "",
  ) => {
    setAuthUserId(authUser.id);
    const normalizedEmail = (authUser.email || "").trim().toLowerCase();

    const { data: usuarioRow } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    let waitlistRow: any = null;
    try {
      if (normalizedEmail) {
        const { data: wlByEmail } = await supabase
          .from("waitlist")
          .select("*")
          .ilike("email", normalizedEmail)
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (wlByEmail) waitlistRow = wlByEmail;
      }

      if (!waitlistRow) {
        const rawPhoneDigits = (usuarioRow?.telefone || fallbackPhone || "").replace(/\D/g, "");
        if (rawPhoneDigits.length >= 8) {
          const last8 = rawPhoneDigits.slice(-8);
          const { data: wlByPhone } = await supabase
            .from("waitlist")
            .select("*")
            .or(`telefone.eq.${rawPhoneDigits},telefone.ilike.%${last8}%`)
            .order("created_at_utc", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (wlByPhone) waitlistRow = wlByPhone;
        }
      }
    } catch {
      // Waitlist é complemento opcional — nunca bloqueia o carregamento
    }

    const uMeta = (usuarioRow?.metadata && typeof usuarioRow.metadata === "object")
      ? usuarioRow.metadata
      : {};

    const isPJAccount = Boolean(
      String(usuarioRow?.tipo_pessoa || "").toUpperCase() === "PJ" ||
      String(usuarioRow?.role || "").toLowerCase() === "associacao" ||
      String(uMeta?.tipo_cadastro || "").toLowerCase() === "pj" ||
      String(uMeta?.tipo_cadastro || "").toLowerCase() === "associacao" ||
      usuarioRow?.cnpj ||
      waitlistRow?.cnpj ||
      String(waitlistRow?.tipo_pessoa || "").toUpperCase() === "PJ" ||
      ["pj", "associacao"].includes(String(waitlistRow?.tipo_cadastro || "").toLowerCase()),
    );

    const mergedLead: Record<string, any> = {
      ...(waitlistRow || {}),
      ...(usuarioRow || {}),
      id: waitlistRow?.id || null,
      waitlist_id: waitlistRow?.id || null,
      usuario_id: authUser.id,
      email: usuarioRow?.email || normalizedEmail || waitlistRow?.email || "",
      nome:
        usuarioRow?.nome ||
        waitlistRow?.nome ||
        authUser.user_metadata?.nome ||
        authUser.user_metadata?.full_name ||
        "",
      razao_social:
        usuarioRow?.razao_social ||
        waitlistRow?.razao_social ||
        (isPJAccount ? usuarioRow?.nome : "") ||
        "",
      tipo_pessoa: isPJAccount ? "PJ" : "PF",
      cpf: usuarioRow?.cpf || waitlistRow?.cpf || "",
      cnpj: usuarioRow?.cnpj || waitlistRow?.cnpj || "",
      responsavel_legal: usuarioRow?.responsavel_legal || waitlistRow?.responsavel_legal || "",
      cpf_responsavel:
        usuarioRow?.cpf_responsavel ||
        waitlistRow?.cpf_responsavel ||
        waitlistRow?.responsavel_cpf ||
        "",
      telefone: usuarioRow?.telefone || waitlistRow?.telefone || fallbackPhone || "",
      bairro_residencia:
        usuarioRow?.bairro_residencia ||
        usuarioRow?.bairro_moradia ||
        uMeta?.bairro_residencia ||
        waitlistRow?.bairro_residencia ||
        waitlistRow?.bairro_moradia ||
        "",
      bairro_matriz:
        uMeta?.bairro_matriz ||
        waitlistRow?.bairro_matriz ||
        usuarioRow?.bairro_residencia ||
        usuarioRow?.bairro_moradia ||
        "",
      bairros_filiais: Array.isArray(uMeta?.bairros_filiais)
        ? uMeta.bairros_filiais
        : (Array.isArray(waitlistRow?.bairros_filiais) ? waitlistRow.bairros_filiais : []),
      bairros_atuacao: Array.isArray(usuarioRow?.bairros_atuacao) && usuarioRow.bairros_atuacao.length > 0
        ? usuarioRow.bairros_atuacao
        : (Array.isArray(uMeta?.bairros_atuacao) && uMeta.bairros_atuacao.length > 0
            ? uMeta.bairros_atuacao
            : (Array.isArray(waitlistRow?.bairros_atuacao) ? waitlistRow.bairros_atuacao : [])),
      bairro_trabalho: usuarioRow?.bairro_trabalho || waitlistRow?.bairro_trabalho || "",
      regioes_atuacao: Array.isArray(usuarioRow?.regioes) && usuarioRow.regioes.length > 0
        ? usuarioRow.regioes
        : (Array.isArray(uMeta?.regioes_atuacao) && uMeta.regioes_atuacao.length > 0
            ? uMeta.regioes_atuacao
            : (Array.isArray(waitlistRow?.regioes_atuacao) ? waitlistRow.regioes_atuacao : [])),
      praias: Array.isArray(usuarioRow?.praias) && usuarioRow.praias.length > 0
        ? usuarioRow.praias
        : (Array.isArray(uMeta?.praias) && uMeta.praias.length > 0
            ? uMeta.praias
            : (Array.isArray(waitlistRow?.praias) ? waitlistRow.praias : [])),
      nao_atua_praias: Boolean(uMeta?.nao_atua_praias ?? waitlistRow?.nao_atua_praias ?? false),
      possui_conta_mercado_pago:
        typeof usuarioRow?.possui_mercadopago === "boolean"
          ? usuarioRow.possui_mercadopago
          : (typeof waitlistRow?.possui_conta_mercado_pago === "boolean"
              ? waitlistRow.possui_conta_mercado_pago
              : true),
      tipo_chave_pix: usuarioRow?.tipo_chave_pix || waitlistRow?.tipo_chave_pix || "telefone",
      chave_pix: usuarioRow?.chave_pix || waitlistRow?.chave_pix || "",
      referral_code:
        usuarioRow?.referral_code ||
        uMeta?.referral_code ||
        waitlistRow?.referral_code ||
        "",
      padrinho_id: usuarioRow?.padrinho_id || waitlistRow?.padrinho_id || null,
      metadata: uMeta,
    };

    populateWizardFromLead(mergedLead, fallbackPhone || mergedLead.telefone || "");
    setIsUnlocked(true);
    setLookupState("wizard");
  };

  // Envio de link de definição/redefinição de senha para contas legadas sem senha no Auth
  const handleSendPasswordRecovery = async () => {
    const targetEmail = (recoveryEmail || authEmail || "").trim().toLowerCase();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      toast.error("Informe um e-mail válido para receber o link de redefinição.");
      return;
    }
    setIsSendingRecovery(true);
    try {
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://ubtservicos.vercel.app";
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${origin}/atualizacao-cadastral?email=${encodeURIComponent(targetEmail)}`,
      });
      if (error) throw error;
      setRecoverySent(true);
      toast.success("Link de definição/redefinição de senha enviado para seu e-mail!");
    } catch (err) {
      console.error("[AtualizacaoCadastral] Erro ao enviar recuperação de senha:", err);
      toast.error("Não foi possível enviar o e-mail de redefinição agora. Fale com o suporte UBT.");
    } finally {
      setIsSendingRecovery(false);
    }
  };

  // Autenticação direta: PF (E-mail + Senha) ou Entidade/PJ (CNPJ + Senha via RPC segura)
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError("");
    setRecoveryEmail(null);
    setRecoverySent(false);

    if (!authPassword) {
      setAuthError("Por favor, digite sua senha de acesso.");
      return;
    }

    setIsAuthenticating(true);

    try {
      let targetEmail = "";

      if (authMode === "PF") {
        const cleanEmail = authEmail.trim().toLowerCase();
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
          setAuthError("Informe um endereço de e-mail válido.");
          setIsAuthenticating(false);
          return;
        }
        targetEmail = cleanEmail;
      } else {
        const cleanCnpj = authCnpj.replace(/\D/g, "");
        if (cleanCnpj.length !== 14) {
          setAuthError("Informe um CNPJ válido com 14 dígitos.");
          setIsAuthenticating(false);
          return;
        }

        const { data: resolved, error: rpcError } = await supabase.rpc(
          "resolve_cadastral_login_email",
          { p_cnpj: cleanCnpj },
        );

        if (rpcError) {
          console.error("[AtualizacaoCadastral] Erro na RPC resolve_cadastral_login_email:", rpcError);
          setAuthError("Não foi possível consultar o CNPJ no momento. Tente novamente.");
          setIsAuthenticating(false);
          return;
        }

        const resolvedEmail = typeof resolved?.email === "string" ? resolved.email.trim().toLowerCase() : "";
        const hasAuthAccount = Boolean(resolved?.has_auth_account);

        if (!resolvedEmail) {
          setAuthError("CNPJ não localizado na base da UBT. Confira os números ou fale com o suporte.");
          setIsAuthenticating(false);
          return;
        }

        if (!hasAuthAccount) {
          setRecoveryEmail(resolvedEmail);
          setAuthError(
            "Encontramos o cadastro desta entidade, mas ainda não há uma senha definida no acesso UBT. Solicite o link de definição de senha abaixo ou fale com o suporte.",
          );
          setIsAuthenticating(false);
          return;
        }

        targetEmail = resolvedEmail;
      }

      // Autenticação oficial via Supabase Auth
      let { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: authPassword,
      });

      // Fallback defensivo: confirma e-mail pendente no Auth e tenta novamente
      if (signInError && signInError.message.toLowerCase().includes("email not confirmed")) {
        try {
          await supabase.rpc("confirmar_email_lead", { p_email: targetEmail });
          const retry = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: authPassword,
          });
          authData = retry.data;
          signInError = retry.error;
        } catch (rpcErr) {
          console.warn("[AtualizacaoCadastral] Falha no fallback confirmar_email_lead:", rpcErr);
        }
      }

      if (signInError || !authData?.user) {
        console.warn("[AtualizacaoCadastral] Falha no signInWithPassword:", signInError?.message);
        setRecoveryEmail(targetEmail);
        setAuthError(
          authMode === "PJ"
            ? "Senha incorreta para este CNPJ. Verifique sua senha ou solicite a redefinição abaixo."
            : "E-mail ou senha incorretos. Verifique suas credenciais ou solicite a redefinição abaixo.",
        );
        toast.error(
          authMode === "PJ" ? "CNPJ ou senha incorretos." : "E-mail ou senha incorretos.",
        );
        setIsAuthenticating(false);
        return;
      }

      await loadAuthenticatedProfile(authData.user, hintPhone);
      toast.success("Acesso liberado! Confira e atualize seus dados cadastrais.");
      trackEvent("atualizacao_cadastral_authenticated", "security", {
        mode: authMode,
        user_id: authData.user.id,
      });
    } catch (err: any) {
      console.error("[AtualizacaoCadastral] Erro durante autenticação:", err);
      setAuthError("Ocorreu um erro ao validar suas credenciais. Tente novamente.");
      toast.error("Erro ao autenticar.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Inicialização: pré-preenche via ?email=, ?telefone=, ?cnpj= e detecta PF/PJ sem bloquear acesso
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLookupState("loading");
      const rawEmail = (searchParams.get("email") || "").trim().toLowerCase();
      const rawPhoneParam = searchParams.get("tel") || searchParams.get("telefone") || "";
      const rawCnpjParam = (searchParams.get("cnpj") || "").replace(/\D/g, "");
      const rawTipoParam = (searchParams.get("tipo") || "").trim().toLowerCase();

      const telDigits = decodeURIComponent(rawPhoneParam).replace(/\D/g, "");
      const cleanPhone =
        telDigits.startsWith("55") && telDigits.length > 10 ? telDigits.slice(2) : telDigits;

      if (cleanPhone) setHintPhone(cleanPhone);
      if (rawCnpjParam) {
        setAuthCnpj(maskCNPJ(rawCnpjParam));
        setAuthMode("PJ");
      } else if (rawTipoParam === "pj" || rawTipoParam === "entidade") {
        setAuthMode("PJ");
      }

      let resolvedEmail = rawEmail;
      let resolvedTipo: "PF" | "PJ" | null =
        rawCnpjParam || rawTipoParam === "pj" || rawTipoParam === "entidade" ? "PJ" : null;

      if (!resolvedEmail && cleanPhone.length >= 8) {
        try {
          const { data: resolved } = await supabase.rpc("resolve_cadastral_login_email", {
            p_telefone: cleanPhone,
          });
          if (!cancelled && resolved) {
            if (typeof resolved.email === "string" && resolved.email.trim()) {
              resolvedEmail = resolved.email.trim().toLowerCase();
            }
            if (resolved.tipo_pessoa === "PJ" || resolved.tipo_pessoa === "PF") {
              resolvedTipo = resolved.tipo_pessoa;
            }
          }
        } catch {
          // Nunca bloqueia o usuário se a pré-resolução por telefone falhar
        }
      }

      if (cancelled) return;

      if (resolvedEmail) setAuthEmail(resolvedEmail);
      if (resolvedTipo === "PJ") setAuthMode("PJ");
      else if (resolvedTipo === "PF") setAuthMode("PF");

      // Se já houver sessão ativa correspondente ao titular (ou acesso direto sem filtro conflitante), entra no wizard
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const sessionEmail = (session?.user?.email || "").trim().toLowerCase();
        const hasUrlTarget = Boolean(rawEmail || cleanPhone || rawCnpjParam);
        const matchesUrlTarget = Boolean(resolvedEmail && sessionEmail && sessionEmail === resolvedEmail);

        if (session?.user && (!hasUrlTarget || matchesUrlTarget)) {
          await loadAuthenticatedProfile(session.user, cleanPhone);
          return;
        }
      } catch {
        // Fallback defensivo: mostra tela de login
      }

      if (!cancelled) {
        setIsUnlocked(false);
        setLookupState("auth");
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Lista filtrada de bairros para atuação
  const filteredBairrosAtuacao = useMemo(() => {
    const term = searchBairroAtuacao.toLowerCase().trim();
    if (!term) return BAIRROS_LIST;
    return BAIRROS_LIST.filter((b) => b.toLowerCase().includes(term));
  }, [searchBairroAtuacao]);

  // Lista filtrada de praias
  const filteredPraias = useMemo(() => {
    const term = searchPraia.toLowerCase().trim();
    if (!term) return PRAIAS_LIST;
    return PRAIAS_LIST.filter((p) => p.toLowerCase().includes(term));
  }, [searchPraia]);

  // Manipuladores de Toggle de Seleção
  const toggleBairroAtuacao = (bairro: string) => {
    setBairrosAtuacao((prev) =>
      prev.includes(bairro) ? prev.filter((b) => b !== bairro) : [...prev, bairro]
    );
  };

  // Lista filtrada de bairros para filiais (PJ)
  const filteredBairrosFiliais = useMemo(() => {
    const term = searchBairroFilial.toLowerCase().trim();
    if (!term) return BAIRROS_LIST;
    return BAIRROS_LIST.filter((b) => b.toLowerCase().includes(term));
  }, [searchBairroFilial]);

  const toggleBairroFilial = (bairro: string) => {
    setBairrosFiliais((prev) =>
      prev.includes(bairro) ? prev.filter((b) => b !== bairro) : [...prev, bairro]
    );
  };

  const toggleRegiaoAtuacao = (regiao: string) => {
    setRegioesAtuacao((prev) =>
      prev.includes(regiao) ? prev.filter((r) => r !== regiao) : [...prev, regiao]
    );
  };

  const togglePraia = (praia: string) => {
    if (naoAtuaPraias) return;
    setPraias((prev) =>
      prev.includes(praia) ? prev.filter((p) => p !== praia) : [...prev, praia]
    );
  };

  const handleToggleNaoAtuaPraias = () => {
    setNaoAtuaPraias((prev) => {
      const next = !prev;
      if (next) {
        setPraias([]);
      }
      return next;
    });
  };

  // Sanitizador de Slug do Apadrinhamento (somente minúsculas, números e hífens)
  const handleSlugChange = (raw: string) => {
    const sanitized = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
    setReferralSlug(sanitized);
  };

  const copyReferralLink = async () => {
    const link = getFullReferralLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopiedReferral(true);
      toast.success("Link de apadrinhamento copiado com sucesso! ✓");
      setTimeout(() => setCopiedReferral(false), 2500);
    } catch (e) {
      toast.error("Não foi possível copiar o link.");
    }
  };

  // Disparo Exagerado de Confetes em Primeiro Plano
  const triggerMegaConfetti = () => {
    const count = 250;
    const defaults = {
      origin: { y: 0.6 },
      zIndex: 999999,
    };

    const fire = (particleRatio: number, opts: confetti.Options) => {
      try {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      } catch (e) {}
    };

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ["#00FF66", "#005BFF", "#FFFFFF"],
    });
    fire(0.2, {
      spread: 60,
      colors: ["#00FF66", "#FFD700", "#FF6B00"],
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ["#00FF66", "#00E5FF", "#FFFFFF"],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ["#00FF66", "#FF007A"],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ["#00FF66", "#FFFFFF", "#FFD700"],
    });
  };

  // Validação do Passo 1
  const validateStep1 = (): boolean => {
    setStep1Error("");

    if (isPersonalUnlocked) {
      if (tipoPessoa === "PF") {
        if (!nome.trim() || nome.trim().length < 3) {
          setStep1Error("O nome completo deve ter no mínimo 3 caracteres.");
          return false;
        }
        if (cpf && !isValidCPF(cpf)) {
          setStep1Error("O CPF informado é inválido.");
          return false;
        }
      } else {
        if (!razaoSocial.trim() || razaoSocial.trim().length < 3) {
          setStep1Error("A razão social / nome da entidade é obrigatório.");
          return false;
        }
        if (cnpj && !isValidCNPJ(cnpj)) {
          setStep1Error("O CNPJ informado é inválido.");
          return false;
        }
      }

      if (email && !isValidEmail(email)) {
        setStep1Error("Informe um e-mail válido.");
        return false;
      }
    }

    // Senha (opcional na atualização se já tiver conta, mas se digitou deve ser válida)
    if (senha || confirmarSenha) {
      if (senha.length < 6) {
        setStep1Error("A senha deve ter no mínimo 6 caracteres.");
        return false;
      }
      if (senha !== confirmarSenha) {
        setStep1Error("As senhas informadas não coincidem.");
        return false;
      }
    }

    return true;
  };

  // Validação do Passo 2
  const validateStep2 = (): boolean => {
    setStep2Error("");
    if (isPJ) {
      if (!bairroMatriz) {
        setStep2Error("Por favor, selecione o Bairro da Matriz ou Sede (ou 'Fora do Município').");
        return false;
      }
    } else {
      if (!bairroResidencia) {
        setStep2Error("Por favor, selecione onde você mora (ou 'Em outra cidade').");
        return false;
      }
    }
    return true;
  };

  // Conclusão e Persistência do Wizard
  const handleFinalSubmit = async () => {
    setStep4Error("");

    if (possuiMercadoPago && chavePix) {
      const cleanPix = chavePix.replace(/\D/g, "");
      if (tipoChavePix === "cpf" && !isValidCPF(chavePix)) {
        setStep4Error("Chave Pix CPF inválida.");
        return;
      }
      if (tipoChavePix === "cnpj" && !isValidCNPJ(chavePix)) {
        setStep4Error("Chave Pix CNPJ inválida.");
        return;
      }
      if (tipoChavePix === "email" && !isValidEmail(chavePix)) {
        setStep4Error("Chave Pix E-mail inválida.");
        return;
      }
      if (tipoChavePix === "telefone" && cleanPix.length < 10) {
        setStep4Error("Chave Pix Telefone inválida.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const effectiveMatrizOrResidencia = isPJ ? (bairroMatriz || bairroResidencia) : bairroResidencia;
      const allBairros = isPJ
        ? Array.from(new Set([effectiveMatrizOrResidencia, ...bairrosFiliais, ...bairrosAtuacao].filter(Boolean)))
        : Array.from(new Set([bairroResidencia, ...bairrosAtuacao].filter(Boolean)));

      const rawDigitsTel = (telefone || "").replace(/\D/g, "");
      const cleanCpf = (cpf || "").replace(/\D/g, "");
      const cleanCnpj = (cnpj || "").replace(/\D/g, "");
      const finalSlug = referralSlug || generateReferralSlug(nome || razaoSocial, cleanCpf || cleanCnpj);
      const finalPraias = (isPJ && naoAtuaPraias) ? [] : praias;

      const updatePayload: Record<string, any> = {
        bairro_residencia: effectiveMatrizOrResidencia,
        bairro_moradia: effectiveMatrizOrResidencia,
        bairros_atuacao: bairrosAtuacao,
        bairros: allBairros,
        bairro_trabalho: bairrosAtuacao.join(", "),
        praias: finalPraias,
        praias_frequenta: finalPraias,
        possui_conta_mercado_pago: possuiMercadoPago,
        possui_mercado_pago: possuiMercadoPago,
        tipo_chave_pix: tipoChavePix,
        chave_pix: chavePix,
        referral_code: finalSlug,
        cadastro_completo: true,
        status: (leadRecord?.status === "aprovado" || leadRecord?.status === "approved") ? "aprovado" : "completo",
      };

      if (isPJ) {
        updatePayload.bairro_matriz = effectiveMatrizOrResidencia;
        updatePayload.bairros_filiais = bairrosFiliais;
        updatePayload.regioes_atuacao = regioesAtuacao;
        updatePayload.nao_atua_praias = naoAtuaPraias;
      }

      if (isPersonalUnlocked) {
        if (tipoPessoa === "PF") {
          updatePayload.nome = nome.trim();
          if (cleanCpf) updatePayload.cpf = cleanCpf;
        } else {
          updatePayload.razao_social = razaoSocial.trim();
          updatePayload.nome = razaoSocial.trim();
          if (cleanCnpj) updatePayload.cnpj = cleanCnpj;
          if (responsavelLegal) updatePayload.responsavel_legal = responsavelLegal.trim();
          if (cpfResponsavel) updatePayload.cpf_responsavel = cpfResponsavel.replace(/\D/g, "");
        }
        if (email) updatePayload.email = email.trim().toLowerCase();
        if (rawDigitsTel) updatePayload.telefone = rawDigitsTel;
      }

      // 1. Atualiza na tabela usuarios (fonte principal do usuário autenticado)
      const usuarioUpdatePayload: Record<string, any> = {
        bairro_residencia: effectiveMatrizOrResidencia || null,
        bairro_moradia: effectiveMatrizOrResidencia || null,
        bairro_trabalho: bairrosAtuacao.join(", ") || null,
        bairros_atuacao: bairrosAtuacao,
        praias: finalPraias,
        praias_frequenta: finalPraias.join(", ") || null,
        regioes: isPJ ? regioesAtuacao : undefined,
        referral_code: finalSlug || null,
        chave_pix: chavePix || null,
        tipo_chave_pix: tipoChavePix || null,
        possui_mercadopago: possuiMercadoPago,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(leadRecord?.metadata || {}),
          bairro_residencia: effectiveMatrizOrResidencia,
          bairros_atuacao: bairrosAtuacao,
          praias: finalPraias,
          referral_code: finalSlug,
          cadastro_completo: true,
          atualizado_em: new Date().toISOString(),
          ...(isPJ
            ? {
                tipo_cadastro: "pj",
                bairro_matriz: effectiveMatrizOrResidencia,
                bairros_filiais: bairrosFiliais,
                regioes_atuacao: regioesAtuacao,
                nao_atua_praias: naoAtuaPraias,
              }
            : {}),
        },
      };

      if (isPersonalUnlocked) {
        if (tipoPessoa === "PF") {
          usuarioUpdatePayload.nome = nome.trim();
          if (cleanCpf) usuarioUpdatePayload.cpf = cleanCpf;
        } else {
          usuarioUpdatePayload.razao_social = razaoSocial.trim();
          usuarioUpdatePayload.nome = razaoSocial.trim();
          if (cleanCnpj) usuarioUpdatePayload.cnpj = cleanCnpj;
          if (responsavelLegal) usuarioUpdatePayload.responsavel_legal = responsavelLegal.trim();
          if (cpfResponsavel) usuarioUpdatePayload.cpf_responsavel = cpfResponsavel.replace(/\D/g, "");
        }
        if (rawDigitsTel) usuarioUpdatePayload.telefone = maskPhone(rawDigitsTel);
      }

      if (authUserId) {
        const { error: userErr } = await supabase
          .from("usuarios")
          .update(usuarioUpdatePayload)
          .eq("id", authUserId);

        if (userErr) {
          console.warn("[AtualizacaoCadastral] Erro ao atualizar public.usuarios:", userErr);
          throw userErr;
        }
      }

      // 2. Sincronização complementar na tabela waitlist (quando o usuário possui registro de fundador)
      const waitlistId = leadRecord?.waitlist_id || leadRecord?.id;
      if (waitlistId) {
        try {
          const { error: wlErr } = await supabase
            .from("waitlist")
            .update(updatePayload)
            .eq("id", waitlistId);

          if (wlErr) {
            console.warn("[AtualizacaoCadastral] Aviso no update complementar da waitlist:", wlErr);
          }
        } catch (wlCatchErr) {
          console.warn("[AtualizacaoCadastral] Falha não-bloqueante ao sincronizar waitlist:", wlCatchErr);
        }
      }

      // 3. Atualiza senha no Supabase Auth se fornecida
      if (senha && senha.length >= 6) {
        try {
          await supabase.auth.updateUser({ password: senha });
        } catch (authErr) {
          // Ignorado silenciosamente caso não haja sessão auth ativa
        }
      }

      trackEvent("atualizacao_cadastral_completed", "onboarding", {
        lead_id: leadRecord?.id,
        bairro_residencia: bairroResidencia,
        praias_count: praias.length,
      });

      // Dispara chuva de confetes exagerada em primeiro plano (zIndex 999999)
      triggerMegaConfetti();

      // Toast de Sucesso Verde
      toast.success("Atualização cadastral concluída com sucesso! Bem-vindo à UBT!", {
        duration: 4500,
      });

      // Redireciona imediatamente para a página exclusiva de compartilhamento do link de apadrinhamento
      setTimeout(() => {
        navigate(`/app/indicacao?ref=${encodeURIComponent(finalSlug)}&nome=${encodeURIComponent(nome || razaoSocial)}&tel=${rawDigitsTel}`);
      }, 1500);
    } catch (err: any) {
      console.error("[AtualizacaoCadastral] Erro ao concluir atualização:", err);
      setStep4Error("Ocorreu um erro ao gravar suas informações. Por favor, tente novamente.");
      toast.error("Erro ao concluir atualização cadastral.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-green selection:text-navy pb-28 md:pb-8">
      {/* Glows de Fundo Gamer / Futurista */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00FF66]/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#005BFF]/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Barra de Navegação Superior */}
      <header className="relative z-30 border-b border-zinc-800 bg-black/90 backdrop-blur-md sticky top-0 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-mono font-medium"
            aria-label="Voltar para o início"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg tracking-wider text-white">
              UBT <span className="text-green text-sm font-sans font-semibold">SERVIÇOS</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/sou-fundador"
            className="text-xs text-green hover:underline font-mono font-semibold"
          >
            Já sou Fundador
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
        {/* ========================================================================= */}
        {/* ESTADO 1: CARREGANDO INICIAL */}
        {/* ========================================================================= */}
        {lookupState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-green animate-spin" />
            <span className="text-xs font-mono text-white/60 tracking-wider">
              Preparando ambiente seguro de atualização cadastral...
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ESTADO 2: ACESSO SEGURO (PF: E-MAIL+SENHA | ENTIDADE PJ: CNPJ+SENHA) */}
        {/* ========================================================================= */}
        {lookupState === "auth" && (
          <div className="w-full max-w-md mx-auto flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/40 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-4 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
                <ShieldCheck className="w-4 h-4 text-green" />
                <span>ATUALIZAÇÃO CADASTRAL • ACESSO SEGURO</span>
              </div>

              <div className="w-16 h-16 rounded-2xl bg-black border-2 border-green/40 flex items-center justify-center text-green shadow-[0_0_25px_rgba(0,255,102,0.25)] mb-4">
                {authMode === "PJ" ? (
                  <Building2 className="w-8 h-8 text-green" />
                ) : (
                  <Lock className="w-8 h-8 text-green" />
                )}
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight mb-2">
                Acesse seu Cadastro UBT
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed max-w-sm">
                {authMode === "PF"
                  ? "Entre com seu e-mail e senha cadastrados para revisar e atualizar suas informações."
                  : "Entre com o CNPJ da entidade e a senha cadastrada para atualizar os dados institucionais."}
              </p>
            </div>

            <form
              onSubmit={handleAuthSubmit}
              className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col gap-5"
            >
              {/* Seletor PF vs Entidade / PJ */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("PF");
                    setAuthError("");
                    setRecoveryEmail(null);
                    setRecoverySent(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === "PF"
                      ? "bg-emerald-500/15 text-green border border-green/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Pessoa Física</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("PJ");
                    setAuthError("");
                    setRecoveryEmail(null);
                    setRecoverySent(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMode === "PJ"
                      ? "bg-emerald-500/15 text-green border border-green/40 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Entidade / PJ</span>
                </button>
              </div>

              {/* Campo 1: E-mail (PF) ou CNPJ (PJ) */}
              {authMode === "PF" ? (
                <div>
                  <label className="text-xs font-mono text-white/80 uppercase tracking-wider block mb-2">
                    E-mail Cadastrado:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => {
                        setAuthEmail(e.target.value);
                        setAuthError("");
                      }}
                      placeholder="seu.email@exemplo.com"
                      autoComplete="email"
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-sans outline-none transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-mono text-white/80 uppercase tracking-wider block mb-2 flex items-center justify-between">
                    <span>CNPJ da Entidade:</span>
                    <span className="text-[10px] text-zinc-500 font-sans font-normal">
                      14 dígitos
                    </span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={authCnpj}
                      onChange={(e) => {
                        setAuthCnpj(maskCNPJ(e.target.value));
                        setAuthError("");
                      }}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-mono outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Campo 2: Senha com Toggle */}
              <div>
                <label className="text-xs font-mono text-white/80 uppercase tracking-wider block mb-2">
                  Senha de Acesso:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => {
                      setAuthPassword(e.target.value);
                      setAuthError("");
                    }}
                    placeholder="Digite sua senha cadastrada"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-mono outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex flex-col gap-2.5 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                  {recoveryEmail && !recoverySent && (
                    <button
                      type="button"
                      disabled={isSendingRecovery}
                      onClick={() => void handleSendPasswordRecovery()}
                      className="self-start px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-green/50 text-zinc-100 hover:text-green text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingRecovery ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando link...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          <span>Enviar link para definir/redefinir senha</span>
                        </>
                      )}
                    </button>
                  )}
                  {recoverySent && (
                    <span className="text-emerald-400 text-[11px] font-semibold">
                      Link de redefinição enviado! Verifique sua caixa de entrada e spam.
                    </span>
                  )}
                </div>
              )}

              {/* Botão de Ação CTA */}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green/20 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    <span>Validando acesso...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Entrar e Atualizar Cadastro</span>
                  </>
                )}
              </button>

              {/* Links Auxiliares */}
              <div className="flex flex-col items-center gap-2 pt-2 border-t border-zinc-900 text-center">
                <a
                  href="https://wa.me/5512997168791?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20minha%20senha%20para%20atualiza%C3%A7%C3%A3o%20cadastral%20na%20UBT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-green underline transition-colors font-sans"
                >
                  Esqueceu sua senha ou precisa de ajuda? Fale com o suporte UBT
                </a>
                <Link
                  to="/#cadastro-fundadores-cap"
                  className="text-[11px] font-mono text-zinc-500 hover:text-green transition-colors"
                >
                  Ainda não possui cadastro? Faça sua inscrição aqui
                </Link>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ESTADO 3: WIZARD DE ATUALIZAÇÃO CADASTRAL EM 4 ETAPAS (DESBLOQUEADO) */}
        {/* ========================================================================= */}
        {lookupState === "wizard" && isUnlocked && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-300">
            {/* Header / Manifesto Institucional */}
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-4 shadow-[0_0_20px_rgba(0,255,102,0.15)]">
                <span className="w-2 h-2 rounded-full bg-green animate-ping" />
                <span>ETAPA FINAL DE VALIDAÇÃO • MEMBRO FUNDADOR</span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-white tracking-tight leading-tight max-w-xl mb-3">
                Atualização Cadastral & Regiões
              </h1>

              <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-xl leading-relaxed">
                Complete seus dados complementares para configurar suas áreas de atendimento em Ubatuba e ativar seu link de apadrinhamento.
              </p>

              {padrinhoNome && (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-green/30 text-xs text-zinc-300 font-sans mt-3 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
                  <Handshake className="w-3.5 h-3.5 text-green" />
                  <span>Padrinho de Entrada: <strong className="text-green font-semibold">{padrinhoNome}</strong></span>
                </div>
              )}
            </div>

            {/* Stepper Progress Indicator on Top (Totalmente Clicável com Navegação Direta) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-xl">
              <div className="flex items-center justify-between relative">
                {/* Linha de conexão de fundo */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-800 -z-0" />

                {STEPS.map((s) => {
                  const isDone = currentStep > s.id;
                  const isActive = currentStep === s.id;
                  const StepIcon = s.icon;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCurrentStep(s.id as WizardStep)}
                      className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                    >
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-display font-bold text-xs sm:text-sm transition-all ${
                          isDone
                            ? "bg-green text-navy shadow-[0_0_15px_rgba(0,255,102,0.4)] group-hover:scale-105"
                            : isActive
                            ? "bg-black border-2 border-green text-green shadow-[0_0_20px_rgba(0,255,102,0.5)] scale-110"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-white group-hover:border-zinc-700"
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <StepIcon className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider text-center max-w-[80px] sm:max-w-none transition-colors ${
                          isActive
                            ? "text-green font-bold"
                            : isDone
                            ? "text-white/80 font-medium group-hover:text-white"
                            : "text-zinc-500 group-hover:text-zinc-300"
                        }`}
                      >
                        {s.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Container dos Passos do Wizard */}
            <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col gap-6">

              {/* =================================================================== */}
              {/* ETAPA 1: DADOS PESSOAIS */}
              {/* =================================================================== */}
              {currentStep === 1 && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-green" />
                      <h2 className="font-display font-bold text-lg text-white">
                        1. Cadastro Pessoal
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPersonalUnlocked((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPersonalUnlocked
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-zinc-900 text-white/70 hover:text-white border border-zinc-800"
                      }`}
                    >
                      {isPersonalUnlocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Edição liberada</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Editar dados pessoais</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!isPersonalUnlocked && (
                    <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green shrink-0" />
                      <span>Seus dados já cadastrados estão protegidos. Clique em "Editar dados pessoais" acima caso precise corrigir algo.</span>
                    </div>
                  )}

                  {/* Campos Condicionais PF vs PJ */}
                  {tipoPessoa === "PF" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          Nome Completo:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-sans outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          CPF:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={cpf}
                          onChange={(e) => setCpf(maskCPF(e.target.value))}
                          maxLength={14}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-mono outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          WhatsApp:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={telefone}
                          onChange={(e) => setTelefone(maskPhone(e.target.value))}
                          maxLength={15}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-mono outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          E-mail:
                        </label>
                        <input
                          type="email"
                          readOnly={!isPersonalUnlocked}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-sans outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          Razão Social / Nome da Entidade:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={razaoSocial}
                          onChange={(e) => setRazaoSocial(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-sans outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          CNPJ:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={cnpj}
                          onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                          maxLength={18}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-mono outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          WhatsApp Corporativo:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={telefone}
                          onChange={(e) => setTelefone(maskPhone(e.target.value))}
                          maxLength={15}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-mono outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          Responsável Legal:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={responsavelLegal}
                          onChange={(e) => setResponsavelLegal(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-sans outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          CPF do Responsável:
                        </label>
                        <input
                          type="text"
                          readOnly={!isPersonalUnlocked}
                          value={cpfResponsavel}
                          onChange={(e) => setCpfResponsavel(maskCPF(e.target.value))}
                          maxLength={14}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-mono outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          E-mail Corporativo:
                        </label>
                        <input
                          type="email"
                          readOnly={!isPersonalUnlocked}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl bg-black border text-sm font-sans outline-none ${
                            isPersonalUnlocked
                              ? "border-zinc-700 focus:border-green text-white"
                              : "border-zinc-800 text-zinc-400 cursor-not-allowed bg-zinc-900/30"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Criação / Atualização de Senha */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col gap-4">
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">
                        Segurança & Senha de Acesso
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Defina ou atualize sua senha para acessar o painel de fundador e acompanhar seus ganhos.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          Senha (mínimo 6 dígitos):
                        </label>
                        <div className="relative">
                          <input
                            type={showSenha ? "text" : "password"}
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-mono outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSenha((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                          >
                            {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                          Confirmar Senha:
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmarSenha ? "text" : "password"}
                            value={confirmarSenha}
                            onChange={(e) => setConfirmarSenha(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-mono outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmarSenha((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                          >
                            {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {step1Error && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step1Error}</span>
                    </div>
                  )}

                  {/* Ação do Passo 1: Continuar */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep1()) {
                          setCurrentStep(2);
                        }
                      }}
                      className="px-6 py-3.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-green/10"
                    >
                      <span>Continuar</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* ETAPA 2: BAIRROS (PF) OU PRESENÇA GEOGRÁFICA (PJ) */}
              {/* =================================================================== */}
              {currentStep === 2 && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  {isPJ ? (
                    <>
                      {/* Cabeçalho PJ */}
                      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                        <Building2 className="w-5 h-5 text-green" />
                        <h2 className="font-display font-bold text-lg text-white">
                          2. Localização & Atuação da Entidade
                        </h2>
                      </div>

                      {/* BLOCO 1: Bairro Matriz / Sede Principal (Obrigatório) */}
                      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-mono text-white/90 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            <span>Bairro da Matriz / Sede Principal:</span>
                            <span className="text-red-400">*</span>
                          </label>
                          <span className="text-[11px] font-mono text-zinc-400">Obrigatório</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Selecione o bairro onde fica a sede ou matriz da sua empresa / entidade em Ubatuba (ou "Fora do Município").
                        </p>
                        <select
                          value={bairroMatriz}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBairroMatriz(val);
                            setBairroResidencia(val);
                            setStep2Error("");
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-sans outline-none cursor-pointer"
                        >
                          <option value="">Selecione o bairro da sede / matriz...</option>
                          <option value="Fora do Município">🌐 Fora do Município</option>
                          {BAIRROS_LIST.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* BLOCO 2: Bairros Filiais / Pontos de Apoio (Opcional) */}
                      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <label className="text-xs font-mono text-white/90 uppercase tracking-wider font-semibold block">
                              Filiais & Pontos de Apoio em Ubatuba:
                            </label>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Caso possua filiais, quiosques, lojas ou bases em outros bairros do município (opcional).
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono text-green font-semibold">
                              {bairrosFiliais.length} filial(is) selecionada(s)
                            </span>
                            {bairrosFiliais.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setBairrosFiliais([])}
                                className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchBairroFilial}
                            onChange={(e) => setSearchBairroFilial(e.target.value)}
                            placeholder="Buscar bairro da filial..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-sans outline-none"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-black/60 border border-zinc-800 flex flex-wrap gap-2">
                          {filteredBairrosFiliais.map((b) => {
                            const isSelected = bairrosFiliais.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => toggleBairroFilial(b)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "bg-green text-navy font-bold shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                                    : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                <span>{b}</span>
                              </button>
                            );
                          })}
                          {filteredBairrosFiliais.length === 0 && (
                            <span className="text-xs text-zinc-500 py-3 w-full text-center">
                              Nenhum bairro encontrado com "{searchBairroFilial}".
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BLOCO 3: Regiões de Atuação Comercial */}
                      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <label className="text-xs font-mono text-white/90 uppercase tracking-wider font-semibold block">
                              Regiões de Atuação no Município:
                            </label>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Selecione as grandes macro-regiões onde sua entidade tem capacidade de atendimento.
                            </p>
                          </div>
                          <span className="text-[11px] font-mono text-green font-semibold">
                            {regioesAtuacao.length} selecionada(s)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                          {[
                            { id: "Sul", label: "Região Sul", desc: "Maringá a Perequê-Mirim" },
                            { id: "Centro", label: "Região Centro", desc: "Itaguá, Centro e entorno" },
                            { id: "Norte", label: "Região Norte", desc: "Ubatumirim ao Camburi" },
                            { id: "Oeste", label: "Região Oeste", desc: "Horto, Ipiranguinha e interior" },
                          ].map((reg) => {
                            const isSelected = regioesAtuacao.includes(reg.id);
                            return (
                              <button
                                key={reg.id}
                                type="button"
                                onClick={() => toggleRegiaoAtuacao(reg.id)}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                                  isSelected
                                    ? "bg-green/10 border-green text-white shadow-[0_0_15px_rgba(0,255,102,0.2)]"
                                    : "bg-black border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isSelected ? "text-green" : "text-white"}`}>
                                    {reg.label}
                                  </span>
                                  {isSelected && <Check className="w-4 h-4 text-green stroke-[3]" />}
                                </div>
                                <span className="text-[10px] text-zinc-500 leading-tight">
                                  {reg.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* BLOCO 4: Bairros de Atuação Direta */}
                      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <label className="text-xs font-mono text-white/90 uppercase tracking-wider font-semibold block">
                              Bairros Específicos de Atuação:
                            </label>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Marque todos os bairros onde sua entidade atende clientes ou realiza entregas/serviços.
                            </p>
                          </div>
                          <span className="text-[11px] font-mono text-green font-semibold">
                            {bairrosAtuacao.length} selecionado(s)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleBairroAtuacao("Fora do Município")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                              bairrosAtuacao.includes("Fora do Município")
                                ? "bg-green text-navy font-bold shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                                : "bg-black border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                            }`}
                          >
                            {bairrosAtuacao.includes("Fora do Município") && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            <span>🌐 Fora do Município</span>
                          </button>
                          <span className="text-zinc-600">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              const combined = Array.from(new Set([...BAIRROS_LIST, ...bairrosAtuacao]));
                              setBairrosAtuacao(combined);
                            }}
                            className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Selecionar Todos Ubatuba
                          </button>
                          <span className="text-zinc-600">•</span>
                          <button
                            type="button"
                            onClick={() => setBairrosAtuacao([])}
                            className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>

                        <div className="relative">
                          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchBairroAtuacao}
                            onChange={(e) => setSearchBairroAtuacao(e.target.value)}
                            placeholder="Filtrar bairro por nome..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-sans outline-none"
                          />
                        </div>

                        {/* Chips de Bairros de Atuação */}
                        <div className="max-h-56 overflow-y-auto p-3 rounded-xl bg-black/60 border border-zinc-800 flex flex-wrap gap-2">
                          {filteredBairrosAtuacao.map((b) => {
                            const isSelected = bairrosAtuacao.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => toggleBairroAtuacao(b)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "bg-green text-navy font-bold shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                                    : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                <span>{b}</span>
                              </button>
                            );
                          })}
                          {filteredBairrosAtuacao.length === 0 && (
                            <span className="text-xs text-zinc-500 py-4 w-full text-center">
                              Nenhum bairro encontrado com "{searchBairroAtuacao}".
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* BLOCO ORIGINAL PF (Zero Regressão) */}
                      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                        <MapPin className="w-5 h-5 text-green" />
                        <h2 className="font-display font-bold text-lg text-white">
                          2. Localização & Bairros
                        </h2>
                      </div>

                      {/* Onde Moro */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-white/80 uppercase tracking-wider">
                          Onde você mora? (Residência):
                        </label>
                        <select
                          value={bairroResidencia}
                          onChange={(e) => {
                            setBairroResidencia(e.target.value);
                            setStep2Error("");
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-sans outline-none cursor-pointer"
                        >
                          <option value="">Selecione o seu bairro de moradia...</option>
                          {BAIRROS_COM_OUTRA_CIDADE_LIST.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Onde Trabalho / Atuação */}
                      <div className="flex flex-col gap-3 pt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-xs font-mono text-white/80 uppercase tracking-wider">
                            Onde você atua ou trabalha? (Selecione múltiplos):
                          </label>
                          <span className="text-[11px] font-mono text-green font-semibold">
                            {bairrosAtuacao.length} selecionado(s)
                          </span>
                        </div>

                        <div className="relative">
                          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchBairroAtuacao}
                            onChange={(e) => setSearchBairroAtuacao(e.target.value)}
                            placeholder="Filtrar bairro por nome..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-sans outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 pb-1">
                          <button
                            type="button"
                            onClick={() => setBairrosAtuacao(BAIRROS_LIST)}
                            className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Selecionar Todos
                          </button>
                          <span className="text-zinc-600">•</span>
                          <button
                            type="button"
                            onClick={() => setBairrosAtuacao([])}
                            className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>

                        {/* Chips de Bairros */}
                        <div className="max-h-56 overflow-y-auto p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-wrap gap-2">
                          {filteredBairrosAtuacao.map((b) => {
                            const isSelected = bairrosAtuacao.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => toggleBairroAtuacao(b)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "bg-green text-navy font-bold shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                                    : "bg-black border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                <span>{b}</span>
                              </button>
                            );
                          })}
                          {filteredBairrosAtuacao.length === 0 && (
                            <span className="text-xs text-zinc-500 py-4 w-full text-center">
                              Nenhum bairro encontrado com "{searchBairroAtuacao}".
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {step2Error && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step2Error}</span>
                    </div>
                  )}

                  {/* Navegação do Passo 2: Voltar e Continuar */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white/80 font-display font-medium text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep2()) {
                          setCurrentStep(3);
                        }
                      }}
                      className="px-6 py-3.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-green/10"
                    >
                      <span>Continuar</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* ETAPA 3: PRAIAS */}
              {/* =================================================================== */}
              {currentStep === 3 && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                    <Waves className="w-5 h-5 text-green" />
                    <h2 className="font-display font-bold text-lg text-white">
                      {isPJ ? "3. Praias que Atua" : "3. Praias que Frequenta ou Atua"}
                    </h2>
                  </div>

                  <p className="text-xs text-zinc-400">
                    {isPJ
                      ? "Indique as praias onde sua entidade/empresa presta serviços ou realiza atendimento comercial."
                      : "Indique as praias onde você costuma prestar serviços, passear ou consumir. Isso nos ajuda a direcionar demandas próximas a você."}
                  </p>

                  {/* Toggle Especial para PJ: Não atua em praias */}
                  {isPJ && (
                    <div
                      onClick={handleToggleNaoAtuaPraias}
                      className={`p-4 sm:p-5 rounded-2xl transition-all cursor-pointer flex items-center justify-between ${
                        naoAtuaPraias
                          ? "border-2 border-[#00FF66] bg-[#00FF66]/10 shadow-[0_0_20px_rgba(0,255,102,0.25)]"
                          : "border border-white/10 bg-neutral-900/60 text-zinc-300 hover:border-white/20 hover:bg-neutral-900/80"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base transition-all shrink-0 ${
                            naoAtuaPraias
                              ? "bg-[#00FF66] text-black shadow-[0_0_15px_rgba(0,255,102,0.3)]"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          🌴
                        </div>
                        <div className="flex flex-col">
                          <span
                            className={`text-xs font-mono uppercase tracking-wider transition-colors ${
                              naoAtuaPraias ? "text-[#00FF66] font-bold" : "text-white font-semibold"
                            }`}
                          >
                            Não atua em praias
                          </span>
                          <span className="text-[11px] text-zinc-400 mt-0.5">
                            Marque esta opção se sua entidade atua exclusivamente na área urbana, rural ou sede administrativa.
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ml-3 ${
                          naoAtuaPraias
                            ? "bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]"
                            : "border-2 border-zinc-700 bg-black/60 text-transparent hover:border-zinc-500"
                        }`}
                      >
                        {naoAtuaPraias && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>
                  )}

                  {naoAtuaPraias ? (
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-[#00FF66]/30 text-center py-6 text-xs text-zinc-300">
                      🌴 <strong className="text-[#00FF66]">Opção "Não atua em praias" selecionada.</strong>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Nenhuma praia será vinculada ao perfil da entidade. Caso deseje selecionar praias, desmarque a opção acima.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchPraia}
                            onChange={(e) => setSearchPraia(e.target.value)}
                            placeholder="Filtrar praia..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-sans outline-none"
                          />
                        </div>
                        <span className="text-[11px] font-mono text-green font-semibold">
                          {praias.length} praia(s) selecionada(s)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPraias(PRAIAS_LIST)}
                          className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                        >
                          Selecionar Todas
                        </button>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() => setPraias([])}
                          className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>

                      {/* Chips de Praias */}
                      <div className="max-h-64 overflow-y-auto p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-wrap gap-2">
                        {filteredPraias.map((p) => {
                          const isSelected = praias.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePraia(p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? "bg-green text-navy font-bold shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                                  : "bg-black border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              <span>{p}</span>
                            </button>
                          );
                        })}
                        {filteredPraias.length === 0 && (
                          <span className="text-xs text-zinc-500 py-4 w-full text-center">
                            Nenhuma praia encontrada com "{searchPraia}".
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Navegação do Passo 3: Voltar e Continuar */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white/80 font-display font-medium text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="px-6 py-3.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-green/10"
                    >
                      <span>Continuar</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* ETAPA 4: FINANCEIRO & APADRINHAMENTO */}
              {/* =================================================================== */}
              {currentStep === 4 && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                    <Wallet className="w-5 h-5 text-green" />
                    <h2 className="font-display font-bold text-lg text-white">
                      4. Financeiro & Apadrinhamento
                    </h2>
                  </div>

                  {/* Mercado Pago Toggle */}
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-mono text-white/80 uppercase tracking-wider">
                      Você possui conta no Mercado Pago?
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPossuiMercadoPago(true)}
                        className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          possuiMercadoPago
                            ? "bg-green text-navy shadow-[0_0_15px_rgba(0,255,102,0.3)]"
                            : "bg-black border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {possuiMercadoPago && <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Sim, possuo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPossuiMercadoPago(false)}
                        className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          !possuiMercadoPago
                            ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                            : "bg-black border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        {!possuiMercadoPago && <Check className="w-4 h-4 stroke-[3]" />}
                        <span>Não possuo ainda</span>
                      </button>
                    </div>
                  </div>

                  {/* Chave Pix */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col gap-3">
                    <label className="text-xs font-mono text-white/80 uppercase tracking-wider block">
                      Chave Pix para Recebimento de Repasses:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <select
                          value={tipoChavePix}
                          onChange={(e) => {
                            setTipoChavePix(e.target.value);
                            setChavePix("");
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-sans outline-none cursor-pointer"
                        >
                          <option value="telefone">Telefone / Celular</option>
                          <option value="cpf">CPF</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="email">E-mail</option>
                          <option value="aleatoria">Chave Aleatória (EVP)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={chavePix}
                          onChange={(e) => setChavePix(applyPixMask(e.target.value, tipoChavePix))}
                          placeholder={getPixPlaceholder(tipoChavePix)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-xs font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Programa de Apadrinhamento & Link de Indicação Oficial */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-green/30 shadow-[0_0_25px_rgba(0,255,102,0.06)] flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green/10 border border-green/30 flex items-center justify-center text-green shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white">
                          Programa de Apadrinhamento UBT
                        </h3>
                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                          Ganhe até 1% de cashback e comissão contínua sobre as corridas e serviços realizados por quem você convidar para a plataforma.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider">
                        Seu Link de Convite Personalizado:
                      </label>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-[200px] max-w-full flex items-center bg-black border border-zinc-800 focus-within:border-green rounded-xl px-3 py-2 text-xs font-mono overflow-hidden">
                          <span className="text-zinc-500 select-none text-[11px] sm:text-xs shrink-0">{getReferralBaseUrl()}</span>
                          <input
                            type="text"
                            value={referralSlug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            placeholder="seu-codigo"
                            className="flex-1 bg-transparent text-green font-bold outline-none ml-0.5 min-w-[60px]"
                          />
                          <span className="text-zinc-500 select-none text-[10px] sm:text-xs shrink-0">#cadastro-fundadores-cap</span>
                        </div>

                        <button
                          type="button"
                          onClick={copyReferralLink}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                        >
                          {copiedReferral ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green" />
                              <span className="text-green">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        * O código pode conter apenas letras minúsculas, números e hífens.
                      </span>
                    </div>
                  </div>

                  {step4Error && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step4Error}</span>
                    </div>
                  )}

                  {/* Ação Final: Concluir (Adaptado Responsivamente para Viewports Mobile 393px) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 w-full">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setCurrentStep(3)}
                      className="order-2 sm:order-1 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white/80 font-display font-medium text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-800 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleFinalSubmit}
                      className="order-1 sm:order-2 w-full sm:w-auto px-8 py-4 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(0,255,102,0.4)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] text-center"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-navy" />
                          <span>Finalizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-navy shrink-0" />
                          <span>Concluir</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
