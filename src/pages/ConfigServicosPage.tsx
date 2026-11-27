import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, Car, Info, ShoppingBag, Sparkles, Scissors, Waves, GraduationCap, Settings } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SettingsToggle from "@/components/settings/SettingsToggle";
import SettingsRow from "@/components/settings/SettingsRow";
import BottomSheet from "@/components/settings/BottomSheet";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { supabase } from "@/lib/supabase";
import { isVerticalEnabled } from "@/config/verticalFlags";

const FUTURE = [
  { key: "beleza", label: "Beleza", icon: Scissors },
  { key: "surf", label: "Surf", icon: Waves },
  { key: "aulas", label: "Aulas", icon: GraduationCap },
];

const ConfigServicosPage = () => {
  const t = useTheme();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();
  const [motoActive, setMotoActive] = useState(false);
  const [carroActive, setCarroActive] = useState(false);
  const [showDesativar, setShowDesativar] = useState(false);
  const [showDesativarCarro, setShowDesativarCarro] = useState(false);

  useEffect(() => {
    if (user.uid) {
      const isApproved = user.kycStatus === "approved";
      const isActive = user.mototaxiActive !== false;
      setMotoActive(isApproved && isActive);

      const isCarroApproved = user.carroKycStatus === "approved";
      const isCarroActive = user.carroActive !== false;
      setCarroActive(isCarroApproved && isCarroActive);
    }
  }, [user.uid, user.kycStatus, user.mototaxiActive, user.carroKycStatus, user.carroActive]);

  const handleCarroToggle = async (v: boolean) => {
    if (v && user.carroKycStatus !== "approved") {
      navigate("/app/prestador/carros/onboarding");
    } else if (!v) {
      setShowDesativarCarro(true);
    } else {
      setCarroActive(true);
      try {
        await supabase.auth.updateUser({ data: { carro_active: true } });
        showToast("Carros ativado ✓");
      } catch (e) {
        console.error(e);
        showToast("Erro ao ativar Carros");
      }
    }
  };

  const handleDesativarCarro = async () => {
    setCarroActive(false);
    setShowDesativarCarro(false);
    try {
      await supabase.auth.updateUser({ data: { carro_active: false } });
      showToast("Carros desativado ✓");
    } catch (e) {
      console.error(e);
      showToast("Erro ao desativar Carros");
    }
  };

  const handleMotoToggle = async (v: boolean) => {
    if (v && user.kycStatus !== "approved") {
      navigate("/app/prestador/mototaxi/onboarding");
    } else if (!v) {
      setShowDesativar(true);
    } else {
      setMotoActive(true);
      try {
        await supabase.auth.updateUser({
          data: { mototaxi_active: true }
        });
        showToast("Mototaxi ativado ✓");
      } catch (e) {
        console.error(e);
        showToast("Erro ao ativar");
      }
    }
  };

  const handleDesativar = async () => {
    setMotoActive(false);
    setShowDesativar(false);
    try {
      await supabase.auth.updateUser({
        data: { mototaxi_active: false }
      });
      showToast("Mototaxi desativado ✓");
    } catch (e) {
      console.error(e);
      showToast("Erro ao desativar");
    }
  };

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Serviços que Presto" onBack={() => navigate("/app/config")} />

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
          <Info size={16} color="#F5A623" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0 }}>
            Ative os serviços que deseja oferecer. Cada categoria pode exigir documentos adicionais.
          </p>
        </div>

        <SettingsGroup>
          <SettingsToggle
            icon={Bike}
            label="Mototaxi"
            subtitle={motoActive ? "Ativo · KYC aprovado ✓" : "Toque para configurar"}
            value={motoActive}
            onChange={handleMotoToggle}
            isLast={!motoActive}
          />
          {motoActive && (
            <SettingsRow
              icon={Settings}
              label="Configurar Veículo e CNH"
              subtitle="Editar placa, sexo e modalidade"
              onClick={() => navigate("/app/prestador/mototaxi/onboarding")}
              isLast={true}
            />
          )}
        </SettingsGroup>

        {isVerticalEnabled("carros") && (
          <SettingsGroup>
            <SettingsToggle
              icon={Car}
              label="Carros"
              subtitle={
                carroActive
                  ? "Ativo · KYC aprovado ✓"
                  : user.carroKycStatus === "pending"
                    ? "Documentação em análise"
                    : "Toque para configurar"
              }
              value={carroActive}
              onChange={handleCarroToggle}
              isLast={!carroActive && user.carroKycStatus !== "pending"}
            />
            {(carroActive || user.carroKycStatus === "pending") && (
              <SettingsRow
                icon={Settings}
                label="Configurar Carro e CNH"
                subtitle="Editar placa, modelo, atributos e documentos"
                onClick={() => navigate("/app/prestador/carros/onboarding")}
                isLast={true}
              />
            )}
          </SettingsGroup>
        )}

        {isVerticalEnabled("ambulantes") && (
          <SettingsGroup>
            <SettingsRow
              icon={ShoppingBag}
              label="Ambulantes"
              subtitle="Documentação e alvará de praia"
              onClick={() => navigate("/app/prestador/ambulantes/onboarding")}
            />
            <SettingsRow
              icon={ShoppingBag}
              label="Cardápio & Estoque Diário"
              subtitle="Definir quantidades do carrinho na praia"
              onClick={() => navigate("/app/prestador/ambulantes/cardapio")}
              isLast
            />
          </SettingsGroup>
        )}

        {isVerticalEnabled("diaristas") && (
          <SettingsGroup>
            <SettingsRow
              icon={Sparkles}
              label="Diaristas"
              subtitle="Agenda de serviços de limpeza"
              onClick={() => {
                const has = (() => { try { return localStorage.getItem(`diarista_perfil_${user.uid}`) === "1"; } catch { return false; } })();
                navigate(has ? "/app/prestador/diaristas/agenda" : "/app/prestador/diaristas/onboarding");
              }}
              isLast={false}
            />
            <SettingsRow
              icon={Settings}
              label="Configurar Valores e Kit"
              subtitle="Ajuste seus preços por m², produtos e disponibilidade"
              onClick={() => navigate("/app/prestador/diaristas/onboarding")}
              isLast={true}
            />
          </SettingsGroup>
        )}

        {FUTURE.map(({ key, label, icon: Icon }) => (
          <div key={key} style={{ opacity: 0.5, pointerEvents: "none" }}>
            <SettingsGroup>
              <SettingsRow
                icon={Icon}
                label={label}
                subtitle="Em breve"
                onClick={() => {}}
                rightElement={
                  <span
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 10,
                      fontWeight: 600,
                      color: t.muted,
                      background: t.border,
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Em breve
                  </span>
                }
                isLast
              />
            </SettingsGroup>
          </div>
        ))}
      </div>

      <BottomSheet open={showDesativar} onClose={() => setShowDesativar(false)}>
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
          Desativar Mototaxi?
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
          Você não receberá mais novos chamados.
        </p>
        <button
          type="button"
          onClick={handleDesativar}
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
          Desativar
        </button>
        <button
          type="button"
          onClick={() => setShowDesativar(false)}
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

      <BottomSheet open={showDesativarCarro} onClose={() => setShowDesativarCarro(false)}>
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
          Desativar Carros?
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
          Você não receberá mais novos chamados de Carros.
        </p>
        <button
          type="button"
          onClick={handleDesativarCarro}
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
          Desativar
        </button>
        <button
          type="button"
          onClick={() => setShowDesativarCarro(false)}
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

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigServicosPage;
