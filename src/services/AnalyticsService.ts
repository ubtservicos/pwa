import { supabase } from "@/lib/supabase";

export type AnalyticsEventName =
  | "landing_view"
  | "landing_cta"
  | "landing_scroll"
  | "landing_contact"
  | "pwa_install_prompt"
  | "pwa_installed"
  | "pwa_open"
  | "signup_started"
  | "signup_completed"
  | "login"
  | "logout"
  | "login_failed"
  | "profile_completed"
  | "kyc_started"
  | "kyc_submitted"
  | "kyc_approved"
  | "kyc_rejected"
  | "request_created"
  | "request_accepted"
  | "request_cancelled"
  | "ride_requested"
  | "ride_accepted"
  | "ride_started"
  | "ride_completed"
  | "ride_cancelled"
  | "booking_requested"
  | "booking_confirmed"
  | "booking_completed"
  | "booking_cancelled"
  | "order_requested"
  | "order_accepted"
  | "order_completed"
  | "order_cancelled"
  | "pickup_requested"
  | "pickup_started"
  | "pickup_completed"
  | "payment_started"
  | "payment_success"
  | "payment_failed"
  | "split_completed"
  | "payout_created"
  | "payout_completed"
  | "refund_requested"
  | "refund_created"
  | "refund_completed"
  | "coupon_used"
  | "referral_used"
  | "notification_sent"
  | "notification_opened"
  | "chat_started"
  | "chat_message"
  | "support_opened"
  | "support_closed";

export type AnalyticsCategory = "operational" | "ux" | "marketing" | "system";

export interface AnalyticsEvent {
  event_name: string;
  event_category: string;
  created_at_utc: string;
  timezone: string;
  session_id: string;
  device_id: string;
  user_id: string | null;
  anonymous_id: string | null;
  platform: string;
  app_version: string;
  origin: string;
  vertical?: string;
  properties: Record<string, any>;
}

const BATCH_SIZE_LIMIT = 20;
const BATCH_TIME_LIMIT_MS = 10000; // 10 segundos

class AnalyticsManager {
  private buffer: AnalyticsEvent[] = [];
  private flushTimeout: any = null;
  private deviceId: string = "";
  private sessionId: string = "";
  private currentUserId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initDeviceAndSession();
      this.listenToAuthChanges();
      this.startFlushTimer();
      window.addEventListener("beforeunload", () => this.flushSync());
    }
  }

  private initDeviceAndSession() {
    try {
      // 1. Device ID Persistente e Anônimo (LGPD compliant)
      let storedDeviceId = localStorage.getItem("ubt_device_id");
      if (!storedDeviceId) {
        storedDeviceId = this.generateUUID();
        localStorage.setItem("ubt_device_id", storedDeviceId);
      }
      this.deviceId = storedDeviceId;

      // 2. Session ID com expiração por inatividade (30 minutos)
      const now = Date.now();
      let activeSessionId = sessionStorage.getItem("ubt_session_id");
      const lastActive = localStorage.getItem("ubt_last_active");
      const isExpired = lastActive ? (now - parseInt(lastActive, 10) > 30 * 60 * 1000) : true;

      if (!activeSessionId || isExpired) {
        activeSessionId = this.generateUUID();
        sessionStorage.setItem("ubt_session_id", activeSessionId);
      }
      this.sessionId = activeSessionId;
      localStorage.setItem("ubt_last_active", now.toString());

      // Atualizar o timestamp de atividade com eventos de clique/teclado
      const updateActivity = () => {
        localStorage.setItem("ubt_last_active", Date.now().toString());
      };
      window.addEventListener("click", updateActivity);
      window.addEventListener("keypress", updateActivity);
    } catch (e) {
      console.warn("Falha ao inicializar Device/Session no Analytics:", e);
      this.deviceId = this.deviceId || "fallback-device";
      this.sessionId = this.sessionId || "fallback-session";
    }
  }

  private generateUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async listenToAuthChanges() {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        this.currentUserId = data.session.user.id;
      }
      supabase.auth.onAuthStateChange((_event, session) => {
        this.currentUserId = session?.user?.id || null;
      });
    } catch (e) {
      console.warn("Erro ao escutar mudanças de autenticação no Analytics:", e);
    }
  }

  private startFlushTimer() {
    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, BATCH_TIME_LIMIT_MS);
  }

  private getOriginSource(): string {
    if (typeof window === "undefined") return "Direct";
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    if (utmSource) return utmSource;

    const referrer = document.referrer;
    if (referrer) {
      if (referrer.includes("instagram.com")) return "Instagram";
      if (referrer.includes("facebook.com")) return "Facebook";
      if (referrer.includes("google.com")) return "Google";
      if (referrer.includes("tiktok.com")) return "TikTok";
      if (referrer.includes("whatsapp.com")) return "WhatsApp";
      return "Referral";
    }

    return "Direct";
  }

  public track(
    eventName: string,
    category: string,
    properties: Record<string, any> = {},
    vertical?: string
  ) {
    try {
      const event: AnalyticsEvent = {
        event_name: eventName,
        event_category: category,
        created_at_utc: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        session_id: this.sessionId,
        device_id: this.deviceId,
        user_id: this.currentUserId,
        anonymous_id: this.deviceId,
        platform: "web_pwa",
        app_version: "1.0.0",
        origin: this.getOriginSource(),
        vertical: vertical || properties.vertical || undefined,
        properties
      };

      this.buffer.push(event);

      if (this.buffer.length >= BATCH_SIZE_LIMIT) {
        this.flush();
      }
    } catch (e) {
      console.warn("Erro ao enfileirar evento de analytics:", e);
    }
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await supabase.from("analytics_events").insert(batch);
      if (error) {
        console.warn("Erro ao fazer flush do lote de analytics:", error.message);
        this.buffer = [...batch, ...this.buffer].slice(0, 100);
      }
    } catch (e) {
      console.warn("Falha de rede ao descarregar analytics buffer:", e);
      this.buffer = [...batch, ...this.buffer].slice(0, 100);
    }
  }

  public flushSync() {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];
    
    // Fallback sync using sendBeacon or standard fetch if supported
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
      const headers = {
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      };
      
      // Constrói o request de beacons
      const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
      try {
        navigator.sendBeacon(url, blob);
      } catch (e) {
        // Fallback fetch
        fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(batch),
          keepalive: true
        }).catch(() => {});
      }
    }
  }
}

