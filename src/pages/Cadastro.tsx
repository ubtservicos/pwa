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
import { FormEvent, useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthTopBar from "@/components/auth/AuthTopBar";
import BiometriaModal from "@/components/auth/BiometriaModal";
import FormField from "@/components/auth/FormField";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { isValidEmail, maskCPF, maskPhone } from "@/utils/masks";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

type FormState = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  pix: string;
  senha: string;
  confirmarSenha: string;
};

type Strength = "fraca" | "razoavel" | "forte";

const getStrength = (senha: string): Strength | null => {
  if (!senha) return null;
  if (senha.length < 8) return "fraca";
  const hasDigit = /\d/.test(senha);
  const hasLetter = /[a-zA-Z]/.test(senha);
  if (hasDigit && hasLetter) return "forte";
  return "razoavel";
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Cadastro = () => {
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();

  useEffect(() => {
    trackEvent("signup_started");
  }, []);

  const [form, setForm] = useState<FormState>({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    pix: "",
    senha: "",
    confirmarSenha: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometriaOpen, setBiometriaOpen] = useState(false);

  const strength = useMemo(() => getStrength(form.senha), [form.senha]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.nome || form.nome.trim().length < 3) next.nome = "Mínimo 3 caracteres";
    if (form.cpf.length !== 14) next.cpf = "CPF incompleto";
    if (form.telefone.replace(/\D/g, "").length < 10) next.telefone = "Telefone incompleto";
    if (!form.email) next.email = "Informe seu e-mail";
    else if (!isValidEmail(form.email)) next.email = "E-mail inválido";
    if (!form.pix.trim()) next.pix = "Informe sua chave Pix";
    if (!form.senha) next.senha = "Informe uma senha";
    else if (form.senha.length < 8) next.senha = "Mínimo 8 caracteres";
    if (!form.confirmarSenha) next.confirmarSenha = "Confirme a senha";
    else if (form.senha !== form.confirmarSenha)
      next.confirmarSenha = "As senhas não coincidem";
    setErrors(next);
    return Object.keys(next).length === 0;
  };


  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const startTime = Date.now();
    logSystem("INFO", "AUTH", "signup_submit", "started", undefined, undefined, undefined, { email: form.email });
    
    try {
      const referral = searchParams.get("ref") || "";

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: {
          data: {
            full_name: form.nome,
            cpf: form.cpf,
            telefone: form.telefone,
            pix: form.pix,
            padrinho_id: referral || null,
          }
        }
      });

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSystem("INFO", "AUTH", "signup_submit", "success", duration, undefined, undefined, { email: form.email, referral });

      if (data?.user) {
        trackEvent("signup_completed", { method: "email" }, data.user.id);
      }

      if (data?.user && referral) {
        const userId = data.user.id;
        try {
          await supabase
            .from("profiles")
            .update({ padrinho_id: referral })
            .eq("id", userId);
          await supabase
            .from("usuarios")
            .update({ padrinho_id: referral })
            .eq("id", userId);
        } catch (dbErr) {
          console.error("Error setting padrinho in DB tables:", dbErr);
        }
      }

      setLoading(false);
      setBiometriaOpen(true);
    } catch (err: any) {
      setLoading(false);
      const duration = Date.now() - startTime;
      logSystem("ERROR", "AUTH", "signup_submit", "failed", duration, err.message, err.code || "SIGNUP_ERROR", { email: form.email });
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

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        <FormField
          label="Nome completo"
          icon={User}
          placeholder="Como você se chama?"
          autoComplete="name"
          value={form.nome}
          onChange={(e) => update("nome", e.target.value)}
          error={errors.nome}
        />

        <FormField
          label="CPF"
          icon={CreditCard}
          type="tel"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={form.cpf}
          onChange={(e) => update("cpf", maskCPF(e.target.value))}
          error={errors.cpf}
        />

        <FormField
          label="Telefone"
          icon={Phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
          value={form.telefone}
          onChange={(e) => update("telefone", maskPhone(e.target.value))}
          error={errors.telefone}
        />

        <FormField
          label="E-mail"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
        />

        <div>
          <FormField
            label="Chave Pix"
            icon={Key}
            placeholder="CPF, e-mail ou telefone"
            value={form.pix}
            onChange={(e) => update("pix", e.target.value)}
            error={errors.pix}
          />
          <p className="mt-1.5 font-sans text-[11px] text-white/40">
            Usada para receber seus pagamentos na plataforma
          </p>
        </div>

        <div>
          <FormField
            label="Senha"
            icon={Lock}
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={form.senha}
            onChange={(e) => update("senha", e.target.value)}
            error={errors.senha}
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
          value={form.confirmarSenha}
          onChange={(e) => update("confirmarSenha", e.target.value)}
          error={errors.confirmarSenha}
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
