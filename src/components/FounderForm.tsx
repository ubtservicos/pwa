import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Building2,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  MapPin,
  X,
  Loader2,
  Send,
  Users,
  Search,
  Sparkles,
  Compass
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
  isValidEmail,
  generateReferralSlug
} from "@/utils/masks";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export const BAIRROS_LIST = [
  "Acaraú",
  "Águas do Ingá",
  "Aracaú",
  "Arariba",
  "Bairro das Palmeiras",
  "Bairro do Tenório",
  "Bairro Silop",
  "Barra da Lagoa",
  "Barra Seca",
  "Bela Vista",
  "Camburi",
  "Caçandoca",
  "Casanga",
  "Centro",
  "Centro (Picinguaba)",
  "Corcovado",
  "Estufa I",
  "Estufa II",
  "Figueira",
  "Folha Seca",
  "Galhetas",
  "Horto Florestal",
  "Iperoig",
  "Ipiranguinha",
  "Itaguá",
  "Itamambuca",
  "Jardim Carolina",
  "Jardim Enseada",
  "Jardim Marisol",
  "Jardim Samambaia",
  "Jardim Santa Luzia",
  "Jardim Ubatuba",
  "Lagoinha",
  "Marafunda",
  "Maranduba",
  "Mato Dentro",
  "Monte Valério",
  "Park Hills",
  "Pedreira",
  "Perequê-Açu",
  "Perequê-Mirim",
  "Picinguaba",
  "Ponta Aguda",
  "Ponta Grossa",
  "Praia Grande",
  "Praia Vermelha",
  "Promirim",
  "Prumirim",
  "Puruba",
  "Ressaca",
  "Rio da Prata",
  "Rio Escuro",
  "Saco da Ribeira",
  "Sapê",
  "Sertão da Quina",
  "Sertão do Ingá",
  "Sertão do Meio",
  "Sertão do Ubatumirim",
  "Sesmaria",
  "Sumaré",
  "Taquaral",
  "Tenório",
  "Toninhas",
  "Ubatumirim",
  "Umuarama",
  "Vale do Sol",
  "Vila Nova",
  "Área Rural de Ubatuba"
].sort((a, b) => a.localeCompare(b, "pt-BR"));

export const PRAIAS_LIST = [
  "Almada",
  "Alto",
  "Barra",
  "Barra Seca",
  "Bonete",
  "Brava da Almada",
  "Brava da Fortaleza",
  "Brava de Itamambuca",
  "Brava do Camburi",
  "Brava do Sul",
  "Caçandoca",
  "Caçandoquinha",
  "Camburi",
  "Cedrinho",
  "Cedro do Sul",
  "Cruzeiro (Iperoig)",
  "Deserto",
  "Domingas Dias",
  "Dura",
  "Engenho",
  "Enseada",
  "Fazenda",
  "Félix",
  "Figueira",
  "Flamengo",
  "Fortaleza",
  "Grande do Bonete",
  "Itaguá",
  "Itamambuca",
  "Justa",
  "Lagoinha",
  "Lamberto",
  "Lázaro",
  "Maranduba",
  "Meio",
  "Perequê-Açu",
  "Perequê-Mirim",
  "Picinguaba",
  "Ponta Aguda",
  "Praia Grande",
  "Prumirim",
  "Pulso",
  "Puruba",
  "Ribeira",
  "Santa Rita",
  "Sapê",
  "Sete Fontes",
  "Sununga",
  "Tenório",
  "Toninhas",
  "Ubatumirim",
  "Vermelha do Centro",
  "Vermelha do Norte",
  "Vermelha do Sul"
].sort((a, b) => a.localeCompare(b, "pt-BR"));

export const REGIOES_UBATUBA = ["Sul", "Centro", "Norte", "Oeste"];

export const PERFIS_PF_LIST = [
  { id: "morador", label: "Morador / Consumidor", icon: "🏡" },
  { id: "turista", label: "Turista / Visitante", icon: "🧳" },
  { id: "ambulante", label: "Ambulante de Praia", icon: "🏖️" },
  { id: "mototaxista", label: "Mototaxista", icon: "🏍️" },
  { id: "diarista", label: "Diarista / Faxina", icon: "🧹" },
];

export const founderFormSchema = z.object({
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

  // Campos Comuns de Contato & Autenticação
  telefone: z.string().min(10, "Informe um WhatsApp válido com DDD"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmarSenha: z.string().min(1, "Confirme sua senha"),

  // Chave Pix & Mercado Pago
  possuiContaMercadoPago: z.boolean({ required_error: "Informe se possui conta no Mercado Pago" }),
  tipo_chave_pix: z.string().optional().default(""),
  chave_pix: z.string().optional().default(""),

  // 1. CAMPOS GEOGRÁFICOS CONDICIONAIS
  regioes: z.array(z.string()).default([]),
  bairro_residencia: z.string().default(""),
  bairros_atuacao: z.array(z.string()).default([]),
  bairros_hospedagem: z.array(z.string()).default([]),
  praias: z.array(z.string()).default([]),

  // Compatibilidade Legada
  bairros: z.array(z.string()).default([]),
  bairro_trabalho: z.array(z.string()).default([]),
  regiao_atuacao_pf: z.array(z.string()).default([]),
  regiao_atuacao_pj: z.array(z.string()).default([]),

  acceptTerms: z.boolean().refine(v => v === true, "Você deve aceitar os termos de uso"),
}).superRefine((data, ctx) => {
  // 1. Validação de Senha
  if (data.senha !== data.confirmarSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "As senhas não coincidem",
      path: ["confirmarSenha"],
    });
  }

  // 2. Validação se Pessoa Física (PF)
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
        message: "CPF deve ter exatamente 11 dígitos",
        path: ["cpf"],
      });
    }

    if (!data.perfil || data.perfil.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos um perfil de atuação",
        path: ["perfil"],
      });
    } else {
      const hasMorador = data.perfil.includes("morador");
      const hasTurista = data.perfil.includes("turista");
      const hasAmbulante = data.perfil.includes("ambulante");
      const hasMototaxista = data.perfil.includes("mototaxista");
      const hasDiarista = data.perfil.includes("diarista");

      // Bairro de Residência (Obrigatório para Morador e Diarista)
      if (hasMorador || hasDiarista) {
        if (!data.bairro_residencia || data.bairro_residencia.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione o seu bairro de residência em Ubatuba",
            path: ["bairro_residencia"],
          });
        }
      }

      // Bairros de Hospedagem (Obrigatório para Turista quando não é Morador)
      if (hasTurista && !hasMorador) {
        if ((!data.bairros_hospedagem || data.bairros_hospedagem.length === 0) && (!data.bairro_residencia || data.bairro_residencia.trim() === "")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione ao menos um bairro onde costuma se hospedar em Ubatuba",
            path: ["bairros_hospedagem"],
          });
        }
      }

      // Região / Zona de Atuação (Obrigatório para Ambulante, Mototaxista e Diarista)
      if (hasAmbulante || hasMototaxista || hasDiarista) {
        if (!data.regioes || data.regioes.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione ao menos uma Zona / Região de atuação (Sul, Centro, Norte ou Oeste)",
            path: ["regioes"],
          });
        }
      }

      // Praias de Atuação (Obrigatório para Ambulante)
      if (hasAmbulante) {
        if (!data.praias || data.praias.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ambulante de praia deve selecionar ao menos uma praia de atuação",
            path: ["praias"],
          });
        }
      }
    }
  }

  // 3. Validação se Pessoa Jurídica (PJ)
  if (data.tipoPessoa === "PJ") {
    if (!data.nome_empresa || data.nome_empresa.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a Razão Social ou Nome Fantasia da empresa",
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
        message: "Informe o nome do responsável legal da empresa",
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

    if (!data.bairro_residencia || data.bairro_residencia.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o bairro da sede da empresa em Ubatuba",
        path: ["bairro_residencia"],
      });
    }

    if (!data.regioes || data.regioes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma Zona / Região de atuação da empresa",
        path: ["regioes"],
      });
    }
  }

  // 4. Validação da Chave Pix (se possui conta no Mercado Pago)
  if (data.possuiContaMercadoPago === true) {
    if (!data.tipo_chave_pix || data.tipo_chave_pix.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o tipo de Chave Pix (CPF, CNPJ, E-mail, Celular ou Aleatória)",
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
            message: "Telefone inválido para Pix. Digite DDD + 8 ou 9 dígitos.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "cpf") {
        if (!isValidCPF(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CPF inválido para Pix. Verifique os dígitos informados.",
            path: ["chave_pix"],
          });
        }
      } else if (tipo === "cnpj") {
        if (!isValidCNPJ(chave)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CNPJ inválido para Pix. Verifique os dígitos informados.",
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

export type FounderFormData = z.infer<typeof founderFormSchema>;

export interface FounderFormProps {
  isUpdateMode?: boolean;
  leadRecord?: any;
  submitButtonText?: string;
  hideAlreadyRegisteredButton?: boolean;
  onSuccess?: (data?: any) => void;
  onClose?: () => void;
  defaultValues?: Partial<FounderFormData>;
  className?: string;
}

// Funções utilitárias de fingerprinting anonimizado
async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = (hash << 5) - hash + message.charCodeAt(i);
      hash |= 0;
    }
    return "fb_" + Math.abs(hash).toString(16) + Math.random().toString(36).substring(2, 10);
  }
}

