import {
  CreditCard,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthTopBar from "@/components/auth/AuthTopBar";
import BiometriaModal from "@/components/auth/BiometriaModal";
import FormField from "@/components/auth/FormField";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { isValidEmail, maskCPF, maskPhone, maskCNPJ } from "@/utils/masks";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import WelcomeFundadorModal from "@/components/WelcomeFundadorModal";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Strength = "fraca" | "razoavel" | "forte";

const getStrength = (senha: string): Strength | null => {
  if (!senha) return null;
  if (senha.length < 8) return "fraca";
  const hasDigit = /\d/.test(senha);
  const hasLetter = /[a-zA-Z]/.test(senha);
  if (hasDigit && hasLetter) return "forte";
  return "razoavel";
};

const BAIRROS_LIST = [
  "Centro", "Itaguá", "Perequê-Açu", "Toninhas", "Praia Grande",
  "Estufa I", "Estufa II", "Ipiranguinha", "Mato Dentro", "Marafunda"
];

const PRAIAS_LIST = [
  "Praia Grande", "Tenório", "Toninhas", "Enseada", "Lázaro",
  "Perequê-Açu", "Vermelha do Norte", "Itamambuca", "Ubatumirim", "Felix"
];

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const cadastroSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone incompleto"),
  senha: z.string().min(8, "Mínimo 8 caracteres"),
  confirmarSenha: z.string(),
  perfil: z.enum(["tomador", "mototaxista", "ambulante", "associacao"]),
  cpf: z.string().optional(),
  pix: z.string().optional(),
  cnpj: z.string().optional(),
  bairro_moradia: z.string().optional(),
  bairro_trabalho: z.string().optional(),
  praias_frequentadas: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.senha !== data.confirmarSenha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "As senhas não coincidem",
      path: ["confirmarSenha"],
    });
  }

  if (data.perfil === "associacao") {
    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ inválido",
        path: ["cnpj"],
      });
    }
  } else {
    const cleanCpf = (data.cpf || "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF incompleto",
        path: ["cpf"],
      });
    }

    if (!data.pix || !data.pix.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe sua chave Pix",
        path: ["pix"],
      });
    }

    if (data.perfil === "tomador" || data.perfil === "mototaxista") {
      if (!data.bairro_moradia || !data.bairro_moradia.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione o seu bairro de moradia",
          path: ["bairro_moradia"],
        });
      }
    }

    if (data.perfil === "tomador") {
      if (!data.bairro_trabalho || !data.bairro_trabalho.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione o seu bairro de trabalho",
          path: ["bairro_trabalho"],
        });
      }
    }
  }
});

type CadastroFormData = z.infer<typeof cadastroSchema>;

