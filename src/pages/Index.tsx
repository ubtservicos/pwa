import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
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
import WelcomeFundadorModal from "@/components/WelcomeFundadorModal";
import IosInstallModal from "@/components/IosInstallModal";
import FounderForm from "@/components/FounderForm";
import UbtVectorLogo from "@/components/landing/UbtVectorLogo";
import PublicFooter from "@/components/landing/PublicFooter";

export default function Index() {
  const { showInstallBtn, isStandalone, isIOS, install } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showGenericGuide, setShowGenericGuide] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
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

  // Captura e persistência redundante do parâmetro de indicação (?ref=...)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const rawRef = searchParams.get("ref");
      if (rawRef) {
        const cleanRef = rawRef.trim().replace(/[\\/\s]/g, "");
        if (cleanRef) {
          localStorage.setItem("ubt_ref", cleanRef);
          sessionStorage.setItem("ubt_ref", cleanRef);
        }
      }
      if (
        window.location.hash === "#cadastro" ||
        window.location.hash === "#cadastro-fundadores-cap"
      ) {
        setTimeout(() => {
          document
            .getElementById("cadastro")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    } catch {
      // Storage inacessível em modo restrito
    }
  }, []);

  const handlePwaInstallClick = async () => {
    trackEvent("pwa_install_click", "engagement");
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    const outcome = await install();
    trackEvent("pwa_install_prompt_outcome", "engagement", { outcome });
    if (outcome === "ios_instructions") {
      setShowIosGuide(true);
    } else if (outcome === "prompt_unavailable") {
      setShowGenericGuide(true);
    }
  };

  const scrollToCadastro = () => {
    const el = document.getElementById("cadastro");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("landing_cta_click", "marketing");
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white font-sans overflow-x-hidden selection:bg-green selection:text-navy">
      {/* GLASSMORPHIC NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-black/50 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6 md:px-12 transition-all">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          <UbtVectorLogo className="h-9 sm:h-10 w-auto antialiased" />
          <span className="text-[9px] sm:text-[10px] font-mono text-white/50 leading-none uppercase tracking-wider max-w-[110px] ml-1 select-none">
            Unindo Brasil &amp; Tecnologia
          </span>
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => navigate("/saiba-mais")}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-[#00E676] tracking-wider uppercase transition-colors bg-transparent border-0 cursor-pointer"
          >
            Saiba Mais
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="hidden md:inline-block px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/90 hover:text-white font-display font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Fazer Login
          </button>

          <button
            type="button"
            onClick={scrollToCadastro}
            className="hidden md:inline-block px-6 py-2.5 rounded-full bg-[#00E676] hover:bg-[#00C853] hover:shadow-lg hover:shadow-[#00E676]/20 hover:scale-[1.03] active:scale-95 text-zinc-950 font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Cadastre-se
          </button>

          {/* Hamburger Menu Icon for Mobile */}
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

      {/* PWA INSTALL BANNER */}
      {showInstallBtn && !isBannerDismissed && (
        <div className="fixed top-20 left-0 right-0 z-40 bg-[#121215]/95 backdrop-blur-xl border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
              <img src="/favicon.png" className="w-6 h-6 object-contain" alt="UBT" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-white m-0">
                Tenha a UBT sempre à mão
              </h4>
              <p className="text-[11px] text-zinc-400 m-0">
                Instale a UBT no seu celular para acesso rápido.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePwaInstallClick}
              className="px-4 py-2 rounded-full bg-[#00E676] text-zinc-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Instalar UBT
            </button>
            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="p-2 text-zinc-400 hover:text-white bg-transparent border-0 cursor-pointer"
              aria-label="Dispensar instalação"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center gap-6 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 p-2 text-white hover:text-[#00E676] bg-transparent border-0"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              scrollToCadastro();
            }}
            className="px-8 py-3.5 rounded-full bg-[#00E676] text-zinc-950 font-display font-extrabold text-sm uppercase tracking-wider cursor-pointer"
          >
            Cadastre-se
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/login");
            }}
            className="px-8 py-3 rounded-full bg-white/5 border border-white/15 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Fazer Login
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/saiba-mais");
            }}
            className="px-8 py-3 rounded-full bg-transparent border border-zinc-700 text-zinc-200 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Saiba Mais
          </button>
        </div>
      )}

      {/* HERO PRINCIPAL (ENXUTA E FOCADA EM CONVERSÃO) */}
      <section
        id="hero-cap"
        className="relative min-h-[100svh] flex items-center justify-start px-6 md:px-12 pt-24 pb-16 overflow-hidden w-full z-20"
      >
        <img
          src="/hero-2.0.png"
          alt="Ubatuba Conectada"
          className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.7] contrast-[1.05]"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/85 via-black/45 to-transparent pointer-events-none" />

        <div className="max-w-[1200px] w-full mx-auto relative z-20 flex flex-col items-start justify-center text-left">
          <h1 className="font-['Poppins'] font-black text-4xl sm:text-5xl lg:text-7xl text-white leading-[1.12] tracking-tight mb-4 max-w-3xl">
            Quando todos <br />
            <span className="text-[#22C55E]">ganham</span>,
            <br />a cidade inteira <br />
            <span className="text-[#005BFF]">cresce.</span>
          </h1>

          <p className="text-white/85 text-base sm:text-lg md:text-xl font-['Poppins'] font-medium tracking-wide mb-6 max-w-md leading-relaxed">
            A plataforma oficial da economia
            <br />
            local de{" "}
            <span className="text-[#22C55E] font-semibold">Ubatuba.</span>
          </p>

          <div className="w-24 h-1 bg-gradient-to-r from-[#005BFF] to-[#22C55E] rounded-full mb-8" />

          {/* CTAs Atualizados: CADASTRE-SE, FAZER LOGIN e SAIBA MAIS */}
          <div className="flex flex-col gap-3 w-full max-w-md mb-8">
            <button
              type="button"
              onClick={scrollToCadastro}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-[#005BFF] to-[#22C55E] hover:from-[#00A3FF] hover:to-[#22C55E] font-['Poppins'] font-bold text-xs sm:text-sm tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(0,91,255,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.35)] hover:scale-[1.02] active:scale-95 text-white flex items-center justify-between px-8 border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5" />
                <span>CADASTRE-SE</span>
              </div>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/95 hover:text-white border border-white/15 font-['Poppins'] font-bold text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 active:scale-95 shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#00E676]" />
              <span>FAZER LOGIN</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/saiba-mais")}
              className="w-full py-3 rounded-2xl bg-[#121215]/85 hover:bg-[#18181B] text-zinc-200 hover:text-[#00E676] border border-zinc-800 hover:border-[#00E676]/40 font-['Poppins'] font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#00E676]" />
              <span>SAIBA MAIS</span>
            </button>
          </div>

          <div className="text-[10px] font-mono text-white/45 tracking-wider uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span>Conectando a economia caiçara em tempo real</span>
          </div>
        </div>

        {/* Seta animada indicando o cadastro logo abaixo da dobra */}
        <button
          type="button"
          onClick={scrollToCadastro}
          aria-label="Ir para o formulário de cadastro"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 bg-transparent border-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-bounce">
            <ChevronDown className="w-4 h-4 text-[#22C55E]" />
          </div>
        </button>
      </section>

      {/* FORMULÁRIO DE CADASTRO LOGO ABAIXO DA DOBRA (#cadastro) */}
      <section
        id="cadastro"
        className="scroll-mt-24 py-16 sm:py-20 px-4 sm:px-6 md:px-12 max-w-[1200px] mx-auto relative z-20"
      >
        <div id="cadastro-fundadores-cap" className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121215] border border-zinc-800 text-[10px] font-mono text-[#00E676] uppercase tracking-widest mb-3">
            <span>UBT Serviços</span>
            <span>•</span>
            <span>O Cadastro</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white m-0">
            Crie sua conta na UBT
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-2 mb-0">
            Preencha seus dados abaixo para começar a utilizar a plataforma em Ubatuba.
          </p>
        </div>

        <div className="relative">
          {submitSuccess ? (
            <div className="max-w-lg mx-auto rounded-3xl bg-[#121215] border border-zinc-800 p-8 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <span className="text-[10px] tracking-[0.2em] font-mono text-[#00E676] uppercase block mb-2">
                Sucesso no Cadastro
              </span>
              <h3 className="font-display font-extrabold text-3xl text-white mb-3">
                Cadastro realizado com sucesso! 🎉
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-sans mb-6">
                Seu cadastro foi registrado com sucesso na UBT Serviços. Juntos
                vamos construir uma Ubatuba mais próspera e conectada.
              </p>

              <div className="w-full p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-left mb-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Users className="w-4 h-4 text-[#00E676]" />
                  <span>Seu Link Exclusivo de Indicação:</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed m-0">
                  Ganhe <strong className="text-white">0,5% de comissão</strong>{" "}
                  nas corridas e serviços concluídos pelas pessoas que você indicar!
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      registeredUser?.referral_code
                        ? `${window.location.origin}/?ref=${registeredUser.referral_code}#cadastro`
                        : `${window.location.origin}/#cadastro`
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-zinc-800 text-zinc-200 text-xs font-mono select-all outline-none"
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
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-display font-bold text-xs flex items-center gap-1.5 shrink-0 border border-zinc-700 cursor-pointer"
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
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Olá! Conheça a UBT, a plataforma oficial da economia local de Ubatuba.\n\nCadastre-se pelo meu link de indicação:\n${
                      registeredUser?.referral_code
                        ? `${window.location.origin}/?ref=${registeredUser.referral_code}#cadastro`
                        : `${window.location.origin}/#cadastro`
                    }`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-display font-bold text-xs tracking-wider uppercase bg-[#25D366] hover:bg-[#20bd5a] text-black flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhar no WhatsApp</span>
                </a>
              </div>

              {!isStandalone && (
                <div className="mb-6 p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
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

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed font-sans flex items-center gap-2">
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

      {/* FOOTER COMPARTILHADO (LOGOTIPO VETORIAL + MODAIS LEGAIS) */}
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
              Como colocar a UBT no celular
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Toque no menu do navegador e escolha{" "}
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
