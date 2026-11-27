import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ShieldAlert, ArrowLeft, RefreshCw, CheckCircle2, Bike } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function PrestadorKycPending() {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useCurrentUser();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!user.uid) return;
    setChecking(true);
    setStatusMessage(null);
    try {
      const [{ data: motoData }, { data: carroData }, { data: userData }] = await Promise.all([
        supabase
          .from("prestador_mototaxi")
          .select("kyc_status")
          .eq("user_id", user.uid)
          .maybeSingle(),
        supabase
          .from("prestador_carro")
          .select("kyc_status")
          .eq("user_id", user.uid)
          .maybeSingle(),
        supabase
          .from("usuarios")
          .select("role, status, under_review")
          .eq("id", user.uid)
          .maybeSingle(),
      ]);

      const hasPending =
        motoData?.kyc_status === "pending" || carroData?.kyc_status === "pending";
      const hasRejected =
        motoData?.kyc_status === "rejected" || carroData?.kyc_status === "rejected";
      const isApproved =
        (!hasPending && (motoData?.kyc_status === "approved" || carroData?.kyc_status === "approved")) ||
        (userData?.role === "prestador" && !userData?.under_review && userData?.status === "active");

      const hasNoPendingRecord = !motoData && !carroData && !userData?.under_review;

      if (isApproved || hasNoPendingRecord) {
        navigate("/app/prestador/home", { replace: true });
      } else if (hasRejected && !hasPending) {
        setStatusMessage("Cadastro não aprovado. Entre em contato com o suporte ou revise sua documentação.");
      } else {
        setStatusMessage("Cadastro ainda em fila de avaliação.");
      }
    } catch (err) {
      console.error("Erro ao checar status de KYC:", err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [user.uid]);

  return (
    <div
      className="min-h-[100svh] flex flex-col justify-between px-6 py-6 text-zinc-100"
      style={{ background: theme.bg }}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/app/prestador/home")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
          style={{ color: theme.text }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="font-display text-[18px] font-bold" style={{ color: theme.text }}>
          UBT.
        </span>
        <div className="w-10" />
      </header>

      {/* Main Content / Empty State */}
      <main className="flex-1 flex flex-col items-center justify-center text-center my-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
          style={{
            background: "rgba(245,166,35,0.12)",
            border: "1px solid rgba(245,166,35,0.28)",
          }}
        >
          <Clock size={40} color="#F5A623" className="animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-xs font-semibold uppercase tracking-wider"
             style={{ background: "rgba(245,166,35,0.10)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.20)" }}>
          <ShieldAlert size={14} />
          Documentação em Análise
        </div>

        <h1 className="font-display text-[22px] font-bold mb-3 max-w-xs" style={{ color: theme.text }}>
          Cadastro em Verificação
        </h1>

        <p className="font-sans text-[14px] leading-relaxed max-w-sm mb-8" style={{ color: theme.subtle }}>
          Sua documentação está em análise. Nossa equipe está avaliando seu cadastro e você será notificado em breve.
        </p>

        {statusMessage && (
          <div className="mb-6 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.05)", color: theme.muted }}>
            {statusMessage}
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className="w-full min-h-[48px] rounded-2xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: "rgba(13,184,126,0.15)",
              border: "1px solid rgba(13,184,126,0.30)",
              color: "#0DB87E",
            }}
          >
            <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            {checking ? "Verificando..." : "Atualizar Status"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/app/prestador/home")}
            className="w-full min-h-[48px] rounded-2xl font-sans font-medium text-sm transition-all"
            style={{
              background: "var(--prestador-card)",
              border: `1px solid ${theme.border}`,
              color: theme.subtle,
            }}
          >
            Voltar para o Painel
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs pb-2" style={{ color: theme.muted }}>
        UBT Prestadores &bull; Suporte via WhatsApp disponível
      </footer>
    </div>
  );
}
