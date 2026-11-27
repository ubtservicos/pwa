import { useReveal } from "@/hooks/useReveal";
import { isVerticalEnabled, type VerticalKey } from "@/config/verticalFlags";

const ALL_LANDING_SERVICES: Array<{ label: string; img: string; vertical: VerticalKey }> = [
  { label: "Mototaxi", img: "/mototaxi_pop.png", vertical: "mototaxi" },
  { label: "Ambulantes", img: "/ambulante_praia.png", vertical: "ambulantes" },
  { label: "Diaristas", img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400", vertical: "diaristas" },
];

export const Services = () => {
  const ref = useReveal<HTMLElement>();
  const services = ALL_LANDING_SERVICES.map((s) => ({
    ...s,
    available: isVerticalEnabled(s.vertical),
  }));
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
              aria-disabled={!s.available}
              className={`relative h-[140px] rounded-2xl overflow-hidden shadow-card group ${
                s.available ? "" : "opacity-55 cursor-not-allowed select-none"
              }`}
            >
              <img
                src={s.img}
                alt={s.label}
                loading="lazy"
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
                  s.available ? "group-hover:scale-105" : "grayscale-[45%]"
                }`}
              />
              <div className="absolute inset-0 bg-card-overlay" />
              {!s.available && (
                <span
                  className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full font-sans text-[10px] font-semibold"
                  style={{
                    background: "rgba(9,9,11,0.75)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  Em breve
                </span>
              )}
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
