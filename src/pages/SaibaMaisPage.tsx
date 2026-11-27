import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  HelpCircle,
  LogIn,
  Menu,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/services/AnalyticsService";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { generateReferralSlug } from "@/utils/masks";
import {
  isVerticalEnabled,
  SHOW_PUBLIC_LOGIN_BUTTON,
  type VerticalKey,
} from "@/config/verticalFlags";
import WelcomeFundadorModal from "@/components/WelcomeFundadorModal";
import IosInstallModal from "@/components/IosInstallModal";
import FounderForm from "@/components/FounderForm";
import UbtVectorLogo from "@/components/landing/UbtVectorLogo";
import PublicFooter from "@/components/landing/PublicFooter";

// Flag booleana para eventual reativação futura do Capítulo V (O Começo / Fundadores)
const SHOW_CHAPTER_V_FOUNDERS = false;

interface FaqItemProps {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItemProps[] = [
  {
    question: "O que é a UBT?",
    answer:
      "A UBT é um ecossistema digital e superapp construído especificamente para fortalecer a economia local de Ubatuba. Conectamos prestadores de serviço locais diretamente aos consumidores e turistas, com taxas muito menores do que as grandes corporações e com um modelo transparente de distribuição de benefícios e repasse social.",
  },
  {
    question: "Quando posso começar a usar?",
    answer:
      "A plataforma já está ativa em Ubatuba. Você pode criar sua conta gratuitamente agora mesmo e acompanhar a liberação progressiva de cada vertical diretamente pelo aplicativo.",
  },
  {
    question: "Como funciona?",
    answer:
      "Os consumidores buscam, contratam e pagam serviços diretamente pelo aplicativo da UBT. O pagamento é processado com total segurança. A grande diferença é a distribuição de benefícios: a cada transação, percentuais do valor são distribuídos para impulsionar a comunidade (programa de indicações, prêmios e fundo das associações).",
  },
  {
    question: "Quanto custa?",
    answer:
      "O cadastro e a utilização do aplicativo são totalmente gratuitos para os consumidores. Para os prestadores de serviço, as taxas são as menores do mercado (até 70% menores que os apps corporativos tradicionais), destinadas exclusivamente à manutenção e distribuição de benefícios locais.",
  },
  {
    question: "Como participar?",
    answer:
      "Basta preencher o formulário de cadastro ao final desta página ou na página inicial. Você já recebe seu acesso e seu link exclusivo de indicação na comunidade UBT.",
  },
  {
    question: "Como indicar pessoas?",
    answer:
      "Ao se cadastrar na UBT, você recebe um link exclusivo de padrinho ou madrinha. Você pode enviar este link pelo WhatsApp ou gerar um QR Code. Sempre que novos usuários ou prestadores se cadastrarem com seu link, sua rede de indicações é registrada.",
  },
  {
    question: "Como funciona o Programa Padrinho/Madrinha?",
    answer:
      "Para incentivar a colaboração orgânica, até 0,5% do valor de todas as transações realizadas pelos prestadores que você indicou é revertido diretamente para você como bônus de indicação, promovendo o crescimento mútuo na rede.",
  },
  {
    question: "Como funcionam os prêmios?",
    answer:
      "Destinamos 0,5% do volume de vendas para o Fundo Trabalhador (com sorteio anual no dia 01 de maio) e 0,5% para o Fundo Consumidor (com sorteio anual no dia 01 de novembro). Todos os usuários ativos na plataforma concorrem automaticamente, gerando um ecossistema de incentivo à fidelidade local.",
  },
  {
    question: "Como funciona a Côco & Cia?",
    answer:
      "Integrada ao superapp, a Côco & Cia é nossa vertical ecológica. Pelo mapa interativo, qualquer morador ou turista pode marcar onde deixou recicláveis limpos nas praias ou residências. Nossa equipe dedicada de catadores parceiros recebe a notificação e faz a coleta rápida, unindo tecnologia à preservação do nosso ecossistema.",
  },
];

function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/5 py-5 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left py-2 font-display font-bold text-lg hover:text-green transition-colors cursor-pointer bg-transparent border-0 text-white"
      >
        <span>{question}</span>
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-green" : "text-white/40"
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-[320px] mt-3 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-sm text-white/70 leading-relaxed font-sans pb-4">
          {answer}
        </p>
      </div>
    </div>
  );
}

