import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

const PrimaryButton = ({
  loading,
  loadingText = "Carregando...",
  children,
  disabled,
  className,
  ...rest
}: PrimaryButtonProps) => {
  return (
    <button
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={`w-full min-h-[52px] rounded-full bg-green hover:bg-green-dark transition-colors font-display font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default PrimaryButton;
