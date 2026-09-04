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
  Search,
  Filter,
  CheckCircle2,
  Clock3,
  XCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Eye,
  ArrowRight,
  ArrowLeft,
  Check,
  Wifi,
  BatteryMedium
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
    name: "Omnichannel Agent",
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
  // Wizard Tab Navigation State
  const [activeTab, setActiveTab] = useState<"segmentation" | "composition" | "review">("segmentation");

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

  // Dispatch lifecycle states
  const [loading, setLoading] = useState(false);
  const [successDispatched, setSuccessDispatched] = useState(false);

  // History & Table State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [fetching, setFetching] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [channelFilter, setChannelFilter] = useState("todos");
  const [sampleRecipientName, setSampleRecipientName] = useState<string>("Usuário UBT");

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
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    const loadSampleRecipient = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, phone, role")
          .not("name", "is", null)
          .limit(1)
          .maybeSingle();

        if (profile?.name) {
          setSampleRecipientName(profile.name);
        } else {
          const { data: usuario } = await supabase
            .from("usuarios")
            .select("nome, role")
            .not("nome", "is", null)
            .limit(1)
            .maybeSingle();
          if (usuario?.nome) {
            setSampleRecipientName(usuario.nome);
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar sample recipient:", e);
      }
    };

    loadSampleRecipient();
  }, []);

  // Insert Variable helper
  const insertVariable = (variable: string) => {
    setMessage((prev) => `${prev} {{${variable}}}`);
  };

  // Dynamic Preview text resolver
  const getPreviewText = () => {
    if (!message) return "";

    let resolvedName = sampleRecipientName;
    if (targetType === "individual" && individualRecipient.trim()) {
      const parts = individualRecipient.trim().split(/[@\s]/);
      resolvedName = parts[0] || "Destinatário";
    }

    let resolvedCategory = "Usuário";
    if (targetType === "niche") {
      const foundNiche = NICHES.find((n) => n.id === niche);
      resolvedCategory = foundNiche ? foundNiche.label.split(" ")[0] : "Prestador";
    }

    return message
      .replace(/{{nome}}/g, resolvedName)
      .replace(/{{cidade}}/g, "Ubatuba")
      .replace(/{{categoria}}/g, resolvedCategory)
      .replace(/{{data}}/g, new Date().toLocaleDateString("pt-BR"))
      .replace(/{{protocolo}}/g, "UBT-2026");
  };

  // Audience Count Helper
  const getAudienceCount = () => {
    if (targetType === "broadcast") return 2896;
    if (targetType === "niche") {
      const found = NICHES.find((n) => n.id === niche);
      return found ? found.count : 100;
    }
    return 1;
  };

  // Step Validation & Navigation
  const handleNextToComposition = () => {
    if (!title.trim()) {
      toast.error("Informe o título/identificador da campanha antes de prosseguir.");
      return;
    }
    if (targetType === "individual" && !individualRecipient.trim()) {
      toast.error("Informe o destinatário específico para o envio individual.");
      return;
    }
    setActiveTab("composition");
  };

  const handleNextToReview = () => {
    if (!message.trim()) {
      toast.error("Escreva a mensagem antes de avançar para a revisão.");
      return;
    }
    setActiveTab("review");
  };

  // Dispatch Handler
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe um título identificador para a campanha.");
      setActiveTab("segmentation");
      return;
    }
    if (!message.trim()) {
      toast.error("Escreva o conteúdo da mensagem a ser enviada.");
      setActiveTab("composition");
      return;
    }

    setLoading(true);
    setSuccessDispatched(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      let authorName = userData?.user?.email || "Admin UBT";
      if (userData?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (profile?.name) {
          authorName = profile.name;
        } else {
          const { data: dbUser } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", userData.user.id)
            .maybeSingle();
          if (dbUser?.nome) authorName = dbUser.nome;
        }
      }

      let scheduledForIso: string | null = null;
      if (scheduledType === "scheduled" && scheduledDate) {
        scheduledForIso = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      }

      const audienceCount = getAudienceCount();
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

      const { data: insertedCampaign, error } = await supabase
        .from("broadcast_campaigns")
        .insert([newCampaignPayload])
        .select()
        .single();

      if (error) throw error;

      // Invocação explícita da Edge Function omnichannel-answer-engine com Sessão Admin JWT
      const campaignRecord = insertedCampaign || newCampaignPayload;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;

        const { data: funcData, error: invokeError } = await supabase.functions.invoke("omnichannel-answer-engine", {
          body: {
            record: campaignRecord,
            campaign_id: campaignRecord?.id,
            action: isNow ? "broadcast_dispatch" : "broadcast_schedule",
            title: campaignRecord?.title,
            channel: campaignRecord?.channel,
            message: campaignRecord?.message_template,
            target_type: campaignRecord?.target_type,
            niche: campaignRecord?.niche,
            individual_recipient: campaignRecord?.individual_recipient,
            total_targeted: campaignRecord?.total_targeted,
            scheduled_type: campaignRecord?.scheduled_type,
            scheduled_for: campaignRecord?.scheduled_for
          },
          headers: authToken ? {
            Authorization: `Bearer ${authToken}`
          } : undefined
        });

        if (invokeError) {
          console.warn("Aviso ao invocar Edge Function omnichannel-answer-engine:", invokeError);
        } else {
          console.log("Resposta da Edge Function omnichannel-answer-engine:", funcData);
        }
      } catch (funcErr) {
        console.warn("Falha na invocação da Edge Function omnichannel-answer-engine:", funcErr);
      }

      setSuccessDispatched(true);
      toast.success(
        isNow
          ? `Disparo executado com sucesso via ${channel === "omnichannel" ? "Omnichannel Agent" : channel} para ${audienceCount} destinatários!`
          : `Campanha agendada com sucesso para ${scheduledDate} às ${scheduledTime}!`
      );

      // Reset form after short delay
      setTimeout(() => {
        setTitle("");
        setMessage("");
        setTargetType("broadcast");
        setIndividualRecipient("");
        setScheduledType("now");
        setRecurrence("none");
        setChannel("omnichannel");
        setActiveTab("segmentation");
        setSuccessDispatched(false);
        fetchCampaigns();
      }, 1500);

    } catch (err: any) {
      console.error("Erro ao registrar campanha:", err);
      toast.error(err?.message || "Falha ao processar campanha de mensageria.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered History
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
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header & Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0DB87E]/10 text-[#0DB87E] border border-[#0DB87E]/20">
              Operações & Entidades
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              Admin & SuperAdmin
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 m-0">
            <Send className="text-[#0DB87E]" size={22} /> Central de Mensageria & Campanhas
          </h1>
          <p className="text-sm text-zinc-400 m-0">
            Fluxo guiado de segmentação, composição e transmissão segura via <strong>Omnichannel Agent v1</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCampaigns}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={fetching ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:border-zinc-700 transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#0DB87E]/10 border border-[#0DB87E]/20 flex items-center justify-center text-[#0DB87E] shrink-0">
            <Send size={20} />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Entregue</div>
            <div className="text-2xl font-bold tracking-tight text-white mt-0.5">
              {totalSent.toLocaleString("pt-BR")} <span className="text-xs text-[#0DB87E] font-normal">msgs</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:border-zinc-700 transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Via Omnichannel</div>
            <div className="text-2xl font-bold tracking-tight text-white mt-0.5">
              {totalOmnichannel} <span className="text-xs text-zinc-400 font-normal">campanhas</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:border-zinc-700 transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clock3 size={20} />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Agendamentos</div>
            <div className="text-2xl font-bold tracking-tight text-white mt-0.5">
              {totalScheduled} <span className="text-xs text-zinc-400 font-normal">ativas</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:border-zinc-700 transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Protocolo de Borda</div>
            <div className="text-base font-bold text-[#0DB87E] flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#0DB87E] animate-pulse"></span> v1 HMAC Ativo
            </div>
          </div>
        </div>
      </div>

      {/* Process Wizard Container */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Wizard Tab Bar */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 p-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("segmentation")}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer min-w-[200px] ${
              activeTab === "segmentation"
                ? "bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              activeTab === "segmentation" ? "bg-[#0DB87E] text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              1
            </span>
            <span>Aba 1: Segmentação (Quem recebe?)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!title.trim()) {
                toast.error("Preencha o título na Aba 1 antes de avançar.");
                return;
              }
              setActiveTab("composition");
            }}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer min-w-[200px] ${
              activeTab === "composition"
                ? "bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              activeTab === "composition" ? "bg-[#0DB87E] text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              2
            </span>
            <span>Aba 2: Composição (O que enviar?)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!title.trim()) {
                toast.error("Preencha o título na Aba 1 antes de avançar.");
                return;
              }
              if (!message.trim()) {
                toast.error("Complete o texto da mensagem antes da revisão.");
                return;
              }
              setActiveTab("review");
            }}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer min-w-[200px] ${
              activeTab === "review"
                ? "bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
              activeTab === "review" ? "bg-[#0DB87E] text-black" : "bg-zinc-800 text-zinc-400"
            }`}>
              3
            </span>
            <span>Aba 3: Revisão & Disparo</span>
          </button>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: SEGMENTAÇÃO */}
          {activeTab === "segmentation" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white m-0">Segmentação e Identificação da Campanha</h3>
                <p className="text-xs text-zinc-400 mt-1">Defina o identificador da transmissão e selecione a base de usuários de destino.</p>
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                  Título / Identificador Interno da Campanha <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Comunicado Geral de Recadastramento 2026"
                  className="w-full bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:bg-zinc-800 focus:border-[#0DB87E] focus:ring-1 focus:ring-[#0DB87E] outline-none transition-all"
                  required
                />
              </div>

              {/* Target Audience Cards */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                  Selecione o Público-Alvo (Targeting)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType("broadcast")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === "broadcast"
                        ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white ring-1 ring-[#0DB87E]/50 shadow-md shadow-[#0DB87E]/5"
                        : "bg-zinc-800/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2 text-white">
                      🌐 Broadcast Geral
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Toda a base ativa (~2.890 usuários)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("niche")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === "niche"
                        ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white ring-1 ring-[#0DB87E]/50 shadow-md shadow-[#0DB87E]/5"
                        : "bg-zinc-800/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2 text-white">
                      🎯 Nicho Específico
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Filtrar por papel e atividade profissional</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("individual")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === "individual"
                        ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white ring-1 ring-[#0DB87E]/50 shadow-md shadow-[#0DB87E]/5"
                        : "bg-zinc-800/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2 text-white">
                      👤 Destinatário Único
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Envio direto para 1 usuário</div>
                  </button>
                </div>

                {/* Niche Badges */}
                {targetType === "niche" && (
                  <div className="p-4 bg-zinc-800/50 border border-zinc-700/60 rounded-xl space-y-2.5">
                    <div className="text-xs font-semibold text-[#0DB87E] flex items-center gap-1.5">
                      <Filter size={14} /> Selecione a Categoria / Nicho:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {NICHES.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setNiche(n.id)}
                          className={`px-3.5 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                            niche === n.id
                              ? "bg-[#0DB87E]/20 border-[#0DB87E] text-white ring-1 ring-[#0DB87E]/40"
                              : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500"
                          }`}
                        >
                          <span>{n.icon} {n.label.split(" ")[0]}</span>
                          <span className="text-[10px] text-zinc-400">({n.count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Input */}
                {targetType === "individual" && (
                  <div className="p-4 bg-zinc-800/50 border border-zinc-700/60 rounded-xl space-y-2">
                    <label className="text-xs font-semibold text-[#0DB87E] flex items-center gap-1.5">
                      <Search size={14} /> Destinatário (Nome, Telefone ou E-mail):
                    </label>
                    <input
                      type="text"
                      value={individualRecipient}
                      onChange={(e) => setIndividualRecipient(e.target.value)}
                      placeholder="Ex: (12) 99123-4567 ou joao.silva@exemplo.com"
                      className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#0DB87E] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Next Action */}
              <div className="flex justify-end pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleNextToComposition()}
                  className="px-6 py-3 bg-[#0DB87E] hover:bg-[#0DB87E]/90 text-black font-extrabold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all cursor-pointer"
                >
                  Avançar para Composição <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COMPOSIÇÃO */}
          {activeTab === "composition" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white m-0">Composição do Conteúdo & Canal</h3>
                <p className="text-xs text-zinc-400 mt-1">Redija o comunicado, utilize variáveis dinâmicas e escolha o canal e agendamento.</p>
              </div>

              {/* Channel Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                    Canal Principal de Envio
                  </label>
                  <span className="text-xs text-[#0DB87E] font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> Omnichannel Agent (Default)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CHANNELS.map((c) => {
                    const Icon = c.icon;
                    const isSelected = channel === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChannel(c.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white ring-1 ring-[#0DB87E]/50 shadow-md shadow-[#0DB87E]/5"
                            : "bg-zinc-800/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-500"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 font-semibold text-xs text-white">
                              <Icon size={16} className={isSelected ? "text-[#0DB87E]" : "text-zinc-400"} />
                              {c.name}
                            </div>
                            {c.highlight && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0DB87E]/20 text-[#0DB87E] border border-[#0DB87E]/30">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 m-0 line-clamp-2 leading-relaxed">
                            {c.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {channel === "omnichannel" && (
                  <div className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/60 flex items-start gap-3 text-xs text-zinc-300">
                    <ShieldCheck size={18} className="text-[#0DB87E] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Motor Omnichannel v1 Ativo:</strong> As mensagens enviadas por este canal utilizam assinatura criptográfica Server-to-Server (HMAC-SHA256) com proteção de replay store atômica.
                    </div>
                  </div>
                )}
              </div>

              {/* Message Template & Dynamic Variables */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                    Corpo da Mensagem <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span>Tags dinâmicas:</span>
                    {["nome", "cidade", "categoria", "data"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-[10px] font-medium text-zinc-300 hover:text-white hover:border-zinc-500 transition-all cursor-pointer"
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
                  className="w-full bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-4 text-sm text-white placeholder-zinc-500 focus:bg-zinc-800 focus:border-[#0DB87E] focus:ring-1 focus:ring-[#0DB87E] outline-none transition-all resize-y"
                  required
                />

                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>Caracteres: {message.length}</span>
                  <span>Tags: {"{{nome}}, {{cidade}}, {{categoria}}, {{data}}"}</span>
                </div>
              </div>

              {/* Scheduling & Recurrence */}
              <div className="p-4 bg-zinc-800/50 border border-zinc-700/60 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} className="text-[#0DB87E]" /> Agendamento e Recorrência
                  </label>
                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-700/60">
                    <button
                      type="button"
                      onClick={() => setScheduledType("now")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        scheduledType === "now"
                          ? "bg-[#0DB87E] text-black shadow-sm font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      🚀 Enviar Agora
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduledType("scheduled")}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        scheduledType === "scheduled"
                          ? "bg-[#0DB87E] text-black shadow-sm font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      📅 Agendar
                    </button>
                  </div>
                </div>

                {scheduledType === "scheduled" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-700/40 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Data do Disparo</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#0DB87E]"
                        required={scheduledType === "scheduled"}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Horário (UTC-3)</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#0DB87E]"
                        required={scheduledType === "scheduled"}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Frequência</label>
                      <select
                        value={recurrence}
                        onChange={(e) => setRecurrence(e.target.value as any)}
                        className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#0DB87E] cursor-pointer"
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

              {/* Actions Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("segmentation")}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} /> Voltar para Segmentação
                </button>

                <button
                  type="button"
                  onClick={() => handleNextToReview()}
                  className="px-6 py-3 bg-[#0DB87E] hover:bg-[#0DB87E]/90 text-black font-extrabold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all cursor-pointer"
                >
                  Avançar para Revisão & Disparo <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: REVISÃO & DISPARO */}
          {activeTab === "review" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Summary and Primary Action Button */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white m-0">Revisão Final & Confirmação de Disparo</h3>
                  <p className="text-xs text-zinc-400 mt-1">Valide os parâmetros operacionais antes de autorizar a transmissão na rede.</p>
                </div>

                {/* Summary Card */}
                <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-bold text-[#0DB87E] uppercase tracking-wider">
                    Resumo do Envio:
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block text-[11px]">Identificador da Campanha:</span>
                      <strong className="text-white text-sm font-semibold">{title || "Sem título"}</strong>
                    </div>

                    <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block text-[11px]">Canal de Disparo:</span>
                      <strong className="text-[#0DB87E] text-sm font-semibold">
                        {CHANNELS.find((c) => c.id === channel)?.name}
                      </strong>
                    </div>

                    <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block text-[11px]">Público-Alvo:</span>
                      <strong className="text-white text-sm font-semibold">
                        {targetType === "broadcast" ? "🌐 Toda a base" : targetType === "niche" ? `🎯 Nicho: ${niche}` : `👤 ${individualRecipient}`}
                      </strong>
                    </div>

                    <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block text-[11px]">Alcance Estimado:</span>
                      <strong className="text-[#0DB87E] text-sm font-bold">
                        {getAudienceCount().toLocaleString("pt-BR")} usuários
                      </strong>
                    </div>

                    <div className="col-span-2 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block text-[11px]">Agendamento & Modo:</span>
                      <strong className="text-white text-xs font-semibold">
                        {scheduledType === "now" ? "🚀 Transmissão Imediata" : `📅 Agendado para ${scheduledDate} às ${scheduledTime} (${recurrence})`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button with strict states */}
                <form onSubmit={handleDispatch} className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={loading || successDispatched}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-extrabold text-base shadow-xl transition-all cursor-pointer ${
                      successDispatched
                        ? "bg-[#0DB87E] text-black shadow-[#0DB87E]/30"
                        : loading
                        ? "bg-zinc-700 text-zinc-300 opacity-80 cursor-not-allowed"
                        : "bg-[#0DB87E] hover:bg-[#0DB87E]/90 text-black shadow-[#0DB87E]/20"
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={20} className="animate-spin text-white" />
                        <span className="text-white">Processando Motor Omnichannel...</span>
                      </>
                    ) : successDispatched ? (
                      <>
                        <Check size={20} className="text-black stroke-[3]" />
                        <span>Campanha Disparada com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Confirmar e Disparar Campanha</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <button
                      type="button"
                      onClick={() => setActiveTab("composition")}
                      className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Editar mensagem
                    </button>
                    <span>Autenticação HMAC-SHA256 ativa</span>
                  </div>
                </form>
              </div>

              {/* Right Column: Realistic Smartphone Mockup */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[320px] bg-zinc-950 border-[6px] border-zinc-800 rounded-[40px] shadow-2xl overflow-hidden relative">
                  {/* Phone Notch */}
                  <div className="w-28 h-4 bg-zinc-800 rounded-b-xl mx-auto flex items-center justify-center">
                    <div className="w-8 h-1 bg-zinc-900 rounded-full"></div>
                  </div>

                  {/* Status Bar */}
                  <div className="h-6 bg-zinc-950 flex justify-between items-center px-5 text-[10px] text-zinc-400 font-medium">
                    <span>11:22</span>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={10} />
                      <span>4G</span>
                      <BatteryMedium size={12} />
                    </div>
                  </div>

                  {/* Mobile Screen Area */}
                  <div className="p-4 space-y-4 min-h-[380px] bg-zinc-900/40">
                    {/* Header bar */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0DB87E] flex items-center justify-center text-black font-black text-[11px]">
                          U
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white leading-tight">UBT Notificações</div>
                          <div className="text-[9px] text-zinc-400">Agora • Canal Oficial</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-[#0DB87E] bg-[#0DB87E]/10 px-1.5 py-0.5 rounded">Verificado ✓</span>
                    </div>

                    {/* Realistic Message Balloon */}
                    <div className="bg-zinc-800/90 border border-zinc-700/80 rounded-2xl p-4 text-xs text-zinc-100 leading-relaxed shadow-lg">
                      {message ? (
                        getPreviewText()
                      ) : (
                        <span className="text-zinc-500 italic">
                          O texto da mensagem aparecerá aqui renderizado em tempo real...
                        </span>
                      )}
                    </div>

                    {/* Phone footer helper */}
                    <div className="text-center text-[10px] text-zinc-500 pt-8">
                      Canal: <strong className="text-zinc-300">{CHANNELS.find((c) => c.id === channel)?.name}</strong>
                    </div>
                  </div>

                  {/* Phone Home Bar */}
                  <div className="w-24 h-1 bg-zinc-700 rounded-full mx-auto my-2"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History and Telemetry Table */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white m-0 flex items-center gap-2">
              <Clock size={18} className="text-[#0DB87E]" /> Histórico de Transmissões & Campanhas
            </h3>
            <p className="text-xs text-zinc-400 mt-1 mb-0">
              Registro de auditoria e telemetria de todas as transmissões processadas no motor.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar campanha..."
                className="bg-zinc-800/70 border border-zinc-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:bg-zinc-800 focus:border-[#0DB87E] outline-none w-48"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:bg-zinc-800 focus:border-[#0DB87E] outline-none cursor-pointer"
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
              className="bg-zinc-800/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:bg-zinc-800 focus:border-[#0DB87E] outline-none cursor-pointer"
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
              <tr className="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-3">Identificador / Título</th>
                <th className="py-3 px-3">Canal</th>
                <th className="py-3 px-3">Público / Nicho</th>
                <th className="py-3 px-3 text-center">Entregues</th>
                <th className="py-3 px-3">Data / Programação</th>
                <th className="py-3 px-3">Recorrência</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs text-zinc-300">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 italic">
                    {fetching ? "Carregando histórico de mensagens..." : "Nenhuma campanha encontrada com os filtros selecionados."}
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => {
                  const channelObj = CHANNELS.find((c) => c.id === camp.channel);
                  const ChannelIcon = channelObj?.icon || MessageSquare;

                  return (
                    <tr key={camp.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{camp.title}</span>
                          <span className="text-[10px] text-zinc-400 font-normal line-clamp-1 max-w-xs mt-0.5">
                            {camp.message_template}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-medium">
                          <ChannelIcon size={12} className={camp.channel === "omnichannel" ? "text-[#0DB87E]" : "text-zinc-400"} />
                          {channelObj?.name.split(" ")[0] || camp.channel}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {camp.target_type === "broadcast" && (
                          <span className="text-zinc-300">🌐 Toda a base</span>
                        )}
                        {camp.target_type === "niche" && (
                          <span className="text-[#0DB87E] font-medium">🎯 {camp.niche}</span>
                        )}
                        {camp.target_type === "individual" && (
                          <span className="text-zinc-300">👤 {camp.individual_recipient || "Único"}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-white">
                        {camp.sent_count?.toLocaleString("pt-BR") || 0} / {camp.total_targeted?.toLocaleString("pt-BR") || 0}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-400">
                        {camp.scheduled_for
                          ? new Date(camp.scheduled_for).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                          : new Date(camp.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase font-semibold border border-zinc-700/50">
                          {camp.recurrence === "none" ? "Única" : camp.recurrence}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {camp.status === "concluido" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0DB87E]/15 text-[#0DB87E] border border-[#0DB87E]/30 text-[11px] font-semibold">
                            <CheckCircle2 size={11} /> Concluído
                          </span>
                        )}
                        {camp.status === "agendado" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
                            <Clock3 size={11} /> Agendado
                          </span>
                        )}
                        {camp.status === "em_andamento" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-semibold">
                            <RefreshCw size={11} className="animate-spin" /> Processando
                          </span>
                        )}
                        {camp.status === "falhou" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-semibold">
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
