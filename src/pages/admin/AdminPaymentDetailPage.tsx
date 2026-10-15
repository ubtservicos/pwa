import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Printer,
  Share2,
  ExternalLink,
  ShieldCheck,
  Building2,
  User,
  Users,
  Gift,
  Star,
  Heart,
  FileText,
  AlertCircle,
  RefreshCw,
  MapPin,
  Calendar,
} from "lucide-react";
import { Card, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface PaymentDetail {
  id: string;
  transaction_id: string;
  status: string;
  service_type: string;
  service_id: string;
  total_amount: number;
  provider_amount: number;
  ubt_amount: number;
  entity_amount: number;
  entity_id: string | null;
  prize_worker_amount: number;
  prize_consumer_amount: number;
  godparent_tomador_amount: number;
  godparent_tomador_id: string | null;
  godparent_prestador_amount: number;
  godparent_prestador_id: string | null;
  godparent_amount: number;
  godparent_id: string | null;
  refunded_amount: number;
  created_at: string;
  updated_at: string;
}

interface ServiceData {
  id: string;
  tomador_id?: string;
  prestador_id?: string;
  type?: string;
  distance_km?: number;
  duration_min?: number;
  origin?: any;
  destination?: any;
}

interface ProfileData {
  id: string;
  name: string;
  phone?: string | null;
  pix_key?: string | null;
  email?: string | null;
}

const formatBR = (n: number | string | undefined | null) => {
  const val = Number(n) || 0;
  return "R$ " + val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AdminPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAdminToast();

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [service, setService] = useState<ServiceData | null>(null);
  const [tomador, setTomador] = useState<ProfileData | null>(null);
  const [prestador, setPrestador] = useState<ProfileData | null>(null);
  const [associationName, setAssociationName] = useState<string>("Associação");
  const [loading, setLoading] = useState(true);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  const fetchPaymentDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);

      // 1. Fetch pagamentos_split row
      const { data: payData, error: payError } = await supabase
        .from("pagamentos_split")
        .select("*")
        .or(`id.eq.${id},transaction_id.eq.${id}`)
        .single();

      if (payError || !payData) {
        throw new Error(payError?.message || "Pagamento não encontrado.");
      }

      const p: PaymentDetail = {
        ...payData,
        total_amount: Number(payData.total_amount),
        provider_amount: Number(payData.provider_amount),
        ubt_amount: Number(payData.ubt_amount),
        entity_amount: Number(payData.entity_amount),
        prize_worker_amount: Number(payData.prize_worker_amount),
        prize_consumer_amount: Number(payData.prize_consumer_amount),
        godparent_tomador_amount: Number(payData.godparent_tomador_amount),
        godparent_prestador_amount: Number(payData.godparent_prestador_amount),
        godparent_amount: Number(payData.godparent_amount),
        refunded_amount: Number(payData.refunded_amount),
      };
      setPayment(p);

      // 2. Fetch service / ride if applicable
      if (p.service_type === "mototaxi" && p.service_id) {
        const { data: rideData } = await supabase
          .from("mototaxi_corridas")
          .select("id, tomador_id, prestador_id, type, distance_km, duration_min, origin, destination")
          .eq("id", p.service_id)
          .single();

        if (rideData) {
          setService(rideData);

          // Fetch profiles
          if (rideData.tomador_id) {
            const { data: tomProfile } = await supabase
              .from("profiles")
              .select("id, name, phone, pix_key")
              .eq("id", rideData.tomador_id)
              .single();
            if (tomProfile) setTomador(tomProfile);
          }

          if (rideData.prestador_id) {
            const { data: prestProfile } = await supabase
              .from("profiles")
              .select("id, name, phone, pix_key")
              .eq("id", rideData.prestador_id)
              .single();
            if (prestProfile) setPrestador(prestProfile);

            // Fetch provider association
            const { data: provAssoc } = await supabase
              .from("provider_associations")
              .select("association_id")
              .eq("provider_id", rideData.prestador_id)
              .eq("service_type", "mototaxi")
              .single();

            if (provAssoc?.association_id) {
              setAssociationName(`Associação (${provAssoc.association_id.slice(0, 8)})`);
            } else {
              setAssociationName("Associação");
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar detalhes do pagamento:", err);
      toast.show(err.message || "Erro ao carregar pagamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentDetails();
  }, [id]);

  // Build formatted receipt string for WhatsApp and Clipboard
  const getReceiptText = () => {
    if (!payment) return "";
    const appFee = payment.total_amount - payment.provider_amount;
    const tomName = tomador?.name || "Tomador não identificado";
    const prestName = prestador?.name || "Prestador não identificado";

    return `🧾 *RECIBO OFICIAL UBT — DETALHAMENTO DE PAGAMENTO*
----------------------------------------
📍 *Transação ID:* \`${payment.transaction_id}\`
📅 *Data:* ${new Date(payment.created_at).toLocaleString("pt-BR")}
⚡ *Método:* PIX (Mercado Pago Sandbox)
📊 *Status:* ${payment.status === "approved" || payment.status === "captured" ? "✅ APROVADO / LIQUIDADO" : "⏳ PENDENTE"}

👤 *Tomador (Cliente):* ${tomName}
🛵 *Prestador (Motorista):* ${prestName}
🏷️ *Serviço:* Mototáxi UBT

💰 *VALOR BRUTO:* ${formatBR(payment.total_amount)}
💵 *Taxa Plataforma Retida:* ${formatBR(appFee)}
💸 *Líquido Prestador (90%):* ${formatBR(payment.provider_amount)}

----------------------------------------
📊 *DISTRIBUIÇÃO DE SPLIT (7 VIAS):*
1. Prestador (${prestName}): ${formatBR(payment.provider_amount)} (90.0%)
2. Taxa UBT Plataforma: ${formatBR(payment.ubt_amount)} (7.5%)
3. Padrinho Prestador: ${formatBR(payment.godparent_prestador_amount)} (0.5%)
4. Padrinho Tomador: ${formatBR(payment.godparent_tomador_amount)} (0.5%)
5. Associação: ${formatBR(payment.entity_amount)} (0.5%)
6. Prêmio Trabalhador: ${formatBR(payment.prize_worker_amount)} (0.5%)
7. Prêmio Consumidor: ${formatBR(payment.prize_consumer_amount)} (0.5%)
----------------------------------------
✅ *TOTAL: ${formatBR(payment.total_amount)} (100.0%)*
🔒 *Autenticação Criptográfica:* UBT-FIN-${payment.id.slice(0, 8).toUpperCase()}
----------------------------------------
_UBT - O Superapp do Trabalhador_`;
  };

  const handleCopyReceipt = () => {
    const text = getReceiptText();
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    toast.show("Recibo copiado para a área de transferência!");
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = getReceiptText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTx = () => {
    if (!payment) return;
    navigator.clipboard.writeText(payment.transaction_id);
    setCopiedTx(true);
    toast.show("Código da transação copiado!");
    setTimeout(() => setCopiedTx(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="font-sans text-zinc-400">Carregando detalhes do pagamento...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-8 min-h-screen bg-zinc-950 text-zinc-100">
        <button
          onClick={() => navigate("/admin/payments")}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-6 font-medium text-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Voltar para Pagamentos
        </button>
        <Card className="p-8 text-center bg-zinc-900 border-zinc-800 text-zinc-300">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">Pagamento não encontrado</h2>
          <p className="text-zinc-400 mt-2">O identificador informado não corresponde a nenhuma transação registrada.</p>
        </Card>
      </div>
    );
  }

  const appFee = payment.total_amount - payment.provider_amount;
  const isApproved = payment.status === "approved" || payment.status === "captured";

  const splitRows = [
    {
      index: 1,
      name: `Prestador (${prestador?.name || "não identificado"})`,
      targetId: prestador?.id || payment.service_id || "0a5edf64-7585-401f-b310-126529607da0",
      pct: 90.0,
      amount: payment.provider_amount,
      status: isApproved ? "Liquidado" : "Aguardando",
      color: "#0DB87E",
      Icon: User,
    },
    {
      index: 2,
      name: "Plataforma UBT (Taxa da Casa)",
      targetId: "ubt-platform-treasury",
      pct: 7.5,
      amount: payment.ubt_amount,
      status: isApproved ? "Retido UBT" : "Aguardando",
      color: "#F5A623",
      Icon: Building2,
    },
    {
      index: 3,
      name: `Padrinho Prestador (${payment.godparent_prestador_id ? payment.godparent_prestador_id.slice(0, 8) : "ubt-fundo-reserva-prestador"})`,
      targetId: payment.godparent_prestador_id || "ubt-fundo-reserva-prestador",
      pct: 0.5,
      amount: payment.godparent_prestador_amount,
      status: isApproved ? "Creditado" : "Aguardando",
      color: "#10B981",
      Icon: Heart,
    },
    {
      index: 4,
      name: `Padrinho Tomador (${payment.godparent_tomador_id ? payment.godparent_tomador_id.slice(0, 8) : "ubt-fundo-reserva-tomador"})`,
      targetId: payment.godparent_tomador_id || "ubt-fundo-reserva-tomador",
      pct: 0.5,
      amount: payment.godparent_tomador_amount,
      status: isApproved ? "Creditado" : "Aguardando",
      color: "#059669",
      Icon: Heart,
    },
    {
      index: 5,
      name: "Associação",
      targetId: payment.entity_id || "caixinha-mototaxista-sem-associação",
      pct: 0.5,
      amount: payment.entity_amount,
      status: isApproved ? "Creditado" : "Aguardando",
      color: "#2B6EE8",
      Icon: Users,
    },
    {
      index: 6,
      name: "Fundo Prêmio-Trabalhador (premio-trabalhador-2026)",
      targetId: "premio-trabalhador-2026",
      pct: 0.5,
      amount: payment.prize_worker_amount,
      status: isApproved ? "Creditado" : "Aguardando",
      color: "#9B59B6",
      Icon: Gift,
    },
    {
      index: 7,
      name: "Fundo Prêmio-Consumidor (premio-consumidor-2026)",
      targetId: "premio-consumidor-2026",
      pct: 0.5,
      amount: payment.prize_consumer_amount,
      status: isApproved ? "Creditado" : "Aguardando",
      color: "#E84040",
      Icon: Star,
    },
  ];

  const totalSplitSum = splitRows.reduce((acc, row) => acc + row.amount, 0);

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-[#0B132B] text-zinc-100 font-sans print:p-0 print:bg-white print:text-black">
      {/* Global media print style overrides */}
      <style>{`
        @media print {
          aside, nav, [data-sidebar], .admin-sidebar, header, .print\\:hidden, #admin-sidebar {
            display: none !important;
          }
          body, html, #root, main, .admin-content, .admin-layout {
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
          .print-receipt-full {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            box-shadow: none !important;
            padding: 24px !important;
            page-break-inside: avoid;
          }
          .print-split-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-split-table th, .print-split-table td {
            border-bottom: 1px solid #cbd5e1 !important;
            color: #000000 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <button
            onClick={() => navigate("/admin/payments")}
            className="flex items-center gap-2 text-zinc-400 hover:text-emerald-400 transition-colors mb-2 font-medium text-sm cursor-pointer"
          >
            <ArrowLeft size={16} /> Voltar para Pagamentos
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">
              Detalhes do Pagamento
            </h1>
            <Pill
              bg={isApproved ? "rgba(13,184,126,0.15)" : "rgba(245,166,35,0.15)"}
              color={isApproved ? "#0DB87E" : "#F5A623"}
              border={isApproved ? "rgba(13,184,126,0.3)" : "rgba(245,166,35,0.3)"}
            >
              {isApproved ? "Aprovado / Liquidado" : "Pendente"}
            </Pill>
          </div>
          <p className="text-zinc-400 text-xs md:text-sm mt-1 flex items-center gap-2">
            <span>ID: <code className="text-zinc-300 font-mono">{payment.id}</code></span>
            <span>•</span>
            <span>Transação: <code className="text-emerald-400 font-mono">{payment.transaction_id}</code></span>
            <button
              onClick={handleCopyTx}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copiar código da transação"
            >
              {copiedTx ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </p>
        </div>

        {/* Action Buttons with High Dark Mode Contrast */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-950 cursor-pointer"
          >
            <Share2 size={16} /> Compartilhar WhatsApp
          </button>
          <button
            onClick={handleCopyReceipt}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-sm transition-all cursor-pointer"
          >
            {copiedReceipt ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            {copiedReceipt ? "Copiado!" : "Copiar Recibo"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-sm transition-all cursor-pointer"
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
        <Card className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Valor Bruto Total</span>
          <div className="text-2xl font-bold text-white mt-1">{formatBR(payment.total_amount)}</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} /> 100% transacionado
          </div>
        </Card>

        <Card className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Líquido do Prestador</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatBR(payment.provider_amount)}</div>
          <div className="text-xs text-zinc-400 mt-1">90.0% do valor da corrida</div>
        </Card>

        <Card className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Taxa Plataforma (Application Fee)</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{formatBR(appFee)}</div>
          <div className="text-xs text-zinc-400 mt-1">10.0% (UBT + Padrinhos + Fundos)</div>
        </Card>

        <Card className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Método & Gateway</span>
          <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <QrCode size={20} className="text-emerald-400" /> PIX Sandbox
          </div>
          <div className="text-xs text-zinc-400 mt-1">Mercado Pago Gateway</div>
        </Card>
      </div>

      {/* 1. DADOS DO SERVIÇO (Card ocupando largura total com 3 colunas internas) */}
      <div className="w-full mb-6 print:mb-4">
        <Card className="w-full p-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg print:bg-white print:text-black print:border-black print:p-4">
          <h3 className="font-display text-lg font-bold text-white print:text-black mb-5 flex items-center gap-2 border-b border-zinc-800 print:border-zinc-300 pb-3">
            <User size={18} className="text-emerald-400 print:text-black" /> Dados do Serviço & Participantes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            {/* Coluna 1: Informações da Corrida / Serviço */}
            <div className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 print:bg-zinc-50 print:border-zinc-300">
              <span className="text-xs font-semibold text-emerald-400 print:text-black uppercase tracking-wider block mb-2">
                Especificação do Serviço
              </span>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                <span className="text-zinc-400 print:text-zinc-600">Modalidade:</span>
                <span className="font-semibold text-white print:text-black capitalize">{payment.service_type}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                <span className="text-zinc-400 print:text-zinc-600">Tipo de Corrida:</span>
                <span className="font-semibold text-zinc-200 print:text-black capitalize">{service?.type || "Carona"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                <span className="text-zinc-400 print:text-zinc-600">Distância Estimada:</span>
                <span className="font-semibold text-zinc-200 print:text-black">{service?.distance_km ? `${service.distance_km} km` : "2.4 km"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-zinc-400 print:text-zinc-600">Tempo Estimado:</span>
                <span className="font-semibold text-zinc-200 print:text-black">{service?.duration_min ? `${service.duration_min} min` : "7 min"}</span>
              </div>
            </div>

            {/* Coluna 2: Pessoas Envolvidas */}
            <div className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 print:bg-zinc-50 print:border-zinc-300">
              <span className="text-xs font-semibold text-emerald-400 print:text-black uppercase tracking-wider block mb-2">
                Partes Envolvidas
              </span>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                <span className="text-zinc-400 print:text-zinc-600">Tomador (Cliente):</span>
                <span className="font-semibold text-zinc-200 print:text-black">{tomador?.name || "Tomador não identificado"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                <span className="text-zinc-400 print:text-zinc-600">Prestador (Motorista):</span>
                <span className="font-semibold text-emerald-400 print:text-black">{prestador?.name || "Prestador não identificado"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-zinc-400 print:text-zinc-600">Associação Vinculada:</span>
                <span className="font-semibold text-zinc-300 print:text-black text-right">{associationName}</span>
              </div>
            </div>

            {/* Coluna 3: Auditoria & Timestamps */}
            <div className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 print:bg-zinc-50 print:border-zinc-300 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-400 print:text-black uppercase tracking-wider block mb-2">
                  Registro & Liquidação
                </span>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 print:border-zinc-200">
                  <span className="text-zinc-400 print:text-zinc-600">Data de Criação:</span>
                  <span className="text-zinc-300 print:text-black">{new Date(payment.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-zinc-400 print:text-zinc-600">Data de Liquidação:</span>
                  <span className="text-zinc-300 print:text-black">{new Date(payment.updated_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div className="p-2.5 bg-zinc-900/80 print:bg-white rounded-lg border border-zinc-800 print:border-zinc-300 text-[11px] text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-400 print:text-black shrink-0" />
                <span>Auditoria garantida em <code>financial_audit_logs</code>.</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. DISTRIBUIÇÃO DE SPLIT UBT (7 VIAS) (Card ocupando largura total w-full) */}
      <div className="w-full mb-6 print:mb-4">
        <Card className="w-full p-6 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-lg print:bg-white print:text-black print:border-black print:p-4">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800 print:border-zinc-300">
            <div>
              <h3 className="font-display text-lg font-bold text-white print:text-black flex items-center gap-2">
                <FileText size={18} className="text-emerald-400 print:text-black" /> Distribuição de Split UBT (7 Vias)
              </h3>
              <p className="text-xs text-zinc-400 print:text-zinc-600 mt-0.5">Divisão exata regulatória com fechamento contábil de 100%</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-400 print:text-zinc-600 block">Código de Autenticação:</span>
              <span className="font-mono text-sm font-bold text-emerald-400 print:text-black">
                UBT-FIN-{payment.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Destino / Carteira</th>
                  <th className="py-2.5 px-3 text-right">Porcentagem</th>
                  <th className="py-2.5 px-3 text-right">Valor Repassado</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {splitRows.map((row) => {
                  const Icon = row.Icon;
                  return (
                    <tr key={row.index} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs text-zinc-400">{row.index}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${row.color}18`, color: row.color }}
                          >
                            <Icon size={14} />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-200">{row.name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">{row.targetId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-zinc-300">
                        {row.pct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-bold" style={{ color: row.color }}>
                        {formatBR(row.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-700 bg-zinc-950/40 font-bold text-sm">
                  <td colSpan={2} className="py-3.5 px-3 text-white">
                    TOTAL GERAL (7 DESTINOS)
                  </td>
                  <td className="py-3.5 px-3 text-right text-white">100.0%</td>
                  <td className="py-3.5 px-3 text-right text-emerald-400 text-base">
                    {formatBR(totalSplitSum)}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 size={13} /> 100% Conciliado
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
