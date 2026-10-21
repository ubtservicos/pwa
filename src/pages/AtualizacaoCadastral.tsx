import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Sparkles,
  Check,
  Loader2,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  Building2,
  User,
  Smartphone,
  Lock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  MapPin,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { 
  maskCPF, 
  maskCNPJ, 
  maskPhone,
  applyPixMask,
  getPixPlaceholder,
  getPixMaxLength,
  isValidCPF,
  isValidCNPJ,
  isValidEVP,
  isValidPixPhone,
  isValidEmail
} from "@/utils/masks";
import { trackEvent } from "@/services/AnalyticsService";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export const BAIRROS_LIST = [
  "Acaraú", "Aguas do Inga", "Aracaú", "Arariba", "Bairro Silop", "Bairro do Tenorio",
  "Barra Seca", "Barra Seca Praias Vermelha e Alto", "Barra da Lagoa", "Bela Vista",
  "Camburi", "Casanga", "Caçandoca", "Centro", "Centro (Picinguaba)", "Corcovado",
  "Estufa I", "Estufa II", "Figueira", "Flamengo Praias Ribeira e Sete Fortes",
  "Folha Seca", "Galhetas", "Horto", "Horto Florestal", "Ipiranguinha", "Itaguá",
  "Itamambuca", "Jardim Carolina", "Jardim Enseada", "Jardim Marisol", "Jardim Samambaia",
  "Jardim Santa Luzia", "Jardim Ubatuba", "Lagoinha", "Marafunda", "Mato Dentro",
  "Monte Valerio", "Park Hills", "Pedreira", "Perequê-Açu", "Perequê-Mirim",
  "Picinguaba", "Ponta Aguda", "Ponta Grossa", "Praia Brava", "Praia Brava do Sul",
  "Praia Domingas Dias", "Praia Dura", "Praia Grande", "Praia Santa Rita",
  "Praia Vermelha do Centro", "Praia Vermelha do Sul", "Praia da Almada", "Praia da Barra",
  "Praia da Enseada", "Praia da Fazenda", "Praia da Fortaleza", "Praia das Toninhas",
  "Praia de Itaguá", "Praia de Maranduba", "Praia do Frade", "Praia do Félix",
  "Praia do Itamambuca", "Praia do Lazaro", "Praia do Perequê Mirim", "Praia do Pulso",
  "Praia do Puruba", "Praia do Sapê", "Praia do Sununga", "Promirim", "Prumirim",
  "Ressaca", "Rio Escuro", "Rio da Prata", "Saco da Ribeira", "Sape", "Sertao do Meio",
  "Sertão da Quina", "Sertão do Ingá", "Sesmaria", "Silop", "Sumare", "Taquaral",
  "Tenório", "Ubatuba", "Ubatuba Country", "Ubatumirim", "Umuarama", "Área Rural de Ubatuba"
];

export const PRAIAS_LIST = [
  "Almada", "Alto", "Barra", "Barra Seca", "Bonete", "Brava da Almada", "Brava da Fortaleza",
  "Brava da Itamambuca", "Brava do Camburi", "Brava do Sul", "Camburi", "Caçandoca",
  "Caçandoquinha", "Cedrinho ou Cedro", "Cedro do Sul", "Cruzeiro ou Iperoig", "Deserto",
  "Domingas Dias", "Dura", "Engenho", "Enseada", "Fazenda", "Figueira", "Flamengo",
  "Fortaleza", "Félix", "Grande do Bonete", "Itaguá", "Itamambuca", "Justa", "Lagoinha",
  "Lamberto", "Lázaro", "Maranduba", "Meio", "Perequê-Açú", "Perequê-Mirim", "Picinguaba",
  "Ponta Aguda", "Praia Grande", "Prumirim", "Pulso", "Puruba", "Ribeira", "Santa Rita",
  "Sapê", "Sete Fontes", "Sununga", "Tenório", "Toninhas", "Ubatumirim", "Vermelha do Centro",
  "Vermelha do Norte", "Vermelha do Sul"
];

export const REGIOES_UBATUBA = ["Sul", "Centro", "Norte", "Oeste"];

const PERFIS_DISPONIVEIS = [
  { id: "ambulante", label: "Ambulante de Praia" },
  { id: "mototaxista", label: "Mototaxista" },
  { id: "diarista", label: "Diarista / Faxina" },
  { id: "morador", label: "Morador / Consumidor" },
  { id: "turista", label: "Turista / Visitante" },
];

