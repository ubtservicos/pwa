import React, { useState } from "react";
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
  Loader2,
  Sparkles,
  Smartphone,
  Mail,
  Lock,
  FileText,
  ShieldCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  maskCPF,
  maskCNPJ,
  maskPhone,
  isValidCPF,
  isValidCNPJ,
  isValidEmail,
  applyPixMask,
  getPixPlaceholder,
  getPixMaxLength,
  isValidEVP,
  isValidPixPhone,
  generateReferralSlug
} from "@/utils/masks";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import confetti from "canvas-confetti";
import { toast } from "sonner";

/* ==============================================================================
   CONSTANTES GEOGRÁFICAS E PERFIS DE ATUAÇÃO (PRESERVADAS PARA FLUXOS COMPLEMENTARES)
   ============================================================================== */
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

export const BAIRROS_COM_OUTRA_CIDADE_LIST = [
  "Em outra cidade",
  ...BAIRROS_LIST
];

export const BAIRROS_RESIDENCIA_LIST = BAIRROS_COM_OUTRA_CIDADE_LIST;
export const BAIRROS_ATUACAO_LIST = BAIRROS_COM_OUTRA_CIDADE_LIST;
export const BAIRROS_HOSPEDAGEM_LIST = BAIRROS_COM_OUTRA_CIDADE_LIST;

export const REGIOES_UBATUBA = ["Sul", "Centro", "Norte", "Oeste", "Em outra cidade"];

export const PERFIS_PF_LIST = [
  { id: "morador", label: "Morador / Consumidor", icon: "🏡" },
  { id: "turista", label: "Turista / Visitante", icon: "🧳" },
  { id: "ambulante", label: "Ambulante", icon: "🏖️" },
  { id: "mototaxista", label: "Mototaxista", icon: "🏍️" },
  { id: "diarista", label: "Diarista / Faxina", icon: "🧹" },
];

export function normalizePerfilItem(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase();

  if (clean.includes("morador") || clean.includes("consumidor")) return "morador";
  if (clean.includes("turista") || clean.includes("visitante") || clean.includes("hospede")) return "turista";
  if (clean.includes("ambulante") || clean.includes("praia")) return "ambulante";
  if (clean.includes("mototaxi") || clean.includes("moto")) return "mototaxista";
  if (clean.includes("diarista") || clean.includes("faxina") || clean.includes("limpeza")) return "diarista";
  if (clean.includes("associacao") || clean.includes("empresa") || clean.includes("pj")) return "associacao";

  return clean || null;
}

