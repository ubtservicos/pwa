import { useMemo, useState, useEffect } from "react";
import {
  Download,
  TrendingUp,
  Clock,
  Hash,
  Percent,
  Award,
  Gift,
  Building2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Heart,
  Sliders,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

// Types matching the system domain
type Periodo = "semana" | "mes" | "ano" | "todos";
type ActiveTab = "geral" | "split" | "categories" | "entities";

interface TransactionRow {
  id: string;
  date: string;
  category: "Mototáxi" | "Diarista" | "Ambulante" | "Reciclagem";
  type: "entrada" | "saida" | "split" | "doacao";
  description: string;
  amount: number;
  status: "confirmed" | "pending" | "cancelled";
  recipient?: string;
}

// Fixed baseline volume of R$ 54,200.00 to show populated dashboard
const BASELINE_VOLUME = 54200.00;

// Hardcoded entities for the collective donations
const ENTITIES = [
  { name: "Lar dos Velhinhos de Ubatuba", sigla: "LVU", weight: 0.50, color: "#9B59B6" },
  { name: "Recicla Ubatuba Coletivo", sigla: "RUC", weight: 0.30, color: "#2B6EE8" },
  { name: "Santa Casa de Ubatuba", sigla: "SCU", weight: 0.20, color: "#0DB87E" }
];

// Helper to generate historical baseline transactions to populate charts realistically
const generateBaselineTransactions = (): TransactionRow[] => {
  const txs: TransactionRow[] = [];
  const categories: TransactionRow["category"][] = ["Mototáxi", "Diarista", "Ambulante", "Reciclagem"];
  const descriptions: Record<string, string[]> = {
    "Mototáxi": ["Corrida - Centro para Praia Grande", "Carona Express - Itaguá", "Entrega de Encomenda - Perequê-Açu", "Corrida - Toninhas"],
    "Diarista": ["Limpa Completa - Apt 12 Centro", "Serviço de Limpeza - Res. Praia Dura", "Diarista - Casa de Veraneio Tenório"],
    "Ambulante": ["Venda de Coco Gelado - Quiosque", "Porção de Milho Cozido - Areia", "Venda de Pamonha Doce - Praia Grande"],
    "Reciclagem": ["Coleta Coletiva - Côco & Cia", "Descarte Vidro - Ponto Centro", "Entrega Sucata Triagem"]
  };

  // Generate 120 transactions over the last 30 days
  const now = new Date();
  for (let i = 0; i < 120; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - Math.floor(i / 4));
    date.setHours(8 + (i % 12), (i * 13) % 60, 0, 0);

    const category = categories[i % 4];
    const descList = descriptions[category];
    const description = descList[i % descList.length];

    let amount = 0;
    if (category === "Diarista") amount = 140 + (i * 17) % 180;
    else if (category === "Mototáxi") amount = 12 + (i * 7) % 35;
    else if (category === "Ambulante") amount = 7 + (i * 3) % 25;
    else amount = 15 + (i * 4) % 45;

    // 80% confirmed, 12% pending, 8% cancelled
    const rand = i % 25;
    const status: TransactionRow["status"] = rand < 20 ? "confirmed" : rand < 23 ? "pending" : "cancelled";

    txs.push({
      id: `base_${1000 + i}`,
      date: date.toISOString(),
      category,
      type: "entrada",
      description,
      amount,
      status
    });
  }
  return txs;
};

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAGE_SIZE = 10;

