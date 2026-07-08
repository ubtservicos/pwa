import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import PrimaryButton from "./PrimaryButton";

interface BiometriaModalProps {
  open: boolean;
  onActivate: () => void;
  onSkip: () => void;
}

const BiometriaModal = ({ open, onActivate, onSkip }: BiometriaModalProps) => {
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) setRender(true);
    else {
      const t = setTimeout(() => setRender(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!render) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background: "rgba(0,0,0,0.60)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onSkip}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-navy-2 rounded-t-3xl pt-3 px-6 pb-12 transform transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-7" />
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
          style={{ background: "hsl(var(--green) / 0.12)" }}
        >
          <Fingerprint size={40} className="text-green" />
        </div>
        <h2 className="font-display font-bold text-[22px] text-white text-center mt-5">
          Login mais rápido
        </h2>
        <p className="font-sans text-sm text-white/65 text-center mt-2">
          Ative a biometria para entrar com 1 toque. Seus dados nunca saem do seu aparelho.
        </p>
        <div className="mt-7">
          <PrimaryButton onClick={onActivate}>Ativar agora</PrimaryButton>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="block mx-auto mt-3.5 font-sans text-sm text-white/45 hover:text-white/70"
        >
          Agora não
        </button>
      </div>
    </div>
  );
};

export default BiometriaModal;
