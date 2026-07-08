import { ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";

const SectionHeader = ({ children }: { children: ReactNode }) => {
  const t = useTheme();
  return (
    <div
      style={{
        fontFamily: "DM Sans",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: t.muted,
        padding: "20px 20px 8px",
      }}
    >
      {children}
    </div>
  );
};

export default SectionHeader;
