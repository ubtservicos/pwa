import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChefHat,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  QrCode,
  Send,
  Star,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAmbulanteQuickMessages } from "@/hooks/useAmbulanteQuickMessages";
import { isDeliveryModalidade } from "@/components/ambulantes/AmbulanteTrustBadges";
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

interface OrderItem {
  id: string;
  nome: string;
  emoji?: string | null;
  qty: number;
  preco_unit: number;
  subtotal: number;
}

interface ProviderOrder {
  id: string;
  tomador_id: string;
  prestador_id: string;
  status: OrderStatus;
  modalidade: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_referencia?: string | null;
  payment_method?: string | null;
  pix_payment_id?: string | null;
  pix_qr_code?: string | null;
  pix_qr_code_base64?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  pedido_itens?: OrderItem[];
}

export default function AmbulantesGerenciarPedidoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { toast, showToast } = useSimpleToast();

  const [pedido, setPedido] = useState<ProviderOrder | null>(null);
  const [customerName, setCustomerName] = useState("Cliente UBT");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // PIX Presencial Charge
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{
    qr_code?: string;
    qr_code_base64?: string;
    payment_id?: string | number;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Quick Chat
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
    senderRole: "prestador",
    enabled: Boolean(id && pedido && pedido.status !== "cancelled"),
  });

  // Customer rating
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
        .select("*, pedido_itens(id, nome, emoji, qty, preco_unit, subtotal)")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as ProviderOrder;
        setPedido(row);

        if (row.pix_qr_code || row.pix_qr_code_base64) {
          setPixData({
            qr_code: row.pix_qr_code || undefined,
            qr_code_base64: row.pix_qr_code_base64 || undefined,
            payment_id: row.pix_payment_id || undefined,
          });
        }

        if (row.tomador_id) {
          const { data: uData } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", row.tomador_id)
            .maybeSingle();
          if (uData?.nome) setCustomerName(uData.nome);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar pedido para gerenciamento:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        // ignore
      }
    };
    checkRating();
    return () => {
      active = false;
    };
  }, [id, user.uid]);

  // Realtime sync
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ambulante-pedido-prestador-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Partial<ProviderOrder>;
          if (!updated) return;
          setPedido((prev) => (prev ? { ...prev, ...updated } : prev));
        },
      )
      .subscribe();

    const fallbackPoll = window.setInterval(fetchPedido, 8000);
    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [id, fetchPedido]);

  // Poll PIX status whenever PIX charge is active
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
          showToast("Pagamento PIX confirmado! Repasse 90/10 registrado ✓");
        }
      } catch {
        // retry silently
      }
    }, 4000);

    return () => {
      if (pollPixRef.current) {
        window.clearInterval(pollPixRef.current);
        pollPixRef.current = null;
      }
    };
  }, [id, pixData?.payment_id, pedido?.pix_payment_id, pedido?.status, showToast]);

  const handleConfirmPending = async () => {
    if (!id) return;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc("confirm_ambulante_order", { p_pedido_id: id });
      if (error) throw error;
      setPedido((prev) => (prev ? { ...prev, status: "confirmed" } : prev));
      showToast("Pedido confirmado e estoque reservado ✓");
    } catch (err: any) {
      showToast(err?.message || "Erro ao aceitar pedido.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus: "preparing" | "ready" | "completed") => {
    if (!id) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setPedido((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      showToast(
        nextStatus === "preparing"
          ? "Pedido marcado como Em Preparo"
          : nextStatus === "ready"
            ? "Pedido marcado como Pronto!"
            : "Entrega/retirada concluída! Agora cobre via PIX ou aguarde o cliente pagar no app.",
      );
    } catch (err: any) {
      showToast(err?.message || "Não foi possível atualizar o status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!id) return;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc("cancel_ambulante_order", {
        p_pedido_id: id,
        p_reason: "Cancelado pelo ambulante",
      });
      if (error) throw error;
      setPedido((prev) =>
        prev ? { ...prev, status: "cancelled", cancel_reason: "Cancelado pelo ambulante" } : prev,
      );
      showToast("Pedido cancelado e estoque restaurado.");
    } catch (err: any) {
      showToast(err?.message || "Erro ao cancelar pedido.");
    } finally {
      setUpdating(false);
    }
  };

  const handleChargePixPresencial = async () => {
    if (!id) return;
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
      showToast("QR Code PIX gerado! Mostre ao cliente para escanear.");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível gerar o PIX.");
    } finally {
      setPixLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopiedPix(true);
      showToast("PIX Copia e Cola copiado!");
      setTimeout(() => setCopiedPix(false), 2500);
    } catch {
      showToast("Copie o código manualmente.");
    }
  };

  const handleSendChat = async (text: string) => {
    const res = await sendMessage(text);
    if (res.ok) setChatDraft("");
    else if (res.error) showToast(res.error);
  };

  const handleSubmitRating = async () => {
    if (!id || !pedido || !user.uid || rating === 0) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from("ambulante_avaliacoes").insert({
        pedido_id: id,
        avaliador_id: user.uid,
        avaliado_id: pedido.tomador_id,
        papel_avaliador: "prestador",
        nota: rating,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
      setAlreadyRated(true);
      showToast("Avaliação do cliente registrada!");
    } catch (err: any) {
      showToast(err?.message || "Erro ao enviar avaliação.");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#0B1B3E] text-white/60 flex items-center justify-center font-sans text-sm">
        Carregando pedido...
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="min-h-[100svh] bg-[#0B1B3E] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="font-display text-[18px] font-bold">Pedido não encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/app/prestador/ambulantes/online")}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  const isDelivery = isDeliveryModalidade(pedido.modalidade);
  const canChargePix = pedido.status === "ready" || pedido.status === "completed";
  const canCancel = pedido.status !== "paid" && pedido.status !== "cancelled";
  const isPaid = pedido.status === "paid";
  const isCancelled = pedido.status === "cancelled";

  const mapsUrl =
    pedido.delivery_lat && pedido.delivery_lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${pedido.delivery_lat},${pedido.delivery_lng}`
      : pedido.delivery_address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pedido.delivery_address}, Ubatuba SP`)}`
        : null;

  return (
    <div
      className="min-h-[100svh] overflow-y-auto text-white"
      style={{ background: "#0B1B3E", padding: 20, paddingBottom: 60 }}
    >
      <Toast message={toast} />

      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/app/prestador/ambulantes/online")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full bg-white/10 border-none text-white flex items-center justify-center cursor-pointer shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="font-display text-[17px] font-bold truncate">
            Pedido #{pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="font-sans text-[12px] text-white/60 truncate">{customerName}</p>
        </div>
        {!isCancelled ? (
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Chat com cliente"
            className="w-10 h-10 rounded-full border-none flex items-center justify-center cursor-pointer relative shrink-0"
            style={{ background: "rgba(13,184,126,0.18)", color: "#0DB87E" }}
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

      {/* Current Status & Action */}
      <section
        className="mt-5 rounded-2xl p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {isCancelled ? (
          <div className="text-center py-2">
            <XCircle size={42} color="#E84040" className="mx-auto mb-2" />
            <h2 className="font-display text-[18px] font-bold">Pedido Cancelado</h2>
            <p className="font-sans text-[12px] text-white/60 mt-1">
              {pedido.cancel_reason || "Cancelado antes do pagamento."}
            </p>
          </div>
        ) : isPaid ? (
          <div className="text-center py-2">
            <CheckCircle size={46} color="#0DB87E" className="mx-auto mb-2" />
            <h2 className="font-display text-[19px] font-bold">Pedido Pago & Finalizado!</h2>
            <p className="font-sans text-[13px] text-white/75 mt-1">
              Valor total R$ {Number(pedido.total).toFixed(2).replace(".", ",")} liquidado via{" "}
              {pedido.payment_method?.toLowerCase().includes("card") ? "Cartão" : "PIX"}.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/app/gerenciar/transacao/${pedido.id}`)}
              className="mt-4 w-full rounded-xl py-3 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer"
            >
              Ver comprovante no Extrato
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(13,184,126,0.16)", color: "#0DB87E" }}
              >
                {pedido.status === "preparing" ? <ChefHat size={24} /> : <Package size={24} />}
              </div>
              <div>
                <p className="font-sans text-[11px] uppercase tracking-wider text-[#0DB87E] font-bold">
                  Status atual
                </p>
                <h2 className="font-display text-[17px] font-bold">
                  {pedido.status === "pending" && "Aguardando sua confirmação"}
                  {pedido.status === "confirmed" && "Confirmado · Pronto para preparar"}
                  {pedido.status === "preparing" && "Em preparo"}
                  {pedido.status === "ready" &&
                    (isDelivery ? "Pronto para entrega" : "Pronto para retirada")}
                  {pedido.status === "completed" && "Entregue · Aguardando Pagamento"}
                </h2>
              </div>
            </div>

            {/* Transition CTA */}
            {pedido.status === "pending" && (
              <button
                type="button"
                disabled={updating}
                onClick={handleConfirmPending}
                className="w-full rounded-xl py-3.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer disabled:opacity-50"
              >
                {updating ? "Confirmando..." : "Aceitar Pedido e Reservar Estoque"}
              </button>
            )}
            {pedido.status === "confirmed" && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAdvanceStatus("preparing")}
                className="w-full rounded-xl py-3.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer disabled:opacity-50"
              >
                Iniciar Preparo
              </button>
            )}
            {pedido.status === "preparing" && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAdvanceStatus("ready")}
                className="w-full rounded-xl py-3.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer disabled:opacity-50"
              >
                {isDelivery ? "Marcar como Pronto / A Caminho" : "Marcar como Pronto para Retirada"}
              </button>
            )}
            {pedido.status === "ready" && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAdvanceStatus("completed")}
                className="w-full rounded-xl py-3.5 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none cursor-pointer disabled:opacity-50"
              >
                Confirmar Entrega / Retirada
              </button>
            )}
          </>
        )}
      </section>

      {/* Cobrar PIX Presencial (available at 'ready' or 'completed') */}
      {canChargePix && (
        <section
          className="mt-4 rounded-2xl p-4 space-y-3"
          style={{
            background: "rgba(13,184,126,0.10)",
            border: "1.5px solid rgba(13,184,126,0.38)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold text-white flex items-center gap-2">
              <QrCode size={18} color="#0DB87E" /> Cobrar PIX Presencial
            </h3>
            <span className="font-display text-[16px] font-extrabold text-[#0DB87E]">
              R$ {Number(pedido.total).toFixed(2).replace(".", ",")}
            </span>
          </div>
          <p className="font-sans text-[12px] text-white/75">
            Gere o QR Code PIX na hora para o cliente pagar presencialmente (ou aguarde o cliente pagar no app dele por PIX/Cartão).
          </p>

          {pixData?.qr_code || pixData?.qr_code_base64 ? (
            <div className="rounded-xl p-4 bg-white/5 border border-white/10 text-center space-y-3">
              {pixData.qr_code_base64 && (
                <img
                  src={
                    pixData.qr_code_base64.startsWith("data:")
                      ? pixData.qr_code_base64
                      : `data:image/png;base64,${pixData.qr_code_base64}`
                  }
                  alt="QR Code PIX Presencial"
                  className="w-48 h-48 mx-auto rounded-xl bg-white p-2"
                />
              )}
              <p className="font-sans text-[12px] text-[#0DB87E] font-semibold">
                Aguardando pagamento do cliente (atualização automática)...
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
              onClick={handleChargePixPresencial}
              className="w-full rounded-xl py-3 px-4 bg-[#0DB87E] text-white font-display font-bold text-[14px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <QrCode size={17} />
              {pixLoading ? "Gerando QR Code PIX..." : "Gerar QR Code PIX Presencial"}
            </button>
          )}
        </section>
      )}

      {/* Delivery Coordinates & Map Link */}
      {isDelivery && (pedido.delivery_address || mapsUrl) && (
        <section
          className="mt-4 rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <h3 className="font-display text-[14px] font-bold text-white flex items-center gap-1.5">
            <MapPin size={15} color="#0DB87E" /> Local de Entrega
          </h3>
          <p className="font-sans text-[13px] text-white/85">
            {pedido.delivery_address || "Coordenadas GPS enviadas pelo cliente"}
          </p>
          {pedido.delivery_referencia && (
            <p className="font-sans text-[12px] text-white/60">
              Referência: {pedido.delivery_referencia}
            </p>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 font-sans text-[12px] font-semibold text-[#0DB87E] no-underline"
            >
              Abrir rota no Google Maps <ExternalLink size={13} />
            </a>
          )}
        </section>
      )}

      {/* Quick Chat Drawer */}
      {chatOpen && !isCancelled && (
        <section
          className="mt-4 rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold text-white">Chat com {customerName}</h3>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-[12px] text-white/50 bg-transparent border-none cursor-pointer"
            >
              Fechar
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {messages.length === 0 ? (
              <p className="font-sans text-[12px] text-white/45 text-center py-3">
                Nenhuma mensagem ainda.
              </p>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_role === "prestador";
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
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
              placeholder="Enviar mensagem ao cliente..."
              className="flex-1 rounded-xl px-3 py-2 bg-white/10 border border-white/10 text-white text-[13px] outline-none"
            />
            <button
              type="button"
              disabled={sendingMsg || !chatDraft.trim()}
              onClick={() => handleSendChat(chatDraft)}
              aria-label="Enviar"
              className="px-3.5 rounded-xl bg-[#0DB87E] text-white border-none cursor-pointer disabled:opacity-45"
            >
              <Send size={15} />
            </button>
          </div>
        </section>
      )}

      {/* Items breakdown */}
      <section
        className="mt-4 rounded-2xl p-4 space-y-2"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <h3 className="font-display text-[14px] font-bold text-white">Itens do Pedido</h3>
        {(pedido.pedido_itens || []).map((item) => (
          <div key={item.id} className="flex justify-between font-sans text-[13px] text-white/85">
            <span>
              {item.emoji || "🛍️"} {item.qty}x {item.nome}
            </span>
            <span>R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}</span>
          </div>
        ))}
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
      </section>

      {/* Cancel button before paid */}
      {canCancel && (
        <button
          type="button"
          disabled={updating}
          onClick={handleCancelOrder}
          className="mt-4 w-full rounded-xl py-3 px-4 font-sans text-[13px] font-semibold cursor-pointer disabled:opacity-50"
          style={{
            background: "rgba(232,64,64,0.12)",
            border: "1px solid rgba(232,64,64,0.32)",
            color: "#F87171",
          }}
        >
          Cancelar Pedido
        </button>
      )}

      {/* Rating of the customer after paid/completed */}
      {(isPaid || pedido.status === "completed") && !alreadyRated && (
        <section
          className="mt-5 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <h3 className="font-display text-[15px] font-bold text-white text-center">
            Avaliar {customerName}
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
                  size={28}
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
              minHeight: 68,
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
}
