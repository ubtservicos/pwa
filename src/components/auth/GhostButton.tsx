import { ButtonHTMLAttributes, ReactNode } from "react";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const GhostButton = ({ children, className, ...rest }: GhostButtonProps) => {
  return (
    <button
      type={rest.type ?? "button"}
      className={`w-full min-h-[52px] rounded-full border-[1.5px] border-white/15 hover:border-white/25 hover:bg-white/[0.03] transition-colors font-display font-semibold text-sm text-white flex items-center justify-center gap-2.5 ${className ?? ""}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default GhostButton;
