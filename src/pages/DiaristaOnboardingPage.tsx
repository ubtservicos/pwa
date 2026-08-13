import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Ruler, MapPin, Check, Plus, ArrowLeft } from "lucide-react";

import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { MATERIAIS_PADRAO } from "@/mocks/diaristasMateriais";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { maskCPF } from "@/utils/masks";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";


const BAIRROS_UBATUBA = [
  "Centro", "Itaguá", "Tenório", "Praia Grande", "Toninhas", "Enseada", 
  "Perequê-Mirim", "Lázaro", "Domingas Dias", "Maranduba", "Lagoinha", 
  "Praia Dura", "Estufa I", "Estufa II", "Ipiranguinha", "Perequê-Açu", 
  "Taquaral", "Sumidouro", "Itamambuca", "Félix", "Prumirim", "Ubatumirim", "Picinguaba"
].sort();

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
const DIA_LBL: Record<typeof DIAS[number], string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
const HORARIOS_PADRAO = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const DiaristaOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState("Dados");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("17:00");

  const [cpf, setCpf] = useState("");
  const [sexo, setSexo] = useState<"masculino" | "feminino" | null>(null);
  const [bairros, setBairros] = useState<string[]>([]);
  const [showBairrosModal, setShowBairrosModal] = useState(false);
  const [valorPorM2, setValorPorM2] = useState("3.50");
  const [minimoM2, setMinimoM2] = useState("40");
  const [materiaisSel, setMateriaisSel] = useState<string[]>(["vassoura", "luvas", "panos", "produtos"]);
  const [materiaisCustom, setMateriaisCustom] = useState<string[]>([]);
  const [materiaisDetalhes, setMateriaisDetalhes] = useState<any[]>([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState("");
  const [disponibilidade, setDisponibilidade] = useState<Record<string, boolean>>({ seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false });
  const [horariosPorDia, setHorariosPorDia] = useState<Record<string, string[]>>({});
  const [diaEditando, setDiaEditando] = useState<string | null>("seg");
  const [calcM2, setCalcM2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user.cpf && !cpf) {
      setCpf(maskCPF(user.cpf));
    }
  }, [user.cpf, cpf]);

  const [mediasMercado, setMediasMercado] = useState<Record<string, number>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const tabEl = document.getElementById(`tab-${activeTab}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);


  useEffect(() => {
    async function loadMateriais() {
      setLoadingMateriais(true);
      const [resMateriais, resMedias] = await Promise.all([
        supabase.from('diarista_materiais_padrao').select('*'),
        supabase.from('vw_diarista_materiais_media_7d').select('*')
      ]);

      const medias: Record<string, number> = {};

      if (resMedias.data) {
        resMedias.data.forEach((m: any) => {
          medias[m.material_id] = Number(m.preco_medio);
        });
        setMediasMercado(medias);
      }


      // Carregar perfil existente
      if (user.uid) {
        const { data: perfil } = await supabase.from('diarista_perfis').select('*').eq('user_id', user.uid).maybeSingle();
        if (perfil) {
          if (perfil.cpf) setCpf(perfil.cpf);
          if (perfil.sexo) setSexo(perfil.sexo);
          if (perfil.endereco) setBairros(perfil.endereco.split(', ').filter(Boolean));
          if (perfil.valor_por_m2) setValorPorM2(String(perfil.valor_por_m2));
          if (perfil.minimo_m2) setMinimoM2(String(perfil.minimo_m2));
          if (perfil.materiais) setMateriaisSel(perfil.materiais);
          if (perfil.materiais_custom) setMateriaisCustom(perfil.materiais_custom);
          if (perfil.disponibilidade) setDisponibilidade(perfil.disponibilidade);
          if (perfil.horarios_por_dia) {
            setHorariosPorDia(perfil.horarios_por_dia);
          }
          
          if (perfil.materiais_detalhes && resMateriais.data && !resMateriais.error) {
            // Merge loaded details with standard
            const savedDetails = perfil.materiais_detalhes;
            setMateriaisDetalhes(
              resMateriais.data.map((m: any) => {
                const saved = savedDetails.find((x: any) => x.id === m.id);
                return {
                  id: m.id,
                  nome: m.nome,
                  emoji: m.emoji,
                  categoria: m.categoria,
                  ativo: saved ? saved.ativo : true,
                  precoEditado: saved ? saved.precoEditado : Number(m.preco_medio),
                  precoMedioMercado: medias[m.id] || Number(m.preco_medio)
                };
              })
            );
            setLoadingMateriais(false);
            return; // Skip the default map below
          }
        }
      }

      if (resMateriais.data && !resMateriais.error) {
        setMateriaisDetalhes(
          resMateriais.data.map((m: any) => ({
            id: m.id,
            nome: m.nome,
            emoji: m.emoji,
            categoria: m.categoria,
            ativo: true,
            precoEditado: Number(m.preco_medio),
            precoMedioMercado: medias[m.id] || Number(m.preco_medio)
          }))
        );
      }
      setLoadingMateriais(false);
    }
    loadMateriais();
  }, [user.uid]);

  const finalize = async () => {
    setSubmitting(true);
    const payload = {
      nome: user.name, cpf, sexo, endereco: bairros.join(", "),
      valorPorM2: +valorPorM2, minimoM2: +minimoM2,
      materiais: materiaisSel, materiaisCustom,
      disponibilidade, horariosPorDia,
      isOnline: false, rating: null, totalServicos: 0,
      kycStatus: "approved", createdAt: Date.now(),
    };
    try {
      if (user.uid && user.uid.length === 36) {
        // Tentativa de atualizar metadata
        supabase.auth.updateUser({ data: { cpf } }).catch(() => { });

        const payloadData = {
          user_id: user.uid,
          cpf,
          sexo,
          endereco: bairros.join(", "),
          valor_por_m2: +valorPorM2,
          minimo_m2: +minimoM2,
          materiais: materiaisSel,
          materiais_custom: materiaisCustom,
          materiais_detalhes: materiaisDetalhes,
          disponibilidade,
          horarios_por_dia: horariosPorDia
        };

        // Verifica se já existe para fazer update ou insert manual
        const { data: existing } = await supabase.from('diarista_perfis').select('user_id').eq('user_id', user.uid).maybeSingle();

        let dbError;
        if (existing) {
          const { error: errUpd } = await supabase.from('diarista_perfis').update(payloadData).eq('user_id', user.uid);
          dbError = errUpd;
        } else {
          const { error: errIns } = await supabase.from('diarista_perfis').insert([payloadData]);
          dbError = errIns;
        }

        if (dbError) {
          console.warn('Tabela diarista_perfis não encontrada ou erro no Supabase:', dbError);
        }

        // Insert into pricing history (tabela opcional - não bloqueia o fluxo)
        if (materiaisDetalhes && materiaisDetalhes.length > 0) {
          const precosPayload = materiaisDetalhes.filter(m => m.ativo && m.precoEditado > 0).map(m => ({
            prestador_id: user.uid,
            material_id: m.id,
            preco: m.precoEditado
          }));
          if (precosPayload.length > 0) {
            const { error: precosError } = await supabase.from('diarista_materiais_precos_declarados').insert(precosPayload);
            if (precosError) {
              // Tenta com user_id caso a tabela use essa coluna
              await supabase.from('diarista_materiais_precos_declarados').insert(
                precosPayload.map(p => ({ user_id: p.prestador_id, material_id: p.material_id, preco: p.preco }))
              ).then(({ error }) => {
                if (error) console.warn('Histórico de preços não salvo (tabela opcional):', error.message);
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    try { localStorage.setItem(`diarista_perfil_${user.uid}`, "1"); } catch { /* noop */ }
    navigate("/app/prestador/diaristas/agenda");
  };

  return (
    <div style={{ background: "var(--prestador-bg)", minHeight: "100svh", padding: "24px 24px 180px", overflowY: "auto", color: "white" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate("/app/prestador/home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Cadastro Diarista</h1>
      </header>


      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Dados", "Preços", "Kit Produtos", "Agenda"].map(t => (
          <button
            key={t}
            id={`tab-${t}`}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#00FF66" : "rgba(255,255,255,0.06)",
              color: activeTab === t ? "#09090B" : "#A1A1AA",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>


      {activeTab === "Dados" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <FormFieldLight label="CPF" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#A1A1AA", marginBottom: 8 }}>Sexo</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["masculino", "feminino"] as const).map((s) => {
                const sel = sexo === s;
                return (
                  <div
                    key={s}
                    onClick={() => setSexo(s)}
                    style={{ background: sel ? "rgba(0,255,102,0.1)" : "var(--prestador-card)", border: `2px solid ${sel ? "#00FF66" : "var(--prestador-border)"}`, borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "center" }}
                  >
                    <span style={{ fontSize: 28 }}>{s === "feminino" ? "👩" : "👨"}</span>
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#FFFFFF", marginTop: 6, marginBottom: 0, textTransform: "capitalize" }}>{s}</p>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#A1A1AA", marginBottom: 10 }}>Bairros de Atuação</p>
            <div 
              onClick={() => setShowBairrosModal(true)}
              style={{ width: "100%", background: "var(--prestador-card)", border: "1px solid var(--prestador-border)", borderRadius: 12, minHeight: 48, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <MapPin size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: bairros.length > 0 ? "#FFFFFF" : "#A1A1AA", flex: 1 }}>
                {bairros.length > 0 ? bairros.join(", ") : "Selecione os bairros..."}
              </span>
            </div>
          </div>


        </div>
      )}

      {activeTab === "Preços" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Como você cobra?</h2>
          <FormFieldLight label="R$ por m²" icon={DollarSign} type="number" step="0.01" value={valorPorM2} onChange={(e) => setValorPorM2(e.target.value)} placeholder="3.50" />
          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#A1A1AA", marginTop: -8 }}>Ex: 3,50 = R$ 350,00 para 100m²</p>
          <FormFieldLight label="Área mínima (m²)" icon={Ruler} type="number" value={minimoM2} onChange={(e) => setMinimoM2(e.target.value)} placeholder="40" />

          <div style={{ background: "var(--prestador-card)", border: "1px solid var(--prestador-border)", borderRadius: 12, padding: 18, marginTop: 12 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#FFFFFF", margin: "0 0 4px 0" }}>Teste seus preços!</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA", margin: "0 0 12px 0" }}>Use nossa calculadora rápida para ver quanto você receberia por uma faxina. Digite o tamanho de uma casa (ex: 80) e veja o valor.</p>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input 
                type="number" 
                value={calcM2} 
                onChange={(e) => setCalcM2(e.target.value)} 
                placeholder="m²" 
                style={{ width: 80, textAlign: "center", padding: "10px", borderRadius: 8, border: "1px solid var(--prestador-border)", background: "var(--prestador-bg)", color: "#FFFFFF", fontFamily: "DM Sans", fontSize: 15, outline: "none" }} 
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#A1A1AA" }}>x R$ {valorPorM2} =</span>
              {calcM2 ? (
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#00FF66" }}>
                  R$ {(+calcM2 * +valorPorM2).toFixed(2)}
                </span>
              ) : (
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#A1A1AA" }}>
                  R$ 0,00
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === "Kit Produtos" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Kit de Produtos</h2>
          <div style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.20)", borderRadius: 12, padding: 14 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", margin: 0, lineHeight: 1.4 }}>
              <strong>Atenção:</strong> Os preços definidos aqui formarão o valor total do seu Kit de Produtos. O cliente (tomador) poderá escolher no momento da contratação se deseja o serviço COM ou SEM produtos. Caso haja diferença nos preços de mercado no momento da sua compra, a prestadora assume o ônus ou bônus.
            </p>
          </div>
            <div style={{ background: "var(--prestador-card)", borderRadius: 12, border: "1px solid var(--prestador-border)", padding: 16, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
                  Detalhes do Kit
                </p>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 10, color: "#A1A1AA", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Seu Kit</p>
                  <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#00FF66", margin: 0 }}>
                    R$ {materiaisDetalhes.filter(m => m.ativo).reduce((a, b) => a + (b.precoEditado || 0), 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#A1A1AA", marginBottom: 16 }}>
                Média de mercado do kit completo: <strong>R$ {materiaisDetalhes.filter(m => m.ativo).reduce((a, b) => a + (b.precoMedioMercado || 0), 0).toFixed(2)}</strong>
              </p>

              {loadingMateriais ? (
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA", textAlign: "center", padding: "20px 0" }}>Carregando tabela do Supabase...</p>
              ) : materiaisDetalhes.length === 0 ? (
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#F5A623", textAlign: "center", padding: "10px 0" }}>Tabela diarista_materiais_padrao ainda não foi criada no banco de dados.</p>
              ) : (
                <>
                  {["quimicos", "utensilios"].map((cat) => (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <p style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#A1A1AA", marginBottom: 8 }}>
                        {cat === "quimicos" ? "Produtos Químicos" : "Utensílios"}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {materiaisDetalhes.filter(m => m.categoria === cat).map(m => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, background: m.ativo ? "var(--prestador-bg)" : "transparent", border: m.ativo ? "1px solid var(--prestador-border)" : "1px solid transparent", padding: 8, borderRadius: 8 }}>
                            <div
                              onClick={() => setMateriaisDetalhes(p => p.map(x => x.id === m.id ? { ...x, ativo: !x.ativo } : x))}
                              style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${m.ativo ? "#00FF66" : "var(--prestador-border)"}`, background: m.ativo ? "#00FF66" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                            >
                              {m.ativo && <Check size={14} color="#09090B" />}
                            </div>
                            <span style={{ fontSize: 18, opacity: m.ativo ? 1 : 0.4 }}>{m.emoji}</span>
                            <div style={{ flex: 1, opacity: m.ativo ? 1 : 0.4 }}>
                              <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: "#FFFFFF", margin: 0, textDecoration: m.ativo ? "none" : "line-through" }}>{m.nome}</p>
                              {m.precoMedioMercado > 0 && (
                                <p style={{ fontFamily: "DM Sans", fontSize: 10, color: "#A1A1AA", margin: 0 }}>Média: R$ {m.precoMedioMercado.toFixed(2)}</p>
                              )}
                            </div>
                            {m.ativo && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--prestador-card)", border: "1px solid var(--prestador-border)", borderRadius: 8, padding: "4px 8px" }}>
                                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA" }}>R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={m.precoEditado}
                                  onChange={(e) => setMateriaisDetalhes(p => p.map(x => x.id === m.id ? { ...x, precoEditado: +e.target.value } : x))}
                                  style={{ width: 44, border: "none", outline: "none", background: "transparent", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#FFFFFF", textAlign: "right" }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
        </div>
      )}
      {activeTab === "Agenda" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Sua Agenda</h2>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", marginTop: -8 }}>Quais dias da semana você atende?</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {DIAS.map(d => (
              <button
                key={d}
                onClick={() => {
                  setDisponibilidade(p => ({ ...p, [d]: !p[d] }));
                  if (!disponibilidade[d]) setDiaEditando(d);
                }}
                style={{
                  padding: "10px 0",
                  borderRadius: 12,
                  border: `2px solid ${disponibilidade[d] ? "#00FF66" : "var(--prestador-border)"}`,
                  background: disponibilidade[d] ? "rgba(0,255,102,0.15)" : "var(--prestador-card)",
                  color: disponibilidade[d] ? "#00FF66" : "#A1A1AA",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {DIA_LBL[d]}
              </button>
            ))}
          </div>

          {Object.keys(disponibilidade).some(d => disponibilidade[d]) && (
            <div style={{ background: "var(--prestador-card)", borderRadius: 16, border: "1px solid var(--prestador-border)", padding: 16, marginTop: 8 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "#FFFFFF", marginBottom: 12 }}>
                Ajuste os horários por dia:
              </p>
              
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                {DIAS.filter(d => disponibilidade[d]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDiaEditando(d)}
                    style={{
                      minWidth: 56,
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: `2px solid ${diaEditando === d ? "#0DB87E" : "#E2E8F0"}`,
                      background: diaEditando === d ? "#0DB87E" : "white",
                      color: diaEditando === d ? "white" : "#5B6178",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {DIA_LBL[d]}
                  </button>
                ))}
              </div>

              {diaEditando && disponibilidade[diaEditando] && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {HORARIOS_PADRAO.map(h => {
                      const ativo = (horariosPorDia[diaEditando] || []).includes(h);
                      return (
                        <button
                          key={h}
                          onClick={() => {
                            setHorariosPorDia(p => {
                              const prev = p[diaEditando] || [];
                              return { ...p, [diaEditando]: ativo ? prev.filter(x => x !== h) : [...prev, h].sort() };
                            });
                          }}
                          style={{
                            padding: "8px 0",
                            borderRadius: 8,
                            border: `1px solid ${ativo ? "#0DB87E" : "#E2E8F0"}`,
                            background: ativo ? "#E6FAF4" : "white",
                            color: ativo ? "#0DB87E" : "#5B6178",
                            fontFamily: "DM Sans",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer"
                          }}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div style={{ marginTop: 24, padding: 16, background: "#EFF0F3", borderRadius: 12, border: "1px dashed #D8DBE5" }}>
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", marginBottom: 12, textAlign: "center" }}>
                      Quer usar esses mesmos horários nos outros dias?
                    </p>
                    <button
                      onClick={() => {
                        const horasAtuais = horariosPorDia[diaEditando] || [];
                        setHorariosPorDia(p => {
                          const novo = { ...p };
                          DIAS.forEach(d => {
                            if (disponibilidade[d]) novo[d] = [...horasAtuais];
                          });
                          return novo;
                        });
                        alert("Horários copiados com sucesso para os outros dias!");
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 8,
                        background: "#0B1B3E",
                        color: "white",
                        border: "none",
                        fontFamily: "DM Sans",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                      }}
                    >
                      <Check size={18} /> Copiar para todos os dias marcados
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "var(--prestador-card)", borderTop: "1px solid var(--prestador-border)", zIndex: 10, display: "flex", gap: 12 }}>
        {activeTab !== "Agenda" && (
          <button 
            onClick={() => {
              const tabs = ["Dados", "Preços", "Kit Produtos", "Agenda"];
              setActiveTab(tabs[tabs.indexOf(activeTab) + 1]);
            }} 
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #00FF66", background: "transparent", color: "#00FF66", fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Continuar
          </button>
        )}
        <PrimaryButtonLight onClick={finalize} loading={submitting} style={{ flex: activeTab === "Agenda" ? 1 : 1.5 }}>
          Salvar e sair
        </PrimaryButtonLight>
      </div>


      {showBairrosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div onClick={() => setShowBairrosModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--prestador-card)", borderTop: "2px solid var(--prestador-border)", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--prestador-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Selecione os Bairros</h3>
              <button onClick={() => setShowBairrosModal(false)} style={{ background: "none", border: "none", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#00FF66", cursor: "pointer" }}>Pronto</button>
            </div>
            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {BAIRROS_UBATUBA.map(b => {
                const sel = bairros.includes(b);
                return (
                  <label key={b} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? "#00FF66" : "var(--prestador-border)"}`, background: sel ? "#00FF66" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sel && <Check size={14} color="#09090B" />}
                    </div>
                    <span style={{ fontFamily: "DM Sans", fontSize: 15, color: "#FFFFFF" }}>{b}</span>
                    <input type="checkbox" checked={sel} onChange={() => setBairros(p => sel ? p.filter(x => x !== b) : [...p, b])} style={{ display: "none" }} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaristaOnboardingPage;
