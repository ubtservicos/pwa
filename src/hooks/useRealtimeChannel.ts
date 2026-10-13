import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface RealtimeChannelConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
}

type ConnectionStatus = "connected" | "reconnecting" | "error";

/** Lifecycle-safe Postgres Changes subscription with serialized reconnects. */
export function useRealtimeChannel(
  channelName: string | null | undefined,
  config: RealtimeChannelConfig,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onStatus?: (status: ConnectionStatus) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(callback);
  const statusRef = useRef(onStatus);

  callbackRef.current = callback;
  statusRef.current = onStatus;

  useEffect(() => {
    // One controlled retry; screens provide polling fallback when WSS is blocked.
    const MAX_RETRIES = 1;
    let disposed = false;
    let generation = 0;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const removeCurrent = async () => {
      const current = channelRef.current;
      channelRef.current = null;
      if (!current) return;
      try {
        await supabase.removeChannel(current);
      } catch {
        // The socket may already be closed; reconnect can continue safely.
      }
    };

    const disconnect = () => {
      generation += 1;
      clearRetry();
      void removeCurrent();
    };

    const connect = (resetRetries = false) => {
      if (!channelName || disposed || document.visibilityState === "hidden") return;
      if (resetRetries) retries = 0;

      const runGeneration = ++generation;
      clearRetry();

      void (async () => {
        await removeCurrent();
        if (disposed || runGeneration !== generation || document.visibilityState === "hidden") return;

        const channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes" as any,
            {
              event: config.event,
              schema: config.schema ?? "public",
              table: config.table,
              ...(config.filter ? { filter: config.filter } : {}),
            },
            (payload) => callbackRef.current(payload)
          );

        channelRef.current = channel;
        channel.subscribe((status: string) => {
          if (disposed || runGeneration !== generation || channelRef.current !== channel) return;

          if (status === "SUBSCRIBED") {
            retries = 0;
            statusRef.current?.("connected");
            return;
          }

          if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") return;
          if (document.visibilityState === "hidden") {
            disconnect();
            return;
          }

          if (import.meta.env.DEV) {
            console.debug(`[useRealtimeChannel] ${channelName} ${status}; retry ${retries + 1}/${MAX_RETRIES}`);
          }
          statusRef.current?.("reconnecting");

          if (retries >= MAX_RETRIES) {
            statusRef.current?.("error");
            return;
          }

          retries += 1;
          clearRetry();
          retryTimer = setTimeout(() => connect(false), 3000 * Math.min(retries, 5));
        });
      })();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") disconnect();
      else connect(true);
    };
    const handlePageHide = () => disconnect();
    const handlePageShow = () => connect(true);

    connect(true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      disposed = true;
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [channelName, config.event, config.schema, config.table, config.filter]);

  return channelRef;
}
