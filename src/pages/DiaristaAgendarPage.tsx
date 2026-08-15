import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Hash, Ruler, Check } from "lucide-react";
import { MOCK_DIARISTAS } from "@/mocks/diaristasMock";
import { MATERIAIS_PADRAO, MATERIAIS_DETALHADOS } from "@/mocks/diaristasMateriais";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { useRide } from "@/contexts/RideContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";
import { validateGeofence } from "@/services/GeofenceService";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";


const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA_LBL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_KEY = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

const SectionHeader = ({ title }: { title: string }) => (
  <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 24, marginBottom: 12 }}>
    {title}
  </p>
);

const DarkInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 12, height: 48, padding: "0 14px", color: "white",
      fontFamily: "DM Sans", fontSize: 14, outline: "none",
      ...props.style,
    }}
  />
);

const DiaristaAgendarPage = () => {
  const navigate = useNavigate();
  const { prestadorId } = useParams<{ prestadorId: string }>();
  const user = useCurrentUser();
  const { state: rideState } = useRide();
  const { address: geoAddress } = useGeolocation();
  const [diarista, setDiarista] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [calMes, setCalMes] = useState(hoje.getMonth());
  const [calAno, setCalAno] = useState(hoje.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [endereco, setEndereco] = useState(rideState?.origin?.address || "");
  const [complemento, setComplemento] = useState("");
  const [m2, setM2] = useState("");
  const [materiaisSel, setMateriaisSel] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const listMateriaisDisponiveis = useMemo(() => {
    if (diarista?.materiais_detalhes && diarista.materiais_detalhes.length > 0) {
      return diarista.materiais_detalhes.filter((m: any) => m.ativo);
    }
    return MATERIAIS_DETALHADOS.map((m: any) => ({
      id: m.id,
      nome: m.nome,
      emoji: m.emoji,
      categoria: m.categoria,
      ativo: true,
      precoEditado: m.precoMedio
    }));
  }, [diarista]);

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

  useEffect(() => {
    if (rideState?.origin?.address) {
      setEndereco(rideState.origin.address);
    } else if (!endereco && geoAddress) {
      setEndereco(geoAddress);
    }
  }, [rideState, geoAddress]);

  if (loading) return <div style={{ padding: 24, color: "white", background: "#09090B", minHeight: "100svh" }}>Carregando...</div>;

  if (!diarista) {
    return (
      <div style={{ background: "#09090B", minHeight: "100svh", color: "white", padding: 24 }}>
        <button onClick={() => navigate("/app/diaristas")} style={{ background: "none", border: "none", color: "white" }}>
          <ArrowLeft size={22} />
        </button>
        <p style={{ fontFamily: "DM Sans", marginTop: 24 }}>Diarista não encontrada.</p>
      </div>
    );
  }

  const diasNoMes = new Date(calAno, calMes + 1, 0).getDate();
  const primeiroDia = new Date(calAno, calMes, 1).getDay();

  const isDiaDisponivel = (dia: number) => {
    const d = new Date(calAno, calMes, dia);
    d.setHours(0, 0, 0, 0);
    if (d < hoje) return false;
    const nomeDia = DIAS_SEMANA_KEY[d.getDay()];
    return diarista.disponibilidade[nomeDia] === true;
  };
  const isoDate = (dia: number) =>
    `${calAno}-${String(calMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const valorBase = m2 ? +m2 * diarista.valorPorM2 : 0;
  const valorMateriais = materiaisSel.reduce((acc, mId) => {
    const found = listMateriaisDisponiveis.find((x) => x.id === mId);
    return acc + (found ? Number(found.precoEditado || 0) : 0);
  }, 0);
  const valorTotal = valorBase + valorMateriais;

  const initials = diarista.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("");

  const canSubmit = selectedDate && selectedHora && endereco && m2 && +m2 >= diarista.minimoM2;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const tomadorId = user.uid && user.uid.length === 36 ? user.uid : '60e0a5ba-1941-4c7d-8153-f72be1c70e06';
    const diaristId = prestadorId && prestadorId.length === 36 ? prestadorId : '11111111-1111-1111-1111-111111111111';

    // Garante que o usuário existe na tabela public.usuarios para não falhar a Foreign Key
    if (tomadorId !== '60e0a5ba-1941-4c7d-8153-f72be1c70e06') {
      try {
        await supabase.from('usuarios').upsert({ id: tomadorId, nome: user.name || 'Usuário', role: 'tomador' });
      } catch (err) {
        console.error("Erro ao upsertar usuario no Supabase:", err);
      }
    }

    const payload = {
      status: "pending_confirm",
      tomadorId,
      diaristId,
      data: selectedDate,
      hora: selectedHora,
      local: { endereco, complemento, m2: +m2 },
      materiaisSolicitados: materiaisSel,
      valorBase,
      valorMateriais,
      valorTotal,
      paymentMethod: null,
      paymentStatus: null,
      notes: notas,
      createdAt: Date.now(),
      confirmedAt: null,
      startedAt: null,
      completedAt: null,
      rating: null,
    };

    const supabasePayload = {
      tomador_id: tomadorId,
      diarista_id: diaristId,
      status: "pending_confirm",
      data: selectedDate,
      hora: selectedHora,
      local: { endereco, complemento, m2: +m2 },
      materiais_solicitados: materiaisSel,
      valor_base: valorBase,
      valor_materiais: valorMateriais,
      valor_total: valorTotal,
      notes: notas || null,
    };

    let agId = `ag_${Date.now()}`;
    
    // 1. Salvar no Supabase
    try {
      const { data: sData, error: sErr } = await supabase.from('diarista_agendamentos').insert([supabasePayload]).select().single();
      if (sErr) {
        console.error("Erro ao salvar no Supabase:", sErr);
      } else if (sData) {
        agId = sData.id;
      }
    } catch (e) {
      console.error("Erro ao salvar no Supabase:", e);
    }



    // 3. Salvar no LocalStorage
    try {
      localStorage.setItem(`diarista_ag_${agId}`, JSON.stringify(payload));
    } catch { /* noop */ }

    trackEvent("booking_requested", "operational", { vertical: "diaristas", agendamento_id: agId, price: valorTotal });
    logSystem("INFO", "DIARISTAS", "booking_requested", "success", undefined, undefined, undefined, { agendamento_id: agId, price: valorTotal });

    // 4. Mostrar o Splash e Redirecionar
    setShowSuccessSplash(true);
    setSubmitting(false);

    setTimeout(() => {
      navigate("/app/home");
    }, 3000);
  };

  return (
    <div style={{ background: "#09090B", minHeight: "100svh", padding: "24px 24px 100px", width: "100%" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 32 }}>
        <button onClick={() => { if (step > 1) setStep(step - 1); else navigate(-1); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, position: "absolute", left: 0 }}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0, textAlign: "center" }}>
          {step === 1 ? "Kit de Limpeza" : step === 2 ? "O Local" : step === 3 ? "Data e Hora" : "Resumo"}
        </h1>
      </header>

      {/* Stepper Wizard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 14, left: 20, right: 20, height: 2, background: "rgba(255,255,255,0.1)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 14, left: 20, width: step === 1 ? "0%" : step === 2 ? "33%" : step === 3 ? "66%" : "100%", height: 2, background: "#0DB87E", transition: "0.3s", zIndex: 1 }} />
        
        {[1, 2, 3, 4].map((s) => {
          const isClickable = s === 1 ||
            (s === 2) ||
            (s === 3 && endereco && m2 && +m2 >= diarista.minimoM2) ||
            (s === 4 && endereco && m2 && +m2 >= diarista.minimoM2 && selectedDate && selectedHora);
          
          const label = s === 1 ? "Kit" : s === 2 ? "Local" : s === 3 ? "Data" : "Resumo";

          return (
            <div
              key={s}
              onClick={() => { if (isClickable) setStep(s); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2, cursor: isClickable ? "pointer" : "not-allowed" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 14, background: step >= s ? "#0DB87E" : "#1C3261", border: `2px solid ${step >= s ? "#0DB87E" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Syne", fontSize: 13, fontWeight: 700, transition: "0.3s" }}>
                {step > s ? <Check size={14} /> : s}
              </div>
              <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: step === s ? 700 : 500, color: step >= s ? "white" : "rgba(255,255,255,0.45)", transition: "0.3s" }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center", marginTop: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>{initials}</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "white", display: "block" }}>{diarista.nome}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 2 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#0DB87E" }}>R$ {diarista.valorPorM2.toFixed(2)}/m²</span>
            {valorMateriais > 0 && (
              <>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>+</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#F5A623" }}>R$ {valorMateriais.toFixed(2)} (Kit)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {step === 1 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="KIT DE LIMPEZA" />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
            Selecione apenas o que você precisa que a profissional traga.
          </p>
          
          <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: 12, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, marginTop: -2 }}>⚠️</span>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.4 }}>
              <strong>Nota Importante:</strong> Ao deixar de selecionar qualquer material da lista abaixo, subentende-se que você já possui o item no imóvel em quantidade necessária para uso da profissional durante o serviço.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 8 }}>
            {(() => {
              const quimicos = listMateriaisDisponiveis.filter((m: any) => m.categoria === "quimicos");
              const utensilios = listMateriaisDisponiveis.filter((m: any) => m.categoria === "utensilios");

              const renderItem = (m: any) => {
                const sel = materiaisSel.includes(m.id);
                const cost = Number(m.precoEditado || 0);
                return (
                  <div key={m.id} onClick={() => {
                    setMateriaisSel(prev => sel ? prev.filter(x => x !== m.id) : [...prev, m.id])
                  }} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: 12, cursor: "pointer", border: `1px solid ${sel ? "#0DB87E" : "transparent"}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? "#0DB87E" : "rgba(255,255,255,0.2)"}`, background: sel ? "#0DB87E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sel && <Check size={14} color="white" />}
                    </div>
                    <span style={{ fontSize: 18 }}>{m.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "white", margin: 0 }}>{m.nome}</p>
                      <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>+{cost ? `R$ ${cost.toFixed(2)}` : "Grátis"}</p>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {quimicos.length > 0 && (
                    <div>
                      <p style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#0DB87E", letterSpacing: 0.5, marginBottom: 8 }}>Produtos Químicos</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {quimicos.map(renderItem)}
                      </div>
                    </div>
                  )}
                  {utensilios.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#0DB87E", letterSpacing: 0.5, marginBottom: 8 }}>Utensílios</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {utensilios.map(renderItem)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <button
            onClick={() => setStep(2)}
            style={{ width: "100%", height: 52, background: "#0DB87E", color: "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: "pointer" }}
          >
            Avançar para Local
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="O LOCAL" />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
            Informe onde o serviço será realizado e o tamanho do seu imóvel.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <MapPin size={18} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: 15 }} />
              <DarkInput placeholder="Endereço completo" value={endereco} onChange={e => setEndereco(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            <DarkInput placeholder="Complemento (apto, bloco...)" value={complemento} onChange={e => setComplemento(e.target.value)} />
            <div style={{ position: "relative" }}>
              <Ruler size={18} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: 15 }} />
              <DarkInput type="number" placeholder={`Tamanho da casa em m² (Mínimo ${diarista.minimoM2}m²)`} value={m2} onChange={e => setM2(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            {m2 && +m2 < diarista.minimoM2 && (
              <p style={{ color: "#E74C3C", fontSize: 12, fontFamily: "DM Sans", marginTop: -4 }}>O mínimo exigido por {diarista.nome} é de {diarista.minimoM2}m².</p>
            )}
          </div>

          <button
            disabled={!endereco || !m2 || +m2 < diarista.minimoM2}
            onClick={() => {
              const geoRes = validateGeofence(endereco);
              if (!geoRes.inside) {
                toast.error(geoRes.reason || "A UBT opera exclusivamente no município de Ubatuba-SP.");
                return;
              }
              setStep(3);
            }}
            style={{ width: "100%", height: 52, background: (!endereco || !m2 || +m2 < diarista.minimoM2) ? "rgba(255,255,255,0.1)" : "#0DB87E", color: (!endereco || !m2 || +m2 < diarista.minimoM2) ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: "pointer" }}
          >
            Avançar para Data
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="DATA DO SERVIÇO" />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 }}>
              <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else setCalMes(calMes - 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronLeft size={20} color="white" />
              </button>
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "white" }}>
                {MESES[calMes]} {calAno}
              </span>
              <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else setCalMes(calMes + 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronRight size={20} color="white" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {DIAS_SEMANA_LBL.map((l) => (
                <span key={l} style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{l}</span>
              ))}
              {Array.from({ length: primeiroDia }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const dia = i + 1;
                const iso = isoDate(dia);
                const dt = new Date(calAno, calMes, dia); dt.setHours(0, 0, 0, 0);
                const passado = dt < hoje;
                
                const nomeDia = DIAS_SEMANA_KEY[dt.getDay()];
                const disp = diarista.disponibilidade[nomeDia] === true;
                
                const isHoje = dt.getTime() === hoje.getTime();
                const sel = selectedDate === iso;
                const disabled = passado || !disp;
                return (
                  <button
                    key={dia}
                    disabled={disabled}
                    onClick={() => { setSelectedDate(iso); setSelectedHora(null); }}
                    style={{
                      width: "100%", aspectRatio: "1", borderRadius: 999, border: isHoje && !sel ? "1px solid rgba(13,184,126,0.40)" : "none",
                      background: sel ? "#0DB87E" : "transparent",
                      color: sel ? "white" : disabled ? "rgba(255,255,255,0.20)" : "white",
                      fontFamily: "DM Sans", fontSize: 14, fontWeight: sel ? 700 : 400,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <>
              <SectionHeader title="HORÁRIO DE CHEGADA" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(() => {
                  const dataObj = new Date(selectedDate + "T00:00:00");
                  const nomeDia = DIAS_SEMANA_KEY[dataObj.getDay()];
                  const horasParaODia = diarista.horarios_por_dia?.[nomeDia] || diarista.horarios || [];
                  
                  if (horasParaODia.length === 0) {
                     return <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Nenhum horário cadastrado para este dia.</p>;
                  }

                  return horasParaODia.map((h: string) => {
                    const sel = selectedHora === h;
                    return (
                      <button
                        key={h}
                        onClick={() => setSelectedHora(h)}
                        style={{
                          padding: "10px 16px", borderRadius: 999, cursor: "pointer", minWidth: 72,
                          fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
                          background: sel ? "#0DB87E" : "rgba(255,255,255,0.06)",
                          border: `1.5px solid ${sel ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
                          color: sel ? "white" : "rgba(255,255,255,0.70)",
                        }}
                      >
                        {h}
                      </button>
                    );
                  });
                })()}
              </div>
            </>
          )}

          <button
            disabled={!selectedDate || !selectedHora}
            onClick={() => setStep(4)}
            style={{ width: "100%", height: 52, background: (!selectedDate || !selectedHora) ? "rgba(255,255,255,0.1)" : "#0DB87E", color: (!selectedDate || !selectedHora) ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: "pointer" }}
          >
            Avançar para Resumo
          </button>
        </div>
      )}

      {step === 4 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="RESUMO DO PEDIDO" />
          
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Data e Hora</span>
              <span style={{ color: "white", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans" }}>{selectedDate?.split("-").reverse().join("/")} às {selectedHora}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Local</span>
              <span style={{ color: "white", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans", textAlign: "right", maxWidth: "60%" }}>{endereco} - {m2}m²</span>
            </div>
            
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "16px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Diária Base ({m2}m²)</span>
              <span style={{ color: "white", fontSize: 14, fontFamily: "DM Sans" }}>R$ {valorBase.toFixed(2)}</span>
            </div>
            
            {materiaisSel.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Materiais Escolhidos ({materiaisSel.length})</span>
                  <span style={{ color: "white", fontSize: 14, fontFamily: "DM Sans" }}>R$ {valorMateriais.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {materiaisSel.map((mId) => {
                    const m = listMateriaisDisponiveis.find((x) => x.id === mId);
                    return m ? (
                      <span key={mId} style={{ background: "rgba(13,184,126,0.1)", border: "1px solid rgba(13,184,126,0.2)", borderRadius: 999, padding: "2px 8px", fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "DM Sans" }}>
                        {m.emoji} {m.nome}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "16px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "white", fontSize: 16, fontWeight: 700, fontFamily: "Syne" }}>Total</span>
              <span style={{ color: "#0DB87E", fontSize: 20, fontWeight: 700, fontFamily: "Syne" }}>R$ {valorTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <SectionHeader title="OBSERVAÇÕES (OPCIONAL)" />
          <textarea
            placeholder="Alguma recomendação especial para a diarista? (Animais em casa, produtos alérgicos...)"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, minHeight: 80, padding: 14, color: "white", fontFamily: "DM Sans", fontSize: 14, outline: "none", resize: "none" }}
          />

          <button
            disabled={submitting}
            onClick={handleSubmit}
            style={{ width: "100%", height: 52, background: submitting ? "rgba(255,255,255,0.1)" : "#0DB87E", color: submitting ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Confirmando..." : "Confirmar Agendamento"}
          </button>
        </div>
      )}

      {showSuccessSplash && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "#09090B",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 24,
          textAlign: "center",
          animation: "fade-in 0.3s ease"
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: "rgba(13,184,126,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            animation: "scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}>
            <Check size={40} color="#0DB87E" />
          </div>
          
          <h2 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "white", margin: "0 0 12px" }}>
            Agendamento Solicitado!
          </h2>
          
          <p style={{ fontFamily: "DM Sans", fontSize: 15, color: "rgba(255,255,255,0.7)", maxWidth: 300, lineHeight: 1.5, margin: 0 }}>
            Seu pedido foi enviado para {diarista?.nome}. Ela tem até 24 horas para confirmar o serviço.
          </p>

          <div style={{
            marginTop: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0DB87E", fontWeight: 600 }}>
              Redirecionando para a tela inicial...
            </span>
            <div style={{
              width: 120,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                background: "#0DB87E",
                animation: "loading-bar 3s linear forwards"
              }} />
            </div>
          </div>

          <style>{`
            @keyframes scale-up {
              from { transform: scale(0.5); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            @keyframes loading-bar {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default DiaristaAgendarPage;
