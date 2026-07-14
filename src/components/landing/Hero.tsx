import { Coins } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const scrollToCta = () => {
  document.getElementById("cadastro")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export const Hero = () => {
  const ref = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className="reveal relative min-h-[100svh] w-full overflow-hidden flex flex-col justify-between"
    >
      {/* Background Image - Bleeding full screen with looping animation */}
      <img
        src="/ubatuba_group.png"
        alt="Grupo de 10 profissionais em Ubatuba: Mototaxistas, Diaristas, Ambulantes e outros"
        className="absolute inset-0 w-full h-full object-cover z-0 animate-ken-burns"
        style={{ objectPosition: "center 80%" }}
      />

      {/* Dark overlay gradients for text readability and cinematic contrast */}
      <div className="absolute inset-0 bg-black/40 z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10 z-10" />

      {/* Spacer matching Navbar height */}
      <div className="h-14 w-full relative z-20" />

      {/* Pulsating badge floating in Ubatuba context at the top right */}
      <div className="relative z-20 flex-1 flex items-start justify-end p-6">
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-semibold flex items-center gap-2 shadow-lg mt-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green"></span>
          </span>
          Rede de Prestadores · Ubatuba, SP
        </div>
      </div>

      {/* Footer contents container (rodapé) */}
      <div className="relative z-20 w-full pt-12 pb-10 px-6">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-full border border-green bg-green/[0.12] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-green mb-3">
              O Superapp do Trabalhador
            </span>

            <h1 className="font-display font-extrabold text-white text-[32px] leading-[1.15] md:text-[40px] lg:text-5xl drop-shadow-md">
              Conecte-se. Trabalhe. Lucre Mais.
            </h1>

            <p className="mt-3 text-sm md:text-[15px] text-white/90 leading-relaxed max-w-md drop-shadow-sm">
              A plataforma que une prestadores e tomadores de serviço com taxas justas e fortalecimento da comunidade de Ubatuba (SP).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={scrollToCta}
              className="px-8 min-h-[52px] rounded-full bg-green hover:bg-green-dark transition-colors text-white font-display font-semibold text-sm shadow-card flex items-center justify-center whitespace-nowrap"
            >
              Cadastro gratuito
            </button>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3">
              <Coins size={20} className="text-green" aria-hidden />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-white/65">Ganhos de Hoje</span>
                <span className="text-sm font-semibold text-green">R$ 972,50</span>
              </div>
              <span className="ml-1 text-[10px] text-green font-medium">+15% vs Ontem</span>
            </div>
          </div>
        </div>
      </div>

      {/* Styled component styles for the looping Ken Burns effect */}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.0); }
          50% { transform: scale(1.08) translate(0.5%, -0.5%); }
          100% { transform: scale(1.0); }
        }
        .animate-ken-burns {
          animation: kenburns 20s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};

