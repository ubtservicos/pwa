import { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const GhostButtonLight = ({ children, className, ...rest }: Props) => (
  <button
    type={rest.type ?? "button"}
    className={`w-full min-h-[52px] rounded-full border-[1.5px] transition-colors font-display font-semibold text-sm flex items-center justify-center gap-2 ${className ?? ""}`}
    style={{ borderColor: "#D8DBE5", color: "#5B6178", background: "#fff" }}
    {...rest}
  >
    {children}
  </button>
);

export default GhostButtonLight;