export default function AdminFinanceiroPage() {
  const toast = useAdminToast();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [activeTab, setActiveTab] = useState<ActiveTab>("geral");
  const [page, setPage] = useState(0);
  
  // Table search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Real Database state
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [cancellations, setCancellations] = useState<any[]>([]);

  // Simulation settings (sliders state)
  const [simSplit, setSimSplit] = useState({
    prestador: 90.0,
    ubt: 4.0,
    premioTrab: 1.5,
    premioCons: 1.5,
    entidades: 2.0
  });

  useEffect(() => {
    const fetchData = async () => {
      const startTime = Date.now();
      try {
        setLoading(true);
        const [
          { data: payData },
          { data: splitData },
          { data: payoutData },
          { data: disputeData },
          { data: refundData },
          { data: cancelData }
        ] = await Promise.all([
          supabase.from("payments").select("*"),
          supabase.from("payment_splits").select("*"),
          supabase.from("payouts").select("*"),
          supabase.from("disputes").select("*"),
          supabase.from("refunds").select("*"),
          supabase.from("cancellations").select("*")
        ]);

        const duration = Date.now() - startTime;

        if (payData) setPayments(payData);
        if (splitData) setSplits(splitData);
        if (payoutData) setPayouts(payoutData);
        if (disputeData) setDisputes(disputeData);
        if (refundData) setRefunds(refundData);
        if (cancelData) setCancellations(cancelData);

        logSystem("INFO", "PAYMENTS", "fetch_financial_dashboard", "success", duration, undefined, undefined, {
          paymentsCount: payData?.length || 0,
          payoutsCount: payoutData?.length || 0
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        logSystem("ERROR", "PAYMENTS", "fetch_financial_dashboard", "failed", duration, err.message, err.code);
        console.error("Erro ao carregar dados financeiros reais:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Merge database tables into transaction list
  const allTransactions = useMemo(() => {
    const txs: TransactionRow[] = [];

    // Map payments
    payments.forEach((p) => {
      const validStatus: TransactionRow["status"] = 
        p.status === "captured" || p.status === "authorized" ? "confirmed" :
        p.status === "pending" ? "pending" : "cancelled";
      
      let category: TransactionRow["category"] = "Geral";
      if (p.service_type === "mototaxi") category = "Mototáxi";
      else if (p.service_type === "diarista") category = "Diarista";
      else if (p.service_type === "ambulante") category = "Ambulante";
      else if (p.service_type === "coco") category = "Reciclagem";

      txs.push({
        id: p.id,
        date: p.created_at || new Date().toISOString(),
        category,
        type: "entrada",
        description: `Pagamento #${p.id.slice(0, 4)} via ${p.payment_method || "desconhecido"}`,
        amount: Number(p.amount || 0),
        status: validStatus
      });
    });

    // Map payouts
    payouts.forEach((po) => {
      const validStatus: TransactionRow["status"] = 
        po.status === "paid" ? "confirmed" :
        po.status === "failed" ? "cancelled" : "pending";

      txs.push({
        id: po.id,
        date: po.created_at || new Date().toISOString(),
        category: "Geral",
        type: "saida",
        description: `Saque Pix #${po.id.slice(0, 4)}`,
        amount: Number(po.amount || 0),
        status: validStatus
      });
    });

    // Map disputes
    disputes.forEach((disp) => {
      const validStatus: TransactionRow["status"] = 
        disp.status === "closed" || disp.status.startsWith("resolved") ? "confirmed" : "pending";

      let category: TransactionRow["category"] = "Geral";
      if (disp.service_type === "mototaxi") category = "Mototáxi";
      else if (disp.service_type === "diarista") category = "Diarista";
      else if (disp.service_type === "ambulante") category = "Ambulante";
      else if (disp.service_type === "coco") category = "Reciclagem";

      txs.push({
        id: disp.id,
        date: disp.created_at || new Date().toISOString(),
        category,
        type: "saida",
        description: `Disputa #${disp.id.slice(0, 4)}: ${disp.reason}`,
        amount: Number(disp.amount || 0),
        status: validStatus
      });
    });

    // Map refunds
    refunds.forEach((ref) => {
      const validStatus: TransactionRow["status"] = 
        ref.status === "processed" ? "confirmed" :
        ref.status === "failed" ? "cancelled" : "pending";

      txs.push({
        id: ref.id,
        date: ref.created_at || new Date().toISOString(),
        category: "Geral",
        type: "saida",
        description: `Reembolso #${ref.id.slice(0, 4)} - ${ref.reason}`,
        amount: Number(ref.amount || 0),
        status: validStatus
      });
    });

    // Map cancellations
    cancellations.forEach((can) => {
      let category: TransactionRow["category"] = "Geral";
      if (can.service_type === "mototaxi") category = "Mototáxi";
      else if (can.service_type === "diarista") category = "Diarista";
      else if (can.service_type === "ambulante") category = "Ambulante";
      else if (can.service_type === "coco") category = "Reciclagem";

      txs.push({
        id: can.id,
        date: can.created_at || new Date().toISOString(),
        category,
        type: "entrada",
        description: `Cancelamento #${can.id.slice(0, 4)}: ${can.reason}`,
        amount: Number(can.cancellation_fee || 0),
        status: "confirmed"
      });
    });

    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, payouts, disputes, refunds, cancellations]);

  // Filter transactions by selected Period
  const periodFilteredTransactions = useMemo(() => {
    const now = new Date();
    const limitDate = new Date();
    if (periodo === "semana") limitDate.setDate(now.getDate() - 7);
    else if (periodo === "mes") limitDate.setDate(now.getDate() - 30);
    else if (periodo === "ano") limitDate.setFullYear(now.getFullYear() - 1);
    else return allTransactions; // "todos"

    return allTransactions.filter((t) => new Date(t.date) >= limitDate);
  }, [allTransactions, periodo]);

  // Volume calculations for the active period
  const financialTotals = useMemo(() => {
    const confirmedPayments = periodFilteredTransactions.filter(t => t.type === "entrada" && t.status === "confirmed");
    const pendingPayments = periodFilteredTransactions.filter(t => t.type === "entrada" && t.status === "pending");
    
    const totalGmv = confirmedPayments.reduce((acc, t) => acc + t.amount, 0);
    const totalPending = pendingPayments.reduce((acc, t) => acc + t.amount, 0);
    const totalTransactions = confirmedPayments.length + pendingPayments.length;

    // Split breakdowns based on splits table
    const releasedSplits = splits.filter(s => s.status === "released" || s.status === "approved" || s.status === "pending");
    
    const platformRevenue = releasedSplits.filter(s => s.recipient_role === "ubt").reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const prizeWorker = releasedSplits.filter(s => s.recipient_role === "prize_worker").reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const prizeConsumer = releasedSplits.filter(s => s.recipient_role === "prize_consumer").reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const awardsAccumulated = prizeWorker + prizeConsumer;

    const collectiveDonations = releasedSplits.filter(s => s.recipient_role === "comunidade").reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const providerVolume = releasedSplits.filter(s => s.recipient_role === "provider").reduce((acc, s) => acc + Number(s.amount || 0), 0);

    return {
      totalGmv,
      totalPending,
      totalTransactions,
      platformRevenue,
      awardsAccumulated,
      collectiveDonations,
      providerVolume
    };
  }, [periodFilteredTransactions, splits]);

  // Category breakdown calculations
  const categoryData = useMemo(() => {
    const categories: TransactionRow["category"][] = ["Mototáxi", "Diarista", "Ambulante", "Reciclagem"];
    const colors = {
      "Mototáxi": "#2B6EE8",
      "Diarista": "#0DB87E",
      "Ambulante": "#F5A623",
      "Reciclagem": "#9B59B6"
    };

    return categories.map((cat) => {
      const catConfirmed = periodFilteredTransactions.filter(t => t.category === cat && t.status === "confirmed" && t.type === "entrada");
      const totalAmount = catConfirmed.reduce((acc, t) => acc + t.amount, 0);
      const count = catConfirmed.length;
      const ticketMedio = count > 0 ? totalAmount / count : 0;
      const percentage = financialTotals.totalGmv > 0 ? (totalAmount / financialTotals.totalGmv) * 100 : 0;

      return {
        name: cat,
        amount: totalAmount,
        percentage,
        count,
        ticketMedio,
        color: colors[cat]
      };
    });
  }, [periodFilteredTransactions, financialTotals]);

  // Calculations for simulated split
  const simulatedTotals = useMemo(() => {
    const gmv = financialTotals.totalGmv;
    const sum = simSplit.prestador + simSplit.ubt + simSplit.premioTrab + simSplit.premioCons + simSplit.entidades;
    const isValid = Math.abs(sum - 100.0) < 0.01;

    return {
      isValid,
      sum,
      prestadorVal: (gmv * simSplit.prestador) / 100,
      ubtVal: (gmv * simSplit.ubt) / 100,
      premioTrabVal: (gmv * simSplit.premioTrab) / 100,
      premioConsVal: (gmv * simSplit.premioCons) / 100,
      entidadesVal: (gmv * simSplit.entidades) / 100
    };
  }, [financialTotals, simSplit]);

  // Filters applied to the table display list
  const tableFilteredTransactions = useMemo(() => {
    return periodFilteredTransactions.filter((t) => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === "all" || t.category === filterCategory;
      const matchesType = filterType === "all" || t.type === filterType;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [periodFilteredTransactions, searchQuery, filterCategory, filterType]);

  const totalTableCount = tableFilteredTransactions.length;
  const pagedTransactions = tableFilteredTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalTableCount / PAGE_SIZE));

  // Timeline points for Area chart (Daily total confirmed volumes)
  const timelinePoints = useMemo(() => {
    const size = periodo === "semana" ? 7 : 15;
    const points = [...Array(size)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (size - 1 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    return points.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const dayTx = periodFilteredTransactions.filter((t) => {
        const td = new Date(t.date);
        return td >= d && td < next && t.status === "confirmed" && t.type === "entrada";
      });
      const realAmount = dayTx.reduce((a, t) => a + t.amount, 0);
      
      return {
        label: d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }),
        amount: realAmount
      };
    });
  }, [periodFilteredTransactions, periodo]);

  const maxTimelineVal = Math.max(1, ...timelinePoints.map((p) => p.amount));

  const exportCsv = () => {
    const csvContent =
      "ID,Data,Categoria,Descricao,Valor,Status\n" +
      tableFilteredTransactions
        .map((t) => `${t.id},${t.date},${t.category},"${t.description}",${t.amount.toFixed(2)},${t.status}`)
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ubt-relatorio-financeiro-${periodo}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.show("Relatório CSV exportado com sucesso!");
  };

  const handleSliderChange = (key: keyof typeof simSplit, val: number) => {
    setSimSplit((prev) => ({
      ...prev,
      [key]: parseFloat(val.toFixed(1))
    }));
  };

  const resetSliders = () => {
    setSimSplit({
      prestador: 90.0,
      ubt: 4.0,
      premioTrab: 1.5,
      premioCons: 1.5,
      entidades: 2.0
    });
    toast.show("Percentuais restaurados ao padrão UBT.");
  };

  const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
    confirmed: { bg: "rgba(13,184,126,0.10)", color: "#0DB87E", label: "Confirmado" },
    pending: { bg: "rgba(245,166,35,0.10)", color: "#F5A623", label: "Pendente" },
    cancelled: { bg: "rgba(232,64,64,0.08)", color: "#E84040", label: "Cancelado" },
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Title & CSV Export */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>Financeiro</h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
            Demonstrativos de receita, repasse coletivo e projeção de split.
          </p>
        </div>
        <GhostButton onClick={exportCsv}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> Exportar Relatório CSV
          </span>
        </GhostButton>
      </div>

      {/* Primary Timeline Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { key: "semana", label: "Últimos 7 dias" },
          { key: "mes", label: "Último mês" },
          { key: "ano", label: "Último ano" },
          { key: "todos", label: "Todo o período" }
        ].map((o) => {
          const active = periodo === o.key;
          return (
            <button
              key={o.key}
              onClick={() => {
                setPeriodo(o.key as Periodo);
                setPage(0);
              }}
              style={{
                background: active ? "#0DB87E" : "#fff",
                color: active ? "#fff" : "#475569",
                border: active ? "1px solid #0DB87E" : "1px solid #E2E8F0",
                borderRadius: 999,
                padding: "7px 16px",
                fontFamily: "DM Sans",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "all 0.2s ease"
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Tabs navigation */}
      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid #E2E8F0", marginBottom: 24 }}>
        {[
          { key: "geral", label: "Visão Geral", icon: TrendingUp },
          { key: "split", label: "Split & Simulador", icon: Sliders },
          { key: "categories", label: "Breakdown Categorias", icon: Percent },
          { key: "entities", label: "Impacto Entidades", icon: Heart }
        ].map((t) => {
          const active = activeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as ActiveTab)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active ? "2.5px solid #0DB87E" : "2.5px solid transparent",
                padding: "10px 4px 12px",
                fontFamily: "Syne",
                fontSize: 14,
                fontWeight: 700,
                color: active ? "#0DB87E" : "#64748B",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s ease"
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents: Visão Geral */}
      {activeTab === "geral" && (
        <>
          {/* Dashboard KPIs Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Volume Total (GMV)", value: formatBR(financialTotals.totalGmv), sub: "Serviços efetuados", Icon: DollarSign, color: "#2B6EE8" },
              { label: "Faturamento UBT (4%)", value: formatBR(financialTotals.platformRevenue), sub: "Receita líquida retida", Icon: TrendingUp, color: "#0DB87E" },
              { label: "Fração Prêmios (3%)", value: formatBR(financialTotals.awardsAccumulated), sub: "Trabalhador & Consumidor", Icon: Award, color: "#9B59B6" },
              { label: "Doado Coletivo (2%)", value: formatBR(financialTotals.collectiveDonations), sub: "Fundo social ONGs", Icon: Heart, color: "#F5A623" },
              { label: "Repassado Prestadores (90%)", value: formatBR(financialTotals.providerVolume), sub: "Volume trabalhadores", Icon: Gift, color: "#64748B" }
            ].map((k) => (
              <Card key={k.label} style={{ padding: 20, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: k.color + "16",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <k.Icon size={18} color={k.color} />
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {k.label}
                </div>
                <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", marginTop: 8 }}>
                  {k.value}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  {k.sub}
                </div>
              </Card>
            ))}
          </div>

          {/* Area Chart: GMV Progression */}
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Progressão de Volume (GMV)</h3>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Volume financeiro diário consolidado das entradas confirmadas</p>
              </div>
              <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8" size="sm">Histórico e Realtime</Pill>
            </div>
            
            {/* SVG Area Line Chart */}
            <div style={{ position: "relative", width: "100%", height: 180 }}>
              <svg width="100%" height="100%" viewBox="0 0 600 160" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0DB87E" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0DB87E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Grid Lines */}
                <line x1="0" y1="40" x2="600" y2="40" stroke="#F1F5F9" strokeWidth="1" />
                <line x1="0" y1="80" x2="600" y2="80" stroke="#F1F5F9" strokeWidth="1" />
                <line x1="0" y1="120" x2="600" y2="120" stroke="#F1F5F9" strokeWidth="1" />
                
                {/* Render Area path */}
                {(() => {
                  const size = timelinePoints.length;
                  const stepX = 600 / (size - 1);
                  const pathD = timelinePoints.map((p, idx) => {
                    const x = idx * stepX;
                    const y = 140 - (p.amount / maxTimelineVal) * 120;
                    return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                  }).join(" ");
                  const areaD = `${pathD} L 600 140 L 0 140 Z`;
                  
                  return (
                    <>
                      <path d={areaD} fill="url(#areaGradient)" />
                      <path d={pathD} fill="none" stroke="#0DB87E" strokeWidth="2.5" strokeLinecap="round" />
                    </>
                  );
                })()}

                {/* Circle Dots on points */}
                {timelinePoints.map((p, idx) => {
                  const size = timelinePoints.length;
                  const stepX = 600 / (size - 1);
                  const cx = idx * stepX;
                  const cy = 140 - (p.amount / maxTimelineVal) * 120;
                  return (
                    <g key={idx}>
                      <circle cx={cx} cy={cy} r="4.5" fill="#fff" stroke="#0DB87E" strokeWidth="2" />
                      <text cx={cx} x={cx} y={155} textAnchor="middle" style={{ fontFamily: "DM Sans", fontSize: 8, fill: "#94A3B8" }}>
                        {p.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            
            {/* Chart Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 14, justifyContent: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>
                <span style={{ width: 10, height: 10, background: "#0DB87E", borderRadius: 999 }} /> Volume Diário Confirmado (GMV)
              </span>
            </div>
          </Card>
        </>
      )}

      {/* Tab Contents: Split & Simulador */}
      {activeTab === "split" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
          {/* Slider Controls Card */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Simulador de Split de Transação</h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", marginTop: 4, marginBottom: 20 }}>
              Simule a distribuição percentual de taxas por transação. A soma total deve ser igual a 100%.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Sliders */}
              {[
                { key: "prestador", label: "Prestador", color: "#64748B" },
                { key: "ubt", label: "Taxa UBT (Plataforma)", color: "#0DB87E" },
                { key: "premioTrab", label: "Prêmio Trabalhador (1/5)", color: "#9B59B6" },
                { key: "premioCons", label: "Prêmio Consumidor (1/11)", color: "#2B6EE8" },
                { key: "entidades", label: "Entidades Coletivo", color: "#F5A623" }
              ].map((slider) => {
                const val = simSplit[slider.key as keyof typeof simSplit];
                return (
                  <div key={slider.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#334155" }}>{slider.label}</span>
                      <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: slider.color }}>{val.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={val}
                      onChange={(e) => handleSliderChange(slider.key as keyof typeof simSplit, parseFloat(e.target.value))}
                      style={{
                        width: "100%",
                        height: 6,
                        background: "#E2E8F0",
                        borderRadius: 999,
                        outline: "none",
                        accentColor: slider.color,
                        cursor: "pointer"
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Sum validation indicator */}
            <div style={{ marginTop: 24, borderTop: "1px solid #E2E8F0", paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {simulatedTotals.isValid ? (
                  <CheckCircle2 size={18} color="#0DB87E" />
                ) : (
                  <AlertCircle size={18} color="#E84040" />
                )}
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                  Soma Total: <strong>{simulatedTotals.sum.toFixed(1)}%</strong>
                </span>
              </div>
              
              <div style={{ display: "flex", gap: 8 }}>
                <GhostButton onClick={resetSliders} style={{ padding: "6px 12px", fontSize: 12 }}>
                  Restaurar
                </GhostButton>
              </div>
            </div>
            
            {!simulatedTotals.isValid && (
              <div style={{ background: "rgba(232,64,64,0.06)", border: "1px solid rgba(232,64,64,0.15)", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#E84040", margin: 0, lineHeight: 1.4 }}>
                  ⚠️ A soma das taxas está em {simulatedTotals.sum.toFixed(1)}%. Ajuste os valores para atingir exatamente 100.0% para projetar a divisão.
                </p>
              </div>
            )}
          </Card>

          {/* Projections Card */}
          <Card style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Projeção de Repasse do Período</h3>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", marginTop: 4, marginBottom: 20 }}>
                Baseado no volume de <strong>{formatBR(financialTotals.totalGmv)}</strong> do período selecionado.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Prestadores", simVal: simulatedTotals.prestadorVal, defaultVal: financialTotals.providerVolume, color: "#64748B", pct: simSplit.prestador },
                  { label: "Plataforma UBT", simVal: simulatedTotals.ubtVal, defaultVal: financialTotals.platformRevenue, color: "#0DB87E", pct: simSplit.ubt },
                  { label: "Prêmio Trabalhador", simVal: simulatedTotals.premioTrabVal, defaultVal: financialTotals.awardsAccumulated * 0.5, color: "#9B59B6", pct: simSplit.premioTrab },
                  { label: "Prêmio Consumidor", simVal: simulatedTotals.premioConsVal, defaultVal: financialTotals.awardsAccumulated * 0.5, color: "#2B6EE8", pct: simSplit.premioCons },
                  { label: "Coletivo (ONGs)", simVal: simulatedTotals.entidadesVal, defaultVal: financialTotals.collectiveDonations, color: "#F5A623", pct: simSplit.entidades }
                ].map((p, idx) => (
                  <div key={idx} style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#475569" }}>{p.label}</span>
                      <span style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 700, color: p.color }}>({p.pct.toFixed(1)}%)</span>
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Padrão UBT:</span>
                        <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", fontWeight: 500 }}>{formatBR(p.defaultVal)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Simulado:</span>
                        <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 800, color: simulatedTotals.isValid ? "#0F172A" : "#94A3B8" }}>
                          {simulatedTotals.isValid ? formatBR(p.simVal) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab Contents: Breakdown Categorias */}
      {activeTab === "categories" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
          {/* Categories Rosca Chart */}
          <Card style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, alignSelf: "flex-start", marginBottom: 24 }}>
              Distribuição do Volume (GMV)
            </h3>
            
            {/* SVG Donut Chart */}
            <div style={{ position: "relative", width: 150, height: 150, marginBottom: 20 }}>
              <svg width="150" height="150" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                {(() => {
                  let accumulatedOffset = 0;
                  const perimeter = 2 * Math.PI * 40; // 251.2
                  
                  return categoryData.map((c, i) => {
                    const strokeDash = (c.amount / financialTotals.totalGmv) * perimeter;
                    const strokeOffset = perimeter - strokeDash + accumulatedOffset;
                    accumulatedOffset -= strokeDash;
                    
                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={c.color}
                        strokeWidth="12"
                        strokeDasharray={`${strokeDash} ${perimeter}`}
                        strokeDashoffset={strokeOffset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dashoffset 0.5s ease" }}
                      />
                    );
                  });
                })()}
              </svg>
              {/* Central Text inside donut */}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 10, color: "#94A3B8", textTransform: "uppercase" }}>GMV</span>
                <div style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{formatBR(financialTotals.totalGmv).split(",")[0]}</div>
              </div>
            </div>

            {/* Colored Category Legends */}
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {categoryData.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>
                    {c.name}: <strong>{c.percentage.toFixed(1)}%</strong>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Categories metrics detail table */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, marginBottom: 16 }}>
              Métricas por Categoria de Serviço
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {categoryData.map((c) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F1F5F9", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 28, borderRadius: 2, background: c.color }} />
                    <div>
                      <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{c.name}</span>
                      <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>
                        {c.count} transações · Ticket {formatBR(c.ticketMedio)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                      {formatBR(c.amount)}
                    </div>
                    <span style={{ fontFamily: "DM Sans", fontSize: 11, color: c.color, fontWeight: 600 }}>
                      {c.percentage.toFixed(1)}% do GMV
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab Contents: Impacto Entidades (Coletivo) */}
      {activeTab === "entities" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
          {/* Fund Details */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Fundo Coletivo de Solidariedade
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", marginTop: 4, marginBottom: 20 }}>
              Corresponde a <strong>2.0%</strong> do volume total transacionado na plataforma, destinado a apoiar entidades e ONGs de Ubatuba.
            </p>

            <div style={{ background: "rgba(155, 89, 182, 0.06)", border: "1px dashed rgba(155, 89, 182, 0.25)", borderRadius: 14, padding: 20, textAlign: "center", marginBottom: 20 }}>
              <Building2 size={36} color="#9B59B6" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", textTransform: "uppercase" }}>Arrecadado no Período</div>
              <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "#9B59B6", marginTop: 6 }}>
                {formatBR(financialTotals.collectiveDonations)}
              </div>
            </div>

            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
              💡 O fundo do Coletivo é recolhido a cada transação confirmada no Superapp e dividido proporcionalmente entre as ONGs habilitadas de acordo com as preferências selecionadas pelos clientes na finalização de seus pedidos.
            </p>
          </Card>

          {/* Recipient Entities List */}
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, marginBottom: 16 }}>
              Repasses Proporcionais por Entidade
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ENTITIES.map((ent) => {
                const allocatedVal = financialTotals.collectiveDonations * ent.weight;
                return (
                  <div key={ent.sigla} style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
                          {ent.name}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          <Pill bg={ent.color + "16"} color={ent.color} size="sm">
                            {ent.sigla} · {(ent.weight * 100).toFixed(0)}% das doações
                          </Pill>
                        </div>
                      </div>
                      
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Total Destinado</span>
                        <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>
                          {formatBR(allocatedVal)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Share Bar */}
                    <div style={{ width: "100%", background: "#E2E8F0", height: 6, borderRadius: 99 }}>
                      <div style={{ width: `${ent.weight * 100}%`, height: "100%", background: ent.color, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Advanced Search & Filtering Tabela Card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Table Search & Filters bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Transações do Período</span>
            <Pill bg="rgba(71,85,105,0.08)" color="#475569" size="sm">{totalTableCount} Lançamentos</Pill>
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {/* Text Search */}
            <div style={{ position: "relative", minWidth: 200 }}>
              <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: 11 }} />
              <input
                type="text"
                placeholder="Buscar descrição ou ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                style={{
                  width: "100%",
                  height: 36,
                  background: "#fff",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  padding: "0 10px 0 32px",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: "#0F172A",
                  outline: "none"
                }}
              />
            </div>

            {/* Category Select Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={12} color="#64748B" />
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setPage(0);
                }}
                style={{
                  height: 36,
                  background: "#fff",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  padding: "0 10px",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: "#475569",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="all">Todas Categorias</option>
                <option value="Mototáxi">Mototáxi</option>
                <option value="Diarista">Diarista</option>
                <option value="Ambulante">Ambulante</option>
                <option value="Reciclagem">Reciclagem</option>
              </select>
            </div>
            
            {/* Status Select Filter */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(0);
              }}
              style={{
                height: 36,
                background: "#fff",
                border: "1px solid #CBD5E1",
                borderRadius: 8,
                padding: "0 10px",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#475569",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="all">Todos Status</option>
              <option value="confirmed">Confirmado</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Transactions list table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFC" }}>
              <tr>
                {[
                  { label: "ID", align: "left" },
                  { label: "Data/Hora", align: "left" },
                  { label: "Categoria", align: "left" },
                  { label: "Descrição", align: "left" },
                  { label: "Valor", align: "right" },
                  { label: "Status", align: "left" }
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      textAlign: h.align as any,
                      padding: "12px 20px",
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      borderBottom: "1px solid #E2E8F0"
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedTransactions.map((t) => {
                const sp = STATUS_PILL[t.status] || STATUS_PILL.confirmed;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #E2E8F0", transition: "background 0.15s ease" }}>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>
                      #{t.id.slice(0, 6)}
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                      {new Date(t.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <Pill
                        bg={
                          t.category === "Mototáxi" ? "rgba(43,110,232,0.08)" :
                          t.category === "Diarista" ? "rgba(13,184,126,0.08)" :
                          t.category === "Ambulante" ? "rgba(245,166,35,0.08)" : "rgba(155, 89, 182, 0.08)"
                        }
                        color={
                          t.category === "Mototáxi" ? "#2B6EE8" :
                          t.category === "Diarista" ? "#0DB87E" :
                          t.category === "Ambulante" ? "#F5A623" : "#9B59B6"
                        }
                        size="sm"
                      >
                        {t.category}
                      </Pill>
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#0F172A", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right", fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: t.type === "saida" ? "#E84040" : "#0DB87E" }}>
                      {formatBR(t.amount)}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <Pill bg={sp.bg} color={sp.color} size="sm">{sp.label}</Pill>
                    </td>
                  </tr>
                );
              })}
              
              {pagedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
                    Nenhuma transação encontrada correspondente aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #E2E8F0", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>
            Mostrando {totalTableCount === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(totalTableCount, (page + 1) * PAGE_SIZE)} de {totalTableCount} transações
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "6px 12px",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#475569",
                cursor: page === 0 ? "not-allowed" : "pointer",
                opacity: page === 0 ? 0.5 : 1
              }}
            >
              ← Anterior
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "6px 12px",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#475569",
                cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                opacity: page >= totalPages - 1 ? 0.5 : 1
              }}
            >
              Próximo →
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
