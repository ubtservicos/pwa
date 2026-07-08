import { Check } from "lucide-react";

interface Props {
  steps: string[];
  current: number; // 1-based index of active step
  onStepClick?: (step: number) => void;
}

const Stepper = ({ steps, current, onStepClick }: Props) => {
  const total = steps.length;
  // progress fraction from first to current marker (positions 1..total) along the line
  const progress = total <= 1 ? 0 : Math.max(0, Math.min(1, (current - 1) / (total - 1)));

  return (
    <div className="w-full">
      <div className="relative" style={{ height: 28 }}>
        {/* base line */}
        <div
          className="absolute left-[14px] right-[14px] top-1/2 -translate-y-1/2 rounded-full"
          style={{ height: 2, background: "#D8DBE5" }}
        />
        {/* progress line */}
        <div
          className="absolute left-[14px] top-1/2 -translate-y-1/2 rounded-full"
          style={{
            height: 2,
            background: "#0DB87E",
            width: `calc((100% - 28px) * ${progress})`,
            transition: "width 300ms",
          }}
        />
        {/* markers */}
        <div className="relative flex justify-between items-center h-full">
          {steps.map((_, i) => {
            const idx = i + 1;
            const done = idx < current;
            const active = idx === current;
            return (
              <button
                type="button"
                key={i}
                onClick={() => onStepClick && onStepClick(idx)}
                className="rounded-full flex items-center justify-center border-none"
                style={{
                  width: 28,
                  height: 28,
                  background: done || active ? "#0DB87E" : "#EFF0F3",
                  cursor: onStepClick ? "pointer" : "default",
                  padding: 0,
                }}
              >
                {done ? (
                  <Check size={14} color="#fff" />
                ) : (
                  <span
                    className="font-sans text-[12px] font-semibold"
                    style={{ color: active ? "#fff" : "#9399AD" }}
                  >
                    {idx}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between">
        {steps.map((label, i) => {
          const idx = i + 1;
          const active = idx === current;
          return (
            <button
              type="button"
              key={i}
              onClick={() => onStepClick && onStepClick(idx)}
              className="font-sans text-[10px] text-center border-none bg-transparent"
              style={{ width: 60, color: active ? "#0B1B3E" : "#9399AD", fontWeight: active ? 600 : 400, cursor: onStepClick ? "pointer" : "default", padding: 0 }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Stepper;
