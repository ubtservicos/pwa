import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Navigation, MapPin, CheckCircle2, Star, MessageSquare,
  User as UserIcon, Building2, Users, Gift, Heart,
  Scan, Smartphone, CreditCard, Banknote, Copy, Check, QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import Confetti from "react-confetti";
import { calcSplit, formatBRL, SPLIT_META } from "@/utils/ride";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import QuickStatusMessages from "@/components/mototaxi/QuickStatusMessages";

const ICONS = { User: UserIcon, Building2, Users, Gift, Star, Heart } as const;
type IconKey = keyof typeof ICONS;

const UBATUBA = { lat: -23.4336, lng: -45.0838 };
const ORIGIN = { lat: UBATUBA.lat + 0.005, lng: UBATUBA.lng + 0.003 };
const DESTINATION = { lat: UBATUBA.lat + 0.018, lng: UBATUBA.lng + 0.012 };

type Phase = "arriving" | "in_progress" | "completed";

interface ActiveRide {
  id: string;
  type: "carona" | "entrega";
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  passengerName?: string;
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  paymentMethod?: string;
  startTime?: number | string;
  created_at?: string;
}

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div
    className="absolute left-0 right-0 bottom-0 z-10 text-zinc-100"
    style={{
      background: "var(--prestador-card)",
      borderRadius: "24px 24px 0 0",
      padding: "12px 20px 96px",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
    }}
  >
    <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "var(--prestador-border)" }} />
    {children}
  </div>
);

