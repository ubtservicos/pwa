import { ArrowLeft } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  title: string;
  onBack: () => void;
}

const PageHeader = ({ title, onBack }: Props) => {
  const t = useTheme();
  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 20px",
        marginLeft: -20,
        marginRight: -20,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
        aria-label="Voltar"
      >
        <ArrowLeft size={24} color={t.text} />
      </button>
      <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: t.text, flex: 1, margin: 0 }}>
        {title}
      </h1>
    </div>
  );
};

export default PageHeader;
