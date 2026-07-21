import { supabase } from "@/lib/supabase";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ServiceCircuitInfo {
  serviceName: string;
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
  successCount: number;
  fallbackCount: number;
  timeoutMs: number;
  maxRetries: number;
  allowAutoRetry: boolean;
}

export interface ResilienceExecuteOptions<T> {
  serviceName: string;
  timeoutMs?: number;
  maxRetries?: number;
  allowAutoRetry?: boolean; // STRICT: false for financial transactions!
  fallbackFn?: () => Promise<T>;
}

class GeoCacheManager {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24h

  public get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  public set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.TTL,
    });
  }
}

export const GeoCacheService = new GeoCacheManager();

class ResilienceServiceManager {
  private circuits = new Map<string, ServiceCircuitInfo>();

  private readonly FAILURE_THRESHOLD = 3;
  private readonly COOLDOWN_MS = 30000; // 30s in OPEN state

  constructor() {
    this.initService("mercado_pago", 8000, 0, false);
    this.initService("google_maps", 5000, 2, true);
    this.initService("mapbox", 5000, 2, true);
    this.initService("firebase_push", 6000, 2, true);
    this.initService("whatsapp", 8000, 2, true);
    this.initService("resend", 8000, 2, true);
    this.initService("supabase_realtime", 5000, 2, true);
    this.initService("supabase_storage", 10000, 2, true);
  }

  private initService(name: string, timeoutMs: number, maxRetries: number, allowAutoRetry: boolean) {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        serviceName: name,
        state: "CLOSED",
        failures: 0,
        successCount: 0,
        fallbackCount: 0,
        timeoutMs,
        maxRetries,
        allowAutoRetry,
      });
    }
  }

  public getServiceStates(): ServiceCircuitInfo[] {
    const now = Date.now();
    const result: ServiceCircuitInfo[] = [];

    this.circuits.forEach((circuit) => {
      // Check if OPEN circuit cooldown expired -> move to HALF_OPEN
      if (circuit.state === "OPEN" && circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
        circuit.state = "HALF_OPEN";
      }
      result.push({ ...circuit });
    });

    return result;
  }

  public async execute<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    options: ResilienceExecuteOptions<T>
  ): Promise<T> {
    const { serviceName, fallbackFn } = options;
    const now = Date.now();

    this.initService(serviceName, options.timeoutMs || 5000, options.maxRetries || 0, options.allowAutoRetry || false);
    const circuit = this.circuits.get(serviceName)!;

    // Check Circuit State
    if (circuit.state === "OPEN") {
      if (circuit.nextAttemptTime && now < circuit.nextAttemptTime) {
        // Circuit OPEN: execute fallback immediately without hitting broken service
        if (fallbackFn) {
          circuit.fallbackCount++;
          return await fallbackFn();
        }
        throw new Error(`[CircuitBreaker] Circuito aberto para o serviço '${serviceName}'. Tente novamente mais tarde.`);
      }
      circuit.state = "HALF_OPEN";
    }

    const timeoutMs = options.timeoutMs || circuit.timeoutMs;
    const maxRetries = options.allowAutoRetry !== false && circuit.allowAutoRetry ? (options.maxRetries ?? circuit.maxRetries) : 0;

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await fn(controller.signal);
        clearTimeout(timeoutId);

        // Success -> Reset circuit to CLOSED
        circuit.state = "CLOSED";
        circuit.failures = 0;
        circuit.successCount++;
        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;

        const isTimeout = err?.name === "AbortError";
        console.warn(`[ResilienceService] Falha no serviço '${serviceName}' (Tentativa ${attempt}/${maxRetries + 1}):`, err?.message || err);

        // If financial or non-retryable, break loop
        if (!circuit.allowAutoRetry || options.allowAutoRetry === false) {
          break;
        }

        // Backoff delay: 1s, 3s, 8s
        if (attempt <= maxRetries) {
          const backoffDelay = attempt === 1 ? 1000 : attempt === 2 ? 3000 : 8000;
          await new Promise((r) => setTimeout(r, backoffDelay));
        }
      }
    }

    // Trip circuit on threshold
    circuit.failures++;
    if (circuit.failures >= this.FAILURE_THRESHOLD) {
      circuit.state = "OPEN";
      circuit.nextAttemptTime = Date.now() + this.COOLDOWN_MS;
      console.error(`[CircuitBreaker] Circuito ABERTO para '${serviceName}' após ${circuit.failures} falhas consecutivas.`);

      // Log Health Center Alert
      try {
        supabase.from("health_alerts").insert({
          categoria: "Infraestrutura",
          titulo: `Circuit Breaker Aberto: ${serviceName}`,
          mensagem: `O serviço ${serviceName} falhou repetidamente. Modos de fallback e resiliência foram ativados.`,
          criticidade: "ALTA",
          status: "open",
          origem: "ResilienceService",
        }).then();
      } catch (alertErr) {
        console.warn("[ResilienceService] Alert logging failed:", alertErr);
      }
    }

    // Try fallback
    if (fallbackFn) {
      circuit.fallbackCount++;
      return await fallbackFn();
    }

    throw lastError || new Error(`Serviço '${serviceName}' indisponível.`);
  }
}

export const ResilienceService = new ResilienceServiceManager();
