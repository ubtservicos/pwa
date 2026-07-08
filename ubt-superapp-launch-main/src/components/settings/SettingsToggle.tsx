import { LucideIcon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}

const SettingsToggle = ({ icon: Icon, label, subtitle, value, onChange, isLast }: Props) => {
  const t = useTheme();
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
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
        <button
          type="button"
          onClick={() => onChange(!value)}
          style={{
            width: 44,
            height: 24,
            borderRadius: 999,
            background: value ? "#0DB87E" : t.border,
            border: "none",
            cursor: "pointer",
            position: "relative",
            transition: "background 300ms",
            flexShrink: 0,
          }}
          aria-pressed={value}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#FFFFFF",
              position: "absolute",
              top: 2,
              left: 2,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transform: value ? "translateX(20px)" : "translateX(0)",
              transition: "transform 250ms",
            }}
          />
        </button>
      </div>
      {!isLast && (
        <div style={{ height: 1, background: t.border, margin: "0 20px" }} />
      )}
    </>
  );
};

export default SettingsToggle;
