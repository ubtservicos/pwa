import { useReveal } from "@/hooks/useReveal";
import { isVerticalEnabled, type VerticalKey } from "@/config/verticalFlags";

const ALL_LANDING_SERVICES: Array<{ label: string; img: string; vertical: VerticalKey }> = [
  { label: "Mototaxi", img: "/mototaxi_pop.png", vertical: "mototaxi" },
  { label: "Ambulantes", img: "/ambulante_praia.png", vertical: "ambulantes" },
  { label: "Diaristas", img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400", vertical: "diaristas" },
];

export const Services = () => {
  const ref = useReveal<HTMLElement>();
  const services = ALL_LANDING_SERVICES.filter((s) => isVerticalEnabled(s.vertical));
  return (
    <section ref={ref} className="reveal bg-secondary py-16 px-6">
      <div className="max-w-[1100px] mx-auto md:max-w-[640px] lg:max-w-[1100px]">
        <h2 className="font-display font-bold text-[22px] text-navy">
          Tudo que você precisa, num toque.
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Conectamos você aos melhores prestadores. Rápido, seguro e sem complicação.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
          {services.map((s) => (
            <article
              key={s.label}
              className="relative h-[140px] rounded-2xl overflow-hidden shadow-card group"
            >
              <img
                src={s.img}
                alt={s.label}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-card-overlay" />
              <span className="absolute bottom-0 left-0 p-3 text-[13px] font-semibold text-white">
                {s.label}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
