import { KeyRound, Mail, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthTopBar from "@/components/auth/AuthTopBar";
import FormField from "@/components/auth/FormField";
import GhostButton from "@/components/auth/GhostButton";
import PrimaryButton from "@/components/auth/PrimaryButton";
import { isValidEmail } from "@/utils/masks";

const RecuperarSenha = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Informe seu e-mail");
    if (!isValidEmail(email)) return setError("E-mail inválido");
    setError(undefined);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setEnviado(true);
    }, 1500);
  };

  return (
    <div className="min-h-[100svh] bg-navy text-white flex flex-col px-6 overflow-hidden">
      <AuthTopBar backTo="/login" />

      <main className="flex-1 flex flex-col">
        {!enviado ? (
          <>
            <div className="mt-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "hsl(var(--green) / 0.12)" }}
              >
                <KeyRound size={28} className="text-green" />
              </div>
              <h1 className="font-display font-extrabold text-[26px] leading-tight text-white mt-4">
                Recuperar acesso.
              </h1>
              <p className="font-sans text-sm text-white/60 mt-1.5">
                Digite seu e-mail cadastrado. Enviaremos um link para criar uma nova senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6" noValidate>
              <FormField
                label="E-mail cadastrado"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
                disabled={loading}
              />
              <PrimaryButton
                type="submit"
                loading={loading}
                loadingText="Enviando..."
              >
                Enviar link
              </PrimaryButton>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center reveal is-visible">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--green) / 0.12)" }}
            >
              <MailCheck size={40} className="text-green" />
            </div>
            <h2 className="font-display font-bold text-[22px] text-white mt-6">
              Link enviado!
            </h2>
            <p className="font-sans text-sm text-white/60 mt-2 max-w-xs">
              Verifique sua caixa de entrada. O link expira em 30 minutos.
            </p>
            <div className="w-full mt-8">
              <GhostButton onClick={() => navigate("/login")}>
                Voltar para o login
              </GhostButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RecuperarSenha;
