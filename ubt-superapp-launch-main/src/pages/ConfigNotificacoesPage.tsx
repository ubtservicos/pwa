import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Bike, CheckCircle, Navigation, Gift, Sparkles, Users, BarChart2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import SettingsToggle from "@/components/settings/SettingsToggle";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

const ConfigNotificacoesPage = () => {
  const t = useTheme();
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();
  const [notif, setNotif] = useState({
    chamados: true,
    confirmacao: true,
    status: true,
    sorteios: true,
    promocoes: false,
    comunidade: true,
    saldo: false,
  });

  const toggle = (key: keyof typeof notif) =>
    setNotif((n) => ({ ...n, [key]: !n[key] }));

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Notificações" onBack={() => navigate("/app/config")} />

        <div
          style={{
            background: "rgba(245,166,35,0.08)",
            border: "1px solid rgba(245,166,35,0.25)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            gap: 10,
            marginBottom: 20,
            marginTop: 8,
          }}
        >
          <Bell size={16} color="#F5A623" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0 }}>
            Ative as notificações nas configurações do seu celular para recebê-las.
          </p>
        </div>

        <SectionHeader>SERVIÇOS</SectionHeader>
        <SettingsGroup>
          <SettingsToggle
            icon={Bike}
            label="Novos chamados"
            subtitle="Quando um cliente solicitar seu serviço"
            value={notif.chamados}
            onChange={() => toggle("chamados")}
          />
          <SettingsToggle
            icon={CheckCircle}
            label="Confirmação de pedido"
            subtitle="Quando um prestador aceitar"
            value={notif.confirmacao}
            onChange={() => toggle("confirmacao")}
          />
          <SettingsToggle
            icon={Navigation}
            label="Atualizações de status"
            subtitle="Em andamento, concluído, etc."
            value={notif.status}
            onChange={() => toggle("status")}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>PROMOÇÕES E SORTEIOS</SectionHeader>
        </div>
        <SettingsGroup>
          <SettingsToggle
            icon={Gift}
            label="Sorteios UBT"
            value={notif.sorteios}
            onChange={() => toggle("sorteios")}
          />
          <SettingsToggle
            icon={Sparkles}
            label="Promoções e novidades"
            subtitle="Ofertas e lançamentos"
            value={notif.promocoes}
            onChange={() => toggle("promocoes")}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>COMUNIDADE</SectionHeader>
        </div>
        <SettingsGroup>
          <SettingsToggle
            icon={Users}
            label="Avisos da comunidade"
            value={notif.comunidade}
            onChange={() => toggle("comunidade")}
          />
          <SettingsToggle
            icon={BarChart2}
            label="Saldo da comunidade"
            value={notif.saldo}
            onChange={() => toggle("saldo")}
            isLast
          />
        </SettingsGroup>

        <button
          type="button"
          onClick={() => showToast("Preferências salvas!")}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#0DB87E",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 24,
          }}
        >
          Salvar preferências
        </button>
      </div>
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigNotificacoesPage;
