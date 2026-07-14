import { ChevronRight, LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  rightElement?: ReactNode;
  isLast?: boolean;
}

const SettingsRow = ({ icon: Icon, label, subtitle, onClick, rightElement, isLast }: Props) => {
  const t = useTheme();
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(13,184,126,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={20} color="#0DB87E" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 500, color: t.text }}>
            {label}
          </div>
          {subtitle && (
            <div
              style={{
                fontFamily: "DM Sans",
                fontSize: 12,
                color: t.subtle,
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {rightElement ?? <ChevronRight size={18} color={t.muted} />}
      </button>
      {!isLast && (
        <div style={{ height: 1, background: t.border, margin: "0 20px" }} />
      )}
    </>
  );
};

export default SettingsRow;
