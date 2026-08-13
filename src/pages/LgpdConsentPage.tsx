import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

const REQUIRED_VERSIONS = {
  terms: "terms_v1",
  privacy: "privacy_v1",
  cookies: "cookies_v1",
};

export default function LgpdConsentPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user.role === "associacao") {
      navigate("/app/associacao/dashboard", { replace: true });
    }
  }, [user.role, navigate]);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptCookies, setAcceptCookies] = useState(false);
  const [saving, setSaving] = useState(false);

  // Accordion states
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleAcceptAll = async () => {
    if (!acceptTerms || !acceptPrivacy || !acceptCookies || !user.uid) return;
    try {
      setSaving(true);

      // Previne erro 23503 (Foreign Key Constraint) realizando um upsert do usuário logado com dados básicos
      const { error: upsertError } = await supabase.from("usuarios").upsert({
        id: user.uid,
        nome: user.name || "Usuário UBT",
        role: user.role || "tomador",
        status: "active",
      }, { onConflict: "id" });

      if (upsertError) {
        console.error("Erro no upsert de usuarios na pagina lgpd:", upsertError);
        throw upsertError;
      }

      const consentsToInsert = [
        {
          user_id: user.uid,
          document_type: "terms",
          document_version: REQUIRED_VERSIONS.terms,
        },
        {
          user_id: user.uid,
          document_type: "privacy",
          document_version: REQUIRED_VERSIONS.privacy,
        },
        {
          user_id: user.uid,
          document_type: "cookies",
          document_version: REQUIRED_VERSIONS.cookies,
        },
      ];

      const { error } = await supabase.from("user_consents").insert(consentsToInsert);
      if (error) throw error;

      // Update session cache
      sessionStorage.setItem(`ubt_lgpd_verified_${user.uid}`, "true");
      
      // Go to app homepage
      navigate("/app/home", { replace: true });
    } catch (err) {
      console.error("Erro ao salvar consentimentos LGPD:", err);
      alert("Erro ao gravar aceites. Por favor, tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div
      className="min-h-[100svh] bg-[#09090B] text-white flex flex-col p-6 pb-32"
      style={{ fontFamily: "DM Sans" }}
    >
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <ShieldCheck size={28} color="#00FF66" />
          <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }}>Privacidade UBT</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#E84040",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <LogOut size={14} /> Sair
        </button>
      </header>

      {/* Intro */}
      <div className="mb-6">
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Atualização de Termos
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          Olá, <strong>{user.name.split(" ")[0]}</strong>. Para continuarmos oferecendo segurança e transparência na prestação de serviços em Ubatuba, por favor leia e dê seu consentimento sobre os novos documentos regulatórios:
        </p>
      </div>

      {/* Accordions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        
        {/* Termos de Uso */}
        <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 12, overflow: "hidden" }}>
          <button
            onClick={() => toggleSection("terms")}
            style={{
              width: "100%",
              padding: 16,
              background: "none",
              border: "none",
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <span>1. Termos de Uso (v1)</span>
            {openSection === "terms" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openSection === "terms" && (
            <div style={{ padding: "0 16px 16px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxHeight: 200, overflowY: "auto", borderTop: "1px solid #27272A" }}>
              <p>Estes Termos de Uso regem o acesso e uso do UBT SuperApp no município de Ubatuba, SP. Ao aceitar, você concorda que:</p>
              <ul>
                <li>O UBT atua como intermediador entre prestadores de serviço e clientes.</li>
                <li>As corridas de mototáxi exigem conduta defensiva e uso obrigatório de capacete.</li>
                <li>Os pagamentos e estornos seguem os critérios das políticas de cancelamento descritas no backoffice.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Politica de Privacidade */}
        <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 12, overflow: "hidden" }}>
          <button
            onClick={() => toggleSection("privacy")}
            style={{
              width: "100%",
              padding: 16,
              background: "none",
              border: "none",
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <span>2. Política de Privacidade (v1)</span>
            {openSection === "privacy" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openSection === "privacy" && (
            <div style={{ padding: "0 16px 16px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxHeight: 200, overflowY: "auto", borderTop: "1px solid #27272A" }}>
              <p>Nossa Política de Privacidade detalha como coletamos e protegemos seus dados locacionais e cadastrais sob a LGPD:</p>
              <ul>
                <li>Sua geolocalização é rastreada apenas em serviço ativo para fins de segurança e antifraude.</li>
                <li>Coordenadas de telemetria raw são retidas por 30 dias e deletadas permanentemente.</li>
                <li>Você possui o direito de exportação JSON e anonimização de sua conta (Artigo 18 LGPD) na aba de configurações.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Politica de Cookies */}
        <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 12, overflow: "hidden" }}>
          <button
            onClick={() => toggleSection("cookies")}
            style={{
              width: "100%",
              padding: 16,
              background: "none",
              border: "none",
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <span>3. Política de Cookies (v1)</span>
            {openSection === "cookies" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openSection === "cookies" && (
            <div style={{ padding: "0 16px 16px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxHeight: 200, overflowY: "auto", borderTop: "1px solid #27272A" }}>
              <p>Utilizamos cookies estritamente necessários para manter sua sessão de login conectada de forma criptografada no navegador:</p>
              <ul>
                <li>Cookies de segurança para autenticação via tokens JWT no Supabase Auth.</li>
                <li>Cookies de acessibilidade e preferências de tema visual.</li>
                <li>Não compartilhamos dados de navegação ou cookies com bureaus de marketing de terceiros.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Checkboxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#00FF66", cursor: "pointer" }}
          />
          <span>Li e aceito os <strong>Termos de Uso</strong></span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#00FF66", cursor: "pointer" }}
          />
          <span>Li e aceito a <strong>Política de Privacidade</strong></span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={acceptCookies}
            onChange={(e) => setAcceptCookies(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#00FF66", cursor: "pointer" }}
          />
          <span>Li e aceito a <strong>Política de Cookies</strong></span>
        </label>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleAcceptAll}
        disabled={!acceptTerms || !acceptPrivacy || !acceptCookies || saving}
        style={{
          width: "100%",
          height: 52,
          background: acceptTerms && acceptPrivacy && acceptCookies ? "#00FF66" : "rgba(255,255,255,0.06)",
          color: acceptTerms && acceptPrivacy && acceptCookies ? "#09090B" : "rgba(255,255,255,0.30)",
          border: "none",
          borderRadius: 14,
          fontFamily: "Syne",
          fontSize: 16,
          fontWeight: 700,
          cursor: acceptTerms && acceptPrivacy && acceptCookies ? "pointer" : "not-allowed",
          transition: "all 300ms ease",
          marginTop: "auto",
        }}
      >
        {saving ? "Salvando aceites..." : "Aceitar e Continuar"}
      </button>
    </div>
  );
}
