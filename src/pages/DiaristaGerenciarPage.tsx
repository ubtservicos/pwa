import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Ruler, AlertTriangle, CheckCircle, Star } from "lucide-react";
import { MATERIAIS_PADRAO } from "@/mocks/diaristasMateriais";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { calcSplit, SPLIT_META, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";

type AgStatus = "pending_confirm" | "confirmed" | "in_progress" | "completed" | "cancelled_diarista" | "cancelled_tomador";

interface Agendamento {
  id: string;
  status: AgStatus;
  diaristaId: string;
  tomadorId: string;
  tomador: string;
  data: string;
  hora: string;
  endereco: string;
  m2: number;
  valorTotal: number;
  materiaisSolicitados: string[];
  notes?: string;
}

const DiaristaGerenciarPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [status, setStatus] = useState<AgStatus>("pending_confirm");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showRecusar, setShowRecusar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [, tick] = useState(0);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAgendamento = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("diarista_agendamentos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        // Fetch client (tomador) name from usuarios
        const { data: userData } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", data.tomador_id)
          .maybeSingle();

        const loc = typeof data.local === "string" ? JSON.parse(data.local) : data.local;
        const mapped: Agendamento = {
          id: data.id,
          status: data.status as AgStatus,
          diaristaId: data.diarista_id,
          tomadorId: data.tomador_id,
          tomador: userData?.nome || "Cliente",
          data: data.data,
          hora: data.hora,
          endereco: loc?.endereco || "",
          m2: loc?.m2 || 0,
          valorTotal: Number(data.valor_total || 0),
          materiaisSolicitados: Array.isArray(data.materiais_solicitados) ? data.materiais_solicitados : [],
          notes: data.notes || ""
        };
        setAgendamento(mapped);
        setStatus(data.status as AgStatus);
      }
    } catch (e) {
      console.error("Erro ao buscar agendamento:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendamento();

    // Subscribe to realtime updates for this agendamento
    const channel = supabase
      .channel(`diarista-gerenciar-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "diarista_agendamentos",
          filter: `id=eq.${id}`
        },
        (payload: any) => {
          if (payload.new) {
            const newStatus = payload.new.status as AgStatus;
            setStatus(newStatus);
            setAgendamento((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: newStatus
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (status !== "in_progress") return;
    const iv = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(iv);
  }, [status]);

  // State machine: which status is required before transitioning to the next
  const EXPECTED_PREV: Record<string, string> = {
    confirmed: "pending_confirm",
    in_progress: "confirmed",
    completed: "in_progress",
    cancelled_diarista: "pending_confirm",
  };

  const updateStatus = async (nextStatus: AgStatus) => {
    if (!id) return;
    try {
      const expectedPrev = EXPECTED_PREV[nextStatus];
      let query = supabase
        .from("diarista_agendamentos")
        .update({ status: nextStatus })
        .eq("id", id);

      if (expectedPrev) {
        query = query.eq("status", expectedPrev);
      }

      const { data, error } = await query.select("id").single();

      if (error || !data) {
        alert("Este agendamento já foi alterado. Atualize a página.");
        return;
      }

      setStatus(nextStatus);
      setAgendamento((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: nextStatus
        };
      });

      if (nextStatus === "in_progress") {
        setStartedAt(Date.now());
      }
    } catch (e) {
      console.error(`Erro ao atualizar status para ${nextStatus}:`, e);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "var(--prestador-bg)", minHeight: "100svh", padding: 24, color: "white" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </button>
        <p style={{ fontFamily: "DM Sans", marginTop: 24, color: "#FFFFFF" }}>Carregando agendamento...</p>
      </div>
    );
  }

  if (!agendamento) {
    return (
      <div style={{ background: "var(--prestador-bg)", minHeight: "100svh", padding: 24, color: "white" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </button>
        <p style={{ fontFamily: "DM Sans", marginTop: 24, color: "#FFFFFF" }}>Agendamento não encontrado.</p>
      </div>
    );
  }

  const original = agendamento;
  const isToday = new Date(original.data).toDateString() === new Date().toDateString();
  const split = calcSplit(original.valorTotal);
  const ganhos = +(original.valorTotal * 0.9).toFixed(2);

  const minutos = startedAt ? Math.floor((Date.now() - startedAt) / 60000) : 0;
  const tempoLabel = minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h ${minutos % 60}m`;

  return (
    <div style={{ background: "var(--prestador-bg)", minHeight: "100svh", padding: "24px 24px 100px", color: "white" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/app/prestador/diaristas/agenda")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Agendamento</h1>
      </header>

      <div style={{ background: "var(--prestador-card)", borderRadius: 16, padding: 20, border: "1px solid var(--prestador-border)", marginTop: 20 }}>
        <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
          {new Date(original.data + "T12:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })} às {original.hora}
        </p>
        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#FFFFFF", marginTop: 6, marginBottom: 0 }}>{original.tomador}</p>
        <div style={{ borderTop: "1px solid var(--prestador-border)", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <MapPin size={16} color="#00FF66" />
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA" }}>{original.endereco}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Ruler size={16} color="#A1A1AA" />
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA" }}>{original.m2}m²</span>
          </div>
          {original.materiaisSolicitados && original.materiaisSolicitados.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              {original.materiaisSolicitados.map((mId) => {
                const m = MATERIAIS_PADRAO.find((x) => x.id === mId);
                return m ? <span key={mId} style={{ fontSize: 16 }}>{m.emoji}</span> : null;
              })}
            </div>
          )}
          {original.notes && (
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", fontStyle: "italic", margin: 0 }}>"{original.notes}"</p>
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--prestador-border)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA" }}>Total</span>
          <span style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#00FF66" }}>R$ {original.valorTotal.toFixed(2)}</span>
        </div>
      </div>

      {status === "pending_confirm" && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <PrimaryButtonLight onClick={() => updateStatus("confirmed")}>Confirmar agendamento</PrimaryButtonLight>
          <button
            onClick={() => setShowRecusar(true)}
            style={{ width: "100%", background: "rgba(232,64,64,0.1)", color: "#E84040", border: "1px solid rgba(232,64,64,0.2)", borderRadius: 999, padding: "14px", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Recusar
          </button>
        </div>
      )}

      {showRecusar && (
        <div style={{ background: "var(--prestador-card)", borderRadius: 12, padding: 16, marginTop: 12, border: "1px solid var(--prestador-border)" }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Motivo da recusa:</p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Indisponível neste horário..."
            style={{ width: "100%", marginTop: 8, height: 70, border: "1px solid var(--prestador-border)", borderRadius: 8, padding: 10, fontFamily: "DM Sans", fontSize: 13, color: "#FFFFFF", background: "var(--prestador-bg)", outline: "none", resize: "none" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setShowRecusar(false)} style={{ flex: 1, padding: 10, border: "1px solid var(--prestador-border)", background: "rgba(255,255,255,0.05)", borderRadius: 999, fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", cursor: "pointer" }}>Cancelar</button>
            <button disabled={!motivo} onClick={() => { updateStatus("cancelled_diarista"); setShowRecusar(false); }} style={{ flex: 1, padding: 10, border: "none", background: motivo ? "#E84040" : "rgba(255,255,255,0.10)", color: "white", borderRadius: 999, fontFamily: "DM Sans", fontSize: 13, cursor: motivo ? "pointer" : "not-allowed" }}>Confirmar recusa</button>
          </div>
        </div>
      )}

      {status === "confirmed" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: 14, display: "flex", gap: 10 }}>
            <AlertTriangle size={18} color="#F5A623" style={{ flexShrink: 0 }} />
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#A1A1AA", margin: 0 }}>
              Serviço agendado para {new Date(original.data + "T12:00").toLocaleDateString("pt-BR")} às {original.hora}. Prepare seus materiais.
            </p>
          </div>
          <button
            disabled={!isToday}
            onClick={() => { updateStatus("in_progress"); }}
            style={{ marginTop: 16, width: "100%", background: "#00FF66", color: "#09090B", border: "none", borderRadius: 999, padding: "14px", fontFamily: "Syne", fontSize: 14, fontWeight: 700, cursor: isToday ? "pointer" : "not-allowed", opacity: isToday ? 1 : 0.4 }}
          >
            {isToday ? "Iniciar serviço" : "Disponível no dia marcado"}
          </button>
        </div>
      )}

      {status === "in_progress" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#00FF66", animation: "ubt-pulse-dot 1.4s ease-in-out infinite" }} />
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#00FF66" }}>Em andamento</span>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#FFFFFF", marginTop: 8 }}>
            Em andamento há {tempoLabel}
          </p>
          <PrimaryButtonLight className="mt-4" onClick={() => updateStatus("completed")}>Concluir serviço</PrimaryButtonLight>
        </div>
      )}

      {status === "completed" && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <CheckCircle size={48} color="#00FF66" style={{ margin: "0 auto" }} />
          <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#FFFFFF", marginTop: 12 }}>Serviço concluído!</h2>
          <div style={{ background: "var(--prestador-card)", border: "1px solid var(--prestador-border)", borderRadius: 14, padding: 20, marginTop: 16 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA", margin: 0 }}>Você recebeu</p>
            <p style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 700, color: "#00FF66", margin: 0 }}>R$ {ganhos.toFixed(2)}</p>
            <div style={{ borderTop: "1px solid var(--prestador-border)", marginTop: 14, paddingTop: 14 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#A1A1AA", textTransform: "uppercase", textAlign: "left" }}>Divisão do valor</p>
              {SPLIT_META.map((m) => (
                <div key={m.key} style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#A1A1AA" }}>{m.label}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#FFFFFF" }}>{formatBRL(split[m.key])}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--prestador-card)", border: "1px solid var(--prestador-border)", borderRadius: 14, padding: 20, marginTop: 16 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#FFFFFF", margin: 0 }}>Avalie o cliente</p>
            <div style={{ display: "flex", justifyService: "center", justifyItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Star size={28} fill={n <= rating ? "#F5A623" : "transparent"} color="#F5A623" />
                </button>
              ))}
            </div>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentário (opcional)"
              style={{ width: "100%", marginTop: 10, height: 70, border: "1px solid var(--prestador-border)", background: "var(--prestador-bg)", borderRadius: 8, padding: 10, fontFamily: "DM Sans", fontSize: 13, color: "#FFFFFF", outline: "none", resize: "none" }}
            />
          </div>

          <PrimaryButtonLight className="mt-4" onClick={() => navigate("/app/prestador/diaristas/agenda")}>Voltar para agenda</PrimaryButtonLight>
        </div>
      )}

      {status.startsWith("cancelled") && (
        <div style={{ marginTop: 20, background: "rgba(232,64,64,0.08)", border: "1px solid rgba(232,64,64,0.25)", borderRadius: 12, padding: 14 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#E84040", margin: 0, fontWeight: 600 }}>Agendamento cancelado.</p>
        </div>
      )}

      <style>{`@keyframes ubt-pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }`}</style>
    </div>
  );
};

export default DiaristaGerenciarPage;