const atualizacaoSchema = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]).default("PF"),

  // Campos PF
  nome: z.string().optional(),
  cpf: z.string().optional(),
  perfil: z.array(z.string()).default([]),

  // Campos PJ
  nome_empresa: z.string().optional(),
  cnpj: z.string().optional(),
  responsavel_legal: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  regiao_atuacao_pj: z.array(z.string()).default([]),

  // Campos Comuns
  telefone: z.string().min(10, "Informe um WhatsApp válido"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmarSenha: z.string().min(1, "Confirme sua senha"),
  possuiContaMercadoPago: z.boolean({ required_error: "Informe se possui conta no Mercado Pago" }),
  tipo_chave_pix: z.string().optional().default(""),
  chave_pix: z.string().optional().default(""),

  // Condicionais PF
  regiao_atuacao_pf: z.array(z.string()).default([]),
  praias: z.array(z.string()).default([]),
  bairros: z.array(z.string()).default([]),
  bairro_trabalho: z.array(z.string()).default([]),

  acceptTerms: z.boolean().refine(v => v === true, "Você deve aceitar os termos"),
}).superRefine((data, ctx) => {
  // 1. Validação de Senha
  if (data.senha !== data.confirmarSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "As senhas não coincidem",
      path: ["confirmarSenha"],
    });
  }

  // 2. Validação se PF
  if (data.tipoPessoa === "PF") {
    if (!data.nome || data.nome.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe seu nome completo (mínimo 3 caracteres)",
        path: ["nome"],
      });
    }

    const cleanCpf = (data.cpf || "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF deve ter 11 dígitos",
        path: ["cpf"],
      });
    }

    if (!data.perfil || data.perfil.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos um perfil",
        path: ["perfil"],
      });
    } else {
      if (data.perfil.some(p => p === "mototaxista" || p === "diarista") && (!data.regiao_atuacao_pf || data.regiao_atuacao_pf.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione pelo menos uma região de atuação",
          path: ["regiao_atuacao_pf"],
        });
      }

      if (data.perfil.includes("ambulante") && (!data.praias || data.praias.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione pelo menos uma praia de atuação",
          path: ["praias"],
        });
      }

      if (data.perfil.includes("morador")) {
        const totalLocais = (data.bairros?.length || 0) + (data.praias?.length || 0);
        if (totalLocais === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione pelo menos um bairro ou praia em Ubatuba",
            path: ["bairros"],
          });
        }
      }

      if (data.perfil.includes("turista")) {
        const totalLocais = (data.bairros?.length || 0) + (data.praias?.length || 0);
        if (totalLocais === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione pelo menos um bairro de estadia ou praia frequentada",
            path: ["bairros"],
          });
        }
      }
    }
  }

  // 3. Validação se PJ
  if (data.tipoPessoa === "PJ") {
    if (!data.nome_empresa || data.nome_empresa.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome da Associação ou Empresa",
        path: ["nome_empresa"],
      });
    }

    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ deve conter 14 dígitos",
        path: ["cnpj"],
      });
    }

    if (!data.responsavel_legal || data.responsavel_legal.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome do responsável legal",
        path: ["responsavel_legal"],
      });
    }

    const cleanCpfResp = (data.cpf_responsavel || "").replace(/\D/g, "");
    if (cleanCpfResp.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF do responsável deve ter 11 dígitos",
        path: ["cpf_responsavel"],
      });
    }

    if (!data.regiao_atuacao_pj || data.regiao_atuacao_pj.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos uma região de atuação",
        path: ["regiao_atuacao_pj"],
      });
    }
  }

  // 4. Validação da Chave Pix (se possui conta no Mercado Pago)
  if (data.possuiContaMercadoPago === true) {
    if (!data.tipo_chave_pix || data.tipo_chave_pix.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o tipo de Chave Pix",
        path: ["tipo_chave_pix"],
      });
    }

    const chave = (data.chave_pix || "").trim();
    if (!chave) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a sua Chave Pix cadastrada no Mercado Pago",
        path: ["chave_pix"],
      });
    } else {
      const tipo = (data.tipo_chave_pix || "").toLowerCase().trim();
      if (tipo === "telefone" || tipo === "celular") {
        if (!isValidPixPhone(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Telefone inválido. Informe DDD + 8 ou 9 dígitos numéricos.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "cpf") {
        if (!isValidCPF(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CPF inválido. Verifique os dígitos informados.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "cnpj") {
        if (!isValidCNPJ(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CNPJ inválido. Verifique os dígitos informados.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "email") {
        if (!isValidEmail(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "E-mail inválido para Chave Pix.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "aleatoria" || tipo === "evp") {
        if (!isValidEVP(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Chave aleatória inválida. Padrão UUID (36 caracteres) requerido.",
            path: ["chave_pix"],
          });
        }
      }
    }
  }
});

type AtualizacaoFormData = z.infer<typeof atualizacaoSchema>;

export default function AtualizacaoCadastral() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados de Busca e Carregamento do Lead
  const [step, setStep] = useState<"loading" | "lookup" | "form">("loading");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [leadRecord, setLeadRecord] = useState<any>(null);

  // Estados do Formulário
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Estados do Modal de Seleção Múltipla de Bairros e Praias
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationTab, setLocationTab] = useState<"todos" | "bairros" | "praias">("todos");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<AtualizacaoFormData>({
    resolver: zodResolver(atualizacaoSchema),
    defaultValues: {
      tipoPessoa: "PF",
      nome: "",
      cpf: "",
      perfil: ["morador"],
      nome_empresa: "",
      cnpj: "",
      responsavel_legal: "",
      cpf_responsavel: "",
      regiao_atuacao_pj: [],
      telefone: "",
      email: "",
      senha: "",
      confirmarSenha: "",
      possuiContaMercadoPago: false,
      tipo_chave_pix: "",
      chave_pix: "",
      regiao_atuacao_pf: [],
      praias: [],
      bairros: [],
      bairro_trabalho: [],
      acceptTerms: true,
    }
  });

  const tipoPessoa = watch("tipoPessoa");
  const perfil = watch("perfil");
  const possuiContaMercadoPago = watch("possuiContaMercadoPago");
  const tipoChavePix = watch("tipo_chave_pix");
  const chavePix = watch("chave_pix");
  const regiaoAtuacaoPf = watch("regiao_atuacao_pf");
  const regiaoAtuacaoPj = watch("regiao_atuacao_pj");
  const praias = watch("praias");
  const bairros = watch("bairros");
  const bairroTrabalho = watch("bairro_trabalho");

  // Filtragem de Bairros e Praias para o Modal
  const normalizedSearch = locationSearch.toLowerCase().trim();
  const filteredBairros = BAIRROS_LIST.filter(b =>
    !normalizedSearch || b.toLowerCase().includes(normalizedSearch)
  );
  const filteredPraias = PRAIAS_LIST.filter(p =>
    !normalizedSearch || p.toLowerCase().includes(normalizedSearch)
  );

  const toggleLocationItem = (item: string, type: "bairro" | "praia") => {
    if (type === "bairro") {
      const exists = bairros.includes(item);
      const next = exists ? bairros.filter(b => b !== item) : [...bairros, item];
      setValue("bairros", next, { shouldValidate: true });
    } else {
      const exists = praias.includes(item);
      const next = exists ? praias.filter(p => p !== item) : [...praias, item];
      setValue("praias", next, { shouldValidate: true });
    }
  };

  const clearAllLocations = () => {
    setValue("bairros", [], { shouldValidate: true });
    setValue("praias", [], { shouldValidate: true });
  };

  // Feedback imediato caso o formulário possua campos pendentes (elimina bloqueio silencioso)
  const onInvalid = (formErrors: typeof errors) => {
    console.warn("[AtualizacaoCadastral] Erros de validação:", formErrors);
    const errorKeys = Object.keys(formErrors) as (keyof AtualizacaoFormData)[];
    if (errorKeys.length > 0) {
      const firstErrKey = errorKeys[0];
      const firstErr = formErrors[firstErrKey];
      const msg = firstErr?.message ? String(firstErr.message) : "Preencha todos os campos obrigatórios.";
      toast.error(`Atenção: ${msg}`);

      const el = document.querySelector(`[name="${firstErrKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

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

      // Lead localizado! Preenche os campos do formulário
      setLeadRecord(leadData);

      const isPJ = leadData.tipo_pessoa === "PJ" || !!leadData.cnpj;
      const perfilArr = Array.isArray(leadData.perfil) 
        ? leadData.perfil 
        : (leadData.perfil ? [leadData.perfil] : ["morador"]);

      // Regiões salvas
      const regioesList = leadData.regiao_atuacao 
        ? leadData.regiao_atuacao.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      // Bairros trabalho
      const bairrosTrabList = leadData.bairro_trabalho
        ? leadData.bairro_trabalho.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      // Praias salvas
      const praiasList = Array.isArray(leadData.praias_frequenta)
        ? leadData.praias_frequenta
        : [];

      reset({
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
        praias: praiasList,
        bairros: leadData.bairro_moradia ? [leadData.bairro_moradia] : (leadData.bairro_hospedagem ? [leadData.bairro_hospedagem] : []),
        bairro_trabalho: bairrosTrabList,
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

  // Submissão do Formulário de Atualização Cadastral
  const onSubmit = async (values: AtualizacaoFormData) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const isPF = values.tipoPessoa === "PF";
      const cleanCpf = isPF && values.cpf ? values.cpf.replace(/\D/g, "") : null;
      const cleanCnpj = !isPF && values.cnpj ? values.cnpj.replace(/\D/g, "") : null;
      const cleanCpfResp = !isPF && values.cpf_responsavel ? values.cpf_responsavel.replace(/\D/g, "") : null;
      const nomeFinal = (isPF ? values.nome : values.nome_empresa)?.trim() || "";
      const perfilArray = isPF ? (values.perfil && values.perfil.length > 0 ? values.perfil : ["morador"]) : ["associacao"];
      const userRole = isPF ? (values.perfil?.[0] || "morador") : "associacao";
      const regiao = isPF 
        ? (values.regiao_atuacao_pf && values.regiao_atuacao_pf.length > 0 ? values.regiao_atuacao_pf.join(", ") : null) 
        : (values.regiao_atuacao_pj && values.regiao_atuacao_pj.length > 0 ? values.regiao_atuacao_pj.join(", ") : null);
      const bairroTrabalhoStr = isPF && values.bairro_trabalho && values.bairro_trabalho.length > 0 ? values.bairro_trabalho.join(", ") : null;
      const chavePix = values.possuiContaMercadoPago ? (values.chave_pix?.trim() || null) : null;
      const tipoChavePix = values.possuiContaMercadoPago ? (values.tipo_chave_pix?.trim() || null) : null;

      // 1. Criação / Ativação de Credencial no Supabase Auth
      let authUserId: string | null = null;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.senha,
        options: {
          data: {
            nome: nomeFinal,
            tipo_pessoa: values.tipoPessoa,
            cpf: cleanCpf,
            cnpj: cleanCnpj,
            telefone: values.telefone.trim(),
            perfil: perfilArray,
            role: userRole,
            responsavel_legal: !isPF ? values.responsavel_legal?.trim() : null,
            cpf_responsavel: cleanCpfResp,
            regiao_atuacao: regiao,
            chave_pix: chavePix,
            tipo_chave_pix: tipoChavePix,
          }
        }
      });

      if (authError) {
        const authMsg = authError.message?.toLowerCase() || "";
        if (
          authMsg.includes("already registered") || 
          authMsg.includes("already exists") || 
          authMsg.includes("user already exists")
        ) {
          // Usuário já possui Auth: tenta login direto com a senha fornecida
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: values.email.trim().toLowerCase(),
            password: values.senha,
          });

          if (!signInError && signInData?.user) {
            authUserId = signInData.user.id;
          } else {
            // Tenta obter o user_id existente da tabela usuarios ou waitlist
            authUserId = leadRecord?.user_id || leadRecord?.id || null;
          }
        } else {
          throw authError;
        }
      } else {
        authUserId = authData?.user?.id || null;
      }

      // Se autenticado com sucesso, garante que authUserId esteja disponível
      if (!authUserId && leadRecord?.id) {
        authUserId = leadRecord.user_id || leadRecord.id;
      }

      // 2. Monta observações e metadados
      const obsParts: string[] = [];
      obsParts.push(`Tipo: ${values.tipoPessoa}`);
      obsParts.push(`Atualizado via Link Seguro: Sim`);
      if (values.possuiContaMercadoPago !== undefined && values.possuiContaMercadoPago !== null) {
        obsParts.push(`Mercado Pago: ${values.possuiContaMercadoPago ? 'Sim' : 'Não'}`);
      }
      if (chavePix) {
        obsParts.push(`Chave Pix (${tipoChavePix}): ${chavePix}`);
      }
      if (regiao) {
        obsParts.push(`Região: ${regiao}`);
      }
      if (values.praias && values.praias.length > 0) {
        obsParts.push(`Praias: ${values.praias.join(", ")}`);
      }
      if (values.bairros && values.bairros.length > 0) {
        obsParts.push(`Bairros: ${values.bairros.join(", ")}`);
      }
      if (bairroTrabalhoStr) {
        obsParts.push(`Bairros Trabalho: ${bairroTrabalhoStr}`);
      }
      const obsText = obsParts.join(" | ");

      // 3. Atualização na tabela public.waitlist
      const waitlistUpdateData: any = {
        user_id: authUserId,
        tipo_pessoa: values.tipoPessoa,
        nome: nomeFinal,
        cpf: cleanCpf,
        cnpj: cleanCnpj,
        razao_social: !isPF ? values.nome_empresa?.trim() : null,
        responsavel_legal: !isPF ? values.responsavel_legal?.trim() : null,
        cpf_responsavel: cleanCpfResp,
        email: values.email.trim().toLowerCase(),
        telefone: values.telefone.trim(),
        cidade: "Ubatuba",
        perfil: perfilArray,
        regiao_atuacao: regiao,
        bairro_moradia: isPF && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
        bairro_hospedagem: isPF && values.perfil?.includes("turista") && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
        bairro_trabalho: bairroTrabalhoStr,
        praias_frequenta: isPF && values.praias && values.praias.length > 0 ? values.praias : null,
        possui_conta_mercado_pago: typeof values.possuiContaMercadoPago === "boolean" ? values.possuiContaMercadoPago : null,
        chave_pix: chavePix,
        tipo_chave_pix: tipoChavePix,
        observacoes: obsText,
        updated_at: new Date().toISOString(),
      };

      // 3. Persistência via RPC segura concluir_atualizacao_cadastral
      try {
        const { error: rpcErr } = await supabase.rpc("concluir_atualizacao_cadastral", {
          p_lead_id: leadRecord?.id || null,
          p_dados: waitlistUpdateData,
        });

        if (rpcErr) {
          console.warn("[AtualizacaoCadastral] RPC falhou, tentando fallback direto:", rpcErr);
          if (leadRecord?.id) {
            await supabase
              .from("waitlist")
              .update(waitlistUpdateData)
              .eq("id", leadRecord.id);
          }
        }
      } catch (saveErr) {
        console.warn("[AtualizacaoCadastral] Erro no salvamento da waitlist:", saveErr);
      }

      // 4. Upsert na tabela public.usuarios com o authUserId vinculado (sem telefone em usuarios)
      if (authUserId) {
        try {
          await supabase.from("usuarios").upsert({
            id: authUserId,
            nome: nomeFinal,
            email: values.email.trim().toLowerCase(),
            role: userRole,
            cpf: cleanCpf,
            cnpj: cleanCnpj,
            tipo_pessoa: values.tipoPessoa,
            responsavel_legal: !isPF ? values.responsavel_legal?.trim() : null,
            cpf_responsavel: cleanCpfResp,
            regiao_atuacao: regiao,
            chave_pix: chavePix,
            tipo_chave_pix: tipoChavePix,
            bairro_moradia: isPF && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
            bairro_trabalho: bairroTrabalhoStr,
            praias_frequenta: isPF && values.praias && values.praias.length > 0 ? values.praias : null,
            status: "completo",
          } as any);
        } catch (syncErr) {
          console.warn("[AtualizacaoCadastral] Aviso na sincronização com public.usuarios:", syncErr);
        }
      }

      trackEvent("atualizacao_cadastral_success", "onboarding", {
        lead_id: leadRecord?.id,
        user_id: authUserId
      });

      // Feedback de Sucesso: Chuva de confetes solicitada
      confetti({ particleCount: 150, spread: 80 });

      // Auto-login garantido para abrir a rota /sou-fundador já autenticado
      try {
        await supabase.auth.signInWithPassword({
          email: values.email.trim().toLowerCase(),
          password: values.senha,
        });
      } catch (loginErr) {
        // Ignora se a sessão já estiver ativa via signUp
      }

      // Toast vibrante de sucesso
      toast.success("Cadastro ativado com sucesso! Seja bem-vindo à rede de Fundadores! 🎉");

      // Redireciona para /sou-fundador com a sessão aberta
      setTimeout(() => {
        navigate("/sou-fundador");
      }, 1200);
    } catch (err: any) {
      console.error("[AtualizacaoCadastral] Erro ao salvar cadastro:", err);
      setSubmitError(err.message || "Erro ao atualizar dados. Tente novamente.");
      toast.error(err.message || "Erro ao atualizar dados. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternador de Regiões PF / PJ
  const toggleRegiao = (field: "regiao_atuacao_pf" | "regiao_atuacao_pj", reg: string) => {
    const current = field === "regiao_atuacao_pf" ? regiaoAtuacaoPf : regiaoAtuacaoPj;
    if (current.includes(reg)) {
      setValue(field, current.filter(r => r !== reg), { shouldValidate: true });
    } else {
      setValue(field, [...current, reg], { shouldValidate: true });
    }
  };

  // Alternador de Perfis PF
  const togglePerfil = (perfId: string) => {
    if (perfil.includes(perfId)) {
      const next = perfil.filter(p => p !== perfId);
      setValue("perfil", next, { shouldValidate: true });
    } else {
      setValue("perfil", [...perfil, perfId], { shouldValidate: true });
    }
  };

  // Alternador de Praias
  const togglePraia = (praia: string) => {
    if (praias.includes(praia)) {
      setValue("praias", praias.filter(p => p !== praia), { shouldValidate: true });
    } else {
      setValue("praias", [...praias, praia], { shouldValidate: true });
    }
  };

  // Alternador de Bairros Trabalho
  const toggleBairroTrabalho = (bairro: string) => {
    if (bairroTrabalho.includes(bairro)) {
      setValue("bairro_trabalho", bairroTrabalho.filter(b => b !== bairro), { shouldValidate: true });
    } else {
      setValue("bairro_trabalho", [...bairroTrabalho, bairro], { shouldValidate: true });
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

            {/* Formulário Principal */}
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="p-6 sm:p-8 rounded-3xl bg-[#0E1528] border border-white/10 shadow-2xl flex flex-col gap-6 text-left">
              {/* Seletor Tipo de Pessoa (PF vs PJ) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono uppercase tracking-wider text-white/50">
                  Tipo de Cadastro:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue("tipoPessoa", "PF", { shouldValidate: true })}
                    className={`py-3 px-4 rounded-xl border font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      tipoPessoa === "PF"
                        ? "bg-green text-navy border-green shadow-lg shadow-green/20"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Pessoa Física (PF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue("tipoPessoa", "PJ", { shouldValidate: true })}
                    className={`py-3 px-4 rounded-xl border font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      tipoPessoa === "PJ"
                        ? "bg-green text-navy border-green shadow-lg shadow-green/20"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Associação / Empresa (PJ)</span>
                  </button>
                </div>
              </div>

              {/* CAMPOS PESSOA FÍSICA */}
              {tipoPessoa === "PF" && (
                <>
                  {/* Nome Completo & CPF */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        {...register("nome")}
                        placeholder="Seu nome"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-sans outline-none"
                      />
                      {errors.nome && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.nome.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        CPF *
                      </label>
                      <input
                        type="text"
                        {...register("cpf")}
                        onChange={(e) => setValue("cpf", maskCPF(e.target.value), { shouldValidate: true })}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                      />
                      {errors.cpf && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.cpf.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Multi-Seleção de Perfil PF */}
                  <div>
                    <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                      Seu Perfil de Atuação (selecione todos que se aplicam) *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
                      {PERFIS_DISPONIVEIS.map((p) => {
                        const isSelected = perfil.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePerfil(p.id)}
                            className={`p-3 rounded-xl border text-left text-xs font-sans transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "bg-green/10 border-green text-white"
                                : "bg-black/40 border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            <span>{p.label}</span>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isSelected ? "bg-green border-green" : "border-white/20"}`}>
                              {isSelected && <Check className="w-3 h-3 text-navy font-bold" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {errors.perfil && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.perfil.message}</p>
                    )}
                  </div>

                  {/* Condicional Mototaxista / Diarista: Regiões de Atuação */}
                  {perfil.some(p => p === "mototaxista" || p === "diarista") && (
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2">
                      <label className="text-xs font-mono text-green uppercase tracking-wider block">
                        Regiões de Atuação (Mototáxi / Diarista) *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                        {REGIOES_UBATUBA.map((reg) => {
                          const isSelected = regiaoAtuacaoPf.includes(reg);
                          return (
                            <button
                              key={reg}
                              type="button"
                              onClick={() => toggleRegiao("regiao_atuacao_pf", reg)}
                              className={`py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-green text-navy border-green font-bold"
                                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                              }`}
                            >
                              {reg}
                            </button>
                          );
                        })}
                      </div>
                      {errors.regiao_atuacao_pf && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.regiao_atuacao_pf.message}</p>
                      )}
                    </div>
                  )}

                  {/* SELEÇÃO RESPONSIVA DE BAIRROS E PRAIAS (MODAL / FULLSCREEN) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="text-xs font-mono text-green uppercase tracking-wider block font-semibold">
                          Bairros e Praias de Atuação / Residência *
                        </span>
                        <p className="text-[11px] text-white/50 font-sans">
                          Escolha as localidades onde você mora, trabalha ou frequenta em Ubatuba.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-white/60 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 self-start sm:self-auto">
                        {(bairros?.length || 0) + (praias?.length || 0)} selecionado(s)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsLocationModalOpen(true)}
                      className="w-full py-3.5 px-4 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 hover:border-green text-white text-xs sm:text-sm font-sans flex items-center justify-between gap-3 transition-all cursor-pointer shadow-inner group active:scale-98"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-8 h-8 rounded-lg bg-green/10 border border-green/30 flex items-center justify-center text-green shrink-0">
                          <MapPin className="w-4 h-4 text-green" />
                        </div>
                        <span className="font-semibold text-white truncate">
                          {(bairros?.length || 0) + (praias?.length || 0) === 0
                            ? "Selecionar Bairros e Praias..."
                            : `Selecionar Bairros e Praias (${(bairros?.length || 0) + (praias?.length || 0)} selecionados)`}
                        </span>
                      </div>
                      <span className="text-[11px] text-green font-mono uppercase tracking-wider font-semibold group-hover:underline shrink-0">
                        Abrir Seleção →
                      </span>
                    </button>

                    {/* Preview dos Itens Selecionados */}
                    {((bairros?.length || 0) + (praias?.length || 0)) > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {bairros.slice(0, 5).map((b) => (
                          <span
                            key={`preview-b-${b}`}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/80 font-sans flex items-center gap-1.5"
                          >
                            <span className="text-white/40 text-[9px] font-mono uppercase">Bairro</span>
                            <span>{b}</span>
                          </span>
                        ))}
                        {praias.slice(0, 5).map((p) => (
                          <span
                            key={`preview-p-${p}`}
                            className="px-2.5 py-1 rounded-lg bg-green/10 border border-green/20 text-[11px] text-green font-sans flex items-center gap-1.5"
                          >
                            <span className="text-green/60 text-[9px] font-mono uppercase">Praia</span>
                            <span>{p}</span>
                          </span>
                        ))}
                        {((bairros?.length || 0) + (praias?.length || 0)) > 10 && (
                          <span className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-white/50 font-mono">
                            + {((bairros?.length || 0) + (praias?.length || 0)) - 10} outros
                          </span>
                        )}
                      </div>
                    )}

                    {(errors.bairros || errors.praias) && (
                      <p className="text-[11px] text-red-400 mt-0.5">
                        {errors.bairros?.message || errors.praias?.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* CAMPOS PESSOA JURÍDICA */}
              {tipoPessoa === "PJ" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        Nome da Associação ou Razão Social *
                      </label>
                      <input
                        type="text"
                        {...register("nome_empresa")}
                        placeholder="Nome da Associação ou Empresa"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-sans outline-none"
                      />
                      {errors.nome_empresa && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.nome_empresa.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        CNPJ *
                      </label>
                      <input
                        type="text"
                        {...register("cnpj")}
                        onChange={(e) => setValue("cnpj", maskCNPJ(e.target.value), { shouldValidate: true })}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                      />
                      {errors.cnpj && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.cnpj.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        Nome do Responsável Legal *
                      </label>
                      <input
                        type="text"
                        {...register("responsavel_legal")}
                        placeholder="Nome completo do responsável"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-sans outline-none"
                      />
                      {errors.responsavel_legal && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.responsavel_legal.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                        CPF do Responsável Legal *
                      </label>
                      <input
                        type="text"
                        {...register("cpf_responsavel")}
                        onChange={(e) => setValue("cpf_responsavel", maskCPF(e.target.value), { shouldValidate: true })}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                      />
                      {errors.cpf_responsavel && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.cpf_responsavel.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Região de Atuação PJ */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2">
                    <label className="text-xs font-mono text-green uppercase tracking-wider block">
                      Regiões de Atuação / Abrangência *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                      {REGIOES_UBATUBA.map((reg) => {
                        const isSelected = regiaoAtuacaoPj.includes(reg);
                        return (
                          <button
                            key={reg}
                            type="button"
                            onClick={() => toggleRegiao("regiao_atuacao_pj", reg)}
                            className={`py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-green text-navy border-green font-bold"
                                : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            {reg}
                          </button>
                        );
                      })}
                    </div>
                    {errors.regiao_atuacao_pj && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.regiao_atuacao_pj.message}</p>
                    )}
                  </div>
                </>
              )}

              {/* CONTATOS (E-MAIL & WHATSAPP) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                    E-mail Principal *
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="seu.email@exemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-sans outline-none"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-mono text-white/70 uppercase tracking-wider block mb-1.5">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    {...register("telefone")}
                    onChange={(e) => setValue("telefone", maskPhone(e.target.value), { shouldValidate: true })}
                    placeholder="(12) 99999-9999"
                    maxLength={15}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                  />
                  {errors.telefone && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.telefone.message}</p>
                  )}
                </div>
              </div>

              {/* CRIAÇÃO DE SENHA DEFINITIVA */}
              <div className="p-4 rounded-2xl bg-[#090E1F] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green" />
                  <span className="text-xs font-mono text-green uppercase tracking-wider font-semibold">
                    Criação de Senha de Acesso (Mínimo 6 caracteres) *
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      {...register("senha")}
                      placeholder="Crie sua senha segura"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {errors.senha && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.senha.message}</p>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      {...register("confirmarSenha")}
                      placeholder="Confirme sua senha"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {errors.confirmarSenha && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.confirmarSenha.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* MERCADO PAGO & CHAVE PIX */}
              <div className="p-4 rounded-2xl bg-[#090E1F] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-mono text-white/70 uppercase tracking-wider block">
                  Você possui conta no Mercado Pago? *
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue("possuiContaMercadoPago", true, { shouldValidate: true })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-display font-bold uppercase transition-all cursor-pointer ${
                      possuiContaMercadoPago === true
                        ? "bg-green text-navy border-green font-bold shadow-md shadow-green/10"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("possuiContaMercadoPago", false, { shouldValidate: true })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-display font-bold uppercase transition-all cursor-pointer ${
                      possuiContaMercadoPago === false
                        ? "bg-white/20 text-white border-white/30 font-bold"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    Não
                  </button>
                </div>

                {possuiContaMercadoPago === true && (
                  <div className="mt-2 p-3.5 rounded-xl bg-black/40 border border-green/30 flex flex-col gap-3 animate-in fade-in duration-200">
                    <span className="text-[11px] text-green font-mono uppercase tracking-wider font-semibold">
                      Chave Pix para Repasses Automáticos:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <select
                          {...register("tipo_chave_pix")}
                          onChange={(e) => {
                            setValue("tipo_chave_pix", e.target.value, { shouldValidate: true });
                            setValue("chave_pix", "", { shouldValidate: true });
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-black/80 border border-white/10 text-white text-xs font-sans outline-none focus:border-green"
                        >
                          <option value="">Selecione o tipo de Chave Pix...</option>
                          <option value="cpf">CPF</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="email">E-mail</option>
                          <option value="telefone">Celular / Telefone</option>
                          <option value="aleatoria">Chave Aleatória</option>
                        </select>
                        {errors.tipo_chave_pix && (
                          <p className="text-[11px] text-red-400 mt-1">{errors.tipo_chave_pix.message}</p>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          {...register("chave_pix")}
                          value={chavePix || ""}
                          onChange={(e) => {
                            const masked = applyPixMask(e.target.value, tipoChavePix);
                            setValue("chave_pix", masked, { shouldValidate: true });
                          }}
                          placeholder={getPixPlaceholder(tipoChavePix)}
                          maxLength={getPixMaxLength(tipoChavePix)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-white/10 focus:border-green text-white text-xs font-mono outline-none"
                        />
                        {errors.chave_pix && (
                          <p className="text-[11px] text-red-400 mt-1">{errors.chave_pix.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACEITE TERMOS & LGPD */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  {...register("acceptTerms")}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-green focus:ring-green accent-green cursor-pointer"
                />
                <label htmlFor="acceptTerms" className="text-xs text-white/70 font-sans cursor-pointer leading-relaxed">
                  Declaro que as informações acima são verdadeiras e concordo com os{" "}
                  <span className="text-green underline">Termos de Uso</span> e a{" "}
                  <span className="text-green underline">Política de Privacidade (LGPD)</span> da UBT Serviços.
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-[11px] text-red-400 -mt-3">{errors.acceptTerms.message}</p>
              )}

              {/* Erro Geral de Submissão */}
              {submitError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* BOTÃO PRINCIPAL DE ENVIO */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-green hover:bg-green-dark text-navy font-display font-extrabold text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-green/20 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-navy" />
                    <span>Atualizando dados e criando acesso...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Concluir Cadastro e Ativar Acesso</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Rodapé Simples */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-4 text-center text-xs text-white/40 font-mono">
        UBT Serviços • O Superapp da Praia • Ubatuba, SP
      </footer>

      {/* ========================================================================= */}
      {/* MODAL RESPONSIVO DE SELEÇÃO MÚLTIPLA DE BAIRROS E PRAIAS                  */}
      {/* ========================================================================= */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-xl rounded-none sm:rounded-3xl bg-[#0B1329] border-0 sm:border border-white/15 shadow-2xl flex flex-col overflow-hidden text-left">
            {/* Header do Modal */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#0E1733] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green/10 border border-green/30 flex items-center justify-center text-green shrink-0">
                  <MapPin className="w-4 h-4 text-green" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white leading-tight">
                    Bairros e Praias de Ubatuba
                  </h3>
                  <p className="text-[11px] text-white/50 font-sans">
                    {(bairros?.length || 0) + (praias?.length || 0)} localidade(s) selecionada(s)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Fechar seleção de bairros e praias"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Pesquisa e Filtros */}
            <div className="p-3 sm:p-4 border-b border-white/5 flex flex-col gap-2.5 bg-[#080D1F] shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Buscar por bairro ou praia..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/60 border border-white/10 focus:border-green text-white text-xs sm:text-sm font-sans outline-none placeholder:text-white/30"
                  autoFocus
                />
                {locationSearch && (
                  <button
                    type="button"
                    onClick={() => setLocationSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tabs de Filtro */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setLocationTab("todos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer shrink-0 ${
                    locationTab === "todos"
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Todos ({filteredBairros.length + filteredPraias.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLocationTab("bairros")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer shrink-0 ${
                    locationTab === "bairros"
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Bairros ({filteredBairros.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLocationTab("praias")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer shrink-0 ${
                    locationTab === "praias"
                      ? "bg-white/15 text-white font-bold"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Praias ({filteredPraias.length})
                </button>
              </div>
            </div>

            {/* Lista com Rolagem Vertical */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-white/5">
              {(locationTab === "todos" || locationTab === "bairros") && (
                <div className="mb-2">
                  {locationTab === "todos" && filteredBairros.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-white/40 bg-white/[0.02] rounded-md mb-1">
                      Bairros ({filteredBairros.length})
                    </div>
                  )}
                  {filteredBairros.map((b) => {
                    const isSelected = bairros.includes(b);
                    return (
                      <div
                        key={`modal-b-${b}`}
                        onClick={() => toggleLocationItem(b, "bairro")}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? "bg-green/10 text-white" : "hover:bg-white/5 text-white/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected ? "bg-green border-green text-navy" : "border-white/20 bg-black/40"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs sm:text-sm font-sans font-medium">{b}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/5 shrink-0">
                          Bairro
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(locationTab === "todos" || locationTab === "praias") && (
                <div>
                  {locationTab === "todos" && filteredPraias.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-green/60 bg-green/[0.02] rounded-md mb-1">
                      Praias ({filteredPraias.length})
                    </div>
                  )}
                  {filteredPraias.map((p) => {
                    const isSelected = praias.includes(p);
                    return (
                      <div
                        key={`modal-p-${p}`}
                        onClick={() => toggleLocationItem(p, "praia")}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? "bg-green/10 text-white" : "hover:bg-white/5 text-white/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected ? "bg-green border-green text-navy" : "border-white/20 bg-black/40"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs sm:text-sm font-sans font-medium">{p}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-green/10 text-green/80 border border-green/20 shrink-0">
                          Praia
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredBairros.length === 0 && filteredPraias.length === 0 && (
                <div className="py-12 text-center text-xs font-mono text-white/40">
                  Nenhum bairro ou praia localizado para &quot;{locationSearch}&quot;.
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-[#0E1733] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={clearAllLocations}
                className="px-3 py-2 text-xs font-mono text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                Limpar Seleção
              </button>

              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-5 py-3 rounded-xl bg-green hover:bg-green-dark text-navy font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-green/20 active:scale-98"
              >
                Confirmar Seleção ({(bairros?.length || 0) + (praias?.length || 0)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
