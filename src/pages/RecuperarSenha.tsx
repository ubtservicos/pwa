import { Eye, EyeOff, KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthTopBar from "@/components/auth/AuthTopBar";
import FormField from "@/components/auth/FormField";
import GhostButton from "@/components/auth/GhostButton";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { supabase } from "@/lib/supabase";
import { isValidEmail } from "@/utils/masks";
import { toast } from "sonner";

const RecuperarSenha = () => {
  const navigate = useNavigate();
  const { toast: simpleToast, showToast } = useSimpleToast();

  const [email, setEmail] = useState("");
  const [errorEmail, setErrorEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Estados do modo de redefinição de senha (link de email)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [errorNovaSenha, setErrorNovaSenha] = useState<string | undefined>();
  const [errorConfirmarSenha, setErrorConfirmarSenha] = useState<string | undefined>();
  const [errorGeral, setErrorGeral] = useState<string | undefined>();

  // Detetar se o utilizador chegou a partir do link do email
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    const hasRecoveryToken =
      hash.includes("type=recovery") ||
      (hash.includes("access_token") && hash.includes("recovery")) ||
      search.includes("type=recovery");

    if (hasRecoveryToken) {
      console.log("[RecuperarSenha] Parâmetros de recuperação detetados na URL/hash.");
      setIsRecoveryMode(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[RecuperarSenha] onAuthStateChange:", event, session ? "Sessão válida" : "Sem sessão");
      if (event === "PASSWORD_RECOVERY") {
        console.log("[RecuperarSenha] Evento PASSWORD_RECOVERY capturado pelo Supabase Auth.");
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Submissão do pedido de envio do link por email
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return setErrorEmail("Informe seu e-mail");
    if (!isValidEmail(email)) return setErrorEmail("E-mail inválido");

    setErrorEmail(undefined);
    setLoading(true);

    const redirectTo = `${window.location.origin}/recuperar-senha`;

    try {
      console.log("[RecuperarSenha] [START] Preparando envio de recuperação de senha");
      console.log("[RecuperarSenha] Email de destino:", email.trim());
      console.log("[RecuperarSenha] URL de redirecionamento (redirectTo):", redirectTo);

      console.log("[RecuperarSenha] [SUPABASE_CALL] Chamando supabase.auth.resetPasswordForEmail...");
      const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      console.log("[RecuperarSenha] [SUPABASE_RESPONSE] Resposta recebida:", { data, error: resetError });

      if (resetError) {
        console.error("[RecuperarSenha] Erro retornado pelo Supabase:", resetError);
        setErrorEmail(resetError.message || "Erro ao solicitar recuperação de senha.");
        return;
      }

      console.log("[RecuperarSenha] [SUCCESS] Link de recuperação enviado com sucesso.");
      setEnviado(true);
    } catch (err: any) {
      console.error("[RecuperarSenha] [CATCH_ERROR] Exceção capturada no fluxo de recuperação:", err);
      console.error("[RecuperarSenha] Detalhes do erro capturado (ex: verificação de 'startTime'):", {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        raw: err,
      });
      setErrorEmail(err?.message || "Ocorreu um erro inesperado ao tentar recuperar a senha.");
    } finally {
      console.log("[RecuperarSenha] [FINALLY] Finalizando submissão (loading = false)");
      setLoading(false);
    }
  };

  // Submissão do formulário de atualização de senha
  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorNovaSenha(undefined);
    setErrorConfirmarSenha(undefined);
    setErrorGeral(undefined);

    let hasValidationError = false;

    if (!novaSenha) {
      setErrorNovaSenha("Informe a nova senha");
      hasValidationError = true;
    } else if (novaSenha.length < 6) {
      setErrorNovaSenha("A senha deve ter no mínimo 6 caracteres");
      hasValidationError = true;
    }

    if (!confirmarSenha) {
      setErrorConfirmarSenha("Confirme a nova senha");
      hasValidationError = true;
    } else if (novaSenha && novaSenha !== confirmarSenha) {
      setErrorConfirmarSenha("As senhas não coincidem");
      hasValidationError = true;
    }

    if (hasValidationError) return;

    setLoading(true);

    try {
      console.log("[RecuperarSenha] [UPDATE_START] Atualizando senha do utilizador...");
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      console.log("[RecuperarSenha] [UPDATE_RESPONSE]:", { data, error: updateError });

      if (updateError) {
        console.error("[RecuperarSenha] Erro ao salvar nova senha:", updateError);
        let errorMsg = updateError.message || "Erro ao atualizar senha.";
        if (errorMsg.toLowerCase().includes("different from the old password")) {
          errorMsg = "A nova senha não pode ser igual à sua senha atual. Por favor, escolha uma senha diferente.";
        }
        setErrorGeral(errorMsg);
        showToast(errorMsg);
        return;
      }

      console.log("[RecuperarSenha] [UPDATE_SUCCESS] Senha redefinida com sucesso!");
      showToast("Senha redefinida com sucesso! 🎉");
      toast.success("Senha redefinida com sucesso!");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: any) {
      console.error("[RecuperarSenha] [UPDATE_CATCH] Exceção capturada:", err);
      let errorMsg = err?.message || "Ocorreu um erro inesperado ao salvar a nova senha.";
      if (errorMsg.toLowerCase().includes("different from the old password")) {
        errorMsg = "A nova senha não pode ser igual à sua senha atual. Por favor, escolha uma senha diferente.";
      }
      setErrorGeral(errorMsg);
      showToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-navy text-white flex flex-col px-6 overflow-hidden">
      <AuthTopBar backTo="/login" />

      <main className="flex-1 flex flex-col">
        {isRecoveryMode ? (
          <>
            <div className="mt-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "hsl(var(--green) / 0.12)" }}
              >
                <Lock size={28} className="text-green" />
              </div>
              <h1 className="font-display font-extrabold text-[26px] leading-tight text-white mt-4">
                Redefinir senha.
              </h1>
              <p className="font-sans text-sm text-white/60 mt-1.5">
                Crie uma nova senha segura para a sua conta.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="mt-8 flex flex-col gap-6" noValidate>
              <FormField
                label="Nova Senha"
                icon={Lock}
                type={showNovaSenha ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => {
                  setNovaSenha(e.target.value);
                  if (errorNovaSenha) setErrorNovaSenha(undefined);
                }}
                error={errorNovaSenha}
                disabled={loading}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="p-1 text-white/40 hover:text-white/80 transition-colors"
                  >
                    {showNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <FormField
                label="Confirmar Nova Senha"
                icon={Lock}
                type={showConfirmarSenha ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmarSenha}
                onChange={(e) => {
                  setConfirmarSenha(e.target.value);
                  if (errorConfirmarSenha) setErrorConfirmarSenha(undefined);
                }}
                error={errorConfirmarSenha}
                disabled={loading}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="p-1 text-white/40 hover:text-white/80 transition-colors"
                  >
                    {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              {errorGeral && (
                <div className="p-3.5 rounded-xl bg-[hsl(var(--red)/0.12)] border border-[hsl(var(--red)/0.3)] text-[hsl(var(--red))] text-xs font-sans">
                  {errorGeral}
                </div>
              )}

              <PrimaryButton
                type="submit"
                loading={loading}
                loadingText="Salvando..."
              >
                Salvar nova senha
              </PrimaryButton>
            </form>
          </>
        ) : !enviado ? (
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorEmail) setErrorEmail(undefined);
                }}
                error={errorEmail}
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

      <Toast message={simpleToast.msg} visible={simpleToast.visible} />
    </div>
  );
};

export default RecuperarSenha;
