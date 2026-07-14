import { AlertCircle, LucideIcon } from "lucide-react";
import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useId,
  useState,
} from "react";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  icon: LucideIcon;
  error?: string;
  rightSlot?: ReactNode;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, icon: Icon, error, rightSlot, id, onFocus, onBlur, className, ...rest }, ref) => {
    const reactId = useId();
    const fieldId = id ?? reactId;
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? "border-[hsl(var(--red))] bg-[hsl(var(--red)/0.04)]"
      : focused
        ? "border-green bg-[hsl(var(--green)/0.06)]"
        : "border-white/10 bg-white/[0.06]";

    const iconColor = error
      ? "text-[hsl(var(--red))]"
      : focused
        ? "text-green"
        : "text-white/35";

    return (
      <div className="w-full">
        <label
          htmlFor={fieldId}
          className="block font-sans text-[12px] font-semibold text-white/55 mb-1.5"
        >
          {label}
        </label>
        <div
          className={`flex items-center gap-3 h-14 rounded-xl px-4 border transition-colors ${borderColor}`}
        >
          <Icon size={20} className={`shrink-0 transition-colors ${iconColor}`} />
          <input
            ref={ref}
            id={fieldId}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className={`flex-1 min-w-0 bg-transparent outline-none font-sans text-[15px] text-white placeholder:text-white/30 ${className ?? ""}`}
            {...rest}
          />
          {rightSlot}
        </div>
        {error && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-sans text-[hsl(var(--red))]">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export default FormField;
