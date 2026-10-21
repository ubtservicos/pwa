import { useState, useEffect } from "react";
import { 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Sparkles,
  Link2,
  Save
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { QRCodeCanvas } from "qrcode.react";
import { getAppOrigin } from "@/lib/appUrl";
import { supabase } from "@/lib/supabase";

export default function AdminCocoCaptacao() {
  const toast = useAdminToast();
  const [slug, setSlug] = useState("cocoecia");
  const [savedSlug, setSavedSlug] = useState("cocoecia");
  const [slugStatus, setSlugStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pixKey, setPixKey] = useState("contato@cocoecia.ubatuba.sp.gov.br");
  const [loading, setLoading] = useState(true);

  // Carregar slug e config do Supabase
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("coco_config")
          .select("vanity_slug, pix_key")
          .limit(1)
          .maybeSingle();

        if (data) {
          if (data.vanity_slug) {
            setSlug(data.vanity_slug);
            setSavedSlug(data.vanity_slug);
          }
          if (data.pix_key) {
            setPixKey(data.pix_key);
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar coco_config para captação:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(sanitized);
    if (slugStatus === "saved") {
      setSlugStatus("idle");
    }
  };

  const isSlugValid = /^[a-z0-9-]+$/.test(slug) && slug.length >= 3;

  const handleSaveSlug = async () => {
    if (!isSlugValid) {
      toast.show("O slug deve conter no mínimo 3 caracteres alfanuméricos ou hífen.");
      return;
    }

    setSlugStatus("saving");
    try {
      const { data: existing } = await supabase
        .from("coco_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("coco_config")
          .update({ 
            vanity_slug: slug,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("coco_config")
          .insert([{ 
            id: 1,
            vanity_slug: slug,
            updated_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      setSavedSlug(slug);
      setSlugStatus("saved");
      toast.show("Slug oficial da Côco & Cia atualizado com sucesso!");
      setTimeout(() => setSlugStatus("idle"), 3000);
    } catch (err: any) {
      setSlugStatus("idle");
      toast.show(`Erro ao salvar slug: ${err.message || "Falha de conexão"}`);
    }
  };

  // Dynamic URL
  const origin = getAppOrigin() || window.location.origin;
  const currentRef = slug.trim() || "cocoecia";
  const landingUrl = `${origin}/cadastro?ref=${currentRef}`;
  const whatsappMsg = `Olá! Faça parte da rede comunitária da Côco & Cia e UBT Serviços em Ubatuba. Cadastre-se pelo link oficial: ${landingUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMsg)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(landingUrl);
    toast.show("Link oficial copiado para a área de transferência!");
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById("coco-qr-code") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `qrcode-cocoecia-${currentRef}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      toast.show("QR Code baixado com sucesso!");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
            <QrCode size={20} />
          </div>
          <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
            Captação de Doadores & Vanity Slug Oficial
          </h1>
        </div>
        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
          Gerencie o link de indicação exclusivo da Côco & Cia (/cadastro?ref=slug) e gere materiais de divulgação impressos e digitais.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* Bloco de Customização do Slug e Link */}
        <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 8px 0" }}>
              Slug de Indicação da Entidade
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", margin: 0 }}>
              Personalize o identificador amigável da Côco & Cia para materiais de divulgação, adesivos nos caminhões e redes sociais.
            </p>
          </div>

          {/* Campo de Slug com Botão Salvar */}
          <div>
            <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
              Slug Personalizado (letras minúsculas, números e hífens)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: 11, fontFamily: "monospace", fontSize: 13, color: "var(--admin-muted)" }}>
                  /cadastro?ref=
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="cocoecia"
                  style={{
                    width: "100%",
                    background: "var(--admin-bg)",
                    border: `1px solid ${!isSlugValid && slug ? "#E84040" : "var(--admin-border)"}`,
                    borderRadius: 8,
                    padding: "10px 12px 10px 115px",
                    color: "var(--admin-text)",
                    fontFamily: "monospace",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveSlug}
                disabled={slugStatus === "saving" || !isSlugValid || slug === savedSlug}
                style={{
                  background: slugStatus === "saved" ? "#0DB87E" : (slug === savedSlug ? "var(--admin-border)" : "#0DB87E"),
                  color: slug === savedSlug && slugStatus !== "saved" ? "var(--admin-muted)" : "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 16px",
                  cursor: slugStatus === "saving" || !isSlugValid || slug === savedSlug ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 13,
                  transition: "all 150ms ease"
                }}
              >
                {slugStatus === "saving" ? (
                  "Salvando..."
                ) : slugStatus === "saved" ? (
                  <>
                    <Check size={16} /> Salvo!
                  </>
                ) : (
                  <>
                    <Save size={16} /> Salvar Slug
                  </>
                )}
              </button>
            </div>
            {!isSlugValid && slug && (
              <span style={{ fontSize: 11, color: "#E84040", marginTop: 4, display: "block" }}>
                Use apenas letras minúsculas sem acento, números e hífens (ex: cocoecia).
              </span>
            )}
          </div>

          {/* URL Dinâmica Gerada */}
          <div>
            <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
              URL de Cadastro Oficial Gerada
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                readOnly
                value={landingUrl}
                style={{
                  flex: 1,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "var(--admin-text)",
                  fontFamily: "monospace",
                  fontSize: 13
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  background: "rgba(13,184,126,0.15)",
                  color: "#0DB87E",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <Copy size={15} /> Copiar
              </button>
            </div>
          </div>

          {/* Compartilhamento via WhatsApp */}
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#25D366",
                color: "white",
                textDecoration: "none",
                borderRadius: 10,
                padding: "10px 16px",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 13
              }}
            >
              <Share2 size={16} /> Compartilhar no WhatsApp
            </a>
          </div>

          <div style={{ background: "rgba(13,184,126,0.08)", padding: 16, borderRadius: 12, border: "1px solid rgba(13,184,126,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0DB87E", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              <Sparkles size={16} /> Chave PIX da Entidade Vinculada
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              As contribuições financeiras voluntárias de cidadãos e comércios parceiros são direcionadas para a chave: <strong>{pixKey}</strong>.
            </div>
          </div>
        </Card>

        {/* Visualizador do QR Code */}
        <Card style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div
            style={{
              background: "#FFFFFF",
              padding: 20,
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            <QRCodeCanvas
              id="coco-qr-code"
              value={landingUrl}
              size={220}
              level="H"
              includeMargin={true}
            />
            <div style={{ marginTop: 8, fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0B1B3E" }}>
              Côco & Cia · Ubatuba Sustentável
            </div>
            <div style={{ fontSize: 11, color: "#5B6178", fontFamily: "DM Sans" }}>
              Link: ref={currentRef}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320 }}>
            <PrimaryButton onClick={handleDownloadQR} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Download size={16} /> Baixar QR Code (PNG)
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