const PROTAGONISTS: Array<{
  title: string;
  phrase: string;
  desc: string;
  video?: string;
  image?: string;
  align: "left" | "right";
  vertical: VerticalKey;
}> = [
  {
    title: "Mototaxistas",
    phrase: "Mobilidade rápida e integrada ao comércio e bairros.",
    desc: "O transporte local ganha rotas seguras e controle total das chamadas pelo celular, reduzindo tarifas e impulsionando a eficiência urbana.",
    video: "Cena02.mp4",
    align: "left",
    vertical: "mototaxi",
  },
  {
    title: "Carros",
    phrase: "Conforto e transparência em corridas urbanas por toda Ubatuba.",
    desc: "Motoristas locais com veículo verificado, detalhes completos exibidos ao passageiro no momento do chamado e repasse justo de 90% por corrida.",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=900",
    align: "right",
    vertical: "carros",
  },
  {
    title: "Diaristas",
    phrase: "Segurança de agendamentos e valorização do trabalho doméstico.",
    desc: "A contratação simples de profissionais diaristas locais garante flexibilidade de horários, pagamento rápido e apoio às associações.",
    video: "Cena03.mp4",
    align: "left",
    vertical: "diaristas",
  },
  {
    title: "Ambulantes da Praia",
    phrase: "Inovação de vendas móveis na orla marítima.",
    desc: "A transação ágil de bebidas e lanches integrada diretamente na carteira digital da UBT, facilitando o atendimento de banhistas e turistas sem ruídos.",
    video: "Cena05.mp4",
    align: "right",
    vertical: "ambulantes",
  },
  {
    title: "Côco & Cia",
    phrase: "Cooperativa de catadores de recicláveis em Ubatuba",
    desc: "Moradores indicam onde deixaram seus resíduos recicláveis e catadores coletam. É a força da sustentabilidade da cidade. Obrigado!",
    video: "Cena06.mp4",
    align: "left",
    vertical: "coco_cia",
  },
];

