import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

const PrimaryButtonLight = ({ loading, loadingText = "Carregando...", children, disabled, className, ...rest }: Props) => (
  <button
    type={rest.type ?? "button"}
    disabled={disabled || loading}
    className={`w-full min-h-[52px] rounded-full transition-colors font-display font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ""}`}
    style={{ background: "#00FF66", color: "#09090B" }}
    {...rest}
  >
    {loading ? (<><Loader2 size={18} className="animate-spin" />{loadingText}</>) : children}
  </button>
);

export default PrimaryButtonLight;
