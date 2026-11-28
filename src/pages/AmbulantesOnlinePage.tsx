import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Power,
  ShieldAlert,
  Truck,
  XCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UBATUBA_CENTER } from "@/lib/googleMapsConfig";
import {
  formatDeliveryFeeLabel,
  isDeliveryModalidade,
} from "@/components/ambulantes/AmbulanteTrustBadges";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

interface AmbulanteProfile {
  user_id: string;
  nome_comercial: string;
  kyc_status: string;
  delivery_fee: number;
  modalidades: string[];
  praia_referencia?: string | null;
  ponto_referencia?: string | null;
}

interface ActivePedido {
  id: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed";
  modalidade: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address?: string | null;
  delivery_referencia?: string | null;
  created_at: string;
  pedido_itens?: Array<{ id: string; nome: string; emoji?: string | null; qty: number }>;
}

const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed"] as const;

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Novo Pedido", color: "#F5A623", bg: "rgba(245,166,35,0.16)" },
  confirmed: { label: "Confirmado", color: "#0DB87E", bg: "rgba(13,184,126,0.16)" },
  preparing: { label: "Em Preparo", color: "#38BDF8", bg: "rgba(56,189,248,0.16)" },
  ready: { label: "Pronto", color: "#A78BFA", bg: "rgba(167,139,250,0.16)" },
  completed: { label: "Aguardando Pgto", color: "#00FF66", bg: "rgba(0,255,102,0.16)" },
};

