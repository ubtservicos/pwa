import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Navigation, MapPin, CheckCircle2, Star, MessageSquare,
  User as UserIcon, Building2, Users, Gift, Heart,
  Scan, CreditCard, Copy, Check, QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import PrestadorMapLight from "@/components/prestador/PrestadorMapLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { FullscreenConfetti } from "@/components/ui/FullscreenConfetti";
import { calcSplit, formatBRL, SPLIT_META } from "@/utils/ride";
import {
  fetchGatewayFeeSettings,
  calculatePaymentWithFee,
  DEFAULT_FEE_SETTINGS,
  type GatewayFeeSettings,
} from "@/services/FinancialFeeService";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import QuickStatusMessages from "@/components/mototaxi/QuickStatusMessages";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { useMototaxiQuickMessages } from "@/hooks/useMototaxiQuickMessages";
import { RidePaymentSummary } from "@/components/mototaxi/RidePaymentSummary";

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
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  pixPaymentId?: string;
  pixChargeStatus?: string;
  pixChargeExpiresAt?: string;
  startTime?: number | string;
  created_at?: string;
}

function hasValidActivePixCharge(
  copyPaste?: string | null,
  chargeStatus?: string | null,
  expiresAt?: string | null,
): boolean {
  if (!String(copyPaste || "").trim()) return false;
  const normalizedStatus = String(chargeStatus || "pending").toLowerCase();
  if (["rejected", "cancelled", "expired", "failed"].includes(normalizedStatus)) return false;
  if (expiresAt) {
    const expTime = new Date(expiresAt).getTime();
    if (Number.isFinite(expTime) && expTime <= Date.now() + 15_000) return false;
  }
  return true;
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
  const { id: routeRideId } = useParams<{ id?: string }>();
  const user = useCurrentUser();
  const [phase, setPhase] = useState<Phase>("arriving");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number }>(UBATUBA);
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [loadingRide, setLoadingRide] = useState<boolean>(true);
  const [rideLoadError, setRideLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [lastSentPhrase, setLastSentPhrase] = useState<string | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<{ text: string; sender: string } | null>(null);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [paymentMethodSelected, setPaymentMethodSelected] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [feeSettings, setFeeSettings] = useState<GatewayFeeSettings>(DEFAULT_FEE_SETTINGS);
  const [pixQrBase64, setPixQrBase64] = useState<string>("");
  const [pixCopiaColaCode, setPixCopiaColaCode] = useState<string>("");
  const [pixChargeStatus, setPixChargeStatus] = useState<string | null>(null);
  const [pixChargeExpiresAt, setPixChargeExpiresAt] = useState<string | null>(null);
  const [isPixLoading, setIsPixLoading] = useState<boolean>(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState<boolean>(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const paidNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPixTriggeredRef = useRef<string | null>(null);
  const pixInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    fetchGatewayFeeSettings().then(setFeeSettings);
  }, []);
  const mototaxiChat = useMototaxiQuickMessages(ride?.id, "prestador", (message) => {
    setIncomingMessage({ text: message.text, sender: "Passageiro(a)" });
  });

  useEffect(() => {
    if (incomingMessage) {
      const timer = setTimeout(() => setIncomingMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingMessage]);

  const handleSendQuickMessage = async (text: string) => {
    try {
      await mototaxiChat.sendMessage(text);
      setLastSentPhrase(text);
    } catch (error) {
      console.warn("Falha ao enviar mensagem do prestador:", error);
    }
  };

  // Carregar dados da corrida do banco (ou recuperar corrida ativa do prestador)
  const loadActiveRide = useCallback(async () => {
    setLoadingRide(true);
    setRideLoadError(null);
    const loadRideFromDb = async (rideId: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('mototaxi_corridas')
          .select('*')
          .eq('id', rideId)
          .maybeSingle();

        if (error) {
          console.warn("[PrestadorMototaxiActive] Aviso ao carregar corrida:", error.message);
          setRideLoadError("Não foi possível carregar os detalhes da corrida agora.");
          return false;
        }

        if (data) {
          const safeParse = (raw: any) => {
            if (!raw) return null;
            if (typeof raw === 'string') {
              try { return JSON.parse(raw); } catch { return { address: raw }; }
            }
            return raw;
          };
          const originObj = safeParse(data.origin);
          const destObj = safeParse(data.destination);
          setRide({
            id: data.id,
            type: data.type === 'entrega' ? 'entrega' : 'carona',
            origin: originObj?.address || 'Origem',
            destination: destObj?.address || 'Destino',
            distanceKm: Number(data.distance_km || 0),
            durationMin: Number(data.duration_min || 5),
            price: Number(data.final_price || data.estimated_price || 0),
            originCoords: { lat: Number(originObj?.lat || UBATUBA.lat), lng: Number(originObj?.lng || UBATUBA.lng) },
            destinationCoords: { lat: Number(destObj?.lat || UBATUBA.lat), lng: Number(destObj?.lng || UBATUBA.lng) },
            paymentMethod: data.payment_method,
            pixCopyPaste: data.pix_copy_paste || undefined,
            pixQrCodeBase64: data.pix_qr_code_base64 || undefined,
            pixPaymentId: data.pix_payment_id || undefined,
            pixChargeStatus: data.pix_charge_status || undefined,
            pixChargeExpiresAt: data.pix_charge_expires_at || undefined,
            startTime: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
            created_at: data.created_at,
          });
          if (data.payment_method) setPaymentMethodSelected(data.payment_method);
          if (data.pix_copy_paste) setPixCopiaColaCode(data.pix_copy_paste);
          if (data.pix_qr_code_base64) setPixQrBase64(data.pix_qr_code_base64);
          if (data.pix_charge_status) setPixChargeStatus(data.pix_charge_status);
          if (data.pix_charge_expires_at) setPixChargeExpiresAt(data.pix_charge_expires_at);
          if (data.status === 'in_progress') {
            setPhase("in_progress");
          } else if (data.status === 'completed') {
            setPhase("completed");
          } else if (data.status === 'paid') {
            setPhase("completed");
            setIsPaymentConfirmed(true);
          } else {
            setPhase("arriving");
          }
          return true;
        }
        return false;
      } catch (err: any) {
        console.warn("[PrestadorMototaxiActive] Falha de rede ao consultar corrida:", err?.message || err);
        setRideLoadError("Falha de conexão ao buscar a corrida.");
        return false;
      }
    };

    try {
      if (routeRideId) {
        const ok = await loadRideFromDb(routeRideId);
        if (ok) {
          setLoadingRide(false);
          return;
        }
      }

      const stored = sessionStorage.getItem("ubt_active_ride");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            setRide((prev) => prev || {
              ...parsed,
              price: Number(parsed.price || parsed.final_price || parsed.estimated_price || 0),
              distanceKm: Number(parsed.distanceKm || parsed.distance_km || 0),
              durationMin: Number(parsed.durationMin || parsed.duration_min || 5),
              startTime: parsed?.startTime || (parsed?.created_at ? new Date(parsed.created_at).getTime() : Date.now()),
            });
            await loadRideFromDb(parsed.id);
            setLoadingRide(false);
            return;
          }
        } catch { /* noop */ }
      }

      // Fallback: buscar última corrida ativa deste prestador diretamente no banco
      if (user.uid) {
        const { data: activeRow } = await supabase
          .from('mototaxi_corridas')
          .select('id')
          .eq('prestador_id', user.uid)
          .in('status', ['accepted', 'arriving', 'in_progress', 'completed'])
          .order('accepted_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (activeRow?.id) {
          await loadRideFromDb(activeRow.id);
          setLoadingRide(false);
          return;
        }
      }

      if (!user.isLoading) {
        setRideLoadError("Nenhuma corrida ativa encontrada para sua conta.");
      }
    } finally {
      setLoadingRide(false);
    }
  }, [routeRideId, user.uid, user.isLoading]);

  useEffect(() => {
    void loadActiveRide();
  }, [loadActiveRide]);

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

  const transitionToPaid = useCallback((rideId: string) => {
    setIsPaymentConfirmed(true);
    if (paidNavigationTimerRef.current) return;
    paidNavigationTimerRef.current = setTimeout(() => {
      navigate(`/app/prestador/mototaxi/avaliacao/${rideId}`);
    }, 1800);
  }, [navigate]);

  useEffect(() => () => {
    if (paidNavigationTimerRef.current) clearTimeout(paidNavigationTimerRef.current);
  }, []);

  const handleRideUpdate = useCallback((payload: any) => {
    const updated = payload.new;
    if (!updated) return;
    if (updated.status === 'cancelled') {
      alert('A corrida foi cancelada pelo passageiro.');
      sessionStorage.removeItem("ubt_active_ride");
      navigate("/app/prestador/home");
    } else if (updated.status === 'paid') {
      transitionToPaid(updated.id);
    }
    if (updated.payment_method) setPaymentMethodSelected(updated.payment_method);
    if (updated.pix_copy_paste) {
      setPixCopiaColaCode(updated.pix_copy_paste);
      setIsPixLoading(false);
      setPixError(null);
    }
    if (updated.pix_qr_code_base64) {
      setPixQrBase64(updated.pix_qr_code_base64);
      setIsPixLoading(false);
    }
    if (updated.pix_charge_status) setPixChargeStatus(updated.pix_charge_status);
    if (updated.pix_charge_expires_at) setPixChargeExpiresAt(updated.pix_charge_expires_at);
  }, [navigate, transitionToPaid]);

  useRealtimeChannel(
    ride?.id ? `active_ride_${ride.id}` : null,
    { event: 'UPDATE', table: 'mototaxi_corridas', filter: ride?.id ? `id=eq.${ride.id}` : undefined },
    handleRideUpdate
  );

  // Polling leve garante convergência quando a rede/browser bloquear WebSocket.
  useEffect(() => {
    if (!ride?.id || phase !== "completed" || isPaymentConfirmed) return;
    const checkPayment = async () => {
      if (document.hidden) return;
      const { data } = await supabase
        .from('mototaxi_corridas')
        .select('status, payment_method, pix_copy_paste, pix_qr_code_base64, pix_charge_status, pix_charge_expires_at')
        .eq('id', ride.id)
        .maybeSingle();
      if (data?.status === 'paid') {
        transitionToPaid(ride.id);
      }
      if (data?.payment_method) setPaymentMethodSelected(data.payment_method);
      if (data?.pix_copy_paste) setPixCopiaColaCode(data.pix_copy_paste);
      if (data?.pix_qr_code_base64) setPixQrBase64(data.pix_qr_code_base64);
      if (data?.pix_charge_status) setPixChargeStatus(data.pix_charge_status);
      if (data?.pix_charge_expires_at) setPixChargeExpiresAt(data.pix_charge_expires_at);
    };
    void checkPayment();
    const timer = window.setInterval(checkPayment, 5000);
    return () => window.clearInterval(timer);
  }, [ride?.id, phase, isPaymentConfirmed, transitionToPaid]);

  const pixFeeCalc = calculatePaymentWithFee(ride?.price || 0, "pix", feeSettings);
  const activePixValid = hasValidActivePixCharge(pixCopiaColaCode, pixChargeStatus, pixChargeExpiresAt);

  const generatePixCharge = useCallback(async (forceRetry = false) => {
    if (!ride?.id || !user.uid || isPixLoading || pixInFlightRef.current) return;
    if (!forceRetry && hasValidActivePixCharge(pixCopiaColaCode, pixChargeStatus, pixChargeExpiresAt)) {
      return;
    }
    pixInFlightRef.current = true;
    setIsPixLoading(true);
    setPixError(null);
    const paymentAttemptId = crypto.randomUUID();
    const totalPixAmount = calculatePaymentWithFee(ride.price || 0, "pix", feeSettings).totalAmount;
    try {
      const { data, error } = await supabase.functions.invoke("payment-gateway", {
        body: {
          action: "create_mototaxi_pix_charge",
          service_type: "mototaxi",
          service_id: ride.id,
          provider_id: user.uid,
          payment_attempt_id: paymentAttemptId,
          transaction_amount: Number(totalPixAmount.toFixed(2)),
          payment_method_id: "pix",
          description: `Corrida UBT Mototáxi ${ride.id.slice(0, 8)}`,
        },
      });

      if (error || !data || data.success === false || data.error) {
        let errorPayload = data as { message?: string; error?: string; details?: any } | null;
        const errorResponse = (error as { context?: Response } | null)?.context;
        if (!errorPayload && errorResponse instanceof Response) {
          errorPayload = await errorResponse.clone().json().catch(() => null);
        }
        const rawDetails = errorPayload?.details;
        const detailText = Array.isArray(rawDetails)
          ? rawDetails.map((d: any) => d?.description || d?.message).filter(Boolean).join(" · ")
          : (rawDetails?.message || rawDetails?.code || "");
        const primaryMsg = String(errorPayload?.message || errorPayload?.error || error?.message || "")
          .replace(/rendernull\b/gi, "render")
          .trim();
        const message = primaryMsg || detailText || "Não foi possível gerar a cobrança Pix.";
        throw new Error(message);
      }

      const copyPaste = String(data?.pix?.qr_code || "").trim();
      if (!copyPaste) throw new Error("O Mercado Pago não devolveu o código Pix.");
      const expiresAt = data?.pix?.date_of_expiration ? String(data.pix.date_of_expiration) : null;
      const chargeStatus = String(data?.pix?.status || data?.status || "pending");
      setPaymentMethodSelected("pix");
      setPixCopiaColaCode(copyPaste);
      setPixQrBase64(String(data?.pix?.qr_code_base64 || ""));
      setPixChargeStatus(chargeStatus);
      setPixChargeExpiresAt(expiresAt);
      setRide((current) => current ? {
        ...current,
        paymentMethod: "pix",
        pixCopyPaste: copyPaste,
        pixQrCodeBase64: String(data?.pix?.qr_code_base64 || ""),
        pixPaymentId: String(data?.pix?.payment_id || data?.payment_id || ""),
        pixChargeStatus: chargeStatus,
        pixChargeExpiresAt: expiresAt || undefined,
      } : current);
    } catch (error: any) {
      const message = error?.message || "Erro ao gerar cobrança Pix.";
      setPixError(message);
      console.error("[PrestadorMototaxiActive] Falha ao gerar Pix:", error);
    } finally {
      pixInFlightRef.current = false;
      setIsPixLoading(false);
    }
  }, [ride?.id, ride?.price, user.uid, isPixLoading, pixCopiaColaCode, pixChargeStatus, pixChargeExpiresAt, feeSettings]);

  // Dispara automaticamente o QR Code PIX assim que a corrida termina e o passageiro escolhe PIX
  useEffect(() => {
    if (
      !ride?.id ||
      !user.uid ||
      phase !== "completed" ||
      isPaymentConfirmed ||
      paymentMethodSelected !== "pix" ||
      activePixValid ||
      isPixLoading ||
      pixError
    ) {
      return;
    }
    if (autoPixTriggeredRef.current === ride.id) return;
    autoPixTriggeredRef.current = ride.id;
    void generatePixCharge(false);
  }, [
    ride?.id,
    user.uid,
    phase,
    isPaymentConfirmed,
    paymentMethodSelected,
    activePixValid,
    isPixLoading,
    pixError,
    generatePixCharge,
  ]);

  const verifyPixPaymentNow = useCallback(async () => {
    if (!ride?.id || isCheckingPayment) return;
    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-gateway", {
        body: {
          action: "check_mototaxi_pix_status",
          service_id: ride.id,
        },
      });
      if (error) {
        console.warn("[PrestadorMototaxiActive] Erro ao verificar pagamento PIX:", error);
        return;
      }
      if (data?.paid || data?.status === "approved") {
        transitionToPaid(ride.id);
      } else if (data?.status && ["rejected", "cancelled", "expired"].includes(String(data.status).toLowerCase())) {
        setPixChargeStatus(String(data.status));
        setPixError("A cobrança PIX expirou ou foi cancelada. Gere um novo QR Code.");
      }
    } catch (err) {
      console.warn("[PrestadorMototaxiActive] Exceção ao verificar PIX:", err);
    } finally {
      setIsCheckingPayment(false);
    }
  }, [ride?.id, isCheckingPayment, transitionToPaid]);

  if (!ride) {
    return (
      <div className="min-h-[100svh] bg-[#09090B] text-zinc-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm rounded-2xl bg-[#121215] border border-zinc-800 p-6 text-center shadow-2xl space-y-4">
          {loadingRide ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#00E676] border-t-transparent animate-spin" />
              <div>
                <h2 className="text-base font-bold text-white">Carregando corrida...</h2>
                <p className="text-xs text-zinc-400 mt-1">Sincronizando dados da corrida aceita.</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-white">Corrida não encontrada</h2>
              <p className="text-xs text-zinc-400">
                {rideLoadError || "Não foi possível carregar os dados desta corrida."}
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => void loadActiveRide()}
                  className="w-full py-3 rounded-xl bg-[#00E676] text-black font-bold text-sm cursor-pointer"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/app/prestador/mototaxi/online")}
                  className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold text-sm cursor-pointer"
                >
                  Voltar para Online
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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

  const finalize = () => {
    sessionStorage.removeItem("ubt_active_ride");
    navigate("/app/prestador/home");
  };

  /* ---------------- COMPLETED ---------------- */
  if (phase === "completed") {
    const split = calcSplit(ride.price || 0);
    const youReceive = split.prestador;
    const formatPct = (pct: number) => `${pct.toFixed(2).replace(".", ",")}%`;
    return (
      <div
        className="min-h-[100svh] overflow-y-auto text-zinc-100 relative overflow-hidden"
        style={{ background: "var(--prestador-bg)", padding: 24, paddingBottom: 96 }}
      >
        {isPaymentConfirmed && <FullscreenConfetti numberOfPieces={250} />}
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
            {activePixValid && (
              <div className="rounded-2xl p-5 bg-zinc-900/90 border border-[#0DB87E]/40 text-center flex flex-col items-center shadow-xl">
                <div className="w-12 h-12 rounded-full bg-[#0DB87E]/20 flex items-center justify-center mb-2">
                  <Scan size={24} className="text-[#0DB87E]" />
                </div>
                <h2 className="font-display text-[16px] font-bold text-white">QR Code Pix pronto</h2>
                <p className="font-sans text-[12px] text-white/70 mt-1 mb-3">
                  Apresente este QR Code para o passageiro escanear diretamente no celular dele:
                </p>

                {isPixLoading || (!pixQrBase64 && !pixCopiaColaCode) ? (
                  <div className="w-[180px] h-[180px] rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center p-4">
                    <span className="w-8 h-8 rounded-full border-2 border-[#0DB87E] border-t-transparent animate-spin mb-3" />
                    <p className="font-sans text-[12px] text-white/70 text-center">Gerando QR Code no Mercado Pago...</p>
                  </div>
                ) : pixQrBase64 ? (
                  <div className="bg-white p-3.5 rounded-2xl shadow-2xl">
                    <img
                      src={pixQrBase64.startsWith("data:image/") ? pixQrBase64 : `data:image/png;base64,${pixQrBase64}`}
                      alt="QR Code Pix dinâmico para pagamento da corrida"
                      className="w-[220px] h-[220px] object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-2xl shadow-2xl">
                    <QRCodeSVG value={pixCopiaColaCode} size={200} level="M" />
                  </div>
                )}

                <p className="mt-3 font-display text-[22px] font-bold text-[#0DB87E]">
                  {formatBRL(pixFeeCalc.totalAmount)}
                </p>
                <p className="font-sans text-[11px] text-white/60 mt-0.5">
                  Corrida {formatBRL(pixFeeCalc.basePrice)} + taxa PIX {formatPct(pixFeeCalc.feePct)} ({formatBRL(pixFeeCalc.feeAmount)}) paga pelo passageiro
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixCopiaColaCode);
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 3000);
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-sans text-[12px] flex items-center gap-2 active:scale-95 transition-all"
                >
                  {copiedPix ? <Check size={14} className="text-[#0DB87E]" /> : <Copy size={14} />}
                  {copiedPix ? "Código Pix Copiado!" : "Copiar Chave Copia e Cola"}
                </button>
                <div className="mt-4 flex items-center justify-center gap-2 text-amber-400 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Aguardando confirmação automática do Mercado Pago...
                </div>
                <button
                  type="button"
                  disabled={isCheckingPayment}
                  onClick={() => void verifyPixPaymentNow()}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#0DB87E]/15 hover:bg-[#0DB87E]/25 border border-[#0DB87E]/40 text-[#0DB87E] font-sans text-[12px] font-semibold disabled:opacity-60 transition-all"
                >
                  {isCheckingPayment ? "Consultando Mercado Pago..." : "Verificar pagamento agora"}
                </button>
              </div>
            )}

            {!activePixValid && paymentMethodSelected === "pix" && (
              <div className="rounded-2xl p-5 bg-zinc-900/90 border border-[#0DB87E]/30 text-center shadow-xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#0DB87E]/20 flex items-center justify-center mb-3">
                  <QrCode size={24} className="text-[#0DB87E]" />
                </div>
                <h2 className="font-display text-[16px] font-bold text-white">Cobrança Pix presencial</h2>
                <p className="font-sans text-[12px] text-white/65 mt-1 mb-4">
                  {isPixLoading
                    ? "Gerando automaticamente o QR Code Pix no Mercado Pago..."
                    : "Gere o QR Code para o passageiro escanear. O código Copia e Cola também aparece automaticamente no celular dele."}
                </p>
                <button
                  type="button"
                  disabled={isPixLoading}
                  onClick={() => void generatePixCharge(true)}
                  className="w-full h-12 rounded-xl bg-[#0DB87E] disabled:opacity-60 font-display font-semibold text-white shadow-lg active:scale-98 transition-all"
                >
                  {isPixLoading
                    ? "Gerando cobrança..."
                    : pixError
                      ? `Tentar Gerar Cobrança Pix (${formatBRL(pixFeeCalc.totalAmount)})`
                      : `Gerar Cobrança Pix (${formatBRL(pixFeeCalc.totalAmount)})`}
                </button>
                {pixError && <p className="mt-3 text-[12px] text-red-300">{pixError}</p>}
              </div>
            )}

            {(paymentMethodSelected === "card" || paymentMethodSelected === "cartao" || paymentMethodSelected === "credit_card") && (
              <div className="rounded-2xl p-4 bg-zinc-900/90 border border-white/10 text-center shadow-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                  <CreditCard size={20} className="text-purple-400" />
                </div>
                <p className="font-display text-[14px] font-bold text-white">Cartão de Crédito</p>
                <p className="font-sans text-[12px] text-white/60 mt-1">
                  O passageiro está processando o pagamento via Cartão na Wallet.
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
                  Aguardando o passageiro escolher PIX ou Cartão de Crédito...
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-2 text-[#F5A623] text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
                  Assim que ele escolher PIX, o QR Code aparecerá automaticamente aqui
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
          <RidePaymentSummary
            rideId={ride.id}
            origin={ride.origin}
            destination={ride.destination}
            total={ride.price || 0}
          />
          {isPaymentConfirmed && (
            <>
              <p className="font-sans text-[14px] font-semibold text-white">Como foi o cliente?</p>
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
            </>
          )}
        </div>

        {isPaymentConfirmed && (
          <div className="mt-5">
            <PrimaryButtonLight onClick={finalize}>Enviar e voltar ao trabalho</PrimaryButtonLight>
          </div>
        )}
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
              messages={mototaxiChat.messages}
              connectionStatus={mototaxiChat.status}
              isSending={mototaxiChat.isSending}
              error={mototaxiChat.error}
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
              messages={mototaxiChat.messages}
              connectionStatus={mototaxiChat.status}
              isSending={mototaxiChat.isSending}
              error={mototaxiChat.error}
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
