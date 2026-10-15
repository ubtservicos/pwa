import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { Sparkles, ArrowRight, ShieldCheck, Award, Share2, Copy, Check, Users } from "lucide-react";
import { trackEvent } from "@/services/AnalyticsService";
import { generateReferralSlug } from "@/utils/masks";

interface WelcomeFundadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  userId?: string;
  referralCode?: string;
  ctaText?: string;
  onCtaClick?: () => void;
}

export default function WelcomeFundadorModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  userId,
  referralCode,
  ctaText = "Concluir",
  onCtaClick,
}: WelcomeFundadorModalProps) {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const [recycleConfetti, setRecycleConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setRecycleConfetti(true);
      return;
    }

    // Stop continuous confetti recycling after 4.5 seconds
    const confettiTimer = setTimeout(() => {
      setRecycleConfetti(false);
    }, 4500);

    return () => {
      clearTimeout(confettiTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      onClose();
    }
  };

  const displayName = userName ? userName.split(" ")[0] : "";
  const origin = typeof window !== "undefined" ? window.location.origin : (import.meta.env.VITE_APP_URL || "");
  const slug = referralCode || generateReferralSlug(userName, userId);
  const referralUrl = slug ? `${origin}/cadastro?ref=${slug}` : `${origin}/#cadastro-fundadores-cap`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    trackEvent("welcome_modal_referral_copy", "marketing", { userId, slug });
  };

  const whatsAppMessage = `🚀 Olá! Conheça a UBT, a plataforma que conecta prestadores de serviço locais com taxas justas em Ubatuba.\n\nCadastre-se como pioneiro(a) pelo meu link exclusivo de fundador e garanta benefícios:\n${referralUrl}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 select-none overflow-y-auto"
    >
      {/* Fullscreen Celebration Confetti */}
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={recycleConfetti}
        numberOfPieces={350}
        gravity={0.18}
        colors={["#0DB87E", "#2BD49B", "#F5A623", "#FFD700", "#ffffff", "#0B1B3E"]}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg bg-[#0E0F12]/95 border border-[#0DB87E]/30 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(13,184,126,0.25)] flex flex-col items-center animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
        
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#0DB87E]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#F5A623]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing UBT Logo / Pioneer Badge */}
        <div className="relative mb-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#0DB87E]/20 via-[#0DB87E]/10 to-[#F5A623]/20 border-2 border-[#0DB87E]/60 flex items-center justify-center shadow-xl shadow-[#0DB87E]/20 animate-pulse">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#090A0C] border border-white/10 flex flex-col items-center justify-center text-white">
              <span className="font-display font-black text-lg sm:text-xl tracking-tighter text-[#0DB87E]">
                UBT
              </span>
              <span className="text-[7px] font-mono tracking-widest text-[#F5A623] -mt-1 font-bold">
                PIONEER
              </span>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-[#F5A623] text-[#090A0C] rounded-full shadow-md animate-bounce">
            <Award className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Pioneer Badge Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0DB87E]/15 border border-[#0DB87E]/30 text-[#0DB87E] text-[10px] font-mono uppercase tracking-widest font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Fundador(a) Oficial
        </div>

        {/* Hero Text */}
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight mb-2">
          {displayName ? `Parabéns, ${displayName}!` : "Bem-vindo(a) ao time!"}
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0DB87E] via-[#38EF7D] to-[#F5A623]">
            Você agora é um Fundador UBT 🎉
          </span>
        </h2>

        {/* Subtitle / Trust statement */}
        <p className="text-xs sm:text-sm text-white/70 font-sans leading-relaxed mb-4 max-w-md">
          Sua inscrição pioneira foi confirmada com sucesso. Comece a indicar seus amigos e prestadores para ganhar recompensas!
        </p>

        {/* Apadrinhamento & Referral Box */}
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Users className="w-4 h-4 text-green" />
            <span>Seu Link de Indicação (Padrinho/Madrinha):</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white/90 text-xs font-mono select-all outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-white/10 cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green" />
                  <span className="text-green">Copiado</span>
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
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("welcome_modal_whatsapp_share", "marketing", { userId })}
            className="w-full py-3 rounded-xl font-display font-bold text-xs tracking-wider uppercase bg-[#25D366] hover:bg-[#20bd5a] text-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Convidar no WhatsApp</span>
          </a>
        </div>

        {/* Security & Benefits Chip */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-5 text-left">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0DB87E] shrink-0" />
            <span className="text-[10px] text-white/60 font-sans leading-tight">
              Prioridade na Fila Oficial
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#F5A623] shrink-0" />
            <span className="text-[10px] text-white/60 font-sans leading-tight">
              Sorteios de 0,5% dos Fundos
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAction}
            className="w-full py-3.5 px-6 rounded-2xl font-display font-extrabold text-sm bg-[#0DB87E] hover:bg-[#0ca36e] active:scale-[0.98] text-[#090A0C] shadow-lg shadow-[#0DB87E]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
