import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle,
  ChefHat,
  CreditCard,
  MessageCircle,
  Package,
  QrCode,
  Send,
  Star,
  Copy,
  Check,
  XCircle,
  Receipt,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAmbulantePedido } from "@/contexts/AmbulantePedidoContext";
import { useAmbulanteQuickMessages } from "@/hooks/useAmbulanteQuickMessages";
import CheckoutUniversal from "@/components/Payment/CheckoutUniversal";
import AmbulanteTrustBadges, { isDeliveryModalidade } from "@/components/ambulantes/AmbulanteTrustBadges";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "paid"
  | "cancelled";

interface OrderItemRow {
  id: string;
  produto_id?: string | null;
  nome: string;
  emoji?: string | null;
  qty: number;
  preco_unit: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  tomador_id: string;
  prestador_id: string;
  status: OrderStatus;
  modalidade: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address?: string | null;
  delivery_referencia?: string | null;
  payment_method?: string | null;
  pix_payment_id?: string | null;
  pix_qr_code?: string | null;
  pix_qr_code_base64?: string | null;
  prestador_snapshot?: Record<string, any> | null;
  cancel_reason?: string | null;
  created_at: string;
  paid_at?: string | null;
  pedido_itens?: OrderItemRow[];
}

const STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: "pending", label: "Enviado" },
  { key: "confirmed", label: "Confirmado" },
  { key: "preparing", label: "Preparo" },
  { key: "ready", label: "Pronto" },
  { key: "completed", label: "Entregue" },
  { key: "paid", label: "Pago" },
];

const STATUS_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  paid: 5,
  cancelled: -1,
};

const AmbulantePedidoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { resetPedido } = useAmbulantePedido();
  const { toast, showToast } = useSimpleToast();

  const [pedido, setPedido] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Payment UI (only shown at 'ready' or 'completed')
  const [payTab, setPayTab] = useState<"pix" | "card">("pix");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{
    qr_code?: string;
    qr_code_base64?: string;
    payment_id?: string | number;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Chat UI
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const {
    messages,
    sending: sendingMsg,
    sendMessage,
    presets,
  } = useAmbulanteQuickMessages({
    pedidoId: id,
    senderId: user.uid,
    senderRole: "tomador",
    enabled: Boolean(id && pedido && pedido.status !== "cancelled"),
  });

  // Rating UI
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  const pollPixRef = useRef<number | null>(null);

  const fetchPedido = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, pedido_itens(id, produto_id, nome, emoji, qty, preco_unit, subtotal)")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as OrderRow;
        setPedido(row);
        if (row.pix_qr_code || row.pix_qr_code_base64) {
          setPixData({
            qr_code: row.pix_qr_code || undefined,
            qr_code_base64: row.pix_qr_code_base64 || undefined,
            payment_id: row.pix_payment_id || undefined,
          });
        }
      }
    } catch (err) {
      console.error("Erro ao buscar pedido de ambulante:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch + check existing rating
  useEffect(() => {
    fetchPedido();
  }, [fetchPedido]);

  useEffect(() => {
    if (!id || !user.uid) return;
    let active = true;
    const checkRating = async () => {
      try {
        const { data } = await supabase
          .from("ambulante_avaliacoes")
          .select("id")
          .eq("pedido_id", id)
          .eq("avaliador_id", user.uid)
          .maybeSingle();
        if (active && data?.id) setAlreadyRated(true);
      } catch {
        // Ignore if table unavailable in test mock
      }
    };
    checkRating();
    return () => {
      active = false;
    };
  }, [id, user.uid]);

  // 100% Real-time order status sync (NO fake auto-advance timer!)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ambulante-pedido-tomador-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Partial<OrderRow>;
          if (!updated) return;
          setPedido((prev) => (prev ? { ...prev, ...updated } : prev));
          if (updated.pix_qr_code || updated.pix_qr_code_base64) {
            setPixData({
              qr_code: updated.pix_qr_code || undefined,
              qr_code_base64: updated.pix_qr_code_base64 || undefined,
              payment_id: updated.pix_payment_id || undefined,
            });
          }
        },
      )
      .subscribe();

    const fallbackPoll = window.setInterval(fetchPedido, 8000);

    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [id, fetchPedido]);

  // Poll PIX status whenever PIX charge is active and order isn't paid yet
  useEffect(() => {
    if (pollPixRef.current) {
      window.clearInterval(pollPixRef.current);
      pollPixRef.current = null;
    }

    const canPoll =
      Boolean(id) &&
      Boolean(pixData?.payment_id || pedido?.pix_payment_id) &&
      pedido &&
      pedido.status !== "paid" &&
      pedido.status !== "cancelled";

    if (!canPoll) return;

    pollPixRef.current = window.setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("payment-gateway", {
          body: { action: "check_ambulante_pix_status", pedido_id: id },
        });
        if (data?.status === "approved" || data?.pedido_status === "paid") {
          setPedido((prev) => (prev ? { ...prev, status: "paid", payment_method: "pix" } : prev));
          showToast("Pagamento PIX confirmado!");
        }
      } catch {
        // Silent poll retry
      }
    }, 4000);

    return () => {
      if (pollPixRef.current) {
        window.clearInterval(pollPixRef.current);
        pollPixRef.current = null;
      }
    };
  }, [id, pixData?.payment_id, pedido?.pix_payment_id, pedido?.status, showToast]);

  const handleGeneratePix = async () => {
    if (!id || !pedido) return;
    setPixLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-gateway", {
        body: {
          action: "create_ambulante_pix_charge",
          pedido_id: id,
        },
      });
      if (error || !data || data.error) {
        throw new Error(data?.error || error?.message || "Erro ao gerar cobrança PIX.");
      }
      setPixData({
        qr_code: data.pix?.qr_code || data.qr_code,
        qr_code_base64: data.pix?.qr_code_base64 || data.qr_code_base64,
        payment_id: data.payment_id,
      });
      showToast("QR Code PIX gerado! Efetue o pagamento no app do seu banco.");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível gerar o PIX agora.");
    } finally {
      setPixLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopiedPix(true);
      showToast("Código PIX Copia e Cola copiado!");
      setTimeout(() => setCopiedPix(false), 2500);
    } catch {
      showToast("Copie o código manualmente.");
    }
  };

  const handleCancelOrder = async () => {
    if (!id || !pedido) return;
    setCancelling(true);
    try {
      const { error } = await supabase.rpc("cancel_ambulante_order", {
        p_pedido_id: id,
        p_reason: "Cancelado pelo cliente",
      });
      if (error) throw error;
      setPedido((prev) =>
        prev ? { ...prev, status: "cancelled", cancel_reason: "Cancelado pelo cliente" } : prev,
      );
      showToast("Pedido cancelado com sucesso.");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível cancelar o pedido.");
    } finally {
      setCancelling(false);
    }
  };

  const handleSendChat = async (text: string) => {
    const res = await sendMessage(text);
    if (res.ok) {
      setChatDraft("");
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleSubmitRating = async () => {
    if (!id || !pedido || !user.uid || rating === 0) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from("ambulante_avaliacoes").insert({
        pedido_id: id,
        avaliador_id: user.uid,
        avaliado_id: pedido.prestador_id,
        papel_avaliador: "tomador",
        nota: rating,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
      setAlreadyRated(true);
      showToast("Obrigado pela sua avaliação!");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível enviar sua avaliação.");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center text-white/60 font-sans text-[14px]"
        style={{ background: "#0B1B3E" }}
      >
        Carregando status do pedido...
      </div>
    );
  }

  if (!pedido) {
    return (
      <div
        className="min-h-[100svh] flex flex-col items-center justify-center p-6 text-center text-white"
        style={{ background: "#0B1B3E" }}
      >
        <p className="font-display text-[18px] font-bold">Pedido não encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/app/home")}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  const snap = pedido.prestador_snapshot || {};
  const vendorName = snap.nome_comercial || "Ambulante UBT";
  const isDelivery = isDeliveryModalidade(pedido.modalidade);
  const currentStepIdx = STATUS_INDEX[pedido.status] ?? 0;
  const canPayNow = pedido.status === "ready" || pedido.status === "completed";
  const canCancel =
    pedido.status === "pending" ||
    pedido.status === "confirmed" ||
    pedido.status === "preparing" ||
    pedido.status === "ready";
  const isPaid = pedido.status === "paid";
  const isCancelled = pedido.status === "cancelled";

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#0B1B3E", padding: 24, paddingBottom: 60 }}
    >
      <Toast message={toast} />

      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/app/home")}
          aria-label="Voltar ao início"
          className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.08)", color: "#fff" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="font-display text-[18px] font-bold text-white truncate">
            Pedido #{pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="font-sans text-[12px] text-white/60 truncate">{vendorName}</p>
        </div>
        {!isCancelled ? (
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Abrir chat"
            className="flex items-center justify-center rounded-full border-none cursor-pointer shrink-0 relative"
            style={{ width: 40, height: 40, background: "rgba(13,184,126,0.18)", color: "#0DB87E" }}
          >
            <MessageCircle size={19} />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0DB87E] text-white text-[10px] font-bold flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Status card */}
      <section
        className="mt-5 rounded-2xl p-5"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {isCancelled ? (
          <div className="text-center py-2">
            <XCircle size={44} color="#E84040" className="mx-auto mb-2" />
            <h2 className="font-display text-[19px] font-bold text-white">Pedido cancelado</h2>
            <p className="font-sans text-[13px] text-white/60 mt-1">
              {pedido.cancel_reason || "Este pedido foi cancelado."}
            </p>
          </div>
        ) : isPaid ? (
          <div className="text-center py-2">
            <CheckCircle size={48} color="#0DB87E" className="mx-auto mb-2" />
            <h2 className="font-display text-[20px] font-bold text-white">Pagamento confirmado!</h2>
            <p className="font-sans text-[13px] text-white/70 mt-1">
              Pedido concluído e liquidado via{" "}
              {pedido.payment_method?.toLowerCase().includes("card") ? "Cartão" : "PIX"}.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(`/app/gerenciar/transacao/${pedido.id}`)}
                className="w-full rounded-xl py-3 px-4 border-none bg-[#0DB87E] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Receipt size={16} /> Ver comprovante / Extrato
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPedido();
                  navigate("/app/home");
                }}
                className="w-full rounded-xl py-2.5 px-4 bg-white/10 border border-white/10 text-white font-sans text-[13px] font-semibold cursor-pointer"
              >
                Voltar para o início
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,184,126,0.16)", color: "#0DB87E" }}
              >
                {pedido.status === "preparing" ? (
                  <ChefHat size={24} />
                ) : (
                  <Package size={24} />
                )}
              </div>
              <div>
                <h2 className="font-display text-[17px] font-bold text-white">
                  {pedido.status === "pending" && "Aguardando ambulante aceitar..."}
                  {pedido.status === "confirmed" && "Pedido confirmado!"}
                  {pedido.status === "preparing" && "Preparando seu pedido..."}
                  {pedido.status === "ready" &&
                    (isDelivery
                      ? "Pedido pronto / a caminho!"
                      : "Pronto para retirada no ponto!")}
                  {pedido.status === "completed" && "Pedido entregue · Realize o pagamento"}
                </h2>
                <p className="font-sans text-[12px] text-white/60 mt-0.5">
                  {pedido.status === "pending"
                    ? "Assim que o ambulante confirmar o estoque, você verá a atualização aqui em tempo real."
                    : canPayNow
                      ? "Finalize o pagamento abaixo por PIX ou Cartão de Crédito."
                      : "Acompanhe as atualizações em tempo real."}
                </p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="mt-5 grid grid-cols-6 gap-1">
              {STEPS.map((s, idx) => {
                const reached = idx <= currentStepIdx;
                return (
                  <div key={s.key} className="flex flex-col items-center">
                    <div
                      className="w-full h-1.5 rounded-full"
                      style={{
                        background: reached ? "#0DB87E" : "rgba(255,255,255,0.12)",
                      }}
                    />
                    <span
                      className="mt-1.5 font-sans text-[10px] text-center"
                      style={{
                        color: reached ? "#0DB87E" : "rgba(255,255,255,0.4)",
                        fontWeight: reached ? 700 : 400,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Vendor trust badges */}
      {Object.keys(snap).length > 0 && (
        <section
          className="mt-4 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <AmbulanteTrustBadges
            compact
            showDeliveryFee={false}
            info={{
              possuiAlvara: snap.possui_alvara,
              possuiVigilanciaSanitaria: snap.possui_vigilancia_sanitaria,
              tipoEstrutura: snap.tipo_estrutura,
              praiaReferencia: snap.praia_referencia,
              pontoReferencia: snap.ponto_referencia,
            }}
          />
        </section>
      )}

      {/* PAYMENT SECTION — ONLY AT THE END ('ready' or 'completed') */}
      {canPayNow && (
        <section
          data-testid="ambulante-payment-section"
          className="mt-5 rounded-2xl p-4"
          style={{
            background: "rgba(13,184,126,0.09)",
            border: "1.5px solid rgba(13,184,126,0.38)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-[16px] font-bold text-white">
              Finalizar Pagamento
            </h3>
            <span className="font-display text-[18px] font-extrabold text-[#0DB87E]">
              R$ {Number(pedido.total).toFixed(2).replace(".", ",")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setPayTab("pix")}
              className="rounded-xl py-2.5 px-3 font-sans text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              style={{
                background: payTab === "pix" ? "#0DB87E" : "rgba(255,255,255,0.07)",
                color: "#fff",
                border: "none",
              }}
            >
              <QrCode size={15} /> PIX
            </button>
            <button
              type="button"
              onClick={() => setPayTab("card")}
              className="rounded-xl py-2.5 px-3 font-sans text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              style={{
                background: payTab === "card" ? "#0DB87E" : "rgba(255,255,255,0.07)",
                color: "#fff",
                border: "none",
              }}
            >
              <CreditCard size={15} /> Cartão
            </button>
          </div>

          {payTab === "pix" ? (
            <div className="space-y-3">
              {pixData?.qr_code || pixData?.qr_code_base64 ? (
                <div className="rounded-xl p-4 bg-white/5 border border-white/10 text-center space-y-3">
                  {pixData.qr_code_base64 && (
                    <img
                      src={
                        pixData.qr_code_base64.startsWith("data:")
                          ? pixData.qr_code_base64
                          : `data:image/png;base64,${pixData.qr_code_base64}`
                      }
                      alt="QR Code PIX"
                      className="w-44 h-44 mx-auto rounded-xl bg-white p-2"
                    />
                  )}
                  <p className="font-sans text-[12px] text-white/75">
                    Aguardando confirmação automática do PIX...
                  </p>
                  {pixData.qr_code && (
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="w-full rounded-xl py-2.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[13px] border-none flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedPix ? <Check size={15} /> : <Copy size={15} />}
                      {copiedPix ? "Código copiado!" : "Copiar PIX Copia e Cola"}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pixLoading}
                  onClick={handleGeneratePix}
                  className="w-full rounded-xl py-3.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <QrCode size={17} />
                  {pixLoading ? "Gerando PIX..." : "Gerar QR Code PIX"}
                </button>
              )}
            </div>
          ) : (
            <CheckoutUniversal
              serviceType="ambulante"
              serviceId={pedido.id}
              providerId={pedido.prestador_id}
              providerName={vendorName}
              amount={Number(pedido.total)}
              onSuccess={() => {
                setPedido((prev) =>
                  prev ? { ...prev, status: "paid", payment_method: "credit_card" } : prev,
                );
                showToast("Pagamento com cartão aprovado!");
              }}
              onError={(msg) => showToast(msg)}
            />
          )}
        </section>
      )}

      {/* Quick Chat Panel */}
      {chatOpen && !isCancelled && (
        <section
          className="mt-5 rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold text-white">Chat com o Ambulante</h3>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-[12px] text-white/50 bg-transparent border-none cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 ? (
              <p className="font-sans text-[12px] text-white/45 text-center py-3">
                Nenhuma mensagem ainda. Use uma mensagem rápida abaixo.
              </p>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_role === "tomador";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="rounded-xl px-3 py-2 max-w-[82%] font-sans text-[13px]"
                      style={{
                        background: isMine ? "#0DB87E" : "rgba(255,255,255,0.10)",
                        color: "#fff",
                      }}
                    >
                      {m.message_text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={sendingMsg}
                onClick={() => handleSendChat(preset)}
                className="rounded-full px-3 py-1 font-sans text-[11px] text-white/85 bg-white/10 border border-white/15 cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatDraft.trim()) handleSendChat(chatDraft);
              }}
              placeholder="Escreva uma mensagem..."
              className="flex-1 rounded-xl px-3 py-2 bg-white/10 border border-white/10 text-white text-[13px] outline-none"
            />
            <button
              type="button"
              disabled={sendingMsg || !chatDraft.trim()}
              onClick={() => handleSendChat(chatDraft)}
              aria-label="Enviar mensagem"
              className="px-3.5 rounded-xl bg-[#0DB87E] text-white border-none cursor-pointer disabled:opacity-45"
            >
              <Send size={15} />
            </button>
          </div>
        </section>
      )}

      {/* Order items & breakdown */}
      <section
        className="mt-5 rounded-2xl p-4 space-y-2.5"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        <h3 className="font-display text-[15px] font-bold text-white">Resumo do Pedido</h3>
        <div className="space-y-1.5">
          {(pedido.pedido_itens || []).map((item) => (
            <div key={item.id} className="flex justify-between font-sans text-[13px] text-white/80">
              <span>
                {item.emoji || "🛍️"} {item.qty}x {item.nome}
              </span>
              <span>R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-white/10 space-y-1 font-sans text-[12px] text-white/65">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {Number(pedido.subtotal ?? pedido.total).toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between">
            <span>{isDelivery ? "Taxa de entrega" : "Retirada no ponto"}</span>
            <span>R$ {Number(pedido.delivery_fee ?? 0).toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between font-display text-[15px] font-bold text-white pt-1">
            <span>Total</span>
            <span className="text-[#0DB87E]">
              R$ {Number(pedido.total).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
        {isDelivery && pedido.delivery_address && (
          <p className="pt-2 border-t border-white/10 font-sans text-[12px] text-white/65">
            Entrega em: <strong className="text-white">{pedido.delivery_address}</strong>
            {pedido.delivery_referencia ? ` (${pedido.delivery_referencia})` : ""}
          </p>
        )}
      </section>

      {/* Cancel button (RPC cancel_ambulante_order) */}
      {canCancel && (
        <button
          type="button"
          disabled={cancelling}
          onClick={handleCancelOrder}
          className="mt-4 w-full rounded-xl py-3 px-4 font-sans text-[13px] font-semibold cursor-pointer disabled:opacity-50"
          style={{
            background: "rgba(232,64,64,0.12)",
            border: "1px solid rgba(232,64,64,0.32)",
            color: "#F87171",
          }}
        >
          {cancelling ? "Cancelando..." : "Cancelar Pedido"}
        </button>
      )}

      {/* Rating Card (only after paid/completed and not yet rated) */}
      {(isPaid || pedido.status === "completed") && !alreadyRated && (
        <section
          className="mt-5 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <h3 className="font-display text-[16px] font-bold text-white text-center">
            Como foi o atendimento de {vendorName}?
          </h3>
          <div className="mt-3 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`${star} estrelas`}
                onClick={() => setRating(star)}
                className="bg-transparent border-none cursor-pointer p-1"
              >
                <Star
                  size={30}
                  color={star <= rating ? "#F5A623" : "rgba(255,255,255,0.28)"}
                  fill={star <= rating ? "#F5A623" : "none"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário opcional"
            className="mt-3 w-full rounded-xl p-3 font-sans text-[13px] text-white placeholder:text-white/40 outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              minHeight: 72,
            }}
          />
          <button
            type="button"
            disabled={rating === 0 || submittingRating}
            onClick={handleSubmitRating}
            className="mt-3 w-full rounded-xl py-3 px-4 border-none bg-[#0DB87E] text-white font-display font-bold text-[14px] cursor-pointer disabled:opacity-50"
          >
            {submittingRating ? "Enviando..." : "Enviar Avaliação"}
          </button>
        </section>
      )}
    </div>
  );
};

export default AmbulantePedidoPage;
