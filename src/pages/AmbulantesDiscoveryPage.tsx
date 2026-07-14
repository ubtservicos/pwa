import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ShoppingBag, Star, X } from "lucide-react";
import AmbulantesMap from "@/components/ambulantes/AmbulantesMap";
import { MOCK_SESSIONS, MOCK_FALLBACK_SESSIONS, type AmbulanteSession, getCategoriaIcon } from "@/mocks/ambulantesSessions";
import { findProduto, type CategoriaHint } from "@/mocks/ambulantesProdutos";
import { haversineKm, formatDist } from "@/utils/geo";
import { supabase } from "@/lib/supabase";

const FILTROS: Array<{ label: string; cat: CategoriaHint | "Todos" }> = [
  { label: "Todos", cat: "Todos" },
  { label: "🍢 Comida", cat: "Comida" },
  { label: "🥥 Bebida", cat: "Bebida" },
  { label: "🏄 Esporte", cat: "Esporte" },
  { label: "🕶️ Acessório", cat: "Acessório" },
];

const FALLBACK_CENTER = { lat: -23.432, lng: -45.083 };

const AmbulantesDiscoveryPage = () => {
  const navigate = useNavigate();
  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<typeof FILTROS[number]["cat"]>("Todos");
  const [selected, setSelected] = useState<AmbulanteSession | null>(null);
  const [sheetMode, setSheetMode] = useState<"lista" | "perfil">("lista");

  const [realSessions, setRealSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 4000 }
    );
  }, []);

  useEffect(() => {
    async function loadSessions() {
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
        .eq('is_online', true);

      if (error || !data) {
        setRealSessions([]);
        return;
      }

      const arr = data.map((s: any) => {
        const produtosData: Record<string, any> = {};
        if (s.ambulante_session_produtos) {
          s.ambulante_session_produtos.forEach((sp: any) => {
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
        return {
          sessionId: s.id,
          prestadorId: s.id,
          nome: s.usuarios?.nome || "Ambulante",
          modalidade: s.modalidade || "local_fixo",
          location: { lat: s.lat, lng: s.lng },
          isOnline: s.is_online,
          produtos: produtosData,
          rating: s.rating,
          totalPedidos: s.total_pedidos
        };
      });
      setRealSessions(arr);
    }
    loadSessions();

    const channel = supabase
      .channel('public:ambulante_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulante_sessions' }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sessionsToUse = realSessions;

  // Flatten products and calculate distance
  const allProducts = useMemo(() => {
    const list: Array<{
      id: string;
      sessionId: string;
      prestadorNome: string;
      dist: number;
      nome: string;
      emoji: string;
      preco: number;
      foto?: string;
      categoriaHint?: string;
      sessionObj: any;
    }> = [];

    sessionsToUse.forEach((s) => {
      const dist = haversineKm(center.lat, center.lng, s.location.lat, s.location.lng);
      
      // se vier como array (formato antigo MOCK_SESSIONS)
      if (Array.isArray(s.produtos)) {
        s.produtos.forEach((pid: string) => {
          const pDef = findProduto(pid);
          if (pDef) {
            list.push({
              id: `${s.sessionId}-${pid}`, sessionId: s.sessionId, prestadorNome: s.nome, dist,
              nome: pDef.nome, emoji: pDef.emoji, preco: pDef.precoSugerido, categoriaHint: pDef.categoriaHint, sessionObj: s
            });
          }
        });
      } else {
        // formato Firebase novo
        Object.entries(s.produtos).forEach(([pid, pData]: [string, any]) => {
          if (pData.disponivel) {
            list.push({
              id: `${s.sessionId}-${pid}`, sessionId: s.sessionId, prestadorNome: s.nome, dist,
              nome: pData.nome, emoji: pData.emoji, preco: pData.preco, foto: pData.foto, categoriaHint: "Todos", sessionObj: s
            });
          }
        });
      }
    });

    return list.sort((a, b) => a.dist - b.dist);
  }, [sessionsToUse, center]);

  const filteredProducts = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (filtroAtivo !== "Todos") {
        // Simplificado, no firebase novo pode não ter categoriaHint precisa. Usaremos fallback ou "Todos"
        if (p.categoriaHint && p.categoriaHint !== "Todos" && p.categoriaHint !== filtroAtivo) return false;
      }
      if (q) {
        if (!p.nome.toLowerCase().includes(q) && !p.prestadorNome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allProducts, busca, filtroAtivo]);

  const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const openPerfil = (s: AmbulanteSession) => {
    setSelected(s);
    setSheetMode("perfil");
  };

  return (
    <div className="relative" style={{ height: "100svh", overflow: "hidden", background: "#0B1B3E" }}>
      {/* Map */}
      <div className="absolute inset-0">
        <AmbulantesMap center={center} sessions={sessionsToUse} onMarkerClick={openPerfil} selectedId={selected?.sessionId} />
      </div>

      {/* Top back */}
      <button
        type="button"
        onClick={() => navigate("/app/home")}
        className="absolute top-4 left-4 z-10 flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: 999,
          background: "rgba(11,27,62,0.75)", border: "1px solid rgba(255,255,255,0.10)",
        }}
        aria-label="Voltar"
      >
        <ArrowLeft size={18} color="#fff" />
      </button>

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10"
        style={{
          background: "#132348",
          borderRadius: "24px 24px 0 0",
          padding: "10px 20px 96px",
          maxHeight: sheetMode === "perfil" ? "70vh" : "55vh",
          overflowY: "auto",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.30)",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.20)",
            margin: "0 auto 12px",
          }}
        />

        {sheetMode === "lista" && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                Ambulantes próximos
              </h1>
              <span
                className="font-sans"
                style={{
                  fontSize: 11, fontWeight: 600, color: "#0DB87E",
                  background: "rgba(13,184,126,0.15)", border: "1px solid #0DB87E",
                  borderRadius: 999, padding: "4px 10px",
                }}
              >
                {filteredProducts.length} itens
              </span>
            </div>

            {/* Busca */}
            <div
              className="mt-3 flex items-center gap-2.5"
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12, height: 48, padding: "0 14px",
              }}
            >
              <Search size={16} color="rgba(255,255,255,0.40)" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto ou ambulante..."
                className="flex-1 bg-transparent outline-none font-sans"
                style={{ fontSize: 14, color: "#fff" }}
              />
            </div>

            {/* Filtros */}
            <div
              className="mt-2.5 flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" as const }}
            >
              {FILTROS.map((f) => {
                const active = filtroAtivo === f.cat;
                return (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setFiltroAtivo(f.cat)}
                    className="font-sans flex-shrink-0"
                    style={{
                      background: active ? "#0DB87E" : "rgba(255,255,255,0.06)",
                      color: active ? "#fff" : "rgba(255,255,255,0.55)",
                      border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      borderRadius: 999,
                      padding: "6px 14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Lista de Produtos */}
            <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center text-center" style={{ padding: "32px 0" }}>
                  <ShoppingBag size={40} color="rgba(255,255,255,0.20)" />
                  <p className="font-display mt-3" style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "12px 0 4px" }}>
                    Nenhum produto próximo
                  </p>
                  <p className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                    Tente buscar por outro termo.
                  </p>
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPerfil(p.sessionObj)}
                    className="flex items-center gap-3 text-left w-full"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: "rgba(13,184,126,0.15)", flexShrink: 0,
                        overflow: "hidden"
                      }}
                    >
                      {p.foto ? (
                        <img src={p.foto} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 22 }}>{p.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans truncate" style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: 0 }}>
                        {p.nome}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="font-sans" style={{ fontSize: 13, color: "#0DB87E", fontWeight: 600 }}>
                          R$ {p.preco.toFixed(2)}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>•</span>
                        <span className="font-sans truncate" style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
                          {p.prestadorNome}
                        </span>
                      </div>
                    </div>
                    <span className="font-sans flex-shrink-0" style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
                      {formatDist(p.dist)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {sheetMode === "perfil" && selected && (() => {
          const dist = haversineKm(center.lat, center.lng, selected.location.lat, selected.location.lng);
          const cat = Array.isArray(selected.produtos) ? getCategoriaIcon(selected.produtos) : { emoji: "🛒", color: "#0DB87E" };
          return (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 52, height: 52, borderRadius: 999,
                      background: cat.color, border: "2px solid white", fontSize: 22,
                    }}
                  >
                    {cat.emoji}
                  </div>
                  <div>
                    <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                      {selected.nome}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Star size={14} fill="#F5A623" stroke="#F5A623" />
                      <span className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                        {(selected.rating ?? 5).toFixed(1)}
                      </span>
                      <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                        ({selected.totalPedidos ?? 0} pedidos)
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setSheetMode("lista"); }}
                  aria-label="Fechar"
                  style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={16} color="#fff" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="font-sans"
                  style={{
                    fontSize: 11, color: "rgba(255,255,255,0.70)",
                    background: "rgba(255,255,255,0.08)",
                    padding: "4px 10px", borderRadius: 999,
                  }}
                >
                  {selected.modalidade === "both" ? "🛵 Delivery & 📍 Local Fixo" : selected.modalidade === "delivery" ? "🛵 Delivery" : "📍 Local Fixo"}
                </span>
                <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                  {formatDist(dist)}
                </span>
              </div>

              <p
                className="mt-4 font-sans uppercase"
                style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: 1.5, margin: "16px 0 10px" }}
              >
                Produtos disponíveis
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(() => {
                  if (Array.isArray(selected.produtos)) {
                    return selected.produtos.slice(0, 6).map((pid: string) => {
                      const prod = findProduto(pid);
                      if (!prod) return null;
                      return (
                        <div key={pid} className="text-center" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 8 }}>
                          <div style={{ fontSize: 20 }}>{prod.emoji}</div>
                          <p className="font-sans truncate" style={{ fontSize: 11, color: "#fff", marginTop: 2 }}>{prod.nome}</p>
                        </div>
                      );
                    });
                  } else {
                    return Object.entries(selected.produtos).slice(0, 6).map(([pid, pData]: [string, any]) => {
                      if (!pData.disponivel) return null;
                      return (
                        <div key={pid} className="text-center" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 8 }}>
                          {pData.foto ? (
                            <img src={pData.foto} alt={pData.nome} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", margin: "0 auto" }} />
                          ) : (
                            <div style={{ fontSize: 20 }}>{pData.emoji}</div>
                          )}
                          <p className="font-sans truncate" style={{ fontSize: 11, color: "#fff", marginTop: 2 }}>{pData.nome}</p>
                        </div>
                      );
                    });
                  }
                })()}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/app/ambulantes/${selected.sessionId}`)}
                className="font-display mt-4 w-full"
                style={{
                  background: "#0DB87E", color: "#fff",
                  borderRadius: 12, padding: "14px 20px",
                  border: "none", cursor: "pointer",
                  fontSize: 15, fontWeight: 700,
                }}
              >
                Ver cardápio completo
              </button>
            </>
          );
        })()}
      </div>

      
    </div>
  );
};

export default AmbulantesDiscoveryPage;
