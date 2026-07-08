import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, Sparkles, Trophy, AlertCircle, XCircle, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MOCK_DIARISTAS } from "@/mocks/diaristasMock";
import { MATERIAIS_PADRAO, MATERIAIS_DETALHADOS } from "@/mocks/diaristasMateriais";
import SplitBreakdown from "@/components/mototaxi/SplitBreakdown";

const STEPS = [
  { key: "pending_confirm", label: "Solicitado", icon: Clock },
  { key: "confirmed", label: "Confirmado", icon: CheckCircle },
  { key: "in_progress", label: "Em andamento", icon: Sparkles },
  { key: "completed", label: "Concluído", icon: Trophy },
];
const STATUS_ORDER = ["pending_confirm", "confirmed", "in_progress", "completed"];

interface Agendamento {
  id: string;
  status: string;
  diaristId: string;
  data: string;
  hora: string;
  local: { endereco: string; complemento?: string; m2: number };
  materiaisSolicitados: string[];
  valorBase: number;
  valorMateriais: number;
  valorTotal: number;
  notes?: string;
  startedAt?: number | null;
}

const DiaristaAgendamentoPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [ag, setAg] = useState<Agendamento | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [diaristaInfo, setDiaristaInfo] = useState<{ nome: string; rating: number; totalServicos: number } | null>(null);

  const fetchAgendamento = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('diarista_agendamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const mapped: Agendamento = {
          id: data.id,
          status: data.status,
          diaristId: data.diarista_id,
          data: data.data,
          hora: data.hora,
          local: typeof data.local === 'string' ? JSON.parse(data.local) : data.local,
          materiaisSolicitados: Array.isArray(data.materiais_solicitados) ? data.materiais_solicitados : [],
          valorBase: Number(data.valor_base),
          valorMateriais: Number(data.valor_materiais),
          valorTotal: Number(data.valor_total),
          notes: data.notes,
          startedAt: null
        };
        setAg(mapped);

        // Busca o perfil da diarista
        const { data: perfData } = await supabase
          .from('diarista_perfis')
          .select('nome, rating, total_servicos')
          .eq('user_id', data.diarista_id)
          .maybeSingle();

        if (perfData) {
          setDiaristaInfo({
            nome: perfData.nome || "Diarista",
            rating: Number(perfData.rating || 5.0),
            totalServicos: Number(perfData.total_servicos || 0)
          });
        }
      }
    } catch (err) {
      console.error("Erro ao carregar agendamento do Supabase:", err);
      // local fallback
      try {
        const local = localStorage.getItem(`diarista_ag_${id}`);
        if (local) setAg(JSON.parse(local));
      } catch { /* noop */ }
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchAgendamento();

    const channel = supabase
      .channel(`agendamento-tomador-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'diarista_agendamentos',
          filter: `id=eq.${id}`
        },
        () => {
          fetchAgendamento();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (!ag) {
    return (
      <div style={{ background: "#0B1B3E", minHeight: "100svh", color: "white", padding: 24 }}>
        <button onClick={() => navigate("/app/home")} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>
          <ArrowLeft size={22} />
        </button>
        <p style={{ fontFamily: "DM Sans", marginTop: 24 }}>Carregando agendamento...</p>
      </div>
    );
  }

  const diarista = diaristaInfo || MOCK_DIARISTAS.find((d) => d.uid === ag.diaristId);
  const currentIdx = STATUS_ORDER.indexOf(ag.status);

  const cancelar = async () => {
    if (!confirm("Cancelar este agendamento?")) return;
    const next = { ...ag, status: "cancelled_tomador" };
    if (id && !id.startsWith("ag_")) {
      try {
        const { error } = await supabase
          .from('diarista_agendamentos')
          .update({ status: "cancelled_tomador" })
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error("Erro ao cancelar no Supabase:", err);
      }
    }
    try { localStorage.setItem(`diarista_ag_${id}`, JSON.stringify(next)); } catch { /* noop */ }
    setAg(next);
  };

  const initials = diarista ? diarista.nome.split(" ").map((n) => n[0]).slice(0, 2).join("") : "??";

  return (
    <div style={{ background: "#0B1B3E", minHeight: "100svh", padding: "24px 24px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/app/home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>Meu Agendamento</h1>
      </header>

      {ag.status !== "completed" && (
        <div style={{ marginTop: 24 }}>
          {STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            const Icon = step.icon;
            return (
              <div key={step.key} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: done ? "#0DB87E" : "rgba(255,255,255,0.08)",
                    border: active ? "2px solid #0DB87E" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={16} color={done ? "white" : "rgba(255,255,255,0.25)"} />
                  </div>
                  {i < 3 && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 24, marginTop: 4,
                      background: i < currentIdx ? "#0DB87E" : "rgba(255,255,255,0.10)",
                    }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < 3 ? 24 : 0 }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: done ? "white" : "rgba(255,255,255,0.35)", margin: 0 }}>{step.label}</p>
                  {active && <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2, marginBottom: 0 }}>Agora</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ag.status === "pending_confirm" && (
        <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: 14, display: "flex", gap: 10, marginTop: 20 }}>
          <AlertCircle size={16} color="#F5A623" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.70)", margin: 0 }}>
            Aguardando confirmação. A diarista tem até 24h para responder.
          </p>
        </div>
      )}
      {ag.status === "confirmed" && (
        <div style={{ background: "rgba(13,184,126,0.08)", border: "1px solid rgba(13,184,126,0.25)", borderRadius: 12, padding: 14, display: "flex", gap: 10, marginTop: 20 }}>
          <CheckCircle size={16} color="#0DB87E" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>
            Agendamento confirmado! Prepare-se para o dia {new Date(ag.data + "T12:00").toLocaleDateString("pt-BR")}.
          </p>
        </div>
      )}
      {ag.status === "in_progress" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0DB87E", animation: "ubt-pulse-dot 1.4s ease-in-out infinite" }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>
            Iniciado às {ag.hora}.
          </p>
        </div>
      )}
      {ag.status.startsWith("cancelled") && (
        <div style={{ background: "rgba(232,64,64,0.08)", border: "1px solid rgba(232,64,64,0.25)", borderRadius: 12, padding: 14, marginTop: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <XCircle size={16} color="#E84040" />
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>Agendamento cancelado.</p>
          </div>
          <button
            onClick={() => navigate(`/app/diaristas/agendar/${ag.diaristId}`)}
            style={{ marginTop: 10, width: "100%", background: "#0DB87E", color: "white", border: "none", borderRadius: 999, padding: "10px 16px", fontFamily: "Syne", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Reagendar
          </button>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>{initials}</span>
          </div>
          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "white", flex: 1 }}>{diarista?.nome ?? "Diarista"}</span>
          {diarista && (
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#F5A623" }}>★ {diarista.rating}</span>
          )}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 12, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>Data</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>{new Date(ag.data + "T12:00").toLocaleDateString("pt-BR")}</p>
          </div>
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>Hora</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>{ag.hora}</p>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>Endereço</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>{ag.local.endereco}{ag.local.complemento ? ` · ${ag.local.complemento}` : ""}</p>
          </div>
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>Área</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "white", margin: 0 }}>{ag.local.m2}m²</p>
          </div>
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>Total</p>
            <p style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E", margin: 0 }}>R$ {ag.valorTotal.toFixed(2)}</p>
          </div>
        </div>
        {ag.materiaisSolicitados?.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
            {ag.materiaisSolicitados.map((mId) => {
              const m = MATERIAIS_PADRAO.find((x) => x.id === mId) || MATERIAIS_DETALHADOS.find((x) => x.id === mId);
              return m ? <span key={mId} style={{ fontSize: 14 }} title={m.nome}>{m.emoji}</span> : null;
            })}
            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>materiais solicitados</span>
          </div>
        )}
        {ag.notes && (
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.65)", fontStyle: "italic", marginTop: 10, marginBottom: 0 }}>
            "{ag.notes}"
          </p>
        )}
      </div>

      {(ag.status === "pending_confirm" || ag.status === "confirmed") && (
        <button
          onClick={cancelar}
          style={{ marginTop: 20, width: "100%", background: "transparent", border: "1px solid rgba(232,64,64,0.35)", color: "rgba(255,255,255,0.60)", fontFamily: "DM Sans", fontSize: 14, borderRadius: 999, padding: "12px", cursor: "pointer" }}
        >
          Cancelar agendamento
        </button>
      )}

      {ag.status === "completed" && !showRating && (
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginTop: 20 }}>
          <p style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "white", margin: 0, textAlign: "center" }}>Pagamento</p>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 4 }}>Total: R$ {ag.valorTotal.toFixed(2)}</p>
          <SplitBreakdown total={ag.valorTotal} />
          <button
            onClick={() => setShowRating(true)}
            style={{ marginTop: 16, width: "100%", background: "#0DB87E", color: "white", border: "none", borderRadius: 999, padding: "14px", fontFamily: "Syne", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Confirmar pagamento (PIX)
          </button>
        </div>
      )}

      {showRating && (
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginTop: 20 }}>
          <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "white", textAlign: "center", margin: 0 }}>Como foi o serviço?</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <Star size={32} fill={n <= rating ? "#F5A623" : "transparent"} color="#F5A623" />
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Deixe um comentário (opcional)"
            style={{ width: "100%", marginTop: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12, fontFamily: "DM Sans", fontSize: 14, color: "white", height: 80, resize: "none", outline: "none" }}
          />
          <button
            onClick={() => navigate("/app/home")}
            style={{ marginTop: 12, width: "100%", background: "#0DB87E", color: "white", border: "none", borderRadius: 999, padding: "14px", fontFamily: "Syne", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Enviar avaliação
          </button>
        </div>
      )}

      <style>{`@keyframes ubt-pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }`}</style>
    </div>
  );
};

export default DiaristaAgendamentoPage;
