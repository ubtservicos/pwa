import { Gift, Handshake, ShieldCheck } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const items = [
  {
    icon: Handshake,
    title: "Apoio Mútuo",
    desc: "Sua rede recebe 2% de cada serviço realizado para reinvestir em seus membros.",
  },
  {
    icon: Gift,
    title: "Sorteios",
    desc: "Participe dos sorteios de R$ 10.000 em 01/05 e 01/12 todo ano.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança em 1º Lugar",
    desc: "Validação KYC, biometria e central de arbitragem disponíveis 24h.",
  },
];

export const Networks = () => {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal bg-navy-2 py-16 px-6 text-white">
      <div className="max-w-[1100px] mx-auto md:max-w-[640px] lg:max-w-[1100px]">
        <span className="inline-flex items-center rounded-full border border-green bg-green/[0.12] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-green">
          Redes de Profissionais
        </span>
        <h2 className="font-display font-bold text-[22px] mt-3">
          Fortalecendo as Redes de Profissionais.
        </h2>
        <p className="mt-2 text-[15px] text-white/65">
          Diferente dos apps, a UBT repassa 2% de cada transação para entidades de classe e comunidades que apoiam os trabalhadores.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className="flex items-start gap-4 rounded-xl bg-white/[0.04] border border-white/[0.08] p-5"
              >
                <span className="inline-flex shrink-0 items-center justify-center w-11 h-11 rounded-[10px] bg-green/[0.12]">
                  <Icon size={28} className="text-green" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">{it.title}</h3>
                  <p className="mt-1 text-[13px] text-white/55">{it.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
