import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2, X, Sparkles, ExternalLink, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read_status: boolean;
  link?: string | null;
  created_at: string;
}

export async function sendInAppNotification(
  userId: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    const { error } = await supabase.from("in_app_notifications").insert({
      user_id: userId,
      title,
      message,
      link: link || null,
      read_status: false,
    });
    if (error) console.warn("Erro ao enviar notificacao in-app:", error);
  } catch (err) {
    console.warn("Erro de rede notificacao in-app:", err);
  }
}

export default function InAppNotificationBell() {
  const user = useCurrentUser();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user.uid) return;
    try {
      const { data, error } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn("Erro ao buscar notificacoes in-app:", err);
    }
  };

  useEffect(() => {
    if (!user.uid) return;
    fetchNotifications();

    // Realtime subscription for instant bell updates
    const channel = supabase
      .channel(`in-app-notifs-${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "in_app_notifications",
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.uid]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const markAllAsRead = async () => {
    if (!user.uid || unreadCount === 0) return;
    try {
      await supabase
        .from("in_app_notifications")
        .update({ read_status: true })
        .eq("user_id", user.uid)
        .eq("read_status", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
    } catch (err) {
      console.warn("Erro ao marcar notificacoes como lidas:", err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("in_app_notifications")
        .update({ read_status: true })
        .eq("id", id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
    } catch (err) {
      console.warn("Erro ao marcar notificacao:", err);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from("in_app_notifications").delete().eq("id", id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.warn("Erro ao excluir notificacao:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        aria-label="Central de Notificações"
        className="relative p-2.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white transition-all flex items-center justify-center cursor-pointer border border-white/10"
      >
        <Bell size={20} className={unreadCount > 0 ? "text-[#0DB87E] animate-bounce" : "text-white/80"} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#E84040] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-[340px] sm:w-[380px] max-h-[460px] bg-[#0E1528] border border-white/15 rounded-2xl shadow-2xl shadow-black/80 z-[99999] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#0DB87E]" />
              <span className="font-display font-bold text-sm text-white">Notificações In-App</span>
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-sans font-medium text-[#0DB87E] hover:underline cursor-pointer"
                >
                  Marcar lidas
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[380px]">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-white/40 font-sans text-xs flex flex-col items-center">
                <Sparkles size={24} className="text-white/20 mb-2" />
                <p>Nenhuma notificação no momento.</p>
                <p className="text-[11px] text-white/30 mt-1">Avisos de coleta e novidades aparecerão aqui!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    markAsRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                    !n.read_status
                      ? "bg-[#0DB87E]/10 border-[#0DB87E]/30 text-white"
                      : "bg-white/[0.02] border-white/5 text-white/75 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-display font-bold text-xs text-white">
                      {!n.read_status && (
                        <span className="w-2 h-2 rounded-full bg-[#0DB87E] shrink-0" />
                      )}
                      <span>{n.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => deleteNotification(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-opacity"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p className="font-sans text-xs text-white/70 mt-1 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5 text-[10px] text-white/40 font-mono">
                    <span>
                      {new Date(n.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {n.link && (
                      <span className="text-[#0DB87E] flex items-center gap-1 font-sans">
                        Ver detalhes <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}
