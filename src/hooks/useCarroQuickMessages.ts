import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import type { QuickMessageItem } from "@/components/mototaxi/QuickStatusMessages";
import type { MototaxiChatRole, MototaxiChatStatus } from "@/hooks/useMototaxiQuickMessages";

export type CarroChatRole = MototaxiChatRole;
export type CarroChatStatus = MototaxiChatStatus;

interface CarroMessageRow {
  id: string;
  corrida_id: string;
  sender_role: CarroChatRole;
  message_text: string;
  created_at: string;
}

function toMessage(row: CarroMessageRow): QuickMessageItem {
  return {
    id: row.id,
    text: row.message_text,
    from: row.sender_role,
    createdAt: row.created_at,
    ts: new Date(row.created_at).getTime(),
  };
}

function mergeMessages(current: QuickMessageItem[], incoming: QuickMessageItem[]): QuickMessageItem[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()]
    .sort((left, right) => (left.ts ?? 0) - (right.ts ?? 0))
    .slice(-100);
}

export function useCarroQuickMessages(
  rideId: string | null | undefined,
  role: CarroChatRole,
  onIncoming?: (message: QuickMessageItem) => void,
) {
  const [messages, setMessages] = useState<QuickMessageItem[]>([]);
  const [status, setStatus] = useState<CarroChatStatus>("connecting");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incomingRef = useRef(onIncoming);
  incomingRef.current = onIncoming;

  useEffect(() => {
    let active = true;
    setMessages([]);
    setError(null);
    setStatus(rideId ? "connecting" : "error");
    if (!rideId) return () => { active = false; };

    void (async () => {
      const { data, error: loadError } = await supabase
        .from("carro_mensagens")
        .select("id, corrida_id, sender_role, message_text, created_at")
        .eq("corrida_id", rideId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!active) return;
      if (loadError) {
        setError("Não foi possível carregar as mensagens da corrida.");
        return;
      }
      const loaded = (data ?? []).map((row) => toMessage(row as CarroMessageRow));
      setMessages((current) => mergeMessages(current, loaded));
    })();

    return () => { active = false; };
  }, [rideId]);

  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    const row = payload.new as unknown as CarroMessageRow;
    if (!rideId || row.corrida_id !== rideId || !row.id) return;
    const message = toMessage(row);
    setMessages((current) => mergeMessages(current, [message]));
    if (message.from !== role) incomingRef.current?.(message);
  }, [rideId, role]);

  useRealtimeChannel(
    rideId ? `carro_messages_${rideId}` : null,
    {
      event: "INSERT",
      schema: "public",
      table: "carro_mensagens",
      filter: rideId ? `corrida_id=eq.${rideId}` : undefined,
    },
    handleInsert,
    setStatus,
  );

  const sendMessage = useCallback(async (text: string) => {
    const messageText = text.trim();
    if (!rideId) throw new Error("Corrida ativa não encontrada.");
    if (!messageText || messageText.length > 160) throw new Error("Mensagem rápida inválida.");

    setIsSending(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("carro_mensagens")
        .insert({
          corrida_id: rideId,
          sender_role: role,
          message_text: messageText,
        })
        .select("id, corrida_id, sender_role, message_text, created_at")
        .single();
      if (insertError) throw insertError;
      setMessages((current) => mergeMessages(current, [toMessage(data as CarroMessageRow)]));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha ao enviar mensagem.";
      setError(message);
      throw caught;
    } finally {
      setIsSending(false);
    }
  }, [rideId, role]);

  return { messages, status, isSending, error, sendMessage };
}
