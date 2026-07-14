import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, CheckCircle, Building2, Gift, Heart, MapPin, Star, User, Users } from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { calcSplit, SPLIT_META, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";

const ICONS = { User, Building2, Users, Gift, Star, Heart } as const;

type Status = "confirmed" | "preparing" | "ready" | "completed";

interface PedidoData {
  itens: Array<{ prodId: string; nome: string; emoji: string; qty: number; precoUnit: number; subtotal: number }>;
  total: number;
  modalidade: "delivery" | "local_fixo";
  tomadorLocation?: { lat?: number; lng?: number; address?: string; referencia?: string };
}

// Demo fallback when no Firebase data available
const demoPedido: PedidoData = {
  itens: [
    { prodId: "milho", nome: "Milho", emoji: "🌽", qty: 2, precoUnit: 6, subtotal: 12 },
    { prodId: "churrasco", nome: "Churrasco", emoji: "🍢", qty: 1, precoUnit: 12, subtotal: 12 },
  ],
  total: 24,
  modalidade: "local_fixo",
};

const AmbulantesGerenciarPedidoPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>("confirmed");
  const [pedido, setPedido] = useState<PedidoData>(demoPedido);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!id || id.startsWith("demo-")) return;
    
    async function load() {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          status, modalidade, total, delivery_lat, delivery_lng, delivery_address, delivery_referencia,
          pedido_itens ( produto_id, nome, emoji, qty, preco_unit, subtotal )
        `)
        .eq('id', id)
        .single();
        
      if (data) {
        if (["confirmed", "preparing", "ready", "completed"].includes(data.status)) {
          setStatus(data.status as Status);
        }
        setPedido({
          itens: data.pedido_itens.map((i: any) => ({
            prodId: i.produto_id || 'unknown',
            nome: i.nome,
            emoji: i.emoji,
            qty: i.qty,
            precoUnit: i.preco_unit,
            subtotal: i.subtotal
          })),
          total: data.total,
          modalidade: data.modalidade as any,
          tomadorLocation: data.modalidade === 'delivery' ? {
            lat: data.delivery_lat,
            lng: data.delivery_lng,
            address: data.delivery_address,
            referencia: data.delivery_referencia
          } : undefined
        });
      }
    }
    load();

    const channel = supabase
      .channel('public:pedidos:'+id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new.status && ["confirmed", "preparing", "ready", "completed"].includes(payload.new.status)) {
          setStatus(payload.new.status as Status);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const advance = async (next: Status) => {
    setStatus(next);
    if (id && !id.startsWith("demo-")) {
      await supabase.from('pedidos').update({
        status: next,
        ...(next === "completed" ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', id);
    }
  };

  const ganhos = +(pedido.total * 0.9).toFixed(2);
  const split = calcSplit(pedido.total);

  const enviarChip = (msg: string) => {
    // Para o futuro: enviar mensagem via chat no Supabase
  };

  return (
    <div style={{ minHeight: "100svh", background: "#F7F8FA", padding: "24px 24px 100px" }}>
      <header className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate("/app/prestador/ambulantes/online")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#0B1B3E" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
          Pedido #{id?.slice(-4).toUpperCase()}
        </h1>
      </header>

      {/* Card itens */}
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: 20,
          boxShadow: "0 2px 8px rgba(11,27,62,0.06)",
        }}
      >
        {pedido.itens.map((i) => (
          <div key={i.prodId} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
            <span className="font-sans" style={{ fontSize: 14, color: "#0B1B3E" }}>
              {i.emoji} {i.nome}{" "}
              <span style={{ color: "#9399AD", fontSize: 12 }}>×{i.qty}</span>
            </span>
            <span className="font-sans" style={{ fontSize: 14, color: "#0DB87E", fontWeight: 600 }}>
              R$ {i.subtotal.toFixed(2)}
            </span>
          </div>
        ))}
        <div style={{ height: 1, background: "#EFF0F3", margin: "10px 0" }} />
        <div className="flex items-center justify-between">
          <span className="font-sans" style={{ fontSize: 13, color: "#9399AD" }}>Total</span>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>
            R$ {pedido.total.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span
            className="font-sans"
            style={{
              background: "#E6FAF4", border: "1px solid #0DB87E",
              color: "#0DB87E", fontSize: 11, fontWeight: 600,
              padding: "3px 10px", borderRadius: 999,
            }}
          >
            {pedido.modalidade === "delivery" ? "🛵 Delivery" : "📍 Retirar"}
          </span>
          {pedido.modalidade === "delivery" && pedido.tomadorLocation?.address && (
            <div className="flex flex-col gap-1 mt-3 w-full" style={{ background: "#F7F8FA", padding: 12, borderRadius: 12, border: "1px solid #EFF0F3" }}>
              <span className="font-sans flex items-center gap-1" style={{ fontSize: 13, color: "#5B6178" }}>
                <MapPin size={14} color="#E84040" /> {pedido.tomadorLocation.address}
              </span>
              {pedido.tomadorLocation.referencia && (
                <span className="font-sans flex items-start gap-1 mt-1" style={{ fontSize: 13, color: "#0B1B3E", fontWeight: 600 }}>
                  <span style={{ fontSize: 14 }}>ℹ️</span> Ref: {pedido.tomadorLocation.referencia}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ações por status */}
      {status === "confirmed" && (
        <div style={{ marginTop: 20 }}>
          <PrimaryButtonLight onClick={() => advance("preparing")}>
            Iniciar preparo
          </PrimaryButtonLight>
        </div>
      )}

      {status === "preparing" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 28 }}>
          <span style={{ fontSize: 56, animation: "ubt-bounce 1s infinite" }}>{pedido.itens[0]?.emoji ?? "🍢"}</span>
          <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", marginTop: 12 }}>
            Preparando seu pedido...
          </p>
          <div className="w-full" style={{ marginTop: 20 }}>
            <PrimaryButtonLight onClick={() => advance("ready")}>
              {pedido.modalidade === "delivery" ? "Pronto para entrega" : "Pronto para retirada"}
            </PrimaryButtonLight>
          </div>
        </div>
      )}

      {status === "ready" && pedido.modalidade === "delivery" && (
        <div style={{ marginTop: 20 }}>
          <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
            A caminho do cliente
          </p>
          <div className="relative" style={{ height: 180, borderRadius: 16, overflow: "hidden", marginTop: 12 }}>
            <PrestadorMapLight myLocation={{ lat: -23.432, lng: -45.083 }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <PrimaryButtonLight onClick={() => advance("completed")}>
              Entregue — concluir pedido
            </PrimaryButtonLight>
          </div>
        </div>
      )}

      {status === "ready" && pedido.modalidade === "local_fixo" && (
        <div className="flex flex-col items-center text-center" style={{ marginTop: 28 }}>
          <Bell size={48} color="#F5A623" style={{ animation: "ubt-shake 0.6s infinite" }} />
          <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", marginTop: 12 }}>
            Aguardando o cliente retirar
          </p>
          <div className="w-full" style={{ marginTop: 20 }}>
            <PrimaryButtonLight onClick={() => advance("completed")}>
              Cliente retirou — concluir pedido
            </PrimaryButtonLight>
          </div>
        </div>
      )}

      {/* Chat rápido */}
      {(status === "confirmed" || status === "preparing" || status === "ready") && (
        <div className="flex gap-2 overflow-x-auto" style={{ marginTop: 20, scrollbarWidth: "none" as const }}>
          {["Estou preparando 🍢", "Pronto em 5 min ⏱", "Pode vir buscar ✅"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => enviarChip(m)}
              className="font-sans"
              style={{
                background: "#EFF0F3", border: "1px solid #D8DBE5",
                color: "#0B1B3E", borderRadius: 999, padding: "8px 14px",
                fontSize: 12, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {status === "completed" && (
        <div style={{ marginTop: 24 }}>
          <div className="flex flex-col items-center text-center">
            <CheckCircle size={48} color="#0DB87E" />
            <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#0B1B3E", marginTop: 12 }}>
              Pedido concluído!
            </p>
          </div>
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 20,
              boxShadow: "0 2px 8px rgba(11,27,62,0.06)", marginTop: 16, textAlign: "center",
            }}
          >
            <p className="font-sans" style={{ fontSize: 13, color: "#9399AD", margin: 0 }}>
              Você recebeu
            </p>
            <p className="font-display" style={{ fontSize: 28, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
              R$ {ganhos.toFixed(2)}
            </p>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
              {SPLIT_META.map((s) => {
                const Icon = ICONS[s.icon];
                return (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <Icon size={14} color={s.color} />
                    <span className="font-sans flex-1" style={{ fontSize: 12, color: "#0B1B3E" }}>{s.label}</span>
                    <span className="font-sans" style={{ fontSize: 12, color: "#0DB87E", fontWeight: 600 }}>
                      {formatBRL(split[s.key])}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <p className="font-sans" style={{ fontSize: 13, color: "#5B6178", marginBottom: 8 }}>Avalie o cliente</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                  aria-label={`${n} estrelas`}
                >
                  <Star size={28} fill={n <= rating ? "#F5A623" : "transparent"} stroke="#F5A623" />
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <PrimaryButtonLight
              onClick={() => {
                if (id && !id.startsWith("demo-")) {
                }
                navigate("/app/prestador/ambulantes/online");
              }}
            >
              Voltar e continuar vendendo
            </PrimaryButtonLight>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ubt-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes ubt-shake  { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)} }
      `}</style>
    </div>
  );
};

export default AmbulantesGerenciarPedidoPage;
