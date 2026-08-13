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
import { isValidEmail, maskCPF, maskPhone, maskCNPJ } from "@/utils/masks";
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
  role: "tomador" | "mototaxista" | "ambulante" | "associacao";
  cnpj: string;
  bairroMoradia: string;
  bairroTrabalho: string;
  praiasFrequenta: string[];
  praiasAtende: string[];
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
    role: "tomador",
    cnpj: "",
    bairroMoradia: "",
    bairroTrabalho: "",
    praiasFrequenta: [],
    praiasAtende: [],
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
    if (form.telefone.replace(/\D/g, "").length < 10) next.telefone = "Telefone incompleto";
    if (!form.email) next.email = "Informe seu e-mail";
    else if (!isValidEmail(form.email)) next.email = "E-mail inválido";
    if (!form.senha) next.senha = "Informe uma senha";
    else if (form.senha.length < 8) next.senha = "Mínimo 8 caracteres";
    if (!form.confirmarSenha) next.confirmarSenha = "Confirme a senha";
    else if (form.senha !== form.confirmarSenha)
      next.confirmarSenha = "As senhas não coincidem";

    // Conditional role validations
    if (form.role === "associacao") {
      if (form.cnpj.replace(/\D/g, "").length !== 14) {
        next.cnpj = "CNPJ inválido";
      }
    } else {
      if (form.cpf.length !== 14) next.cpf = "CPF incompleto";
      if (!form.pix.trim()) next.pix = "Informe sua chave Pix";
      if (!form.bairroMoradia) next.bairroMoradia = "Selecione o seu bairro de moradia";
      
      if (form.role === "tomador") {
        if (!form.bairroTrabalho) next.bairroTrabalho = "Selecione o seu bairro de trabalho";
      }
    }

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
            cpf: form.role === "associacao" ? null : form.cpf,
            telefone: form.telefone,
            pix: form.role === "associacao" ? null : form.pix,
            padrinho_id: referral || null,
          }
        }
      });

      if (error) throw error;

      const duration = Date.now() - startTime;
      logSystem("INFO", "AUTH", "signup_submit", "success", duration, undefined, undefined, { email: form.email, referral });

      if (data?.user) {
        trackEvent("signup_completed", { method: "email" }, data.user.id);
        const userId = data.user.id;
        const mappedRole = form.role === "mototaxista" || form.role === "ambulante" ? "prestador" : form.role;

        // Persist profile data explicitly with 'pending' status
        const { error: dbError } = await supabase.from("usuarios").upsert({
          id: userId,
          nome: form.nome,
          role: mappedRole,
          cpf: form.role === "associacao" ? null : form.cpf,
          telefone: form.telefone,
          chave_pix: form.role === "associacao" ? null : form.pix,
          status: "pending", // Created as pending for administrative review
          padrinho_id: referral || null,
          bairro_moradia: form.role === "associacao" ? null : form.bairroMoradia,
          bairro_trabalho: form.role === "tomador" ? form.bairroTrabalho : null,
          praias_frequenta: form.role === "tomador" ? form.praiasFrequenta : null,
          praias_atende: form.role === "ambulante" ? form.praiasAtende : null,
          cnpj: form.role === "associacao" ? form.cnpj : null
        }, { onConflict: "id" });

        if (dbError) {
          console.error("Erro ao salvar perfil do usuario logado:", dbError);
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
              const sel = form.role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update("role", key)}
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
          label={form.role === "associacao" ? "Razão Social da Entidade" : "Nome completo"}
          icon={User}
          placeholder={form.role === "associacao" ? "Nome da entidade B2B" : "Como você se chama?"}
          autoComplete="name"
          value={form.nome}
          onChange={(e) => update("nome", e.target.value)}
          error={errors.nome}
        />

        {form.role === "associacao" ? (
          <FormField
            label="CNPJ"
            icon={CreditCard}
            type="tel"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={form.cnpj}
            onChange={(e) => update("cnpj", maskCNPJ(e.target.value))}
            error={errors.cnpj}
          />
        ) : (
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
        )}

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

        {form.role !== "associacao" && (
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
        )}

        {/* Dynamic fields based on roles */}
        {form.role !== "associacao" && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-1.5 text-white/70">
              Bairro de Moradia
            </label>
            <select
              value={form.bairroMoradia}
              onChange={(e) => update("bairroMoradia", e.target.value)}
              className="w-full h-[54px] rounded-xl px-4 bg-[#18181B] border border-[#27272A] text-white outline-none font-sans text-[14px]"
            >
              <option value="">Selecione o bairro...</option>
              {BAIRROS_LIST.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bairroMoradia && (
              <p className="mt-1 text-red-500 text-[11px]">{errors.bairroMoradia}</p>
            )}
          </div>
        )}

        {form.role === "tomador" && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-1.5 text-white/70">
              Bairro de Trabalho
            </label>
            <select
              value={form.bairroTrabalho}
              onChange={(e) => update("bairroTrabalho", e.target.value)}
              className="w-full h-[54px] rounded-xl px-4 bg-[#18181B] border border-[#27272A] text-white outline-none font-sans text-[14px]"
            >
              <option value="">Selecione o bairro...</option>
              {BAIRROS_LIST.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.bairroTrabalho && (
              <p className="mt-1 text-red-500 text-[11px]">{errors.bairroTrabalho}</p>
            )}
          </div>
        )}

        {form.role === "tomador" && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-2 text-white/70">
              Praias que frequenta em Ubatuba
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
              {PRAIAS_LIST.map((p) => {
                const checked = form.praiasFrequenta.includes(p);
                return (
                  <label key={p} className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? form.praiasFrequenta.filter((x) => x !== p)
                          : [...form.praiasFrequenta, p];
                        update("praiasFrequenta", next);
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

        {form.role === "ambulante" && (
          <div>
            <label className="block font-sans text-[12px] font-semibold mb-2 text-white/70">
              Praias que costuma atender
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
              {PRAIAS_LIST.map((p) => {
                const checked = form.praiasAtende.includes(p);
                return (
                  <label key={p} className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? form.praiasAtende.filter((x) => x !== p)
                          : [...form.praiasAtende, p];
                        update("praiasAtende", next);
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
