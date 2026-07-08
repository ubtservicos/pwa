import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Recycle, ArrowLeft, Info, MapPin, Wallet, Users, RefreshCw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

const NEIGHBORHOODS = ["Centro", "Itaguá", "Perequê-Açu", "Praia Grande", "Tenório", "Toninhas"];

const ConfigCocoPage = () => {
  const t = useTheme();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { toast, showToast } = useSimpleToast();

  const [caminhaoId, setCaminhaoId] = useState<string>(() => {
    try {
      return localStorage.getItem("caminhaoId") || "";
    } catch {
      return "";
    }
  });

  const [caminhao, setCaminhao] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [tempPixKey, setTempPixKey] = useState("");
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch truck data
  useEffect(() => {
    if (!caminhaoId) {
      setLoading(false);
      return;
    }

    const fetchCaminhao = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("coco_caminhoes")
          .select("*")
          .eq("id", caminhaoId)
          .single();

        if (error) throw error;
        if (data) {
          setCaminhao(data);
          setSelectedAreas(data.areas_atendidas || ["Centro"]);
          setTempPixKey(data.pix_key || "");
        }
      } catch (err) {
        console.error("Erro ao buscar caminhão:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCaminhao();
  }, [caminhaoId]);

  // Fetch team members if user is dirigente
  useEffect(() => {
    if (!caminhaoId || user.role !== "cocoecia-dirigentes") return;

    const fetchEquipe = async () => {
      setLoadingEquipe(true);
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select("id, nome, email, role")
          .in("role", ["cocoecia", "cocoecia-colaborador", "cocoecia-dirigentes"])
          .order("nome", { ascending: true });

        if (error) throw error;
        if (data) setEquipe(data);
      } catch (err) {
        console.error("Erro ao buscar equipe da ONG:", err);
      } finally {
        setLoadingEquipe(false);
      }
    };

    fetchEquipe();
  }, [caminhaoId, user.role]);

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const alterarRoleMembro = async (membroId: string, novaRole: string) => {
    try {
      const { error: errU } = await supabase
        .from("usuarios")
        .update({ role: novaRole })
        .eq("id", membroId);

      if (errU) throw errU;

      const { error: errP } = await supabase
        .from("profiles")
        .update({ role: novaRole })
        .eq("id", membroId);

      if (errP) console.warn("Erro ao atualizar profiles do membro:", errP);

      showToast("Função alterada com sucesso!");
      
      // Update local state
      setEquipe((prev) =>
        prev.map((m) => (m.id === membroId ? { ...m, role: novaRole } : m))
      );
    } catch (err: any) {
      alert("Erro ao alterar função: " + err.message);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!caminhaoId) return;
    setSaving(true);
    try {
      const updateData: any = { areas_atendidas: selectedAreas };
      if (user.role === "cocoecia-dirigentes") {
        updateData.pix_key = tempPixKey.trim();
      }

      const { error } = await supabase
        .from("coco_caminhoes")
        .update(updateData)
        .eq("id", caminhaoId);

      if (error) throw error;
      setCaminhao((prev: any) => ({ ...prev, ...updateData }));
      showToast("🗺️ Configurações salvas com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const desconectarVeiculo = async () => {
    if (!window.confirm("Deseja desconectar deste veículo? Você ficará offline automaticamente.")) return;
    try {
      // Set offline in DB first if it was online
      if (caminhao && caminhao.is_online) {
        await supabase
          .from("coco_caminhoes")
          .update({ is_online: false })
          .eq("id", caminhaoId);
      }

      localStorage.removeItem("caminhaoId");
      localStorage.setItem("ignorarAutoSelecaoCaminhao", "true");
      
      setCaminhaoId("");
      setCaminhao(null);
      showToast("Veículo desconectado");
    } catch (err) {
      console.error("Erro ao desconectar veículo:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ background: t.bg, minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "DM Sans", color: t.subtle }}>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 96px" }}>
        <PageHeader title="Côco & Cia" onBack={() => navigate("/app/config")} />

        {!caminhaoId ? (
          <div
            style={{
              background: t.surface,
              borderRadius: 20,
              padding: 32,
              textAlign: "center",
              marginTop: 24,
              border: `1px solid ${t.border}`,
              boxShadow: t.isDark ? "none" : "0 4px 12px rgba(11,27,62,0.05)"
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: "rgba(13,184,126,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px"
              }}
            >
              <Recycle size={32} color="#0DB87E" />
            </div>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>
              Nenhum Veículo Selecionado
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: t.subtle, lineHeight: "20px", margin: "0 0 24px" }}>
              Você precisa selecionar um veículo na Central do Coletor para ver e gerenciar as configurações da ONG.
            </p>
            <button
              onClick={() => navigate("/app/prestador/coco/online")}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "#0DB87E",
                color: "#FFF",
                border: "none",
                fontFamily: "Syne",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(13,184,126,0.2)"
              }}
            >
              Ir para Central do Coletor
            </button>
          </div>
        ) : (
          <>
            {/* Info do caminhão selecionado */}
            <div
              style={{
                background: t.surface,
                borderRadius: 16,
                padding: 16,
                border: `1px solid ${t.border}`,
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 14
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "rgba(13,184,126,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Recycle size={24} color="#0DB87E" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                  {caminhao?.apelido || "Caminhão Selecionado"}
                </h4>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: "2px 0 0" }}>
                  Placa: {caminhao?.plate || "Sem placa"} • {caminhao?.is_online ? "🟢 Online" : "🔴 Offline"}
                </p>
              </div>
            </div>

            {/* Bairros de Atendimento */}
            <SectionHeader>Regiões de Atendimento</SectionHeader>
            <SettingsGroup style={{ padding: 20 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: "0 0 16px", lineHeight: "18px" }}>
                Selecione as regiões de Ubatuba que este caminhão atende atualmente.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {NEIGHBORHOODS.map((n) => {
                  const sel = selectedAreas.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleArea(n)}
                      style={{
                        borderRadius: 10,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: sel ? "#0DB87E" : t.border,
                        background: sel ? "rgba(13,184,126,0.08)" : t.inputBg,
                        color: sel ? "#0DB87E" : t.subtle,
                        transition: "all 200ms"
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </SettingsGroup>

            {/* Chave Pix para Doações */}
            <SectionHeader>Chave Pix para Doações</SectionHeader>
            <SettingsGroup style={{ padding: 20 }}>
              {user.role === "cocoecia-dirigentes" ? (
                <div>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: "0 0 12px", lineHeight: "18px" }}>
                    Como dirigente, você pode definir e atualizar a chave Pix da ONG para receber doações.
                  </p>
                  <input
                    type="text"
                    placeholder="Chave Pix (Celular, CNPJ, Email ou Chave Aleatória)"
                    value={tempPixKey}
                    onChange={(e) => setTempPixKey(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1px solid ${t.inputBdr}`,
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      color: t.text,
                      outline: "none",
                      background: t.inputBg
                    }}
                  />
                </div>
              ) : (
                <div>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: "0 0 12px", lineHeight: "18px" }}>
                    Chave Pix da ONG configurada para este caminhão. Apenas dirigentes podem alterá-la.
                  </p>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      background: t.inputBg,
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      color: t.text,
                      wordBreak: "break-all"
                    }}
                  >
                    {caminhao?.pix_key || "Nenhuma chave cadastrada"}
                  </div>
                </div>
              )}
            </SettingsGroup>

            {/* Gerenciamento da Equipe (Apenas Dirigente) */}
            {user.role === "cocoecia-dirigentes" && (
              <>
                <SectionHeader>Gerenciamento da Equipe</SectionHeader>
                <SettingsGroup style={{ padding: 20 }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: "0 0 16px", lineHeight: "18px" }}>
                    Altere as funções e permissões dos membros da ONG Côco & Cia.
                  </p>
                  {loadingEquipe ? (
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.muted }}>Carregando membros...</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {equipe.map((membro) => {
                        const isMe = membro.id === user.uid;
                        return (
                          <div
                            key={membro.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              background: t.inputBg,
                              borderRadius: 10,
                              border: `1px solid ${t.border}`
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                              <p
                                style={{
                                  fontFamily: "DM Sans",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: t.text,
                                  margin: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {membro.nome || "Sem nome"} {isMe && " (Você)"}
                              </p>
                              <p
                                style={{
                                  fontFamily: "DM Sans",
                                  fontSize: 11,
                                  color: t.subtle,
                                  margin: "2px 0 0",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {membro.email}
                              </p>
                            </div>
                            <div>
                              <select
                                value={membro.role}
                                disabled={isMe}
                                onChange={(e) => alterarRoleMembro(membro.id, e.target.value)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: `1px solid ${t.inputBdr}`,
                                  background: isMe ? "rgba(0,0,0,0.05)" : t.surface,
                                  fontFamily: "DM Sans",
                                  fontSize: 12,
                                  color: t.text,
                                  cursor: isMe ? "not-allowed" : "pointer",
                                  outline: "none"
                                }}
                              >
                                <option value="cocoecia-colaborador">Colaborador</option>
                                <option value="cocoecia-dirigentes">Dirigente</option>
                                <option value="cocoecia">Membro Comum</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SettingsGroup>
              </>
            )}

            {/* Veículo Opções */}
            <SectionHeader>Opções de Veículo</SectionHeader>
            <SettingsGroup style={{ padding: 20 }}>
              <button
                type="button"
                onClick={desconectarVeiculo}
                style={{
                  width: "100%",
                  minHeight: 44,
                  borderRadius: 10,
                  background: "rgba(232,64,64,0.08)",
                  border: "1px solid rgba(232,64,64,0.15)",
                  color: "#E84040",
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <RefreshCw size={16} /> Desconectar e Selecionar Outro Veículo
              </button>
            </SettingsGroup>

            {/* Salvar Configurações */}
            <button
              onClick={salvarConfiguracoes}
              disabled={saving}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 12,
                background: "#0DB87E",
                color: "white",
                border: "none",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(13,184,126,0.2)",
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </>
        )}
      </div>
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigCocoPage;
