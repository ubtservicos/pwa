import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MapPin, DollarSign, Ruler } from "lucide-react";
import { MOCK_DIARISTAS, AVALIACOES_MOCK } from "@/mocks/diaristasMock";
import { MATERIAIS_PADRAO, MATERIAIS_DETALHADOS } from "@/mocks/diaristasMateriais";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"];

const DiaristaPerfilPage = () => {
  const navigate = useNavigate();
  const { prestadorId } = useParams<{ prestadorId: string }>();
  const [diarista, setDiarista] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!prestadorId) return;
      const { data } = await supabase.from('diarista_perfis').select('*').eq('user_id', prestadorId).maybeSingle();
      if (data) {
        setDiarista({
          uid: data.user_id,
          nome: data.nome || "Diarista",
          sexo: data.sexo,
          valorPorM2: Number(data.valor_por_m2),
          minimoM2: Number(data.minimo_m2),
          rating: Number(data.rating) || 5,
          totalServicos: Number(data.total_servicos) || 0,
          bairro: data.endereco || "Centro",
          location: { lat: -23.432, lng: -45.083 },
          materiais: data.materiais || [],
          materiais_detalhes: data.materiais_detalhes || [],
          disponibilidade: data.disponibilidade || {},
          horarios_por_dia: data.horarios_por_dia || {},
          horarios: data.horarios_por_dia ? Object.values(data.horarios_por_dia)[0] : []
        });
      }
      setLoading(false);
    }
    load();
  }, [prestadorId]);

  const [m2Input, setM2Input] = useState("");
  const [showKitModal, setShowKitModal] = useState(false);

  const valorKit = useMemo(() => {
    if (!diarista) return 0;
    if (diarista.materiais_detalhes && diarista.materiais_detalhes.length > 0) {
      return diarista.materiais_detalhes
        .filter((m: any) => m.ativo)
        .reduce((acc: number, m: any) => acc + Number(m.precoEditado || 0), 0);
    }
    return diarista.materiais.includes("produtos") ? 8.00 : 0;
  }, [diarista]);

  if (loading) return <div style={{ padding: 24, color: "white", background: "#09090B", minHeight: "100svh" }}>Carregando...</div>;

  if (!diarista) {
    return (
      <div style={{ background: "#09090B", minHeight: "100svh", color: "white", padding: 24 }}>
        <button onClick={() => navigate("/app/diaristas")} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>
          <ArrowLeft size={22} />
        </button>
        <p style={{ marginTop: 24, fontFamily: "DM Sans" }}>Diarista não encontrada.</p>
      </div>
    );
  }

  const initials = diarista.nome.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const estimativa = m2Input ? (+m2Input * diarista.valorPorM2).toFixed(2) : null;

  return (
    <div style={{ background: "#09090B", minHeight: "100svh", paddingBottom: 100 }}>
      <header style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>Perfil</h1>
      </header>

      <div style={{ height: 150, background: "linear-gradient(135deg,#132348,#1C3261)", position: "relative", marginTop: 20 }}>
        <div style={{ position: "absolute", bottom: -34, left: 24, width: 68, height: 68, borderRadius: 999, background: "rgba(13,184,126,0.20)", border: "3px solid #0DB87E", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0DB87E" }}>{initials}</span>
        </div>
        <button
          onClick={() => navigate(`/app/diaristas/agendar/${prestadorId}`)}
          style={{ position: "absolute", bottom: -20, right: 24, background: "#0DB87E", color: "white", border: "none", borderRadius: 999, padding: "10px 24px", fontFamily: "Syne", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Continuar
        </button>
      </div>

      <div style={{ padding: "0 24px", marginTop: 46 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>{diarista.nome}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <MapPin size={14} color="#0DB87E" />
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{diarista.bairro}, Ubatuba</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          {Array.from({ length: Math.round(diarista.rating) }).map((_, i) => (
            <span key={i} style={{ color: "#F5A623", fontSize: 14 }}>★</span>
          ))}
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", marginLeft: 2 }}>{diarista.rating}</span>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            ({diarista.totalServicos} serviços concluídos)
          </span>
        </div>
        {diarista.sexo === "feminino" && (
          <span style={{ display: "inline-block", marginTop: 8, background: "rgba(155,89,182,0.15)", border: "1px solid rgba(155,89,182,0.30)", borderRadius: 999, padding: "2px 10px", fontFamily: "DM Sans", fontSize: 11, color: "#9B59B6" }}>
            👩 Feminino
          </span>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, margin: "20px 24px 0" }}>
        <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", letterSpacing: 1, margin: "0 0 14px 0" }}>Precificação</p>
        
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "white" }}>Valor Base</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, color: "#0DB87E" }}>
              R$ {diarista.valorPorM2.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>/m²</span>
            </span>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "4px 0 12px 0" }}>
            Área mínima exigida de {diarista.minimoM2}m² (Mínimo de R$ {(diarista.minimoM2 * diarista.valorPorM2).toFixed(2)})
          </p>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.3 }}>
              <strong>+ Kit de Limpeza:</strong> você poderá escolher quais materiais e produtos deseja incluir no próximo passo.
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 16 }}>
          <p style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "#0DB87E", margin: "0 0 4px 0" }}>⚡ Simular Orçamento</p>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 12px 0" }}>Insira a metragem (m²) do seu imóvel para calcular uma estimativa base:</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(13,184,126,0.05)", border: "1px solid rgba(13,184,126,0.2)", borderRadius: 10, padding: "10px 14px" }}>
              <input
                type="number"
                value={m2Input}
                onChange={(e) => setM2Input(e.target.value)}
                placeholder="Ex: 60"
                style={{ width: 80, height: 38, textAlign: "center", fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, color: "white", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, outline: "none" }}
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>metros quadrados do imóvel</span>
            </div>

            {m2Input && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Diária Estimada (Base):</span>
                  <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0DB87E" }}>
                    R$ {(+m2Input * diarista.valorPorM2).toFixed(2)}
                  </span>
                </div>
                <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "4px 0 0 0", lineHeight: 1.3 }}>
                  *Não inclui taxas adicionais de kit de limpeza (detalhado ao agendar).
                </p>
                {+m2Input < diarista.minimoM2 && (
                  <p style={{ color: "#E74C3C", fontSize: 11, fontFamily: "DM Sans", margin: "4px 0 0 0", fontWeight: 600 }}>
                    ⚠️ Abaixo da área mínima de {diarista.minimoM2}m²
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px", marginTop: 16 }}>
        <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", letterSpacing: 1, margin: 0 }}>Dias disponíveis</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginTop: 8 }}>
          {DIAS.map((dia, i) => {
            const ok = diarista.disponibilidade[dia];
            return (
              <div key={dia} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{LETRAS[i]}</span>
                <div style={{ width: 36, height: 36, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.04)", border: ok ? "1px solid rgba(13,184,126,0.30)" : "none" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: ok ? 600 : 400, color: ok ? "#0DB87E" : "rgba(255,255,255,0.20)" }}>
                    {LETRAS[i]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 24px", marginTop: 16 }}>
        <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", letterSpacing: 1, margin: 0 }}>Avaliações recentes</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {AVALIACOES_MOCK.map((a, i) => {
            const ini = a.nome.split(" ").map((n) => n[0]).slice(0, 2).join("");
            return (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: "#0DB87E" }}>{ini}</span>
                  </div>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "white", flex: 1 }}>{a.nome}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.40)" }}>{a.data}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {Array.from({ length: a.nota }).map((_, k) => (
                    <span key={k} style={{ color: "#F5A623", fontSize: 12 }}>★</span>
                  ))}
                </div>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>
                  {a.texto}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => navigate(`/app/diaristas/agendar/${prestadorId}`)}
        style={{ position: "fixed", bottom: 64, left: 0, right: 0, background: "#0DB87E", minHeight: 52, borderRadius: "16px 16px 0 0", padding: "0 24px", border: "none", fontFamily: "Syne", fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer", zIndex: 10 }}
      >
        Continuar
      </button>

      {showKitModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column" }}>
          {/* Backdrop blur */}
          <div onClick={() => setShowKitModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(11,27,62,0.8)", backdropFilter: "blur(4px)" }} />
          
          {/* Modal Container */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0B1B3E", borderTop: "1px solid rgba(255,255,255,0.15)", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", maxHeight: "80vh", boxShadow: "0 -8px 24px rgba(0,0,0,0.3)" }}>
            
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.10)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "white", margin: 0 }}>Kit de Limpeza de {diarista.nome.split(" ")[0]}</h3>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "4px 0 0 0" }}>Itens inclusos no kit de produtos de limpeza</p>
              </div>
              <button onClick={() => setShowKitModal(false)} style={{ background: "none", border: "none", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0DB87E", cursor: "pointer" }}>Fechar</button>
            </div>

            {/* List */}
            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {(() => {
                const list = diarista.materiais_detalhes && diarista.materiais_detalhes.length > 0
                  ? diarista.materiais_detalhes.filter((m: any) => m.ativo)
                  : MATERIAIS_DETALHADOS.map((m: any) => ({ ...m, precoEditado: m.precoMedio }));

                if (list.length === 0) {
                  return <p style={{ fontFamily: "DM Sans", color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center" }}>Nenhum produto cadastrado no kit.</p>;
                }

                // Categorize
                const quimicos = list.filter((m: any) => m.categoria === "quimicos");
                const utensilios = list.filter((m: any) => m.categoria === "utensilios");

                return (
                  <>
                    {quimicos.length > 0 && (
                      <div>
                        <p style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#0DB87E", letterSpacing: 0.5, marginBottom: 8 }}>Produtos Químicos</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {quimicos.map((m: any) => (
                            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18 }}>{m.emoji}</span>
                                <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "white" }}>{m.nome}</span>
                              </div>
                              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                                {m.precoEditado ? `R$ ${Number(m.precoEditado).toFixed(2)}` : "Incluso"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {utensilios.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#0DB87E", letterSpacing: 0.5, marginBottom: 8 }}>Utensílios</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {utensilios.map((m: any) => (
                            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18 }}>{m.emoji}</span>
                                <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "white" }}>{m.nome}</span>
                              </div>
                              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                                {m.precoEditado ? `R$ ${Number(m.precoEditado).toFixed(2)}` : "Incluso"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ background: "rgba(13,184,126,0.1)", borderRadius: 12, padding: 14, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "white" }}>Valor Total do Kit:</span>
                      <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>R$ {valorKit.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Safe area padding */}
            <div style={{ height: 40 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaristaPerfilPage;
