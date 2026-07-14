import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import SettingsToggle from "@/components/settings/SettingsToggle";

type ThemeChoice = "auto" | "light" | "dark";

const FONT_LABELS = ["Muito pequena", "Pequena", "Normal", "Grande", "Muito grande"];

const ConfigAcessibilidadePage = () => {
  const t = useTheme();
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<ThemeChoice>("auto");
  const [followSystem, setFollowSystem] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--base-font-size", `${fontSize}px`);
  }, [fontSize]);

  const renderThemeCard = (choice: ThemeChoice, label: string, sub?: string) => {
    const selected = theme === choice;
    return (
      <button
        key={choice}
        type="button"
        onClick={() => setTheme(choice)}
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          border: `2px solid ${selected ? "#0DB87E" : t.border}`,
          background: t.surface,
          padding: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ position: "relative", height: 72, overflow: "hidden" }}>
          {choice === "light" && (
            <div style={{ width: "100%", height: "100%", background: "#F7F8FA", padding: 6 }}>
              <div style={{ height: 10, background: "#EFF0F3", borderRadius: 3, marginBottom: 6 }} />
              <div style={{ height: 6, background: "#D8DBE5", borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 6, background: "#D8DBE5", borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 6, background: "#D8DBE5", borderRadius: 3, width: "70%" }} />
            </div>
          )}
          {choice === "dark" && (
            <div style={{ width: "100%", height: "100%", background: "#0B1B3E", padding: 6 }}>
              <div style={{ height: 10, background: "#132348", borderRadius: 3, marginBottom: 6 }} />
              <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: "70%" }} />
            </div>
          )}
          {choice === "auto" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(135deg, #F7F8FA 0%, #F7F8FA 49%, #0B1B3E 51%, #0B1B3E 100%)",
              }}
            />
          )}
          {selected && (
            <div style={{ position: "absolute", top: 6, right: 6 }}>
              <CheckCircle size={16} color="#0DB87E" fill="#FFF" />
            </div>
          )}
        </div>
        <div style={{ padding: "8px 6px" }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: t.text }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontFamily: "DM Sans", fontSize: 10, color: t.muted, marginTop: 2 }}>
              {sub}
            </div>
          )}
        </div>
      </button>
    );
  };

  const sliderIdx = Math.round((fontSize - 12) / 2);

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Acessibilidade" onBack={() => navigate("/app/config")} />

        <SectionHeader>TAMANHO DA FONTE</SectionHeader>
        <SettingsGroup>
          <div style={{ padding: 20 }}>
            <div
              style={{
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: fontSize * 2,
                color: t.text,
                textAlign: "center",
                margin: "8px 0 24px",
              }}
            >
              Aa
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 8 }}>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.max(12, f - 2))}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  color: t.subtle,
                  cursor: "pointer",
                }}
              >
                A−
              </button>
              <input
                type="range"
                min={12}
                max={20}
                step={2}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#0DB87E" }}
              />
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.min(20, f + 2))}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "DM Sans",
                  fontSize: 18,
                  color: t.subtle,
                  cursor: "pointer",
                }}
              >
                A+
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px" }}>
              {FONT_LABELS.map((l, i) => (
                <span
                  key={l}
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 10,
                    color: i === sliderIdx ? "#0DB87E" : t.muted,
                    fontWeight: i === sliderIdx ? 600 : 400,
                  }}
                >
                  {l.split(" ")[0]}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted, marginTop: 12, marginBottom: 0 }}>
              Afeta todo o texto do aplicativo
            </p>
          </div>
        </SettingsGroup>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>TEMA DO APLICATIVO</SectionHeader>
        </div>
        <SettingsGroup>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {renderThemeCard("light", "Claro")}
              {renderThemeCard("dark", "Escuro")}
              {renderThemeCard("auto", "Auto", "Segue perfil")}
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsToggle
            icon={CheckCircle}
            label="Seguir preferência do sistema"
            subtitle="Usa a configuração do seu celular"
            value={followSystem}
            onChange={setFollowSystem}
            isLast
          />
        </SettingsGroup>
      </div>
    </div>
  );
};

export default ConfigAcessibilidadePage;
