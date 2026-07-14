// Shared admin UI primitives.
import React from "react";

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
> = ({ children, style, className, ...rest }) => (
  <div
    {...rest}
    className={className}
    style={{
      background: "var(--admin-surface)",
      border: "1px solid var(--admin-border)",
      borderRadius: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const PageTitle: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div style={{ marginBottom: 20 }}>
    <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>{children}</h1>
    {sub && <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#475569", marginTop: 4 }}>{sub}</div>}
  </div>
);

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
> = ({ children, style, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled}
    style={{
      background: disabled ? "#94A3B8" : "#0DB87E",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 18px",
      fontFamily: "DM Sans",
      fontSize: 13,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.7 : 1,
      ...style,
    }}
  >
    {children}
  </button>
);

export const GhostButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
> = ({ children, style, ...rest }) => (
  <button
    {...rest}
    style={{
      background: "transparent",
      color: "#475569",
      border: "1px solid #E2E8F0",
      borderRadius: 8,
      padding: "8px 14px",
      fontFamily: "DM Sans",
      fontSize: 13,
      cursor: "pointer",
      ...style,
    }}
  >
    {children}
  </button>
);

export const Pill: React.FC<{
  bg: string;
  color: string;
  border?: string;
  children: React.ReactNode;
  size?: "sm" | "md";
}> = ({ bg, color, border, children, size = "md" }) => (
  <span
    style={{
      display: "inline-block",
      background: bg,
      color,
      border: border ? `1px solid ${border}` : "none",
      borderRadius: 999,
      padding: size === "sm" ? "2px 8px" : "3px 10px",
      fontFamily: "DM Sans",
      fontSize: size === "sm" ? 10 : 11,
      fontWeight: 600,
      letterSpacing: 0.2,
    }}
  >
    {children}
  </span>
);

export const KYC_PILL = {
  approved: { bg: "rgba(13,184,126,0.10)", border: "rgba(13,184,126,0.25)", color: "#0DB87E", label: "Aprovado" },
  pending: { bg: "rgba(245,166,35,0.10)", border: "rgba(245,166,35,0.25)", color: "#F5A623", label: "Pendente" },
  rejected: { bg: "rgba(232,64,64,0.08)", border: "rgba(232,64,64,0.20)", color: "#E84040", label: "Reprovado" },
};

export const Avatar: React.FC<{ name: string; size?: number; bg?: string; color?: string }> = ({
  name,
  size = 32,
  bg = "rgba(13,184,126,0.15)",
  color = "#0DB87E",
}) => {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "DM Sans",
        fontSize: size <= 32 ? 12 : 14,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};
