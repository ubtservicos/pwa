import { useState, useEffect } from "react";
import { ArrowRight, Check, X, Shield, Smartphone, Bike, Sparkles, Recycle, ArrowUpFromLine } from "lucide-react";
import { trackEvent } from "@/services/AnalyticsService";

interface GuidedOnboardingProps {
  role: "cliente" | "prestador";
  onClose: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: any;
  iconColor: string;
}

export default function GuidedOnboarding({ role, onClose }: GuidedOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  // Monitorar suporte nativo a instalacao PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detectar se eh iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Enviar evento de inicio do onboarding
    trackEvent("onboarding_started", { role });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [role]);

  // Conteudos baseados no papel (role) do usuario
  const steps: Step[] = role === "cliente"
    ? [
        {
          title: "Bem-vindo ao UBT SuperApp! 🌊",
          description: "O aplicativo completo oficial para os moradores e turistas de Ubatuba-SP. Tudo o que você precisa em um só lugar.",
          icon: Shield,
          iconColor: "#0DB87E"
        },
        {
          title: "Mototáxi Exclusivo 🛵",
          description: "Precisa se deslocar rapidamente pelas praias ou centro? Peça uma corrida de moto em tempo real com motoristas homologados.",
          icon: Bike,
          iconColor: "#2B6EE8"
        },
        {
          title: "Ubatuba Limpa com a Côco & Cia 🌱",
          description: "Descarte seus recicláveis de maneira correta! Marque um ponto de coleta de descarte no mapa e os caminhões da Côco & Cia vão buscar.",
          icon: Recycle,
          iconColor: "#10B981"
        },
        {
          title: "Diaristas Certificadas 🧹",
          description: "Agende serviços de limpeza doméstica com profissionais locais. Selecione o tamanho da casa, data e agende com segurança.",
          icon: Sparkles,
          iconColor: "#F5A623"
        },
        {
          title: "Instale o UBT na Tela Inicial 📱",
          description: "Instale nosso aplicativo em seu smartphone para desfrutar de acesso ultra-rápido, consumo de dados reduzido e recursos offline.",
          icon: Smartphone,
          iconColor: "#9333EA"
        }
      ]
    : [
        {
          title: "Painel do Prestador UBT 💼",
          description: "Seja bem-vindo à nossa plataforma! Aqui você gerencia seus chamados operacionais e lucra prestando serviços em Ubatuba.",
          icon: Shield,
          iconColor: "#0DB87E"
        },
        {
          title: "Ficar Online e Receber Chamados 🎯",
          description: "Ative a sua localização em tempo real para ficar disponível e começar a receber corridas de mototáxi ou coletas recicláveis.",
          icon: Bike,
          iconColor: "#2B6EE8"
        },
        {
          title: "Controle Financeiro e Saques Pix 💵",
          description: "Acompanhe todo o seu faturamento diário detalhado e solicite saques Pix imediatos a qualquer momento na aba financeira.",
          icon: Sparkles,
          iconColor: "#F5A623"
        },
        {
          title: "Instale o App do Prestador 📱",
          description: "Instalar o aplicativo na tela inicial do celular garante que você receba notificações instantâneas e não perca nenhum chamado.",
          icon: Smartphone,
          iconColor: "#9333EA"
        }
      ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      
      // Se a proxima tela for a de PWA, envia metadados de prompt
      if (next === steps.length - 1) {
        trackEvent("pwa_install_prompted", { role });
      }
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    trackEvent("onboarding_completed", { role });
    onClose();
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        trackEvent("pwa_installed", { role });
        setDeferredPrompt(null);
      }
    }
  };

  const activeStep = steps[currentStep];
  const StepIcon = activeStep.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,27,62,0.92)",
        backdropFilter: "blur(12px)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        style={{
          background: "#132348",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          width: "100%",
          maxWidth: 440,
          padding: 32,
          position: "relative",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          textAlign: "center",
          animation: "ubt-bounceIn 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}
      >
        {/* Skip button */}
        <button
          onClick={handleFinish}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "rgba(255,255,255,0.05)",
            border: "none",
            borderRadius: 99,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "rgba(255,255,255,0.60)"
          }}
          aria-label="Pular tutorial"
        >
          <X size={16} />
        </button>

        {/* Dynamic Step Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: `${activeStep.iconColor}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "12px auto 24px",
            border: `1.5px solid ${activeStep.iconColor}40`
          }}
        >
          <StepIcon size={38} color={activeStep.iconColor} />
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily: "Syne",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 12,
            lineHeight: 1.2
          }}
        >
          {activeStep.title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontFamily: "DM Sans",
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.65)",
            marginBottom: 32,
            minHeight: 80
          }}
        >
          {activeStep.description}
        </p>

        {/* PWA Guided Install Box if last step */}
        {isLastStep && (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 32,
              textAlign: "left"
            }}
          >
            {isIOS ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ background: "rgba(255,255,255,0.1)", padding: 10, borderRadius: 10, color: "#fff" }}>
                  <ArrowUpFromLine size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Instrução para iOS</h4>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", margin: "2px 0 0" }}>
                    Toque em Compartilhar e selecione &quot;Adicionar à Tela de Início&quot;.
                  </p>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleInstallPWA}
                  style={{
                    background: "#9333EA",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontFamily: "DM Sans",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)"
                  }}
                >
                  Instalar Aplicativo Nativo
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ background: "rgba(13,184,126,0.1)", padding: 10, borderRadius: 10, color: "#0DB87E" }}>
                  <Check size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Aplicativo Pronto!</h4>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", margin: "2px 0 0" }}>
                    Abra o menu do navegador e toque em &quot;Instalar aplicativo&quot; para adicionar à tela inicial.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Indicator dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
          {steps.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: currentStep === idx ? 20 : 6,
                height: 6,
                borderRadius: 99,
                background: currentStep === idx ? activeStep.iconColor : "rgba(255,255,255,0.15)",
                transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: activeStep.iconColor,
            color: "#fff",
            fontFamily: "Syne",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: `0 8px 24px -6px ${activeStep.iconColor}60`,
            transition: "transform 150ms active:scale-98"
          }}
        >
          {isLastStep ? (
            <>
              Entendi e Concluir <Check size={18} />
            </>
          ) : (
            <>
              Avançar <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes ubt-bounceIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
