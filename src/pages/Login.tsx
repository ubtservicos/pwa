import { AlertCircle, Eye, EyeOff, Fingerprint, Lock, LogIn, Mail, MessageSquare } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthTopBar from "@/components/auth/AuthTopBar";
import FormField from "@/components/auth/FormField";
import GhostButton from "@/components/auth/GhostButton";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { isValidEmail } from "@/utils/masks";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

const Login = () => {
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  const [loginError, setLoginError] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: { email?: string; senha?: string } = {};
    if (!email) next.email = "Informe seu e-mail";
    else if (!isValidEmail(email)) next.email = "E-mail inválido";
    if (!senha) next.senha = "Informe sua senha";
    else if (senha.length < 6) next.senha = "Mínimo 6 caracteres";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    if (!validate()) return;
    setLoading(true);
    const startTime = Date.now();
    logSystem("INFO", "AUTH", "login_submit", "started", undefined, undefined, undefined, { email });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      const duration = Date.now() - startTime;

      if (error) {
        setLoginError(true);
        showToast("Credenciais inválidas. Por favor, verifique seu e-mail e senha. ❌");
        trackEvent("login_failed", "ux", { reason: error.message });
        logSystem("WARNING", "AUTH", "login_submit", "failed", duration, error.message, error.status?.toString() || "AUTH_FAILED", { email });
      } else {
        trackEvent("login", "ux", { user_id: data.user.id });
        logSystem("INFO", "AUTH", "login_submit", "success", duration, undefined, undefined, { email });
        if (email === "ubt.servicos@gmail.com") {
          navigate("/admin");
        } else {
          navigate("/app/home");
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setLoginError(true);
      trackEvent("login_failed", "ux", { reason: error?.message });
      logSystem("ERROR", "AUTH", "login_submit", "failed", duration, error?.message, "UNEXPECTED_ERROR", { email });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-navy text-white flex flex-col px-6 overflow-hidden">
      <AuthTopBar backTo="/" />

      <main className="flex-1 flex flex-col">
        <div className="mt-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "hsl(var(--green) / 0.12)" }}
          >
            <LogIn size={28} className="text-green" />
          </div>
          <h1 className="font-display font-extrabold text-[26px] leading-tight text-white mt-4">
            Bem-vindo de volta.
          </h1>
          <p className="font-sans text-sm text-white/60 mt-1.5">
            Entre com seu e-mail e senha ou use a biometria.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          <FormField
            label="E-mail"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={loading}
          />

          <FormField
            label="Senha"
            icon={Lock}
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            error={errors.senha}
            disabled={loading}
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

          <div className="-mt-2 flex justify-end">
            <Link
              to="/recuperar-senha"
              className="font-sans text-[13px] text-green hover:text-green-dark"
            >
              Esqueci minha senha
            </Link>
          </div>

          {loginError && (
            <div
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-3 border"
              style={{
                background: "hsl(var(--red) / 0.10)",
                borderColor: "hsl(var(--red))",
              }}
            >
              <AlertCircle size={16} className="text-[hsl(var(--red))] shrink-0" />
              <span className="font-sans text-[13px] text-[hsl(var(--red))]">
                E-mail ou senha incorretos.
              </span>
            </div>
          )}

          <PrimaryButton
            type="submit"
            loading={loading}
            loadingText="Entrando..."
            className="mt-1"
          >
            Entrar
          </PrimaryButton>
        </form>

        <div className="flex items-center gap-3 my-7">
          <div className="flex-1 h-px bg-white/10" />
          <span className="font-sans text-[12px] text-white/40">ou</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex flex-col gap-3">
          <GhostButton
            onClick={() => showToast("Biometria disponível no app instalado")}
          >
            <Fingerprint size={20} className="text-green" />
            Acessar com biometria
          </GhostButton>
          <GhostButton
            onClick={() => showToast("Link enviado para o número cadastrado")}
          >
            <MessageSquare size={20} className="text-white/45" />
            Receber link por SMS
          </GhostButton>
        </div>

        <div className="mt-auto pt-8 pb-6 text-center">
          <span className="font-sans text-sm text-white/55">Não tem conta? </span>
          <button
            type="button"
            onClick={() => navigate("/cadastro")}
            className="font-sans text-sm font-semibold text-green hover:text-green-dark"
          >
            Cadastre-se
          </button>
        </div>
      </main>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default Login;