const PrestadorMototaxiActive = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [phase, setPhase] = useState<Phase>("arriving");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number }>(UBATUBA);
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [lastSentPhrase, setLastSentPhrase] = useState<string | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<{ text: string; sender: string } | null>(null);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [paymentMethodSelected, setPaymentMethodSelected] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isConfirmingCash, setIsConfirmingCash] = useState(false);
  const [pixQrBase64, setPixQrBase64] = useState<string>("");
  const [pixCopiaColaCode, setPixCopiaColaCode] = useState<string>("");
  const [isPixLoading, setIsPixLoading] = useState<boolean>(false);
  const msgChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!ride?.id) return;

    let channel: any = null;

    const setupMsgChannel = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      channel = supabase
        .channel(`ride_msg_${ride.id}`)
        .on('broadcast', { event: 'quick_message' }, ({ payload }) => {
          console.log('Mensagem rápida recebida pelo prestador:', payload);
          if (payload?.text && payload?.from === 'tomador') {
            setIncomingMessage({
              text: payload.text,
              sender: 'Passageiro(a)',
            });
          }
        })
        .on('broadcast', { event: 'payment_method_selected' }, ({ payload }) => {
          console.log('Método de pagamento selecionado pelo passageiro:', payload);
          if (payload?.method || payload?.dbMethod) {
            const chosen = payload.method || payload.dbMethod;
            setPaymentMethodSelected(chosen);
            if (chosen === "pix_scanner" && !payload?.qr_code_base64) {
              setIsPixLoading(true);
            }
          }
          if (payload?.qr_code_base64) {
            setPixQrBase64(payload.qr_code_base64);
            setIsPixLoading(false);
          }
          if (payload?.qr_code) {
            setPixCopiaColaCode(payload.qr_code);
          }
        })
        .on('broadcast', { event: 'pix_qr_ready' }, ({ payload }) => {
          console.log('QR Code Pix dinâmico recebido da API:', payload);
          if (payload?.qr_code_base64) {
            setPixQrBase64(payload.qr_code_base64);
            setIsPixLoading(false);
          }
          if (payload?.qr_code) {
            setPixCopiaColaCode(payload.qr_code);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            msgChannelRef.current = channel;
          }
        });
    };

    setupMsgChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
          msgChannelRef.current = null;
        }
      } else if (document.visibilityState === "visible") {
        setupMsgChannel();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
        msgChannelRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", setupMsgChannel);

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      msgChannelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", setupMsgChannel);
    };
  }, [ride?.id]);

  useEffect(() => {
    if (incomingMessage) {
      const timer = setTimeout(() => setIncomingMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingMessage]);

  const handleSendQuickMessage = async (text: string) => {
    setLastSentPhrase(text);
    if (ride?.id) {
      try {
        if (msgChannelRef.current) {
          await msgChannelRef.current.send({
            type: 'broadcast',
            event: 'quick_message',
            payload: { text, from: 'prestador', ts: Date.now() }
          });
        } else {
          const channel = supabase
            .channel(`ride_msg_${ride.id}`)
            .on('broadcast', { event: 'quick_message' }, () => {})
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                channel.send({
                  type: 'broadcast',
                  event: 'quick_message',
                  payload: { text, from: 'prestador', ts: Date.now() }
                });
              }
            });
        }
      } catch (e) {
        console.warn("Falha ao transmitir mensagem do prestador:", e);
      }
    }
  };

  useEffect(() => {
    if (phase === "completed" && isPaymentConfirmed) {
      const timer = setTimeout(() => {
        sessionStorage.removeItem("ubt_active_ride");
        navigate("/app/prestador/home");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase, isPaymentConfirmed, navigate]);

  // Carregar dados da corrida do banco
  useEffect(() => {
    const loadRideFromDb = async (rideId: string) => {
      try {
        const { data, error } = await supabase
          .from('mototaxi_corridas')
          .select('*')
          .eq('id', rideId)
          .maybeSingle();

        if (error) {
          console.warn("[PrestadorMototaxiActive] Aviso ao carregar corrida (possível timeout/504):", error.message);
          return;
        }

        if (data) {
          const originObj = typeof data.origin === 'string' ? JSON.parse(data.origin) : data.origin;
          const destObj = typeof data.destination === 'string' ? JSON.parse(data.destination) : data.destination;
          setRide({
            id: data.id,
            type: data.type,
            origin: originObj?.address || 'Origem',
            destination: destObj?.address || 'Destino',
            distanceKm: Number(data.distance_km || 0),
            durationMin: data.duration_min || 0,
            price: Number(data.estimated_price || 0),
            originCoords: { lat: Number(originObj?.lat || UBATUBA.lat), lng: Number(originObj?.lng || UBATUBA.lng) },
            destinationCoords: { lat: Number(destObj?.lat || UBATUBA.lat), lng: Number(destObj?.lng || UBATUBA.lng) },
            paymentMethod: data.payment_method,
            startTime: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
            created_at: data.created_at,
          });
          if (data.payment_method) {
            setPaymentMethodSelected(data.payment_method);
          }
          if (data.status === 'in_progress') {
            setPhase("in_progress");
          } else if (data.status === 'completed') {
            setPhase("completed");
          } else if (data.status === 'paid') {
            setPhase("completed");
            setIsPaymentConfirmed(true);
          }
        }
      } catch (err: any) {
        console.warn("[PrestadorMototaxiActive] Falha de rede ao consultar corrida (resiliente):", err?.message || err);
      }
    };

    const stored = sessionStorage.getItem("ubt_active_ride");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setRide((prev) => prev || {
            ...parsed,
            startTime: parsed?.startTime || (parsed?.created_at ? new Date(parsed.created_at).getTime() : Date.now()),
          });
          loadRideFromDb(parsed.id);
        }
      } catch { /* noop */ }
    } else {
      // fallback
      setRide({
        id: "ride-001",
        type: "carona",
        origin: "Rua das Toninhas, 120",
        destination: "Praia Grande, Quiosque 8",
        distanceKm: 3.4,
        durationMin: 11,
        price: 12.5,
        originCoords: ORIGIN,
        destinationCoords: DESTINATION,
        startTime: Date.now(),
      });
    }
  }, []);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    let id: number | null = null;
    try {
      id = navigator.geolocation.watchPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    } catch { /* noop */ }
    return () => {
      if (id !== null && navigator.geolocation) navigator.geolocation.clearWatch(id);
    };
  }, []);

  const activeSessionIdRef = useRef<string | null>(null);

  // Sincronizar sessão GPS no Supabase com lógica Select-First e Resiliência a Conflito (409)
  useEffect(() => {
    if (!user.uid || !myLocation) return;
    let isCancelled = false;

    async function syncSession() {
      try {
        let sessionId = activeSessionIdRef.current;

        // 1. Select-First: Se ainda não temos o ID em memória, buscar sessão existente no banco
        if (!sessionId) {
          const { data: existingSession, error: selectErr } = await supabase
            .from('mototaxi_sessoes')
            .select('id, is_online')
            .eq('prestador_id', user.uid)
            .maybeSingle();

          if (!selectErr && existingSession) {
            sessionId = existingSession.id;
            activeSessionIdRef.current = existingSession.id;
          }
        }

        if (sessionId) {
          // 2. Reaproveitamento de sessão fantasma/ativa: Apenas UPDATE
          const { error: updateErr } = await supabase
            .from('mototaxi_sessoes')
            .update({
              is_online: true,
              lat: myLocation.lat,
              lng: myLocation.lng,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          if (updateErr) throw updateErr;
        } else {
          // 3. Nenhuma sessão existente: Inserir nova sessão
          const { data: inserted, error: insertErr } = await supabase
            .from('mototaxi_sessoes')
            .insert({
              prestador_id: user.uid,
              is_online: true,
              lat: myLocation.lat,
              lng: myLocation.lng,
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insertErr) {
            // Tratamento inteligente de conflito (409 Duplicate Key / Unique Constraint)
            console.warn("Conflito ao criar sessão de mototáxi ativo (409). Recuperando sessão ativa...", insertErr);
            const { data: recovered } = await supabase
              .from('mototaxi_sessoes')
              .select('id')
              .eq('prestador_id', user.uid)
              .maybeSingle();

            if (recovered && !isCancelled) {
              activeSessionIdRef.current = recovered.id;
              await supabase
                .from('mototaxi_sessoes')
                .update({
                  is_online: true,
                  lat: myLocation.lat,
                  lng: myLocation.lng,
                  updated_at: new Date().toISOString()
                })
                .eq('id', recovered.id);
            }
          } else if (inserted && !isCancelled) {
            activeSessionIdRef.current = inserted.id;
          }
        }
      } catch (err) {
        console.error("Erro na sincronização de sessão mototáxi ativa:", err);
      }
    }

    syncSession();

    return () => {
      isCancelled = true;
    };
  }, [user.uid, myLocation]);

  // Escutar cancelamento da corrida pelo passageiro
  useEffect(() => {
    if (!ride?.id) return;

    let channel: any = null;

    const setupRideChannel = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      channel = supabase
        .channel(`active_ride_${ride.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mototaxi_corridas', filter: `id=eq.${ride.id}` },
          (payload: any) => {
            if (payload.new) {
              if (payload.new.status === 'cancelled') {
                alert('A corrida foi cancelada pelo passageiro.');
                sessionStorage.removeItem("ubt_active_ride");
                navigate("/app/prestador/home");
              } else if (payload.new.status === 'paid') {
                setIsPaymentConfirmed(true);
              }
              if (payload.new.payment_method) {
                setPaymentMethodSelected(payload.new.payment_method);
              }
            }
          }
        )
        .subscribe();
    };

    setupRideChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
          channel = null;
        }
      } else if (document.visibilityState === "visible") {
        setupRideChannel();
      }
    };

    const handlePageHide = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channel = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", setupRideChannel);

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", setupRideChannel);
    };
  }, [ride?.id, navigate]);

  if (!ride) return null;

  const startRide = async () => {
    try {
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({ status: 'in_progress' })
        .eq('id', ride.id);
      if (error) throw error;
      setPhase("in_progress");
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar corrida.');
    }
  };

  const completeRide = async () => {
    try {
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({ status: 'completed', final_price: ride.price })
        .eq('id', ride.id);
      if (error) throw error;
      setPhase("completed");
    } catch (e) {
      console.error(e);
      alert('Erro ao concluir corrida.');
    }
  };

  const handleConfirmCashOrManualPaid = async () => {
    if (!ride?.id) return;
    setIsConfirmingCash(true);
    try {
      const { error } = await supabase
        .from('mototaxi_corridas')
        .update({ status: 'paid' })
        .eq('id', ride.id);
      if (error) {
        console.error("Erro Supabase PATCH:", error.message, error.details, error.hint);
        throw error;
      }
      setIsPaymentConfirmed(true);
    } catch (e: any) {
      console.error("Erro ao confirmar pagamento manual/dinheiro:", e?.message || e);
      alert("Erro ao confirmar recebimento.");
    } finally {
      setIsConfirmingCash(false);
    }
  };

  const finalize = () => {
    sessionStorage.removeItem("ubt_active_ride");
    navigate("/app/prestador/home");
  };

  /* ---------------- COMPLETED ---------------- */
  if (phase === "completed") {
    const youReceive = (ride.price || 0) * 0.9;
    const split = calcSplit(ride.price || 0);
    const pixPayload = `00020126580014BR.GOV.BCB.PIX0136ubt.pagamentos@ubatuba.sp.gov.br520400005303986540${(ride.price || 0).toFixed(2)}5802BR5913UBT SERVICOS6007UBATUBA62070503***6304`;

    return (
      <div
        className="min-h-[100svh] overflow-y-auto text-zinc-100 relative overflow-hidden"
        style={{ background: "var(--prestador-bg)", padding: 24, paddingBottom: 96 }}
      >
        {isPaymentConfirmed && <Confetti numberOfPieces={250} recycle={false} />}
        <div className="text-center pt-4">
          <CheckCircle2 size={48} color="#0DB87E" className="mx-auto" />
          <h1 className="mt-3 font-display text-[22px] font-bold text-white">
            {isPaymentConfirmed ? "Corrida Paga e Concluída!" : "Serviço finalizado!"}
          </h1>
          {!isPaymentConfirmed && (
            <p className="mt-1 font-sans text-[13px] text-[#F5A623] flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
              Aguardando pagamento do passageiro...
            </p>
          )}
        </div>

        {/* PAYMENT METHOD ACTIVE DISPLAY ON PRESTADOR */}
        {!isPaymentConfirmed && (
          <div className="mt-4">
            {paymentMethodSelected === "pix_scanner" && (
              <div className="rounded-2xl p-5 bg-zinc-900/90 border border-[#0DB87E]/40 text-center flex flex-col items-center shadow-xl">
                <div className="w-12 h-12 rounded-full bg-[#0DB87E]/20 flex items-center justify-center mb-2">
                  <Scan size={24} className="text-[#0DB87E]" />
                </div>
                <h2 className="font-display text-[16px] font-bold text-white">Pix Scanner Solicitado</h2>
                <p className="font-sans text-[12px] text-white/70 mt-1 mb-3">
                  Apresente este QR Code para o passageiro ler no aplicativo do banco dele:
                </p>

                {isPixLoading || (!pixQrBase64 && !pixCopiaColaCode) ? (
                  <div className="w-[180px] h-[180px] rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center p-4">
                    <span className="w-8 h-8 rounded-full border-2 border-[#0DB87E] border-t-transparent animate-spin mb-3" />
                    <p className="font-sans text-[12px] text-white/70 text-center">Gerando QR Code no Mercado Pago...</p>
                  </div>
                ) : pixQrBase64 ? (
                  <div className="bg-white p-3.5 rounded-2xl shadow-2xl">
                    <img src={`data:image/png;base64,${pixQrBase64}`} alt="QR Code Pix Dinâmico" className="w-[180px] h-[180px] object-contain mx-auto" />
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-2xl shadow-2xl">
                    <QRCodeSVG value={pixCopiaColaCode || pixPayload} size={180} level="M" />
                  </div>
                )}

                <p className="mt-3 font-display text-[20px] font-bold text-[#0DB87E]">
                  {formatBRL(ride.price || 0)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const codeToCopy = pixCopiaColaCode || pixPayload;
                    navigator.clipboard.writeText(codeToCopy);
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 3000);
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-sans text-[12px] flex items-center gap-2 active:scale-95 transition-all"
                >
                  {copiedPix ? <Check size={14} className="text-[#0DB87E]" /> : <Copy size={14} />}
                  {copiedPix ? "Código Pix Copiado!" : "Copiar Chave Copia e Cola"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCashOrManualPaid}
                  className="mt-4 w-full h-11 rounded-xl bg-[#0DB87E] font-display font-semibold text-white active:scale-98 transition-all"
                >
                  Confirmar que o Pix foi Pago
                </button>
              </div>
            )}

            {(paymentMethodSelected === "cash" || paymentMethodSelected === "dinheiro") && (
              <div className="rounded-2xl p-5 bg-amber-500/10 border border-amber-500/30 text-center shadow-xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                  <Banknote size={24} className="text-[#F5A623]" />
                </div>
                <h2 className="font-display text-[16px] font-bold text-white">Pagamento em Dinheiro</h2>
                <p className="font-sans text-[13px] text-white/80 mt-1">
                  Receba <strong>{formatBRL(ride.price || 0)}</strong> em mãos do passageiro.
                </p>
                <button
                  type="button"
                  disabled={isConfirmingCash}
                  onClick={handleConfirmCashOrManualPaid}
                  className="mt-4 w-full h-12 rounded-xl bg-[#0DB87E] font-display font-semibold text-white shadow-lg active:scale-98 transition-all"
                >
                  {isConfirmingCash ? "Confirmando..." : `Confirmar Recebimento em Dinheiro (${formatBRL(ride.price || 0)})`}
                </button>
              </div>
            )}

            {(paymentMethodSelected === "pix_checkout" || paymentMethodSelected === "pix") && (
              <div className="rounded-2xl p-4 bg-zinc-900/90 border border-white/10 text-center shadow-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                  <Smartphone size={20} className="text-blue-400" />
                </div>
                <p className="font-display text-[14px] font-bold text-white">Pix no Celular do Passageiro</p>
                <p className="font-sans text-[12px] text-white/60 mt-1">
                  O passageiro está efetuando o Pix direto no smartphone dele.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-amber-400 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Aguardando confirmação do gateway...
                </div>
              </div>
            )}

            {(paymentMethodSelected === "card" || paymentMethodSelected === "cartao" || paymentMethodSelected === "credit_card") && (
              <div className="rounded-2xl p-4 bg-zinc-900/90 border border-white/10 text-center shadow-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                  <CreditCard size={20} className="text-purple-400" />
                </div>
                <p className="font-display text-[14px] font-bold text-white">Cartão de Crédito</p>
                <p className="font-sans text-[12px] text-white/60 mt-1">
                  O passageiro está processando o pagamento via Cartão.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-amber-400 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Aguardando confirmação da operadora...
                </div>
              </div>
            )}

            {!paymentMethodSelected && (
              <div className="rounded-2xl p-4 bg-zinc-900/90 border border-white/10 text-center">
                <p className="font-sans text-[13px] text-white/70">
                  Aguardando o passageiro escolher a forma de pagamento...
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-2 text-[#F5A623] text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
                  Sincronizando em tempo real
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="mt-5 rounded-2xl text-center"
          style={{ background: "var(--prestador-card)", padding: 20, border: "1px solid var(--prestador-border)" }}
        >
          <p className="font-sans text-[13px]" style={{ color: "#9399AD" }}>Você recebeu</p>
          <p className="mt-1 font-display text-[28px] font-bold" style={{ color: "#0DB87E" }}>
            {formatBRL(youReceive)}
          </p>

          <div className="my-3 h-px" style={{ background: "var(--prestador-border)" }} />

          <div className="space-y-1.5 text-left">
            {SPLIT_META.map((m) => {
              const Icon = ICONS[m.icon as IconKey];
              const value = split[m.key];
              const isPrest = m.key === "prestador";
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <Icon size={14} style={{ color: m.color }} />
                  <span className="font-sans text-[12px] flex-1" style={{ color: "#A1A1AA" }}>
                    {m.label}
                  </span>
                  <span
                    className="font-sans text-[12px]"
                    style={{ color: isPrest ? "#0DB87E" : "#A1A1AA", fontWeight: isPrest ? 600 : 400 }}
                  >
                    {formatBRL(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-sans text-[14px] font-semibold text-white">
            Como foi o cliente?
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`Nota ${i}`}>
                <Star
                  size={32}
                  fill={i <= rating ? "#F5A623" : "transparent"}
                  color={i <= rating ? "#F5A623" : "#D8DBE5"}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentário opcional..."
            rows={4}
            className="mt-4 w-full rounded-xl outline-none font-sans text-[14px] resize-none"
            style={{
              background: "var(--prestador-card)",
              border: "1px solid var(--prestador-border)",
              padding: "12px 14px",
              color: "#FFFFFF",
              minHeight: 100,
            }}
          />
        </div>

        <div className="mt-5">
          <PrimaryButtonLight onClick={finalize}>
            Enviar e voltar ao trabalho
          </PrimaryButtonLight>
        </div>
      </div>
    );
  }

  /* ---------------- ARRIVING / IN_PROGRESS ---------------- */
  const routeFrom = phase === "arriving" ? myLocation : (ride.originCoords || ORIGIN);
  const routeTo = phase === "arriving" ? (ride.originCoords || ORIGIN) : (ride.destinationCoords || DESTINATION);

  return (
    <div className="relative min-h-[100svh] text-zinc-100" style={{ background: "var(--prestador-bg)" }}>
      {/* Floating incoming quick message banner */}
      {incomingMessage && (
        <div
          className="fixed top-4 left-4 right-4 z-[1200] max-w-md mx-auto p-3.5 rounded-2xl bg-zinc-900/95 border border-[#0DB87E] shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
          onClick={() => setIncomingMessage(null)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0DB87E]/20 border border-[#0DB87E]/40 flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-[#0DB87E]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#0DB87E] uppercase tracking-wider">{incomingMessage.sender}</p>
              <p className="text-[13px] font-medium text-white">{incomingMessage.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIncomingMessage(null);
            }}
            className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      <div className="absolute inset-0">
        <PrestadorMapLight
          myLocation={myLocation}
          origin={ride.originCoords || ORIGIN}
          destination={phase === "in_progress" ? (ride.destinationCoords || DESTINATION) : null}
          routeFrom={routeFrom}
          routeTo={routeTo}
        />
      </div>

      <Sheet>
        {phase === "arriving" ? (
          <>
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-sans text-[12px] font-semibold"
              style={{ background: "rgba(13,184,126,0.15)", border: "1px solid #0DB87E", color: "#0DB87E" }}
            >
              A caminho do cliente
            </span>

            <div className="mt-3 flex items-start gap-2">
              <Navigation size={16} color="#0DB87E" className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-semibold text-white">
                  {ride.origin}
                </p>
                <p className="font-sans text-[13px]" style={{ color: "#A1A1AA" }}>
                  ~{ride.durationMin} min
                </p>
              </div>
            </div>

            {(() => {
              const pName = ride.passengerName || "Passageiro(a)";
              const pInitials = pName
                .split(" ")
                .filter(Boolean)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "UB";

              return (
                <div
                  className="mt-3 rounded-xl flex items-center gap-3"
                  style={{ background: "var(--prestador-bg)", padding: 12, border: "1px solid var(--prestador-border)" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center animate-pulse"
                    style={{ background: "rgba(13,184,126,0.15)", color: "#0DB87E" }}
                  >
                    <span className="font-display font-bold text-[14px]">{pInitials}</span>
                  </div>
                  <p className="font-sans text-[14px] font-semibold text-white">
                    {pName}
                  </p>
                </div>
              );
            })()}

            <QuickStatusMessages
              role="prestador"
              onSendMessage={handleSendQuickMessage}
              lastSentPhrase={lastSentPhrase}
              className="mt-3"
            />

            <div className="mt-4">
              <PrimaryButtonLight onClick={startRide}>
                Cheguei ao ponto de embarque
              </PrimaryButtonLight>
            </div>
          </>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-sans text-[12px] font-semibold"
              style={{ background: "rgba(13,184,126,0.15)", border: "1px solid #0DB87E", color: "#0DB87E" }}
            >
              Em andamento
            </span>

            <div className="mt-3 flex items-start gap-2">
              <MapPin size={16} color="#E84040" className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-semibold text-white">
                  {ride.destination}
                </p>
                <p className="font-sans text-[13px]" style={{ color: "#A1A1AA" }}>
                  ~{ride.durationMin} min
                </p>
              </div>
            </div>

            <QuickStatusMessages
              role="prestador"
              onSendMessage={handleSendQuickMessage}
              lastSentPhrase={lastSentPhrase}
              className="mt-3"
            />

            <div className="mt-4">
              <PrimaryButtonLight onClick={completeRide}>
                Concluir serviço
              </PrimaryButtonLight>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
};

export default PrestadorMototaxiActive;
