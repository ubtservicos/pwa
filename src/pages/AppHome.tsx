import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GuidedOnboarding from "@/components/app/GuidedOnboarding";
import {
  MapPin,
  Bike,
  ShoppingBag,
  Sparkles,
  Scissors,
  Waves,
  GraduationCap,
  Recycle,
  Clock,
  ChevronRight,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { setCurrentUid, useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES } from "@/lib/statusRules";

interface ServiceItem {
  label: string;
  Icon: LucideIcon;
  to?: string;
  available: boolean;
}

const services: ServiceItem[] = [
  { label: "Mototaxi", Icon: Bike, to: "/app/mototaxi", available: true },
  { label: "Ambulantes", Icon: ShoppingBag, to: "/app/ambulantes", available: true },
  { label: "Diaristas", Icon: Sparkles, to: "/app/diaristas", available: true },
  { label: "Côco & Cia", Icon: Recycle, to: "/app/coco", available: true },
  { label: "Beleza", Icon: Scissors, available: false },
  { label: "Praia", Icon: Waves, available: false },
  // { label: "Aulas", Icon: GraduationCap, available: false },
];

const AppHome = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user.role === "associacao") {
      navigate("/app/associacao/dashboard", { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    const onboarded = localStorage.getItem("ubt_onboarded_cliente");
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  // Load status rules and find rule for current user status
  const rules = getStatusRules();
  const activeRule = user.status && user.status !== "active" ? rules.find((r) => r.key === user.status) : null;
  const colors = activeRule ? (STATUS_THEMES[activeRule.theme] || STATUS_THEMES.Grey) : null;

  if (activeRule && activeRule.blockLogin) {
    return (
      <div
        className="min-h-[100svh] bg-[#0A1128] text-white flex flex-col items-center justify-center p-6 text-center"
        style={{ fontFamily: "DM Sans" }}
      >
        <div
          style={{
            padding: 24,
            borderRadius: "50%",
            background: colors?.bg || "rgba(232,64,64,0.15)",
            color: colors?.color || "#E84040",
            marginBottom: 24,
          }}
        >
          <AlertTriangle size={48} />
        </div>
        <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "white", marginBottom: 12 }}>
          Conta sob {activeRule.label}
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.70)", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
          Sua conta foi suspensa temporariamente sob a regra administrativa de <strong>{activeRule.label}</strong> do Superapp UBT.
        </p>

        {/* List of active blocks */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 28,
            textAlign: "left",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.50)", display: "block", marginBottom: 8 }}>
            Restrições de Conta Ativas:
          </span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "rgba(255,255,255,0.85)", display: "flex", flexDirection: "column", gap: 5 }}>
            {activeRule.blockLogin && <li>Bloqueio de acesso ao aplicativo</li>}
            {activeRule.blockRequests && <li>Bloqueio de solicitação de serviços</li>}
            {activeRule.blockChat && <li>Bloqueio de envio de mensagens no chat</li>}
            {activeRule.blockPayments && <li>Bloqueio de pagamentos e saques</li>}
            {activeRule.hideProfile && <li>Ocultação do perfil em pesquisas públicas</li>}
          </ul>
          {activeRule.durationDays && (
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 12 }}>
              Duração estimada: {activeRule.durationDays} dias
            </span>
          )}
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            background: colors?.color || "#E84040",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  const userName = user.name || "Visitante";
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="min-h-[100svh] bg-navy text-white overflow-y-auto"
      style={{ padding: "24px", paddingBottom: "96px" }}
    >
      {activeRule && (
        <div
          style={{
            background: colors?.bg || "rgba(245,166,35,0.1)",
            border: `1px solid ${colors?.border || "rgba(245,166,35,0.2)"}`,
            color: colors?.color || "#F5A623",
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            fontFamily: "DM Sans",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <AlertTriangle size={16} /> Atenção: Conta sob {activeRule.label}
          </div>
          <div>
            Sua conta está sob o status <strong>{activeRule.label}</strong>.
            As seguintes restrições estão ativas para você:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {activeRule.blockRequests && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Solicitar serviços</span>}
            {activeRule.blockChat && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Chat e mensagens</span>}
            {activeRule.blockPayments && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Pagamentos/Saques</span>}
            {activeRule.hideProfile && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Perfil oculto</span>}
          </div>
        </div>
      )}
      {/* Dev profile switcher */}
      <div className="mb-3 flex items-center gap-2">
        <span className="font-sans text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
          Logado como:
        </span>
        <span
          className="px-2 py-1 rounded-full font-sans text-[10px]"
          style={{
            background: "#0DB87E",
            color: "#fff",
          }}
        >
          {user.role}
        </span>
      </div>
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[20px] font-bold text-white">
            Olá, {userName.split(" ")[0]} 👋
          </h1>
          <div
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <MapPin size={14} style={{ color: "#0DB87E" }} />
            <span
              className="font-sans text-[13px]"
              style={{ color: "rgba(255,255,255,0.70)" }}
            >
              Ubatuba, SP
            </span>
          </div>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(13,184,126,0.15)" }}
        >
          <span
            className="font-display text-[14px] font-bold"
            style={{ color: "#0DB87E" }}
          >
            {initials}
          </span>
        </div>
      </header>

      {/* Toggle Tomador/Prestador no Topo */}
      <section className="mt-5 flex">
        <div
          className="inline-flex items-center rounded-full p-1 w-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            className="rounded-full font-display text-[13px] font-semibold text-white flex-1 shadow-sm"
            style={{
              background: "#0DB87E",
              padding: "8px 0",
            }}
          >
            Tomador
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/prestador/home")}
            className="font-sans text-[13px] flex-1"
            style={{
              color: "rgba(255,255,255,0.45)",
              padding: "8px 0",
            }}
          >
            Prestador
          </button>
        </div>
      </section>

      {/* Services */}
      <section className="mt-7">
        <p
          className="font-sans text-[11px] font-semibold uppercase"
          style={{
            color: "rgba(255,255,255,0.40)",
            letterSpacing: "1.5px",
          }}
        >
          O que você precisa?
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {services.map(({ label, Icon, to, available }) => (
            <button
              key={label}
              type="button"
              disabled={!available}
              onClick={() => {
                if (activeRule && activeRule.blockRequests) {
                  alert(`Solicitação de serviços bloqueada devido ao status: ${activeRule.label}`);
                  return;
                }
                available && to && navigate(to);
              }}
              className="relative flex flex-col items-center gap-2 rounded-2xl transition-transform active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "16px 12px",
                opacity: available ? 1 : 0.4,
                cursor: available ? "pointer" : "not-allowed",
              }}
            >
              {!available && (
                <span
                  className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full font-sans text-[9px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  Em breve
                </span>
              )}
              <span
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(13,184,126,0.12)" }}
              >
                <Icon size={24} style={{ color: "#0DB87E" }} />
              </span>
              <span className="font-sans text-[12px] font-medium text-white">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>


      {/* Pedidos em Andamento */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <p
            className="font-sans text-[11px] font-semibold uppercase"
            style={{
              color: "rgba(255,255,255,0.40)",
              letterSpacing: "1.5px",
            }}
          >
            Pedidos em Andamento
          </p>
          <button style={{ background: "none", border: "none", color: "#0DB87E", fontSize: 12, fontFamily: "DM Sans", cursor: "pointer" }}>
            Ver todos
          </button>
        </div>
        
        <div className="mt-4 flex flex-col gap-3">
          {/* Mockup de Pedido - Isso valeria para qualquer categoria */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={14} color="#0DB87E" />
                </div>
                <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "white" }}>Diarista</span>
              </div>
              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(243,156,18,0.15)", color: "#F39C12", fontSize: 10, fontFamily: "DM Sans", fontWeight: 600 }}>Aguardando Confirmação</span>
            </div>
            
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 4px 0" }}>Maria Silva</p>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={12} color="rgba(255,255,255,0.4)" />
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Qua, 20/05 às 08:00</span>
            </div>

            <button style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "white", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
              Acompanhar Pedido <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
            </button>
          </div>
        </div>
      </section>
      
      {showOnboarding && (
        <GuidedOnboarding
          role="cliente"
          onClose={() => {
            localStorage.setItem("ubt_onboarded_cliente", "true");
            setShowOnboarding(false);
          }}
        />
      )}
    </div>
  );
};

export default AppHome;
