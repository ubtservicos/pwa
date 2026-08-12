import { useState, useEffect } from "react";

let globalDeferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent("ubt-beforeinstallprompt"));
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    };

    checkIOS();

    const handlePromptEvent = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    window.addEventListener("ubt-beforeinstallprompt", handlePromptEvent);

    return () => {
      window.removeEventListener("ubt-beforeinstallprompt", handlePromptEvent);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return "prompt_unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
    }
    return outcome;
  };

  return {
    showInstallBtn: !isStandalone,
    isStandalone,
    isIOS,
    hasNativePrompt: !!deferredPrompt,
    install
  };
}
