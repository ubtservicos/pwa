import { useReveal } from "@/hooks/useReveal";

type Card = {
  badge: string;
  title: string;
  subtitle: string;
  img: string;
  alt: string;
};

const cards: Card[] = [
  {
    badge: "Social",
    title: "Mulher para Mulher",
    subtitle: "Segurança e acolhimento em cada trajeto.",
    img: "/mulheres_plataforma.png",
    alt: "Iniciativa Mulher para Mulher",
  },
  {
    badge: "Ambiental",
    title: "Trabalhando com Côco & Cia.",
    subtitle: "Reciclagem e sustentabilidade em cada rota.",
    img: "/caminhao_reciclagem.png",
    alt: "Iniciativa ambiental com reciclagem",
  },
];

export const Responsibility = () => {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal bg-background py-16 px-6">
      <div className="max-w-[1100px] mx-auto md:max-w-[640px] lg:max-w-[1100px]">
        <h2 className="font-display font-bold text-[22px] text-navy">
          Responsabilidade em primeiro lugar.
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Apoio social e ambiental integrados à plataforma, porque tecnologia deve servir às pessoas e ao planeta.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cards.map((c) => (
            <article key={c.title} className="relative h-[180px] rounded-2xl overflow-hidden shadow-card">
              <img src={c.img} alt={c.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-resp-overlay" />
              <span className="absolute top-3 left-3 inline-flex rounded-full bg-green text-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                {c.badge}
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white text-base font-semibold">{c.title}</h3>
                <p className="text-white/75 text-xs mt-1">{c.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
