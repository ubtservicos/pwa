import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { Sparkles, ArrowRight, ShieldCheck, Award } from "lucide-react";

interface WelcomeFundadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  ctaText?: string;
  onCtaClick?: () => void;
}

export default function WelcomeFundadorModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  ctaText = "Acessar meu Painel",
  onCtaClick,
}: WelcomeFundadorModalProps) {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const [recycleConfetti, setRecycleConfetti] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [canDismiss, setCanDismiss] = useState(false);

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
      setSecondsRemaining(5);
      setCanDismiss(false);
      setRecycleConfetti(true);
      return;
    }

    // Stop continuous confetti recycling after 4 seconds
    const confettiTimer = setTimeout(() => {
      setRecycleConfetti(false);
    }, 4500);

    // 5-second countdown
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanDismiss(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(confettiTimer);
      clearInterval(interval);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 select-none overflow-hidden"
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
      <div className="relative z-10 w-full max-w-lg bg-[#0E0F12]/95 border border-[#0DB87E]/30 rounded-3xl p-8 sm:p-10 text-center shadow-[0_0_80px_rgba(13,184,126,0.25)] flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#0DB87E]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#F5A623]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing UBT Logo / Pioneer Badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-[#0DB87E]/20 via-[#0DB87E]/10 to-[#F5A623]/20 border-2 border-[#0DB87E]/60 flex items-center justify-center shadow-xl shadow-[#0DB87E]/20 animate-pulse">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#090A0C] border border-white/10 flex flex-col items-center justify-center text-white">
              <span className="font-display font-black text-xl sm:text-2xl tracking-tighter text-[#0DB87E]">
                UBT
              </span>
              <span className="text-[8px] font-mono tracking-widest text-[#F5A623] -mt-1 font-bold">
                PIONEER
              </span>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 bg-[#F5A623] text-[#090A0C] rounded-full shadow-md animate-bounce">
            <Award className="w-4 h-4" />
          </div>
        </div>

        {/* Pioneer Badge Tag */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0DB87E]/15 border border-[#0DB87E]/30 text-[#0DB87E] text-[11px] font-mono uppercase tracking-widest font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Fundador(a) Oficial
        </div>

        {/* Hero Text */}
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight mb-3">
          {displayName ? `Parabéns, ${displayName}!` : "Bem-vindo(a) ao time!"}
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0DB87E] via-[#38EF7D] to-[#F5A623]">
            Você agora é um Fundador UBT 🎉
          </span>
        </h2>

        {/* Subtitle / Trust statement */}
        <p className="text-sm text-white/70 font-sans leading-relaxed mb-6 max-w-md">
          Sua inscrição pioneira foi confirmada com sucesso. Obrigado por acreditar e construir o futuro da economia caiçara conosco!
        </p>

        {/* Security & Benefits Chip */}
        <div className="w-full grid grid-cols-2 gap-3 mb-8 text-left">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0DB87E] shrink-0" />
            <span className="text-[11px] text-white/60 font-sans leading-tight">
              Prioridade na Fila Oficial de Lançamento
            </span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#F5A623] shrink-0" />
            <span className="text-[11px] text-white/60 font-sans leading-tight">
              Participação nos Sorteios & Benefícios
            </span>
          </div>
        </div>

        {/* CTA Button with Timer Feedback */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAction}
            className="w-full py-4 px-6 rounded-2xl font-display font-extrabold text-base bg-[#0DB87E] hover:bg-[#0ca36e] active:scale-[0.98] text-[#090A0C] shadow-lg shadow-[#0DB87E]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          {secondsRemaining > 0 && (
            <p className="text-[11px] font-mono text-white/40 mt-1">
              Acesso liberado. Avançando em {secondsRemaining}s...
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