export default function SaibaMaisPage() {
  const { isStandalone, isIOS, install } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showGenericGuide, setShowGenericGuide] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<{
    id?: string;
    nome: string;
    email: string;
    referral_code?: string;
  } | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handlePwaInstallClick = async () => {
    trackEvent("pwa_install_click", "engagement");
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    const outcome = await install();
    trackEvent("pwa_install_prompt_outcome", "engagement", { outcome });
    if (outcome === "ios_instructions") setShowIosGuide(true);
    else if (outcome === "prompt_unavailable") setShowGenericGuide(true);
  };

  const scrollToCadastro = () => {
    document
      .getElementById("cadastro")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white font-sans overflow-x-hidden selection:bg-green selection:text-navy">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-black/50 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6 md:px-12 transition-all">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          <UbtVectorLogo className="h-9 sm:h-10 w-auto antialiased" />
          <span className="text-[9px] sm:text-[10px] font-mono text-white/50 leading-none uppercase tracking-wider max-w-[110px] ml-1 select-none">
            Unindo Brasil &amp; Tecnologia
          </span>
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-white/60 tracking-wider uppercase">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="hover:text-[#00E676] transition-colors bg-transparent border-0 p-0 cursor-pointer text-white/60 font-semibold uppercase tracking-wider text-xs"
            >
              Início
            </button>
            <a href="#quem-faz-cap" className="hover:text-[#00E676] transition-colors">
              Quem Faz
            </a>
            <a href="#todos-ganham-cap" className="hover:text-[#00E676] transition-colors">
              Prêmios
            </a>
            <a href="#faq-section" className="hover:text-[#00E676] transition-colors">
              FAQ
            </a>
          </div>

          {SHOW_PUBLIC_LOGIN_BUTTON && (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden md:inline-block px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/85 hover:text-white font-display font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Fazer Login
            </button>
          )}

          <button
            type="button"
            onClick={scrollToCadastro}
            className="hidden md:inline-block px-6 py-2.5 rounded-full bg-[#00E676] hover:bg-[#00C853] hover:scale-[1.03] active:scale-95 text-zinc-950 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Cadastre-se
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden text-white hover:text-[#00E676] transition-colors p-2 bg-transparent border-0"
            aria-label="Abrir Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center gap-6 animate-fadeIn md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 p-2 text-white hover:text-[#00E676] transition-colors bg-transparent border-0"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/");
            }}
            className="text-2xl font-display font-bold text-white hover:text-[#00E676] bg-transparent border-0"
          >
            Início
          </button>
          <a
            href="#quem-faz-cap"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-2xl font-display font-bold text-white hover:text-[#00E676]"
          >
            Quem Faz
          </a>
          <a
            href="#todos-ganham-cap"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-2xl font-display font-bold text-white hover:text-[#00E676]"
          >
            Prêmios
          </a>
          <a
            href="#faq-section"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-2xl font-display font-bold text-white hover:text-[#00E676]"
          >
            FAQ
          </a>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              scrollToCadastro();
            }}
            className="mt-4 px-8 py-3.5 rounded-full bg-[#00E676] text-zinc-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer"
          >
            Cadastre-se
          </button>
          {SHOW_PUBLIC_LOGIN_BUTTON && (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/login");
              }}
              className="px-8 py-3 rounded-full bg-white/5 border border-white/15 text-white/90 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Fazer Login
            </button>
          )}
        </div>
      )}

      {/* HERO NARRATIVA */}
      <section className="relative min-h-[88svh] flex items-center justify-start px-6 md:px-12 pt-24 pb-16 overflow-hidden w-full z-20">
        <img
          src="/hero-2.0.png"
          alt="Ubatuba Conectada"
          className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.65] contrast-[1.05]"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/25 pointer-events-none" />

        <div className="max-w-[1200px] w-full mx-auto relative z-20 flex flex-col items-start justify-center text-left">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00E676]" />
            Voltar para a página inicial
          </button>

          <h1 className="font-['Poppins'] font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.12] tracking-tight mb-4 max-w-3xl">
            Quando todos <span className="text-[#22C55E]">ganham</span>,
            <br />a cidade inteira <span className="text-[#005BFF]">cresce.</span>
          </h1>

          <p className="text-white/85 text-base sm:text-lg font-['Poppins'] font-medium tracking-wide mb-8 max-w-lg leading-relaxed">
            Conheça como a plataforma oficial da economia local de{" "}
            <span className="text-[#22C55E] font-semibold">Ubatuba</span> conecta
            moradores, turistas, prestadores e associações.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              type="button"
              onClick={scrollToCadastro}
              className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-[#005BFF] to-[#22C55E] font-['Poppins'] font-bold text-xs sm:text-sm tracking-widest uppercase text-white flex items-center justify-center gap-2.5 border border-white/10 cursor-pointer hover:scale-[1.02] transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>CADASTRE-SE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {SHOW_PUBLIC_LOGIN_BUTTON && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-14 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/15 font-['Poppins'] font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogIn className="w-4 h-4 text-[#00E676]" />
                <span>FAZER LOGIN</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FILOSOFIA UBT */}
      <section className="px-6 md:px-12 py-14 bg-white/[0.01] border-y border-white/5 relative z-20">
        <div className="max-w-[800px] mx-auto text-center">
          <span className="text-[10px] tracking-[0.25em] font-mono text-[#00E676] uppercase block mb-4">
            Filosofia UBT
          </span>
          <h2 className="font-display font-extrabold text-2xl md:text-4xl text-white leading-snug">
            “Quem faz Ubatuba acontecer merece uma tecnologia feita para ela.”
          </h2>
          <div className="w-16 h-0.5 bg-[#00E676]/40 mx-auto mt-6" />
        </div>
      </section>

      {/* CAPÍTULO II: QUEM FAZ A CIDADE ACONTECER */}
      <section
        id="quem-faz-cap"
        className="px-6 md:px-12 py-16 max-w-[1200px] mx-auto relative z-20"
      >
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-[#00E676] uppercase tracking-widest mb-4">
            <span>Capítulo II</span>
            <span>•</span>
            <span>Protagonistas</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white mb-4">
            Quem faz a cidade acontecer
          </h2>
          <p className="text-sm text-white/60 font-sans leading-relaxed">
            Pessoas reais de Ubatuba, representadas com dignidade e autonomia por
            meio da tecnologia.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {PROTAGONISTS.map((item) => {
            const enabled = isVerticalEnabled(item.vertical);
            return (
              <div
                key={item.title}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
                  enabled ? "" : "opacity-75"
                }`}
              >
                <div
                  className={`lg:col-span-6 relative rounded-3xl overflow-hidden border border-white/5 bg-[#070B16] aspect-[4/3] ${
                    item.align === "right" ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  {item.video ? (
                    <video
                      src={`/videos/${item.video}`}
                      loop
                      muted
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover transition-opacity duration-700 ${
                        enabled ? "opacity-65 hover:opacity-85" : "opacity-40 grayscale-[35%]"
                      }`}
                    />
                  ) : (
                    <img
                      src={item.image || "/hero-2.0.png"}
                      alt={item.title}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-opacity duration-700 ${
                        enabled ? "opacity-75 hover:opacity-90" : "opacity-40 grayscale-[35%]"
                      }`}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  {!enabled && (
                    <span className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/80 border border-white/20 text-xs font-mono font-semibold text-zinc-200">
                      Em breve
                    </span>
                  )}
                </div>

                <div
                  className={`lg:col-span-6 flex flex-col items-start ${
                    item.align === "right" ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white m-0">
                      {item.title}
                    </h3>
                    {!enabled && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono text-zinc-300">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="font-display font-bold text-base text-[#00E676] leading-snug mb-4">
                    {item.phrase}
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed font-sans mb-4">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CAPÍTULO IV: TODOS GANHAM */}
      <section
        id="todos-ganham-cap"
        className="px-6 md:px-12 py-16 max-w-[1200px] mx-auto relative z-20 rounded-3xl"
        style={{ backgroundColor: "rgb(8, 57, 40)" }}
      >
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-[#00E676] uppercase tracking-widest mb-4">
            <span>Capítulo IV</span>
            <span>•</span>
            <span>Retorno Comunitário</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white mb-4">
            Todos ganham
          </h2>
          <p className="text-sm text-white/70 font-sans leading-relaxed">
            Cada transação na UBT gera recursos revertidos diretamente para fundos
            locais, associações e preservação.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                  Programa Padrinho / Madrinha
                </span>
                <span className="text-2xl font-display font-bold text-yellow-400">
                  0,5%
                </span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mb-4">
                Indique e participe do crescimento da sua comunidade.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Cada usuário possui um link exclusivo. Compartilhe pelo WhatsApp,
                QR Code ou redes sociais. Sempre que um prestador indicado por você
                realizar vendas pela plataforma, você recebe 0,5% das vendas
                revertidos para você como bônus vitalício de indicação.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-yellow-400 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Users className="w-4 h-4 text-yellow-400" /> 0,5% das vendas
              revertidos para o padrinho ou madrinha.
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                  Prêmio Trabalhador
                </span>
                <span className="text-2xl font-display font-bold text-yellow-400">
                  0,5%
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Quem trabalha também pode ganhar.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas realizadas pela plataforma forma um fundo
                destinado ao Prêmio Trabalhador. O sorteio acontece anualmente em
                01 de maio.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-yellow-400 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Award className="w-4 h-4 text-yellow-400" /> 0,5% das vendas compõe
              este fundo.
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                  Prêmio Consumidor
                </span>
                <span className="text-2xl font-display font-bold text-yellow-400">
                  0,5%
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Quem compra também participa.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas realizadas pela plataforma forma um fundo
                destinado ao Prêmio Consumidor. O sorteio acontece anualmente em 01
                de novembro.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-yellow-400 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Award className="w-4 h-4 text-yellow-400" /> 0,5% das vendas compõe
              este fundo.
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                  Associações
                </span>
                <span className="text-2xl font-display font-bold text-yellow-400">
                  0,5%
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Associações mais fortes.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas fortalece financeiramente as associações
                participantes, permitindo maior apoio aos trabalhadores locais.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-yellow-400 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Users className="w-4 h-4 text-yellow-400" /> 0,5% das vendas
              revertidos.
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                  Côco &amp; Cia
                </span>
                <span className="text-xs font-semibold text-yellow-400">
                  Ecologia
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Tecnologia para cuidar da cidade.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                O cidadão poderá indicar pelo mapa onde deixou materiais
                recicláveis. A equipe da Côco &amp; Cia realizará a coleta rápida.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-mono text-yellow-400/80 tracking-wider uppercase border-t border-[#0d5236]/30 pt-4">
              <span>Reciclagem</span>
              <span>•</span>
              <span>Ecologia</span>
              <span>•</span>
              <span>Parceria</span>
            </div>
          </div>
        </div>
      </section>

      {/* CAPÍTULO V • O COMEÇO (Oculto por flag booleana conforme diretriz de produto) */}
      {SHOW_CHAPTER_V_FOUNDERS && (
        <section
          id="fundadores-cap"
          className="scroll-mt-24 py-20 px-6 md:px-12 max-w-[1000px] mx-auto relative z-20 text-center flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-[#00E676] uppercase tracking-widest mb-6">
            <span>Capítulo V</span>
            <span>•</span>
            <span>O Começo</span>
          </div>
          <h2 className="font-display font-extrabold text-white leading-[1.1] mb-6 max-w-2xl text-2xl">
            “Algumas pessoas poderão dizer que estavam aqui desde o começo.”
          </h2>
        </section>
      )}

      {/* SEÇÃO O CADASTRO */}
      <section
        id="cadastro"
        className="scroll-mt-24 py-20 px-6 md:px-12 max-w-[1400px] mx-auto relative z-20"
      >
        <div id="cadastro-fundadores-cap" className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-[#00E676] uppercase tracking-widest mb-4">
            <span>Plataforma UBT</span>
            <span>•</span>
            <span>O Cadastro</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white m-0">
            O Cadastro
          </h2>
        </div>

        <div className="bg-[#0b1329]/30 border border-white/5 rounded-[40px] p-3 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {submitSuccess ? (
            <div className="text-center py-10 max-w-lg mx-auto px-4">
              <div className="w-20 h-20 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <span className="text-[10px] tracking-[0.2em] font-mono text-[#00E676] uppercase block mb-2">
                Sucesso no Cadastro
              </span>
              <h3 className="font-display font-extrabold text-3xl text-white mb-3">
                Cadastro realizado com sucesso! 🎉
              </h3>
              <p className="text-sm text-white/70 leading-relaxed font-sans mb-6">
                Seu cadastro foi registrado com sucesso na UBT Serviços. Juntos
                vamos construir uma Ubatuba mais conectada e próspera.
              </p>

              <div className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 text-left mb-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Users className="w-4 h-4 text-[#00E676]" />
                  <span>Seu Link Exclusivo de Indicação:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      registeredUser?.referral_code
                        ? `${window.location.origin}/?ref=${registeredUser.referral_code}#cadastro`
                        : `${window.location.origin}/#cadastro`
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white/90 text-xs font-mono select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const refCode =
                        registeredUser?.referral_code ||
                        generateReferralSlug(
                          registeredUser?.nome || "",
                          registeredUser?.id,
                        );
                      const link = refCode
                        ? `${window.location.origin}/?ref=${refCode}#cadastro`
                        : `${window.location.origin}/#cadastro`;
                      navigator.clipboard?.writeText(link).catch(() => {});
                      setCopiedReferral(true);
                      setTimeout(() => setCopiedReferral(false), 3000);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs flex items-center gap-1.5 shrink-0 border border-white/10 cursor-pointer"
                  >
                    {copiedReferral ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#00E676]" />
                        <span className="text-[#00E676]">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!isStandalone && (
                <div className="mb-6 p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <h4 className="font-display font-bold text-sm text-white mb-2">
                    Deixe a UBT sempre à mão
                  </h4>
                  <button
                    type="button"
                    onClick={handlePwaInstallClick}
                    className="px-6 py-2.5 rounded-full bg-[#005BFF] hover:bg-[#005BFF]/90 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Instalar UBT
                  </button>
                </div>
              )}

              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/40 leading-relaxed font-sans flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00E676] shrink-0" />
                Seus dados estão protegidos nos termos estritos da Lei Geral de
                Proteção de Dados (LGPD).
              </div>
            </div>
          ) : (
            <FounderForm
              isUpdateMode={false}
              submitButtonText="Cadastrar"
              onSuccess={(data) => {
                const wData = data.waitlistData;
                const refCode =
                  wData?.referral_code ||
                  generateReferralSlug(
                    wData?.nome || "",
                    wData?.id || data?.user?.id,
                  );
                setSubmitSuccess(true);
                setRegisteredUser({
                  id: wData?.id || data?.user?.id,
                  nome: wData?.nome || "",
                  email: wData?.email || "",
                  referral_code: refCode,
                });
                setShowWelcomeModal(true);
              }}
            />
          )}
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq-section"
        className="py-20 px-6 md:px-12 max-w-[800px] mx-auto relative z-20"
      >
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="text-[10px] tracking-[0.25em] font-mono text-[#00E676] uppercase block mb-3">
            Dúvidas Frequentes
          </span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-4">
            Perguntas frequentes
          </h2>
        </div>
        <div className="flex flex-col gap-1 border-t border-white/5">
          {FAQ_ITEMS.map((item, idx) => (
            <FaqItem key={idx} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* FOOTER COMPARTILHADO */}
      <PublicFooter />

      {/* Modais auxiliares */}
      <WelcomeFundadorModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        userName={registeredUser?.nome}
        userEmail={registeredUser?.email}
        userId={registeredUser?.id}
        referralCode={registeredUser?.referral_code}
        ctaText="Concluir"
        onCtaClick={() => setShowWelcomeModal(false)}
      />

      <IosInstallModal
        isOpen={showIosGuide}
        onClose={() => setShowIosGuide(false)}
      />

      {showGenericGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm">
          <div className="relative max-w-sm w-full bg-[#121215] border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center">
            <button
              type="button"
              onClick={() => setShowGenericGuide(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 rounded-full bg-[#005BFF]/10 border border-[#005BFF]/30 flex items-center justify-center text-[#005BFF] mx-auto mb-5">
              <HelpCircle className="w-7 h-7" />
            </div>
            <h3 className="font-display font-extrabold text-xl text-white mb-2">
              Como instalar a UBT
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Abra o menu do navegador e selecione{" "}
              <strong className="text-white">“Adicionar à tela inicial”</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowGenericGuide(false)}
              className="w-full py-3 rounded-xl bg-[#00E676] text-zinc-950 font-display font-bold text-xs uppercase tracking-widest cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
