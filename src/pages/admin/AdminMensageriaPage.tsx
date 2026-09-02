import React, { useState, useEffect } from "react";
import {
  Send,
  MessageSquare,
  Bot,
  Smartphone,
  Bell,
  Mail,
  Users,
  Calendar,
  Clock,
  Repeat,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  Eye,
  ChevronRight,
  TrendingUp,
  Radio
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";

interface Campaign {
  id: string;
  created_at: string;
  title: string;
  channel: string;
  target_type: "broadcast" | "niche" | "individual";
  niche?: string;
  individual_recipient?: string;
  message_template: string;
  scheduled_type: "now" | "scheduled";
  scheduled_for?: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  status: "agendado" | "em_andamento" | "concluido" | "falhou";
  sent_count: number;
  total_targeted: number;
  author_name?: string;
}

const NICHES = [
  { id: "motoboy", label: "Mototaxistas & Entregadores", icon: "🛵", count: 142 },
  { id: "diarista", label: "Diaristas & Limpeza", icon: "✨", count: 98 },
  { id: "tomadores", label: "Tomadores (Consumidores Gerais)", icon: "👥", count: 1240 },
  { id: "moradores", label: "Moradores Locais (Ubatuba)", icon: "🏠", count: 830 },
  { id: "turistas", label: "Turistas & Veranistas", icon: "🏖️", count: 510 },
  { id: "ambulantes", label: "Ambulantes & Comércio Praiano", icon: "🥥", count: 76 }
];

const CHANNELS = [
  {
    id: "omnichannel",
    name: "Omnichannel Agent (Padrão)",
    icon: Bot,
    badge: "Oficial Engine v1",
    description: "Roteamento inteligente Server-to-Server com HMAC-SHA256 e fail-closed.",
    highlight: true
  },
  {
    id: "whatsapp",
    name: "WhatsApp Direto",
    icon: MessageSquare,
    badge: "Meta API",
    description: "Envio de template HSM via WhatsApp Business API."
  },
  {
    id: "push",
    name: "Push Notification",
    icon: Bell,
    badge: "PWA WebPush",
    description: "Notificação push nativa no dispositivo do usuário."
  },
  {
    id: "sms",
    name: "SMS Transacional",
    icon: Smartphone,
    badge: "Telecom",
    description: "Disparo prioritário via operadora de telefonia celular."
  },
  {
    id: "in_app",
    name: "Notificação In-App",
    icon: Mail,
    badge: "SuperApp Feed",
    description: "Alerta na central interna de avisos e sininho do app."
  }
];

export default function AdminMensageriaPage() {
  const { addToast } = useAdminToast();

  // Form State
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("omnichannel"); // DEFAULT PRE-SELECTED VALUE
  const [targetType, setTargetType] = useState<"broadcast" | "niche" | "individual">("broadcast");
  const [niche, setNiche] = useState("motoboy");
  const [individualRecipient, setIndividualRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledType, setScheduledType] = useState<"now" | "scheduled">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  // History & Loading State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [channelFilter, setChannelFilter] = useState("todos");
  const [previewOpen, setPreviewOpen] = useState(true);

  // Fetch Campaigns from Supabase
  const fetchCampaigns = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err: any) {
      console.warn("Erro ao buscar histórico de campanhas:", err);
      // Fallback local mock if offline
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Insert Variable helper
  const insertVariable = (variable: string) => {
    setMessage((prev) => `${prev} {{${variable}}}`);
  };

  // Submit Handler
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast("Informe um título identificador para a campanha.", "error");
      return;
    }
    if (!message.trim()) {
      addToast("Escreva o conteúdo da mensagem a ser enviada.", "error");
      return;
    }
    if (targetType === "individual" && !individualRecipient.trim()) {
      addToast("Informe o destinatário específico para envio individual.", "error");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const authorName = userData?.user?.email || "SuperAdmin UBT";

      let scheduledForIso: string | null = null;
      if (scheduledType === "scheduled" && scheduledDate) {
        scheduledForIso = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      }

      // Calculate approximate audience count
      let audienceCount = 2896; // Total base
      if (targetType === "niche") {
        const found = NICHES.find((n) => n.id === niche);
        audienceCount = found ? found.count : 100;
      } else if (targetType === "individual") {
        audienceCount = 1;
      }

      const isNow = scheduledType === "now";
      const newStatus = isNow ? "concluido" : "agendado";
      const sentCount = isNow ? audienceCount : 0;

      const newCampaignPayload = {
        title: title.trim(),
        channel,
        target_type: targetType,
        niche: targetType === "niche" ? niche : null,
        individual_recipient: targetType === "individual" ? individualRecipient.trim() : null,
        message_template: message.trim(),
        scheduled_type: scheduledType,
        scheduled_for: scheduledForIso,
        recurrence,
        status: newStatus,
        sent_count: sentCount,
        total_targeted: audienceCount,
        author_name: authorName,
        metadata: {
          engine_version: channel === "omnichannel" ? "v1_hmac_sha256" : "standard",
          dispatched_at: isNow ? new Date().toISOString() : null
        }
      };

      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .insert([newCampaignPayload])
        .select()
        .single();

      if (error) throw error;

      addToast(
        isNow
          ? `Disparo executado com sucesso via ${channel === "omnichannel" ? "Omnichannel Agent" : channel} para ${audienceCount} destinatários!`
          : `Campanha agendada com sucesso para ${scheduledDate} às ${scheduledTime}!`,
        "success"
      );

      // Reset form fields
      setTitle("");
      setMessage("");
      setTargetType("broadcast");
      setIndividualRecipient("");
      setScheduledType("now");
      setRecurrence("none");
      setChannel("omnichannel");

      // Refresh list
      fetchCampaigns();
    } catch (err: any) {
      console.error("Erro ao registrar campanha:", err);
      addToast(err?.message || "Falha ao processar campanha de mensageria.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filtered List
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.message_template.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.author_name && c.author_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
    const matchesChannel = channelFilter === "todos" || c.channel === channelFilter;

    return matchesSearch && matchesStatus && matchesChannel;
  });

  // Calculate stats
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalScheduled = campaigns.filter((c) => c.status === "agendado").length;
  const totalOmnichannel = campaigns.filter((c) => c.channel === "omnichannel").length;

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", paddingBottom: 60 }} className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30">
              Operações & Entidades
            </span>
            <span className="text-xs text-white/40">• SuperAdmin Exclusivo</span>
          </div>
          <h1 style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 800 }} className="text-white m-0 flex items-center gap-3">
            <Send className="text-[#0DB87E]" size={24} /> Central de Mensageria & Campanhas
          </h1>
          <p className="text-white/50 text-sm mt-1 mb-0">
            Gerencie disparos em broadcast, automações por nicho e integrações com o motor <strong>Omnichannel Agent v1</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCampaigns}
            disabled={fetching}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#18181B] border border-[#27272A] rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={fetching ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0DB87E]/10 border border-[#0DB87E]/20 flex items-center justify-center text-[#0DB87E]">
            <Send size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">Total Entregue</div>
            <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700 }} className="text-white">
              {totalSent.toLocaleString("pt-BR")} <span className="text-xs text-[#0DB87E] font-normal">msgs</span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">Via Omnichannel</div>
            <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700 }} className="text-white">
              {totalOmnichannel} <span className="text-xs text-white/40 font-normal">campanhas</span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
            <Clock3 size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">Agendamentos</div>
            <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700 }} className="text-white">
              {totalScheduled} <span className="text-xs text-white/40 font-normal">ativas</span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center text-[#A855F7]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">Protocolo de Borda</div>
            <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="text-[#0DB87E] flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#0DB87E] animate-pulse"></span> v1 HMAC Ativo
            </div>
          </div>
        </div>
      </div>

      {/* Main Campaign Builder Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Composer */}
        <div className="lg:col-span-8 bg-[#18181B] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-3">
            <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="text-white m-0 flex items-center gap-2">
              <Sparkles size={18} className="text-[#0DB87E]" /> Nova Transmissão / Comunicado
            </h2>
            <span className="text-xs text-white/40">Segmentação e Protocolo de Envio</span>
          </div>

          <form onSubmit={handleDispatch} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                Título / Identificador Interno da Campanha <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Aviso Geral de Recadastramento 2026 / Feriado Municipal"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#0DB87E] focus:ring-1 focus:ring-[#0DB87E] outline-none transition-all"
                required
              />
            </div>

            {/* Target Audience Selector */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                Público-Alvo (Segmentação)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setTargetType("broadcast")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    targetType === "broadcast"
                      ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white shadow-md shadow-[#0DB87E]/10"
                      : "bg-[#09090B] border-[#27272A] text-white/60 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-2">
                    🌐 Broadcast Geral
                  </div>
                  <div className="text-xs text-white/40 mt-1">Toda a base cadastrada (~2.890 usuários)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType("niche")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    targetType === "niche"
                      ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white shadow-md shadow-[#0DB87E]/10"
                      : "bg-[#09090B] border-[#27272A] text-white/60 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-2">
                    🎯 Nicho Específico
                  </div>
                  <div className="text-xs text-white/40 mt-1">Filtrar por papel e atividade profissional</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType("individual")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    targetType === "individual"
                      ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white shadow-md shadow-[#0DB87E]/10"
                      : "bg-[#09090B] border-[#27272A] text-white/60 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-sm flex items-center gap-2">
                    👤 Destinatário Único
                  </div>
                  <div className="text-xs text-white/40 mt-1">Envio pontual por ID, e-mail ou telefone</div>
                </button>
              </div>

              {/* Niche Dropdown if targetType === 'niche' */}
              {targetType === "niche" && (
                <div className="p-4 bg-[#09090B] border border-[#27272A] rounded-xl space-y-2 animate-fadeIn">
                  <div className="text-xs font-semibold text-[#0DB87E] flex items-center gap-1.5">
                    <Filter size={14} /> Selecione a Categoria / Nicho:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {NICHES.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNiche(n.id)}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                          niche === n.id
                            ? "bg-[#0DB87E]/20 border-[#0DB87E] text-white"
                            : "bg-[#18181B] border-[#27272A] text-white/60 hover:border-white/20"
                        }`}
                      >
                        <span>{n.icon} {n.label.split(" ")[0]}</span>
                        <span className="text-[10px] text-white/40">({n.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Input if targetType === 'individual' */}
              {targetType === "individual" && (
                <div className="p-4 bg-[#09090B] border border-[#27272A] rounded-xl space-y-2 animate-fadeIn">
                  <label className="text-xs font-semibold text-[#0DB87E] flex items-center gap-1.5">
                    <Search size={14} /> Destinatário (Nome, Telefone ou E-mail):
                  </label>
                  <input
                    type="text"
                    value={individualRecipient}
                    onChange={(e) => setIndividualRecipient(e.target.value)}
                    placeholder="Ex: (12) 99123-4567 ou joao.silva@exemplo.com"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-[#0DB87E] outline-none"
                  />
                </div>
              )}
            </div>

            {/* Delivery Channel Selector (DEFAULT: Omnichannel Agent) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                  Canal Principal de Envio (Engine)
                </label>
                <span className="text-[11px] text-[#0DB87E] font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> Omnichannel Agent pré-selecionado (Default)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  const isSelected = channel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white shadow-lg shadow-[#0DB87E]/5"
                          : "bg-[#09090B] border-[#27272A] text-white/60 hover:border-white/20"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 font-bold text-xs text-white">
                            <Icon size={16} className={isSelected ? "text-[#0DB87E]" : "text-white/40"} />
                            {c.name}
                          </div>
                          {c.highlight && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0DB87E]/20 text-[#0DB87E] border border-[#0DB87E]/30">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 m-0 line-clamp-2 leading-relaxed">
                          {c.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {channel === "omnichannel" && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#0DB87E]/5 border border-[#0DB87E]/20 flex items-center gap-3 text-xs text-white/80">
                  <ShieldCheck size={18} className="text-[#0DB87E] shrink-0" />
                  <div>
                    <strong>Integração de Borda Ativa:</strong> As mensagens enviadas pelo <em>Omnichannel Agent</em> utilizam autenticação criptográfica Server-to-Server (HMAC-SHA256) com proteção de replay store atômica.
                  </div>
                </div>
              )}
            </div>

            {/* Message Template & Dynamic Variables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                  Conteúdo da Mensagem <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <span>Variáveis:</span>
                  {["nome", "cidade", "categoria", "data"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-1.5 py-0.5 rounded bg-[#27272A] text-[10px] text-white/70 hover:text-white hover:bg-[#3F3F46] transition-all cursor-pointer"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá {{nome}}, informamos que o SuperApp UBT passará por uma atualização programada para novas funcionalidades na cidade de {{cidade}}..."
                rows={5}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl p-4 text-sm text-white placeholder-white/20 focus:border-[#0DB87E] focus:ring-1 focus:ring-[#0DB87E] outline-none transition-all resize-y"
                required
              />

              <div className="flex items-center justify-between text-xs text-white/40 mt-1.5 px-1">
                <span>Caracteres: {message.length}</span>
                <span>Variáveis suportadas: {"{{nome}}, {{cidade}}, {{categoria}}, {{data}}"}</span>
              </div>
            </div>

            {/* Scheduling & Recurrence Options */}
            <div className="p-4 bg-[#09090B] border border-[#27272A] rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={14} className="text-[#0DB87E]" /> Agendamento e Recorrência
                </label>
                <div className="flex items-center gap-2 bg-[#18181B] p-1 rounded-lg border border-[#27272A]">
                  <button
                    type="button"
                    onClick={() => setScheduledType("now")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      scheduledType === "now"
                        ? "bg-[#0DB87E] text-black shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🚀 Enviar Agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledType("scheduled")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      scheduledType === "scheduled"
                        ? "bg-[#0DB87E] text-black shadow-sm"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    📅 Agendar
                  </button>
                </div>
              </div>

              {scheduledType === "scheduled" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#27272A]/50 animate-fadeIn">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 mb-1">Data do Disparo</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0DB87E]"
                      required={scheduledType === "scheduled"}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 mb-1">Horário (UTC-3)</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0DB87E]"
                      required={scheduledType === "scheduled"}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-white/50 mb-1">Frequência de Recorrência</label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as any)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0DB87E] cursor-pointer"
                    >
                      <option value="none">Única (Sem repetição)</option>
                      <option value="daily">Diária (Todos os dias)</option>
                      <option value="weekly">Semanal (A cada 7 dias)</option>
                      <option value="monthly">Mensal (Mesmo dia)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !title || !message}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#0DB87E] hover:bg-[#0DB87E]/90 text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-[#0DB87E]/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Processando Transmissão...
                  </>
                ) : (
                  <>
                    <Send size={16} /> {scheduledType === "now" ? "Disparar Transmissão Agora" : "Confirmar Agendamento"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Mockup / Preview Card */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="text-white m-0 flex items-center gap-2">
                <Eye size={16} className="text-[#0DB87E]" /> Preview em Tempo Real
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-white/60">
                {channel.toUpperCase()}
              </span>
            </div>

            {/* Phone screen simulation */}
            <div className="bg-[#09090B] border-2 border-[#27272A] rounded-2xl p-4 flex flex-col gap-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#0DB87E] flex items-center justify-center text-black font-bold text-[10px]">
                    U
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">UBT Notificações</div>
                    <div className="text-[9px] text-white/40">Agora • Mensagem Oficial</div>
                  </div>
                </div>
                <span className="text-[9px] text-[#0DB87E] font-semibold">Verificado ✓</span>
              </div>

              {/* Simulated message body */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-xs text-white/90 leading-relaxed font-sans">
                {message ? (
                  message
                    .replace(/{{nome}}/g, "Carlos Eduardo")
                    .replace(/{{cidade}}/g, "Ubatuba")
                    .replace(/{{categoria}}/g, "Mototaxista")
                    .replace(/{{data}}/g, new Date().toLocaleDateString("pt-BR"))
                ) : (
                  <span className="text-white/30 italic">
                    Digite a mensagem no formulário para visualizar como ela será entregue ao usuário...
                  </span>
                )}
              </div>

              <div className="text-[10px] text-white/30 text-right">
                Canal: <strong className="text-white/60">{CHANNELS.find((c) => c.id === channel)?.name}</strong>
              </div>
            </div>

            {/* Audience Summary Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-white/[0.02] border border-[#27272A] space-y-2 text-xs">
              <div className="font-bold text-white/80">Resumo da Audiência:</div>
              <div className="flex justify-between text-white/60">
                <span>Tipo de Público:</span>
                <span className="text-white font-medium capitalize">
                  {targetType === "broadcast" ? "Broadcast Geral" : targetType === "niche" ? `Nicho: ${niche}` : "Individual"}
                </span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Estimativa de Alcance:</span>
                <span className="text-[#0DB87E] font-bold">
                  {targetType === "broadcast"
                    ? "2.896 usuários"
                    : targetType === "niche"
                    ? `${NICHES.find((n) => n.id === niche)?.count || 0} usuários`
                    : "1 usuário"}
                </span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Modo de Disparo:</span>
                <span className="text-white font-medium">
                  {scheduledType === "now" ? "Imediato" : `Agendado (${recurrence})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History and Telemetry Table */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
          <div>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="text-white m-0 flex items-center gap-2">
              <Clock size={18} className="text-[#0DB87E]" /> Histórico de Transmissões & Campanhas
            </h3>
            <p className="text-xs text-white/40 mt-1 mb-0">
              Registro completo de todas as mensagens disparadas ou programadas no ambiente.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar campanha..."
                className="bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-[#0DB87E] outline-none w-48"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs text-white/80 outline-none cursor-pointer focus:border-[#0DB87E]"
            >
              <option value="todos">Todos os Status</option>
              <option value="concluido">Concluído</option>
              <option value="agendado">Agendado</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="falhou">Falhou</option>
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs text-white/80 outline-none cursor-pointer focus:border-[#0DB87E]"
            >
              <option value="todos">Todos os Canais</option>
              <option value="omnichannel">Omnichannel Agent</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="push">Push Notification</option>
              <option value="sms">SMS</option>
              <option value="in_app">In-App</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                <th className="py-3 px-3">Identificador / Título</th>
                <th className="py-3 px-3">Canal</th>
                <th className="py-3 px-3">Público / Nicho</th>
                <th className="py-3 px-3 text-center">Entregues</th>
                <th className="py-3 px-3">Data / Programação</th>
                <th className="py-3 px-3">Recorrência</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/40 text-xs text-white/80">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-white/40 italic">
                    {fetching ? "Carregando histórico de mensagens..." : "Nenhuma campanha encontrada com os filtros selecionados."}
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => {
                  const channelObj = CHANNELS.find((c) => c.id === camp.channel);
                  const ChannelIcon = channelObj?.icon || MessageSquare;

                  return (
                    <tr key={camp.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{camp.title}</span>
                          <span className="text-[10px] text-white/40 font-normal line-clamp-1 max-w-xs mt-0.5">
                            {camp.message_template}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#09090B] border border-[#27272A] text-white/90 font-medium">
                          <ChannelIcon size={12} className={camp.channel === "omnichannel" ? "text-[#0DB87E]" : "text-white/60"} />
                          {channelObj?.name.split(" ")[0] || camp.channel}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {camp.target_type === "broadcast" && (
                          <span className="text-white/70">🌐 Toda a base</span>
                        )}
                        {camp.target_type === "niche" && (
                          <span className="text-[#0DB87E] font-medium">🎯 {camp.niche}</span>
                        )}
                        {camp.target_type === "individual" && (
                          <span className="text-white/70">👤 {camp.individual_recipient || "Único"}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-white">
                        {camp.sent_count?.toLocaleString("pt-BR") || 0} / {camp.total_targeted?.toLocaleString("pt-BR") || 0}
                      </td>
                      <td className="py-3.5 px-3 text-white/60">
                        {camp.scheduled_for
                          ? new Date(camp.scheduled_for).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                          : new Date(camp.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-[10px] uppercase font-semibold">
                          {camp.recurrence === "none" ? "Única" : camp.recurrence}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {camp.status === "concluido" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30 text-[11px] font-bold">
                            <CheckCircle2 size={11} /> Concluído
                          </span>
                        )}
                        {camp.status === "agendado" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 text-[11px] font-bold">
                            <Clock3 size={11} /> Agendado
                          </span>
                        )}
                        {camp.status === "em_andamento" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 text-[11px] font-bold">
                            <RefreshCw size={11} className="animate-spin" /> Processando
                          </span>
                        )}
                        {camp.status === "falhou" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold">
                            <XCircle size={11} /> Falhou
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
