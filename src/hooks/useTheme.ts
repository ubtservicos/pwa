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
    bg: isDark ? "#09090B" : "#18181B",
    surface: isDark ? "#18181B" : "#27272A",
    border: isDark ? "#27272A" : "#3F3F46",
    text: isDark ? "#FFFFFF" : "#F4F4F5",
    subtle: isDark ? "#A1A1AA" : "#A1A1AA",
    muted: isDark ? "#71717A" : "#71717A",
    inputBg: isDark ? "#18181B" : "#27272A",
    inputBdr: isDark ? "#27272A" : "#3F3F46",
    isDark,
  };
};
