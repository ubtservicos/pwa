import { Building2, Gift, Heart, Star, User, Users, type LucideIcon } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

type Row = {
  icon: LucideIcon;
  color: string; // tailwind text class
  bg: string;    // tailwind bg class
  name: string;
  pct: string;
  value: string;
};

const rows: Row[] = [
  { icon: User,      color: "text-green",       bg: "bg-green/[0.12]",       name: "Prestador",          pct: "90%",  value: "R$ 36,00" },
  { icon: Building2, color: "text-amber",       bg: "bg-amber/[0.12]",       name: "UBT",                pct: "4%",   value: "R$ 1,60"  },
  { icon: Users,     color: "text-brand-blue",  bg: "bg-brand-blue/[0.12]",  name: "Comunidade",         pct: "2%",   value: "R$ 0,80"  },
  { icon: Gift,      color: "text-brand-purple",bg: "bg-brand-purple/[0.12]",name: "Prêmio Trabalhador", pct: "1,5%", value: "R$ 0,60"  },
  { icon: Star,      color: "text-brand-red",   bg: "bg-brand-red/[0.12]",   name: "Prêmio Consumidor",  pct: "1,5%", value: "R$ 0,60"  },
  { icon: Heart,     color: "text-green",       bg: "bg-green/[0.12]",       name: "Padrinho/Madrinha",  pct: "1%",   value: "R$ 0,40"  },
];

const scrollToCta = () => {
  document.getElementById("cadastro")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export const Split = () => {
  const ref = useReveal<HTMLElement>();
  // Donut math
  const r = 70;
  const c = 2 * Math.PI * r; // ~439.82
  const filled = c * 0.9;

  return (
    <section ref={ref} className="reveal bg-navy py-16 px-6 text-white">
      <div className="max-w-[1100px] mx-auto md:max-w-[640px] lg:max-w-[1100px]">
        <h2 className="font-display font-bold text-[22px]">Transparência em cada centavo.</h2>
        <p className="mt-2 text-[15px] text-white/65">
          Acreditamos que quem faz o trabalho deve ficar com a maior parte. Veja nosso split para uma corrida de R$ 40.
        </p>

        <div className="my-8 flex justify-center">
          <svg viewBox="0 0 180 180" width="180" height="180" aria-label="90% para o prestador">
            <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
            <circle
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke="hsl(var(--green))"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${c}`}
              transform="rotate(-90 90 90)"
            />
            <text x="90" y="86" textAnchor="middle" dominantBaseline="middle" fill="white" fontFamily="Syne" fontSize="28" fontWeight="800">
              90%
            </text>
            <text x="90" y="108" textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--gray-400))" fontFamily="DM Sans" fontSize="10" fontWeight="600" letterSpacing="1.5">
              PRESTADOR
            </text>
          </svg>
        </div>

        <ul className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4">
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <li
                key={r.name}
                className={`flex items-center gap-3 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.07]" : ""}`}
              >
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-md ${r.bg}`}>
                  <Icon size={16} className={r.color} aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium text-white">{r.name}</span>
                <span className="text-xs text-white/45 w-12 text-right">{r.pct}</span>
                <span className="text-sm font-semibold text-green w-20 text-right">{r.value}</span>
              </li>
            );
          })}
        </ul>

        <button
          onClick={scrollToCta}
          className="mt-8 w-full min-h-[52px] rounded-full border-[1.5px] border-green text-green hover:bg-green/[0.08] transition-colors text-sm font-semibold"
        >
          Quero fazer parte
        </button>
      </div>
    </section>
  );
};
