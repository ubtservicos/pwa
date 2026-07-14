import { ReactNode, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: string | number;
}

const BottomSheet = ({ open, onClose, children, height }: Props) => {
  const t = useTheme();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: t.surface,
          borderRadius: "24px 24px 0 0",
          padding: "16px 24px 32px",
          height: height,
          display: "flex",
          flexDirection: "column",
          animation: "ubt-sheet-up 280ms ease-out",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: t.border,
            borderRadius: 999,
            margin: "0 auto 16px",
            flexShrink: 0,
          }}
        />
        {children}
      </div>
      <style>{`@keyframes ubt-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};

export default BottomSheet;
