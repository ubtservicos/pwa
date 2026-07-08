import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Truck, Key, Check, CheckCircle, Clock } from "lucide-react";
import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const NEIGHBORHOODS = ["Centro", "Itaguá", "Perequê-Açu", "Praia Grande", "Tenório", "Toninhas"];

const formatarPlaca = (val: string) => {
  const limpo = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (limpo.length <= 3) return limpo;
  return `${limpo.slice(0, 3)}-${limpo.slice(3, 7)}`;
};

const CocoOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  // Form for new truck application
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [apelido, setApelido] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [roleSolicitada, setRoleSolicitada] = useState<"cocoecia-colaborador" | "cocoecia-dirigentes">("cocoecia-colaborador");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(["Centro"]);
  const [pendingTruck, setPendingTruck] = useState<any | null>(null);
  const [ignorarPendente, setIgnorarPendente] = useState(false);

  // Check if this user already has a pending truck request on mount/load
  useEffect(() => {
    if (!user.uid) return;

    if (localStorage.getItem("ignorarAutoSelecaoCaminhao") === "true") {
      return;
    }

    const checkPending = async () => {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .eq("prestador_id", user.uid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const truck = data[0];
        if (truck.status_aprovacao === "approved") {
          localStorage.setItem("caminhaoId", truck.id);
          localStorage.removeItem("ignorarAutoSelecaoCaminhao");
          navigate("/app/prestador/coco/online");
        } else {
          setPendingTruck(truck);
        }
      }
    };

    checkPending();
  }, [user.uid]);

  const onVerificarPlaca = async () => {
    if (!codigo.trim()) return;
    console.log("[Onboarding] Iniciando onVerificarPlaca. Placa digitada:", codigo);
    setLoading(true);
    setErro("");
    try {
      const upperPlate = codigo.toUpperCase().trim();
      const semHifen = upperPlate.replace("-", "");
      const comHifen = semHifen.length > 3 ? `${semHifen.slice(0, 3)}-${semHifen.slice(3)}` : semHifen;
      
      console.log("[Onboarding] Chamando Supabase para consultar a placa:", { comHifen, semHifen });
      
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .or(`plate.eq.${comHifen},plate.eq.${semHifen}`)
        .maybeSingle();

      console.log("[Onboarding] Supabase respondeu:", { data, error });

      if (error || !data) {
        console.log("[Onboarding] Placa não encontrada (ou sem correspondência). Habilitando formulário de cadastro...");
        setShowApplyForm(true);
      } else {
        console.log("[Onboarding] Caminhão encontrado:", data);
        if (data.status_aprovacao === "approved") {
          localStorage.setItem("caminhaoId", data.id);
          localStorage.removeItem("ignorarAutoSelecaoCaminhao");
          if (!data.prestador_id) {
            console.log("[Onboarding] Associando prestador ao caminhão...");
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
      console.error("[Onboarding] Erro fatal capturado no catch:", err);
      setErro(`Erro ao consultar placa: ${err.message || err}`);
    } finally {
      console.log("[Onboarding] Finalizando consulta da placa (finally).");
      setLoading(false);
    }
  };

  const onEnviarSolicitacao = async () => {
    if (!apelido.trim() || (roleSolicitada === "cocoecia-dirigentes" && !pixKey.trim())) {
      setErro("Por favor, preencha todos os campos.");
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
          pix_key: roleSolicitada === "cocoecia-dirigentes" ? pixKey.trim() : null,
          areas_atendidas: selectedAreas,
          status_aprovacao: "pending",
          role_solicitada: roleSolicitada
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

  if (pendingTruck && !ignorarPendente) {
    return (
      <div
        className="relative"
        style={{
          minHeight: "100svh",
          background: "#F7F8FA",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 20,
            boxShadow: "0 4px 24px rgba(11,27,62,0.10)",
            padding: 32,
            textAlign: "center",
            maxWidth: 400,
            width: "100%"
          }}
        >
          <Clock size={48} color="#F5A623" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0B1B3E" }}>
            Aprovação Pendente
          </h2>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#5B6178", marginTop: 8, lineHeight: 1.5 }}>
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
              fontFamily: "DM Sans"
            }}
          >
            <strong>Status:</strong> Aguardando aprovação do superadmin da empresa UBT. Após aprovação, você terá acesso completo para operar na plataforma.
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
              boxShadow: "0 4px 12px rgba(13,184,126,0.20)"
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
              color: "#5B6178",
              fontFamily: "DM Sans",
              fontSize: 14,
              cursor: "pointer"
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
      className="relative"
      style={{
        minHeight: "100svh",
        background: "#F7F8FA",
        padding: 24,
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
          <ArrowLeft size={20} color="#0B1B3E" />
        </button>
        <span
          style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E" }}
        >
          UBT.
        </span>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 4px 24px rgba(11,27,62,0.10)",
          padding: 32,
          textAlign: "center",
          maxWidth: 420,
          margin: "0 auto",
          width: "100%"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Truck size={40} color="#0DB87E" />
        </div>
        <p style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0B1B3E" }}>
          Côco & Cia Onboarding
        </p>
        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#5B6178", marginTop: 6 }}>
          {showApplyForm 
            ? "Preencha a ficha cadastral do caminhão para revisão da UBT." 
            : "Associe-se a um caminhão para começar a registrar suas coletas."
          }
        </p>

        <div style={{ marginTop: 28, textAlign: "left" }}>
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
              <div style={{ background: "rgba(13,184,126,0.08)", border: "1px solid rgba(13,184,126,0.15)", borderRadius: 10, padding: 12, fontSize: 12, color: "#0C9562", fontFamily: "DM Sans" }}>
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
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#0B1B3E", marginBottom: 6, display: "block" }}>
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
                      borderColor: roleSolicitada === "cocoecia-colaborador" ? "#0DB87E" : "#D8DBE5",
                      background: roleSolicitada === "cocoecia-colaborador" ? "rgba(13,184,126,0.08)" : "white",
                      color: roleSolicitada === "cocoecia-colaborador" ? "#0DB87E" : "#5B6178",
                      transition: "all 200ms"
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
                      borderColor: roleSolicitada === "cocoecia-dirigentes" ? "#0DB87E" : "#D8DBE5",
                      background: roleSolicitada === "cocoecia-dirigentes" ? "rgba(13,184,126,0.08)" : "white",
                      color: roleSolicitada === "cocoecia-dirigentes" ? "#0DB87E" : "#5B6178",
                      transition: "all 200ms"
                    }}
                  >
                    Dirigente
                  </button>
                </div>
                <p style={{ fontFamily: "DM Sans", fontSize: 10, color: "#9399AD", marginTop: 4 }}>
                  {roleSolicitada === "cocoecia-dirigentes"
                    ? "Dirigentes cadastram a chave Pix da ONG para receber doações e podem gerenciar a equipe."
                    : "Colaboradores (motoristas/coletores) realizam rotas, mas não definem o Pix da ONG."}
                </p>
              </div>

              {roleSolicitada === "cocoecia-dirigentes" && (
                <FormFieldLight
                  label="Chave Pix da ONG/Caminhão"
                  icon={Key}
                  placeholder="Chave para receber doações"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              )}

              <div>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#0B1B3E", marginBottom: 6, display: "block" }}>
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
                          borderColor: sel ? "#0DB87E" : "#D8DBE5",
                          background: sel ? "rgba(13,184,126,0.10)" : "white",
                          color: sel ? "#0DB87E" : "#5B6178",
                          transition: "all 200ms"
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
                    border: "1px solid #D8DBE5",
                    color: "#5B6178",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    cursor: "pointer"
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
                    boxShadow: "0 4px 12px rgba(13,184,126,0.20)"
                  }}
                >
                  {loading ? "Enviando..." : "Solicitar"}
                </button>
              </div>
            </div>
          )}
        </div>
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
              background: "white",
              borderRadius: "20px 20px 0 0",
              padding: 24,
              zIndex: 51,
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "#D8DBE5",
                borderRadius: 999,
                margin: "0 auto 16px",
              }}
            />
            <p
              style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E" }}
            >
              Como entrar para a frota
            </p>
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 14,
                color: "#5B6178",
                marginTop: 8,
              }}
            >
              Insira a placa na tela anterior. Se o veículo não estiver cadastrado, você poderá preencher os dados da sua ONG/Caminhão. O cadastro será analisado pelo superadmin da UBT e aprovado em instantes!
            </p>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 20,
                width: "100%",
                minHeight: 44,
                borderRadius: 999,
                background: "transparent",
                border: "1px solid #D8DBE5",
                color: "#5B6178",
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
