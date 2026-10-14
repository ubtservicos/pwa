import React, { useEffect, useRef } from "react";
import { MessageSquare, Check } from "lucide-react";

export const PRESTADOR_QUICK_PHRASES = [
  "Já estou chegando 🏍",
  "A caminho 🏍",
  "Quase lá ✅",
  "Estou no ponto de embarque 📍",
  "Aguarde 1 min ⏱",
  "Estou no trânsito 🚦",
  "Cheguei no destino 🏁",
];

export const TOMADOR_QUICK_PHRASES = [
  "Já estou aqui 📍",
  "Aguardando no portão 🏠",
  "A caminho do ponto 🚶",
  "Onde exatamente? 🗺",
  "Ok, pode ir 👍",
  "Preciso parar 🛑",
  "Estou no destino ✅",
];

export interface QuickMessageItem {
  id: string;
  text: string;
  from: "tomador" | "prestador";
  ts?: number;
  createdAt?: string;
}

interface QuickStatusMessagesProps {
  role: "tomador" | "prestador";
  onSendMessage: (phrase: string) => void | Promise<void>;
  lastSentPhrase?: string | null;
  messages?: QuickMessageItem[];
  connectionStatus?: "connecting" | "connected" | "reconnecting" | "error";
  isSending?: boolean;
  error?: string | null;
  className?: string;
}

export const QuickStatusMessages: React.FC<QuickStatusMessagesProps> = ({
  role,
  onSendMessage,
  lastSentPhrase,
  messages = [],
  connectionStatus = "connecting",
  isSending = false,
  error,
  className = "",
}) => {
  const phrases = role === "prestador" ? PRESTADOR_QUICK_PHRASES : TOMADOR_QUICK_PHRASES;
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={13} className="text-[#0DB87E]" />
          <span
            className="font-sans text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            Mensagens da corrida
          </span>
        </div>
        <span
          className="flex items-center gap-1 font-sans text-[10px]"
          style={{ color: connectionStatus === "error" ? "#E84040" : "rgba(255,255,255,0.45)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: connectionStatus === "connected" ? "#0DB87E" : connectionStatus === "error" ? "#E84040" : "#F5A623" }}
          />
          {connectionStatus === "connected" ? "Ao vivo" : connectionStatus === "error" ? "Offline" : "Conectando"}
        </span>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Mensagens da corrida"
        className="mb-2 max-h-36 overflow-y-auto rounded-xl p-2.5 space-y-2 scrollbar-none"
        style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {messages.length === 0 ? (
          <p className="py-2 text-center font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.40)" }}>
            Envie uma mensagem rápida para iniciar a conversa.
          </p>
        ) : messages.map((message) => {
          const mine = message.from === role;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[84%] rounded-2xl px-3 py-2 font-sans text-[12px] leading-snug shadow-sm"
                style={{
                  color: "#FFFFFF",
                  background: mine ? "#0B8F65" : "rgba(255,255,255,0.10)",
                  borderBottomRightRadius: mine ? 4 : 16,
                  borderBottomLeftRadius: mine ? 16 : 4,
                }}
              >
                <p>{message.text}</p>
                {message.createdAt && (
                  <p className="mt-0.5 text-right text-[9px] text-white/55">
                    {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        {phrases.map((phrase) => {
          const isSelected = lastSentPhrase === phrase;
          return (
            <button
              key={phrase}
              type="button"
              disabled={isSending}
              onClick={() => void onSendMessage(phrase)}
              className="shrink-0 px-3 py-1.5 rounded-full font-sans text-[12px] font-medium transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
              style={{
                background: isSelected
                  ? "rgba(13,184,126,0.20)"
                  : "rgba(255,255,255,0.06)",
                border: isSelected
                  ? "1px solid #0DB87E"
                  : "1px solid rgba(255,255,255,0.10)",
                color: isSelected ? "#0DB87E" : "#FFFFFF",
                opacity: isSending ? 0.55 : 1,
              }}
            >
              {phrase}
              {isSelected && <Check size={12} className="text-[#0DB87E]" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 font-sans text-[11px] text-[#E84040]">{error}</p>}
    </div>
  );
};

export default QuickStatusMessages;
