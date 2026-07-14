import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, X } from "lucide-react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import BottomSheet from "@/components/settings/BottomSheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CATALOGO_PADRAO } from "@/mocks/ambulantesProdutos";
import { supabase } from "@/lib/supabase";

interface SessionProduto {
  nome: string;
  emoji: string;
  preco: number;
  disponivel: boolean;
  descricao?: string;
  variosValores?: boolean;
  foto?: string;
}

interface Pedido {
  id: string;
  itens: Array<{ prodId: string; nome: string; emoji: string; qty: number; precoUnit: number; subtotal: number }>;
  total: number;
  modalidade: "delivery" | "local_fixo";
  tomadorLocation?: { address: string };
  status?: string;
  createdAt?: number;
}

const FALLBACK_LOC = { lat: -23.432, lng: -45.083 };

const AmbulantesOnlinePage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [isOnline, setIsOnline] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number }>(FALLBACK_LOC);
  const [produtos, setProdutos] = useState<Record<string, SessionProduto>>({});
  const [modalidade, setModalidade] = useState<"delivery" | "local_fixo" | "both">("local_fixo");
  const [endereco, setEndereco] = useState("Praia Grande, Ubatuba");
  const [editEndereco, setEditEndereco] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Pedido | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [allOrders, setAllOrders] = useState<Pedido[]>([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const demoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user.uid) return;

    const loadSessionAndProducts = async () => {
      try {
        // 1. Carrega dados da sessão do prestador
        const { data: sessionData, error: sessionErr } = await supabase
          .from('ambulante_sessions')
          .select('modalidade, is_online, address')
          .eq('id', user.uid)
          .maybeSingle();

        if (sessionErr) throw sessionErr;

        if (sessionData) {
          setModalidade((sessionData.modalidade as "delivery" | "local_fixo" | "both") || "local_fixo");
          setIsOnline(!!sessionData.is_online);
          if (sessionData.address) {
            setEndereco(sessionData.address);
          }
        }

        // 2. Carrega produtos da sessão
        const { data: productsData, error: productsErr } = await supabase
          .from('ambulante_session_produtos')
          .select('preco, disponivel, produto_id, produtos(nome, emoji, descricao)')
          .eq('session_id', user.uid);

        if (productsErr) throw productsErr;

        if (productsData) {
          const mapped: Record<string, SessionProduto> = {};
          productsData.forEach((item: any) => {
            const prod = item.produtos;
            if (prod) {
              mapped[item.produto_id] = {
                nome: prod.nome,
                emoji: prod.emoji || "🍽️",
                preco: Number(item.preco),
                disponivel: !!item.disponivel,
                descricao: prod.descricao || "",
                variosValores: false
              };
            }
          });
          setProdutos(mapped);
        }
      } catch (err) {
        console.error("Erro ao carregar sessão/produtos do Supabase:", err);
        // Fallback local caso dê algum erro
        const defaults: Record<string, SessionProduto> = {};
        ["milho", "churrasco", "amendoim"].forEach((id) => {
          const p = CATALOGO_PADRAO.find((x) => x.id === id);
          if (p) defaults[id] = { nome: p.nome, emoji: p.emoji, preco: p.precoSugerido, disponivel: true, descricao: p.descricao };
        });
        setProdutos(defaults);
      }
    };

    loadSessionAndProducts();
  }, [user.uid]);

  const fetchOrders = async () => {
    if (!user.uid) return;
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          total,
          status,
          modalidade,
          delivery_address,
          delivery_lat,
          delivery_lng,
          created_at,
          pedido_itens (
            produto_id,
            nome,
            emoji,
            qty,
            preco_unit,
            subtotal
          )
        `)
        .eq('prestador_id', user.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const ordersList: Pedido[] = data.map((o: any) => ({
          id: o.id,
          itens: (o.pedido_itens || []).map((i: any) => ({
            prodId: i.produto_id || "unknown",
            nome: i.nome,
            emoji: i.emoji || "🍽️",
            qty: i.qty,
            precoUnit: Number(i.preco_unit),
            subtotal: Number(i.subtotal)
          })),
          total: Number(o.total),
          modalidade: o.modalidade as "delivery" | "local_fixo",
          tomadorLocation: o.delivery_address ? { address: o.delivery_address } : undefined,
          status: o.status,
          createdAt: new Date(o.created_at).getTime()
        }));

        setAllOrders(ordersList);

        const pending = ordersList.find((o) => o.status === "pending");
        if (pending) {
          setActiveOrder(prevActive => {
            if (!prevActive || prevActive.status !== "pending") {
              setShowOrderModal(true);
              if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
              return pending;
            }
            return prevActive;
          });
        }
      }
    } catch (err) {
      console.error("Erro ao buscar pedidos do Supabase:", err);
    }
  };

  // Listen for incoming pending pedidos
  useEffect(() => {
    if (!isOnline || !user.uid) {
      setAllOrders([]);
      return;
    }

    fetchOrders();

    const channel = supabase
      .channel(`prestador-pedidos-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `prestador_id=eq.${user.uid}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, user.uid]);

  // Demo: simulate an incoming pedido shortly after going online (so the prototype surfaces the modal)
  useEffect(() => {
    if (!isOnline || activeOrder) return;
    demoTimerRef.current = window.setTimeout(() => {
      const itens = Object.entries(produtos).slice(0, 2).map(([prodId, p]) => ({
        prodId, nome: p.nome, emoji: p.emoji, qty: 1, precoUnit: p.preco, subtotal: p.preco,
      }));
      if (itens.length === 0) return;
      const total = itens.reduce((a, i) => a + i.subtotal, 0);
      setActiveOrder({
        id: `demo-${Date.now()}`,
        itens, total, modalidade: "local_fixo",
      });
      setShowOrderModal(true);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }, 10000);
    return () => {
      if (demoTimerRef.current) window.clearTimeout(demoTimerRef.current);
    };
  }, [isOnline, produtos, activeOrder]);

  // Countdown for modal
  useEffect(() => {
    if (!showOrderModal) return;
    setSecondsLeft(120);
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [showOrderModal]);

  useEffect(() => {
    if (showOrderModal && secondsLeft === 0) {
      setShowOrderModal(false);
      setActiveOrder(null);
    }
  }, [secondsLeft, showOrderModal]);

  const updateEnderecoNoBanco = (novoEndereco: string) => {
    setEndereco(novoEndereco);
    supabase.from('ambulante_sessions')
      .update({ address: novoEndereco })
      .eq('id', user.uid)
      .then(({ error }) => {
        if (error) console.error("Erro ao atualizar endereço no Supabase:", error);
      });
  };

  const goOnline = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyLocation(loc);
          supabase.from('ambulante_sessions')
            .update({ is_online: true, lat: loc.lat, lng: loc.lng })
            .eq('id', user.uid)
            .then(({ error }) => {
              if (error) console.error("Erro ao atualizar online no Supabase:", error);
            });
        },
        () => {
          supabase.from('ambulante_sessions')
            .update({ is_online: true })
            .eq('id', user.uid)
            .then(({ error }) => {
              if (error) console.error("Erro ao atualizar online no Supabase:", error);
            });
        },
        { timeout: 4000 }
      );
    } else {
      supabase.from('ambulante_sessions')
        .update({ is_online: true })
        .eq('id', user.uid)
        .then(({ error }) => {
          if (error) console.error("Erro ao atualizar online no Supabase:", error);
        });
    }
    setIsOnline(true);
  };

  const goOffline = () => {
    setIsOnline(false);
    supabase.from('ambulante_sessions')
      .update({ is_online: false })
      .eq('id', user.uid)
      .then(({ error }) => {
        if (error) console.error("Erro ao atualizar offline no Supabase:", error);
      });
  };

  const toggleProdDisponivel = (prodId: string, value: boolean) => {
    setProdutos((p) => ({ ...p, [prodId]: { ...p[prodId], disponivel: value } }));
    supabase.from('ambulante_session_produtos')
      .update({ disponivel: value })
      .eq('session_id', user.uid)
      .eq('produto_id', prodId)
      .then(({ error }) => {
        if (error) console.error("Erro ao atualizar disponibilidade no Supabase:", error);
      });
  };

  const aceitarPedido = () => {
    if (!activeOrder) return;
    if (!activeOrder.id.startsWith("demo-")) {
      supabase.from('pedidos')
        .update({ status: "confirmed" })
        .eq('id', activeOrder.id)
        .then(({ error }) => {
          if (error) console.error("Erro ao aceitar pedido no Supabase:", error);
        });
    }
    setShowOrderModal(false);
    navigate(`/app/prestador/ambulantes/pedido/${activeOrder.id}`);
  };

  const recusarPedido = () => {
    if (!activeOrder) return;
    if (!activeOrder.id.startsWith("demo-")) {
      supabase.from('pedidos')
        .update({ status: "cancelled" })
        .eq('id', activeOrder.id)
        .then(({ error }) => {
          if (error) console.error("Erro ao recusar pedido no Supabase:", error);
        });
    }
    setShowOrderModal(false);
    setActiveOrder(null);
  };

  const dash = 188.5;
  const offset = dash * (1 - secondsLeft / 120);

  return (
    <div className="relative" style={{ height: "100svh", overflow: "hidden", background: "#F7F8FA" }}>
      <div className="absolute inset-0">
        <PrestadorMapLight myLocation={myLocation} providerType="ambulante" />
      </div>

      <button
        type="button"
        onClick={() => navigate("/app/prestador/home")}
        className="absolute top-4 left-4 z-10 flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: 999,
          background: "#fff", boxShadow: "0 2px 8px rgba(11,27,62,0.15)",
        }}
        aria-label="Voltar"
      >
        <ChevronLeft size={20} color="#0B1B3E" />
      </button>

      {/* Bottom sheet white */}
      <div
        className="absolute left-0 right-0 bottom-0 z-40"
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "10px 20px 96px",
          maxHeight: "62vh",
          overflowY: "auto",
          boxShadow: "0 -10px 30px rgba(11,27,62,0.10)",
          zIndex: 1000
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "#D8DBE5", margin: "0 auto 14px" }} />

        {/* Online/Offline */}
        <div
          className="rounded-2xl"
          style={{ background: "#fff", padding: 20, boxShadow: "0 2px 8px rgba(11,27,62,0.06)", border: "1px solid #EFF0F3" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: isOnline ? "#0B1B3E" : "#9399AD", margin: 0 }}>
                {isOnline ? "Você está ONLINE" : "Você está OFFLINE"}
              </p>
              <p className="font-sans" style={{ fontSize: 12, color: "#5B6178", marginTop: 4 }}>
                {isOnline ? "Aparecendo no mapa para clientes" : "Invisível para clientes"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isOnline ? goOffline() : goOnline())}
              aria-label="toggle online"
              className="rounded-full relative"
              style={{ width: 60, height: 32, background: isOnline ? "#0DB87E" : "#D8DBE5", border: "none", cursor: "pointer" }}
            >
              <span
                className="block rounded-full bg-white"
                style={{
                  width: 28, height: 28, margin: 2,
                  boxShadow: "0 2px 4px rgba(11,27,62,0.20)",
                  transition: "transform 300ms",
                  transform: isOnline ? "translateX(28px)" : "translateX(0)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Endereço (local fixo) */}
        {(modalidade === "local_fixo" || modalidade === "both") && (
          <div
            className="rounded-2xl"
            style={{ background: "#fff", padding: 14, boxShadow: "0 2px 8px rgba(11,27,62,0.06)", border: "1px solid #EFF0F3", marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}
          >
            <MapPin size={16} color="#0DB87E" />
            {editEndereco ? (
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                onBlur={() => {
                  setEditEndereco(false);
                  updateEnderecoNoBanco(endereco);
                }}
                autoFocus
                className="flex-1 outline-none font-sans"
                style={{ fontSize: 14, color: "#0B1B3E" }}
              />
            ) : (
              <span className="font-sans flex-1" style={{ fontSize: 14, color: "#0B1B3E" }}>{endereco}</span>
            )}
            <button
              type="button"
              onClick={() => setEditEndereco(true)}
              className="font-sans"
              style={{ background: "none", border: "none", color: "#0DB87E", fontSize: 12, cursor: "pointer" }}
            >
              Alterar
            </button>
          </div>
        )}

        {/* Fila de pedidos (Next in queue) */}
        <div
          className="rounded-2xl"
          style={{ background: "#fff", padding: 16, boxShadow: "0 2px 8px rgba(11,27,62,0.06)", border: "1px solid #EFF0F3", marginTop: 12, cursor: "pointer" }}
          onClick={() => setShowQueueModal(true)}
        >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <p className="font-sans uppercase" style={{ fontSize: 12, fontWeight: 700, color: "#9399AD", letterSpacing: 0.5, margin: 0 }}>
                Fila de Pedidos ({allOrders.filter(o => o.status !== "finished" && o.status !== "cancelled").length})
              </p>
              <span style={{ fontSize: 12, color: "#0DB87E", fontWeight: 600 }}>Ver todos</span>
            </div>
            {(() => {
              const next = allOrders.find(o => o.status === "confirmed" || o.status === "preparing" || o.status === "pending");
              if (!next) return <p className="font-sans" style={{ fontSize: 13, color: "#5B6178", margin: 0 }}>Nenhum pedido em andamento.</p>;
              return (
                <div className="flex items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 20 }}>🍽️</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "#0B1B3E", margin: 0 }}>Pedido #{next.id.slice(-4)}</p>
                    <p className="font-sans" style={{ fontSize: 12, color: "#5B6178", margin: 0 }}>{next.itens.length} {next.itens.length === 1 ? "item" : "itens"} · R$ {next.total.toFixed(2)}</p>
                  </div>
                </div>
              );
            })()}
          </div>

        {/* Cardápio */}
        <div
          style={{
            background: "#F7F8FA",
            borderRadius: 14, padding: 16, marginTop: 12,
          }}
        >
          <div className="flex items-center justify-between" style={{ margin: "0 0 10px" }}>
            <p className="font-sans uppercase" style={{ fontSize: 12, fontWeight: 600, color: "#9399AD", letterSpacing: 0.5, margin: 0 }}>
              Meu cardápio
            </p>
            <button
              type="button"
              onClick={() => navigate("/app/prestador/ambulantes/onboarding")}
              className="font-sans"
              style={{ background: "none", border: "none", color: "#0DB87E", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
            >
              Editar
            </button>
          </div>
          {Object.keys(produtos).length === 0 ? (
            <p className="font-sans" style={{ fontSize: 13, color: "#5B6178" }}>Nenhum produto cadastrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(produtos).map(([id, p]) => (
                <div key={id} className="flex items-center gap-2">
                  {p.foto ? (
                    <img src={p.foto} alt={p.nome} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 16 }}>{p.emoji}</span>
                  )}
                  <span className="font-sans flex-1" style={{ fontSize: 13, color: "#0B1B3E" }}>{p.nome}</span>
                  <span className="font-sans" style={{ fontSize: 13, color: "#0DB87E", fontWeight: 600 }}>
                    {p.variosValores ? "Diversos valores" : `R$ ${p.preco.toFixed(2)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleProdDisponivel(id, !p.disponivel)}
                    className="rounded-full relative"
                    style={{ width: 36, height: 20, background: p.disponivel ? "#0DB87E" : "#D8DBE5", border: "none", cursor: "pointer" }}
                    aria-label={p.disponivel ? "Disponível" : "Esgotado"}
                  >
                    <span
                      className="block rounded-full bg-white"
                      style={{
                        width: 16, height: 16, margin: 2,
                        transition: "transform 250ms",
                        transform: p.disponivel ? "translateX(16px)" : "translateX(0)",
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mini ganhos */}
        <div
          className="flex items-center justify-between"
          style={{ background: "#EFF0F3", borderRadius: 12, padding: "12px 16px", marginTop: 12 }}
        >
          <span className="font-sans" style={{ fontSize: 14, color: "#0B1B3E", fontWeight: 600 }}>Hoje: R$ 0,00</span>
          <span className="font-sans" style={{ fontSize: 12, color: "#9399AD" }}>0 pedidos</span>
        </div>

        {isOnline && (
          <button
            type="button"
            onClick={goOffline}
            className="w-full font-sans"
            style={{
              marginTop: 12, minHeight: 44, borderRadius: 999,
              border: "1px solid #D8DBE5", background: "transparent",
              color: "#5B6178", fontSize: 14, cursor: "pointer",
            }}
          >
            Ir offline
          </button>
        )}
      </div>

      {/* Modal de novo pedido */}
      {showOrderModal && activeOrder && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.50)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            style={{
              width: "100%", background: "#fff",
              borderRadius: "24px 24px 0 0",
              padding: 24, animation: "ubt-slide-up 300ms ease",
              maxHeight: "85vh", overflowY: "auto",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "#D8DBE5", margin: "0 auto 14px" }} />

            <div className="flex items-start justify-between">
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
                Novo pedido! 🛍️
              </h2>
              <button
                type="button"
                onClick={recusarPedido}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5B6178" }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center mt-3">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="none" stroke="#EFF0F3" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="30"
                  fill="none" stroke="#0DB87E" strokeWidth="4"
                  strokeDasharray={dash} strokeDashoffset={offset}
                  strokeLinecap="round" transform="rotate(-90 32 32)"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
                <text x="32" y="38" textAnchor="middle" fontSize="14" fill="#0B1B3E" fontFamily="DM Sans" fontWeight="600">
                  {secondsLeft}s
                </text>
              </svg>
            </div>

            <div
              style={{
                background: "#F7F8FA", borderRadius: 16,
                padding: 20, marginTop: 16,
              }}
            >
              <span
                className="font-sans"
                style={{
                  background: "#E6FAF4", border: "1px solid #0DB87E",
                  color: "#0DB87E", fontSize: 11, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 999,
                }}
              >
                {activeOrder.modalidade === "delivery" ? "🛵 Delivery" : "📍 Retirar"}
              </span>
              <div style={{ marginTop: 12 }}>
                {activeOrder.itens.map((i) => (
                  <div key={i.prodId} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
                    <span className="font-sans" style={{ fontSize: 14, color: "#0B1B3E" }}>
                      {i.emoji} {i.nome}{" "}
                      <span style={{ color: "#9399AD", fontSize: 12 }}>×{i.qty}</span>
                    </span>
                    <span className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "#0DB87E" }}>
                      R$ {i.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: "#D8DBE5", margin: "10px 0" }} />
              <div className="flex items-center justify-between">
                <span className="font-sans" style={{ fontSize: 13, color: "#9399AD" }}>Total do pedido</span>
                <span className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#0DB87E" }}>
                  R$ {activeOrder.total.toFixed(2)}
                </span>
              </div>
              {activeOrder.modalidade === "delivery" && activeOrder.tomadorLocation && (
                <div className="flex items-center gap-2 mt-2">
                  <MapPin size={14} color="#E84040" />
                  <span className="font-sans" style={{ fontSize: 13, color: "#5B6178" }}>
                    {activeOrder.tomadorLocation.address}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3" style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={recusarPedido}
                className="flex-1 font-sans"
                style={{
                  border: "1px solid #D8DBE5", borderRadius: 999,
                  background: "transparent", padding: 14,
                  color: "#5B6178", fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={aceitarPedido}
                className="flex-1 font-display"
                style={{
                  background: "#0DB87E", border: "none", borderRadius: 999,
                  padding: 14, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ubt-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      
      {/* Modal Fila de Pedidos */}
      <BottomSheet open={showQueueModal} onClose={() => setShowQueueModal(false)}>
        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#0B1B3E", marginBottom: 16 }}>Todos os pedidos</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
          {allOrders.length === 0 && (
            <p className="font-sans text-center" style={{ fontSize: 14, color: "#5B6178", padding: "20px 0" }}>Nenhum pedido recebido ainda.</p>
          )}
          {allOrders.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                if (o.status !== "finished" && o.status !== "cancelled") {
                  navigate(`/app/prestador/ambulantes/pedido/${o.id}`);
                }
              }}
              className="flex items-center justify-between"
              style={{
                padding: 12, borderRadius: 12, border: "1px solid #E2E8F0",
                background: o.status === "pending" ? "#FFF8E1" : o.status === "confirmed" || o.status === "preparing" ? "#E6FAF4" : "#F7F8FA",
                opacity: o.status === "finished" || o.status === "cancelled" ? 0.6 : 1,
                cursor: o.status !== "finished" && o.status !== "cancelled" ? "pointer" : "default"
              }}
            >
              <div>
                <p className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: "#0B1B3E", margin: 0 }}>Pedido #{o.id.slice(-4)}</p>
                <p className="font-sans" style={{ fontSize: 12, color: "#5B6178", margin: 0 }}>
                  {o.status === "pending" && "Pendente"}
                  {(o.status === "confirmed" || o.status === "preparing") && "Em preparo"}
                  {o.status === "finished" && "Concluído"}
                  {o.status === "cancelled" && "Cancelado"}
                  {' · '}
                  R$ {o.total.toFixed(2)}
                </p>
              </div>
              <ChevronLeft size={16} color="#9399AD" style={{ transform: "rotate(180deg)" }} />
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
};

export default AmbulantesOnlinePage;
