import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  MapPin,
  Store,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { reverseGeocode } from "@/lib/geoService";
import { UBATUBA_CENTER } from "@/lib/googleMapsConfig";
import {
  formatDeliveryFeeLabel,
  isDeliveryModalidade,
} from "@/components/ambulantes/AmbulanteTrustBadges";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

const AmbulanteCarrinhoPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { state, setState, setQty, clearCart } = useAmbulantePedido();
  const { toast, showToast } = useSimpleToast();

  const supportedModalidades = state.prestadorInfo?.modalidades || ["entrega", "retirada"];
  const supportsDelivery = supportedModalidades.some((m) => isDeliveryModalidade(m));
  const supportsRetirada = supportedModalidades.some((m) => !isDeliveryModalidade(m));

  const [modalidade, setModalidade] = useState<"entrega" | "retirada">(
    supportsDelivery ? "entrega" : "retirada",
  );
  const [vendorDeliveryFee, setVendorDeliveryFee] = useState<number>(
    Math.max(0, Number(state.prestadorInfo?.deliveryFee ?? state.deliveryFee ?? 0) || 0),
  );
  const [address, setAddress] = useState(state.tomadorAddress || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(UBATUBA_CENTER);
  const [referencia, setReferencia] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const prestadorId = state.prestadorId || state.sessionId;

  // Hydrate fresh delivery_fee from DB
  useEffect(() => {
    if (!prestadorId) return;
    let active = true;
    const syncFee = async () => {
      try {
        const [{ data: sess }, { data: prof }] = await Promise.all([
          supabase
            .from("ambulante_sessions")
            .select("delivery_fee")
            .eq("id", prestadorId)
            .maybeSingle(),
          supabase
            .from("prestador_ambulante")
            .select("delivery_fee")
            .eq("user_id", prestadorId)
            .maybeSingle(),
        ]);
        if (!active) return;
        const dbFee = Number(sess?.delivery_fee ?? prof?.delivery_fee ?? state.deliveryFee ?? 0);
        if (Number.isFinite(dbFee) && dbFee >= 0) {
          setVendorDeliveryFee(dbFee);
        }
      } catch {
        // Keep context fee
      }
    };
    syncFee();
    return () => {
      active = false;
    };
  }, [prestadorId, state.deliveryFee]);

  // Real geolocation for delivery address
  useEffect(() => {
    let active = true;
    const fillAddress = async (lat: number, lng: number) => {
      if (active) setCoords({ lat, lng });
      if (!address.trim()) {
        try {
          const resolved = await reverseGeocode(lat, lng);
          if (active && resolved) setAddress(resolved);
        } catch {
          if (active) setAddress("Ubatuba, SP");
        }
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fillAddress(pos.coords.latitude, pos.coords.longitude),
        () => fillAddress(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );
    } else {
      fillAddress(UBATUBA_CENTER.lat, UBATUBA_CENTER.lng);
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.itens.length === 0) {
    return (
      <div
        className="min-h-[100svh] flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "#0B1B3E" }}
      >
        <p className="font-display text-[18px] font-bold text-white">Seu carrinho está vazio</p>
        <p className="font-sans text-[13px] text-white/55 mt-1">
          Escolha um ambulante online para montar seu pedido.
        </p>
        <button
          type="button"
          onClick={() => navigate("/app/ambulantes")}
          className="mt-5 px-5 py-3 rounded-xl border-none bg-[#0DB87E] text-white font-display font-bold text-[14px] cursor-pointer"
        >
          Ver ambulantes
        </button>
      </div>
    );
  }

  const subtotal = Number(state.total.toFixed(2));
  const deliveryFee = modalidade === "entrega" ? Number(vendorDeliveryFee.toFixed(2)) : 0;
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const handleConfirm = async () => {
    if (!user.uid) {
      showToast("Faça login para enviar seu pedido.");
      return;
    }
    if (!prestadorId) {
      showToast("Ambulante não identificado. Volte ao cardápio.");
      return;
    }
    if (modalidade === "entrega" && !address.trim()) {
      showToast("Informe o endereço ou ponto na praia para entrega.");
      return;
    }

    setSubmitting(true);
    try {
      const snapshotPayload = state.prestadorSnapshot || {
        prestador_id: prestadorId,
        nome_comercial: state.prestadorInfo?.nome || "Ambulante UBT",
        delivery_fee: vendorDeliveryFee,
        praia_referencia: state.prestadorInfo?.praiaReferencia || null,
        ponto_referencia: state.prestadorInfo?.pontoReferencia || null,
        tipo_estrutura: state.prestadorInfo?.tipoEstrutura || null,
        estrutura_photo_url: state.prestadorInfo?.estruturaPhotoUrl || null,
        possui_alvara: Boolean(state.prestadorInfo?.possuiAlvara),
        possui_vigilancia_sanitaria: Boolean(state.prestadorInfo?.possuiVigilanciaSanitaria),
        modalidades: supportedModalidades,
      };

      const { data: pedido, error: pedErr } = await supabase
        .from("pedidos")
        .insert({
          tomador_id: user.uid,
          prestador_id: prestadorId,
          modalidade,
          status: "pending",
          subtotal,
          delivery_fee: deliveryFee,
          total,
          delivery_address: modalidade === "entrega" ? address.trim() : null,
          delivery_lat: modalidade === "entrega" ? coords.lat : null,
          delivery_lng: modalidade === "entrega" ? coords.lng : null,
          delivery_referencia:
            modalidade === "entrega" && referencia.trim() ? referencia.trim() : null,
          prestador_snapshot: snapshotPayload,
        })
        .select("id")
        .single();

      if (pedErr || !pedido?.id) {
        throw pedErr || new Error("Não foi possível criar o pedido.");
      }

      const itensToInsert = state.itens.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.prodId,
        nome: item.nome,
        emoji: item.emoji,
        qty: item.qty,
        preco_unit: item.precoUnit,
        subtotal: item.subtotal,
      }));

      const { error: itensErr } = await supabase.from("pedido_itens").insert(itensToInsert);
      if (itensErr) {
        console.error("Erro ao gravar itens do pedido:", itensErr);
      }

      setState({
        pedidoId: pedido.id,
        modalidade,
        deliveryFee,
        status: "pending",
        tomadorAddress: modalidade === "entrega" ? address.trim() : null,
      });

      clearCart();
      navigate(`/app/ambulantes/pedido/${pedido.id}`, { replace: true });
    } catch (err: any) {
      console.error("Erro ao confirmar pedido de ambulante:", err);
      showToast(err?.message || "Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#0B1B3E", padding: 24, paddingBottom: 120 }}
    >
      <Toast message={toast} />

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)", color: "#fff" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[20px] font-bold text-white">Seu Pedido</h1>
          {state.prestadorInfo && (
            <p className="font-sans text-[12px] text-white/60 truncate">
              {state.prestadorInfo.emoji} {state.prestadorInfo.nome}
            </p>
          )}
        </div>
      </header>

      {/* Modalidade selector */}
      <section className="mt-5">
        <p className="font-sans text-[12px] font-semibold text-white/60 uppercase tracking-wider mb-2">
          Como deseja receber?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!supportsDelivery}
            onClick={() => setModalidade("entrega")}
            className="rounded-2xl p-3.5 text-left transition-all"
            style={{
              background: modalidade === "entrega" ? "rgba(13,184,126,0.16)" : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${modalidade === "entrega" ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
              opacity: supportsDelivery ? 1 : 0.4,
              cursor: supportsDelivery ? "pointer" : "not-allowed",
            }}
          >
            <Bike size={20} color={modalidade === "entrega" ? "#0DB87E" : "rgba(255,255,255,0.6)"} />
            <p className="font-display text-[14px] font-bold text-white mt-2">Entrega</p>
            <p className="font-sans text-[11px] text-white/60 mt-0.5">
              {formatDeliveryFeeLabel(vendorDeliveryFee)}
            </p>
          </button>

          <button
            type="button"
            disabled={!supportsRetirada}
            onClick={() => setModalidade("retirada")}
            className="rounded-2xl p-3.5 text-left transition-all"
            style={{
              background: modalidade === "retirada" ? "rgba(13,184,126,0.16)" : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${modalidade === "retirada" ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
              opacity: supportsRetirada ? 1 : 0.4,
              cursor: supportsRetirada ? "pointer" : "not-allowed",
            }}
          >
            <Store size={20} color={modalidade === "retirada" ? "#0DB87E" : "rgba(255,255,255,0.6)"} />
            <p className="font-display text-[14px] font-bold text-white mt-2">Retirar no Ponto</p>
            <p className="font-sans text-[11px] text-[#0DB87E] mt-0.5">Taxa R$ 0,00</p>
          </button>
        </div>
      </section>

      {/* Delivery Address or Pickup Point */}
      {modalidade === "entrega" ? (
        <section
          className="mt-4 rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <div>
            <label className="font-sans text-[12px] font-semibold text-white/75 flex items-center gap-1.5 mb-1.5">
              <MapPin size={14} color="#0DB87E" />
              Onde você está?
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Praia Grande, próximo ao Posto 2"
              className="w-full rounded-xl px-3.5 py-2.5 font-sans text-[14px] text-white placeholder:text-white/40 outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
          <div>
            <label className="font-sans text-[12px] text-white/60 block mb-1">
              Ponto de referência (guarda-sol, quiosque, camisa...)
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex: Guarda-sol azul perto do quiosque do Zé"
              className="w-full rounded-xl px-3.5 py-2.5 font-sans text-[13px] text-white placeholder:text-white/40 outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
        </section>
      ) : (
        <section
          className="mt-4 rounded-2xl p-4"
          style={{ background: "rgba(13,184,126,0.10)", border: "1px solid rgba(13,184,126,0.28)" }}
        >
          <p className="font-display text-[14px] font-bold text-[#0DB87E]">Retirada no ponto</p>
          <p className="font-sans text-[13px] text-white/80 mt-1">
            {[state.prestadorInfo?.praiaReferencia, state.prestadorInfo?.pontoReferencia]
              .filter(Boolean)
              .join(" • ") || "Combine o ponto exato com o ambulante pelo chat do pedido."}
          </p>
        </section>
      )}

      {/* Cart items */}
      <section className="mt-5">
        <p className="font-sans text-[12px] font-semibold text-white/60 uppercase tracking-wider mb-2">
          Itens do pedido
        </p>
        <div className="flex flex-col gap-2.5">
          {state.itens.map((item) => {
            const atCap = item.maxStock !== undefined && item.qty >= item.maxStock;
            return (
              <div
                key={item.prodId}
                className="flex items-center gap-3 rounded-2xl p-3.5"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <span className="text-[22px]">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] font-bold text-white truncate">
                    {item.nome}
                  </p>
                  <p className="font-sans text-[12px] text-[#0DB87E]">
                    R$ {item.subtotal.toFixed(2).replace(".", ",")}
                    {item.maxStock !== undefined && (
                      <span className="text-white/45 ml-2">(máx. {item.maxStock})</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Diminuir ${item.nome}`}
                    onClick={() => setQty(item.prodId, item.qty - 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    {item.qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                  </button>
                  <span className="font-display text-[14px] font-bold text-white min-w-[18px] text-center">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    disabled={atCap}
                    aria-label={`Aumentar ${item.nome}`}
                    onClick={() => setQty(item.prodId, item.qty + 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center border-none"
                    style={{
                      background: atCap ? "rgba(255,255,255,0.12)" : "#0DB87E",
                      color: "#fff",
                      opacity: atCap ? 0.45 : 1,
                      cursor: atCap ? "not-allowed" : "pointer",
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <section
        className="mt-5 rounded-2xl p-4 space-y-2"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        <div className="flex justify-between font-sans text-[13px] text-white/75">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="flex justify-between font-sans text-[13px] text-white/75">
          <span>{modalidade === "entrega" ? "Taxa de entrega" : "Retirada no ponto"}</span>
          <span className={deliveryFee === 0 ? "text-[#0DB87E] font-semibold" : ""}>
            {deliveryFee === 0 ? "Grátis (R$ 0,00)" : `R$ ${deliveryFee.toFixed(2).replace(".", ",")}`}
          </span>
        </div>
        <div className="pt-2 border-t border-white/10 flex justify-between font-display text-[17px] font-extrabold text-white">
          <span>Total</span>
          <span className="text-[#0DB87E]">R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>
      </section>

      {/* Pay at end notice */}
      <div
        className="mt-4 rounded-xl p-3 flex items-start gap-2.5"
        style={{ background: "rgba(13,184,126,0.10)", border: "1px solid rgba(13,184,126,0.25)" }}
      >
        <ShieldCheck size={18} color="#0DB87E" className="shrink-0 mt-0.5" />
        <p className="font-sans text-[12px] text-white/80 leading-relaxed">
          <strong>Pagamento somente ao final:</strong> você paga por PIX ou Cartão no app apenas
          quando seu pedido estiver pronto ou entregue.
        </p>
      </div>

      {/* Confirm CTA */}
      <div
        className="fixed left-4 right-4 bottom-5 z-30"
        style={{ maxWidth: 480, margin: "0 auto" }}
      >
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirm}
          className="w-full rounded-2xl border-none font-display text-[15px] font-extrabold text-white cursor-pointer disabled:opacity-50"
          style={{
            background: "#0DB87E",
            padding: "16px 20px",
            boxShadow: "0 10px 30px rgba(13,184,126,0.35)",
          }}
        >
          {submitting
            ? "Enviando pedido..."
            : `Enviar Pedido · R$ ${total.toFixed(2).replace(".", ",")}`}
        </button>
      </div>
    </div>
  );
};

export default AmbulanteCarrinhoPage;