export default function AmbulantesOnlinePage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { toast, showToast } = useSimpleToast();

  const [profile, setProfile] = useState<AmbulanteProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeOrders, setActiveOrders] = useState<ActivePedido[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; count: number }>({
    total: 0,
    count: 0,
  });
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // Quick delivery_fee edit
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("0,00");
  const [savingFee, setSavingFee] = useState(false);

  const fetchOrdersAndStats = useCallback(async () => {
    if (!user.uid) return;
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [{ data: activeRows }, { data: todayRows }] = await Promise.all([
        supabase
          .from("pedidos")
          .select(
            "id, status, modalidade, subtotal, delivery_fee, total, delivery_address, delivery_referencia, created_at, pedido_itens(id, nome, emoji, qty)",
          )
          .eq("prestador_id", user.uid)
          .in("status", [...ACTIVE_STATUSES])
          .order("created_at", { ascending: false }),
        supabase
          .from("pedidos")
          .select("id, total, status, created_at")
          .eq("prestador_id", user.uid)
          .in("status", ["completed", "paid"])
          .gte("created_at", startOfToday.toISOString()),
      ]);

      setActiveOrders((activeRows as unknown as ActivePedido[]) || []);

      const listToday = todayRows || [];
      const sumToday = listToday.reduce((acc: number, row: any) => acc + Number(row.total || 0), 0);
      setTodayStats({
        total: Number(sumToday.toFixed(2)),
        count: listToday.length,
      });
    } catch (err) {
      console.error("Erro ao carregar fila de pedidos do ambulante:", err);
    }
  }, [user.uid]);

  useEffect(() => {
    if (!user.uid) return;
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        const [rpcRes, sessRes] = await Promise.all([
          Promise.resolve(supabase.rpc("get_my_ambulante_profile")).catch(() => ({
            data: null,
            error: { message: "rpc_err" },
          })),
          supabase
            .from("ambulante_sessions")
            .select("id, is_online, delivery_fee")
            .eq("id", user.uid)
            .maybeSingle(),
        ]);

        if (!active) return;

        let prof: AmbulanteProfile | null = null;
        const rpcData = (rpcRes as any)?.data;
        if (rpcData && typeof rpcData === "object") {
          const unwrapped = rpcData.record ?? rpcData;
          if (unwrapped?.user_id || unwrapped?.kyc_status) {
            prof = unwrapped as AmbulanteProfile;
          }
        }
        if (!prof) {
          const { data: directProf } = await supabase
            .from("prestador_ambulante")
            .select(
              "user_id, nome_comercial, kyc_status, delivery_fee, modalidades, praia_referencia, ponto_referencia",
            )
            .eq("user_id", user.uid)
            .maybeSingle();
          if (directProf) prof = directProf as AmbulanteProfile;
        }

        setProfile(prof);
        const initialFee = Number(prof?.delivery_fee ?? sessRes.data?.delivery_fee ?? 0) || 0;
        setFeeDraft(initialFee.toFixed(2).replace(".", ","));
        setIsOnline(Boolean(sessRes.data?.is_online) && prof?.kyc_status === "approved");

        await fetchOrdersAndStats();
      } catch (err) {
        console.error("Erro ao inicializar painel online do ambulante:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [user.uid, fetchOrdersAndStats]);

  // Realtime subscription on orders for this provider
  useEffect(() => {
    if (!user.uid) return;
    const channel = supabase
      .channel(`ambulante-online-orders-${user.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `prestador_id=eq.${user.uid}` },
        () => {
          fetchOrdersAndStats();
        },
      )
      .subscribe();

    const poll = window.setInterval(fetchOrdersAndStats, 10000);
    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [user.uid, fetchOrdersAndStats]);

  const getCurrentCoords = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve) => {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(UBATUBA_CENTER),
          { enableHighAccuracy: false, timeout: 4500, maximumAge: 60000 },
        );
      } else {
        resolve(UBATUBA_CENTER);
      }
    });

  const handleToggleOnline = async () => {
    if (!user.uid) return;
    if (!profile || profile.kyc_status !== "approved") {
      showToast("Seu cadastro KYC de Ambulante precisa estar aprovado para ficar online.");
      navigate(
        profile?.kyc_status === "pending"
          ? "/app/prestador/ambulantes/kyc-pending"
          : "/app/prestador/ambulantes/onboarding",
      );
      return;
    }

    const nextOnline = !isOnline;
    setToggling(true);
    try {
      const coords = nextOnline ? await getCurrentCoords() : null;
      const payload: Record<string, any> = {
        id: user.uid,
        is_online: nextOnline,
        delivery_fee: Number(profile.delivery_fee ?? 0) || 0,
        praia_referencia: profile.praia_referencia || null,
        ponto_referencia: profile.ponto_referencia || null,
        modalidades:
          Array.isArray(profile.modalidades) && profile.modalidades.length > 0
            ? profile.modalidades
            : ["entrega", "retirada"],
        updated_at: new Date().toISOString(),
      };
      if (coords) {
        payload.lat = coords.lat;
        payload.lng = coords.lng;
      }

      const { error } = await supabase
        .from("ambulante_sessions")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      setIsOnline(nextOnline);
      showToast(nextOnline ? "Você está ONLINE na praia!" : "Você ficou offline.");
    } catch (err: any) {
      console.error("Erro ao alternar online do ambulante:", err);
      showToast(err?.message || "Não foi possível alterar seu status online.");
    } finally {
      setToggling(false);
    }
  };

  const handleSaveDeliveryFee = async () => {
    const parsed = Number(feeDraft.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Informe uma taxa válida (0,00 ou maior).");
      return;
    }
    setSavingFee(true);
    try {
      const cleanFee = Number(parsed.toFixed(2));
      const { error } = await supabase.rpc("update_my_ambulante_delivery_fee", {
        p_delivery_fee: cleanFee,
      });
      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, delivery_fee: cleanFee } : prev));
      setEditingFee(false);
      showToast("Taxa de entrega atualizada ✓");
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar taxa de entrega.");
    } finally {
      setSavingFee(false);
    }
  };

  const handleAcceptOrder = async (pedidoId: string) => {
    setBusyOrderId(pedidoId);
    try {
      const { error } = await supabase.rpc("confirm_ambulante_order", {
        p_pedido_id: pedidoId,
      });
      if (error) {
        const msg = String(error.message || "");
        if (/estoque|stock|insuficiente|insufficient/i.test(msg)) {
          showToast("Estoque insuficiente para aceitar este pedido. Atualize seu cardápio.");
        } else {
          showToast(msg || "Não foi possível aceitar o pedido.");
        }
        return;
      }
      showToast("Pedido aceito e estoque reservado ✓");
      await fetchOrdersAndStats();
      navigate(`/app/prestador/ambulantes/pedido/${pedidoId}`);
    } catch (err: any) {
      showToast(err?.message || "Erro ao confirmar pedido.");
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleRejectOrder = async (pedidoId: string) => {
    setBusyOrderId(pedidoId);
    try {
      const { error } = await supabase.rpc("cancel_ambulante_order", {
        p_pedido_id: pedidoId,
        p_reason: "Recusado pelo ambulante",
      });
      if (error) throw error;
      showToast("Pedido recusado/cancelado.");
      await fetchOrdersAndStats();
    } catch (err: any) {
      showToast(err?.message || "Erro ao recusar pedido.");
    } finally {
      setBusyOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#0B1B3E] text-white/60 flex items-center justify-center font-sans text-sm">
        Carregando painel do Ambulante...
      </div>
    );
  }

  const isKycApproved = profile?.kyc_status === "approved";

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
          onClick={() => navigate("/app/prestador/home")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full bg-white/10 border-none text-white flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[18px] font-bold truncate">
            {profile?.nome_comercial || "Painel Ambulante"}
          </h1>
          <p className="font-sans text-[12px] text-white/60 flex items-center gap-1 truncate">
            <MapPin size={12} color="#0DB87E" />
            {[profile?.praia_referencia, profile?.ponto_referencia].filter(Boolean).join(" • ") ||
              "Ubatuba, SP"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/app/prestador/ambulantes/cardapio")}
          className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 font-sans text-[12px] font-semibold text-white cursor-pointer"
        >
          Cardápio
        </button>
      </header>

      {/* KYC Gate Banner if not approved */}
      {!isKycApproved && (
        <section
          className="mt-5 rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: "rgba(245,166,35,0.12)",
            border: "1px solid rgba(245,166,35,0.35)",
          }}
        >
          <ShieldAlert size={22} color="#F5A623" className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-display text-[15px] font-bold text-[#F5A623]">
              {profile?.kyc_status === "pending"
                ? "Cadastro KYC em análise"
                : profile?.kyc_status === "rejected"
                  ? "Cadastro KYC precisa de revisão"
                  : "Complete seu cadastro KYC"}
            </h2>
            <p className="font-sans text-[12px] text-white/80 mt-1">
              Para ficar online e receber pedidos na praia, seu KYC de identidade precisa estar aprovado.
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(
                  profile?.kyc_status === "pending"
                    ? "/app/prestador/ambulantes/kyc-pending"
                    : "/app/prestador/ambulantes/onboarding",
                )
              }
              className="mt-3 px-4 py-2 rounded-xl bg-[#F5A623] text-black font-display font-bold text-[12px] border-none cursor-pointer"
            >
              {profile?.kyc_status === "pending" ? "Ver status do KYC" : "Completar KYC agora"}
            </button>
          </div>
        </section>
      )}

      {/* Online Toggle Card */}
      <section
        className="mt-5 rounded-2xl p-5 flex items-center justify-between gap-4"
        style={{
          background: isOnline ? "rgba(13,184,126,0.16)" : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${isOnline ? "#0DB87E" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        <div>
          <span
            className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-wider"
            style={{ color: isOnline ? "#0DB87E" : "rgba(255,255,255,0.55)" }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: isOnline ? "#0DB87E" : "rgba(255,255,255,0.35)" }}
            />
            {isOnline ? "Online · Visível aos clientes" : "Offline · Oculto na busca"}
          </span>
          <p className="font-display text-[17px] font-bold mt-1">
            {isOnline ? "Recebendo pedidos na praia" : "Toque para iniciar vendas"}
          </p>
        </div>

        <button
          type="button"
          disabled={toggling || !isKycApproved}
          onClick={handleToggleOnline}
          className="w-14 h-14 rounded-2xl border-none flex items-center justify-center shrink-0 transition-transform active:scale-95"
          style={{
            background: isOnline ? "#0DB87E" : "rgba(255,255,255,0.12)",
            color: "#fff",
            opacity: !isKycApproved ? 0.4 : 1,
            cursor: !isKycApproved ? "not-allowed" : "pointer",
          }}
          aria-label={isOnline ? "Ficar offline" : "Ficar online"}
        >
          <Power size={24} />
        </button>
      </section>

      {/* Real Today Metrics + Delivery Fee Quick Edit */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <p className="font-sans text-[11px] text-white/55 uppercase tracking-wider">Hoje</p>
          <p className="font-display text-[20px] font-extrabold text-[#0DB87E] mt-1">
            R$ {todayStats.total.toFixed(2).replace(".", ",")}
          </p>
          <p className="font-sans text-[12px] text-white/65 mt-0.5">
            {todayStats.count} {todayStats.count === 1 ? "pedido concluído" : "pedidos concluídos"}
          </p>
        </div>

        <div
          className="rounded-2xl p-4 flex flex-col justify-between"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] text-white/55 uppercase tracking-wider flex items-center gap-1">
              <Truck size={12} color="#0DB87E" /> Taxa Entrega
            </span>
            {isKycApproved && !editingFee && (
              <button
                type="button"
                onClick={() => setEditingFee(true)}
                className="text-[11px] font-semibold text-[#0DB87E] bg-transparent border-none cursor-pointer"
              >
                Editar
              </button>
            )}
          </div>

          {editingFee ? (
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={feeDraft}
                onChange={(e) => setFeeDraft(e.target.value)}
                className="w-full rounded-lg px-2 py-1 bg-white/10 border border-white/15 text-white text-[13px] outline-none"
              />
              <button
                type="button"
                disabled={savingFee}
                onClick={handleSaveDeliveryFee}
                className="px-2.5 rounded-lg bg-[#0DB87E] text-white text-[12px] font-bold border-none cursor-pointer"
              >
                OK
              </button>
            </div>
          ) : (
            <>
              <p className="font-display text-[18px] font-bold text-white mt-1">
                {formatDeliveryFeeLabel(profile?.delivery_fee ?? 0)}
              </p>
              <p className="font-sans text-[11px] text-white/50">Retirada: R$ 0,00</p>
            </>
          )}
        </div>
      </section>

      {/* Active Orders Queue */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[16px] font-bold text-white flex items-center gap-2">
            <ClipboardList size={18} color="#0DB87E" />
            Pedidos Ativos ({activeOrders.length})
          </h2>
          <button
            type="button"
            onClick={() => navigate("/app/prestador/ambulantes/onboarding")}
            className="text-[12px] font-sans text-white/60 bg-transparent border-none cursor-pointer"
          >
            Meus dados
          </button>
        </div>

        {activeOrders.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Package size={36} className="mx-auto text-white/30 mb-2" />
            <p className="font-display text-[15px] font-bold text-white">
              Nenhum pedido ativo no momento
            </p>
            <p className="font-sans text-[12px] text-white/55 mt-1">
              {isOnline
                ? "Os novos pedidos dos banhistas aparecerão aqui instantaneamente."
                : "Fique online para começar a receber pedidos."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeOrders.map((order) => {
              const badge = STATUS_BADGE[order.status] || STATUS_BADGE.pending;
              const isDelivery = isDeliveryModalidade(order.modalidade);
              const isBusy = busyOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${order.status === "pending" ? "rgba(245,166,35,0.45)" : "rgba(255,255,255,0.10)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 font-sans text-[11px] font-bold"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <p className="font-display text-[15px] font-bold text-white mt-1.5">
                        Pedido #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="font-sans text-[12px] text-white/60 flex items-center gap-1">
                        <Clock size={11} />
                        {isDelivery ? "Entrega na areia" : "Retirada no ponto"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[17px] font-extrabold text-[#0DB87E]">
                        R$ {Number(order.total).toFixed(2).replace(".", ",")}
                      </p>
                      <p className="font-sans text-[11px] text-white/50">
                        {order.pedido_itens?.reduce((s, i) => s + i.qty, 0) || 0} itens
                      </p>
                    </div>
                  </div>

                  {/* Items preview */}
                  {order.pedido_itens && order.pedido_itens.length > 0 && (
                    <div className="rounded-xl p-2.5 bg-white/5 space-y-1">
                      {order.pedido_itens.map((item) => (
                        <p key={item.id} className="font-sans text-[12px] text-white/85">
                          {item.emoji || "🛍️"} {item.qty}x {item.nome}
                        </p>
                      ))}
                    </div>
                  )}

                  {isDelivery && order.delivery_address && (
                    <p className="font-sans text-[12px] text-white/70 flex items-center gap-1.5">
                      <MapPin size={13} color="#0DB87E" className="shrink-0" />
                      <span className="truncate">
                        {order.delivery_address}
                        {order.delivery_referencia ? ` · ${order.delivery_referencia}` : ""}
                      </span>
                    </p>
                  )}

                  {order.status === "pending" ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRejectOrder(order.id)}
                        className="rounded-xl py-2.5 px-3 font-sans text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        style={{
                          background: "rgba(232,64,64,0.14)",
                          border: "1px solid rgba(232,64,64,0.35)",
                          color: "#F87171",
                        }}
                      >
                        <XCircle size={15} /> Recusar
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAcceptOrder(order.id)}
                        className="rounded-xl py-2.5 px-3 font-display text-[13px] font-bold bg-[#0DB87E] text-white border-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} /> {isBusy ? "Confirmando..." : "Aceitar"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/prestador/ambulantes/pedido/${order.id}`)}
                      className="w-full rounded-xl py-2.5 px-3 bg-white/10 border border-white/10 text-white font-display text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Gerenciar Pedido <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