export function normalizePerfilList(rawInput: any): string[] {
  if (!rawInput) return [];

  let items: string[] = [];

  if (Array.isArray(rawInput)) {
    items = rawInput.map(String);
  } else if (typeof rawInput === "string") {
    let str = rawInput.trim();
    if (str.startsWith("{") && str.endsWith("}")) {
      str = str.slice(1, -1);
    }
    if (str.startsWith("[") && str.endsWith("]")) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          items = parsed.map(String);
        }
      } catch {
        // continue
      }
    }
    if (items.length === 0) {
      items = str.split(/[,;|]/).map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
  }

  const normalized = items
    .map(normalizePerfilItem)
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set(normalized));
}

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function parseUserAgent(userAgent: string) {
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

/* ==============================================================================
   SCHEMA ZOD DO CADASTRO ENXUTO DE FUNDADORES
   ============================================================================== */
export const founderFormSchema = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]).default("PF"),

  // Campos específicos PF
  nome: z.string().optional(),
  cpf: z.string().optional(),

  // Campos específicos PJ
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  responsavel_nome: z.string().optional(),
  responsavel_cpf: z.string().optional(),

  // Campos Comuns de Contato & Autenticação
  telefone: z.string().min(10, "Informe um WhatsApp válido com DDD"),
  email: z.string().email("E-mail principal inválido").min(5, "E-mail inválido"),
  senha: z.string().min(6, "A senha deve conter no mínimo 6 caracteres"),
  confirmarSenha: z.string().min(1, "Confirme sua senha"),

  // Termos LGPD
  consentimento_lgpd: z.boolean().refine((val) => val === true, {
    message: "Você deve aceitar os Termos de Uso e a Política de Privacidade (LGPD)."
  }),

  // Campos legados mantidos para interoperabilidade completa com outros fluxos
  nome_empresa: z.string().optional(),
  responsavel_legal: z.string().optional(),
  cpf_responsavel: z.string().optional(),
  perfil: z.array(z.string()).optional(),
  perfis: z.array(z.string()).optional(),
  regiao_atuacao: z.string().optional(),
  regioes: z.array(z.string()).optional(),
  bairro: z.string().optional(),
  bairro_residencia: z.string().optional(),
  bairro_moradia: z.string().optional(),
  bairros_atuacao: z.array(z.string()).optional(),
  bairro_trabalho: z.string().optional(),
  bairros_hospedagem: z.array(z.string()).optional(),
  praias: z.array(z.string()).optional(),
  possuiContaMercadoPago: z.boolean().nullable().optional(),
  chave_pix: z.string().optional(),
  tipo_chave_pix: z.string().optional(),
  observacoes: z.string().optional(),
  acceptTerms: z.boolean().optional(),
}).superRefine((data, ctx) => {
  // 1. Validação de Senha (Confirmação idêntica)
  if (data.senha !== data.confirmarSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "As senhas não conferem.",
      path: ["confirmarSenha"],
    });
  }

  // 2. Validação se Usuário (PF)
  if (data.tipoPessoa === "PF") {
    if (!data.nome || data.nome.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O nome completo deve ter no mínimo 3 caracteres.",
        path: ["nome"],
      });
    }

    const cleanCpf = (data.cpf || "").replace(/\D/g, "");
    if (!data.cpf || cleanCpf.length !== 11 || !isValidCPF(data.cpf)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF inválido. Verifique os dígitos informados.",
        path: ["cpf"],
      });
    }
  }

  // 3. Validação se Associação, ONG ou Entidade (PJ)
  if (data.tipoPessoa === "PJ") {
    const razao = data.razao_social || data.nome_empresa;
    if (!razao || razao.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a Razão Social ou nome da Entidade.",
        path: ["razao_social"],
      });
    }

    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!data.cnpj || cleanCnpj.length !== 14 || !isValidCNPJ(data.cnpj)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ inválido. Verifique os dígitos informados.",
        path: ["cnpj"],
      });
    }

    const respNome = data.responsavel_nome || data.responsavel_legal;
    if (!respNome || respNome.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome do responsável legal é obrigatório.",
        path: ["responsavel_nome"],
      });
    }

    const cleanCpfResp = (data.responsavel_cpf || data.cpf_responsavel || "").replace(/\D/g, "");
    if (!cleanCpfResp || cleanCpfResp.length !== 11 || !isValidCPF(cleanCpfResp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF do responsável legal inválido.",
        path: ["responsavel_cpf"],
      });
    }
  }
});

export type FounderFormData = z.infer<typeof founderFormSchema>;

export interface FounderFormProps {
  isUpdateMode?: boolean;
  leadRecord?: any;
  defaultValues?: Partial<FounderFormData>;
  submitButtonText?: string;
  hideAlreadyRegisteredButton?: boolean;
  onSuccess?: (data: { user: any; waitlistData: any }) => void;
  className?: string;
}

/* ==============================================================================
   COMPONENTE CANÔNICO: FounderForm
   ============================================================================== */
