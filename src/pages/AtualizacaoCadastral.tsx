import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Search,
  Smartphone,
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
  ShieldCheck
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
import { logSystem } from "@/services/LoggingService";
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

  // Estados de Busca e Carregamento do Lead
  const [lookupState, setLookupState] = useState<"loading" | "lookup" | "wizard">("loading");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [leadRecord, setLeadRecord] = useState<any>(null);

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

  // Etapa 2: Bairros
  const [bairroResidencia, setBairroResidencia] = useState("");
  const [bairrosAtuacao, setBairrosAtuacao] = useState<string[]>([]);
  const [searchBairroAtuacao, setSearchBairroAtuacao] = useState("");
  const [step2Error, setStep2Error] = useState("");

  // Etapa 3: Praias
  const [praias, setPraias] = useState<string[]>([]);
  const [searchPraia, setSearchPraia] = useState("");

  // Etapa 4: Financeiro & Indicação
  const [possuiMercadoPago, setPossuiMercadoPago] = useState<boolean>(true);
  const [tipoChavePix, setTipoChavePix] = useState<string>("telefone");
  const [chavePix, setChavePix] = useState("");
  const [referralSlug, setReferralSlug] = useState("");
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [step4Error, setStep4Error] = useState("");

  // Função auxiliar para carregar lead por telefone
  const searchLeadByPhone = async (rawPhone: string) => {
    const telDigits = (rawPhone || "").replace(/\D/g, "");
    if (!telDigits || telDigits.length < 8) {
      setLookupError("Informe um número de telefone com DDD válido (ex: 12 99999-8888).");
      return;
    }

    const telQuery = (telDigits.startsWith("55") && telDigits.length > 10)
      ? telDigits.slice(2)
      : telDigits;

    setIsLookingUp(true);
    setLookupError("");

    try {
      let leadData: any = null;

      // 1. Tenta chamar RPC buscar_lead_waitlist
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc("buscar_lead_waitlist", { p_identificador: telQuery });

        if (!rpcError && rpcData) {
          leadData = Array.isArray(rpcData) ? (rpcData[0] || null) : rpcData;
        }
      } catch (rpcErr) {
        // Fallback silencioso
      }

      // 2. Fallback: Consulta direta comparando número limpo, com máscara e últimos 8 dígitos
      if (!leadData) {
        const mascaraTelefone = maskPhone(telQuery);
        const last8 = telQuery.slice(-8);

        const { data, error } = await supabase
          .from("waitlist")
          .select("*")
          .or(`telefone.eq.${telQuery},telefone.eq.${mascaraTelefone},telefone.ilike.%${last8}%`)
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw error;
        }
        leadData = data;
      }

      if (!leadData) {
        setLookupError("Nenhum cadastro de fundador encontrado com este número. Verifique os dígitos ou faça sua inscrição como novo fundador.");
        setIsLookingUp(false);
        setLookupState("lookup");
        return;
      }

      // Lead localizado! Preenche os estados do Wizard
      setLeadRecord(leadData);

      const isPJ = leadData.tipo_pessoa === "PJ" || !!leadData.cnpj;
      setTipoPessoa(isPJ ? "PJ" : "PF");
      setNome(leadData.nome || "");
      setCpf(leadData.cpf ? maskCPF(leadData.cpf) : "");
      setRazaoSocial(leadData.razao_social || leadData.nome || "");
      setCnpj(leadData.cnpj ? maskCNPJ(leadData.cnpj) : "");
      setResponsavelLegal(leadData.responsavel_legal || "");
      setCpfResponsavel(leadData.cpf_responsavel ? maskCPF(leadData.cpf_responsavel) : "");
      setTelefone(leadData.telefone ? maskPhone(leadData.telefone) : maskPhone(telQuery));
      setEmail(leadData.email || "");

      // Bairros
      const bResidenciaSalvo = leadData.bairro_residencia
        || leadData.bairro_moradia
        || (Array.isArray(leadData.bairros) && leadData.bairros.length > 0 ? leadData.bairros[0] : (leadData.bairro_hospedagem || ""));
      setBairroResidencia(bResidenciaSalvo || "");

      const bairrosTrabList: string[] = leadData.bairro_trabalho
        ? leadData.bairro_trabalho.split(",").map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(leadData.bairros_atuacao) ? leadData.bairros_atuacao : []);
      setBairrosAtuacao(bairrosTrabList);

      // Praias
      const praiasList: string[] = Array.isArray(leadData.praias_frequenta)
        ? leadData.praias_frequenta
        : (Array.isArray(leadData.praias) ? leadData.praias : []);
      setPraias(praiasList);

      // Financeiro
      setPossuiMercadoPago(
        typeof leadData.possui_conta_mercado_pago === "boolean"
          ? leadData.possui_conta_mercado_pago
          : (typeof leadData.possui_mercado_pago === "boolean" ? leadData.possui_mercado_pago : true)
      );
      setTipoChavePix(leadData.tipo_chave_pix || "telefone");
      setChavePix(
        leadData.chave_pix
          ? applyPixMask(leadData.chave_pix, leadData.tipo_chave_pix || "telefone")
          : (leadData.telefone ? maskPhone(leadData.telefone) : "")
      );

      // Referral Slug
      const savedSlug = leadData.referral_code || leadData.slug || "";
      if (savedSlug) {
        setReferralSlug(savedSlug);
      } else {
        const generated = generateReferralSlug(leadData.nome || leadData.razao_social, leadData.cpf || leadData.cnpj || leadData.id);
        setReferralSlug(generated);
      }

      setLookupState("wizard");
      trackEvent("atualizacao_cadastral_lead_loaded", "onboarding", { lead_id: leadData.id });
    } catch (err: any) {
      console.error("[AtualizacaoCadastral] Erro ao buscar lead:", err);
      setLookupError("Ocorreu um erro ao consultar os dados. Tente novamente.");
      setLookupState("lookup");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Inicialização: checa parâmetro tel ou telefone na URL
  useEffect(() => {
    const rawParam = searchParams.get("tel") || searchParams.get("telefone") || "";
    const telDigits = decodeURIComponent(rawParam).replace(/\D/g, "");

    if (telDigits && telDigits.length >= 8) {
      const cleanPhone = (telDigits.startsWith("55") && telDigits.length > 10)
        ? telDigits.slice(2)
        : telDigits;

      setLookupPhone(maskPhone(cleanPhone));
      searchLeadByPhone(cleanPhone);
    } else {
      setLookupState("lookup");
    }
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

  const togglePraia = (praia: string) => {
    setPraias((prev) =>
      prev.includes(praia) ? prev.filter((p) => p !== praia) : [...prev, praia]
    );
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
    const link = `https://ubt.app/r/${referralSlug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedReferral(true);
      toast.success("Link de apadrinhamento copiado!");
      setTimeout(() => setCopiedReferral(false), 2500);
    } catch (e) {
      toast.error("Não foi possível copiar o link.");
    }
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
    if (!bairroResidencia) {
      setStep2Error("Por favor, selecione onde você mora (ou 'Em outra cidade').");
      return false;
    }
    return true;
  };

  // Conclusão e Persistência do Wizard
  const handleFinalSubmit = async () => {
    setStep4Error("");

    if (possuiMercadoPago && chavePix) {
      // Validação básica de chave Pix se informada
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
      const allBairros = Array.from(new Set([bairroResidencia, ...bairrosAtuacao].filter(Boolean)));
      const rawDigitsTel = (telefone || "").replace(/\D/g, "");
      const cleanCpf = (cpf || "").replace(/\D/g, "");
      const cleanCnpj = (cnpj || "").replace(/\D/g, "");

      const updatePayload: Record<string, any> = {
        bairro_residencia: bairroResidencia,
        bairro_moradia: bairroResidencia,
        bairros_atuacao: bairrosAtuacao,
        bairros: allBairros,
        bairro_trabalho: bairrosAtuacao.join(", "),
        praias: praias,
        praias_frequenta: praias,
        possui_conta_mercado_pago: possuiMercadoPago,
        possui_mercado_pago: possuiMercadoPago,
        tipo_chave_pix: tipoChavePix,
        chave_pix: chavePix,
        referral_code: referralSlug || generateReferralSlug(nome || razaoSocial, cleanCpf || cleanCnpj),
        cadastro_completo: true,
        status: (leadRecord?.status === "aprovado" || leadRecord?.status === "approved") ? "aprovado" : "completo",
      };

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

      // 1. Atualiza na tabela waitlist
      if (leadRecord?.id) {
        const { error: wlErr } = await supabase
          .from("waitlist")
          .update(updatePayload)
          .eq("id", leadRecord.id);

        if (wlErr) {
          console.warn("[AtualizacaoCadastral] Erro no update da waitlist:", wlErr);
          throw wlErr;
        }
      }

      // 2. Atualiza ou sincroniza na tabela usuarios
      try {
        const userUpdates: Record<string, any> = {
          cadastro_completo: true,
          metadata: {
            bairro_residencia: bairroResidencia,
            bairros_atuacao: bairrosAtuacao,
            praias: praias,
            referral_code: updatePayload.referral_code,
            cadastro_completo: true,
          }
        };
        if (rawDigitsTel) {
          await supabase
            .from("usuarios")
            .update(userUpdates)
            .or(`telefone.eq.${rawDigitsTel},telefone.eq.${telefone}`);
        }
      } catch (uErr) {
        console.warn("[AtualizacaoCadastral] Falha não impeditiva ao atualizar usuarios:", uErr);
      }

      // 3. Atualiza senha no Supabase Auth se fornecida
      if (senha && senha.length >= 6) {
        try {
          const authEmail = email || leadRecord?.email || `${rawDigitsTel}@ubtservicos.com.br`;
          await supabase.auth.updateUser({ password: senha });
        } catch (authErr) {
          console.warn("[AtualizacaoCadastral] Supabase auth updateUser ignorado:", authErr);
        }
      }

      // 4. Executa RPC se disponível
      try {
        await supabase.rpc("concluir_atualizacao_cadastral", {
          p_telefone: rawDigitsTel,
          p_bairro_residencia: bairroResidencia,
          p_bairros_atuacao: bairrosAtuacao,
          p_praias: praias,
          p_referral_code: updatePayload.referral_code,
        });
      } catch (rpcErr) {
        // Fallback silencioso
      }

      trackEvent("atualizacao_cadastral_completed", "onboarding", {
        lead_id: leadRecord?.id,
        bairro_residencia: bairroResidencia,
        praias_count: praias.length,
      });

      // Efeito festivo exagerado no primeiro plano (zIndex 999999)
      try {
        confetti({
          particleCount: 260,
          spread: 120,
          origin: { y: 0.6 },
          zIndex: 999999,
          colors: ["#00FF66", "#005BFF", "#FFDD00", "#FFFFFF"],
        });
      } catch (confettiErr) {
        // Confetti silencioso se indisponível
      }

      toast.success("Atualização cadastral concluída com sucesso! Bem-vindo à UBT!", {
        duration: 4000,
      });

      setTimeout(() => {
        navigate("/sou-fundador");
      }, 1600);
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
              Localizando dados do membro fundador...
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ESTADO 2: LOCALIZAÇÃO DE LEAD (SEM TELEFONE NA URL OU NÃO ENCONTRADO) */}
        {/* ========================================================================= */}
        {lookupState === "lookup" && (
          <div className="w-full max-w-md mx-auto flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-green animate-ping" />
                <span>ETAPA FINAL DE VALIDAÇÃO • MEMBRO FUNDADOR</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight mb-2">
                Localize seu cadastro de Fundador
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
                Digite o número de WhatsApp cadastrado na UBT para puxarmos suas informações e liberar o acesso definitivo.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-2">
                  Número de WhatsApp:
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={lookupPhone}
                    onChange={(e) => {
                      setLookupPhone(maskPhone(e.target.value));
                      setLookupError("");
                    }}
                    placeholder="(12) 99999-9999"
                    maxLength={15}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black border border-zinc-800 focus:border-green text-white text-sm font-mono outline-none"
                  />
                </div>
              </div>

              {lookupError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{lookupError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isLookingUp || lookupPhone.replace(/\D/g, "").length < 8}
                onClick={() => {
                  const clean = lookupPhone.replace(/\D/g, "");
                  searchLeadByPhone(clean);
                }}
                className="w-full py-3.5 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-green/10"
              >
                {isLookingUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    <span>Localizando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Continuar</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link to="/#cadastro-fundadores-cap" className="text-xs text-white/40 hover:text-green underline">
                  Ainda não se cadastrou? Faça sua inscrição pioneira aqui
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ESTADO 3: WIZARD DE ATUALIZAÇÃO CADASTRAL EM 4 ETAPAS */}
        {/* ========================================================================= */}
        {lookupState === "wizard" && (
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
            </div>

            {/* Stepper Progress Indicator on Top */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-xl">
              <div className="flex items-center justify-between relative">
                {/* Linha de conexão de fundo */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-800 -z-0" />

                {STEPS.map((s) => {
                  const isDone = currentStep > s.id;
                  const isActive = currentStep === s.id;
                  const isFuture = currentStep < s.id;
                  const StepIcon = s.icon;

                  return (
                    <div
                      key={s.id}
                      className="relative z-10 flex flex-col items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isDone) setCurrentStep(s.id as WizardStep);
                        }}
                        disabled={isFuture}
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-display font-bold text-xs sm:text-sm transition-all ${
                          isDone
                            ? "bg-green text-navy shadow-[0_0_15px_rgba(0,255,102,0.4)] cursor-pointer"
                            : isActive
                            ? "bg-black border-2 border-green text-green shadow-[0_0_20px_rgba(0,255,102,0.5)] scale-110"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed"
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <StepIcon className="w-5 h-5" />
                        )}
                      </button>
                      <span
                        className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider text-center max-w-[80px] sm:max-w-none ${
                          isActive
                            ? "text-green font-bold"
                            : isDone
                            ? "text-white/80 font-medium"
                            : "text-zinc-500"
                        }`}
                      >
                        {s.title}
                      </span>
                    </div>
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
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

                  {/* Ação do Passo 1 */}
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
                      <span>Avançar para Bairros</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================================== */}
              {/* ETAPA 2: BAIRROS (RESIDÊNCIA & ATUAÇÃO) */}
              {/* =================================================================== */}
              {currentStep === 2 && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 ${
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

                  {step2Error && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step2Error}</span>
                    </div>
                  )}

                  {/* Navegação do Passo 2 */}
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
                      <span>Avançar para Praias</span>
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
                      3. Praias que Frequenta ou Atua
                    </h2>
                  </div>

                  <p className="text-xs text-zinc-400">
                    Indique as praias onde você costuma prestar serviços, passear ou consumir. Isso nos ajuda a direcionar demandas próximas a você.
                  </p>

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
                          className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all flex items-center gap-1.5 ${
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

                  {/* Navegação do Passo 3 */}
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
                      <span>Avançar para Financeiro</span>
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

                  {/* Programa de Apadrinhamento & Link de Indicação */}
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
                          Ganhe 1% de cashback e comissão contínua sobre as corridas e serviços realizados por quem você convidar para a plataforma.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider">
                        Seu Link de Convite Personalizado:
                      </label>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[240px] flex items-center bg-black border border-zinc-800 focus-within:border-green rounded-xl px-3 py-2 text-xs font-mono">
                          <span className="text-zinc-500 select-none">ubt.app/r/</span>
                          <input
                            type="text"
                            value={referralSlug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            placeholder="seu-codigo"
                            className="flex-1 bg-transparent text-green font-bold outline-none ml-0.5"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={copyReferralLink}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-all"
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

                  {/* Ação Final: Concluir Atualização */}
                  <div className="flex items-center justify-between pt-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setCurrentStep(3)}
                      className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white/80 font-display font-medium text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border border-zinc-800 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleFinalSubmit}
                      className="px-8 py-4 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(0,255,102,0.4)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-navy" />
                          <span>Finalizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-navy" />
                          <span>Concluir Atualização</span>
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
