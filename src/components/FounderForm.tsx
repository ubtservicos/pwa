import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  ShieldCheck,
  Search
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

export const PERFIS_PF_LIST = [
  { id: "ambulante", label: "Ambulante", icon: "🏖️" },
  { id: "mototaxista", label: "Mototaxista", icon: "🏍️" },
  { id: "diarista", label: "Diarista", icon: "🧹" },
  { id: "morador", label: "Morador", icon: "🏡" },
  { id: "turista", label: "Turista / Visitante", icon: "🧳" },
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
        message: "Selecione pelo menos um perfil de atuação",
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

export type FounderFormData = z.infer<typeof founderFormSchema>;

export interface FounderFormProps {
  isUpdateMode?: boolean;
  leadRecord?: any;
  defaultValues?: Partial<FounderFormData>;
  onSuccess?: (data: { user?: any; waitlistData?: any }) => void;
  submitButtonText?: string;
  hideAlreadyRegisteredButton?: boolean;
  className?: string;
}

// Funções auxiliares para fingerprinting anonimizado
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
  defaultValues = {},
  onSuccess,
  submitButtonText,
  hideAlreadyRegisteredButton = false,
  className = ""
}: FounderFormProps) {
  const navigate = useNavigate();

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
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
      ...defaultValues
    }
  });

  // Atualiza formulário se defaultValues ou leadRecord mudarem
  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      reset({
        tipoPessoa: defaultValues.tipoPessoa || "PF",
        nome: defaultValues.nome || "",
        cpf: defaultValues.cpf ? maskCPF(defaultValues.cpf) : "",
        perfil: defaultValues.perfil || ["morador"],
        nome_empresa: defaultValues.nome_empresa || "",
        cnpj: defaultValues.cnpj ? maskCNPJ(defaultValues.cnpj) : "",
        responsavel_legal: defaultValues.responsavel_legal || "",
        cpf_responsavel: defaultValues.cpf_responsavel ? maskCPF(defaultValues.cpf_responsavel) : "",
        regiao_atuacao_pj: defaultValues.regiao_atuacao_pj || [],
        telefone: defaultValues.telefone ? maskPhone(defaultValues.telefone) : "",
        email: defaultValues.email || "",
        senha: defaultValues.senha || "",
        confirmarSenha: defaultValues.confirmarSenha || "",
        possuiContaMercadoPago: defaultValues.possuiContaMercadoPago ?? false,
        tipo_chave_pix: defaultValues.tipo_chave_pix || "",
        chave_pix: defaultValues.chave_pix || "",
        regiao_atuacao_pf: defaultValues.regiao_atuacao_pf || [],
        praias: defaultValues.praias || [],
        bairros: defaultValues.bairros || [],
        bairro_trabalho: defaultValues.bairro_trabalho || [],
        acceptTerms: true,
      });
    }
  }, [defaultValues, reset]);

  const tipoPessoa = watch("tipoPessoa");
  const perfil = watch("perfil");
  const possuiContaMercadoPago = watch("possuiContaMercadoPago");
  const tipoChavePix = watch("tipo_chave_pix");
  const chavePix = watch("chave_pix");
  const regiaoAtuacaoPf = watch("regiao_atuacao_pf");
  const regiaoAtuacaoPj = watch("regiao_atuacao_pj");
  const praias = watch("praias");
  const bairros = watch("bairros");

  // =========================================================================
  // 2. LÓGICA INTELIGENTE DA CHAVE PIX (MERCADO PAGO)
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
        // Preenche com o número do WhatsApp (somente dígitos numéricos)
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
    console.warn("[FounderForm] Erros de validação:", formErrors);
    const errorKeys = Object.keys(formErrors) as (keyof FounderFormData)[];
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

  // =========================================================================
  // SUBMISSÃO PRINCIPAL (CRIAÇÃO OU ATUALIZAÇÃO VIA RPC)
  // =========================================================================
  const onSubmit = async (values: FounderFormData) => {
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
      const chavePixFinal = values.possuiContaMercadoPago ? (values.chave_pix?.trim() || null) : null;
      const tipoChavePixFinal = values.possuiContaMercadoPago ? (values.tipo_chave_pix?.trim() || null) : null;

      // 1. Criação ou validação de sessão nativa no Supabase Auth
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
            chave_pix: chavePixFinal,
            tipo_chave_pix: tipoChavePixFinal,
          }
        }
      });

      if (authError) {
        console.warn("[FounderForm] Aviso Auth SignUp:", authError);
        const authMsg = authError.message?.toLowerCase() || "";
        const isDuplicate = authMsg.includes("already registered") ||
          authMsg.includes("already exists") ||
          authMsg.includes("user already exists");

        if (isDuplicate) {
          if (!isUpdateMode) {
            // Na Landing Page, redireciona o lead existente para atualização cadastral
            const cleanTel = (values.telefone || "").replace(/\D/g, "");
            const redirectParam = cleanTel || cleanCpf || encodeURIComponent(values.email.trim());
            toast.info("Você já possui uma inscrição! Redirecionando para atualizar seu cadastro e ativar sua senha...", { duration: 4000 });
            setTimeout(() => {
              navigate(`/atualizacao-cadastral?tel=${redirectParam}`);
            }, 1200);
            setIsSubmitting(false);
            return;
          } else {
            // No modo de atualização cadastral, autentica com a senha definida
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

      // Observações formatadas
      const obsParts: string[] = [];
      obsParts.push(`Tipo: ${values.tipoPessoa}`);
      if (isUpdateMode) obsParts.push(`Atualizado via Link Seguro: Sim`);
      if (values.possuiContaMercadoPago !== undefined && values.possuiContaMercadoPago !== null) {
        obsParts.push(`Mercado Pago: ${values.possuiContaMercadoPago ? "Sim" : "Não"}`);
      }
      if (chavePixFinal) {
        obsParts.push(`Chave Pix (${tipoChavePixFinal}): ${chavePixFinal}`);
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

      // =====================================================================
      // 3. PERSISTÊNCIA: MODO ATUALIZAÇÃO (RPC) vs MODO NOVO CADASTRO (INSERT)
      // =====================================================================
      if (isUpdateMode) {
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
          chave_pix: chavePixFinal,
          tipo_chave_pix: tipoChavePixFinal,
          observacoes: obsText,
          cadastro_completo: true,
          status: "completo",
          updated_at: new Date().toISOString(),
        };

        // Invoca a RPC oficial concluir_atualizacao_cadastral
        try {
          const { error: rpcErr } = await supabase.rpc("concluir_atualizacao_cadastral", {
            p_lead_id: leadRecord?.id || null,
            p_dados: waitlistUpdateData,
          });

          if (rpcErr) {
            console.warn("[FounderForm] RPC concluir_atualizacao_cadastral falhou, aplicando fallback:", rpcErr);
            if (leadRecord?.id) {
              await supabase
                .from("waitlist")
                .update(waitlistUpdateData)
                .eq("id", leadRecord.id);
            }
          }
        } catch (saveErr) {
          console.warn("[FounderForm] Exceção ao atualizar waitlist:", saveErr);
        }

        // Sincroniza em public.usuarios de forma segura (sem telefone)
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
              chave_pix: chavePixFinal,
              tipo_chave_pix: tipoChavePixFinal,
              bairro_moradia: isPF && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
              bairro_trabalho: bairroTrabalhoStr,
              praias_frequenta: isPF && values.praias && values.praias.length > 0 ? values.praias : null,
              status: "completo",
            } as any);
          } catch (syncErr) {
            console.warn("[FounderForm] Aviso na sincronização com usuarios:", syncErr);
          }
        }

        // Garante sessão ativa antes de redirecionar para /sou-fundador
        try {
          await supabase.auth.signInWithPassword({
            email: values.email.trim().toLowerCase(),
            password: values.senha,
          });
        } catch (loginErr) {
          // Sessão já pode estar ativa via signUp
        }

        // Confetes solicitados
        confetti({ particleCount: 150, spread: 80 });

        // Toast verde oficial
        toast.success("Cadastro ativado com sucesso! 🎉");

        trackEvent("atualizacao_cadastral_success", "onboarding", {
          lead_id: leadRecord?.id,
          user_id: authUserId
        });

        if (onSuccess) {
          onSuccess({ user: authData?.user, waitlistData: waitlistUpdateData });
        }

        // Redireciona após 2 segundos para /sou-fundador
        setTimeout(() => {
          navigate("/sou-fundador");
        }, 2000);

      } else {
        // MODO LANDING PAGE (NOVO CADASTRO)
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
          razao_social: !isPF ? values.nome_empresa?.trim() : null,
          responsavel_legal: !isPF ? values.responsavel_legal?.trim() : null,
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
          regiao_atuacao: regiao,
          bairro_moradia: isPF && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
          bairro_hospedagem: isPF && values.perfil?.includes("turista") && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
          bairro_trabalho: bairroTrabalhoStr,
          praias_frequenta: isPF && values.praias && values.praias.length > 0 ? values.praias : null,
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

        // Sincroniza em public.usuarios (sem telefone)
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
              responsavel_legal: !isPF ? values.responsavel_legal?.trim() : null,
              cpf_responsavel: cleanCpfResp,
              regiao_atuacao: regiao,
              chave_pix: chavePixFinal,
              tipo_chave_pix: tipoChavePixFinal,
              bairro_moradia: isPF && values.bairros && values.bairros.length > 0 ? values.bairros.join(", ") : null,
              bairro_trabalho: bairroTrabalhoStr,
              praias_frequenta: isPF && values.praias && values.praias.length > 0 ? values.praias : null,
            } as any);
          } catch (syncErr) {
            console.warn("[FounderForm] Aviso na sincronização com usuarios:", syncErr);
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
      console.error("[FounderForm] Falha ao registrar:", err);
      const errMsg = (err?.message || "").toLowerCase();
      const errDet = (err?.details || "").toLowerCase();

      if (
        err?.code === "23505" ||
        errMsg.includes("duplicate") ||
        errMsg.includes("unique") ||
        errMsg.includes("already exists") ||
        errDet.includes("already exists") ||
        errDet.includes("idx_waitlist_email_unique")
      ) {
        const cleanTel = (values.telefone || "").replace(/\D/g, "");
        const redirectParam = cleanTel || (values.cpf ? values.cpf.replace(/\D/g, "") : "") || encodeURIComponent(values.email.trim());
        toast.info("Você já possui uma inscrição! Redirecionando para atualizar seu cadastro e ativar sua senha...", { duration: 4000 });
        setTimeout(() => {
          navigate(`/atualizacao-cadastral?tel=${redirectParam}`);
        }, 1200);
        setIsSubmitting(false);
        return;
      }

      const fullError = err?.message || "Erro ao processar formulário. Tente novamente.";
      setSubmitError(fullError);
      toast.error(fullError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalButtonLabel = submitButtonText || (isUpdateMode ? "Concluir cadastro" : "Quero ser um Fundador");

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex flex-col gap-6 text-left">
        {submitError && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-semibold leading-relaxed text-center animate-in fade-in">
            {submitError}
          </div>
        )}

        {/* BIFURCAÇÃO (O 'Y' do Cadastro): PF vs PJ */}
        <div className="flex flex-col gap-2">
          <label className="block text-xs font-mono text-white/50 uppercase tracking-widest pl-1">
            Tipo de Cadastro <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setValue("tipoPessoa", "PF", { shouldValidate: true })}
              className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                tipoPessoa === "PF"
                  ? "bg-green text-navy shadow-lg shadow-green/20"
                  : "bg-transparent text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Pessoa Física (PF)</span>
            </button>

            <button
              type="button"
              onClick={() => setValue("tipoPessoa", "PJ", { shouldValidate: true })}
              className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                tipoPessoa === "PJ"
                  ? "bg-green text-navy shadow-lg shadow-green/20"
                  : "bg-transparent text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Associação / CNPJ (PJ)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FLUXO PESSOA FÍSICA (PF) */}
        {/* ========================================================================= */}
        {tipoPessoa === "PF" && (
          <>
            {/* Nome Completo e CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-nome" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-nome"
                  type="text"
                  placeholder="Ex: Carlos da Silva"
                  {...register("nome")}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.nome ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
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
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.cpf ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.cpf && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.cpf.message}
                  </p>
                )}
              </div>
            </div>

            {/* WhatsApp e E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-telefone" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-telefone"
                  type="tel"
                  placeholder="Ex: (12) 99999-9999"
                  {...register("telefone", {
                    onChange: (e) => {
                      setValue("telefone", maskPhone(e.target.value), { shouldValidate: true });
                    }
                  })}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.telefone ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
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
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-email"
                  type="email"
                  placeholder="Ex: seuemail@exemplo.com"
                  {...register("email")}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.email ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm sm:text-base transition-all`}
                />
                {errors.email && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Multi-seleção de Perfil PF */}
            <div id="form-input-perfil">
              <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                Seu Perfil (selecione uma ou mais opções) <span className="text-red-500">*</span>
              </label>
              <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-white/5 border ${
                errors.perfil ? "border-red-500/70" : "border-white/10"
              }`}>
                {PERFIS_PF_LIST.map((perf) => {
                  const isChecked = perfil.includes(perf.id);
                  return (
                    <button
                      key={perf.id}
                      type="button"
                      onClick={() => {
                        const next = isChecked
                          ? perfil.filter((p) => p !== perf.id)
                          : [...perfil, perf.id];
                        setValue("perfil", next, { shouldValidate: true });
                      }}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                        isChecked
                          ? "bg-green/10 border-green text-green"
                          : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? "bg-green border-green text-navy" : "border-white/30 bg-transparent"
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-base shrink-0">{perf.icon}</span>
                      <span className="text-sm font-sans font-medium">{perf.label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.perfil && (
                <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                  <span>⚠</span> {errors.perfil.message}
                </p>
              )}
            </div>

            {/* Condicionais PF: Mototaxista / Diarista -> Área de Atuação */}
            {perfil.some((p) => p === "mototaxista" || p === "diarista") && (
              <div className="w-full" id="form-input-regiao_atuacao_pf">
                <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Região de Atuação <span className="text-red-500">*</span>
                </label>
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-white/5 border ${
                  errors.regiao_atuacao_pf ? "border-red-500/70" : "border-white/10"
                }`}>
                  {REGIOES_UBATUBA.map((reg) => {
                    const checked = regiaoAtuacaoPf.includes(reg);
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? regiaoAtuacaoPf.filter((r) => r !== reg)
                            : [...regiaoAtuacaoPf, reg];
                          setValue("regiao_atuacao_pf", next, { shouldValidate: true });
                        }}
                        className={`flex items-center justify-center p-3.5 rounded-xl border text-sm font-sans font-medium transition-all cursor-pointer ${
                          checked
                            ? "bg-green/10 border-green text-green font-bold"
                            : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                        }`}
                      >
                        <span>{reg}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.regiao_atuacao_pf && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.regiao_atuacao_pf.message}
                  </p>
                )}
              </div>
            )}

            {/* SELEÇÃO RESPONSIVA DE BAIRROS E PRAIAS (MODAL / FULLSCREEN) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
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
                className="w-full py-4 px-5 rounded-xl bg-black/50 hover:bg-black/70 border border-white/15 hover:border-green text-white text-xs sm:text-sm font-sans flex items-center justify-between gap-3 transition-all cursor-pointer shadow-inner group active:scale-98"
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

        {/* ========================================================================= */}
        {/* FLUXO PESSOA JURÍDICA / ASSOCIAÇÃO (PJ) */}
        {/* ========================================================================= */}
        {tipoPessoa === "PJ" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-nome_empresa" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Nome da Associação / Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-nome_empresa"
                  type="text"
                  placeholder="Ex: Associação dos Quiosques de Ubatuba"
                  {...register("nome_empresa")}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.nome_empresa ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
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
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.cnpj ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
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
                  Responsável Legal <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-responsavel_legal"
                  type="text"
                  placeholder="Ex: Mariana Oliveira"
                  {...register("responsavel_legal")}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.responsavel_legal ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
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
                  CPF do Responsável <span className="text-red-500">*</span>
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
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.cpf_responsavel ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.cpf_responsavel && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.cpf_responsavel.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="form-input-telefone-pj" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-telefone-pj"
                  type="tel"
                  placeholder="Ex: (12) 99999-9999"
                  {...register("telefone", {
                    onChange: (e) => {
                      setValue("telefone", maskPhone(e.target.value), { shouldValidate: true });
                    }
                  })}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.telefone ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm sm:text-base font-mono transition-all`}
                />
                {errors.telefone && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.telefone.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-input-email-pj" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-email-pj"
                  type="email"
                  placeholder="Ex: contato@associacao.org.br"
                  {...register("email")}
                  className={`w-full px-5 py-4 rounded-2xl bg-white/5 border ${
                    errors.email ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm sm:text-base transition-all`}
                />
                {errors.email && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <div id="form-input-regiao_atuacao_pj">
              <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                Região de Atuação (selecione uma ou mais) <span className="text-red-500">*</span>
              </label>
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-white/5 border ${
                errors.regiao_atuacao_pj ? "border-red-500/70" : "border-white/10"
              }`}>
                {REGIOES_UBATUBA.map((reg) => {
                  const checked = regiaoAtuacaoPj.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? regiaoAtuacaoPj.filter((r) => r !== reg)
                          : [...regiaoAtuacaoPj, reg];
                        setValue("regiao_atuacao_pj", next, { shouldValidate: true });
                      }}
                      className={`flex items-center justify-center p-3.5 rounded-xl border text-sm font-sans font-medium transition-all cursor-pointer ${
                        checked
                          ? "bg-green/10 border-green text-green font-bold"
                          : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                      }`}
                    >
                      <span>{reg}</span>
                    </button>
                  );
                })}
              </div>
              {errors.regiao_atuacao_pj && (
                <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                  <span>⚠</span> {errors.regiao_atuacao_pj.message}
                </p>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* CAMPOS COMUNS (SENHA, MERCADO PAGO, PIX E TERMOS)                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 border-t border-white/5 pt-4">
          <div>
            <label htmlFor="form-input-senha" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
              Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="form-input-senha"
                type={showSenha ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                {...register("senha")}
                className={`w-full pl-5 pr-14 py-4 rounded-2xl bg-white/5 border ${
                  errors.senha ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                } outline-none text-white text-sm sm:text-base transition-all font-mono`}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-2 cursor-pointer"
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
              Confirme sua Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="form-input-confirmarSenha"
                type={showConfirmarSenha ? "text" : "password"}
                placeholder="Digite a senha novamente"
                {...register("confirmarSenha")}
                className={`w-full pl-5 pr-14 py-4 rounded-2xl bg-white/5 border ${
                  errors.confirmarSenha ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                } outline-none text-white text-sm sm:text-base transition-all font-mono`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-2 cursor-pointer"
                aria-label={showConfirmarSenha ? "Ocultar senha" : "Ver senha"}
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

        {/* Mercado Pago (Sim / Não) */}
        <div id="form-input-possuiContaMercadoPago">
          <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-3 pl-1">
            Você já possui uma conta no Mercado Pago? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: true, label: "Sim" },
              { value: false, label: "Não" }
            ].map((opt) => {
              const selected = possuiContaMercadoPago === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleMercadoPagoToggle(opt.value)}
                  className={`flex items-center justify-center p-4 rounded-xl border font-sans font-medium text-sm transition-all cursor-pointer ${
                    selected
                      ? "bg-green/10 border-green text-green font-bold shadow-md shadow-green/10"
                      : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.possuiContaMercadoPago && (
            <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
              <span>⚠</span> {errors.possuiContaMercadoPago.message}
            </p>
          )}
        </div>

        {/* Condicional Chave Pix Mercado Pago (com preenchimento inteligente e editabilidade) */}
        {possuiContaMercadoPago === true && (
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300" id="form-input-pix">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-green">
                Dados da sua Chave Pix (Mercado Pago)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="form-select-tipo-chave-pix" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Tipo de Chave Pix <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="form-select-tipo-chave-pix"
                    {...register("tipo_chave_pix")}
                    onChange={handleTipoChavePixChange}
                    className={`w-full px-5 py-4 rounded-xl bg-[#132348] border ${
                      errors.tipo_chave_pix ? "border-red-500/70" : "border-white/10"
                    } outline-none text-white text-sm hover:border-white/20 transition-all appearance-none cursor-pointer`}
                  >
                    <option value="" className="bg-[#0B1B3E] text-white/50">Selecione o tipo de chave...</option>
                    <option value="cpf" className="bg-[#0B1B3E] text-white">CPF</option>
                    <option value="cnpj" className="bg-[#0B1B3E] text-white">CNPJ</option>
                    <option value="telefone" className="bg-[#0B1B3E] text-white">Telefone (WhatsApp)</option>
                    <option value="email" className="bg-[#0B1B3E] text-white">E-mail</option>
                    <option value="aleatoria" className="bg-[#0B1B3E] text-white">Chave Aleatória (EVP)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/40 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.tipo_chave_pix && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.tipo_chave_pix.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-input-chave-pix" className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                  Chave Pix <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-input-chave-pix"
                  type="text"
                  {...register("chave_pix")}
                  value={chavePix || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Se telefone/celular, mantém estritamente dígitos conforme a regra oficial
                    const formatted = (tipoChavePix === "telefone" || tipoChavePix === "celular")
                      ? val.replace(/\D/g, "").slice(0, 11)
                      : applyPixMask(val, tipoChavePix);
                    setValue("chave_pix", formatted, { shouldValidate: true });
                  }}
                  placeholder={getPixPlaceholder(tipoChavePix)}
                  maxLength={getPixMaxLength(tipoChavePix)}
                  className={`w-full px-5 py-4 rounded-xl bg-white/5 border ${
                    errors.chave_pix ? "border-red-500/70 focus:border-red-500 ring-1 ring-red-500/20" : "border-white/10 focus:border-green"
                  } outline-none text-white text-sm transition-all font-mono`}
                />
                {errors.chave_pix && (
                  <p className="mt-1.5 text-red-500 text-xs pl-1 font-medium flex items-center gap-1">
                    <span>⚠</span> {errors.chave_pix.message}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-white/50 leading-relaxed font-sans pl-1">
              ℹ️ <strong>Chave editável:</strong> O campo é pré-preenchido automaticamente, mas você pode alterá-lo se a sua chave cadastrada no Mercado Pago for diferente.
            </p>
          </div>
        )}

        {/* Termos & LGPD */}
        <div className="flex flex-col gap-1 mt-2" id="form-input-acceptTerms">
          <div className="flex gap-3 items-start">
            <input
              type="checkbox"
              id="form-consent-lgpd"
              {...register("acceptTerms")}
              className="mt-1 h-5 w-5 shrink-0 accent-green cursor-pointer"
            />
            <label htmlFor="form-consent-lgpd" className="text-xs text-white/60 leading-relaxed font-sans cursor-pointer select-none">
              Declaro que as informações são verdadeiras e concordo com os{" "}
              <span className="text-green underline">Termos de Uso</span> e a{" "}
              <span className="text-green underline">Política de Privacidade (LGPD)</span> da UBT Serviços. <span className="text-red-500">*</span>
            </label>
          </div>
          {errors.acceptTerms && (
            <p className="text-red-500 text-xs pl-1 font-medium flex items-center gap-1 mt-1">
              <span>⚠</span> {errors.acceptTerms.message}
            </p>
          )}
        </div>

        {/* Botão Principal de Envio */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-5 mt-4 rounded-2xl font-display font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-3 transition-all ${
            isSubmitting
              ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
              : "bg-green hover:bg-green-dark active:scale-[0.98] text-navy shadow-lg shadow-green/25 cursor-pointer"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white/60" />
              <span>{isUpdateMode ? "Concluindo cadastro..." : "Processando Inscrição..."}</span>
            </>
          ) : (
            <>
              <span>{finalButtonLabel}</span>
              {isUpdateMode ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </>
          )}
        </button>

        {/* Botão Secundário para Landing Page */}
        {!hideAlreadyRegisteredButton && !isUpdateMode && (
          <button
            type="button"
            onClick={() => navigate("/sou-fundador")}
            className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Users className="w-3.5 h-3.5 text-green" />
            <span>Já realizou sua inscrição?</span>
            <span className="text-green font-bold underline underline-offset-4">Já sou Fundador</span>
          </button>
        )}
      </form>

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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 cursor-pointer"
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
