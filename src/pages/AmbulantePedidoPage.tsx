import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bell, CheckCircle, ChevronDown, Loader2, Star, Building2, Gift, Heart, User, Users } from "lucide-react";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { calcSplit, SPLIT_META, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";

const ICONS = { User, Building2, Users, Gift, Star, Heart } as const;

type RemoteStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" | "rating";

const AmbulantePedidoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, setState, resetPedido } = useAmbulantePedido();

  const [status, setStatus] = useState<RemoteStatus>("pending");
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [splitOpen, setSplitOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const timersRef = useRef<number[]>([]);

  const itens = state.itens;
  const total = state.total + (state.modalidade === "delivery" ? 3 : 0);
  const split = calcSplit(total);
  const principalEmoji = useMemo(() => itens[0]?.emoji ?? "🍢", [itens]);

  // Try Firebase listener; fall back to mock auto-advance after fixed delays.
  useEffect(() => {
    if (!id || id.startsWith('local-')) return;
    async function fetchStatus() {
      const { data } = await supabase.from('pedidos').select('status').eq('id', id).single();
      if (data?.status) setStatus(data.status as RemoteStatus);
    }
    fetchStatus();

    const channel = supabase
      .channel('public:pedidos:'+id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new.status) setStatus(payload.new.status as RemoteStatus);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Mock auto-advance timeline (so the prototype shows all states)
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const push = (delay: number, fn: () => void) => {
      const t = window.setTimeout(fn, delay);
      timersRef.current.push(t);
    };
    if (status === "pending") {
      push(8000, () => setStatus("confirmed"));
    } else if (status === "confirmed") {
      push(2500, () => setStatus("preparing"));
    } else if (status === "preparing") {
      push(6000, () => setStatus("ready"));
    } else if (status === "ready") {
      push(4000, () => setStatus("completed"));
    }
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [status]);

  // Pending countdown
  useEffect(() => {
    if (status !== "pending") return;
    setSecondsLeft(120);
    const t = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  const updateRemote = async (patch: Record<string, unknown>) => {
    if (!id || id.startsWith('local-')) return;
    await supabase.from('pedidos').update(patch).eq('id', id);
  };

  const cancelar = () => {
    updateRemote({ status: "cancelled" });
    resetPedido();
    navigate(-1);
  };

  const confirmarPagamento = async () => {
    // Tenta chamar a Edge Function segura no backend
    let functionSuccess = false;
    try {
      const { data: checkData, error: checkError } = await supabase.functions.invoke("checkout", {
        body: {
          service_type: "ambulante",
          service_id: id,
          customer_id: user.uid || "mock-customer",
          provider_id: state.prestadorInfo?.id || "mock-provider",
          amount: total,
          payment_method: paymentMethod
        }
      });
      if (!checkError && checkData) {
        console.log("Checkout processado via Edge Function com sucesso:", checkData);
        functionSuccess = true;
      }
    } catch (funcErr) {
      console.warn("Falha ao chamar Edge Function, usando fallback local:", funcErr);
    }

    updateRemote({ payment_method: paymentMethod, payment_status: "confirmed", status: "rating" });
    setShowSuccess(true);
    window.setTimeout(() => {
      setShowSuccess(false);
      setStatus("rating");
    }, 1500);
  };

  const enviarAvaliacao = () => {
    // Avoid sending rating as the 'pedidos' table currently doesn't have a 'ratings' column
    // updateRemote({ ratings: { tomador: rating } });
    resetPedido();
    navigate("/app/home");
  };

  // Visual countdown stroke
  const COUNTDOWN_TOTAL = 120;
  const dash = 188.5; // 2*pi*30
  const offset = dash * (1 - secondsLeft / COUNTDOWN_TOTAL);

  const ResumoCard = (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
        marginTop: 20,
      }}
    >
      {itens.map((i) => (
        <div key={i.prodId} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
          <span className="font-sans" style={{ fontSize: 13, color: "#fff" }}>
            {i.emoji} {i.nome}{" "}
            <span style={{ color: "rgba(255,255,255,0.45)" }}>×{i.qty}</span>
          </span>
          <span className="font-sans" style={{ fontSize: 13, color: "#0DB87E" }}>
            R$ {i.subtotal.toFixed(2)}
          </span>
        </div>
      ))}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0" }} />
      <div className="flex items-center justify-between">
        <span className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Total</span>
        <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0DB87E" }}>
          R$ {total.toFixed(2)}
        </span>
      </div>
    </div>
  );

  const ChatChips = (
    <div className="flex gap-2 overflow-x-auto" style={{ marginTop: 14, scrollbarWidth: "none" as const }}>
      {["Pode demorar? ⏱", "Estou chegando 🚶", "Onde você está? 📍"].map((c) => (
        <button
          key={c}
          type="button"
          className="font-sans"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 999,
            padding: "8px 14px",
            color: "#fff",
            fontSize: 12,
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100svh", background: "#0B1B3E", padding: 24, color: "#fff" }}>
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/app/home")}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Pedido #{id?.slice(-4).toUpperCase()}
        </h1>
      </header>

      {status === "pending" && (
        <div className="flex flex-col items-center" style={{ marginTop: 48 }}>
          <Loader2 size={36} color="#0DB87E" className="animate-spin" />
          <p className="font-display" style={{ fontSize: 16, fontWeight: 700, marginTop: 16 }}>
            Aguardando confirmação...
          </p>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ marginTop: 16 }}>
            <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="30"
              fill="none" stroke="#0DB87E" strokeWidth="4"
              strokeDasharray={dash} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 32 32)"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
            <text x="32" y="38" textAnchor="middle" fontSize="14" fill="#fff" fontFamily="DM Sans" fontWeight="600">
              {secondsLeft}s
            </text>
          </svg>
          <button
            type="button"
            onClick={cancelar}
            className="font-sans"
            style={{
              marginTop: 20,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              padding: "10px 28px",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar pedido
          </button>
          {ResumoCard}
        </div>
      )}

      {status === "confirmed" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 48 }}>
          <CheckCircle size={48} color="#0DB87E" />
          <p className="font-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
            Pedido confirmado!
          </p>
          <p className="font-sans" style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", marginTop: 4 }}>
            O ambulante começará a preparar em breve.
          </p>
          {ResumoCard}
        </div>
      )}

      {status === "preparing" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 48 }}>
          <span style={{ fontSize: 56, animation: "ubt-bounce 0.8s infinite" }}>{principalEmoji}</span>
          <p className="font-display" style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
            Preparando seu pedido...
          </p>
          <p className="font-sans" style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", marginTop: 4 }}>
            Aguarde, já vem! 🍢
          </p>
          {ResumoCard}
          {ChatChips}
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 48 }}>
          <Bell size={48} color="#F5A623" style={{ animation: "ubt-shake 0.6s infinite" }} />
          <p className="font-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
            Pronto!
          </p>
          <p className="font-sans" style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", marginTop: 4 }}>
            {state.modalidade === "delivery" ? "Aguarde a entrega." : "Vá buscar seu pedido."}
          </p>
          {ResumoCard}
          {ChatChips}
        </div>
      )}

      {status === "completed" && (
        <div style={{ marginTop: 24 }}>
          <p className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Pagamento</p>
          {ResumoCard}

          {/* Split */}
          <button
            type="button"
            onClick={() => setSplitOpen((v) => !v)}
            className="flex items-center justify-between w-full mt-4"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#0DB87E" }}
          >
            <span className="font-sans" style={{ fontSize: 12 }}>Ver divisão do pagamento</span>
            <ChevronDown size={16} style={{ transform: splitOpen ? "rotate(180deg)" : "none", transition: "transform 250ms" }} />
          </button>
          {splitOpen && (
            <div className="mt-2" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SPLIT_META.map((s) => {
                const Icon = ICONS[s.icon];
                return (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <Icon size={14} color={s.color} />
                    <span className="font-sans flex-1" style={{ fontSize: 12, color: "#fff" }}>{s.label}</span>
                    <span className="font-sans" style={{ fontSize: 12, color: "#0DB87E" }}>{formatBRL(split[s.key])}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pix / Card */}
          <div className="flex gap-2 mt-5">
            {(["pix", "card"] as const).map((m) => {
              const active = paymentMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className="flex-1 font-sans"
                  style={{
                    border: `1.5px solid ${active ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
                    background: active ? "rgba(13,184,126,0.12)" : "rgba(255,255,255,0.04)",
                    color: active ? "#fff" : "rgba(255,255,255,0.55)",
                    borderRadius: 12, padding: 14, fontSize: 14, fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {m === "pix" ? "💸 PIX" : "💳 Cartão"}
                </button>
              );
            })}
          </div>

          {paymentMethod === "pix" && (
            <div
              className="mt-4 text-center"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: 20,
              }}
            >
              <div
                style={{
                  width: 160, height: 160, margin: "0 auto",
                  background: "white", borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#0B1B3E", fontFamily: "monospace" }}>QR PIX MOCK</span>
              </div>
              <p className="font-sans mt-3" style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
                Expira em 05:00
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={confirmarPagamento}
            className="font-display mt-5 w-full"
            style={{
              background: "#0DB87E", color: "#fff",
              border: "none", borderRadius: 12,
              padding: "14px 20px",
              fontSize: 15, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Confirmar pagamento <ArrowRight size={16} className="inline ml-1" />
          </button>
        </div>
      )}

      {status === "rating" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 32 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 999,
              background: "rgba(13,184,126,0.20)", border: "2px solid #0DB87E",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#0DB87E" }}>
              {state.prestadorInfo?.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "AM"}
            </span>
          </div>
          <p className="font-display mt-4" style={{ fontSize: 20, fontWeight: 700 }}>
            Como foi o pedido?
          </p>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
                aria-label={`${n} estrelas`}
              >
                <Star
                  size={36}
                  fill={n <= rating ? "#F5A623" : "transparent"}
                  stroke="#F5A623"
                />
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário opcional"
            className="font-sans"
            style={{
              marginTop: 16, width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12, padding: 12, color: "#fff",
              fontSize: 14, minHeight: 80, resize: "none", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={enviarAvaliacao}
            disabled={rating === 0}
            className="font-display mt-5 w-full"
            style={{
              background: "#0DB87E", color: "#fff",
              border: "none", borderRadius: 12, padding: "14px 20px",
              fontSize: 15, fontWeight: 700,
              cursor: rating === 0 ? "not-allowed" : "pointer",
              opacity: rating === 0 ? 0.5 : 1,
            }}
          >
            Enviar
          </button>
        </div>
      )}

      {showSuccess && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(11,27,62,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "ubt-fade 200ms ease",
          }}
        >
          <CheckCircle size={80} color="#0DB87E" style={{ animation: "ubt-pop 400ms ease" }} />
        </div>
      )}

      <style>{`
        @keyframes ubt-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes ubt-shake  { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)} }
        @keyframes ubt-fade   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ubt-pop    { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
};

export default AmbulantePedidoPage;
