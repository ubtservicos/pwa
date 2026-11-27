import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Car,
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
  status: "valid" | "pending" | "missing";
  optional?: boolean;
  previewUrl?: string | null;
  description: string;
}

export default function AdminKycDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const verticalParam = (searchParams.get("vertical") || "").toLowerCase();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [dbUser, setDbUser] = useState<any | null>(null);
  const [diarista, setDiarista] = useState<any | null>(null);
  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [mototaxi, setMototaxi] = useState<any | null>(null);
  const [carro, setCarro] = useState<any | null>(null);
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

      // Buscar mototaxi
      const { data: motoData } = await supabase
        .from("prestador_mototaxi")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      // Buscar carro
      const { data: carroData } = await supabase
        .from("prestador_carro")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      setDbUser(userData);
      setDiarista(diaristaData);
      setCaminhao(caminhaoData);
      setMototaxi(motoData);
      setCarro(carroData);

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
    if (verticalParam === "carro" && carro) return "Carros";
    if (verticalParam === "mototaxi" && mototaxi) return "Mototaxi";
    if (carro?.kyc_status === "pending" && mototaxi?.kyc_status !== "pending") return "Carros";
    const isColab = dbUser.role === "cocoecia-colaborador" || dbUser.role === "cocoecia-dirigentes" || dbUser.role === "cocoecia";
    if (isColab || caminhaoPlate) return "Reciclagem";
    if (diarista) return "Diarista";
    if (carro && !mototaxi) return "Carros";
    if (mototaxi || dbUser.role === "prestador" || dbUser.under_review) return "Mototaxi";
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
      case "Carros":
        return [
          { id: "cnh_b", label: "CNH categoria B (ou superior) legível e dentro do prazo de validade" },
          { id: "crlv_carro", label: "CRLV do veículo regularizado e foto externa com placa visível" },
        ];
      case "Mototaxi":
        return [
          { id: "cnh_a", label: "CNH categoria A ativa com observação EAR (Exerce Ativ. Remunerada)" },
          { id: "crlv_moto", label: "CRLV da motocicleta regularizado e licenciado" },
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
  const documents: KycDocument[] = (() => {
    if (category === "Carros") {
      const cnhFrente = carro?.cnh_frente_url || null;
      const cnhVerso = carro?.cnh_verso_url || null;
      const crlv = carro?.crlv_url || null;
      const fotoCarro = carro?.carro_photo_url || null;
      const selfie = carro?.selfie_url || null;
      const fotoInterna = carro?.carro_interno_photo_url || null;

      return [
        {
          name: "CNH (Frente)",
          type: "Documento Oficial",
          status: cnhFrente ? "valid" : "missing",
          previewUrl: cnhFrente,
          description: "Frente da Carteira Nacional de Habilitação do motorista.",
        },
        {
          name: "CNH (Verso)",
          type: "Documento Oficial",
          status: cnhVerso ? "valid" : "missing",
          previewUrl: cnhVerso,
          description: "Verso da CNH com QR Code e observações (EAR/categoria).",
        },
        {
          name: "CRLV - Documento do Carro",
          type: "Documento do Veículo",
          status: crlv ? "valid" : "missing",
          previewUrl: crlv,
          description: "Certificado de Registro e Licenciamento do automóvel.",
        },
        {
          name: "Foto Externa do Carro",
          type: "Veículo",
          status: fotoCarro ? "valid" : "missing",
          previewUrl: fotoCarro,
          description: "Foto nítida do carro com placa visível.",
        },
        {
          name: "Selfie com Documento",
          type: "Validação Facial",
          status: selfie ? "valid" : "missing",
          previewUrl: selfie,
          description: "Foto do condutor segurando o documento de identificação.",
        },
        {
          name: "Foto Interna do Carro (Opcional)",
          type: "Informativo · Não impeditivo",
          status: fotoInterna ? "valid" : "missing",
          optional: true,
          previewUrl: fotoInterna,
          description: "Foto opcional do interior do veículo (não bloqueia aprovação).",
        },
      ];
    }

    if (category === "Mototaxi") {
      const cnhFrente = mototaxi?.cnh_frente_url || mototaxi?.cnh_photo_url || null;
      const cnhVerso = mototaxi?.cnh_verso_url || null;
      const crlv = mototaxi?.crlv_url || null;
      const fotoMoto = mototaxi?.moto_photo_url || null;
      const selfie = mototaxi?.selfie_url || null;

      return [
        {
          name: "CNH (Frente)",
          type: "Documento Oficial",
          status: cnhFrente ? "valid" : "missing",
          previewUrl: cnhFrente,
          description: "Frente da Carteira Nacional de Habilitação.",
        },
        {
          name: "CNH (Verso)",
          type: "Documento Oficial",
          status: cnhVerso ? "valid" : "missing",
          previewUrl: cnhVerso,
          description: "Verso da CNH com QR Code e informações adicionais.",
        },
        {
          name: "CRLV - Documento da Moto",
          type: "Documento do Veículo",
          status: crlv ? "valid" : "missing",
          previewUrl: crlv,
          description: "Certificado de Registro e Licenciamento do Veículo.",
        },
        {
          name: "Foto da Motocicleta",
          type: "Veículo",
          status: fotoMoto ? "valid" : "missing",
          previewUrl: fotoMoto,
          description: "Foto nítida da motocicleta com placa visível.",
        },
        {
          name: "Selfie com Documento",
          type: "Validação Facial",
          status: selfie ? "valid" : "missing",
          previewUrl: selfie,
          description: "Foto do condutor segurando o documento de identificação.",
        },
      ];
    }

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

  const hasMissingDocs = documents.some((doc) => doc.status === "missing" && !doc.optional);
  const allChecked = !hasMissingDocs && checklistItems.every((item) => checkedItems[item.id] === true);

  const handleToggleCheck = (id: string) => {
    if (hasMissingDocs) return;
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = async () => {
    if (!dbUser || !allChecked || hasMissingDocs) return;
    try {
      // 1. Update usuarios
      await supabase
        .from("usuarios")
        .update({
          role: "prestador",
          status: "active",
          under_review: false,
        })
        .eq("id", dbUser.id);

      // 2. Update vertical provider table (prestador_carro vs prestador_mototaxi)
      const providerTable = category === "Carros" ? "prestador_carro" : "prestador_mototaxi";
      await supabase
        .from(providerTable)
        .update({
          kyc_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", dbUser.id);

      // 3. Update profiles
      await supabase
        .from("profiles")
        .update({
          role: "prestador",
          is_active: true,
        })
        .eq("id", dbUser.id);

      // 4. Notificação in-app (best effort)
      try {
        await supabase.from("notificacoes").insert({
          user_id: dbUser.id,
          title: `Cadastro ${category} aprovado!`,
          message: `Seus documentos de ${category} foram aprovados. Você já pode atuar na plataforma.`,
          type: "kyc_approved",
        });
      } catch {
        // noop
      }

      toast.show(`KYC (${category}) aprovado com sucesso! Prestador credenciado e ativo.`);
      navigate("/admin/kyc-pendentes");
    } catch (e) {
      console.error("Erro ao aprovar KYC:", e);
      toast.show("Erro ao aprovar o KYC.");
    }
  };

  const handleReject = async () => {
    if (!dbUser) return;
    try {
      // 1. Update usuarios
      await supabase
        .from("usuarios")
        .update({
          under_review: false,
        })
        .eq("id", dbUser.id);

      // 2. Update vertical provider table
      const providerTable = category === "Carros" ? "prestador_carro" : "prestador_mototaxi";
      await supabase
        .from(providerTable)
        .update({
          kyc_status: "rejected",
          kyc_notes: rejectReason || "Dados incoerentes",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", dbUser.id);

      // 3. Notificação in-app (best effort)
      try {
        await supabase.from("notificacoes").insert({
          user_id: dbUser.id,
          title: `KYC ${category} reprovado`,
          message: `Motivo: ${rejectReason || "Dados incoerentes"}. Reenvie seus documentos pelo app.`,
          type: "kyc_rejected",
        });
      } catch {
        // noop
      }

      toast.show(`KYC (${category}) reprovado. Motivo registrado: ${rejectReason || "Dados incoerentes"}`);
      setShowRejectModal(false);
      navigate("/admin/kyc-pendentes");
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

      {/* Atributos Descritivos do Veículo — Carros (Informativos / Não Impeditivos) */}
      {category === "Carros" && carro && (
        <Card
          style={{
            padding: 20,
            marginBottom: 24,
            background: "#121215",
            border: "1px solid rgba(34,211,238,0.28)",
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#22D3EE" }}>
              <Car size={18} /> Atributos Descritivos do Veículo (Carros)
            </div>
            <Pill bg="rgba(34,211,238,0.12)" color="#22D3EE" size="sm">
              Informativos · Não Impeditivos
            </Pill>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)", margin: "0 0 14px" }}>
            Campos opcionais exibidos ao passageiro durante a solicitação da corrida. Ausência ou variação destes dados não bloqueia a aprovação do KYC.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            {[
              { label: "Modelo", value: carro.model || "Não informado" },
              { label: "Placa", value: carro.plate || "Não informada" },
              { label: "Modalidade", value: carro.modalidade || "ambos" },
              { label: "Subtipo", value: carro.vehicle_subtype || "padrao" },
              { label: "Cor", value: carro.cor || "Não informada" },
              { label: "Ano", value: carro.ano ? String(carro.ano) : "Não informado" },
              { label: "Portas", value: carro.portas ? `${carro.portas} portas` : "Não informado" },
              {
                label: "Ar-Condicionado",
                value:
                  carro.ar_condicionado === true
                    ? "Sim"
                    : carro.ar_condicionado === false
                      ? "Não"
                      : "Não informado",
              },
              { label: "Categoria CNH", value: carro.cnh_categoria || "Não informada" },
              {
                label: "Possui EAR",
                value:
                  carro.possui_ear === true
                    ? "Sim"
                    : carro.possui_ear === false
                      ? "Não"
                      : "Não informado",
              },
              { label: "Alvará Municipal", value: carro.alvara_municipal || "Não informado" },
            ].map((attr) => (
              <div
                key={attr.label}
                style={{
                  background: "#09090B",
                  border: "1px solid #27272A",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, fontFamily: "DM Sans", textTransform: "uppercase", letterSpacing: 0.8, color: "#71717A" }}>
                  {attr.label}
                </div>
                <div style={{ fontSize: 13, fontFamily: "DM Sans", fontWeight: 600, color: "#F4F4F5", marginTop: 3 }}>
                  {attr.value}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--admin-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={20} color={doc.status === "missing" ? "var(--admin-muted)" : "var(--admin-subtle)"} />
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {doc.status === "missing" ? (
                        doc.optional ? (
                          <Pill bg="rgba(148,163,184,0.12)" color="#94A3B8" size="sm">
                            Opcional · Não enviado
                          </Pill>
                        ) : (
                          <Pill bg="rgba(232,64,64,0.10)" color="#E84040" size="sm">
                            Documento ausente
                          </Pill>
                        )
                      ) : (
                        <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                          Enviado
                        </Pill>
                      )}
                      <span style={{ fontSize: 11, fontFamily: "DM Sans", color: "var(--admin-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                        {doc.type}
                      </span>
                    </div>
                  </div>
                  <h3 style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: "0 0 4px" }}>
                    {doc.name}
                  </h3>
                  <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)", margin: 0 }}>
                    {doc.description}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16, borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
                  <button
                    disabled={doc.status === "missing"}
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
                      color: doc.status === "missing" ? "var(--admin-muted)" : "var(--admin-subtle)",
                      cursor: doc.status === "missing" ? "not-allowed" : "pointer",
                      opacity: doc.status === "missing" ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ImageIcon size={14} /> {doc.status === "missing" ? "Não enviado" : "Visualizar"}
                  </button>
                  {doc.previewUrl ? (
                    <a
                      href={doc.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
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
                      title="Abrir arquivo original"
                    >
                      <Download size={14} />
                    </a>
                  ) : null}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Requisitos de Validação - {category}
            </h2>
            {hasMissingDocs && (
              <span className="font-sans text-[12px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <AlertCircle size={13} /> Bloqueado por falta de documentos
              </span>
            )}
          </div>

          {hasMissingDocs && (
            <div className="flex items-center gap-3 p-3.5 mb-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300">
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
              <div className="font-sans text-[13px] leading-relaxed">
                <strong className="font-semibold text-rose-200">Aprovação bloqueada:</strong> Documentos obrigatórios ausentes. Todos os documentos exigidos devem ser anexados antes de validar a checklist.
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {checklistItems.map((item) => (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  hasMissingDocs
                    ? "opacity-50 cursor-not-allowed bg-zinc-900/60 border-zinc-800 text-zinc-500"
                    : checkedItems[item.id]
                    ? "cursor-pointer bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "cursor-pointer bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700 text-zinc-200"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={hasMissingDocs}
                  checked={!hasMissingDocs && !!checkedItems[item.id]}
                  onChange={() => handleToggleCheck(item.id)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 bg-zinc-700 disabled:cursor-not-allowed"
                />
                <div className="flex flex-col">
                  <span className={`font-sans text-[14px] font-medium leading-tight ${
                    hasMissingDocs
                      ? "text-zinc-500"
                      : checkedItems[item.id]
                      ? "text-zinc-100"
                      : "text-zinc-300"
                  }`}>
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
          {hasMissingDocs ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "DM Sans", fontSize: 13, color: "#E84040", fontWeight: 600 }}>
              <AlertCircle size={16} /> Aprovação bloqueada: Documentos obrigatórios ausentes.
            </span>
          ) : !allChecked ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "DM Sans", fontSize: 13, color: "#F5A623" }}>
              <AlertCircle size={15} /> Marque todos os requisitos da checklist para habilitar aprovação.
            </span>
          ) : null}
          <PrimaryButton
            onClick={handleApprove}
            disabled={!allChecked || hasMissingDocs}
            style={{
              height: 44,
              padding: "0 28px",
              opacity: allChecked && !hasMissingDocs ? 1 : 0.5,
              cursor: allChecked && !hasMissingDocs ? "pointer" : "not-allowed",
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
            
            {/* Document Preview Image */}
            <div style={{
              width: "100%",
              minHeight: 280,
              maxHeight: 480,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 16,
              position: "relative",
              overflow: "hidden"
            }}>
              {previewDoc.previewUrl ? (
                <img
                  src={previewDoc.previewUrl}
                  alt={previewDoc.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "360px",
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <>
                  <FileCheck size={48} color="#0DB87E" />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>
                      {previewDoc.name}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--admin-muted)", marginTop: 4 }}>
                      Processamento e Validação Criptografada UBT
                    </div>
                  </div>
                </>
              )}

              <div style={{
                width: "100%",
                background: "rgba(13, 184, 126, 0.05)",
                border: "1px solid rgba(13, 184, 126, 0.15)",
                padding: "8px 12px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8
              }}>
                <ShieldCheck size={16} color="#0DB87E" />
                <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-subtle)" }}>
                  Este documento foi transmitido e armazenado de forma segura no Supabase Storage.
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