export default function FounderForm({
  isUpdateMode = false,
  leadRecord,
  defaultValues = {},
  submitButtonText,
  hideAlreadyRegisteredButton = false,
  onSuccess,
  className = "",
}: FounderFormProps) {
  const navigate = useNavigate();

  // Estados locais de interface
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ user: any; waitlistData: any } | null>(null);

  // Determina o tipo inicial (PF por padrão ou PJ se lead já tiver cnpj)
  const initialTipoPessoa = defaultValues?.tipoPessoa || (leadRecord?.cnpj ? "PJ" : "PF");

  const form = useForm<FounderFormData>({
    resolver: zodResolver(founderFormSchema),
    defaultValues: {
      tipoPessoa: initialTipoPessoa,
      nome: defaultValues?.nome || leadRecord?.nome || "",
      cpf: defaultValues?.cpf ? maskCPF(defaultValues.cpf) : (leadRecord?.cpf ? maskCPF(leadRecord.cpf) : ""),
      razao_social: defaultValues?.razao_social || leadRecord?.razao_social || defaultValues?.nome_empresa || leadRecord?.nome_empresa || "",
      cnpj: defaultValues?.cnpj ? maskCNPJ(defaultValues.cnpj) : (leadRecord?.cnpj ? maskCNPJ(leadRecord.cnpj) : ""),
      responsavel_nome: defaultValues?.responsavel_nome || leadRecord?.responsavel_nome || defaultValues?.responsavel_legal || leadRecord?.responsavel_legal || "",
      responsavel_cpf: defaultValues?.responsavel_cpf ? maskCPF(defaultValues.responsavel_cpf) : (leadRecord?.cpf_responsavel ? maskCPF(leadRecord.cpf_responsavel) : ""),
      telefone: defaultValues?.telefone ? maskPhone(defaultValues.telefone) : (leadRecord?.telefone ? maskPhone(leadRecord.telefone) : ""),
      email: defaultValues?.email || leadRecord?.email || "",
      senha: "",
      confirmarSenha: "",
      consentimento_lgpd: defaultValues?.consentimento_lgpd ?? true,
      ...defaultValues,
    },
    mode: "onBlur"
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = form;

  const currentTipo = watch("tipoPessoa");
  const isPF = currentTipo === "PF";
  const consentLgpd = watch("consentimento_lgpd");

  // Função para executar a celebração com chuva de confetes exagerada em primeiro plano
  const triggerExaggeratedConfetti = () => {
    const count = 380;
    const defaults = {
      origin: { y: 0.6 },
      zIndex: 999999,
      colors: ["#00FF66", "#00E5FF", "#FFFFFF", "#FFD700", "#10B981"]
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  // Tratamento de Erros de Validação no Front-End
  const onInvalid = (formErrors: any) => {
    console.warn("[FounderForm] Erros de validação Zod:", formErrors);
    const errorKeys = Object.keys(formErrors);

    if (errorKeys.length > 0) {
      const firstKey = errorKeys[0];
      const errorMsg = formErrors[firstKey]?.message || "Verifique os campos obrigatórios.";
      toast.error(errorMsg);

      // Scroll suave até o primeiro campo com pendência
      const targetElement = document.getElementById(`field-${firstKey}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        targetElement.focus();
      }
    }
  };

  // Submissão Oficial
  const onSubmit = async (values: FounderFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const cleanCpf = (values.cpf || "").replace(/\D/g, "");
      const cleanCnpj = (values.cnpj || "").replace(/\D/g, "");
      const cleanCpfResp = (values.responsavel_cpf || values.cpf_responsavel || "").replace(/\D/g, "");
      const nomeFinal = isPF ? (values.nome || "").trim() : (values.razao_social || values.nome_empresa || "").trim();
      const userRole = isPF ? "morador" : "associacao";
      const perfilArray = isPF ? ["morador"] : ["associacao"];

      // Metadados do dispositivo
      const ua = navigator.userAgent;
      const lang = navigator.language;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const now = new Date();
      const createdLocal = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const seed = `${ua}-${lang}-${screenRes}`;
      const ipHashVal = await sha256(seed);
      const parsedUA = parseUserAgent(ua);

      // Payload estrito para public.waitlist
      const waitlistPayload: any = {
        tipo_pessoa: values.tipoPessoa,
        nome: nomeFinal,
        cpf: isPF ? cleanCpf : cleanCpfResp,
        cnpj: isPF ? null : cleanCnpj,
        razao_social: isPF ? null : (values.razao_social || values.nome_empresa)?.trim(),
        responsavel_legal: isPF ? null : (values.responsavel_nome || values.responsavel_legal)?.trim(),
        responsavel_nome: isPF ? null : (values.responsavel_nome || values.responsavel_legal)?.trim(),
        cpf_responsavel: isPF ? null : cleanCpfResp,
        email: values.email.trim().toLowerCase(),
        telefone: values.telefone.trim(),
        cidade: "Ubatuba",
        role: userRole,
        perfil: perfilArray,
        perfis: perfilArray,
        consentimento_lgpd: true,
        aceita_termos: true,
        status: "pendente_aprovacao",
        cadastro_completo: false,
        created_at_local: createdLocal,
        origem: "direto",
        referer: document.referrer || null,
        ip_hash: ipHashVal,
        device_type: parsedUA.device_type,
        browser: parsedUA.browser,
        os: parsedUA.os,
        updated_at: new Date().toISOString()
      };

      // 1º Passo: Upsert resiliente na tabela public.waitlist com onConflict: 'telefone'
      const { data: upsertData, error: upsertError } = await supabase
        .from("waitlist")
        .upsert(waitlistPayload, { onConflict: "telefone" })
        .select();

      if (upsertError) {
        console.error("[FounderForm] Erro no upsert da waitlist:", upsertError);
        throw upsertError;
      }

      const savedRecord = upsertData?.[0] || null;
      const targetLeadId = savedRecord?.id || leadRecord?.id || null;

      let authenticatedUser: any = null;

      // 2º Passo: Auth signUp não-bloqueante (protegido contra HTTP 429 e rate limit de e-mail)
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: values.email.trim().toLowerCase(),
          password: values.senha,
          options: {
            data: {
              nome: nomeFinal,
              tipo_pessoa: values.tipoPessoa,
              cpf: isPF ? cleanCpf : cleanCpfResp,
              cnpj: isPF ? null : cleanCnpj,
              telefone: values.telefone.trim(),
              role: userRole,
              perfil: perfilArray,
            }
          }
        });

        if (!authError && authData?.user) {
          authenticatedUser = authData.user;
          if (targetLeadId && authenticatedUser.id) {
            await supabase.from("waitlist").update({ user_id: authenticatedUser.id }).eq("id", targetLeadId);
          }
        } else if (authError) {
          console.warn("[FounderForm] Auth SignUp capturado de forma não-bloqueante:", authError);
          const authMsg = authError.message?.toLowerCase() || "";
          if (authMsg.includes("already registered") || authMsg.includes("already exists")) {
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: values.email.trim().toLowerCase(),
              password: values.senha,
            });
            if (signInData?.user?.id && targetLeadId) {
              authenticatedUser = signInData.user;
              await supabase.from("waitlist").update({ user_id: authenticatedUser.id }).eq("id", targetLeadId);
            }
          }
        }
      } catch (authCatchErr) {
        console.warn("[FounderForm] Exceção Auth não-bloqueante absorvida:", authCatchErr);
      }

      // 3º Passo: Celebração Exagerada, Feedback Visual e Modal de Aprovação da Alta Gestão
      triggerExaggeratedConfetti();

      toast.success("Cadastro realizado com sucesso! 🎉", {
        description: "Seus dados foram enviados para aprovação da Alta Gestão da UBT.",
        duration: 6000,
        style: {
          background: "#052e16",
          color: "#00FF66",
          border: "1px solid #00FF66",
        }
      });

      trackEvent("founder_lean_signup_success", "marketing", {
        tipo_pessoa: values.tipoPessoa,
        role: userRole
      });
      logSystem("INFO", "WAITLIST", "founder_lean_signup_success", "success");

      const finalData = {
        user: authenticatedUser,
        waitlistData: savedRecord || waitlistPayload
      };
      setSubmittedData(finalData);
      setShowApprovalModal(true);

    } catch (err: any) {
      console.error("[FounderForm] Falha na submissão:", err);
      const msg = err.message || "Erro de conexão ao processar o cadastro. Tente novamente.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full max-w-xl mx-auto rounded-3xl bg-black border border-zinc-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl ${className}`}>
      {/* Glow Superior Neon */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-[#00FF66] to-transparent opacity-80 blur-sm pointer-events-none" />

      {/* Cabeçalho do Formulário */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono text-[#00FF66] uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
          <span>ACESSO PIONEIRO • MEMBRO FUNDADOR</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
          Entrada de Fundadores
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-2">
          Cadastre-se para garantir seus benefícios exclusivos e prioridade no lançamento.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
        {/* SELETOR: TIPO DE CADASTRO */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono font-bold text-zinc-400 tracking-wider uppercase block">
            TIPO DE CADASTRO <span className="text-[#00FF66]">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opção PF */}
            <button
              type="button"
              onClick={() => {
                setValue("tipoPessoa", "PF", { shouldValidate: true });
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative flex items-center gap-3 cursor-pointer ${
                isPF
                  ? "bg-zinc-900 border-[#00FF66] shadow-[0_0_20px_rgba(0,255,102,0.25)] ring-1 ring-[#00FF66]"
                  : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isPF ? "bg-[#00FF66]/15 text-[#00FF66]" : "bg-zinc-900 text-zinc-500"
              }`}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold leading-tight ${isPF ? "text-white" : "text-zinc-300"}`}>
                  Usuário
                </div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                  Comprador ou vendedor (PF)
                </div>
              </div>
              {isPF && (
                <div className="w-5 h-5 rounded-full bg-[#00FF66] text-black flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>

            {/* Opção PJ */}
            <button
              type="button"
              onClick={() => {
                setValue("tipoPessoa", "PJ", { shouldValidate: true });
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative flex items-center gap-3 cursor-pointer ${
                !isPF
                  ? "bg-zinc-900 border-[#00FF66] shadow-[0_0_20px_rgba(0,255,102,0.25)] ring-1 ring-[#00FF66]"
                  : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !isPF ? "bg-[#00FF66]/15 text-[#00FF66]" : "bg-zinc-900 text-zinc-500"
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold leading-tight ${!isPF ? "text-white" : "text-zinc-300"}`}>
                  Associação / ONG
                </div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                  Entidade ou Empresa (PJ)
                </div>
              </div>
              {!isPF && (
                <div className="w-5 h-5 rounded-full bg-[#00FF66] text-black flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* CAMPOS CONDICIONAIS: SE USUÁRIO (PF) */}
        {isPF && (
          <div className="space-y-4 pt-2">
            {/* Nome Completo */}
            <div id="field-nome" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                NOME COMPLETO <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  {...register("nome")}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.nome ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
                />
              </div>
              {errors.nome && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.nome.message}</p>
              )}
            </div>

            {/* CPF */}
            <div id="field-cpf" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                CPF <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  {...register("cpf", {
                    onChange: (e) => {
                      e.target.value = maskCPF(e.target.value);
                    }
                  })}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.cpf ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm font-mono focus:outline-none transition-colors`}
                />
              </div>
              {errors.cpf && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.cpf.message}</p>
              )}
            </div>
          </div>
        )}

        {/* CAMPOS CONDICIONAIS: SE ASSOCIAÇÃO, ONG OU ENTIDADE (PJ) */}
        {!isPF && (
          <div className="space-y-4 pt-2">
            {/* Razão Social */}
            <div id="field-razao_social" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                RAZÃO SOCIAL / NOME DA ENTIDADE <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Nome oficial da Associação ou ONG"
                  {...register("razao_social")}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.razao_social ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
                />
              </div>
              {errors.razao_social && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.razao_social.message}</p>
              )}
            </div>

            {/* CNPJ */}
            <div id="field-cnpj" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                CNPJ <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  {...register("cnpj", {
                    onChange: (e) => {
                      e.target.value = maskCNPJ(e.target.value);
                    }
                  })}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.cnpj ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm font-mono focus:outline-none transition-colors`}
                />
              </div>
              {errors.cnpj && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.cnpj.message}</p>
              )}
            </div>

            {/* Responsável Legal: Nome */}
            <div id="field-responsavel_nome" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                NOME DO RESPONSÁVEL LEGAL <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Nome do representante legal"
                  {...register("responsavel_nome")}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.responsavel_nome ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
                />
              </div>
              {errors.responsavel_nome && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.responsavel_nome.message}</p>
              )}
            </div>

            {/* Responsável Legal: CPF */}
            <div id="field-responsavel_cpf" className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                CPF DO RESPONSÁVEL LEGAL <span className="text-[#00FF66]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  {...register("responsavel_cpf", {
                    onChange: (e) => {
                      e.target.value = maskCPF(e.target.value);
                    }
                  })}
                  className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                    errors.responsavel_cpf ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                  } text-white placeholder-zinc-600 text-sm font-mono focus:outline-none transition-colors`}
                />
              </div>
              {errors.responsavel_cpf && (
                <p className="text-[11px] text-red-400 font-sans mt-1">{errors.responsavel_cpf.message}</p>
              )}
            </div>
          </div>
        )}

        {/* CAMPOS COMUNS: WHATSAPP E E-MAIL */}
        <div className="space-y-4 pt-2">
          {/* WhatsApp */}
          <div id="field-telefone" className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              WHATSAPP <span className="text-[#00FF66]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Smartphone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(12) 99999-9999"
                maxLength={15}
                {...register("telefone", {
                  onChange: (e) => {
                    e.target.value = maskPhone(e.target.value);
                  }
                })}
                className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                  errors.telefone ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                } text-white placeholder-zinc-600 text-sm font-mono focus:outline-none transition-colors`}
              />
            </div>
            {errors.telefone && (
              <p className="text-[11px] text-red-400 font-sans mt-1">{errors.telefone.message}</p>
            )}
          </div>

          {/* E-mail Principal */}
          <div id="field-email" className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              E-MAIL PRINCIPAL <span className="text-[#00FF66]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                placeholder="seu.email@exemplo.com"
                {...register("email")}
                className={`w-full pl-10 pr-4 h-12 rounded-xl bg-zinc-950 border ${
                  errors.email ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-400 font-sans mt-1">{errors.email.message}</p>
            )}
          </div>
        </div>

        {/* CAMPOS COMUNS: SENHA E CONFIRMAÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Senha */}
          <div id="field-senha" className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              SENHA DE ACESSO <span className="text-[#00FF66]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                {...register("senha")}
                className={`w-full pl-10 pr-10 h-12 rounded-xl bg-zinc-950 border ${
                  errors.senha ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.senha && (
              <p className="text-[11px] text-red-400 font-sans mt-1">{errors.senha.message}</p>
            )}
          </div>

          {/* Confirmar Senha */}
          <div id="field-confirmarSenha" className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
              CONFIRMAR SENHA <span className="text-[#00FF66]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repita sua senha"
                {...register("confirmarSenha")}
                className={`w-full pl-10 pr-10 h-12 rounded-xl bg-zinc-950 border ${
                  errors.confirmarSenha ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus:border-[#00FF66]"
                } text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors font-sans`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmarSenha && (
              <p className="text-[11px] text-red-400 font-sans mt-1">{errors.confirmarSenha.message}</p>
            )}
          </div>
        </div>

        {/* CHECKBOX LGPD */}
        <div id="field-consentimento_lgpd" className="pt-2">
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all select-none">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={consentLgpd}
                {...register("consentimento_lgpd")}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                consentLgpd
                  ? "bg-[#00FF66] border-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]"
                  : "bg-zinc-900 border-zinc-700 text-transparent"
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
            <div className="text-xs text-zinc-300 font-sans leading-relaxed flex-1">
              Aceito os Termos de Uso e autorizo a coleta dos meus dados para validação pioneira da UBT em Ubatuba, conforme a LGPD.
            </div>
          </label>
          {errors.consentimento_lgpd && (
            <p className="text-[11px] text-red-400 font-sans mt-1.5 pl-1">{errors.consentimento_lgpd.message}</p>
          )}
        </div>

        {/* AVISO DE ERRO DE SUBMISSÃO SE HOUVER */}
        {submitError && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs font-sans">
            {submitError}
          </div>
        )}

        {/* BOTÃO DE AÇÃO PRINCIPAL COM TEXTO FIXO "CADASTRAR" */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 rounded-xl bg-[#00FF66] text-black font-black uppercase tracking-wider text-base shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:bg-[#00E55C] hover:shadow-[0_0_30px_rgba(0,255,102,0.7)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span>Cadastrar</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* LINK PARA JÁ CADASTRADO */}
        {!hideAlreadyRegisteredButton && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => navigate("/atualizacao-cadastral")}
              className="text-xs font-mono text-zinc-400 hover:text-[#00FF66] transition-colors underline decoration-dotted underline-offset-4 cursor-pointer"
            >
              Já fez sua pré-inscrição? Acesse a validação cadastral
            </button>
          </div>
        )}
      </form>

      {/* MODAL DE APROVAÇÃO DA ALTA GESTÃO DA UBT */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-950 border border-[#00FF66]/40 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(0,255,102,0.3)] flex flex-col items-center">
            {/* Glow Superior */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#00FF66] to-transparent" />
            
            {/* Ícone com Glow */}
            <div className="w-16 h-16 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] mb-4 shadow-[0_0_20px_rgba(0,255,102,0.2)]">
              <ShieldCheck className="w-8 h-8" />
            </div>

            {/* Badge de Status */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-mono text-[#00FF66] uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-ping" />
              <span>Alta Gestão UBT • Análise Pioneira</span>
            </div>

            {/* Título */}
            <h3 className="font-display font-extrabold text-2xl text-white tracking-tight mb-2">
              Cadastro em Aprovação!
            </h3>

            {/* Descrição */}
            <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed mb-6">
              Sua solicitação de Membro Fundador foi registrada com sucesso e enviada para a fila de validação da <strong className="text-white">Alta Gestão da UBT</strong>. Em breve você receberá a confirmação de ativação do seu perfil pioneiro e o seu link oficial de apadrinhamento via WhatsApp.
            </p>

            {/* Botão de Fechamento */}
            <button
              type="button"
              onClick={() => {
                setShowApprovalModal(false);
                if (onSuccess && submittedData) {
                  onSuccess(submittedData);
                }
              }}
              className="w-full h-12 rounded-xl bg-[#00FF66] text-black font-black uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:bg-[#00E55C] hover:shadow-[0_0_30px_rgba(0,255,102,0.6)] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Entendido</span>
              <Check className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