const Cadastro = () => {
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();

  useEffect(() => {
    trackEvent("signup_started");
  }, []);

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometriaOpen, setBiometriaOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [registeredName, setRegisteredName] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setFocus,
    formState: { errors, isValid },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    mode: "onChange",
    defaultValues: {
      nome: "",
      cpf: "",
      telefone: "",
      email: "",
      pix: "",
      senha: "",
      confirmarSenha: "",
      perfil: "tomador",
      cnpj: "",
      bairro_moradia: "",
      bairro_trabalho: "",
      praias_frequentadas: [],
    },
  });

  const perfil = watch("perfil");
  const passwordValue = watch("senha");
  const praiasFrequentadas = watch("praias_frequentadas") || [];

  const strength = useMemo(() => getStrength(passwordValue), [passwordValue]);

  const [searchParams] = useSearchParams();

  const onInvalid = (formErrors: typeof errors) => {
    const errorKeys = Object.keys(formErrors) as (keyof CadastroFormData)[];
    if (errorKeys.length > 0) {
      const firstError = errorKeys[0];
      setFocus(firstError);
      const element = document.getElementsByName(firstError)[0] as HTMLElement;
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showToast("Preencha todos os campos obrigatórios em destaque.");
    }
  };

  const onSubmit = async (values: CadastroFormData) => {
    setLoading(true);
    const startTime = Date.now();
    logSystem("INFO", "AUTH", "signup_submit", "started", undefined, undefined, undefined, { email: values.email });
    
    try {
      const referral = searchParams.get("ref") || "";

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.senha,
        options: {
          data: {
            full_name: values.nome,
            cpf: values.perfil === "associacao" ? null : values.cpf,
            telefone: values.telefone,
            pix: values.perfil === "associacao" ? null : values.pix,
            padrinho_id: referral || null,
          }
        }
      });

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSystem("INFO", "AUTH", "signup_submit", "success", duration, undefined, undefined, { email: values.email, referral });

      if (data?.user) {
        trackEvent("signup_completed", { method: "email" }, data.user.id);
        const userId = data.user.id;
        const mappedRole = values.perfil === "mototaxista" || values.perfil === "ambulante" ? "prestador" : values.perfil;

        // Persist profile data explicitly with 'pending' status
        const { error: dbError } = await supabase.from("usuarios").upsert({
          id: userId,
          nome: values.nome,
          role: mappedRole,
          cpf: values.perfil === "associacao" ? null : values.cpf,
          telefone: values.telefone,
          chave_pix: values.perfil === "associacao" ? null : values.pix,
          status: "pending", // Created as pending for administrative review
          padrinho_id: referral || null,
          bairro_moradia: (values.perfil === "tomador" || values.perfil === "mototaxista") ? values.bairro_moradia : null,
          bairro_trabalho: values.perfil === "tomador" ? values.bairro_trabalho : null,
          praias_frequenta: values.perfil === "tomador" ? values.praias_frequentadas : null,
          praias_atende: values.perfil === "ambulante" ? values.praias_frequentadas : null,
          cnpj: values.perfil === "associacao" ? values.cnpj : null
        }, { onConflict: "id" });

        if (dbError) {
          console.error("Erro ao salvar perfil do usuario logado:", dbError);
        }

        setRegisteredName(values.nome);
        setLoading(false);
        setWelcomeModalOpen(true);
      } else {
        setLoading(false);
        setBiometriaOpen(true);
      }
    } catch (err: any) {
      setLoading(false);
      const duration = Date.now() - startTime;
      logSystem("ERROR", "AUTH", "signup_submit", "failed", duration, err.message, err.code || "SIGNUP_ERROR", { email: values.email });
      showToast(err.message || "Erro ao criar conta.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
    } catch (err: any) {
      showToast(err.message || "Erro ao conectar com Google");
    }
  };

  const strengthMeta: Record<Strength, { label: string; color: string; segs: number }> = {
    fraca: { label: "Fraca", color: "hsl(var(--red))", segs: 1 },
    razoavel: { label: "Razoável", color: "hsl(var(--amber))", segs: 2 },
    forte: { label: "Forte", color: "hsl(var(--green))", segs: 3 },
  };

  return (
    <div className="min-h-[100svh] bg-navy text-white px-6 pb-32">
      <AuthTopBar backTo="/login" />

      <div className="mt-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(var(--green) / 0.12)" }}
        >
          <UserPlus size={28} className="text-green" />
        </div>
        <h1 className="font-display font-extrabold text-[26px] leading-tight text-white mt-4">
          Criar conta gratuita.
        </h1>
        <p className="font-sans text-sm text-white/60 mt-1.5">
          Preencha os dados abaixo. Leva menos de 2 minutos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-7 flex flex-col gap-4" noValidate>
        {/* Dynamic Profile Selector */}
        <div className="mb-2">
          <label className="block font-sans text-[12px] font-semibold mb-1.5 text-white/70">
            Tipo de Perfil
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "tomador", label: "Morador / Turista" },
              { key: "mototaxista", label: "Mototaxista" },
              { key: "ambulante", label: "Ambulante" },
              { key: "associacao", label: "Associação B2B" }
            ] as const).map(({ key, label }) => {
              const sel = perfil === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setValue("perfil", key);
                    setValue("bairro_moradia", "");
                    setValue("bairro_trabalho", "");
                    setValue("praias_frequentadas", []);
                    setValue("cnpj", "");
                  }}
                  className="rounded-xl p-3 text-left border transition-all"
                  style={{
                    background: sel ? "rgba(0, 255, 102, 0.08)" : "rgba(255, 255, 255, 0.04)",
                    borderColor: sel ? "#00FF66" : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <span className="font-sans text-[13px] font-semibold text-white">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <FormField
          label={perfil === "associacao" ? "Razão Social da Entidade" : "Nome completo"}
          icon={User}
          placeholder={perfil === "associacao" ? "Nome da entidade B2B" : "Como você se chama?"}
          autoComplete="name"
          error={errors.nome?.message}
          {...register("nome")}
        />

        {perfil === "associacao" ? (
          <FormField
            label="CNPJ"
            icon={CreditCard}
            type="tel"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            error={errors.cnpj?.message}
            {...register("cnpj", {
              onChange: (e) => {
                setValue("cnpj", maskCNPJ(e.target.value));
              }
            })}
          />
        ) : (
          <FormField
            label="CPF"
            icon={CreditCard}
            type="tel"
            inputMode="numeric"
            placeholder="000.000.000-00"
            error={errors.cpf?.message}
            {...register("cpf", {
              onChange: (e) => {
                setValue("cpf", maskCPF(e.target.value));
              }
            })}
          />
        )}

        <FormField
          label="Telefone"
          icon={Phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
          error={errors.telefone?.message}
          {...register("telefone", {
            onChange: (e) => {
              setValue("telefone", maskPhone(e.target.value));
            }
          })}
        />

        <FormField
          label="E-mail"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register("email")}
        />

        {perfil !== "associacao" && (
          <div>
            <FormField
              label="Chave Pix"
              icon={Key}
              placeholder="CPF, e-mail ou telefone"
              error={errors.pix?.message}
              {...register("pix")}
            />
            <p className="mt-1.5 font-sans text-[11px] text-white/40">
              Usada para receber seus pagamentos na plataforma
            </p>
          </div>
        )}

        {/* Dynamic fields based on roles mapping */}
        {(perfil === "tomador" || perfil === "mototaxista") && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-1.5 text-white/70">
              Bairro de Moradia
            </label>
            <select
              {...register("bairro_moradia")}
              className="w-full h-[54px] rounded-xl px-4 bg-[#18181B] border border-[#27272A] text-white outline-none font-sans text-[14px]"
            >
              <option value="">Selecione o bairro...</option>
              {BAIRROS_LIST.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bairro_moradia && (
              <p className="mt-1 text-red-500 text-[11px]">{errors.bairro_moradia.message}</p>
            )}
          </div>
        )}

        {perfil === "tomador" && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-1.5 text-white/70">
              Bairro de Trabalho
            </label>
            <select
              {...register("bairro_trabalho")}
              className="w-full h-[54px] rounded-xl px-4 bg-[#18181B] border border-[#27272A] text-white outline-none font-sans text-[14px]"
            >
              <option value="">Selecione o bairro...</option>
              {BAIRROS_LIST.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bairro_trabalho && (
              <p className="mt-1 text-red-500 text-[11px]">{errors.bairro_trabalho.message}</p>
            )}
          </div>
        )}

        {(perfil === "tomador" || perfil === "ambulante") && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-2 text-white/70">
              {perfil === "ambulante" ? "Praias que costuma atender" : "Praias que frequenta em Ubatuba"}
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
              {PRAIAS_LIST.map((p) => {
                const checked = praiasFrequentadas.includes(p);
                return (
                  <label key={p} className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? praiasFrequentadas.filter((x) => x !== p)
                          : [...praiasFrequentadas, p];
                        setValue("praias_frequentadas", next, { shouldValidate: true });
                      }}
                      className="rounded border-[#27272A] text-[#00FF66] focus:ring-0 bg-[#09090B]"
                    />
                    <span>{p}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <FormField
            label="Senha"
            icon={Lock}
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            error={errors.senha?.message}
            {...register("senha")}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />
          {strength && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-[3px] rounded-full transition-colors"
                    style={{
                      background:
                        i < strengthMeta[strength].segs
                          ? strengthMeta[strength].color
                          : "rgba(255,255,255,0.10)",
                    }}
                  />
                ))}
              </div>
              <span
                className="font-sans text-[11px] font-semibold"
                style={{ color: strengthMeta[strength].color }}
              >
                {strengthMeta[strength].label}
              </span>
            </div>
          )}
        </div>

        <FormField
          label="Confirmar senha"
          icon={Lock}
          type={showConfirmPwd ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repita a senha"
          error={errors.confirmarSenha?.message}
          {...register("confirmarSenha")}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowConfirmPwd((v) => !v)}
              aria-label={showConfirmPwd ? "Ocultar senha" : "Mostrar senha"}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              {showConfirmPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          }
        />

        <PrimaryButton
          type="submit"
          disabled={!isValid || loading}
          loading={loading}
          loadingText="Criando conta..."
          className="mt-4"
        >
          Criar conta
        </PrimaryButton>
      </form>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="font-sans text-[11px] text-white/40 uppercase tracking-widest">ou</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full mt-6 h-[54px] rounded-full flex items-center justify-center gap-3 bg-white text-navy font-display font-bold text-[15px] transition-transform active:scale-95"
      >
        <GoogleIcon />
        Cadastrar com Google
      </button>

      <div className="mt-8 text-center">
        <span className="font-sans text-sm text-white/55">Já tem conta? </span>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="font-sans text-sm font-semibold text-green hover:text-green-dark"
        >
          Entrar
        </button>
      </div>

      {/* Welcome Celebration Modal for New Registered Founders */}
      <WelcomeFundadorModal
        isOpen={welcomeModalOpen}
        onClose={() => {
          setWelcomeModalOpen(false);
          setBiometriaOpen(true);
        }}
        userName={registeredName}
        ctaText="Acessar meu Painel"
        onCtaClick={() => {
          setWelcomeModalOpen(false);
          setBiometriaOpen(true);
        }}
      />

      <BiometriaModal
        open={biometriaOpen}
        onActivate={() => {
          showToast("Biometria ativada com sucesso!");
          setBiometriaOpen(false);
          setTimeout(() => navigate("/app/home"), 600);
        }}
        onSkip={() => {
          setBiometriaOpen(false);
          navigate("/app/home");
        }}
      />

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default Cadastro;
