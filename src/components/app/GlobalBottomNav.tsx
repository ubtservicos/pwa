import { useLocation } from "react-router-dom";
import BottomNav from "@/components/app/BottomNav";
import BottomNavLight from "@/components/prestador/BottomNavLight";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const GlobalBottomNav = () => {
  const loc = useLocation();
  const path = loc.pathname;
  const user = useCurrentUser();

  // No nav for admin, login, register, index, onboarding, agendamentos, or checkouts
  if (
    path.startsWith("/admin") ||
    path === "/" ||
    path === "/login" ||
    path === "/cadastro" ||
    path === "/recuperar-senha" ||
    path.includes("/onboarding") ||
    path.includes("/agendar") ||
    path.includes("/agendamento") ||
    path.includes("/corrida") ||
    path.includes("/transacao") ||
    path.includes("/pedido") ||
    path.includes("/suporte/ticket") ||
    (path.includes("/servico/") && !path.startsWith("/app/config"))
  ) {
    return null;
  }

  const isPrestador =
    ["prestador", "cocoecia", "cocoecia-colaborador", "cocoecia-dirigentes"].includes(user.role) ||
    user.kycStatus === "approved" ||
    (() => {
      try {
        return (
          localStorage.getItem(`diarista_perfil_${user?.uid}`) === "1" ||
          localStorage.getItem(`amb_session_${user?.uid}`) === "1" ||
          !!localStorage.getItem("caminhaoId")
        );
      } catch {
        return false;
      }
    })();

  const isPrestadorContext =
    path.startsWith("/app/prestador") ||
    (path.startsWith("/app/config") && isPrestador);

  if (isPrestadorContext) {
    return <BottomNavLight />;
  }

  // Padrão para Tomador
  return <BottomNav />;
};

export default GlobalBottomNav;
