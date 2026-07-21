import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ShieldCheck, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import { useSimpleToast } from "@/hooks/useToast2";
import Toast from "@/components/auth/Toast";
import { supabase } from "@/lib/supabase";

interface AuditLog {
  id: string;
  exported_at: string;
  ip_address: string;
  user_agent: string;
  volume_bytes: number;
}

export default function ConfigPrivacidadePage() {
  const t = useTheme();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    if (!user.uid) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from("data_exports_audit")
        .select("*")
        .eq("user_id", user.uid)
        .order("exported_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Erro ao carregar historico de auditoria:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user.uid]);

  const handleExport = async () => {
    if (!user.uid) return;
    try {
      setExporting(true);
      showToast("Geraçāo dos dados iniciada...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Erro no servidor ao processar exportação.");
      }

      const result = await response.json();
      
      if (result.success && result.download_url) {
        showToast("Dados compilados! Iniciando download... ✓");
        
        // Trigger client-side browser file download
        const link = document.createElement("a");
        link.href = result.download_url;
        link.target = "_blank";
        link.download = `ubt-dados-${user.uid}.json`;
        link.click();
        
        // Reload audit history logs
        setTimeout(() => {
          fetchHistory();
        }, 1500);
      } else {
        throw new Error("Formato de resposta de exportação inválido.");
      }
    } catch (err: any) {
      console.error("Erro ao exportar dados:", err);
      showToast(err.message || "Falha ao exportar dados.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user.uid) return;
    const confirm1 = confirm("Aviso Importante:\nEsta ação anonimiza permanentemente seus dados pessoais do SuperApp e deleta seus documentos, mantendo apenas registros de pagamentos/splits para fins fiscais. Deseja prosseguir com a exclusão?");
    if (!confirm1) return;

    const confirm2 = confirm("Segunda Confirmação:\nVocê confirma que entende que este processo é irreversível e que sua conta atual será permanentemente desativada?");
    if (!confirm2) return;

    const reason = prompt("Se desejar, informe brevemente o motivo da sua exclusão:");

    try {
      setDeleting(true);
      showToast("Solicitando exclusão da conta...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          target_user_id: user.uid,
          deleted_reason: reason || "Solicitado pelo usuário via aplicativo"
        })
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Erro no servidor ao solicitar exclusão.");
      }

      showToast("Conta excluída e anonimizada com sucesso! Desconectando... ✓");
      setTimeout(async () => {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = "/login";
      }, 2000);
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      showToast(err.message || "Falha ao solicitar exclusão da conta.");
      setDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Privacidade & LGPD" onBack={() => navigate("/app/config")} />

        {/* Informative text */}
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              background: "rgba(13,184,126,0.06)",
              border: "1px solid rgba(13,184,126,0.18)",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldCheck size={24} color="#0DB87E" />
              <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: t.text }}>
                Seus Direitos sob a LGPD
              </span>
            </div>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.text, opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
              O Artigo 18 da Lei Geral de Proteção de Dados (LGPD) concede a você o direito de portabilidade e acesso facilitado às suas informações pessoais armazenadas pela nossa plataforma.
            </p>
          </div>
        </div>

        {/* Request download section */}
        <div style={{ marginTop: 24 }}>
          <SettingsGroup>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: t.text, margin: 0 }}>
                Solicitar Cópia das Minhas Informações
              </h3>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.muted, margin: 0, lineHeight: 1.5 }}>
                Esta funcionalidade compilará todos os seus dados cadastrais, histórico de pagamentos, pedidos concluídos, status de KYCs e registros de disputas em um único arquivo JSON. O link para download gerado expirará automaticamente após <strong>24 horas</strong>.
              </p>
              
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                style={{
                  width: "100%",
                  height: 48,
                  background: "#0DB87E",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: exporting ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: exporting ? 0.7 : 1,
                  marginTop: 8
                }}
              >
                {exporting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> Compilando dados...
                  </>
                ) : (
                  <>
                    <Download size={18} /> Solicitar Cópia (JSON)
                  </>
                )}
              </button>
            </div>
          </SettingsGroup>
        </div>

        {/* Audit list logs */}
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 12 }}>
            Histórico de Solicitações
          </h3>

          {loadingHistory ? (
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.muted }}>Carregando histórico...</p>
          ) : history.length === 0 ? (
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.muted }}>Você ainda não efetuou nenhuma exportação.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${t.border}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Clock size={16} color={t.muted} />
                    <div>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: t.text, display: "block" }}>
                        {new Date(log.exported_at).toLocaleDateString("pt-BR")} às {new Date(log.exported_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span style={{ fontFamily: "DM Sans", fontSize: 11, color: t.muted }}>
                        IP: {log.ip_address || "Não registrado"}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 700, color: "#0DB87E", display: "block" }}>
                      Concluído
                    </span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 11, color: t.muted }}>
                      {formatBytes(log.volume_bytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Account Section */}
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#E84040", marginBottom: 12 }}>
            Excluir Conta Permanentemente
          </h3>
          <SettingsGroup>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.muted, margin: 0, lineHeight: 1.5 }}>
                Esta ação é <strong>irreversível</strong>. Todos os seus dados pessoais de cadastro e arquivos de credenciamento (KYC) serão excluídos ou anonimizados de forma permanente.
              </p>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted, margin: 0, lineHeight: 1.5, opacity: 0.8 }}>
                * Conforme obrigações contábeis e fiscais (Art. 16, I da LGPD), manteremos de forma restrita e anonimizada os registros de splits, pagamentos e disputas.
              </p>
              
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  width: "100%",
                  height: 48,
                  background: "rgba(232,64,64,0.08)",
                  border: "1px solid rgba(232,64,64,0.20)",
                  color: "#E84040",
                  borderRadius: 12,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: deleting ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: deleting ? 0.7 : 1,
                  marginTop: 8
                }}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> Excluindo conta...
                  </>
                ) : (
                  <>
                    Excluir Minha Conta
                  </>
                )}
              </button>
            </div>
          </SettingsGroup>
        </div>
      </div>
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}
