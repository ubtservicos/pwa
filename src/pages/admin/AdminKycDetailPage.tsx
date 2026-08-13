import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  User,
  CheckSquare,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Download,
} from "lucide-react";
import { Card, Avatar, Pill, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface KycDocument {
  name: string;
  type: string;
  status: "valid" | "pending";
  previewUrl?: string;
  description: string;
}

export default function AdminKycDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [dbUser, setDbUser] = useState<any | null>(null);
  const [diarista, setDiarista] = useState<any | null>(null);
  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"docs" | "checklist">("docs");

  // Checklist state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState<KycDocument | null>(null);

  const fetchUserDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: userData, error: errUser } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (errUser) throw errUser;
      if (!userData) {
        setDbUser(null);
        setLoading(false);
        return;
      }

      // Buscar diarista
      const { data: diaristaData } = await supabase
        .from("diarista_perfis")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      // Buscar caminhão (Reciclagem)
      const { data: caminhaoData } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .eq("prestador_id", id)
        .maybeSingle();

      setDbUser(userData);
      setDiarista(diaristaData);
      setCaminhao(caminhaoData);

    } catch (err) {
      console.error("Erro ao carregar KYC do usuário:", err);
      toast.show("Erro ao carregar detalhes do KYC.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  const caminhaoPlate = caminhao?.plate;

  // Determine user category
  const category = (() => {
    if (!dbUser) return "Geral";
    const isColab = dbUser.role === "cocoecia-colaborador" || dbUser.role === "cocoecia-dirigentes" || dbUser.role === "cocoecia";
    if (isColab || caminhaoPlate) return "Reciclagem";
    if (diarista) return "Diarista";
    if (dbUser.role === "prestador") return "Mototaxi";
    return "Geral";
  })();

  // Define checklist based on category
  const checklistItems = (() => {
    switch (category) {
      case "Diarista":
        return [
          { id: "rg_cnh", label: "RG/CNH legível e dentro do prazo de validade" },
          { id: "residencia", label: "Comprovante de residência emitido nos últimos 90 dias" },
          { id: "selfie", label: "Selfie com documento em mãos bate com a foto de perfil" },
        ];
      case "Mototaxi":
        return [
          { id: "cnh_a", label: "CNH categoria A ativa com observação EAR (Exerce Ativ. Remunerada)" },
          { id: "crlv_moto", label: "CRLV da motocicleta regularizado e licenciado" },
          { id: "prontuario", label: "Prontuário de infrações da CNH limpo ou sem infrações gravíssimas" },
        ];
      case "Reciclagem":
        return [
          { id: "rg_responsavel", label: "Documento de Identidade do motorista/responsável válido" },
          { id: "crlv_caminhao", label: "CRLV do caminhão regularizado" },
          { id: "ong_vinculo", label: "Declaração de vínculo ativa com a Associação/ONG Côco & Cia" },
          { id: "pix_valido", label: "Chave Pix cadastrada válida em nome da Associação (Dirigentes)" },
        ];
      default:
        return [
          { id: "rg_cnh", label: "Documento de identificação oficial válido (RG/CNH)" },
          { id: "residencia", label: "Comprovante de residência atualizado" },
        ];
    }
  })();

  // Define docs based on category
  const documents = (() => {
    const defaultDocs: KycDocument[] = [
      {
        name: "Documento de Identidade (Frente e Verso)",
        type: "Documento Oficial",
        status: "valid",
        description: "RG ou CNH enviado digitalmente.",
      },
      {
        name: "Comprovante de Residência",
        type: "Conta de Consumo",
        status: "valid",
        description: "Conta de água, luz ou telefone recente.",
      },
    ];

    if (category === "Mototaxi") {
      return [
        ...defaultDocs,
        {
          name: "CRLV - Certificado de Registro do Veículo",
          type: "Documento do Veículo",
          status: "valid",
          description: "Licenciamento anual da moto cadastrada.",
        },
        {
          name: "Prontuário de Pontos CNH",
          type: "Histórico DETRAN",
          status: "valid",
          description: "Histórico de pontuação do motorista.",
        },
      ];
    }

    if (category === "Reciclagem") {
      return [
        ...defaultDocs,
        {
          name: "CRLV - Caminhão de Coleta",
          type: "Documento do Veículo",
          status: "valid",
          description: "Licenciamento anual do caminhão cadastrado.",
        },
        {
          name: "Autorização / Vínculo da Associação",
          type: "Carta Credencial",
          status: "valid",
          description: "Autorização oficial emitida pela Côco & Cia.",
        },
      ];
    }

    return defaultDocs;
  })();

  const allChecked = checklistItems.every((item) => checkedItems[item.id] === true);

  const handleToggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = async () => {
    if (!dbUser || !allChecked) return;
    try {
      const newRole = "prestador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", dbUser.id);

      if (error) throw error;

      toast.show("KYC Aprovado com sucesso! Usuário promovido a Prestador.");
      navigate("/admin");
    } catch (e) {
      console.error("Erro ao aprovar KYC:", e);
      toast.show("Erro ao aprovar o KYC.");
    }
  };

  const handleReject = async () => {
    if (!dbUser) return;
    try {
      const newRole = "tomador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", dbUser.id);

      if (error) throw error;

      toast.show(`KYC Reprovado. Motivo enviado: ${rejectReason || "Dados incoerentes"}`);
      setShowRejectModal(false);
      navigate("/admin");
    } catch (e) {
      console.error("Erro ao reprovar KYC:", e);
      toast.show("Erro ao registrar reprovação do KYC.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Carregando dados do KYC...</div>
      </div>
    );
  }

  if (!dbUser) {
    return (
      <div style={{ padding: 32 }}>
        <button
          onClick={() => navigate("/admin")}
          style={{
            background: "none",
            border: "none",
            color: "var(--admin-subtle)",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} /> Voltar para o Dashboard
        </button>
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#E84040" }}>Usuário não encontrado</div>
          <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)", marginTop: 8 }}>O ID solicitado não existe.</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin")}
        style={{
          background: "none",
          border: "none",
          color: "var(--admin-subtle)",
          fontFamily: "DM Sans",
          fontSize: 14,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: 24,
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--admin-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--admin-subtle)")}
      >
        <ArrowLeft size={16} /> Voltar para o Dashboard
      </button>

      {/* Header Profile */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={dbUser.nome} size={64} />
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              KYC de {dbUser.nome}
            </h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                Cadastrado em {new Date(dbUser.created_at).toLocaleDateString("pt-BR")}
              </span>
              <Pill bg="rgba(245,166,35,0.10)" color="#F5A623" size="sm">
                Aguardando Aprovação
              </Pill>
              <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                Categoria: {category}
              </Pill>
            </div>
          </div>
        </div>
      </div>

      {/* Posicionamento Institucional UBT */}
      <div style={{
        background: "rgba(13,184,126,0.06)",
        border: "1px solid rgba(13,184,126,0.15)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        fontFamily: "DM Sans",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--admin-subtle)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#0DB87E", marginBottom: 6 }}>
          <ShieldCheck size={18} /> Inclusão e Oportunidade UBT
        </div>
        <p style={{ margin: 0 }}>
          A UBT busca ampliar oportunidades de trabalho e geração de renda para a comunidade local, respeitando princípios de inclusão e responsabilidade social.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          O processo de credenciamento considera a documentação exigida para cada atividade, a regularidade operacional e o comportamento dentro da plataforma.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          A segurança dos usuários é reforçada por mecanismos de verificação documental, avaliações da comunidade, monitoramento operacional, auditoria antifraude e moderação contínua.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          A UBT mantém política de tolerância zero para fraude, violência, assédio ou qualquer atividade ilegal.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--admin-border)", marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("docs")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 0",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === "docs" ? "#0DB87E" : "var(--admin-subtle)",
            borderBottom: activeTab === "docs" ? "2px solid #0DB87E" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          Documentos Enviados
        </button>
        <button
          onClick={() => setActiveTab("checklist")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 0",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === "checklist" ? "#0DB87E" : "var(--admin-subtle)",
            borderBottom: activeTab === "checklist" ? "2px solid #0DB87E" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          Checklist de Requisitos ({Object.values(checkedItems).filter(Boolean).length}/{checklistItems.length})
        </button>
      </div>

      {/* Content Tab 1: Documents */}
      {activeTab === "docs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {documents.map((doc, idx) => (
              <Card
                key={idx}
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 180,
                  border: "1px solid var(--admin-border)",
                  background: "var(--admin-bg)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--admin-bg)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center" }}>
                      <FileText size={20} color="var(--admin-subtle)" />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "DM Sans", color: "var(--admin-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                      {doc.type}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: "0 0 4px" }}>
                    {doc.name}
                  </h3>
                  <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)", margin: 0 }}>
                    {doc.description}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16, borderTop: "1px solid var(--admin-bg)", paddingTop: 12 }}>
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    style={{
                      flex: 1,
                      height: 32,
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      fontFamily: "DM Sans",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--admin-subtle)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ImageIcon size={14} /> Visualizar
                  </button>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toast.show("Download iniciado."); }}
                    style={{
                      width: 32,
                      height: 32,
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--admin-subtle)",
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} />
                  </a>
                </div>
              </Card>
            ))}
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--admin-bg)",
            border: "1px solid var(--admin-border)",
            borderRadius: 12,
            padding: 16,
            marginTop: 8
          }}>
            <AlertCircle size={18} color="var(--admin-subtle)" />
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
              Verifique cuidadosamente se os dados das imagens coincidem com as informações digitadas e se não há sinais de falsificação antes de passar para a aba de checklist.
            </span>
          </div>
        </div>
      )}

      {/* Content Tab 2: Checklist */}
      {activeTab === "checklist" && (
        <Card style={{ padding: 24 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
            Requisitos de Validação - {category}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {checklistItems.map((item) => (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid",
                  borderColor: checkedItems[item.id] ? "rgba(13,184,126,0.15)" : "#E2E8F0",
                  background: checkedItems[item.id] ? "rgba(13,184,126,0.02)" : "#fff",
                  cursor: "pointer",
                  transition: "background 150ms, border-color 150ms"
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checkedItems[item.id]}
                  onChange={() => handleToggleCheck(item.id)}
                  style={{
                    marginTop: 3,
                    width: 16,
                    height: 16,
                    accentColor: "#0DB87E",
                    cursor: "pointer"
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    fontWeight: 500,
                    color: checkedItems[item.id] ? "var(--admin-text)" : "var(--admin-subtle)",
                  }}>
                    {item.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Bottom Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, gap: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowRejectModal(true)}
          style={{
            height: 44,
            padding: "0 24px",
            background: "none",
            border: "1px solid #E84040",
            borderRadius: 10,
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            color: "#E84040",
            cursor: "pointer",
            transition: "background 150ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232, 64, 64, 0.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          Reprovar Credenciamento (Rejeitar)
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!allChecked && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "DM Sans", fontSize: 13, color: "#F5A623" }}>
              <AlertCircle size={15} /> Marque todos os requisitos da checklist para habilitar aprovação.
            </span>
          )}
          <PrimaryButton
            onClick={handleApprove}
            disabled={!allChecked}
            style={{
              height: 44,
              padding: "0 28px",
              opacity: allChecked ? 1 : 0.5,
              cursor: allChecked ? "pointer" : "not-allowed",
            }}
          >
            Aprovar KYC e Credenciar
          </PrimaryButton>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <>
          <div
            onClick={() => setPreviewDoc(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 1100,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              maxWidth: 600,
              background: "var(--admin-bg)",
              borderRadius: 16,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -10px rgba(0,0,0,0.1)",
              zIndex: 1110,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Visualização: {previewDoc.name}
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={20} color="var(--admin-subtle)" />
              </button>
            </div>
            
            {/* Simulated Document Preview Image */}
            <div style={{
              width: "100%",
              height: 300,
              background: "var(--admin-bg)",
              border: "2px dashed #E2E8F0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 20,
              position: "relative"
            }}>
              <FileCheck size={48} color="#0DB87E" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>
                  {previewDoc.name}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--admin-muted)", marginTop: 4 }}>
                  Hash de Segurança: SHA-256 (UBT-{Math.random().toString(36).substr(2, 9).toUpperCase()})
                </div>
              </div>

              {/* Fake Document visual styling */}
              <div style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                right: 12,
                background: "rgba(13, 184, 126, 0.05)",
                border: "1px solid rgba(13, 184, 126, 0.15)",
                padding: "8px 12px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <ShieldCheck size={16} color="#0DB87E" />
                <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-subtle)" }}>
                  Este documento foi processado e criptografado de forma segura pelo Superapp.
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div
            onClick={() => setShowRejectModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(2px)",
              zIndex: 1100,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              maxWidth: 450,
              background: "var(--admin-bg)",
              borderRadius: 16,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -10px rgba(0,0,0,0.1)",
              zIndex: 1110,
              padding: 24,
            }}
          >
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 8px" }}>
              Reprovar Credenciamento (KYC)
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", margin: "0 0 16px" }}>
              Por favor, informe ao usuário o motivo da rejeição do credenciamento. Este motivo será enviado por e-mail/notificação.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Documento de identidade com qualidade baixa ou CNH sem a observação EAR..."
              style={{
                width: "100%",
                height: 100,
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: 12,
                fontFamily: "DM Sans",
                fontSize: 13,
                outline: "none",
                resize: "none",
                marginBottom: 20,
              }}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  flex: 1,
                  height: 40,
                  background: "var(--admin-bg)",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--admin-subtle)",
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleReject}
                style={{
                  flex: 1,
                  height: 40,
                  background: "#E84040",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
