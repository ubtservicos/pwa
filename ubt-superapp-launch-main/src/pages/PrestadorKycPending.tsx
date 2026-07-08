import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const PrestadorKycPending = () => {
  const navigate = useNavigate();

  // Simulação: aprova após 6s (em produção: onValue Firebase)
  useEffect(() => {
    const t = setTimeout(() => {
      navigate("/app/prestador/home");
    }, 6000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#F7F8FA" }}
    >
      <Loader2 size={48} color="#0DB87E" className="animate-spin" />
      <h1 className="mt-5 font-display text-[20px] font-bold" style={{ color: "#0B1B3E" }}>
        Verificando seus documentos...
      </h1>
      <p className="mt-2 font-sans text-[14px] max-w-xs" style={{ color: "#5B6178" }}>
        Isso leva até 10 minutos. Você receberá uma notificação.
      </p>
    </div>
  );
};

export default PrestadorKycPending;
