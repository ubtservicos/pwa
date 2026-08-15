import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Minus, Plus, Star } from "lucide-react";
import { MOCK_SESSIONS, MOCK_FALLBACK_SESSIONS, getCategoriaIcon } from "@/mocks/ambulantesSessions";
import { findProduto } from "@/mocks/ambulantesProdutos";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

interface ProdutoData {
  nome: string;
  emoji: string;
  preco: number;
  descricao?: string;
  disponivel: boolean;
  categoria?: string;
  foto?: string;
}

interface SessionData {
  sessionId: string;
  nome: string;
  modalidade: "local_fixo" | "delivery" | "both";
  location: { lat: number; lng: number; address?: string };
  produtos: Record<string, ProdutoData> | string[];
  rating: number;
  totalPedidos: number;
}

const AmbulanteCatalogPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { state, addItem, removeItem, setSession } = useAmbulantePedido();

  const [session, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    async function load() {
      const { data, error } = await supabase
        .from('ambulante_sessions')
        .select(`
          id, modalidade, lat, lng, is_online, rating, total_pedidos,
          usuarios ( nome ),
          ambulante_session_produtos (
            preco, disponivel,
            produtos ( id, nome, emoji, descricao, categoria )
          )
        `)
        .eq('id', sessionId)
        .single();
        
      if (error || !data) {
        setSessionData(null);
        setLoading(false);
        return;
      }

      type SPType = { disponivel: boolean; preco: number; produtos: { id: string; nome: string; emoji: string; descricao: string; categoria: string; preco: number } };
      
      const row = data as unknown as {
        id: string;
        modalidade: "local_fixo" | "delivery" | "both";
        lat: number;
        lng: number;
        is_online: boolean;
        rating: number;
        total_pedidos: number;
        usuarios: { nome: string } | { nome: string }[] | null;
        ambulante_session_produtos: SPType[];
      };

      const userName = Array.isArray(row.usuarios) ? row.usuarios[0]?.nome : row.usuarios?.nome;
      
      const produtosData: Record<string, ProdutoData> = {};
      if (row.ambulante_session_produtos) {
        row.ambulante_session_produtos.forEach((sp) => {
          if (sp.disponivel && sp.produtos) {
            produtosData[sp.produtos.id] = {
              nome: sp.produtos.nome,
              emoji: sp.produtos.emoji,
              preco: sp.preco || sp.produtos.preco,
              descricao: sp.produtos.descricao,
              disponivel: true,
              categoria: sp.produtos.categoria
            };
          }
        });
      }
      
      setSessionData({
        sessionId: row.id,
        nome: userName || "Ambulante",
        modalidade: row.modalidade || "local_fixo",
        location: { lat: row.lat, lng: row.lng },
        produtos: produtosData,
        rating: row.rating,
        totalPedidos: row.total_pedidos
      });
      setLoading(false);
    }
    load();
    
    const channel = supabase
      .channel('public:ambulante_sessions:'+sessionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulante_sessions', filter: `id=eq.${sessionId}` }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Hydrate session in context once
  useEffect(() => {
    if (session && state.sessionId !== sessionId) {
      const cat = getCategoriaIcon(session.produtos);
      setSession(session.sessionId, { nome: session.nome, emoji: cat.emoji, rating: session.rating });
    }
  }, [session, state.sessionId, sessionId, setSession]);

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", background: "#09090B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="font-display">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100svh", background: "#09090B", color: "#fff", padding: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          <ArrowLeft size={20} />
        </button>
        <p className="font-display mt-4" style={{ fontSize: 18 }}>Ambulante não encontrado.</p>
      </div>
    );
  }

  const initials = session.nome.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  const qtyOf = (prodId: string) =>
    state.itens.find((i) => i.prodId === prodId)?.qty ?? 0;

  const totalCarrinho = state.total;
  const totalItens = state.itens.reduce((a, i) => a + i.qty, 0);

  return (
    <div style={{ minHeight: "100svh", background: "#09090B", paddingBottom: 160 }}>
      {/* Header */}
      <header className="flex items-center gap-4" style={{ height: 56, padding: "0 20px" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-display flex-1" style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          Cardápio
        </h1>
        <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          ~1.2km
        </span>
      </header>

      {/* Banner */}
      <div
        style={{
          position: "relative", height: 130,
          background: "linear-gradient(135deg, #132348, #1C3261)",
        }}
      >
        <div
          style={{
            position: "absolute", bottom: -28, left: 24,
            width: 56, height: 56, borderRadius: 999,
            border: "2px solid #0DB87E",
            background: "rgba(13,184,126,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#0DB87E" }}>
            {initials}
          </span>
        </div>
        <span
          className="font-sans"
          style={{
            position: "absolute", top: 12, right: 16,
            fontSize: 11, color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.30)", padding: "4px 10px", borderRadius: 999,
          }}
        >
          {session.modalidade === "both" ? "🛵 Delivery & 📍 Local Fixo" : session.modalidade === "delivery" ? "🛵 Delivery" : "📍 Local Fixo"}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: "0 24px", marginTop: 36 }}>
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          {session.nome}
        </h2>
        {(session.modalidade === "local_fixo" || session.modalidade === "both") && (
          <div className="mt-1 flex items-center gap-1.5">
            <MapPin size={14} color="#0DB87E" />
            <span className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
              {session.location.address ?? "Ubatuba"}
            </span>
            <button
              type="button"
              onClick={() => window.open(`https://maps.google.com/?q=${session.location.lat},${session.location.lng}`)}
              className="font-sans"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#0DB87E", fontSize: 12, textDecoration: "underline",
              }}
            >
              Ver no mapa
            </button>
          </div>
        )}
        <div className="mt-1 flex items-center gap-1">
          <Star size={14} fill="#F5A623" stroke="#F5A623" />
          <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {session.rating.toFixed(1)}
          </span>
          <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            ({session.totalPedidos} pedidos)
          </span>
        </div>
      </div>

      {/* Catálogo */}
      <div style={{ padding: "0 24px", marginTop: 20 }}>
        <p
          className="font-sans uppercase"
          style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: 1.5, margin: 0 }}
        >
          Disponíveis agora
        </p>

        <div className="grid grid-cols-2 gap-3 mt-3">
          {(() => {
            let items: Array<{ id: string; nome: string; descricao: string; emoji: string; preco: number; foto?: string }> = [];
            if (Array.isArray(session.produtos)) {
              items = session.produtos.map((pid: string) => {
                const p = findProduto(pid);
                if (!p) return null;
                return { id: pid, nome: p.nome, descricao: p.descricao, emoji: p.emoji, preco: p.precoSugerido };
              }).filter((v): v is NonNullable<typeof v> => v !== null);
            } else {
              items = Object.entries(session.produtos as Record<string, ProdutoData>).map(([pid, pData]) => {
                if (!pData.disponivel) return null;
                return { id: pid, nome: pData.nome, descricao: pData.descricao || "", emoji: pData.emoji, preco: pData.preco, foto: pData.foto };
              }).filter(Boolean);
            }

            return items.map((prod) => {
              const qty = qtyOf(prod.id);
              return (
                <div
                  key={prod.id}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: 88,
                      background: "rgba(255,255,255,0.04)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 40,
                      overflow: "hidden"
                    }}
                  >
                    {prod.foto ? (
                      <img src={prod.foto} alt={prod.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      prod.emoji
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <p className="font-sans truncate" style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                      {prod.nome}
                    </p>
                    {prod.descricao && (
                      <p
                        className="font-sans truncate"
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}
                      >
                        {prod.descricao}
                      </p>
                    )}
                    <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
                      <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#0DB87E" }}>
                        R$ {prod.preco.toFixed(2)}
                      </span>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addItem(prod.id, prod.preco, prod.nome, prod.emoji)}
                          style={{
                            width: 28, height: 28, borderRadius: 999,
                            background: "#0DB87E", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                          aria-label="Adicionar"
                        >
                          <Plus size={14} color="#fff" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeItem(prod.id)}
                            style={{
                              width: 28, height: 28, borderRadius: 999,
                              background: "rgba(255,255,255,0.10)", border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            aria-label="Remover"
                          >
                            <Minus size={14} color="#fff" />
                          </button>
                          <span
                            className="font-display"
                            style={{ fontSize: 15, fontWeight: 700, color: "#fff", minWidth: 16, textAlign: "center" }}
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addItem(prod.id, prod.preco, prod.nome, prod.emoji)}
                            style={{
                              width: 28, height: 28, borderRadius: 999,
                              background: "#0DB87E", border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            aria-label="Adicionar"
                          >
                            <Plus size={14} color="#fff" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Cart bar */}
      <div
        onClick={() => navigate("/app/ambulantes/carrinho")}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 20,
          background: "#0DB87E",
          borderRadius: "16px 16px 0 0",
          padding: "16px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer",
          transform: `translateY(${totalCarrinho > 0 ? "0" : "100%"})`,
          transition: "transform 250ms ease",
        }}
      >
        <span
          className="font-sans"
          style={{
            background: "rgba(255,255,255,0.20)",
            borderRadius: 999, padding: "4px 10px",
            fontSize: 13, fontWeight: 600, color: "#fff",
          }}
        >
          {totalItens} {totalItens === 1 ? "item" : "itens"}
        </span>
        <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          Ver carrinho
        </span>
        <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          R$ {totalCarrinho.toFixed(2)}
        </span>
      </div>

      
    </div>
  );
};

export default AmbulanteCatalogPage;
