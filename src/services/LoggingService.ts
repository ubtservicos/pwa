import { supabase } from "@/lib/supabase";

export type LogSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type LogModule =
  | "AUTH"
  | "PWA"
  | "CHECKOUT"
  | "PAYMENTS"
  | "SPLIT"
  | "PAYOUT"
  | "REFUND"
  | "WEBHOOK"
  | "NOTIFICATIONS"
  | "ANALYTICS"
  | "BACKOFFICE"
  | "DATABASE"
  | "SUPABASE"
  | "MAPS"
  | "MOTOTAXI"
  | "DIARISTAS"
  | "AMBULANTES"
  | "COCO"
  | "LGPD"
  | "SYSTEM"
  | "DISPUTES"
  | "CHAT"
  | "EDGE_FUNCTION";

export type LogStatus = "success" | "failed" | "pending" | "started" | "timeout";

export interface SystemLogEntry {
  id?: string;
  created_at?: string;
  severity: LogSeverity;
  module: LogModule;
  service?: string;
  operation?: string;
  status: LogStatus;
  execution_time_ms?: number;
  user_id: string | null;
  request_id: string;
  correlation_id: string;
  error_code?: string;
  error_message?: string;
  metadata: Record<string, any>;
}

const BATCH_SIZE_LIMIT = 20;
const BATCH_TIME_LIMIT_MS = 10000;

class LoggingManager {
  private buffer: SystemLogEntry[] = [];
  private flushTimeout: any = null;
  private currentCorrelationId: string = "";
  private currentUserId: string | null = null;

  constructor() {
    this.currentCorrelationId = this.generateUUID();
    if (typeof window !== "undefined") {
      this.listenToAuthChanges();
      this.startFlushTimer();
      window.addEventListener("beforeunload", () => this.flushSync());
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
      console.warn("Erro ao ouvir autenticação no LoggingService:", e);
    }
  }

  private startFlushTimer() {
    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, BATCH_TIME_LIMIT_MS);
  }

  public setCorrelationId(cid: string) {
    this.currentCorrelationId = cid;
  }

  public getCorrelationId(): string {
    return this.currentCorrelationId;
  }

  public startCorrelation(): string {
    this.currentCorrelationId = this.generateUUID();
    return this.currentCorrelationId;
  }

  public log(
    severity: LogSeverity,
    module: LogModule,
    operation: string,
    status: LogStatus,
    executionTimeMs?: number,
    errorMsg?: string,
    errorCode?: string,
    metadata: Record<string, any> = {},
    service?: string
  ) {
    try {
      const maskedMetadata = this.maskSensitiveData(metadata);
      const maskedErrorMsg = errorMsg ? this.maskString(errorMsg) : undefined;

      const logEntry: SystemLogEntry = {
        severity,
        module,
        service: service || "pwa_client",
        operation,
        status,
        execution_time_ms: executionTimeMs,
        user_id: this.currentUserId,
        request_id: this.generateUUID(),
        correlation_id: this.currentCorrelationId,
        error_code: errorCode,
        error_message: maskedErrorMsg,
        metadata: maskedMetadata
      };

      this.buffer.push(logEntry);

      if (this.buffer.length >= BATCH_SIZE_LIMIT) {
        this.flush();
      }
    } catch (e) {
      console.warn("Falha ao registrar log no buffer:", e);
    }
  }

  private maskSensitiveData(data: any): any {
    if (!data) return data;
    if (typeof data !== "object") return data;

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    const masked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const val = data[key];
        const lowerKey = key.toLowerCase();

        if (
          lowerKey.includes("password") ||
          lowerKey.includes("senha") ||
          lowerKey.includes("token") ||
          lowerKey.includes("jwt") ||
          lowerKey.includes("cvv") ||
          lowerKey.includes("credential")
        ) {
          masked[key] = "[MASKED]";
        } else if (lowerKey.includes("card") || lowerKey.includes("cartao")) {
          if (typeof val === "string") {
            masked[key] = val.replace(/\d(?=\d{4})/g, "*");
          } else {
            masked[key] = "[MASKED]";
          }
        } else if (lowerKey.includes("cpf") || lowerKey.includes("cnpj") || lowerKey.includes("document")) {
          if (typeof val === "string") {
            masked[key] = val.replace(/^(\d{3})\d+(\d{2})$/, "$1.***.***-$2");
          } else {
            masked[key] = "[MASKED]";
          }
        } else if (lowerKey.includes("phone") || lowerKey.includes("telefone") || lowerKey.includes("celular")) {
          if (typeof val === "string") {
            masked[key] = val.replace(/^\+?(\d{2})(\d+)(\d{4})$/, "+$1 *****-$3");
          } else {
            masked[key] = "[MASKED]";
          }
        } else if (lowerKey.includes("email")) {
          if (typeof val === "string") {
            const parts = val.split("@");
            if (parts.length === 2) {
              masked[key] = `${parts[0][0]}***@${parts[1]}`;
            } else {
              masked[key] = "[MASKED]";
            }
          } else {
            masked[key] = "[MASKED]";
          }
        } else if (lowerKey.includes("pix")) {
          masked[key] = "[MASKED_PIX_KEY]";
        } else if (typeof val === "object") {
          masked[key] = this.maskSensitiveData(val);
        } else {
          masked[key] = val;
        }
      }
    }
    return masked;
  }

  private maskString(str: string): string {
    let result = str;
    result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[MASKED_EMAIL]");
    result = result.replace(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, "[MASKED_PHONE]");
    return result;
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await supabase.from("system_logs").insert(batch);
      if (error) {
        console.warn("Erro ao enviar system logs:", error.message);
        this.buffer = [...batch, ...this.buffer].slice(0, 100);
      }
    } catch (e) {
      console.warn("Falha de rede ao descarregar system logs:", e);
      this.buffer = [...batch, ...this.buffer].slice(0, 100);
    }
  }

  public flushSync() {
    if (this.buffer.length === 0) return;
    const batch = [...this.buffer];
    this.buffer = [];

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/system_logs`;
      const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
      try {
        navigator.sendBeacon(url, blob);
      } catch (e) {
        fetch(url, {
          method: "POST",
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(batch),
          keepalive: true
        }).catch(() => {});
      }
    }
  }
}

let loggingManagerInstance: LoggingManager | null = null;
const getLoggingManager = (): LoggingManager => {
  if (!loggingManagerInstance) {
    loggingManagerInstance = new LoggingManager();
  }
  return loggingManagerInstance;
};

/**
 * Registra um log de observabilidade assíncrono no sistema.
 */
export function logSystem(
  severity: LogSeverity,
  module: LogModule,
  operation: string,
  status: LogStatus,
  executionTimeMs?: number,
  errorMsg?: string,
  errorCode?: string,
  metadata: Record<string, any> = {},
  service?: string
) {
  setTimeout(() => {
    try {
      getLoggingManager().log(
        severity,
        module,
        operation,
        status,
        executionTimeMs,
        errorMsg,
        errorCode,
        metadata,
        service
      );
    } catch (e) {
      console.warn("Erro no pipeline do LoggingService:", e);
    }
  }, 0);
}

/**
 * Utilitário para iniciar e propagar um Correlation ID para transações distribuídas.
 */
export const correlation = {
  start: (): string => getLoggingManager().startCorrelation(),
  get: (): string => getLoggingManager().getCorrelationId(),
  set: (cid: string) => getLoggingManager().setCorrelationId(cid)
};
