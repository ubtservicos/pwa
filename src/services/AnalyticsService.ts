import { supabase } from "@/lib/supabase";
import { logSystem } from "@/services/LoggingService";

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

interface FailedBatch {
  events: AnalyticsEvent[];
  attempts: number;
  nextRetryTime: number;
}

class AnalyticsManager {
  private buffer: AnalyticsEvent[] = [];
  private failedBatches: FailedBatch[] = [];
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

  private isValidUUID(uuid: string | null): boolean {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
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
        await this.updateCurrentUser(data.session.user.id);
      } else {
        this.currentUserId = null;
      }
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user?.id) {
          await this.updateCurrentUser(session.user.id);
        } else {
          this.currentUserId = null;
        }
      });
    } catch (e) {
      console.warn("Erro ao escutar mudanças de autenticação no Analytics:", e);
    }
  }

  private async checkUserExists(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
  }

  private async updateCurrentUser(userId: string | null) {
    if (!userId) {
      this.currentUserId = null;
      return;
    }
    const exists = await this.checkUserExists(userId);
    if (exists) {
      this.currentUserId = userId;
    } else {
      this.currentUserId = null;
    }
  }

  private safeLogSystem(
    severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL",
    module: "ANALYTICS",
    operation: string,
    status: "success" | "failed" | "pending" | "started" | "timeout",
    executionTimeMs?: number,
    errorMsg?: string,
    errorCode?: string,
    metadata?: Record<string, any>
  ) {
    try {
      logSystem(severity, module, operation, status, executionTimeMs, errorMsg, errorCode, metadata);
    } catch (e) {
      console.warn("[Analytics] Falha ao registrar log no sistema:", e);
    }
  }

  private startFlushTimer() {
    this.flushTimeout = setTimeout(async () => {
      await this.flush();
      await this.processFailedBatches();
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
    vertical?: string,
    explicitUserId?: string | null
  ) {
    try {
      let userId: string | null = explicitUserId || this.currentUserId;
      if (userId) {
        const s = String(userId).trim();
        if (
          s === "" ||
          s.toLowerCase() === "null" ||
          s.toLowerCase() === "undefined" ||
          !this.isValidUUID(s)
        ) {
          userId = null;
        } else {
          userId = s;
        }
      } else {
        userId = null;
      }

      const event: AnalyticsEvent = {
        event_name: eventName,
        event_category: category,
        created_at_utc: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        session_id: this.sessionId,
        device_id: this.deviceId,
        user_id: userId,
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

    // Temporariamente registrar detalhes antes do insert
    batch.forEach(event => {
      console.log("[Analytics Debug Log] Pre-insert check:", {
        typeof_user_id: typeof event.user_id,
        user_id_value: event.user_id,
        anonymous_id: event.anonymous_id,
        session_id: event.session_id,
        origem_source: "AnalyticsService.ts track buffer"
      });
    });

    try {
      const { error } = await supabase.from("analytics_events").insert(batch);
      if (error) {
        console.warn("Erro ao fazer flush do lote de analytics:", error.message);
        
        const isFkError = error.code === "23503" || error.message?.includes("analytics_events_user_id_fkey");
        
        // Se for um erro de chave estrangeira (visitante com id incorreto ou stale session), corrigir para null e salvar lote
        if (isFkError) {
          console.warn("[Analytics] Foreign key constraint violation on user_id. Salvaging batch with user_id = null.");
          const salvagedBatch = batch.map(e => ({ ...e, user_id: null }));
          try {
            const { error: salvageError } = await supabase.from("analytics_events").insert(salvagedBatch);
            if (!salvageError) {
              console.log("[Analytics] Batch salvaged successfully after resetting user_ids to null.");
              this.safeLogSystem(
                "INFO",
                "ANALYTICS",
                "flush_analytics_events_salvaged",
                "success",
                undefined,
                undefined,
                undefined,
                { batchSize: batch.length }
              );
              return;
            } else {
              console.error("[Analytics] Failed to insert salvaged batch:", salvageError.message);
            }
          } catch (salvageEx: any) {
            console.error("[Analytics] Exception inserting salvaged batch:", salvageEx.message);
          }
        }

        this.safeLogSystem(
          "WARNING",
          "ANALYTICS",
          "flush_analytics_events_failed",
          "failed",
          undefined,
          error.message,
          error.code,
          { batchSize: batch.length, isFkError }
        );

        this.failedBatches.push({
          events: batch,
          attempts: 1,
          nextRetryTime: Date.now() + 2000
        });
      }
    } catch (e: any) {
      console.warn("Falha de rede ao descarregar analytics buffer:", e);
      this.safeLogSystem(
        "WARNING",
        "ANALYTICS",
        "flush_analytics_events_network_error",
        "failed",
        undefined,
        e.message || "Unknown network error",
        "NET_ERROR",
        { batchSize: batch.length }
      );

      this.failedBatches.push({
        events: batch,
        attempts: 1,
        nextRetryTime: Date.now() + 2000
      });
    }
  }

  private async processFailedBatches() {
    if (this.failedBatches.length === 0) return;

    const now = Date.now();
    const dueBatches = this.failedBatches.filter(b => b.nextRetryTime <= now);
    if (dueBatches.length === 0) return;

    this.failedBatches = this.failedBatches.filter(b => b.nextRetryTime > now);

    for (const batch of dueBatches) {
      await this.retryBatch(batch);
    }
  }

  private async retryBatch(failedBatch: FailedBatch) {
    // Temporariamente registrar detalhes antes do insert na retentativa
    failedBatch.events.forEach(event => {
      console.log("[Analytics Debug Log] Pre-retry-insert check:", {
        typeof_user_id: typeof event.user_id,
        user_id_value: event.user_id,
        anonymous_id: event.anonymous_id,
        session_id: event.session_id,
        origem_source: `AnalyticsService.ts retry queue (attempt ${failedBatch.attempts})`
      });
    });

    try {
      const { error } = await supabase.from("analytics_events").insert(failedBatch.events);
      if (!error) {
        this.safeLogSystem(
          "INFO",
          "ANALYTICS",
          "retry_analytics_events",
          "success",
          undefined,
          undefined,
          undefined,
          { attempts: failedBatch.attempts, batchSize: failedBatch.events.length }
        );
        return;
      }

      console.warn(`[Analytics] Retry failed (attempt ${failedBatch.attempts}):`, error.message);

      const isFkError = error.code === "23503" || error.message?.includes("analytics_events_user_id_fkey");

      // Corrigir erro de chave estrangeira na retentativa para evitar loop
      if (isFkError) {
        console.warn("[Analytics] Foreign key constraint violation on user_id in retry. Salvaging with user_id = null.");
        const salvagedBatch = failedBatch.events.map(e => ({ ...e, user_id: null }));
        try {
          const { error: salvageError } = await supabase.from("analytics_events").insert(salvagedBatch);
          if (!salvageError) {
            console.log("[Analytics] Retry batch salvaged successfully after resetting user_ids to null.");
            this.safeLogSystem(
              "INFO",
              "ANALYTICS",
              "retry_analytics_events_salvaged",
              "success",
              undefined,
              undefined,
              undefined,
              { batchSize: failedBatch.events.length }
            );
            return;
          }
        } catch (salvageEx) {
          // ignorar
        }
      }

      if (failedBatch.attempts >= 5) {
        this.safeLogSystem(
          "ERROR",
          "ANALYTICS",
          "discard_analytics_events",
          "failed",
          undefined,
          `Lote descartado apos ${failedBatch.attempts} tentativas: ${error.message}`,
          error.code,
          { batchSize: failedBatch.events.length, isFkError }
        );
        console.error(`[Analytics] Erro critico no Supabase. Lote descartado definitivamente apos 5 tentativas:`, error.message);
        
        // Lote descartado definitivamente, nenhuma retentativa ou timer agendado
        return;
      }

      failedBatch.attempts++;
      const backoffMs = Math.pow(2, failedBatch.attempts) * 1000;
      failedBatch.nextRetryTime = Date.now() + backoffMs;
      this.failedBatches.push(failedBatch);

      this.safeLogSystem(
        "WARNING",
        "ANALYTICS",
        "retry_analytics_events_failed",
        "failed",
        undefined,
        `Retentativa ${failedBatch.attempts - 1} falhou: ${error.message}. Nova tentativa em ${backoffMs/1000}s.`,
        error.code,
        { attempt: failedBatch.attempts - 1, isFkError }
      );
    } catch (e: any) {
      console.error(`[Analytics] Network error during retry (attempt ${failedBatch.attempts}):`, e.message);

      if (failedBatch.attempts >= 5) {
        this.safeLogSystem(
          "ERROR",
          "ANALYTICS",
          "discard_analytics_events_network",
          "failed",
          undefined,
          `Lote descartado devido a excecoes de rede apos 5 tentativas: ${e.message}`,
          "NET_ERROR",
          { batchSize: failedBatch.events.length }
        );
        return;
      }
      failedBatch.attempts++;
      const backoffMs = Math.pow(2, failedBatch.attempts) * 1000;
      failedBatch.nextRetryTime = Date.now() + backoffMs;
      this.failedBatches.push(failedBatch);
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
      
      const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
      try {
        navigator.sendBeacon(url, blob);
      } catch (e) {
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
 * Interface definitiva para registrar eventos de Analytics de forma assincrona,
 * desacoplada e amortecida por buffer local em lote.
 * Suporta retrocompatibilidade automatica com chamadas antigas.
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
      let legacyUserId: string | null = null;

      const validCategories: AnalyticsCategory[] = ["operational", "ux", "marketing", "system"];

      if (typeof categoryOrProperties === "string" && validCategories.includes(categoryOrProperties as AnalyticsCategory)) {
        finalCategory = categoryOrProperties as AnalyticsCategory;
        finalProperties = propertiesOrUserId || {};
      } else {
        // Assinatura legada: trackEvent(eventType, metadata, userId)
        finalProperties = categoryOrProperties || {};
        if (typeof propertiesOrUserId === "string") {
          legacyUserId = propertiesOrUserId;
        }
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

      // Normalizar nomes de eventos antigos para a nova especificacao
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

      getManager().track(finalEventName, finalCategory, finalProperties, finalVertical, legacyUserId);
    } catch (e) {
      console.warn("Erro no pipeline de Analytics:", e);
    }
  }, 0);
}
