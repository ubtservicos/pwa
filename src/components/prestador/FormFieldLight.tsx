import { AlertCircle, LucideIcon } from "lucide-react";
import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  useState,
} from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  rightSlot?: ReactNode;
}

const FormFieldLight = forwardRef<HTMLInputElement, Props>(
  ({ label, icon: Icon, error, rightSlot, id, onFocus, onBlur, className, ...rest }, ref) => {
    const reactId = useId();
    const fieldId = id ?? reactId;
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? "#E84040"
      : focused
        ? "#00FF66"
        : "var(--prestador-border)";
    const bg = error
      ? "rgba(232,64,64,0.04)"
      : focused
        ? "rgba(0,255,102,0.05)"
        : "var(--prestador-card)";
    const iconColor = error
      ? "#E84040"
      : focused
        ? "#00FF66"
        : "#A1A1AA";

    return (
      <div className="w-full">
        <label
          htmlFor={fieldId}
          className="block font-sans text-[12px] font-semibold mb-1.5"
          style={{ color: "#A1A1AA" }}
        >
          {label}
        </label>
        <div
          className="flex items-center gap-3 h-14 rounded-xl px-4 border transition-colors"
          style={{ borderColor, background: bg }}
        >
          {Icon && <Icon size={20} className="shrink-0 transition-colors" style={{ color: iconColor }} />}
          <input
            ref={ref}
            id={fieldId}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            className={`flex-1 min-w-0 bg-transparent outline-none font-sans text-[15px] placeholder:text-[#A1A1AA]/50 ${className ?? ""}`}
            style={{ color: "#FFFFFF" }}
            {...rest}
          />
          {rightSlot}
        </div>
        {error && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-sans" style={{ color: "#E84040" }}>
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);
FormFieldLight.displayName = "FormFieldLight";
export default FormFieldLight;