let managerInstance: AnalyticsManager | null = null;
const getManager = (): AnalyticsManager => {
  if (!managerInstance) {
    managerInstance = new AnalyticsManager();
  }
  return managerInstance;
};

/**
 * Interface definitiva para registrar eventos de Analytics de forma assíncrona,
 * desacoplada e amortecida por buffer local em lote.
 * Suporta retrocompatibilidade automática com chamadas antigas.
 */
export function trackEvent(
  eventName: string,
  categoryOrProperties: any = "ux",
  propertiesOrUserId: any = {},
  vertical?: string
) {
  setTimeout(() => {
    try {
      let finalCategory: AnalyticsCategory = "ux";
      let finalProperties: Record<string, any> = {};
      const finalVertical = vertical;

      const validCategories: AnalyticsCategory[] = ["operational", "ux", "marketing", "system"];

      if (typeof categoryOrProperties === "string" && validCategories.includes(categoryOrProperties as AnalyticsCategory)) {
        finalCategory = categoryOrProperties as AnalyticsCategory;
        finalProperties = propertiesOrUserId || {};
      } else {
        // Assinatura legada: trackEvent(eventType, metadata, userId)
        finalProperties = categoryOrProperties || {};
        if (
          eventName.includes("signup") || 
          eventName.includes("login") || 
          eventName.includes("pwa_install") ||
          eventName.includes("onboarding")
        ) {
          finalCategory = "ux";
        } else {
          finalCategory = "operational";
        }
      }

      // Normalizar nomes de eventos antigos para a nova especificação
      let finalEventName: AnalyticsEventName = eventName as AnalyticsEventName;
      if (eventName === "order_created") finalEventName = "request_created";
      if (eventName === "order_accepted") finalEventName = "request_accepted";
      if (eventName === "order_cancelled") finalEventName = "request_cancelled";
      if (eventName === "payment_approved") finalEventName = "payment_success";
      if (eventName === "service_completed") finalEventName = "payout_completed";
      if (eventName === "pwa_install_prompted") finalEventName = "pwa_install_prompt";
      if (eventName === "onboarding_started") {
        finalEventName = "landing_view";
        finalProperties = { ...finalProperties, step: "onboarding_started" };
      }
      if (eventName === "onboarding_completed") {
        finalEventName = "profile_completed";
        finalProperties = { ...finalProperties, step: "onboarding_completed" };
      }

      getManager().track(finalEventName, finalCategory, finalProperties, finalVertical);
    } catch (e) {
      console.warn("Erro no pipeline de Analytics:", e);
    }
  }, 0);
}
