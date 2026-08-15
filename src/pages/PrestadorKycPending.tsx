import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

import { useTheme } from "@/hooks/useTheme";

const PrestadorKycPending = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    trackEvent("kyc_submitted", "operational");
    logSystem("INFO", "PWA", "kyc_submitted", "started");

    const t = setTimeout(() => {
      trackEvent("kyc_approved", "operational");
      logSystem("INFO", "PWA", "kyc_approved", "success");
      navigate("/app/prestador/home");
    }, 6000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center text-zinc-100"
      style={{ background: theme.bg }}
    >
      <Loader2 size={48} color="#0DB87E" className="animate-spin" />
      <h1 className="mt-5 font-display text-[20px] font-bold" style={{ color: theme.text }}>
        Verificando seus documentos...
      </h1>
      <p className="mt-2 font-sans text-[14px] max-w-xs" style={{ color: theme.subtle }}>
        Isso leva até 10 minutos. Você receberá uma notificação.
      </p>
    </div>
  );
};

export default PrestadorKycPending;
