import { useEffect, useState, useRef } from "react";
import { 
  ArrowDown, 
  Sparkles, 
  Check, 
  Users, 
  MapPin, 
  Heart, 
  Share2, 
  Copy, 
  CheckCircle,
  Bike,
  Home,
  Sun,
  Sunset as SunsetIcon,
  Moon,
  Trash2,
  Award,
  Flame,
  UserCheck
} from "lucide-react";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

interface CustomParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life?: number;
  maxLife?: number;
}

export default function ConceptExperience() {
  const [currentScene, setCurrentScene] = useState(0);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScrolling = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });

  const TOTAL_SCENES = 13;

  const SCENES = [
    {
      title: "Cena 01: O Amanhecer",
      text: "Todo dia nasce uma nova oportunidade.",
      tag: "Nascer do Sol",
      bg: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#2A142D] via-[#632C3A] to-[#C86A4B]",
      icon: Sun,
      fxName: "Ondas & Partículas de Luz"
    },
    {
      title: "Cena 02: O Mototáxi",
      text: "Quem trabalha merece chegar mais longe.",
      tag: "Luz da Manhã",
      bg: "https://images.unsplash.com/photo-1444492442297-623ae7b16323?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#0E3A40] via-[#105E5B] to-[#128B72]",
      icon: Bike,
      fxName: "Reflexos & Vento Caiçara"
    },
    {
      title: "Cena 03: A Diarista",
      text: "Mais oportunidades. Mais dignidade.",
      tag: "Trabalho Digno",
      bg: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#092B40] via-[#0C5875] to-[#0D87A1]",
      icon: Home,
      fxName: "Poeira Solar de Janela"
    },
    {
      title: "Cena 04: A Família",
      text: "Tempo para viver o paraíso.",
      tag: "Liberdade Caiçara",
      bg: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#1B3B30] via-[#2F6B58] to-[#409E83]",
      icon: Heart,
      fxName: "Palmeiras & Reflexo da Água"
    },
    {
      title: "Cena 05: O Ambulante",
      text: "Quando o dinheiro circula aqui... a cidade inteira ganha.",
      tag: "Economia Local",
      bg: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#3E1B0F] via-[#753412] to-[#B35212]",
      icon: Users,
      fxName: "Brilho Dourado de Coco"
    },
    {
      title: "Cena 06: A Reciclagem",
      text: "Cuidar da cidade também é crescer.",
      tag: "Sustentabilidade",
      bg: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#102C26] via-[#1B4D3E] to-[#2E856E]",
      icon: Trash2,
      fxName: "Balanço de Folhas Verdes"
    },
    {
      title: "Cena 07: O Apoio Coletivo",
      text: "Quando um trabalhador cresce... toda a comunidade cresce.",
      tag: "Associação de Bairro",
      bg: "https://images.unsplash.com/photo-1529070538774-1884cb326506?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#4A2016] via-[#783623] to-[#B35A3E]",
      icon: Users,
      fxName: "Luz Acolhedora Quente"
    },
    {
      title: "Cena 08: O Pôr do Sol",
      text: "O dia termina. Mas o impacto continua.",
      tag: "Golden Hour",
      bg: "https://images.unsplash.com/photo-1472214222541-d510753a4707?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#2B0E1F] via-[#5C1635] to-[#9E2650]",
      icon: SunsetIcon,
      fxName: "Lens Flare de Fim de Tarde"
    },
    {
      title: "Cena 09: O Retorno",
      text: "Depois de um bom dia de trabalho... é hora de voltar para quem importa.",
      tag: "Crepúsculo",
      bg: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#100D21] via-[#241A4F] to-[#47348F]",
      icon: Bike,
      fxName: "Luzes Urbanas da Enseada"
    },
    {
      title: "Cena 10: O Reconhecimento",
      text: "Quem participa ajuda a construir uma cidade melhor.",
      tag: "Prêmios do Hub",
      bg: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#0B1528] via-[#10274F] to-[#17468F]",
      icon: Award,
      fxName: "Glow & Constelação de Conquistas"
    },
    {
      title: "Cena 11: A Expansão",
      text: "Quando todos crescem... Ubatuba cresce junto.",
      tag: "Cidade Viva",
      bg: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#080B1A] via-[#0E1538] to-[#192A6B]",
      icon: MapPin,
      fxName: "Conexões Luminosas do Litoral"
    },
    {
      title: "Cena 12: A Assinatura",
      text: "Os próximos capítulos dessa história começam com você.",
      tag: "Comunidade Fundadora",
      bg: "https://images.unsplash.com/photo-1475113548554-5a36f1f523d6?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#050614] via-[#090C28] to-[#121A4F]",
      icon: UserCheck,
      fxName: "Glow Refletivo de Vidro"
    },
    {
      title: "Cena 13: O Futuro do Paraíso",
      text: "Viver no paraíso ficou ainda melhor.",
      tag: "Futuro UBT",
      bg: "https://images.unsplash.com/photo-1533227268984-782c7330fb46?auto=format&fit=crop&w=1600&q=80",
      colorTheme: "from-[#03030D] via-[#06071F] to-[#0A0D38]",
      icon: Flame,
      fxName: "Fogueira & Faíscas Estrelares"
    }
  ];

  useEffect(() => {
    trackEvent("story_experience_start", "marketing");
    logSystem("INFO", "STORY", "story_experience_initialize", "success");

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      let animationFrameId: number;

      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const handleResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      };
      window.addEventListener("resize", handleResize);

      const particles: CustomParticle[] = [];
      const spawnParticles = (type: number) => {
        particles.length = 0;
        let count = 40;
        
        for (let i = 0; i < count; i++) {
          let color = "rgba(13, 184, 126, 0.4)";
          let vx = (Math.random() - 0.5) * 0.3;
          let vy = (Math.random() - 0.5) * 0.3;
          let size = Math.random() * 2 + 1;

          if (type === 0) {
            color = "rgba(255, 196, 50, 0.3)";
            vy = -Math.random() * 0.2;
          } else if (type === 1) {
            color = "rgba(255, 255, 255, 0.15)";
            vx = Math.random() * 0.6 + 0.2;
            vy = (Math.random() - 0.5) * 0.1;
          } else if (type === 2) {
            color = "rgba(255, 220, 150, 0.25)";
            vx = (Math.random() - 0.5) * 0.15;
            vy = (Math.random() - 0.5) * 0.15;
            size = Math.random() * 1.5 + 0.5;
          } else if (type === 5) {
            color = "rgba(13, 184, 126, 0.25)";
            vy = Math.random() * 0.3 + 0.1;
            vx = Math.random() * 0.2 - 0.1;
          } else if (type === 12) {
            color = "rgba(249, 115, 22, 0.6)";
            vy = -Math.random() * 0.8 - 0.3;
            vx = (Math.random() - 0.5) * 0.4;
          }

          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx,
            vy,
            size,
            alpha: Math.random() * 0.5 + 0.2,
            color,
            life: 0,
            maxLife: Math.random() * 100 + 100
          });
        }
      };

      spawnParticles(currentScene);

      const draw = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        const sceneIndex = currentScene;
        
        for (const p of particles) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          
          if (sceneIndex === 1) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 12, p.y);
            ctx.stroke();
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        if (sceneIndex === 0 || sceneIndex === 7) {
          const flareGrad = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, 180);
          flareGrad.addColorStop(0, "rgba(255, 230, 180, 0.15)");
          flareGrad.addColorStop(0.2, "rgba(255, 185, 126, 0.06)");
          flareGrad.addColorStop(1, "rgba(255, 185, 126, 0)");
          
          ctx.fillStyle = flareGrad;
          ctx.beginPath();
          ctx.arc(width * 0.8, height * 0.2, 180, 0, Math.PI * 2);
          ctx.fill();
        }

        animationFrameId = requestAnimationFrame(draw);
      };

      draw();

      const updateParticlesOnScene = () => {
        spawnParticles(currentScene);
      };
      updateParticlesOnScene();

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [currentScene]);

  const handleWheel = (e: React.WheelEvent) => {
    if (isScrolling.current) return;

    if (e.deltaY > 15) {
      navigateScene(Math.min(TOTAL_SCENES - 1, currentScene + 1));
    } else if (e.deltaY < -15) {
      navigateScene(Math.max(0, currentScene - 1));
    }
  };

  const navigateScene = (targetIndex: number) => {
    if (targetIndex === currentScene) return;

    isScrolling.current = true;
    setCurrentScene(targetIndex);
    trackEvent("story_scene_navigate", "marketing", { from: currentScene, to: targetIndex });

    setTimeout(() => {
      isScrolling.current = false;
    }, 1100);
  };

  const submitWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    trackEvent("story_waitlist_signup", "marketing", { email: formEmail });
    setSignedUp(true);
    navigateScene(TOTAL_SCENES - 1);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/?ref=story_fundador_${Date.now()}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    trackEvent("story_share_link", "ux");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div 
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      className="h-screen w-screen relative overflow-hidden bg-[#03030D] text-white select-none font-sans"
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none opacity-60" />

      {SCENES.map((sc, index) => {
        if (!sc.bg) return null;
        const active = currentScene === index;
        return (
          <div
            key={index}
            className="absolute inset-0 bg-cover bg-center transition-all duration-[1200ms] ease-in-out z-0"
            style={{
              backgroundImage: `url('${sc.bg}')`,
              opacity: active ? 0.32 : 0,
              transform: active ? "scale(1)" : "scale(1.05)",
              filter: "brightness(0.9) contrast(1.02)"
            }}
          />
        );
      })}

      <div className={`absolute inset-0 bg-gradient-to-tr ${SCENES[currentScene].colorTheme} opacity-75 mix-blend-multiply transition-all duration-[1200ms] ease-in-out z-0`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#03030D] via-[#03030D]/40 to-[#03030D]/10 z-0" />

      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {SCENES.map((sc, i) => (
          <button
            key={i}
            onClick={() => navigateScene(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              currentScene === i 
                ? "bg-[#0DB87E] scale-125 shadow-lg shadow-[#0DB87E]/50" 
                : "bg-white/20 hover:bg-white/40"
            }`}
            title={sc.title}
          />
        ))}
      </div>

      <div className="h-full w-full relative z-20 flex flex-col justify-center items-center px-6">
        {SCENES.map((sc, index) => {
          const active = currentScene === index;
          if (index === 11 || index === 12) return null;
          
          return (
            <div
              key={index}
              className={`absolute inset-x-6 max-w-3xl mx-auto text-center transition-all duration-[1000ms] ease-out ${
                active ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-8 scale-95 pointer-events-none"
              }`}
            >
              <span className="text-[10px] tracking-[0.25em] font-mono text-[#0DB87E] uppercase block mb-3">
                {sc.tag}
              </span>
              <h1 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight leading-tight text-white mb-6">
                {sc.text}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/50 uppercase tracking-widest">
                Efeito: {sc.fxName}
              </div>
            </div>
          );
        })}

        <div className={`absolute max-w-sm w-full bg-white/[0.01] border border-white/5 rounded-3xl p-8 backdrop-blur-md shadow-2xl transition-all duration-1000 ${
          currentScene === 11 ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}>
          <span className="text-[9px] tracking-[0.2em] font-mono text-[#0DB87E] uppercase block mb-2 text-center">
            Faça Parte da Mudança
          </span>
          <h3 className="font-display font-extrabold text-xl mb-2 text-center">Assine a Fila de Espera</h3>
          <p className="text-xs text-white/50 text-center mb-6 leading-relaxed">
            Seja um pioneiro na UBT de Ubatuba. Inscreva seu e-mail para validar nossa direção criativa.
          </p>

          <form onSubmit={submitWaitlist} className="flex flex-col gap-4">
            <input
              type="text"
              required
              placeholder="Seu nome"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 outline-none text-white text-sm focus:border-[#0DB87E] transition-all"
            />
            <input
              type="email"
              required
              placeholder="Seu e-mail"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 outline-none text-white text-sm focus:border-[#0DB87E] transition-all"
            />

            <div className="flex gap-2 items-start mt-1">
              <input type="checkbox" required id="lgpd-opt-in" className="mt-1 shrink-0 accent-[#0DB87E]" />
              <label htmlFor="lgpd-opt-in" className="text-[10px] text-white/40 leading-tight">
                Aceito receber informativos de desenvolvimento da UBT nos termos da LGPD.
              </label>
            </div>

            <button
              type="submit"
              disabled={!formName.trim() || !formEmail.trim() || !formEmail.includes("@")}
              className={`w-full py-4 rounded-xl font-display font-extrabold text-[15px] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg ${
                !formName.trim() || !formEmail.trim() || !formEmail.includes("@")
                  ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/5 shadow-none"
                  : "bg-[#0DB87E] hover:bg-[#0ca36e] active:scale-95 text-white shadow-[#0DB87E]/20 cursor-pointer"
              }`}
            >
              Quero ser um Fundador da UBT
            </button>
          </form>
        </div>

        <div className={`absolute max-w-md w-full text-center transition-all duration-1000 ${
          currentScene === 12 ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}>
          <div className="w-16 h-16 rounded-full bg-[#0DB87E]/10 border border-[#0DB87E]/40 flex items-center justify-center text-[#0DB87E] mx-auto mb-6 animate-pulse">
            <CheckCircle size={32} />
          </div>
          <span className="text-[10px] tracking-[0.25em] font-mono text-[#0DB87E] uppercase block mb-2">Final da Jornada</span>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-white mb-4">
            Viver no paraíso ficou ainda melhor.
          </h2>
          <p className="text-sm text-white/70 mb-8 leading-relaxed max-w-sm mx-auto">
            Obrigado. Agora existe mais uma luz acesa em Ubatuba. Compartilhe essa fogueira com a sua rede.
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <button
              onClick={copyReferralLink}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0DB87E] hover:bg-[#0ca36e] active:scale-95 text-xs font-bold font-display uppercase tracking-wider transition-all text-white flex items-center justify-center gap-2"
            >
              {copiedLink ? <CheckCircle size={14} /> : <Share2 size={14} />}
              {copiedLink ? "Link Copiado!" : "Compartilhar História"}
            </button>
            <button
              onClick={() => navigateScene(0)}
              className="w-full py-3.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold font-display uppercase tracking-wider transition-all border border-white/5"
            >
              Reiniciar Documentário
            </button>
          </div>
        </div>
      </div>

      <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[9px] font-mono text-[#0DB87E] uppercase tracking-wider">
          Storyboard UBT-STORY-EXPERIENCE-001
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-50 flex items-center gap-2 text-[10px] font-mono tracking-widest text-white/40 uppercase">
        <span>Capítulo {String(currentScene + 1).padStart(2, "0")} / {String(TOTAL_SCENES).padStart(2, "0")}</span>
      </div>

      <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2 text-[10px] font-mono tracking-widest text-white/40 uppercase animate-pulse">
        <span>Role ou clique para passar de capítulo</span>
        <ArrowDown size={12} />
      </div>
    </div>
  );
}