function parseUserAgent(userAgent: string) {
  let device_type = "Desktop";
  if (/mobile/i.test(userAgent)) device_type = "Mobile";
  if (/tablet/i.test(userAgent)) device_type = "Tablet";

  let browser = "Outro";
  if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edge|edg/i.test(userAgent)) browser = "Edge";

  let os = "Outro";
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "MacOS";
  else if (/android/i.test(userAgent)) os = "Android";

  return { device_type, browser, os };
}

export default function FounderForm({
  isUpdateMode = false,
  leadRecord = null,
  submitButtonText,
  hideAlreadyRegisteredButton = false,
  onSuccess,
  onClose,
  defaultValues = {},
  className = ""
}: FounderFormProps) {
  const navigate = useNavigate();

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Modais de Seleção Geográfica Dedicados e Isolados
  const [isBairroResidenciaModalOpen, setIsBairroResidenciaModalOpen] = useState(false);
  const [bairroResidenciaSearch, setBairroResidenciaSearch] = useState("");

  const [isBairrosAtuacaoModalOpen, setIsBairrosAtuacaoModalOpen] = useState(false);
  const [bairrosAtuacaoSearch, setBairrosAtuacaoSearch] = useState("");

  const [isBairrosHospedagemModalOpen, setIsBairrosHospedagemModalOpen] = useState(false);
  const [bairrosHospedagemSearch, setBairrosHospedagemSearch] = useState("");

  const [isPraiasModalOpen, setIsPraiasModalOpen] = useState(false);
  const [praiasSearch, setPraiasSearch] = useState("");

  // Rótulo padrão do botão final
  const finalButtonText = submitButtonText || (isUpdateMode ? "Concluir cadastro" : "Quero ser um Fundador");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<FounderFormData>({
    resolver: zodResolver(founderFormSchema),
    defaultValues: {
      tipoPessoa: "PF",
      nome: "",
      cpf: "",
      perfil: ["morador"],
      nome_empresa: "",
      cnpj: "",
      responsavel_legal: "",
      cpf_responsavel: "",
      telefone: "",
      email: "",
      senha: "",
      confirmarSenha: "",
      possuiContaMercadoPago: false,
      tipo_chave_pix: "",
      chave_pix: "",
      regioes: [],
      bairro_residencia: "",
      bairros_atuacao: [],
      bairros_hospedagem: [],
      praias: [],
      bairros: [],
      bairro_trabalho: [],
      regiao_atuacao_pf: [],
      regiao_atuacao_pj: [],
      acceptTerms: true,
      ...defaultValues
    }
  });

  // Carregamento reativo quando leadRecord ou defaultValues mudam
  useEffect(() => {
    if ((defaultValues && Object.keys(defaultValues).length > 0) || leadRecord) {
      const isPJ = (defaultValues.tipoPessoa || leadRecord?.tipo_pessoa) === "PJ" || !!leadRecord?.cnpj;
      const perfList = defaultValues.perfil || (Array.isArray(leadRecord?.perfil) ? leadRecord.perfil : (leadRecord?.perfil ? [leadRecord.perfil] : ["morador"]));

      // Regiões / Zonas
      const rawRegiaoStr = leadRecord?.regiao_atuacao || "";
      const regListFromStr = rawRegiaoStr ? rawRegiaoStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      const regioesResolved = defaultValues.regioes && defaultValues.regioes.length > 0
        ? defaultValues.regioes
        : (Array.isArray(leadRecord?.regioes) ? leadRecord.regioes : regListFromStr);

      // Bairro de Residência (Select Único)
      const bResResolved = defaultValues.bairro_residencia
        || leadRecord?.bairro_residencia
        || leadRecord?.bairro_moradia
        || (Array.isArray(leadRecord?.bairros) && leadRecord.bairros.length > 0 ? leadRecord.bairros[0] : "")
        || (defaultValues.bairros && defaultValues.bairros.length > 0 ? defaultValues.bairros[0] : "");

      // Bairros de Atuação / Trabalho (Múltipla Seleção)
      const rawBairroTrabStr = leadRecord?.bairro_trabalho || "";
      const bTrabFromStr = rawBairroTrabStr ? rawBairroTrabStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      const bAtuacaoResolved = defaultValues.bairros_atuacao && defaultValues.bairros_atuacao.length > 0
        ? defaultValues.bairros_atuacao
        : (Array.isArray(leadRecord?.bairros_atuacao) ? leadRecord.bairros_atuacao : bTrabFromStr);

      // Bairros de Hospedagem (Turista)
      const rawBairroHospStr = leadRecord?.bairro_hospedagem || "";
      const bHospFromStr = rawBairroHospStr ? rawBairroHospStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      const bHospResolved = defaultValues.bairros_hospedagem && defaultValues.bairros_hospedagem.length > 0
        ? defaultValues.bairros_hospedagem
        : (Array.isArray(leadRecord?.bairros_hospedagem) ? leadRecord.bairros_hospedagem : bHospFromStr);

      // Praias
      const praiasResolved = defaultValues.praias && defaultValues.praias.length > 0
        ? defaultValues.praias
        : (Array.isArray(leadRecord?.praias_frequenta) ? leadRecord.praias_frequenta : (Array.isArray(leadRecord?.praias) ? leadRecord.praias : []));

      const combinedBairros = [bResResolved, ...bAtuacaoResolved, ...bHospResolved].filter(Boolean);

      reset({
        tipoPessoa: isPJ ? "PJ" : "PF",
        nome: defaultValues.nome || leadRecord?.nome || "",
        cpf: defaultValues.cpf ? maskCPF(defaultValues.cpf) : (leadRecord?.cpf ? maskCPF(leadRecord.cpf) : ""),
        perfil: perfList,
        nome_empresa: defaultValues.nome_empresa || leadRecord?.razao_social || leadRecord?.nome || "",
        cnpj: defaultValues.cnpj ? maskCNPJ(defaultValues.cnpj) : (leadRecord?.cnpj ? maskCNPJ(leadRecord.cnpj) : ""),
        responsavel_legal: defaultValues.responsavel_legal || leadRecord?.responsavel_legal || "",
        cpf_responsavel: defaultValues.cpf_responsavel ? maskCPF(defaultValues.cpf_responsavel) : (leadRecord?.cpf_responsavel ? maskCPF(leadRecord.cpf_responsavel) : ""),
        telefone: defaultValues.telefone ? maskPhone(defaultValues.telefone) : (leadRecord?.telefone ? maskPhone(leadRecord.telefone) : ""),
        email: defaultValues.email || leadRecord?.email || "",
        senha: defaultValues.senha || "",
        confirmarSenha: defaultValues.confirmarSenha || "",
        possuiContaMercadoPago: defaultValues.possuiContaMercadoPago ?? (typeof leadRecord?.possui_conta_mercado_pago === "boolean" ? leadRecord.possui_conta_mercado_pago : false),
        tipo_chave_pix: defaultValues.tipo_chave_pix || leadRecord?.tipo_chave_pix || "",
        chave_pix: defaultValues.chave_pix || (leadRecord?.chave_pix ? applyPixMask(leadRecord.chave_pix, leadRecord.tipo_chave_pix) : ""),
        regioes: regioesResolved,
        bairro_residencia: bResResolved,
        bairros_atuacao: bAtuacaoResolved,
        bairros_hospedagem: bHospResolved,
        praias: praiasResolved,
        bairros: combinedBairros,
        bairro_trabalho: bAtuacaoResolved,
        regiao_atuacao_pf: regioesResolved,
        regiao_atuacao_pj: regioesResolved,
        acceptTerms: true,
      });
    }
  }, [defaultValues, leadRecord, reset]);

  const tipoPessoa = watch("tipoPessoa");
  const perfil = watch("perfil") || [];
  const possuiContaMercadoPago = watch("possuiContaMercadoPago");
  const tipoChavePix = watch("tipo_chave_pix");
  const chavePix = watch("chave_pix");

  // Watches dos Campos Geográficos
  const regioes = watch("regioes") || [];
  const bairroResidencia = watch("bairro_residencia") || "";
  const bairrosAtuacao = watch("bairros_atuacao") || [];
  const bairrosHospedagem = watch("bairros_hospedagem") || [];
  const praias = watch("praias") || [];

  // =========================================================================
  // 1. REGRAS CONDICIONAIS DE CAMPOS GEOGRÁFICOS POR PERFIL (UNIÃO LÓGICA)
  // =========================================================================
  const isPF = tipoPessoa === "PF";
  const isPJ = tipoPessoa === "PJ";

  const hasMorador = isPF && perfil.includes("morador");
  const hasTurista = isPF && perfil.includes("turista");
  const hasAmbulante = isPF && perfil.includes("ambulante");
  const hasMototaxista = isPF && perfil.includes("mototaxista");
  const hasDiarista = isPF && perfil.includes("diarista");

  // Região / Zona de Atuação: Ambulante, Mototaxista, Diarista, PJ
  const showRegioes = isPJ || hasAmbulante || hasMototaxista || hasDiarista;

  // Bairro de Residência (Único, Obrigatório): Morador, Diarista, PJ (sede)
  const showBairroResidencia = isPJ || hasMorador || hasDiarista;

  // Bairros de Trabalho (Múltipla Escolha, Opcional): Morador
  const showBairrosTrabalho = hasMorador;

  // Bairros de Hospedagem (Múltipla Escolha): Turista
  const showBairrosHospedagem = hasTurista;

  // Praias (Múltipla Escolha): Morador, Turista, Ambulante
  const showPraias = hasMorador || hasTurista || hasAmbulante;
  const praiasLabel = hasAmbulante && !hasMorador && !hasTurista
    ? "Praias que Costuma Atuar"
    : (hasAmbulante ? "Praias que Costuma Atuar / Frequentar" : "Praias que Costuma Frequentar");

  // =========================================================================
  // LÓGICA INTELIGENTE DA CHAVE PIX (MERCADO PAGO)
  // =========================================================================
  const applySmartPixAutofill = (tipo: string) => {
    const currentEmail = (watch("email") || defaultValues.email || leadRecord?.email || "").trim().toLowerCase();
    const currentCpf = (watch("cpf") || watch("cpf_responsavel") || defaultValues.cpf || leadRecord?.cpf || "").trim();
    const currentCnpj = (watch("cnpj") || defaultValues.cnpj || leadRecord?.cnpj || "").trim();
    const currentTel = (watch("telefone") || defaultValues.telefone || leadRecord?.telefone || "").trim();

    if (tipo === "cpf") {
      const clean = currentCpf.replace(/\D/g, "");
      if (clean) {
        setValue("chave_pix", maskCPF(clean), { shouldValidate: true });
      }
    } else if (tipo === "email") {
      if (currentEmail) {
        setValue("chave_pix", currentEmail, { shouldValidate: true });
      }
    } else if (tipo === "telefone" || tipo === "celular") {
      const onlyDigits = currentTel.replace(/\D/g, "");
      if (onlyDigits) {
        setValue("chave_pix", onlyDigits, { shouldValidate: true });
      }
    } else if (tipo === "cnpj") {
      const clean = currentCnpj.replace(/\D/g, "");
      if (clean) {
        setValue("chave_pix", maskCNPJ(clean), { shouldValidate: true });
      }
    }
  };

  const handleTipoChavePixChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTipo = e.target.value;
    setValue("tipo_chave_pix", newTipo, { shouldValidate: true });
    setValue("chave_pix", "", { shouldValidate: true });
    if (newTipo) {
      applySmartPixAutofill(newTipo);
    }
  };

  const handleMercadoPagoToggle = (value: boolean) => {
    setValue("possuiContaMercadoPago", value, { shouldValidate: true });
    if (value && tipoChavePix) {
      applySmartPixAutofill(tipoChavePix);
    }
  };

  // Alternador de Regiões / Zonas (Múltipla Seleção)
  const toggleRegiao = (reg: string) => {
    const exists = regioes.includes(reg);
    const next = exists ? regioes.filter(r => r !== reg) : [...regioes, reg];
    setValue("regioes", next, { shouldValidate: true });
    setValue("regiao_atuacao_pf", next);
    setValue("regiao_atuacao_pj", next);
  };

  // Alternador de Perfil PF
  const togglePerfil = (id: string) => {
    const exists = perfil.includes(id);
    const next = exists ? perfil.filter(p => p !== id) : [...perfil, id];
    setValue("perfil", next, { shouldValidate: true });
  };

  // Seleção de Bairro de Residência (Select Único)
  const selectBairroResidencia = (bairro: string) => {
    setValue("bairro_residencia", bairro, { shouldValidate: true });
    const currentCombined = [bairro, ...bairrosAtuacao, ...bairrosHospedagem].filter(Boolean);
    setValue("bairros", currentCombined);
    setIsBairroResidenciaModalOpen(false);
    setBairroResidenciaSearch("");
  };

  // Alternador de Bairros de Trabalho (Múltipla Seleção)
  const toggleBairroAtuacao = (bairro: string) => {
    const exists = bairrosAtuacao.includes(bairro);
    const next = exists ? bairrosAtuacao.filter(b => b !== bairro) : [...bairrosAtuacao, bairro];
    setValue("bairros_atuacao", next, { shouldValidate: true });
    setValue("bairro_trabalho", next);
    const currentCombined = [bairroResidencia, ...next, ...bairrosHospedagem].filter(Boolean);
    setValue("bairros", currentCombined);
  };

  // Alternador de Bairros de Hospedagem (Múltipla Seleção)
  const toggleBairroHospedagem = (bairro: string) => {
    const exists = bairrosHospedagem.includes(bairro);
    const next = exists ? bairrosHospedagem.filter(b => b !== bairro) : [...bairrosHospedagem, bairro];
    setValue("bairros_hospedagem", next, { shouldValidate: true });
    const currentCombined = [bairroResidencia, ...bairrosAtuacao, ...next].filter(Boolean);
    setValue("bairros", currentCombined);
  };

  // Alternador de Praias (Múltipla Seleção)
  const togglePraia = (praia: string) => {
    const exists = praias.includes(praia);
    const next = exists ? praias.filter(p => p !== praia) : [...praias, praia];
    setValue("praias", next, { shouldValidate: true });
  };

  // Ação de Fechar (Header Fixo)
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (isUpdateMode) {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Feedback imediato caso o formulário possua erros (onInvalid)
  const onInvalid = (formErrors: typeof errors) => {
    console.warn("[FounderForm] Erros de validação Zod:", formErrors);
    const errorKeys = Object.keys(formErrors) as (keyof FounderFormData)[];

    if (errorKeys.length > 0) {
      const firstErrKey = errorKeys[0];
      const firstErr = formErrors[firstErrKey];
      const msg = firstErr?.message ? String(firstErr.message) : "Preencha todos os campos obrigatórios.";
      toast.error(`Atenção: ${msg}`);

      const el = document.querySelector(`[name="${firstErrKey}"]`)
        || document.getElementById(`form-input-${firstErrKey}`)
        || document.getElementById(firstErrKey);

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  // =========================================================================
  // SUBMISSÃO PRINCIPAL
  // =========================================================================
  const onSubmit = async (values: FounderFormData) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const isPFMode = values.tipoPessoa === "PF";
      const cleanCpf = isPFMode && values.cpf ? values.cpf.replace(/\D/g, "") : null;
      const cleanCnpj = !isPFMode && values.cnpj ? values.cnpj.replace(/\D/g, "") : null;
      const cleanCpfResp = !isPFMode && values.cpf_responsavel ? values.cpf_responsavel.replace(/\D/g, "") : null;
      const nomeFinal = (isPFMode ? values.nome : values.nome_empresa)?.trim() || "";
      const perfilArray = isPFMode ? (values.perfil && values.perfil.length > 0 ? values.perfil : ["morador"]) : ["associacao"];
      const userRole = isPFMode ? (values.perfil?.[0] || "morador") : "associacao";

      const regioesArr = values.regioes && values.regioes.length > 0 ? values.regioes : [];
      const regiaoStr = regioesArr.length > 0 ? regioesArr.join(", ") : null;
      const bairroTrabStr = values.bairros_atuacao && values.bairros_atuacao.length > 0 ? values.bairros_atuacao.join(", ") : null;
      const bairroHospStr = values.bairros_hospedagem && values.bairros_hospedagem.length > 0 ? values.bairros_hospedagem.join(", ") : null;
      const bairrosCombined = [values.bairro_residencia, ...(values.bairros_atuacao || []), ...(values.bairros_hospedagem || [])].filter(Boolean);

      const chavePixFinal = values.possuiContaMercadoPago ? (values.chave_pix?.trim() || null) : null;
      const tipoChavePixFinal = values.possuiContaMercadoPago ? (values.tipo_chave_pix?.trim() || null) : null;

      // 1. Criação ou Autenticação na Sessão do Supabase Auth
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
            responsavel_legal: !isPFMode ? values.responsavel_legal?.trim() : null,
            cpf_responsavel: cleanCpfResp,
            regiao_atuacao: regiaoStr,
            regioes: regioesArr,
            bairro_residencia: values.bairro_residencia,
            bairros_atuacao: values.bairros_atuacao,
            bairros_hospedagem: values.bairros_hospedagem,
            praias: values.praias,
            chave_pix: chavePixFinal,
            tipo_chave_pix: tipoChavePixFinal,
          }
        }
      });

      if (authError) {
        console.warn("[FounderForm] Auth SignUp:", authError);
        const authMsg = authError.message?.toLowerCase() || "";
        const isDuplicate = authMsg.includes("already registered") ||
          authMsg.includes("already exists") ||
          authMsg.includes("user already exists");

        if (isDuplicate) {
          if (!isUpdateMode) {
            const cleanTel = (values.telefone || "").replace(/\D/g, "");
            const redirectParam = cleanTel || cleanCpf || encodeURIComponent(values.email.trim());
            toast.info("Você já possui uma inscrição! Redirecionando para atualizar seu cadastro e ativar sua senha...", { duration: 4000 });
            setTimeout(() => {
              navigate(`/atualizacao-cadastral?tel=${redirectParam}`);
            }, 1200);
            setIsSubmitting(false);
            return;
          } else {
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email: values.email.trim().toLowerCase(),
              password: values.senha,
            });
            if (!signInErr && signInData?.user) {
              authUserId = signInData.user.id;
            } else {
              authUserId = leadRecord?.user_id || leadRecord?.id || null;
            }
          }
        } else {
          throw authError;
        }
      } else {
        authUserId = authData?.user?.id || null;
      }

      if (!authUserId && leadRecord?.id) {
        authUserId = leadRecord.user_id || leadRecord.id;
      }

      // Observações descritivas
      const obsParts: string[] = [];
      obsParts.push(`Tipo: ${values.tipoPessoa}`);
      if (isUpdateMode) obsParts.push(`Atualizado via Link Seguro: Sim`);
      if (values.possuiContaMercadoPago !== undefined && values.possuiContaMercadoPago !== null) {
        obsParts.push(`Mercado Pago: ${values.possuiContaMercadoPago ? "Sim" : "Não"}`);
      }
      if (chavePixFinal) {
        obsParts.push(`Chave Pix (${tipoChavePixFinal}): ${chavePixFinal}`);
      }
      if (regiaoStr) {
        obsParts.push(`Zonas: ${regiaoStr}`);
      }
      if (values.bairro_residencia) {
        obsParts.push(`Residência: ${values.bairro_residencia}`);
      }
      if (bairroTrabStr) {
        obsParts.push(`Trabalho: ${bairroTrabStr}`);
      }
      if (bairroHospStr) {
        obsParts.push(`Hospedagem: ${bairroHospStr}`);
      }
      if (values.praias && values.praias.length > 0) {
        obsParts.push(`Praias: ${values.praias.join(", ")}`);
      }
      const obsText = obsParts.join(" | ");

      // =====================================================================
      // MODO ATUALIZAÇÃO CADASTRAL
      // =====================================================================
      if (isUpdateMode) {
        const waitlistUpdateData: any = {
          user_id: authUserId,
          tipo_pessoa: values.tipoPessoa,
          nome: nomeFinal,
          cpf: cleanCpf,
          cnpj: cleanCnpj,
          razao_social: !isPFMode ? values.nome_empresa?.trim() : null,
          responsavel_legal: !isPFMode ? values.responsavel_legal?.trim() : null,
          cpf_responsavel: cleanCpfResp,
          email: values.email.trim().toLowerCase(),
          telefone: values.telefone.trim(),
          cidade: "Ubatuba",
          perfil: perfilArray,
          regiao_atuacao: regiaoStr,
          regioes: regioesArr,
          bairro_residencia: values.bairro_residencia,
          bairro_moradia: values.bairro_residencia,
          bairros_atuacao: values.bairros_atuacao,
          bairro_trabalho: bairroTrabStr,
          bairro_hospedagem: bairroHospStr,
          bairros_hospedagem: values.bairros_hospedagem,
          bairros: bairrosCombined,
          praias: values.praias,
          praias_frequenta: values.praias && values.praias.length > 0 ? values.praias : null,
          possui_conta_mercado_pago: typeof values.possuiContaMercadoPago === "boolean" ? values.possuiContaMercadoPago : null,
          chave_pix: chavePixFinal,
          tipo_chave_pix: tipoChavePixFinal,
          observacoes: obsText,
          cadastro_completo: true,
          status: "completo",
          updated_at: new Date().toISOString(),
        };

        try {
          const { error: rpcErr } = await supabase.rpc("concluir_atualizacao_cadastral", {
            p_lead_id: leadRecord?.id || null,
            p_dados: waitlistUpdateData,
          });

          if (rpcErr) {
            console.warn("[FounderForm] RPC concluir_atualizacao_cadastral fallback direto:", rpcErr);
            if (leadRecord?.id) {
              await supabase
                .from("waitlist")
                .update(waitlistUpdateData)
                .eq("id", leadRecord.id);
            }
          }
        } catch (saveErr) {
          console.warn("[FounderForm] Exceção ao persistir waitlist:", saveErr);
        }

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
              responsavel_legal: !isPFMode ? values.responsavel_legal?.trim() : null,
              cpf_responsavel: cleanCpfResp,
              regiao_atuacao: regiaoStr,
              chave_pix: chavePixFinal,
              tipo_chave_pix: tipoChavePixFinal,
              bairro_moradia: values.bairro_residencia,
              bairro_trabalho: bairroTrabStr,
              praias_frequenta: values.praias && values.praias.length > 0 ? values.praias : null,
              status: "completo",
            } as any);
          } catch (syncErr) {
            console.warn("[FounderForm] Sincronização usuarios:", syncErr);
          }
        }

        try {
          await supabase.auth.signInWithPassword({
            email: values.email.trim().toLowerCase(),
            password: values.senha,
          });
        } catch (loginErr) {
          // Sessão já pode estar ativa
        }

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        toast.success("Cadastro ativado com sucesso! 🎉");

        trackEvent("atualizacao_cadastral_success", "onboarding", {
          lead_id: leadRecord?.id,
          user_id: authUserId
        });

        if (onSuccess) {
          onSuccess({ user: authData?.user, waitlistData: waitlistUpdateData });
        }

        setTimeout(() => {
          navigate("/sou-fundador");
        }, 2000);

      } else {
        // =====================================================================
        // MODO NOVO CADASTRO (LANDING PAGE)
        // =====================================================================
        const createdLocal = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const ua = navigator.userAgent;
        const lang = navigator.language || "pt-BR";
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const seed = `${ua}-${lang}-${screenRes}`;
        const ipHashVal = await sha256(seed);
        const parsedUA = parseUserAgent(ua);

        const newWaitlistPayload = {
          user_id: authUserId,
          tipo_pessoa: values.tipoPessoa,
          nome: nomeFinal,
          cpf: cleanCpf,
          cnpj: cleanCnpj,
          razao_social: !isPFMode ? values.nome_empresa?.trim() : null,
          responsavel_legal: !isPFMode ? values.responsavel_legal?.trim() : null,
          cpf_responsavel: cleanCpfResp,
          email: values.email.trim().toLowerCase(),
          telefone: values.telefone.trim(),
          cidade: "Ubatuba",
          perfil: perfilArray,
          consentimento_lgpd: true,
          status: "novo",
          created_at_local: createdLocal,
          origem: "direto",
          referer: document.referrer || null,
          ip_hash: ipHashVal,
          device_type: parsedUA.device_type,
          browser: parsedUA.browser,
          os: parsedUA.os,
          regiao_atuacao: regiaoStr,
          regioes: regioesArr,
          bairro_residencia: values.bairro_residencia,
          bairro_moradia: values.bairro_residencia,
          bairros_atuacao: values.bairros_atuacao,
          bairro_trabalho: bairroTrabStr,
          bairro_hospedagem: bairroHospStr,
          bairros_hospedagem: values.bairros_hospedagem,
          bairros: bairrosCombined,
          praias: values.praias,
          praias_frequenta: values.praias && values.praias.length > 0 ? values.praias : null,
          possui_conta_mercado_pago: typeof values.possuiContaMercadoPago === "boolean" ? values.possuiContaMercadoPago : null,
          chave_pix: chavePixFinal,
          tipo_chave_pix: tipoChavePixFinal,
          observacoes: obsText || null
        };

        const { data: insertData, error: insertError } = await supabase
          .from("waitlist")
          .insert(newWaitlistPayload as any)
          .select();

        if (insertError) {
          const errMsg = insertError.message?.toLowerCase() || "";
          const errDet = insertError.details?.toLowerCase() || "";
          if (
            insertError.code === "23505" ||
            errMsg.includes("unique") ||
            errMsg.includes("duplicate") ||
            errMsg.includes("already exists") ||
            errDet.includes("already exists") ||
            errDet.includes("idx_waitlist_email_unique")
          ) {
            const cleanTel = (values.telefone || "").replace(/\D/g, "");
            const redirectParam = cleanTel || cleanCpf || encodeURIComponent(values.email.trim());
            toast.info("Você já possui uma inscrição! Redirecionando para atualizar seu cadastro e ativar sua senha...", { duration: 4000 });
            setTimeout(() => {
              navigate(`/atualizacao-cadastral?tel=${redirectParam}`);
            }, 1200);
            setIsSubmitting(false);
            return;
          }
          throw insertError;
        }

        if (authUserId) {
          try {
            await supabase.from("usuarios").upsert({
              id: authUserId,
              nome: nomeFinal,
              email: values.email.trim().toLowerCase(),
              role: userRole,
              cpf: cleanCpf,
              cnpj: cleanCnpj,
              status: "pendente",
              tipo_pessoa: values.tipoPessoa,
              responsavel_legal: !isPFMode ? values.responsavel_legal?.trim() : null,
              cpf_responsavel: cleanCpfResp,
              regiao_atuacao: regiaoStr,
              chave_pix: chavePixFinal,
              tipo_chave_pix: tipoChavePixFinal,
              bairro_moradia: values.bairro_residencia,
              bairro_trabalho: bairroTrabStr,
              praias_frequenta: values.praias && values.praias.length > 0 ? values.praias : null,
            } as any);
          } catch (syncErr) {
            console.warn("[FounderForm] Sincronização usuarios:", syncErr);
          }
        }

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        toast.success("Inscrição de Fundador realizada com sucesso! 🎉");
        trackEvent("landing_waitlist_success", "marketing", { perfil: perfilArray, tipo_pessoa: values.tipoPessoa });
        logSystem("INFO", "WAITLIST", "founder_signup_success", "success");

        if (onSuccess) {
          onSuccess({
            user: authData?.user,
            waitlistData: insertData && insertData[0] ? insertData[0] : newWaitlistPayload
          });
        }
      }
    } catch (err: any) {
      console.error("[FounderForm] Falha na submissão:", err);
      const msg = err.message || "Erro de conexão ao processar os dados. Tente novamente.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Listas filtradas para busca
  const filteredBairrosResidencia = BAIRROS_LIST.filter(b =>
    !bairroResidenciaSearch.trim() || b.toLowerCase().includes(bairroResidenciaSearch.toLowerCase().trim())
  );

  const filteredBairrosAtuacao = BAIRROS_LIST.filter(b =>
    !bairrosAtuacaoSearch.trim() || b.toLowerCase().includes(bairrosAtuacaoSearch.toLowerCase().trim())
  );

  const filteredBairrosHospedagem = BAIRROS_LIST.filter(b =>
    !bairrosHospedagemSearch.trim() || b.toLowerCase().includes(bairrosHospedagemSearch.toLowerCase().trim())
  );

  const filteredPraias = PRAIAS_LIST.filter(p =>
    !praiasSearch.trim() || p.toLowerCase().includes(praiasSearch.toLowerCase().trim())
  );

  return (
    <div className={`w-full max-w-4xl mx-auto bg-slate-950 text-white rounded-3xl border border-emerald-500/20 shadow-2xl shadow-emerald-950/40 relative flex flex-col ${className}`}>
      {/* ========================================================================= */}
      {/* 2. HEADER FIXO (STICKY TOP) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md px-5 sm:px-8 py-3.5 border-b border-emerald-500/20 flex items-center justify-between rounded-t-3xl">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00FF66] animate-pulse shadow-[0_0_10px_#00FF66]" />
          <span className="font-display font-black text-xs sm:text-sm tracking-wider uppercase text-white">
            UBT <span className="text-[#00FF66]">FUNDADOR</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold tracking-wider uppercase">
            {isUpdateMode ? "Etapa Final" : "Inscrição Pioneira"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-[#00FF66]/50 flex items-center justify-center text-white/70 hover:text-[#00FF66] transition-all cursor-pointer group shadow-sm active:scale-95"
          aria-label="Fechar"
          title="Fechar"
        >
          <X className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </header>

      {/* ========================================================================= */}
      {/* CORPO DO FORMULÁRIO */}
      {/* ========================================================================= */}
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex flex-col gap-6 text-left p-5 sm:p-8">
        {submitError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs sm:text-sm text-red-400 font-sans leading-relaxed text-center animate-in fade-in">
            {submitError}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SELETOR: PESSOA FÍSICA (PF) VS EMPRESA / ASSOCIAÇÃO (PJ) */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-2">
          <label className="block text-xs font-mono text-white/50 uppercase tracking-widest pl-1">
            Tipo de Cadastro <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10">
            <button
              type="button"
              onClick={() => setValue("tipoPessoa", "PF", { shouldValidate: true })}
              className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                tipoPessoa === "PF"
                  ? "bg-[#00FF66] text-slate-950 shadow-[0_0_15px_rgba(0,255,102,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Pessoa Física (PF)</span>
            </button>

            <button
              type="button"
              onClick={() => setValue("tipoPessoa", "PJ", { shouldValidate: true })}
              className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                tipoPessoa === "PJ"
                  ? "bg-[#00FF66] text-slate-950 shadow-[0_0_15px_rgba(0,255,102,0.35)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Associação / Empresa (PJ)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FLUXO PESSOA FÍSICA (PF) */}
        {/* ========================================================================= */}
        {tipoPessoa === "PF" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-nome" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-nome"
                  type="text"
                  placeholder="Seu nome completo"
                  {...register("nome")}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.nome ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base transition-all`}
                />
                {errors.nome && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.nome.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-input-cpf" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  {...register("cpf", {
                    onChange: (e) => {
                      setValue("cpf", maskCPF(e.target.value), { shouldValidate: true });
                    }
                  })}
                  maxLength={14}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.cpf ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.cpf && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.cpf.message}
                  </p>
                )}
              </div>
            </div>

            {/* Perfis de Atuação PF */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-mono text-white/50 uppercase tracking-widest pl-1">
                Como você atuará na UBT? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PERFIS_PF_LIST.map((item) => {
                  const isSelected = perfil.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePerfil(item.id)}
                      className={`p-3 sm:p-3.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer select-none active:scale-98 ${
                        isSelected
                          ? "bg-emerald-500/15 border-[#00FF66] text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.2)]"
                          : "bg-slate-900/80 border-white/10 text-white/70 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className="text-xl shrink-0">{item.icon}</span>
                      <span className="text-xs sm:text-sm font-sans font-medium truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.perfil && (
                <p className="mt-1 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                  <span>⚠</span> {errors.perfil.message}
                </p>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* FLUXO PESSOA JURÍDICA / ASSOCIAÇÃO (PJ) */}
        {/* ========================================================================= */}
        {tipoPessoa === "PJ" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-nome_empresa" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Razão Social / Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-nome_empresa"
                  type="text"
                  placeholder="Ex: Associação dos Quiosques de Ubatuba"
                  {...register("nome_empresa")}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.nome_empresa ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base transition-all`}
                />
                {errors.nome_empresa && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.nome_empresa.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-input-cnpj" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  CNPJ <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  {...register("cnpj", {
                    onChange: (e) => {
                      setValue("cnpj", maskCNPJ(e.target.value), { shouldValidate: true });
                    }
                  })}
                  maxLength={18}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.cnpj ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.cnpj && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.cnpj.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-responsavel_legal" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Nome do Responsável Legal <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-responsavel_legal"
                  type="text"
                  placeholder="Nome completo do responsável"
                  {...register("responsavel_legal")}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.responsavel_legal ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base transition-all`}
                />
                {errors.responsavel_legal && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.responsavel_legal.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-input-cpf_responsavel" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  CPF do Responsável Legal <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-cpf_responsavel"
                  type="text"
                  placeholder="000.000.000-00"
                  {...register("cpf_responsavel", {
                    onChange: (e) => {
                      setValue("cpf_responsavel", maskCPF(e.target.value), { shouldValidate: true });
                    }
                  })}
                  maxLength={14}
                  className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                    errors.cpf_responsavel ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.cpf_responsavel && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.cpf_responsavel.message}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* CONTATO: WHATSAPP E E-MAIL */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label htmlFor="form-input-telefone" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
              WhatsApp Oficial <span className="text-red-500">*</span>
            </label>
            <input
              id="form-input-telefone"
              type="tel"
              placeholder="(12) 99999-9999"
              {...register("telefone", {
                onChange: (e) => {
                  setValue("telefone", maskPhone(e.target.value), { shouldValidate: true });
                }
              })}
              maxLength={15}
              className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                errors.telefone ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
              } outline-none text-white text-sm sm:text-base font-mono transition-all`}
            />
            {errors.telefone && (
              <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                <span>⚠</span> {errors.telefone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="form-input-email" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
              E-mail Principal <span className="text-red-500">*</span>
            </label>
            <input
              id="form-input-email"
              type="email"
              placeholder="seu@email.com"
              {...register("email")}
              className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                errors.email ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
              } outline-none text-white text-sm sm:text-base transition-all`}
            />
            {errors.email && (
              <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                <span>⚠</span> {errors.email.message}
              </p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. SEÇÃO GEOGRÁFICA CONDICIONAL POR PERFIL (UNIÃO LÓGICA SEM DUPLICAÇÃO) */}
        {/* ========================================================================= */}
        {(showRegioes || showBairroResidencia || showBairrosTrabalho || showBairrosHospedagem || showPraias) && (
          <div className="p-5 sm:p-7 rounded-3xl bg-slate-900/60 border border-emerald-500/20 shadow-2xl flex flex-col gap-6 relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center gap-2.5 pb-2 border-b border-emerald-500/15">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] shrink-0">
                <Compass className="w-4 h-4 text-[#00FF66]" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-sm sm:text-base text-white tracking-wide">
                  Localização e Regiões de Atuação
                </h4>
                <p className="text-[11px] text-white/50 font-sans">
                  Campos configurados estritamente conforme o seu perfil em Ubatuba.
                </p>
              </div>
            </div>

            {/* CONDICIONAL A: ZONA / REGIÃO DE ATUAÇÃO (SUL, CENTRO, NORTE, OESTE) */}
            {showRegioes && (
              <div className="flex flex-col gap-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono text-white/80 uppercase tracking-widest pl-1 font-semibold">
                    Zona / Região de Atuação <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#00FF66]">
                    {regioes.length === 0 ? "Selecione as zonas" : `${regioes.length} selecionada(s)`}
                  </span>
                </div>
                <p className="text-[11px] text-white/50 font-sans pl-1 -mt-1">
                  Marque uma ou mais regiões de Ubatuba onde você pretende atender ou circular.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {REGIOES_UBATUBA.map((reg) => {
                    const isSelected = regioes.includes(reg);
                    return (
                      <button
                        key={`zona-${reg}`}
                        type="button"
                        onClick={() => toggleRegiao(reg)}
                        className={`py-3.5 px-3.5 rounded-xl border font-display font-bold text-xs uppercase tracking-wider flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-98 ${
                          isSelected
                            ? "bg-[#00FF66] text-slate-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.35)]"
                            : "bg-slate-900/80 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span>Região {reg}</span>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-slate-950 text-[#00FF66]" : "border border-white/20 bg-white/5"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.regioes && (
                  <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-0.5">
                    <span>⚠</span> {errors.regioes.message}
                  </p>
                )}
              </div>
            )}

            {/* CONDICIONAL B: BAIRRO DE RESIDÊNCIA (SELECT ÚNICO - OBRIGATÓRIO) */}
            {showBairroResidencia && (
              <div className="flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label htmlFor="bairro_residencia_button" className="block text-xs font-mono text-white/80 uppercase tracking-widest pl-1 font-semibold">
                    {isPJ ? "Bairro da Sede da Empresa" : "Bairro de Residência"} <span className="text-red-500">*</span>
                  </label>
                  {bairroResidencia && (
                    <span className="text-[11px] font-mono text-[#00FF66] flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#00FF66]" /> Bairro Selecionado
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 font-sans pl-1 -mt-1">
                  {isPJ ? "Selecione o bairro oficial onde fica a sede ou base." : "Selecione apenas 1 bairro oficial onde você mora em Ubatuba."}
                </p>

                <button
                  id="bairro_residencia_button"
                  type="button"
                  onClick={() => setIsBairroResidenciaModalOpen(true)}
                  className={`w-full py-4 px-4 sm:px-5 rounded-2xl bg-slate-900/90 border ${
                    errors.bairro_residencia
                      ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20"
                      : "border-white/10 hover:border-[#00FF66]/50 focus:border-[#00FF66]"
                  } text-left flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-inner active:scale-98`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      bairroResidencia ? "bg-emerald-500/10 text-[#00FF66] border border-[#00FF66]/30" : "bg-white/5 text-white/40 border border-white/10"
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className={`text-sm sm:text-base font-sans truncate ${
                      bairroResidencia ? "text-white font-semibold" : "text-white/40"
                    }`}>
                      {bairroResidencia || "Selecione seu bairro (Centro, Itaguá, Perequê-Açu, Estufa I...)"}
                    </span>
                  </div>
                  <span className="text-xs text-[#00FF66] font-mono uppercase tracking-wider font-semibold group-hover:underline shrink-0 flex items-center gap-1">
                    <span>{bairroResidencia ? "Alterar" : "Escolher"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>
                {errors.bairro_residencia && (
                  <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-0.5">
                    <span>⚠</span> {errors.bairro_residencia.message}
                  </p>
                )}
              </div>
            )}

            {/* CONDICIONAL C: BAIRROS DE TRABALHO (MÚLTIPLA ESCOLHA - MORADOR OPCIONAL) */}
            {showBairrosTrabalho && (
              <div className="flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono text-white/80 uppercase tracking-widest pl-1 font-semibold">
                    Bairros de Trabalho <span className="text-white/40 font-normal lowercase">(opcional)</span>
                  </label>
                  {bairrosAtuacao.length > 0 && (
                    <span className="text-[11px] font-mono text-[#00FF66]">
                      {bairrosAtuacao.length} bairro(s)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 font-sans pl-1 -mt-1">
                  Bairros adicionais onde você costuma trabalhar, prestar serviços ou circular.
                </p>

                <button
                  type="button"
                  onClick={() => setIsBairrosAtuacaoModalOpen(true)}
                  className="w-full py-4 px-4 sm:px-5 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-[#00FF66]/50 text-left flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-inner active:scale-98"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      bairrosAtuacao.length > 0 ? "bg-emerald-500/10 text-[#00FF66] border border-[#00FF66]/30" : "bg-white/5 text-white/40 border border-white/10"
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className={`text-sm sm:text-base font-sans truncate ${
                      bairrosAtuacao.length > 0 ? "text-white font-semibold" : "text-white/40"
                    }`}>
                      {bairrosAtuacao.length === 0
                        ? "Selecionar bairros de trabalho..."
                        : `${bairrosAtuacao.length} bairro(s) de trabalho selecionado(s)`}
                    </span>
                  </div>
                  <span className="text-xs text-[#00FF66] font-mono uppercase tracking-wider font-semibold group-hover:underline shrink-0 flex items-center gap-1">
                    <span>{bairrosAtuacao.length > 0 ? "Gerenciar" : "Adicionar"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                {bairrosAtuacao.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bairrosAtuacao.map((b) => (
                      <span
                        key={`chip-trab-${b}`}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/30 text-[11px] text-white font-sans flex items-center gap-1.5"
                      >
                        <span>{b}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBairroAtuacao(b);
                          }}
                          className="hover:text-red-400 p-0.5"
                          title={`Remover ${b}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CONDICIONAL D: BAIRROS DE HOSPEDAGEM (MÚLTIPLA ESCOLHA - TURISTA) */}
            {showBairrosHospedagem && (
              <div className="flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono text-white/80 uppercase tracking-widest pl-1 font-semibold">
                    Bairros que Costuma se Hospedar
                    {!hasMorador && <span className="text-red-500"> *</span>}
                  </label>
                  {bairrosHospedagem.length > 0 && (
                    <span className="text-[11px] font-mono text-[#00FF66]">
                      {bairrosHospedagem.length} bairro(s)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 font-sans pl-1 -mt-1">
                  Bairros onde você costuma alugar casa, pousada ou se hospedar em viagens a Ubatuba.
                </p>

                <button
                  type="button"
                  onClick={() => setIsBairrosHospedagemModalOpen(true)}
                  className={`w-full py-4 px-4 sm:px-5 rounded-2xl bg-slate-900/90 border ${
                    errors.bairros_hospedagem ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 hover:border-[#00FF66]/50"
                  } text-left flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-inner active:scale-98`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      bairrosHospedagem.length > 0 ? "bg-emerald-500/10 text-[#00FF66] border border-[#00FF66]/30" : "bg-white/5 text-white/40 border border-white/10"
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className={`text-sm sm:text-base font-sans truncate ${
                      bairrosHospedagem.length > 0 ? "text-white font-semibold" : "text-white/40"
                    }`}>
                      {bairrosHospedagem.length === 0
                        ? "Selecionar bairros de hospedagem..."
                        : `${bairrosHospedagem.length} bairro(s) de hospedagem selecionado(s)`}
                    </span>
                  </div>
                  <span className="text-xs text-[#00FF66] font-mono uppercase tracking-wider font-semibold group-hover:underline shrink-0 flex items-center gap-1">
                    <span>{bairrosHospedagem.length > 0 ? "Gerenciar" : "Adicionar"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                {bairrosHospedagem.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bairrosHospedagem.map((b) => (
                      <span
                        key={`chip-hosp-${b}`}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/30 text-[11px] text-white font-sans flex items-center gap-1.5"
                      >
                        <span>{b}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBairroHospedagem(b);
                          }}
                          className="hover:text-red-400 p-0.5"
                          title={`Remover ${b}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {errors.bairros_hospedagem && (
                  <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-0.5">
                    <span>⚠</span> {errors.bairros_hospedagem.message}
                  </p>
                )}
              </div>
            )}

            {/* CONDICIONAL E: PRAIAS QUE COSTUMA FREQUENTAR / ATUAR */}
            {showPraias && (
              <div className="flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono text-white/80 uppercase tracking-widest pl-1 font-semibold">
                    {praiasLabel}
                    {hasAmbulante && <span className="text-red-500"> *</span>}
                  </label>
                  {praias.length > 0 && (
                    <span className="text-[11px] font-mono text-[#00FF66]">
                      {praias.length} praia(s)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 font-sans pl-1 -mt-1">
                  Lista oficial das praias de Ubatuba onde você atua ou costuma frequentar.
                </p>

                <button
                  type="button"
                  onClick={() => setIsPraiasModalOpen(true)}
                  className={`w-full py-4 px-4 sm:px-5 rounded-2xl bg-slate-900/90 border ${
                    errors.praias ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 hover:border-[#00FF66]/50"
                  } text-left flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-inner active:scale-98`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      praias.length > 0 ? "bg-emerald-500/10 text-[#00FF66] border border-[#00FF66]/30" : "bg-white/5 text-white/40 border border-white/10"
                    }`}>
                      <span className="text-sm">🏖️</span>
                    </div>
                    <span className={`text-sm sm:text-base font-sans truncate ${
                      praias.length > 0 ? "text-white font-semibold" : "text-white/40"
                    }`}>
                      {praias.length === 0
                        ? "Selecionar praias de Ubatuba..."
                        : `${praias.length} praia(s) selecionada(s)`}
                    </span>
                  </div>
                  <span className="text-xs text-[#00FF66] font-mono uppercase tracking-wider font-semibold group-hover:underline shrink-0 flex items-center gap-1">
                    <span>{praias.length > 0 ? "Gerenciar" : "Selecionar"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                {praias.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {praias.map((p) => (
                      <span
                        key={`chip-praia-${p}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-[#00FF66]/30 text-[11px] text-[#00FF66] font-sans flex items-center gap-1.5"
                      >
                        <span>{p}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePraia(p);
                          }}
                          className="hover:text-red-400 p-0.5"
                          title={`Remover ${p}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {errors.praias && (
                  <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-0.5">
                    <span>⚠</span> {errors.praias.message}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SEÇÃO MERCADO PAGO E CHAVE PIX */}
        {/* ========================================================================= */}
        <div className="p-5 sm:p-7 rounded-3xl bg-slate-900/60 border border-emerald-500/20 shadow-xl flex flex-col gap-4 backdrop-blur-md">
          <div>
            <label className="block text-xs font-mono text-white/80 uppercase tracking-widest mb-1 pl-1 font-semibold">
              Você possui conta no Mercado Pago? <span className="text-red-500">*</span>
            </label>
            <p className="text-[11px] text-white/50 font-sans pl-1 mb-3">
              Usamos a infraestrutura do Mercado Pago para splits imediatos e repasses instantâneos via Pix.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleMercadoPagoToggle(true)}
                className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  possuiContaMercadoPago === true
                    ? "bg-[#00FF66] text-slate-950 border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.35)]"
                    : "bg-slate-900 border border-white/10 text-white/60 hover:text-white"
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Sim, possuo</span>
              </button>

              <button
                type="button"
                onClick={() => handleMercadoPagoToggle(false)}
                className={`py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  possuiContaMercadoPago === false
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-slate-900 border border-white/10 text-white/60 hover:text-white"
                }`}
              >
                <span>Não possuo ainda</span>
              </button>
            </div>
            {errors.possuiContaMercadoPago && (
              <p className="mt-1 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                <span>⚠</span> {errors.possuiContaMercadoPago.message}
              </p>
            )}
          </div>

          {/* Campos condicionais da Chave Pix com Preenchimento Inteligente */}
          {possuiContaMercadoPago === true && (
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
              <div>
                <label htmlFor="form-select-tipo_pix" className="block text-xs font-mono text-white/70 uppercase tracking-widest mb-2 pl-1 font-semibold">
                  Tipo de Chave Pix <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="form-select-tipo_pix"
                    value={tipoChavePix}
                    onChange={handleTipoChavePixChange}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-white/10 focus:border-[#00FF66] text-white text-xs sm:text-sm font-mono outline-none appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-950 text-white/40">Selecione o tipo de chave...</option>
                    <option value="cpf" className="bg-slate-950 text-white">CPF</option>
                    <option value="cnpj" className="bg-slate-950 text-white">CNPJ</option>
                    <option value="email" className="bg-slate-950 text-white">E-mail</option>
                    <option value="telefone" className="bg-slate-950 text-white">Telefone / Celular</option>
                    <option value="aleatoria" className="bg-slate-950 text-white">Chave Aleatória (EVP)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.tipo_chave_pix && (
                  <p className="mt-1 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.tipo_chave_pix.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="form-input-chave_pix" className="block text-xs font-mono text-white/70 uppercase tracking-widest pl-1 font-semibold">
                    Chave Pix Cadastrada <span className="text-red-500">*</span>
                  </label>
                  {tipoChavePix && (
                    <button
                      type="button"
                      onClick={() => applySmartPixAutofill(tipoChavePix)}
                      className="text-[10px] text-[#00FF66] hover:underline font-mono uppercase"
                    >
                      Preencher Auto
                    </button>
                  )}
                </div>
                <input
                  id="form-input-chave_pix"
                  type="text"
                  placeholder={getPixPlaceholder(tipoChavePix)}
                  maxLength={getPixMaxLength(tipoChavePix)}
                  {...register("chave_pix", {
                    onChange: (e) => {
                      setValue("chave_pix", applyPixMask(e.target.value, tipoChavePix), { shouldValidate: true });
                    }
                  })}
                  className={`w-full px-4 py-3.5 rounded-xl bg-slate-950 border ${
                    errors.chave_pix ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                  } text-white text-xs sm:text-sm font-mono outline-none transition-all`}
                />
                {errors.chave_pix && (
                  <p className="mt-1 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.chave_pix.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEGURANÇA: DEFINIÇÃO DE SENHA DO MEMBRO FUNDADOR */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label htmlFor="form-input-senha" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
              Senha de Acesso <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="form-input-senha"
                type={showSenha ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                {...register("senha")}
                className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                  errors.senha ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                } outline-none text-white text-sm sm:text-base transition-all pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                aria-label={showSenha ? "Ocultar senha" : "Ver senha"}
              >
                {showSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.senha && (
              <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                <span>⚠</span> {errors.senha.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="form-input-confirmarSenha" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
              Confirmar Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="form-input-confirmarSenha"
                type={showConfirmarSenha ? "text" : "password"}
                placeholder="Repita sua senha"
                {...register("confirmarSenha")}
                className={`w-full px-5 py-4 rounded-2xl bg-slate-900/90 border ${
                  errors.confirmarSenha ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-[#00FF66]"
                } outline-none text-white text-sm sm:text-base transition-all pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1"
                aria-label={showConfirmarSenha ? "Ocultar confirmação" : "Ver confirmação"}
              >
                {showConfirmarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmarSenha && (
              <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                <span>⚠</span> {errors.confirmarSenha.message}
              </p>
            )}
          </div>
        </div>

        {/* Termos de Uso e LGPD */}
        <div className="flex flex-col gap-1 pt-1">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register("acceptTerms")}
              className="mt-1 h-5 w-5 accent-[#00FF66] rounded cursor-pointer shrink-0"
            />
            <span className="text-xs text-white/60 font-sans leading-relaxed">
              Aceito os Termos de Uso e autorizo a coleta dos meus dados para validação pioneira da UBT em Ubatuba, conforme a LGPD. <span className="text-red-500">*</span>
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-0.5">
              <span>⚠</span> {errors.acceptTerms.message}
            </p>
          )}
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 2. FOOTER FIXO DE AÇÃO (STICKY BOTTOM - NEON GAMER UBT) */}
      {/* ========================================================================= */}
      <footer className="sticky bottom-0 z-40 p-4 sm:p-5 bg-slate-950/95 border-t border-emerald-500/20 backdrop-blur-md rounded-b-3xl flex flex-col gap-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <button
          type="button"
          onClick={handleSubmit(onSubmit, onInvalid)}
          disabled={isSubmitting}
          className={`w-full py-4 sm:py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-3 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:shadow-[0_0_30px_rgba(0,255,102,0.6)] disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              <span>Processando Cadastro...</span>
            </>
          ) : (
            <>
              <span>{finalButtonText}</span>
              <Send className="w-5 h-5" />
            </>
          )}
        </button>

        {!hideAlreadyRegisteredButton && (
          <button
            type="button"
            onClick={() => navigate("/sou-fundador")}
            className="w-full py-2.5 text-center text-xs font-mono text-white/60 hover:text-[#00FF66] transition-colors cursor-pointer"
          >
            <span>Já realizou sua inscrição? </span>
            <span className="text-[#00FF66] font-bold underline underline-offset-4">Já sou Fundador</span>
          </button>
        )}
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: BAIRRO DE RESIDÊNCIA (SELECT ÚNICO COM BUSCA) */}
      {/* ========================================================================= */}
      {isBairroResidenciaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-slate-950 border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,255,102,0.25)] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-emerald-500/20 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-[#00FF66]" />
                <h3 className="font-display font-extrabold text-base text-white">
                  Selecione seu Bairro de Residência
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBairroResidenciaModalOpen(false);
                  setBairroResidenciaSearch("");
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-[#00FF66] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-emerald-500/15 shrink-0 bg-slate-950">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar bairro oficial de Ubatuba..."
                  value={bairroResidenciaSearch}
                  onChange={(e) => setBairroResidenciaSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-white/10 focus:border-[#00FF66] text-white text-sm font-sans outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista com Scroll Suave */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-white/5">
              {filteredBairrosResidencia.map((b) => {
                const isSelected = bairroResidencia === b;
                return (
                  <button
                    key={`b-res-${b}`}
                    type="button"
                    onClick={() => selectBairroResidencia(b)}
                    className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between gap-3 transition-colors text-left cursor-pointer ${
                      isSelected ? "bg-emerald-500/15 text-white" : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span className="text-sm font-sans font-medium">{b}</span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#00FF66] text-slate-950" : "border border-white/20 bg-white/5"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
              {filteredBairrosResidencia.length === 0 && (
                <div className="py-12 text-center text-white/40 text-xs font-mono">
                  Nenhum bairro localizado com &quot;{bairroResidenciaSearch}&quot;.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-emerald-500/15 bg-slate-900/90 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBairroResidenciaModalOpen(false);
                  setBairroResidenciaSearch("");
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BAIRROS DE TRABALHO / ATUAÇÃO (MÚLTIPLA SELEÇÃO) */}
      {/* ========================================================================= */}
      {isBairrosAtuacaoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-slate-950 border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,255,102,0.25)] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-emerald-500/20 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#00FF66]" />
                <h3 className="font-display font-extrabold text-base text-white">
                  Bairros de Trabalho
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBairrosAtuacaoModalOpen(false);
                  setBairrosAtuacaoSearch("");
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-[#00FF66] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-emerald-500/15 shrink-0 bg-slate-950">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar bairro de trabalho..."
                  value={bairrosAtuacaoSearch}
                  onChange={(e) => setBairrosAtuacaoSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-white/10 focus:border-[#00FF66] text-white text-sm font-sans outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista com Checkboxes */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-white/5">
              {filteredBairrosAtuacao.map((b) => {
                const isSelected = bairrosAtuacao.includes(b);
                return (
                  <div
                    key={`b-trab-${b}`}
                    onClick={() => toggleBairroAtuacao(b)}
                    className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-emerald-500/15 text-white" : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span className="text-sm font-sans font-medium">{b}</span>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#00FF66] text-slate-950 border-[#00FF66]" : "border border-white/20 bg-black/40"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
              {filteredBairrosAtuacao.length === 0 && (
                <div className="py-12 text-center text-white/40 text-xs font-mono">
                  Nenhum bairro localizado com &quot;{bairrosAtuacaoSearch}&quot;.
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-4 border-t border-emerald-500/15 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setValue("bairros_atuacao", [], { shouldValidate: true });
                  setValue("bairro_trabalho", []);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBairrosAtuacaoModalOpen(false);
                  setBairrosAtuacaoSearch("");
                }}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.35)]"
              >
                Confirmar ({bairrosAtuacao.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BAIRROS DE HOSPEDAGEM (MÚLTIPLA SELEÇÃO - TURISTA) */}
      {/* ========================================================================= */}
      {isBairrosHospedagemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-slate-950 border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,255,102,0.25)] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-emerald-500/20 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-[#00FF66]" />
                <h3 className="font-display font-extrabold text-base text-white">
                  Bairros de Hospedagem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBairrosHospedagemModalOpen(false);
                  setBairrosHospedagemSearch("");
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-[#00FF66] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-emerald-500/15 shrink-0 bg-slate-950">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar bairro de hospedagem..."
                  value={bairrosHospedagemSearch}
                  onChange={(e) => setBairrosHospedagemSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-white/10 focus:border-[#00FF66] text-white text-sm font-sans outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista com Checkboxes */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-white/5">
              {filteredBairrosHospedagem.map((b) => {
                const isSelected = bairrosHospedagem.includes(b);
                return (
                  <div
                    key={`b-hosp-${b}`}
                    onClick={() => toggleBairroHospedagem(b)}
                    className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-emerald-500/15 text-white" : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span className="text-sm font-sans font-medium">{b}</span>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#00FF66] text-slate-950 border-[#00FF66]" : "border border-white/20 bg-black/40"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
              {filteredBairrosHospedagem.length === 0 && (
                <div className="py-12 text-center text-white/40 text-xs font-mono">
                  Nenhum bairro localizado com &quot;{bairrosHospedagemSearch}&quot;.
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-4 border-t border-emerald-500/15 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setValue("bairros_hospedagem", [], { shouldValidate: true });
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBairrosHospedagemModalOpen(false);
                  setBairrosHospedagemSearch("");
                }}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.35)]"
              >
                Confirmar ({bairrosHospedagem.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRAIAS QUE COSTUMA FREQUENTAR / ATUAR (MÚLTIPLA SELEÇÃO) */}
      {/* ========================================================================= */}
      {isPraiasModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-lg bg-slate-950 border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,255,102,0.25)] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-emerald-500/20 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🏖️</span>
                <h3 className="font-display font-extrabold text-base text-white">
                  Praias de Ubatuba
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPraiasModalOpen(false);
                  setPraiasSearch("");
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-[#00FF66] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-emerald-500/15 shrink-0 bg-slate-950">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar praia (ex: Praia Grande, Itamambuca)..."
                  value={praiasSearch}
                  onChange={(e) => setPraiasSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-white/10 focus:border-[#00FF66] text-white text-sm font-sans outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de Praias com Checkboxes */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-white/5">
              {filteredPraias.map((p) => {
                const isSelected = praias.includes(p);
                return (
                  <div
                    key={`p-${p}`}
                    onClick={() => togglePraia(p)}
                    className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-emerald-500/15 text-white" : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span className="text-sm font-sans font-medium">{p}</span>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#00FF66] text-slate-950 border-[#00FF66]" : "border border-white/20 bg-black/40"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
              {filteredPraias.length === 0 && (
                <div className="py-12 text-center text-white/40 text-xs font-mono">
                  Nenhuma praia localizada com &quot;{praiasSearch}&quot;.
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-4 border-t border-emerald-500/15 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setValue("praias", [], { shouldValidate: true })}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPraiasModalOpen(false);
                  setPraiasSearch("");
                }}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.35)]"
              >
                Confirmar ({praias.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
