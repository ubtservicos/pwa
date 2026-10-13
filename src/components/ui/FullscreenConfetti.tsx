import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Confetti from "react-confetti";

interface FullscreenConfettiProps {
  numberOfPieces?: number;
  recycle?: boolean;
}

export function FullscreenConfetti({ numberOfPieces = 250, recycle = false }: FullscreenConfettiProps) {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 720 : window.innerHeight,
  }));

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <Confetti
      width={viewport.width}
      height={viewport.height}
      numberOfPieces={numberOfPieces}
      recycle={recycle}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    />,
    document.body
  );
}
