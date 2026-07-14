import { ReactNode, CSSProperties } from "react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const SettingsGroup = ({ children, className, style }: Props) => {
  const t = useTheme();
  return (
    <div
      className={className}
      style={{
        background: t.surface,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: t.isDark ? "none" : "0 2px 8px rgba(11,27,62,0.06)",
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default SettingsGroup;
