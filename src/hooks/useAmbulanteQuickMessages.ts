import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AmbulanteSenderRole = "tomador" | "prestador";

export interface AmbulanteQuickMessage {
  id: string;
  pedido_id: string;
  sender_id: string;
  sender_role: AmbulanteSenderRole;
  message_text: string;
  created_at: string;
}

export const AMBULANTE_PRESET_MESSAGES: Record<AmbulanteSenderRole, string[]> = {
  tomador: [
    "Estou próximo ao ponto de referência",
    "Pode trazer troco/maquininha ou cobrar no Pix?",
    "Já cheguei para retirar",
    "Onde você está na praia agora?",
  ],
  prestador: [
    "Estou preparando seu pedido",
    "Estou indo até você agora!",
    "Seu pedido está pronto para retirada",
    "Cheguei no ponto combinado",
  ],
};

interface UseAmbulanteQuickMessagesOptions {
  pedidoId?: string | null;
  senderId?: string | null;
  senderRole: AmbulanteSenderRole;
  enabled?: boolean;
}

export function useAmbulanteQuickMessages({
  pedidoId,
  senderId,
  senderRole,
  enabled = true,
}: UseAmbulanteQuickMessagesOptions) {
  const [messages, setMessages] = useState<AmbulanteQuickMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!pedidoId || !enabled) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ambulante_mensagens")
        .select("id, pedido_id, sender_id, sender_role, message_text, created_at")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true });
      if (!error && Array.isArray(data)) {
        setMessages(data as AmbulanteQuickMessage[]);
      }
    } finally {
      setLoading(false);
    }
  }, [pedidoId, enabled]);

  useEffect(() => {
    if (!pedidoId || !enabled) {
      setMessages([]);
      return;
    }

    loadMessages();

    const channel = supabase
      .channel(`ambulante-msg-${pedidoId}-${senderRole}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ambulante_mensagens",
          filter: `pedido_id=eq.${pedidoId}`,
        },
        (payload) => {
          const next = payload.new as AmbulanteQuickMessage;
          if (!next?.id) return;
          setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]));
        },
      )
      .subscribe();

    const pollId = window.setInterval(loadMessages, 5000);

    return () => {
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [pedidoId, senderRole, enabled, loadMessages]);

  const sendMessage = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = text.trim();
      if (!trimmed || !pedidoId || !senderId) {
        return { ok: false, error: "Mensagem ou pedido inválido." };
      }
      setSending(true);
      try {
        const { data, error } = await supabase
          .from("ambulante_mensagens")
          .insert({
            pedido_id: pedidoId,
            sender_id: senderId,
            sender_role: senderRole,
            message_text: trimmed.slice(0, 280),
          })
          .select("id, pedido_id, sender_id, sender_role, message_text, created_at")
          .single();

        if (error) {
          return { ok: false, error: error.message };
        }
        if (data) {
          const inserted = data as AmbulanteQuickMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted],
          );
        }
        return { ok: true };
      } finally {
        setSending(false);
      }
    },
    [pedidoId, senderId, senderRole],
  );

  return {
    messages,
    loading,
    sending,
    sendMessage,
    presets: AMBULANTE_PRESET_MESSAGES[senderRole],
  };
}
