import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Settings, Calendar } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_LBL = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending_confirm: { color: "#F5A623", label: "Aguardando" },
  confirmed: { color: "#2B6EE8", label: "Confirmado" },
  in_progress: { color: "#0DB87E", label: "Em andamento" },
  completed: { color: "#9399AD", label: "Concluído" },
  cancelled_diarista: { color: "#E84040", label: "Cancelado" },
  cancelled_tomador: { color: "#E84040", label: "Cancelado" },
};

const NOMES_MATERIAIS: Record<string, string> = {
  basico: "🧼 Kit Básico",
  kit: "🪣 Kit Completo",
  luvas: "🧤 Luvas de Borracha",
  esponjas: "🧽 Esponjas Extras",
  vassoura: "🧹 Vassoura com Cabo",
  panos: "🧻 Panos de Limpeza",
  produtos: "🧴 Produtos Químicos",
  detergente: "🧴 Detergente Neutro",
  agua_sanitaria: "💧 Água Sanitária",
  desinfetante: "🌸 Desinfetante",
  multiuso: "✨ Limpador Multiuso",
  desengordurante: "🧽 Desengordurante",
  alcool: "⚕️ Álcool 70%",
  sabao_po: "🫧 Sabão em Pó",
  limpa_vidros: "🪟 Limpa-vidros",
  pano_microfibra: "🧻 Panos de Microfibra",
  pano_chao: "🧶 Pano de Chão",
  esponja: "🧽 Esponja Dupla Face",
  rodo: "🧹 Rodo com Cabo",
  pa_lixo: "🗑️ Pá de Lixo",
  balde: "🪣 Balde Plástico",
  escova_sanitaria: "🚽 Escova Sanitária",
};

const PRECOS_MATERIAIS: Record<string, number> = {
  basico: 20.00,
  kit: 30.00,
  luvas: 7.00,
  esponjas: 4.00,
  vassoura: 16.00,
  panos: 4.75,
  produtos: 8.00,
  detergente: 2.65,
  agua_sanitaria: 3.50,
  desinfetante: 6.00,
  multiuso: 5.75,
  desengordurante: 10.50,
  alcool: 7.50,
  sabao_po: 13.50,
  limpa_vidros: 8.00,
  pano_microfibra: 12.50,
  pano_chao: 4.75,
  esponja: 4.00,
  rodo: 14.00,
  pa_lixo: 6.00,
  balde: 11.00,
  escova_sanitaria: 11.50,
};

const DiaristaAgendaPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [calMes, setCalMes] = useState(hoje.getMonth());
  const [calAno, setCalAno] = useState(hoje.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(hoje.toISOString().slice(0, 10));
  const [online, setOnline] = useState(false);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const diasNoMes = new Date(calAno, calMes + 1, 0).getDate();
  const primeiroDia = new Date(calAno, calMes, 1).getDay();
  const fetchAgendamentos = async () => {
    if (!user.uid) {
      setAgendamentos([]);
      setLoading(false);
      return;
    }

    try {
      const { data: agData, error: agError } = await supabase
        .from("diarista_agendamentos")
        .select("*")
        .eq("diarista_id", user.uid);

      if (agError) throw agError;

      if (agData && agData.length > 0) {
        const tomadorIds = Array.from(new Set(agData.map((a: any) => a.tomador_id).filter(Boolean)));
        const userMap = new Map<string, string>();
        if (tomadorIds.length > 0) {
          const { data: userData, error: userError } = await supabase
            .from("usuarios")
            .select("id, nome")
            .in("id", tomadorIds);
          if (userData) {
            userData.forEach((u: any) => userMap.set(u.id, u.nome));
          }
        }

        const mapped = agData.map((a: any) => {
          const loc = typeof a.local === "string" ? JSON.parse(a.local) : a.local;
          const localObj = loc || {};
          return {
            id: a.id,
            status: a.status,
            diaristId: a.diarista_id,
            data: a.data,
            hora: a.hora,
            m2: localObj.m2 || 0,
            endereco: localObj.endereco || "",
            materiaisSolicitados: Array.isArray(a.materiais_solicitados) ? a.materiais_solicitados : [],
            valorBase: Number(a.valor_base || 0),
            valorMateriais: Number(a.valor_materiais || 0),
            valorTotal: Number(a.valor_total || 0),
            notes: a.notes || "",
            tomador: userMap.get(a.tomador_id) || "Cliente"
          };
        });

        setAgendamentos(mapped);
      } else {
        setAgendamentos([]);
      }
    } catch (e) {
      console.error("Erro ao carregar agendamentos:", e);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user.uid) {
      fetchAgendamentos();
      return;
    }

    const fetchOnlineStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("diarista_perfis")
          .select("is_online")
          .eq("user_id", user.uid)
          .maybeSingle();
        if (data) {
          setOnline(!!data.is_online);
        }
      } catch (err) {
        console.error("Erro ao carregar status online:", err);
      }
    };

    fetchOnlineStatus();
    fetchAgendamentos();

    const channel = supabase
      .channel(`diarista-agenda-${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diarista_agendamentos",
          filter: `diarista_id=eq.${user.uid}`
        },
        () => {
          fetchAgendamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.uid]);
  const toggleOnline = async () => {
    if (!user.uid) return;
    const nextOnline = !online;
    setOnline(nextOnline);
    try {
      await supabase
        .from("diarista_perfis")
        .update({ is_online: nextOnline })
        .eq("user_id", user.uid);
    } catch (e) {
      console.error("Erro ao atualizar status online:", e);
    }
  };

  const [showCalendar, setShowCalendar] = useState(false);
  const [activeMaterials, setActiveMaterials] = useState<{ tomador: string; materiais: string[] } | null>(null);
  const datasComAg = useMemo(() => new Set(agendamentos.map((a) => a.data)), [agendamentos]);
  const agendamentosDoDia = useMemo(() => agendamentos.filter((a) => a.data === selectedDate), [agendamentos, selectedDate]);
  const pendentes = useMemo(() => agendamentos.filter((a) => a.status === "pending_confirm").length, [agendamentos]);

  const proximasConfirmadas = useMemo(() => {
    const hojeStr = hoje.toISOString().slice(0, 10);
    return agendamentos
      .filter((a) => (a.status === "confirmed" || a.status === "in_progress") && a.data >= hojeStr)
      .sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return a.hora.localeCompare(b.hora);
      });
  }, [agendamentos, hoje]);

  const isoDate = (dia: number) => `${calAno}-${String(calMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100svh", padding: "24px 24px 80px" }}>
      {/* Top Bar with Back Button and Adjust Values Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate("/app/prestador/home")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#0B1B3E", padding: 4, display: "flex", alignItems: "center" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          onClick={() => navigate("/app/prestador/diaristas/onboarding")}
          style={{
            background: "rgba(13,184,126,0.08)",
            border: "1px solid rgba(13,184,126,0.18)",
            borderRadius: 999,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            fontFamily: "DM Sans",
            fontSize: 13,
            fontWeight: 600,
            color: "#0DB87E",
            transition: "all 0.2s"
          }}
        >
          <Settings size={15} /> Ajustar Valores
        </button>
      </div>

      {/* Title & Online Toggle Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 800, color: "#0B1B3E", margin: 0 }}>
            Minha Agenda
          </h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", margin: 0, marginTop: 4 }}>
            Gerencie seus compromissos e horários
          </p>
        </div>
        
        {/* Toggle Switch */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            onClick={toggleOnline}
            aria-label="Alternar status online"
            style={{
              width: 46,
              height: 26,
              borderRadius: 999,
              background: online ? "#0DB87E" : "#D8DBE5",
              border: "none",
              cursor: "pointer",
              position: "relative",
              padding: 0,
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)"
            }}
          >
            <span
              style={{
                display: "block",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                position: "absolute",
                top: 3,
                left: online ? 23 : 3,
                transition: "left 200ms ease-in-out"
              }}
            />
          </button>
        </div>
      </div>

      {/* Online Status Card */}
      <div
        style={{
          background: online ? "#E6FAF4" : "#F1F2F6",
          border: `1px solid ${online ? "rgba(13,184,126,0.2)" : "rgba(147,153,173,0.2)"}`,
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {online ? (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#0DB87E",
                animation: "ubt-pulse-dot 1.4s ease-in-out infinite"
              }}
            />
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#9399AD" }} />
          )}
          <span
            style={{
              fontFamily: "DM Sans",
              fontSize: 13,
              fontWeight: 500,
              color: online ? "#0DB87E" : "#5B6178"
            }}
          >
            {online ? "Online · Visível para novos clientes" : "Offline · Oculto para novas buscas"}
          </span>
        </div>
        
      </div>

      {/* Pending Bookings Section */}
      {pendentes > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0B1B3E", margin: "0 0 10px" }}>
            Solicitações Pendentes ({pendentes})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {agendamentos
              .filter((a) => a.status === "pending_confirm")
              .map((a) => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/app/prestador/diaristas/servico/${a.id}`)}
                  style={{
                    background: "white",
                    borderRadius: 14,
                    padding: 16,
                    borderLeft: "4px solid #F5A623",
                    boxShadow: "0 2px 6px rgba(11,27,62,0.05)",
                    cursor: "pointer",
                    border: "1px solid rgba(245,166,35,0.2)",
                    borderLeftWidth: 4
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0B1B3E" }}>
                      {new Date(a.data + "T12:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} às {a.hora}
                    </span>
                    <span
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#F5A623",
                        background: "rgba(245,166,35,0.1)",
                        borderRadius: 999,
                        padding: "2px 8px"
                      }}
                    >
                      Pendente
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0B1B3E", fontWeight: 600 }}>{a.tomador}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178" }}>{a.m2}m²</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMaterials({ tomador: a.tomador, materiais: a.materiaisSolicitados });
                        }}
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 10,
                          fontWeight: 600,
                          color: a.materiaisSolicitados.length > 0 ? "#0DB87E" : "#9399AD",
                          background: a.materiaisSolicitados.length > 0 ? "rgba(13,184,126,0.1)" : "rgba(147,153,173,0.1)",
                          border: "none",
                          borderRadius: 6,
                          padding: "2px 6px",
                          cursor: "pointer"
                        }}
                      >
                        {a.materiaisSolicitados.length > 0 ? "COM MATERIAIS" : "SEM MATERIAIS"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD" }}>{a.endereco}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0DB87E" }}>
                      R$ {a.valorTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Próximas Faxinas Marcadas */}
      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0B1B3E", margin: "0 0 10px" }}>
          Próximas Faxinas Marcadas ({proximasConfirmadas.length})
        </h2>
        {proximasConfirmadas.length === 0 ? (
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#9399AD", textAlign: "center", background: "white", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(11,27,62,0.05)" }}>
            Nenhuma faxina confirmada agendada.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {proximasConfirmadas.map((a) => {
              const meta = STATUS_META[a.status] || STATUS_META.confirmed;
              const dateObj = new Date(a.data + "T12:00");
              const formattedDate = dateObj.toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short"
              });
              const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/app/prestador/diaristas/servico/${a.id}`)}
                  style={{
                    background: "white",
                    borderRadius: 14,
                    padding: 16,
                    borderLeft: `4px solid ${meta.color}`,
                    boxShadow: "0 2px 6px rgba(11,27,62,0.05)",
                    cursor: "pointer",
                    border: "1px solid rgba(11,27,62,0.05)",
                    borderLeftWidth: 4
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0B1B3E" }}>
                      {capitalizedDate} às {a.hora}
                    </span>
                    <span
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        color: meta.color,
                        background: `${meta.color}15`,
                        borderRadius: 999,
                        padding: "2px 8px"
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0B1B3E", fontWeight: 600 }}>{a.tomador}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178" }}>{a.m2}m²</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMaterials({ tomador: a.tomador, materiais: a.materiaisSolicitados });
                        }}
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 10,
                          fontWeight: 600,
                          color: a.materiaisSolicitados.length > 0 ? "#0DB87E" : "#9399AD",
                          background: a.materiaisSolicitados.length > 0 ? "rgba(13,184,126,0.1)" : "rgba(147,153,173,0.1)",
                          border: "none",
                          borderRadius: 6,
                          padding: "2px 6px",
                          cursor: "pointer"
                        }}
                      >
                        {a.materiaisSolicitados.length > 0 ? "COM MATERIAIS" : "SEM MATERIAIS"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD" }}>{a.endereco}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0DB87E" }}>
                      R$ {a.valorTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toggle Calendário Button */}
      <div style={{ marginTop: 24, marginBottom: showCalendar ? 16 : 0 }}>
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          style={{
            background: showCalendar ? "rgba(11,27,62,0.05)" : "white",
            border: "1px solid rgba(11,27,62,0.1)",
            borderRadius: 12,
            padding: "12px 16px",
            fontFamily: "DM Sans",
            fontSize: 14,
            fontWeight: 600,
            color: "#0B1B3E",
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 2px 6px rgba(11,27,62,0.03)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
        >
          <Calendar size={18} />
          {showCalendar ? "Ocultar Calendário" : "Visualizar em Calendário"}
        </button>
      </div>

      {/* Calendário e Compromissos do Dia Selecionado */}
      {showCalendar && (
        <>
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 2px 8px rgba(11,27,62,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else setCalMes(calMes - 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronLeft size={20} color="#0B1B3E" />
              </button>
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0B1B3E" }}>{MESES[calMes]} {calAno}</span>
              <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else setCalMes(calMes + 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronRight size={20} color="#0B1B3E" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {DIAS_LBL.map((l, i) => (
                <span key={`lbl${i}`} style={{ fontFamily: "DM Sans", fontSize: 11, color: "#9399AD", textAlign: "center" }}>{l}</span>
              ))}
              {Array.from({ length: primeiroDia }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const dia = i + 1;
                const iso = isoDate(dia);
                const dt = new Date(calAno, calMes, dia); dt.setHours(0, 0, 0, 0);
                const isHoje = dt.getTime() === hoje.getTime();
                const sel = selectedDate === iso;
                
                const temConfirmado = agendamentos.some(
                  (a) => a.data === iso && (a.status === "confirmed" || a.status === "in_progress" || a.status === "completed")
                );
                const temPendente = agendamentos.some(
                  (a) => a.data === iso && a.status === "pending_confirm"
                );

                const dotConfirmadoColor = isHoje && !sel ? "#FFFFFF" : "#0DB87E";
                const dotPendenteColor = isHoje && !sel ? "#FFE5A3" : "#F5A623";

                return (
                  <button
                    key={dia}
                    onClick={() => setSelectedDate(iso)}
                    style={{
                      width: "100%", aspectRatio: "1", borderRadius: 999, border: "none", cursor: "pointer",
                      background: sel ? "#E6FAF4" : isHoje ? "#0DB87E" : "transparent",
                      color: isHoje && !sel ? "white" : "#0B1B3E",
                      fontFamily: "DM Sans", fontSize: 13, fontWeight: sel || isHoje ? 700 : 400,
                      position: "relative",
                    }}
                  >
                    {dia}
                    {(temConfirmado || temPendente) && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: "50%",
                          transform: "translateX(-50%)",
                          display: "flex",
                          gap: 3,
                          justifyContent: "center",
                          alignItems: "center"
                        }}
                      >
                        {temConfirmado && (
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              background: dotConfirmadoColor
                            }}
                          />
                        )}
                        {temPendente && (
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              background: dotPendenteColor
                            }}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0B1B3E", marginBottom: 12 }}>
              Compromissos do dia {new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {loading ? (
                <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#9399AD", textAlign: "center", marginTop: 12 }}>
                  Carregando agenda...
                </p>
              ) : agendamentosDoDia.length === 0 ? (
                <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#9399AD", textAlign: "center", background: "white", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(11,27,62,0.05)" }}>
                  Nenhum agendamento para este dia.
                </p>
              ) : (
                agendamentosDoDia.map((a) => {
                  const meta = STATUS_META[a.status] || STATUS_META.confirmed;
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/app/prestador/diaristas/servico/${a.id}`)}
                      style={{
                        background: "white",
                        borderRadius: 14,
                        padding: 16,
                        borderLeft: `4px solid ${meta.color}`,
                        boxShadow: "0 2px 6px rgba(11,27,62,0.05)",
                        cursor: "pointer",
                        border: "1px solid rgba(11,27,62,0.05)",
                        borderLeftWidth: 4
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0B1B3E" }}>{a.hora}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: meta.color, background: `${meta.color}15`, borderRadius: 999, padding: "3px 10px" }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0B1B3E" }}>{a.tomador}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178" }}>{a.m2}m²</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMaterials({ tomador: a.tomador, materiais: a.materiaisSolicitados });
                            }}
                            style={{
                              fontFamily: "DM Sans",
                              fontSize: 10,
                              fontWeight: 600,
                              color: a.materiaisSolicitados.length > 0 ? "#0DB87E" : "#9399AD",
                              background: a.materiaisSolicitados.length > 0 ? "rgba(13,184,126,0.1)" : "rgba(147,153,173,0.1)",
                              border: "none",
                              borderRadius: 6,
                              padding: "2px 6px",
                              cursor: "pointer"
                            }}
                          >
                            {a.materiaisSolicitados.length > 0 ? "COM MATERIAIS" : "SEM MATERIAIS"}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD" }}>{a.endereco}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0DB87E" }}>R$ {a.valorTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de Detalhes dos Materiais */}
      {activeMaterials && (
        <div
          onClick={() => setActiveMaterials(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(11,27,62,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 24
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 16,
              width: "100%",
              maxWidth: 380,
              padding: 24,
              boxShadow: "0 10px 25px rgba(11,27,62,0.15)",
              animation: "ubt-scale-up 0.2s ease-out"
            }}
          >
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: "0 0 4px" }}>
              Materiais de Limpeza
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", margin: "0 0 16px" }}>
              Cliente: <strong style={{ color: "#0B1B3E" }}>{activeMaterials.tomador}</strong>
            </p>

            {activeMaterials.materiais.length > 0 ? (
              <div>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0B1B3E", fontWeight: 600, margin: "0 0 8px" }}>
                  Levar os seguintes materiais:
                </p>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "#F4F5F8",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  maxHeight: 180,
                  overflowY: "auto"
                }}>
                  {activeMaterials.materiais.map((m) => {
                    const preco = PRECOS_MATERIAIS[m] || 0;
                    return (
                      <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0B1B3E" }}>
                          {NOMES_MATERIAIS[m] || m}
                        </span>
                        {preco > 0 && (
                          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#5B6178" }}>
                            R$ {preco.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Resumo do custo estimado */}
                {(() => {
                  const custoTotal = activeMaterials.materiais.reduce((acc, m) => acc + (PRECOS_MATERIAIS[m] || 0), 0);
                  if (custoTotal > 0) {
                    return (
                      <div style={{
                        background: "rgba(13,184,126,0.06)",
                        border: "1px solid rgba(13,184,126,0.15)",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0B1B3E" }}>
                            Gasto Estimado de Compra:
                          </span>
                          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>
                            R$ {custoTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#0DB87E", fontWeight: 500, margin: 0 }}>
                  ✓ O custo dos materiais já foi adicionado ao valor total do serviço.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 8, background: "rgba(147,153,173,0.1)", borderRadius: 10, padding: 12, marginBottom: 20, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>🏡</span>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", margin: 0, lineHeight: 1.4 }}>
                    <strong>Sem materiais inclusos.</strong> O cliente é responsável por fornecer todos os utensílios e produtos no local do serviço.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveMaterials(null)}
              style={{
                width: "100%",
                background: "#0B1B3E",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontFamily: "DM Sans",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 16,
                boxShadow: "0 4px 10px rgba(11,27,62,0.15)"
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ubt-pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes ubt-scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      
    </div>
  );
};

export default DiaristaAgendaPage;

