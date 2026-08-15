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
    bg: isDark ? "#09090B" : "#F7F8FA",
    surface: isDark ? "#18181B" : "#FFFFFF",
    border: isDark ? "#27272A" : "#D8DBE5",
    text: isDark ? "#FFFFFF" : "#0B1B3E",
    subtle: isDark ? "#A1A1AA" : "#5B6178",
    muted: isDark ? "#71717A" : "#9399AD",
    inputBg: isDark ? "#18181B" : "#FFFFFF",
    inputBdr: isDark ? "#27272A" : "#D8DBE5",
    isDark,
  };
};
