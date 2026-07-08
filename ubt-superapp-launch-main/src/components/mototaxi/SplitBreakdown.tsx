import { ChevronDown, ChevronUp, User, Building2, Users, Gift, Star, Heart, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { SPLIT_META, calcSplit, formatBRL } from "@/utils/ride";

const ICONS: Record<string, LucideIcon> = {
  User, Building2, Users, Gift, Star, Heart,
};

interface Props {
  total: number;
  defaultOpen?: boolean;
}

const SplitBreakdown = ({ total, defaultOpen = true }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const split = calcSplit(total);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 font-sans text-[12px] font-semibold"
        style={{ color: "#0DB87E" }}
      >
        Ver divisão
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {SPLIT_META.map((m) => {
            const Icon = ICONS[m.icon];
            const value = split[m.key];
            return (
              <div key={m.key} className="flex items-center gap-2">
                <Icon size={14} style={{ color: m.color }} />
                <span className="font-sans text-[12px] text-white flex-1">
                  {m.label}
                </span>
                <span className="font-sans text-[12px] font-semibold" style={{ color: "#0DB87E" }}>
                  {formatBRL(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SplitBreakdown;
