import { useState } from "react";
import { 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Sparkles 
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminCocoCaptacao() {
  const toast = useAdminToast();
  const [pixKey] = useState(() => {
    try {
      return localStorage.getItem("coco_pix_fallback") || "coco@pix.com.br";
    } catch {
      return "coco@pix.com.br";
    }
  });

  const landingUrl = `${window.location.origin}/#fundadores-cap`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(landingUrl);
    toast.show("Link de cadastro copiado para a área de transferência!");
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById("coco-qr-code") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "qrcode-cocoecia-oficial.png";
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
            Captação de Doadores & QR Code Oficial
          </h1>
        </div>
        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
          QR Code único da Côco & Cia para materiais impressos, adesivos de caminhão e divulgação institucional.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* Bloco de Informações */}
        <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 8px 0" }}>
              Link Direto de Cadastro
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", margin: 0 }}>
              Este QR Code direciona os cidadãos e turistas diretamente para a página de adesão e cadastro da UBT / Côco & Cia.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
              URL de Destino
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

          <div style={{ background: "rgba(13,184,126,0.08)", padding: 16, borderRadius: 12, border: "1px solid rgba(13,184,126,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0DB87E", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              <Sparkles size={16} /> Chave PIX da Entidade Vinculada
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              As contribuições financeiras voluntárias realizadas via QR Code e App são direcionadas para: <strong>{pixKey}</strong>.
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
              Adesão Oficial
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320 }}>
            <PrimaryButton onClick={handleDownloadQR} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Download size={16} /> Baixar Imagem (PNG)
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
