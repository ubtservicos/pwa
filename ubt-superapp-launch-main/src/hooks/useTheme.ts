import { useCurrentUser } from "./useCurrentUser";

export const useTheme = () => {
  const user = useCurrentUser();
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
  const isDark = !isPrestador;
  return {
    bg: isDark ? "#0B1B3E" : "#F7F8FA",
    surface: isDark ? "#132348" : "#FFFFFF",
    border: isDark ? "rgba(255,255,255,0.08)" : "#D8DBE5",
    text: isDark ? "#FFFFFF" : "#0B1B3E",
    subtle: isDark ? "rgba(255,255,255,0.60)" : "#5B6178",
    muted: isDark ? "rgba(255,255,255,0.35)" : "#9399AD",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "#FFFFFF",
    inputBdr: isDark ? "rgba(255,255,255,0.10)" : "#D8DBE5",
    isDark,
  };
};
