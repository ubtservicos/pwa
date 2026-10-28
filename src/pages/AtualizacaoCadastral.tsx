import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Search,
  Smartphone,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { maskPhone, maskCPF, maskCNPJ, applyPixMask } from "@/utils/masks";
import { trackEvent } from "@/services/AnalyticsService";
import FounderForm, {
  FounderFormData,
  BAIRROS_LIST,
  BAIRROS_RESIDENCIA_LIST,
  PRAIAS_LIST,
  REGIOES_UBATUBA
} from "@/components/FounderForm";

export { BAIRROS_LIST, BAIRROS_RESIDENCIA_LIST, PRAIAS_LIST, REGIOES_UBATUBA };

export default function AtualizacaoCadastral() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados de Busca e Carregamento do Lead
  const [step, setStep] = useState<"loading" | "lookup" | "form">("loading");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [leadRecord, setLeadRecord] = useState<any>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<FounderFormData>>({});

  // Função auxiliar para carregar lead por telefone
  const searchLeadByPhone = async (rawPhone: string) => {
    // Sanitização para extrair estritamente dígitos numéricos
    const telDigits = (rawPhone || "").replace(/\D/g, "");
    if (!telDigits || telDigits.length < 8) {
      setLookupError("Informe um número de telefone com DDD válido (ex: 12 99999-8888).");
      return;
    }

    // Normaliza removendo 55 se houver mais de 10 dígitos (ex: 5512982267829 -> 12982267829)
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
        // Fallback silencioso para consulta direta
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
        setStep("lookup");
        return;
      }

      // Lead localizado! Prepara os dados para o formulário
      setLeadRecord(leadData);

      const isPJ = leadData.tipo_pessoa === "PJ" || !!leadData.cnpj;
      const perfilArr = Array.isArray(leadData.perfil)
        ? leadData.perfil
        : (leadData.perfil ? [leadData.perfil] : ["morador"]);

      // Regiões salvas
      const regioesList = leadData.regiao_atuacao
        ? leadData.regiao_atuacao.split(",").map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(leadData.regioes) ? leadData.regioes : []);

      // Bairro de residência salvo
      const bResidenciaSalvo = leadData.bairro_residencia
        || leadData.bairro_moradia
        || (Array.isArray(leadData.bairros) && leadData.bairros.length > 0 ? leadData.bairros[0] : (leadData.bairro_hospedagem || ""));

      // Bairros trabalho salvos
      const bairrosTrabList = leadData.bairro_trabalho
        ? leadData.bairro_trabalho.split(",").map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(leadData.bairros_atuacao) ? leadData.bairros_atuacao : []);

      // Bairros hospedagem salvos
      const bHospList = leadData.bairro_hospedagem
        ? leadData.bairro_hospedagem.split(",").map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(leadData.bairros_hospedagem) ? leadData.bairros_hospedagem : []);

      // Praias salvas
      const praiasList = Array.isArray(leadData.praias_frequenta)
        ? leadData.praias_frequenta
        : (Array.isArray(leadData.praias) ? leadData.praias : []);

      setInitialFormValues({
        tipoPessoa: isPJ ? "PJ" : "PF",
        nome: leadData.nome || "",
        cpf: leadData.cpf ? maskCPF(leadData.cpf) : "",
        perfil: perfilArr,
        nome_empresa: leadData.razao_social || leadData.nome || "",
        cnpj: leadData.cnpj ? maskCNPJ(leadData.cnpj) : "",
        responsavel_legal: leadData.responsavel_legal || "",
        cpf_responsavel: leadData.cpf_responsavel ? maskCPF(leadData.cpf_responsavel) : "",
        regiao_atuacao_pj: isPJ ? regioesList : [],
        telefone: leadData.telefone ? maskPhone(leadData.telefone) : maskPhone(telQuery),
        email: leadData.email || "",
        senha: "",
        confirmarSenha: "",
        possuiContaMercadoPago: typeof leadData.possui_conta_mercado_pago === "boolean" ? leadData.possui_conta_mercado_pago : false,
        tipo_chave_pix: leadData.tipo_chave_pix || "",
        chave_pix: leadData.chave_pix ? applyPixMask(leadData.chave_pix, leadData.tipo_chave_pix) : "",
        regiao_atuacao_pf: !isPJ ? regioesList : [],
        regioes: regioesList,
        bairro_residencia: bResidenciaSalvo,
        bairros_atuacao: bairrosTrabList,
        bairros_hospedagem: bHospList,
        praias: praiasList,
        bairros: [bResidenciaSalvo, ...bairrosTrabList, ...bHospList].filter(Boolean),
        bairro_trabalho: bairrosTrabList,
        bairro_hospedagem: bHospList.join(", "),
        acceptTerms: true,
      });

      setStep("form");
      trackEvent("atualizacao_cadastral_lead_loaded", "onboarding", { lead_id: leadData.id });
    } catch (err: any) {
      console.error("[AtualizacaoCadastral] Erro ao buscar lead:", err);
      setLookupError("Ocorreu um erro ao consultar os dados. Tente novamente.");
      setStep("lookup");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Inicialização: checa parâmetro tel ou telefone na URL
  useEffect(() => {
    const rawParam = searchParams.get("tel") || searchParams.get("telefone") || "";
    const telDigits = decodeURIComponent(rawParam).replace(/\D/g, "");

    if (telDigits && telDigits.length >= 8) {
      // Normaliza removendo 55 se houver mais de 10 dígitos (ex: 5512982267829 -> 12982267829)
      const cleanPhone = (telDigits.startsWith("55") && telDigits.length > 10)
        ? telDigits.slice(2)
        : telDigits;

      setLookupPhone(maskPhone(cleanPhone));
      searchLeadByPhone(cleanPhone);
    } else {
      setStep("lookup");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#060B18] text-white flex flex-col selection:bg-green selection:text-navy pb-28 md:pb-8">
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
        {step === "loading" && (
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
        {step === "lookup" && (
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

            <div className="p-6 sm:p-8 rounded-3xl bg-[#0B1329] border border-white/10 shadow-2xl flex flex-col gap-4">
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-sm font-mono outline-none"
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
        {/* ESTADO 3: FORMULÁRIO COMPLETO DE ATUALIZAÇÃO CADASTRAL & CRIAÇÃO DE SENHA */}
        {/* ========================================================================= */}
        {step === "form" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-300">
            {/* Header / Manifesto Institucional */}
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-4 shadow-[0_0_20px_rgba(0,255,102,0.15)]">
                <span className="w-2 h-2 rounded-full bg-green animate-ping" />
                <span>ETAPA FINAL DE VALIDAÇÃO • MEMBRO FUNDADOR</span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-white tracking-tight leading-tight max-w-xl mb-4">
                Faltam poucos detalhes para liberar a sua aprovação.
              </h1>

              <div className="p-5 sm:p-6 rounded-2xl bg-[#0B1329]/90 border border-white/10 text-left max-w-2xl text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed backdrop-blur-sm">
                Obrigado por apoiar a UBT desde o início! Atualizamos nossa infraestrutura para garantir repasses automáticos via Pix, segurança por senha e separação entre prestadores e tomadores. Revise seus dados abaixo, selecione suas regiões de atuação e crie sua senha de acesso para ativar seu perfil e seu link de apadrinhamento.
              </div>
            </div>

            {/* Formulário Oficial Componentizado */}
            <FounderForm
              isUpdateMode={true}
              leadRecord={leadRecord}
              defaultValues={initialFormValues}
              submitButtonText="Concluir cadastro"
              hideAlreadyRegisteredButton={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
