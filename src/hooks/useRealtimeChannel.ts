import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface RealtimeChannelConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
}

/**
 * Centralized Realtime hook with auto-reconnect and error handling.
 * Replaces all raw supabase.channel().subscribe() calls.
 *
 * - Detects CHANNEL_ERROR / TIMED_OUT and attempts reconnection after 3s.
 * - Caps reconnection attempts at 10 to avoid infinite loops.
 * - Provides an onStatus callback for UI feedback (e.g. "Reconectando...").
 */
export function useRealtimeChannel(
  channelName: string,
  config: RealtimeChannelConfig,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onStatus?: (status: "connected" | "reconnecting" | "error") => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 10;

  const subscribe = useCallback(() => {
    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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
        callback
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          retriesRef.current = 0;
          onStatus?.("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[useRealtimeChannel] ${channelName} ${status}. Attempt ${retriesRef.current + 1}/${MAX_RETRIES}`
          );
          onStatus?.("reconnecting");

          if (retriesRef.current < MAX_RETRIES) {
            retriesRef.current += 1;
            setTimeout(() => {
              subscribe();
            }, 3000 * Math.min(retriesRef.current, 5)); // backoff up to 15s
          } else {
            console.error(`[useRealtimeChannel] ${channelName} — max retries reached.`);
            onStatus?.("error");
          }
        }
      });

    channelRef.current = channel;
  }, [channelName, config.event, config.table, config.filter, config.schema, callback, onStatus]);

  useEffect(() => {
    subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [subscribe]);

  return channelRef;
}
