import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Truck,
  CheckCircle,
  Clock,
  Users,
  Phone,
  Shield,
  XCircle,
  UserCheck,
} from "lucide-react";
import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatPhoneRegexMask,
  PHONE_REGEX,
  type ColaboradorPerfil,
} from "@/pages/admin/AdminCocoColaboradores";

const NEIGHBORHOODS = ["Centro", "Itaguá", "Perequê-Açu", "Praia Grande", "Tenório", "Toninhas"];

const formatarPlaca = (val: string) => {
  const limpo = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (limpo.length <= 3) return limpo;
  return `${limpo.slice(0, 3)}-${limpo.slice(3, 7)}`;
};

interface ColaboradorRequerimento {
  id: string;
  nome: string;
  telefone?: string | null;
  perfil: ColaboradorPerfil;
  status_aprovacao: "pendente" | "aprovado" | "rejeitado";
  is_ativo: boolean;
  created_at?: string;
}

const CocoOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [activeTab, setActiveTab] = useState<"requerimento" | "caminhao">("requerimento");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  // Requerimento de Vínculo de Colaborador (Conta UBT -> Aprovação Côco & Cia)
  const [colabReq, setColabReq] = useState<ColaboradorRequerimento | null>(null);
  const [reqNome, setReqNome] = useState("");
  const [reqTelefone, setReqTelefone] = useState("");
  const [reqPerfil, setReqPerfil] = useState<ColaboradorPerfil>("colaborador_administrativo");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqErro, setReqErro] = useState("");
  const [resubmitMode, setResubmitMode] = useState(false);

  // Form for new truck application
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [apelido, setApelido] = useState("");
  const [roleSolicitada, setRoleSolicitada] = useState<"cocoecia-colaborador" | "cocoecia-dirigentes">(
    "cocoecia-colaborador"
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(["Centro"]);
  const [pendingTruck, setPendingTruck] = useState<any | null>(null);
  const [ignorarPendente, setIgnorarPendente] = useState(false);

  useEffect(() => {
    if (user.name && user.name !== "Visitante" && !reqNome) {
      setReqNome(user.name);
    }
  }, [user.name]);

  // Check existing collaborator request and truck request on mount/load
  useEffect(() => {
    if (!user.uid) return;

    const checkExisting = async () => {
      // 1. Verifica requerimento de colaborador vinculado à conta UBT
      const { data: colabData } = await supabase
        .from("coco_colaboradores")
        .select("id, nome, telefone, perfil, status_aprovacao, is_ativo, created_at")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (colabData && colabData.length > 0) {
        const latest = colabData[0] as ColaboradorRequerimento;
        setColabReq(latest);
        if (latest.status_aprovacao === "aprovado") {
          setActiveTab("caminhao");
        }
      }

      // 2. Verifica se já existe caminhão vinculado/pendente
      if (localStorage.getItem("ignorarAutoSelecaoCaminhao") === "true") {
        return;
      }

      const { data: truckData } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .eq("prestador_id", user.uid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (truckData && truckData.length > 0) {
        const truck = truckData[0];
        if (truck.status_aprovacao === "approved") {
          localStorage.setItem("caminhaoId", truck.id);
          localStorage.removeItem("ignorarAutoSelecaoCaminhao");
          navigate("/app/prestador/coco/online");
        } else {
          setPendingTruck(truck);
        }
      }
    };

    checkExisting();
  }, [user.uid, navigate]);

  const onEnviarRequerimentoColaborador = async () => {
    setReqErro("");
    if (!user.uid) {
      setReqErro("Você precisa estar autenticado com sua conta UBT para enviar um requerimento.");
      return;
    }

    const cleanNome = reqNome.trim();
    const formattedTel = formatPhoneRegexMask(reqTelefone);

    if (!cleanNome) {
      setReqErro("Informe seu nome completo.");
      return;
    }

    if (!PHONE_REGEX.test(formattedTel)) {
      setReqErro("Informe um Telefone / WhatsApp válido no formato (XX) XXXXX-XXXX.");
      return;
    }

    setReqSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .insert({
          user_id: user.uid,
          nome: cleanNome,
          telefone: formattedTel,
          perfil: reqPerfil,
          status_aprovacao: "pendente",
          status: "Pendente",
          is_ativo: false,
        })
        .select("id, nome, telefone, perfil, status_aprovacao, is_ativo, created_at")
        .single();

      if (error) throw error;
      setColabReq(data as ColaboradorRequerimento);
      setResubmitMode(false);
    } catch (err: any) {
      setReqErro(err?.message || "Erro ao enviar requerimento de vínculo.");
    } finally {
      setReqSubmitting(false);
    }
  };

  const onVerificarPlaca = async () => {
    if (!codigo.trim()) return;
    setLoading(true);
    setErro("");
    try {
      const upperPlate = codigo.toUpperCase().trim();
      const semHifen = upperPlate.replace("-", "");
      const comHifen = semHifen.length > 3 ? `${semHifen.slice(0, 3)}-${semHifen.slice(3)}` : semHifen;

      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .or(`plate.eq.${comHifen},plate.eq.${semHifen}`)
        .maybeSingle();

      if (error || !data) {
        setShowApplyForm(true);
      } else {
        if (data.status_aprovacao === "approved") {
          localStorage.setItem("caminhaoId", data.id);
          localStorage.removeItem("ignorarAutoSelecaoCaminhao");
          if (!data.prestador_id && user.uid) {
            await supabase
              .from("coco_caminhoes")
              .update({ prestador_id: user.uid })
              .eq("id", data.id);
          }
          navigate("/app/prestador/coco/online");
        } else if (data.status_aprovacao === "pending") {
          setPendingTruck(data);
          setIgnorarPendente(false);
          localStorage.removeItem("ignorarAutoSelecaoCaminhao");
        } else {
          setErro("Este veículo foi rejeitado. Entre em contato com a UBT.");
        }
      }
    } catch (err: any) {
      setErro(`Erro ao consultar placa: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const onEnviarSolicitacao = async () => {
    if (!apelido.trim()) {
      setErro("Por favor, informe o apelido/identificação do caminhão.");
      return;
    }
    setLoading(true);
    setErro("");

    try {
      const upperPlate = codigo.toUpperCase().trim();
      const semHifen = upperPlate.replace("-", "");
      const comHifen = semHifen.length > 3 ? `${semHifen.slice(0, 3)}-${semHifen.slice(3)}` : semHifen;

      const { data, error } = await supabase
        .from("coco_caminhoes")
        .insert({
          prestador_id: user.uid,
          plate: comHifen,
          apelido: apelido.trim(),
          areas_atendidas: selectedAreas,
          status_aprovacao: "pending",
          role_solicitada: roleSolicitada,
        })
        .select()
        .single();

      if (error) throw error;
      setPendingTruck(data);
      setShowApplyForm(false);
      localStorage.removeItem("ignorarAutoSelecaoCaminhao");
    } catch (err: any) {
      setErro(err.message || "Erro ao registrar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  if (pendingTruck && !ignorarPendente && activeTab === "caminhao") {
    return (
      <div
        className="relative text-zinc-100"
        style={{
          minHeight: "100svh",
          background: "var(--prestador-bg)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "var(--prestador-card)",
            borderRadius: 20,
            border: "1px solid var(--prestador-border)",
            padding: 32,
            textAlign: "center",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <Clock size={48} color="#F5A623" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>
            Aprovação Pendente
          </h2>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#A1A1AA", marginTop: 8, lineHeight: 1.5 }}>
            Sua solicitação de cadastro para o caminhão <strong>{pendingTruck.apelido}</strong> ({pendingTruck.plate}) foi enviada.
          </p>
          <div
            style={{
              marginTop: 16,
              background: "rgba(245,166,35,0.08)",
              border: "1px solid rgba(245,166,35,0.20)",
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              color: "#D97706",
              textAlign: "left",
              fontFamily: "DM Sans",
            }}
          >
            <strong>Status:</strong> Aguardando aprovação da gestão da Côco & Cia / UBT.
          </div>
          <button
            onClick={() => {
              localStorage.setItem("ignorarAutoSelecaoCaminhao", "true");
              setIgnorarPendente(true);
            }}
            style={{
              marginTop: 20,
              width: "100%",
              minHeight: 44,
              borderRadius: 999,
              background: "#0DB87E",
              border: "none",
              color: "white",
              fontFamily: "Syne",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(13,184,126,0.20)",
            }}
          >
            Cadastrar Outro Veículo
          </button>
          <button
            onClick={() => navigate("/app/prestador/home")}
            style={{
              marginTop: 10,
              width: "100%",
              minHeight: 44,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid #D8DBE5",
              color: "#A1A1AA",
              fontFamily: "DM Sans",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Voltar para a Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative text-zinc-100"
      style={{
        minHeight: "100svh",
        background: "var(--prestador-bg)",
        padding: "72px 24px 32px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="voltar"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </button>
        <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
          UBT.
        </span>
      </div>

      <div
        style={{
          background: "var(--prestador-card)",
          borderRadius: 20,
          border: "1px solid var(--prestador-border)",
          padding: 28,
          textAlign: "center",
          maxWidth: 460,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          {activeTab === "requerimento" ? (
            <Users size={38} color="#0DB87E" />
          ) : (
            <Truck size={38} color="#0DB87E" />
          )}
        </div>
        <p style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
          Côco & Cia — Vínculo & Frota
        </p>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", marginTop: 6 }}>
          {activeTab === "requerimento"
            ? "Envie seu requerimento com sua conta UBT para aprovação da equipe Côco & Cia."
            : showApplyForm
              ? "Preencha a ficha cadastral do caminhão para revisão."
              : "Associe-se a um caminhão para operar as coletas em campo."}
        </p>

        {/* Seletor de Abas: Requerimento de Colaborador vs Vincular Caminhão */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 20,
            padding: 4,
            borderRadius: 12,
            background: "var(--prestador-bg)",
            border: "1px solid var(--prestador-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("requerimento")}
            style={{
              padding: "9px 10px",
              borderRadius: 9,
              border: "none",
              background: activeTab === "requerimento" ? "#0DB87E" : "transparent",
              color: activeTab === "requerimento" ? "#FFFFFF" : "#A1A1AA",
              fontFamily: "Syne",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Requerimento (Conta UBT)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("caminhao")}
            style={{
              padding: "9px 10px",
              borderRadius: 9,
              border: "none",
              background: activeTab === "caminhao" ? "#0DB87E" : "transparent",
              color: activeTab === "caminhao" ? "#FFFFFF" : "#A1A1AA",
              fontFamily: "Syne",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Vincular Caminhão
          </button>
        </div>

        {/* ABA 1: REQUERIMENTO DE COLABORADOR (CONTA UBT -> APROVAÇÃO) */}
        {activeTab === "requerimento" && (
          <div style={{ marginTop: 22, textAlign: "left" }}>
            {colabReq && !resubmitMode ? (
              colabReq.status_aprovacao === "pendente" ? (
                <div style={{ textAlign: "center", padding: "12px 4px" }}>
                  <Clock size={44} color="#F5A623" style={{ margin: "0 auto 12px" }} />
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
                    Requerimento em Análise
                  </h3>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", marginTop: 8, lineHeight: 1.5 }}>
                    Seu requerimento como{" "}
                    <strong>
                      {colabReq.perfil === "alta_gestao"
                        ? "Alta Gestão"
                        : "Colaborador Administrativo"}
                    </strong>{" "}
                    foi enviado com sucesso e está aguardando aprovação em{" "}
                    <strong>Côco & Cia → Colaboradores</strong>.
                  </p>
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      background: "rgba(245,166,35,0.08)",
                      border: "1px solid rgba(245,166,35,0.25)",
                      fontSize: 12,
                      color: "#F5A623",
                      textAlign: "left",
                    }}
                  >
                    <div><strong>Nome:</strong> {colabReq.nome}</div>
                    <div><strong>Telefone:</strong> {colabReq.telefone || "—"}</div>
                    <div><strong>Conta UBT:</strong> {user.email || user.uid.slice(0, 8)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/app/prestador/home")}
                    style={{
                      marginTop: 18,
                      width: "100%",
                      minHeight: 42,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid var(--prestador-border)",
                      color: "#A1A1AA",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Voltar para a Home
                  </button>
                </div>
              ) : colabReq.status_aprovacao === "aprovado" ? (
                <div style={{ textAlign: "center", padding: "12px 4px" }}>
                  <CheckCircle size={44} color="#0DB87E" style={{ margin: "0 auto 12px" }} />
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
                    Vínculo Aprovado!
                  </h3>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", marginTop: 8, lineHeight: 1.5 }}>
                    Sua conta UBT está vinculada à Côco & Cia com o perfil{" "}
                    <strong style={{ color: "#0DB87E" }}>
                      {colabReq.perfil === "alta_gestao"
                        ? "Alta Gestão"
                        : "Colaborador Administrativo"}
                    </strong>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        colabReq.perfil === "alta_gestao"
                          ? "/admin/coco"
                          : "/admin/coco/mapa-operacional"
                      )
                    }
                    style={{
                      marginTop: 16,
                      width: "100%",
                      minHeight: 44,
                      borderRadius: 999,
                      background: "#0DB87E",
                      border: "none",
                      color: "white",
                      fontFamily: "Syne",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Acessar Painel Côco & Cia
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("caminhao")}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      minHeight: 42,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid var(--prestador-border)",
                      color: "#A1A1AA",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Vincular um Caminhão por Placa
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "12px 4px" }}>
                  <XCircle size={44} color="#E84040" style={{ margin: "0 auto 12px" }} />
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
                    Requerimento Não Aprovado
                  </h3>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", marginTop: 8 }}>
                    Seu último requerimento foi rejeitado pela gestão da Côco & Cia. Você pode revisar seus dados e enviar uma nova solicitação.
                  </p>
                  <button
                    type="button"
                    onClick={() => setResubmitMode(true)}
                    style={{
                      marginTop: 16,
                      width: "100%",
                      minHeight: 44,
                      borderRadius: 999,
                      background: "#0DB87E",
                      border: "none",
                      color: "white",
                      fontFamily: "Syne",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Enviar Novo Requerimento
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: "rgba(13,184,126,0.08)",
                    border: "1px solid rgba(13,184,126,0.22)",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12,
                    color: "#0DB87E",
                    fontFamily: "DM Sans",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <UserCheck size={16} />
                  <span>
                    Conta UBT conectada: <strong>{user.email || user.name}</strong>
                  </span>
                </div>

                <FormFieldLight
                  label="Nome Completo *"
                  icon={Users}
                  placeholder="Seu nome completo"
                  value={reqNome}
                  onChange={(e) => {
                    setReqNome(e.target.value);
                    setReqErro("");
                  }}
                />

                <FormFieldLight
                  label="Telefone / WhatsApp *"
                  icon={Phone}
                  placeholder="(12) 99888-7766"
                  value={reqTelefone}
                  onChange={(e) => {
                    setReqTelefone(formatPhoneRegexMask(e.target.value));
                    setReqErro("");
                  }}
                />

                <div>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#FFFFFF", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield size={13} color="#0DB87E" /> Perfil Solicitado
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setReqPerfil("colaborador_administrativo")}
                      style={{
                        borderRadius: 10,
                        padding: "10px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          reqPerfil === "colaborador_administrativo"
                            ? "#0DB87E"
                            : "var(--prestador-border)",
                        background:
                          reqPerfil === "colaborador_administrativo"
                            ? "rgba(13,184,126,0.15)"
                            : "var(--prestador-card)",
                        color: reqPerfil === "colaborador_administrativo" ? "#0DB87E" : "#A1A1AA",
                      }}
                    >
                      Colab. Administrativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqPerfil("alta_gestao")}
                      style={{
                        borderRadius: 10,
                        padding: "10px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          reqPerfil === "alta_gestao" ? "#0DB87E" : "var(--prestador-border)",
                        background:
                          reqPerfil === "alta_gestao"
                            ? "rgba(13,184,126,0.15)"
                            : "var(--prestador-card)",
                        color: reqPerfil === "alta_gestao" ? "#0DB87E" : "#A1A1AA",
                      }}
                    >
                      Alta Gestão
                    </button>
                  </div>
                </div>

                {reqErro && (
                  <div
                    style={{
                      background: "rgba(232,64,64,0.08)",
                      border: "1px solid rgba(232,64,64,0.20)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#E84040",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{reqErro}</span>
                  </div>
                )}

                <PrimaryButtonLight
                  onClick={onEnviarRequerimentoColaborador}
                  disabled={reqSubmitting || !user.uid}
                >
                  {reqSubmitting ? "Enviando Requerimento..." : "Enviar Requerimento para Aprovação"}
                </PrimaryButtonLight>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: VINCULAR CAMINHÃO POR PLACA */}
        {activeTab === "caminhao" && (
          <div style={{ marginTop: 22, textAlign: "left" }}>
            {!showApplyForm ? (
              <>
                <FormFieldLight
                  label="Placa ou Código do veículo"
                  icon={Truck}
                  placeholder="Ex: UBT-1234"
                  value={codigo}
                  onChange={(e) => setCodigo(formatarPlaca(e.target.value))}
                />
                <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#9399AD", marginTop: 6 }}>
                  Digite a placa do caminhão para verificar o cadastro ou registrar um novo.
                </p>

                {erro && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "rgba(232,64,64,0.08)",
                      border: "1px solid rgba(232,64,64,0.20)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#E84040",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{erro}</span>
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <PrimaryButtonLight onClick={onVerificarPlaca} disabled={!codigo || loading}>
                    {loading ? "Verificando..." : "Verificar Veículo"}
                  </PrimaryButtonLight>
                </div>

                <p
                  onClick={() => setShowHelp(true)}
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    color: "#0DB87E",
                    textAlign: "center",
                    marginTop: 16,
                    cursor: "pointer",
                  }}
                >
                  Sou novo na frota
                </p>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: "rgba(13,184,126,0.08)",
                    border: "1px solid rgba(13,184,126,0.15)",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12,
                    color: "#0C9562",
                    fontFamily: "DM Sans",
                  }}
                >
                  Placa <strong>{codigo}</strong> disponível! Complete o cadastro abaixo.
                </div>

                <FormFieldLight
                  label="Apelido/Nome do Caminhão"
                  icon={Truck}
                  placeholder="Ex: Trovão Verde"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                />

                <div>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#FFFFFF", marginBottom: 6, display: "block" }}>
                    Seu papel na ONG
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setRoleSolicitada("cocoecia-colaborador")}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        padding: "8px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          roleSolicitada === "cocoecia-colaborador"
                            ? "#0DB87E"
                            : "var(--prestador-border)",
                        background:
                          roleSolicitada === "cocoecia-colaborador"
                            ? "rgba(13,184,126,0.15)"
                            : "var(--prestador-card)",
                        color: roleSolicitada === "cocoecia-colaborador" ? "#0DB87E" : "#A1A1AA",
                      }}
                    >
                      Colaborador
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleSolicitada("cocoecia-dirigentes")}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        padding: "8px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          roleSolicitada === "cocoecia-dirigentes"
                            ? "#0DB87E"
                            : "var(--prestador-border)",
                        background:
                          roleSolicitada === "cocoecia-dirigentes"
                            ? "rgba(13,184,126,0.15)"
                            : "var(--prestador-card)",
                        color: roleSolicitada === "cocoecia-dirigentes" ? "#0DB87E" : "#A1A1AA",
                      }}
                    >
                      Alta Gestão
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#FFFFFF", marginBottom: 6, display: "block" }}>
                    Áreas Atendidas Inicialmente
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {NEIGHBORHOODS.map((n) => {
                      const sel = selectedAreas.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleArea(n)}
                          style={{
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: sel ? "#0DB87E" : "var(--prestador-border)",
                            background: sel ? "rgba(13,184,126,0.15)" : "var(--prestador-card)",
                            color: sel ? "#0DB87E" : "#A1A1AA",
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {erro && (
                  <div
                    style={{
                      background: "rgba(232,64,64,0.08)",
                      border: "1px solid rgba(232,64,64,0.20)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#E84040",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{erro}</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowApplyForm(false)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 999,
                      background: "transparent",
                      border: "1px solid var(--prestador-border)",
                      color: "#A1A1AA",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onEnviarSolicitacao}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 999,
                      background: "#0DB87E",
                      border: "none",
                      color: "white",
                      fontFamily: "Syne",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(13,184,126,0.20)",
                    }}
                  >
                    {loading ? "Enviando..." : "Solicitar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showHelp && (
        <>
          <div
            onClick={() => setShowHelp(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(11,27,62,0.5)",
              zIndex: 50,
            }}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              background: "var(--prestador-card)",
              borderRadius: "20px 20px 0 0",
              padding: 24,
              zIndex: 51,
              border: "1px solid var(--prestador-border)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "var(--prestador-border)",
                borderRadius: 999,
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
              Como entrar para a Côco & Cia
            </p>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#A1A1AA", marginTop: 8 }}>
              Na aba "Requerimento (Conta UBT)", envie seus dados e perfil para aprovação da equipe. Se você também opera um caminhão de coleta, informe a placa na aba "Vincular Caminhão".
            </p>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 20,
                width: "100%",
                minHeight: 44,
                borderRadius: 999,
                background: "transparent",
                border: "1px solid var(--prestador-border)",
                color: "#A1A1AA",
                fontFamily: "DM Sans",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CocoOnboardingPage;
