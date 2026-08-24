import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, MapPin, Minus, Plus, Building2, Gift, Heart, Star, User, Users } from "lucide-react";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { MOCK_SESSIONS, MOCK_FALLBACK_SESSIONS } from "@/mocks/ambulantesSessions";
import { findProduto } from "@/mocks/ambulantesProdutos";
import { calcSplit, SPLIT_META, formatBRL } from "@/utils/ride";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { reverseGeocode } from "@/lib/geoService";
import { validateGeofence } from "@/services/GeofenceService";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

const ICONS = { User, Building2, Users, Gift, Star, Heart } as const;

const DELIVERY_FEE = 3;

const AmbulanteCarrinhoPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { state, addItem, removeItem, setState } = useAmbulantePedido();
  const [splitOpen, setSplitOpen] = useState(false);
  const [modalidade, setModalidade] = useState<"local_fixo" | "delivery" | null>(null);
  const [endereco, setEndereco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [submitting, setSubmitting] = useState(false);

  interface SessionData {
    sessionId: string;
    prestadorId: string;
    nome: string;
    modalidade: "local_fixo" | "delivery" | "both";
    location: { lat: number; lng: number };
  }

  const [session, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (address) {
          setEndereco((prev) => prev ? prev : address);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!state.sessionId) return;
    async function load() {
      const { data, error } = await supabase
        .from('ambulante_sessions')
        .select('id, prestador_id, modalidade, lat, lng, usuarios(nome)')
        .eq('id', state.sessionId)
        .single();
      if (data) {
        const row = data as unknown as {
          id: string;
          prestador_id: string;
          modalidade: "local_fixo" | "delivery" | "both";
          lat: number;
          lng: number;
          usuarios: { nome: string } | { nome: string }[] | null;
        };
        const userName = Array.isArray(row.usuarios) ? row.usuarios[0]?.nome : row.usuarios?.nome;

        setSessionData({
          sessionId: row.id,
          prestadorId: row.prestador_id,
          nome: userName || "Ambulante",
          modalidade: row.modalidade || "local_fixo",
          location: { lat: row.lat, lng: row.lng },
        });
      }
    }
    load();
  }, [state.sessionId]);

  // Pre-select pickup if session is local_fixo only
  useEffect(() => {
    if (session && modalidade === null) {
      setModalidade(session.modalidade === "local_fixo" ? "local_fixo" : "delivery");
    }
  }, [session, modalidade]);

  useEffect(() => {
    if (state.itens.length === 0) {
      navigate(-1);
    }
  }, [state.itens.length, navigate]);

  if (state.itens.length === 0 || !session) return null;

  const subtotal = state.total;
  const fee = modalidade === "delivery" ? DELIVERY_FEE : 0;
  const total = +(subtotal + fee).toFixed(2);
  const split = calcSplit(total);

  const confirmarPedido = async () => {
    if (!modalidade || submitting) return;
    setSubmitting(true);
    const startTime = Date.now();

    if (modalidade === "delivery") {
      const geoRes = validateGeofence(endereco, coords || undefined);
      if (!geoRes.inside) {
        alert(geoRes.reason || "Atendimento indisponível: A UBT atende apenas no município de Ubatuba-SP.");
        setSubmitting(false);
        return;
      }
    }

    const itens = state.itens.map((i) => ({
      prodId: i.prodId, nome: i.nome, emoji: i.emoji,
      qty: i.qty, precoUnit: i.precoUnit, subtotal: i.subtotal,
    }));

    if (!user.uid || user.uid.length !== 36) {
      alert("Sessão expirada. Faça login novamente.");
      window.location.href = "/login";
      return;
    }
    const tomadorId = user.uid;

    // Garante que o usuário existe na tabela public.usuarios para não falhar a Foreign Key
    await supabase.from('usuarios').upsert({ id: tomadorId, nome: user.name || 'Usuário', role: 'tomador' });

    const { data: dbData, error } = await supabase.from('pedidos').insert({
      tomador_id: tomadorId,
      prestador_id: session.prestadorId,
      session_id: session.sessionId,
      status: "pending",
      modalidade,
      total,
      delivery_lat: coords?.lat,
      delivery_lng: coords?.lng,
      delivery_address: endereco,
      delivery_referencia: referencia,
    }).select().single();
    
    const duration = Date.now() - startTime;

    if (error) console.error("Erro ao inserir pedido:", error);
    
    if (dbData) {
      const itensPayload = state.itens.map(i => ({
        pedido_id: dbData.id,
        produto_id: i.prodId.length === 36 ? i.prodId : null, // only valid UUIDs
        nome: i.nome,
        emoji: i.emoji,
        qty: i.qty,
        preco_unit: i.precoUnit,
        subtotal: i.subtotal
      }));
      await supabase.from('pedido_itens').insert(itensPayload);

      trackEvent("order_requested", "operational", { vertical: "ambulantes", order_id: dbData.id, price: total, modalidade });
      logSystem("INFO", "AMBULANTES", "order_requested", "success", duration, undefined, undefined, { order_id: dbData.id, price: total });
    }

    if (dbData) {
      setState({ pedidoId: dbData.id, modalidade, status: "pending" });
      navigate(`/app/ambulantes/pedido/${dbData.id}`);
    } else {
      logSystem("ERROR", "AMBULANTES", "order_requested", "failed", duration, error?.message || "Erro ao criar pedido", "ORDER_CREATE_FAILED");
      setSubmitting(false);
      alert("Erro ao criar pedido!");
    }
  };

  return (
    <div style={{ minHeight: "100svh", background: "#09090B", paddingBottom: 140 }}>
      <header className="flex items-center gap-4" style={{ padding: "16px 24px" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
          Carrinho
        </h1>
      </header>

      {/* Itens */}
      <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {state.itens.map((i) => {
          const prod = findProduto(i.prodId);
          return (
            <div
              key={i.prodId}
              className="flex items-center gap-3"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}
              >
                {i.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans truncate" style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                  {i.nome}
                </p>
                <p className="font-sans truncate" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                  {prod?.descricao}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => removeItem(i.prodId)}
                    style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(255,255,255,0.10)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Remover"
                  >
                    <Minus size={12} color="#fff" />
                  </button>
                  <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#fff", minWidth: 14, textAlign: "center" }}>
                    {i.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem(i.prodId, i.precoUnit)}
                    style={{ width: 24, height: 24, borderRadius: 999, background: "#0DB87E", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Adicionar"
                  >
                    <Plus size={12} color="#fff" />
                  </button>
                </div>
              </div>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>
                R$ {i.subtotal.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totais */}
      <div
        style={{
          margin: "20px 24px 0",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div className="flex justify-between">
          <span className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Subtotal</span>
          <span className="font-sans" style={{ fontSize: 13, color: "#fff" }}>R$ {subtotal.toFixed(2)}</span>
        </div>
        {fee > 0 && (
          <div className="flex justify-between mt-1">
            <span className="font-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Taxa de entrega</span>
            <span className="font-sans" style={{ fontSize: 13, color: "#fff" }}>R$ {fee.toFixed(2)}</span>
          </div>
        )}

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "10px 0" }} />

        <button
          type="button"
          onClick={() => setSplitOpen((v) => !v)}
          className="flex items-center justify-between w-full"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        >
          <span className="font-sans" style={{ fontSize: 12, color: "#0DB87E" }}>Ver divisão do pagamento</span>
          <ChevronDown
            size={16}
            color="#0DB87E"
            style={{ transform: splitOpen ? "rotate(180deg)" : "none", transition: "transform 250ms" }}
          />
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
      </div>

      {/* Modalidade */}
      <div
        style={{
          margin: "12px 24px 0",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 14, padding: 16,
        }}
      >
        <p className="font-sans" style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.50)", margin: "0 0 10px" }}>
          Como você quer receber?
        </p>
        <div className="flex gap-2">
          {([
            { key: "local_fixo" as const, label: "📍 Retirar no local", disabled: false },
            { key: "delivery" as const, label: "🛵 Delivery  +R$ 3,00", disabled: session.modalidade === "local_fixo" },
          ]).map((opt) => {
            const active = modalidade === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={opt.disabled}
                onClick={() => setModalidade(opt.key)}
                className="flex-1 font-sans"
                style={{
                  borderRadius: 12, padding: 14,
                  border: `1.5px solid ${active ? "#0DB87E" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(13,184,126,0.12)" : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.4 : 1,
                  textAlign: "center",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {modalidade === "delivery" && (
          <>
            <div
              className="mt-2.5 flex items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                height: 48,
                padding: "0 14px",
                animation: "ubt-fade 200ms ease",
              }}
            >
              <MapPin size={16} color="rgba(255,255,255,0.40)" />
              <input
                type="text"
                placeholder="Endereço de entrega"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="flex-1 bg-transparent outline-none font-sans"
                style={{ fontSize: 14, color: "#fff" }}
              />
            </div>
            <div
              className="mt-2.5 flex items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                height: 48,
                padding: "0 14px",
                animation: "ubt-fade 200ms ease",
              }}
            >
              <input
                type="text"
                placeholder="Ponto de referência (Ex: Guarda-sol amarelo, canga azul...)"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="flex-1 bg-transparent outline-none font-sans"
                style={{ fontSize: 14, color: "#fff" }}
              />
            </div>
          </>
        )}
      </div>

      {/* Total final */}
      <div className="flex justify-between items-center" style={{ padding: "14px 24px 0" }}>
        <span className="font-sans" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}>Total</span>
        <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#0DB87E" }}>
          R$ {total.toFixed(2)}
        </span>
      </div>

      {/* Botão confirmar */}
      <button
        type="button"
        onClick={confirmarPedido}
        disabled={!modalidade || submitting}
        className="font-display"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 64,
          background: "#0DB87E", color: "#fff",
          minHeight: 52, padding: "0 24px",
          borderRadius: "16px 16px 0 0",
          border: "none",
          cursor: !modalidade || submitting ? "not-allowed" : "pointer",
          opacity: !modalidade || submitting ? 0.6 : 1,
          fontSize: 15, fontWeight: 700,
          zIndex: 30,
        }}
      >
        {submitting ? "Enviando..." : "Confirmar pedido"}
      </button>

      <style>{`@keyframes ubt-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

export default AmbulanteCarrinhoPage;
