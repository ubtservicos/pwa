import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Wallet,
  Accessibility,
  Bell,
  HelpCircle,
  LogOut,
  Recycle,
  Bike,
  ShoppingBag,
  Sparkles,
  Smartphone,
  Download,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SettingsRow from "@/components/settings/SettingsRow";
import SectionHeader from "@/components/settings/SectionHeader";
import BottomSheet from "@/components/settings/BottomSheet";
import { supabase } from "@/lib/supabase";


const ConfigIndexPage = () => {
  const t = useTheme();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setShowInstallBtn(false);
    } else {
      // Display install option if not already standalone
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("Para instalar a UBT no seu iPhone/iPad:\n1. Toque no botão de Compartilhar (ícone com quadrado e seta para cima) no rodapé do Safari.\n2. Role as opções e toque em 'Adicionar à Tela de Início'. 📲");
      return;
    }
    if (!deferredPrompt) {
      alert("Para instalar a UBT:\n1. Clique no ícone de instalar na barra de endereços do navegador (ou no menu de 3 pontinhos).\n2. Selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'. 📲");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isPrestadorUser =
    ["prestador", "cocoecia", "cocoecia-colaborador", "cocoecia-dirigentes", "admin"].includes(user.role) ||
    user.kycStatus === "approved" ||
    (() => {
      try {
        return (
          localStorage.getItem(`diarista_perfil_${user.uid}`) === "1" ||
          localStorage.getItem(`amb_session_${user.uid}`) === "1" ||
          !!localStorage.getItem("caminhaoId")
        );
      } catch {
        return false;
      }
    })();

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "20px 24px 96px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>
            Configurações
          </h1>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "rgba(13,184,126,0.15)",
              border: "2px solid #0DB87E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 700,
              color: "#0DB87E",
            }}
          >
            {initials}
          </div>
        </div>

        <SectionHeader>Geral</SectionHeader>
        <SettingsGroup>
          <SettingsRow
            icon={User}
            label="Perfil"
            subtitle={user.name}
            onClick={() => navigate("/app/config/perfil")}
          />
          <SettingsRow
            icon={Wallet}
            label="Financeiro"
            subtitle="Pix · Cartões · Split"
            onClick={() => navigate("/app/config/financeiro")}
            isLast
          />
        </SettingsGroup>

        {isPrestadorUser && (
          <>
            <SectionHeader>Categorias</SectionHeader>
            <SettingsGroup>
              <SettingsRow
                icon={Recycle}
                label="Côco & Cia"
                subtitle="Regiões, doações e equipe"
                onClick={() => navigate("/app/config/coco")}
              />
              <SettingsRow
                icon={Bike}
                label="Mototaxi"
                subtitle="Corrida e KYC"
                onClick={() => navigate("/app/config/servicos")}
              />
              <SettingsRow
                icon={ShoppingBag}
                label="Ambulantes"
                subtitle="Cardápio e vendas"
                onClick={() => navigate("/app/prestador/ambulantes/onboarding")}
              />
              <SettingsRow
                icon={Sparkles}
                label="Diaristas"
                subtitle="Valores, kit e agenda de limpeza"
                onClick={() => {
                  const has = (() => {
                    try {
                      return localStorage.getItem(`diarista_perfil_${user.uid}`) === "1";
                    } catch {
                      return false;
                    }
                  })();
                  navigate(has ? "/app/prestador/diaristas/agenda" : "/app/prestador/diaristas/onboarding");
                }}
                isLast
              />
            </SettingsGroup>
          </>
        )}

        <SectionHeader>Sistema</SectionHeader>
        <SettingsGroup>
          {showInstallBtn && (
            <SettingsRow
              icon={Smartphone}
              label="Instalar Aplicativo UBT"
              subtitle="Salve o atalho no seu celular com o logo oficial"
              onClick={handleInstallClick}
            />
          )}
          <SettingsRow
            icon={Accessibility}
            label="Acessibilidade"
            subtitle="Fonte · Tema"
            onClick={() => navigate("/app/config/acessibilidade")}
          />
          <SettingsRow
            icon={Bell}
            label="Notificações"
            subtitle="Chamados · Sorteios · Comunidade"
            onClick={() => navigate("/app/config/notificacoes")}
          />
          <SettingsRow
            icon={HelpCircle}
            label="Ajuda & Sobre"
            onClick={() => navigate("/app/config/ajuda")}
            isLast
          />
        </SettingsGroup>

        <button
          type="button"
          onClick={() => setShowLogout(true)}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: 14,
            background: "rgba(232,64,64,0.08)",
            border: "1px solid rgba(232,64,64,0.20)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            cursor: "pointer",
            marginTop: 16,
          }}
        >
          <LogOut size={18} color="#E84040" />
          <span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 500, color: "#E84040" }}>
            Sair da conta
          </span>
        </button>
      </div>

      <BottomSheet open={showLogout} onClose={() => setShowLogout(false)}>
        <h2
          style={{
            fontFamily: "Syne",
            fontSize: 18,
            fontWeight: 700,
            color: t.text,
            textAlign: "center",
            margin: 0,
          }}
        >
          Sair da conta?
        </h2>
        <p
          style={{
            fontFamily: "DM Sans",
            fontSize: 14,
            color: t.subtle,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          Você precisará fazer login novamente.
        </p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            localStorage.clear();
            navigate("/login");
          }}
          style={{
            marginTop: 28,
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#E84040",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
        <button
          type="button"
          onClick={() => setShowLogout(false)}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "transparent",
            color: t.text,
            border: `1px solid ${t.border}`,
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </BottomSheet>
    </div>
  );
};

export default ConfigIndexPage;

