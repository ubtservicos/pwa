import { useState, useEffect, useRef } from "react";
import { MapPin, Recycle, Truck, Check, X, ShieldAlert } from "lucide-react";
import { Card, PrimaryButton, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { MapRef, LIGHT_TILES, ATTRIBUTION, UBATUBA_CENTER } from "@/components/UBTMap";
import { getPinIcon, getTruckIcon } from "@/utils/cocoIcons";
import { getMaterial } from "@/mocks/cocoMateriais";

export default function AdminCocoPage() {
  const toast = useAdminToast();
  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [pontos, setPontos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState(() => {
    try {
      return localStorage.getItem("coco_pix_fallback") || "coco@pix.com.br";
    } catch {
      return "coco@pix.com.br";
    }
  });

  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const fetchDados = async () => {
    try {
      // Buscar todos os caminhões
      const { data: dataCaminhoes, error: errC } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (errC) throw errC;
      if (dataCaminhoes) setCaminhoes(dataCaminhoes);

      // Buscar pontos de coleta pendentes/confirmados hoje
      const { data: dataPontos, error: errP } = await supabase
        .from("coco_pontos")
        .select("*")
        .in("status", ["aguardando", "confirmado"])
        .order("created_at", { ascending: false });
      
      if (errP) throw errP;
      if (dataPontos) setPontos(dataPontos);
    } catch (error: any) {
      console.error("Erro ao carregar dados do admin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();

    // Inscrever canais realtime para atualizações instantâneas no mapa e listas
    const channelCaminhoes = supabase
      .channel("admin-realtime-caminhoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_caminhoes" },
        () => {
          fetchDados();
        }
      )
      .subscribe();

    const channelPontos = supabase
      .channel("admin-realtime-pontos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_pontos" },
        () => {
          fetchDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelCaminhoes);
      supabase.removeChannel(channelPontos);
    };
  }, []);

  const salvarPixFallback = () => {
    try {
      localStorage.setItem("coco_pix_fallback", pixKey);
      toast.show("Chave Pix de fallback atualizada!");
    } catch (err) {
      toast.show("Erro ao salvar Pix");
    }
  };

  const aprovarCaminhao = async (caminhaoId: string, prestadorId: string, apelido: string, roleSolicitada?: string) => {
    const finalRole = roleSolicitada || "cocoecia-colaborador";
    try {
      // 1. Atualizar o caminhão para aprovado
      const { error: errorC } = await supabase
        .from("coco_caminhoes")
        .update({ status_aprovacao: "approved" })
        .eq("id", caminhaoId);

      if (errorC) throw errorC;

      // 2. Atualizar a role na tabela usuarios
      if (prestadorId) {
        const { error: errorU } = await supabase
          .from("usuarios")
          .update({ role: finalRole })
          .eq("id", prestadorId);
        
        if (errorU) console.warn("Erro ao atualizar role na tabela usuarios:", errorU);

        // 3. Atualizar a role na tabela profiles (se existir)
        const { error: errorP } = await supabase
          .from("profiles")
          .update({ role: finalRole })
          .eq("id", prestadorId);
        
        if (errorP) console.warn("Erro ao atualizar role na tabela profiles:", errorP);
      }

      toast.show(`Caminhão "${apelido}" aprovado como ${finalRole === "cocoecia-dirigentes" ? "Dirigente" : "Colaborador"}!`);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao aprovar: ${err.message}`);
    }
  };

  const rejeitarCaminhao = async (caminhaoId: string, apelido: string) => {
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ status_aprovacao: "rejected" })
        .eq("id", caminhaoId);

      if (error) throw error;

      toast.show(`Caminhão "${apelido}" foi rejeitado.`);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao rejeitar: ${err.message}`);
    }
  };

  const caminhoesPendentes = caminhoes.filter((c) => c.status_aprovacao === "pending");
  const caminhoesAprovados = caminhoes.filter((c) => c.status_aprovacao === "approved");
  const caminhoesOnline = caminhoesAprovados.filter((c) => c.is_online);

  return (
    <div style={{ padding: 32 }}>
      <style>{`
        @keyframes adminPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        .admin-pulse-active {
          animation: adminPulse 1.6s infinite ease-in-out;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 8, marginBottom: 20 }}>
        <Recycle size={28} color="#0DB87E" />
        <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Côco & Cia — Painel de Controle
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) 1fr", gap: 24 }}>
        {/* Coluna da Esquerda (Controle e Listas) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* Card de Configuração Pix Fallback */}
          <Card style={{ padding: 24 }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Chave Pix de Contingência</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "#475569", marginTop: 4 }}>
              Usada como chave de doação caso nenhum coletor esteja ativo no momento.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                style={inputStyle}
              />
              <PrimaryButton onClick={salvarPixFallback}>Salvar</PrimaryButton>
            </div>
          </Card>

          {/* Card de Solicitações Pendentes (Aprovações) */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldAlert size={18} color="#F5A623" />
                Aprovações Pendentes
              </div>
              <Pill bg={caminhoesPendentes.length > 0 ? "rgba(245,166,35,0.15)" : "#F1F5F9"} color={caminhoesPendentes.length > 0 ? "#F5A623" : "#94A3B8"} size="sm">
                {caminhoesPendentes.length}
              </Pill>
            </div>

            {loading ? (
              <div style={loadingStyle}>Carregando...</div>
            ) : caminhoesPendentes.length === 0 ? (
              <div style={emptyCardStyle}>
                <span style={{ fontSize: 24, marginBottom: 6 }}>🌱</span>
                <p style={{ margin: 0, fontWeight: 600 }}>Tudo em dia!</p>
                <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Nenhuma solicitação pendente no momento.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {caminhoesPendentes.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                          {c.apelido}
                        </span>
                        <span style={{ background: "#E2E8F0", fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#0F172A", borderRadius: 6, padding: "2px 6px" }}>
                          {c.plate}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>
                        <strong>Função:</strong> {c.role_solicitada === "cocoecia-dirigentes" ? "💼 Dirigente" : "🚚 Colaborador"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>
                        <strong>Bairros:</strong> {c.areas_atendidas?.join(", ") || "Nenhum"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>
                        <strong>Pix:</strong> {c.pix_key || "Não informada (Colaborador)"}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => aprovarCaminhao(c.id, c.prestador_id, c.apelido, c.role_solicitada)}
                        style={{
                          flex: 1,
                          height: 32,
                          background: "#0DB87E",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <Check size={14} /> Aprovar
                      </button>
                      <button
                        onClick={() => rejeitarCaminhao(c.id, c.apelido)}
                        style={{
                          height: 32,
                          padding: "0 10px",
                          background: "transparent",
                          color: "#E84040",
                          border: "1px solid #E84040",
                          borderRadius: 8,
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4
                        }}
                      >
                        <X size={14} /> Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card de Caminhões Aprovados */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Veículos da Frota</div>
              <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                {caminhoesAprovados.length}
              </Pill>
            </div>
            
            {loading ? (
              <div style={loadingStyle}>Carregando...</div>
            ) : caminhoesAprovados.length === 0 ? (
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", textAlign: "center", margin: 0, padding: 12 }}>
                Nenhum veículo aprovado ainda.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {caminhoesAprovados.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <span style={{ background: "#F1F5F9", fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "#0F172A", borderRadius: 6, padding: "3px 8px" }}>
                      {t.plate}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.apelido}
                      </p>
                      <p style={{ margin: 0, fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.areas_atendidas?.join(", ") || "Sem área"}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        className={t.is_online ? "admin-pulse-active" : ""}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: t.is_online ? "#0DB87E" : "#94A3B8",
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontFamily: "DM Sans", fontSize: 12, color: t.is_online ? "#0DB87E" : "#94A3B8", fontWeight: 500 }}>
                        {t.is_online ? "Online" : "Offline"}
                      </span>
                    </div>
                    <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8", minWidth: 68, textAlign: "right" }}>
                      Hoje: {t.collections_today || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card de Pontos de Coleta Ativos */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Coletas Pendentes Hoje</div>
              <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                {pontos.length}
              </Pill>
            </div>
            
            {loading ? (
              <div style={loadingStyle}>Carregando...</div>
            ) : pontos.length === 0 ? (
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", textAlign: "center", margin: 0, padding: 12 }}>
                Nenhum ponto aguardando coleta no momento.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                {pontos.map((p) => {
                  const m = getMaterial(p.material);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setFocusPoint({ lat: Number(p.lat), lng: Number(p.lng) });
                        mapRef.current?.flyTo([Number(p.lat), Number(p.lng)], 16);
                      }}
                      style={pontoBtnStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <MapPin size={14} color={p.status === "confirmado" ? "#0DB87E" : "#F5A623"} />
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0F172A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.address}
                      </span>
                      <Pill bg={p.status === "confirmado" ? "rgba(13,184,126,0.1)" : "rgba(245,166,35,0.1)"} color={p.status === "confirmado" ? "#0DB87E" : "#F5A623"} size="sm">
                        {m.emoji} {m.nome.split("/")[0]}
                      </Pill>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Coluna da Direita (Mapa Real) */}
        <Card
          style={{
            overflow: "hidden",
            position: "relative",
            background: "#E8ECF2",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #E2E8F0",
            minHeight: 600
          }}
        >
          <div style={{ height: "100%", width: "100%", position: "relative", flex: 1 }}>
            <MapContainer
              center={UBATUBA_CENTER}
              zoom={14}
              style={{ width: "100%", height: "100%", minHeight: 600 }}
              zoomControl={true}
            >
              <TileLayer url={LIGHT_TILES} attribution={ATTRIBUTION} />
              <MapRef mapRef={mapRef} />

              {/* Renderizar marcadores de caminhões online */}
              {caminhoesAprovados
                .filter((c) => c.is_online && c.lat && c.lng)
                .map((c) => (
                  <Marker
                    key={c.id}
                    position={[Number(c.lat), Number(c.lng)]}
                    icon={getTruckIcon(true, true)}
                  >
                    <Popup>
                      <div style={{ fontFamily: "DM Sans", minWidth: 150 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0F172A" }}>
                          🚚 {c.apelido}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>
                          Placa: {c.plate}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>
                          Bairros: {c.areas_atendidas?.join(", ") || "Nenhum"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#0DB87E", fontWeight: 600 }}>
                          Coletas hoje: {c.collections_today || 0}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* Renderizar marcadores dos pontos de coleta */}
              {pontos.map((p) => {
                const m = getMaterial(p.material);
                const caminhaoAssociado = caminhoesAprovados.find(c => c.id === p.caminhao_id);
                return (
                  <Marker
                    key={p.id}
                    position={[Number(p.lat), Number(p.lng)]}
                    icon={getPinIcon(p.material)}
                  >
                    <Popup>
                      <div style={{ padding: 4, minWidth: 200, fontFamily: "DM Sans" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: "0 0 4px" }}>
                          {p.address}
                        </p>
                        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 6px" }}>
                          {m.emoji} {m.nome}
                        </p>
                        
                        {/* Foto / Preset */}
                        <div style={{ marginBottom: 8 }}>
                          {p.foto_url ? (
                            p.foto_url.startsWith("preset_") ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6 }}>
                                <span style={{ fontSize: 18 }}>
                                  {p.foto_url === "preset_saco_verde" ? "🟢" : p.foto_url === "preset_caixa_papelao" ? "📦" : "🗑️"}
                                </span>
                                <span style={{ fontSize: 11, color: "#0F172A", fontWeight: 600 }}>
                                  {p.foto_url === "preset_saco_verde" ? "Saco Verde" : p.foto_url === "preset_caixa_papelao" ? "Caixa Papelão" : "Caixote Plástico"}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={p.foto_url}
                                alt="Foto embalagem"
                                style={{ width: "100%", maxHeight: 110, borderRadius: 6, objectFit: "cover", border: "1px solid #E2E8F0" }}
                              />
                            )
                          ) : (
                            <p style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", margin: 0 }}>Sem foto da embalagem</p>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span
                            style={{
                              alignSelf: "flex-start",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 600,
                              background: p.status === "confirmado" ? "rgba(13,184,126,0.1)" : "rgba(245,166,35,0.1)",
                              color: p.status === "confirmado" ? "#0DB87E" : "#F5A623",
                            }}
                          >
                            {p.status === "confirmado" ? "🚚 A caminho" : "⏳ Aguardando"}
                          </span>

                          {p.status === "confirmado" && caminhaoAssociado && (
                            <p style={{ fontSize: 11, color: "#475569", margin: "4px 0 0" }}>
                              Caminhão: <strong>{caminhaoAssociado.apelido}</strong>
                            </p>
                          )}
                          {p.status === "confirmado" && p.horario_previsto && (
                            <p style={{ fontSize: 11, color: "#0DB87E", fontWeight: 600, margin: "2px 0 0" }}>
                              ⏰ Previsto: {p.horario_previsto}
                            </p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
          
          <div style={mapOverlayStyle}>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0DB87E" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>
                  {caminhoesOnline.length} Caminhões Online
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#F5A623" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>
                  {pontos.filter(p => p.status === "aguardando").length} Aguardando
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0DB87E" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>
                  {pontos.filter(p => p.status === "confirmado").length} Coletando
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  height: 40,
  padding: "0 14px",
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "#0F172A",
  outline: "none",
};

const loadingStyle = {
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "#94A3B8",
  textAlign: "center" as const,
  padding: "24px 0",
};

const emptyCardStyle = {
  border: "2px dashed #E2E8F0",
  borderRadius: 12,
  padding: "20px 14px",
  textAlign: "center" as const,
  fontFamily: "DM Sans",
  fontSize: 13,
  color: "#475569",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center"
};

const pontoBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 6px",
  width: "100%",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  textAlign: "left" as const,
  transition: "background 200ms",
};

const mapOverlayStyle = {
  background: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(4px)",
  borderTop: "1px solid #E2E8F0",
  padding: "10px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontFamily: "DM Sans"
};
