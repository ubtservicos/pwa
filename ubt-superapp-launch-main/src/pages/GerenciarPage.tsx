import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Wallet,
  Heart,
  ArrowDownLeft,
  ArrowUpRight,
  Divide,
  Gift,
  FileX,
  Trophy,
  Users,
  Star,
  LucideIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import BottomSheet from "@/components/settings/BottomSheet";
import TransactionCard from "@/components/TransactionCard";
import {
  Transaction,
  TransactionType,
} from "@/mocks/transactions";
import {
  filterByPeriod,
  sumByType,
  groupByDay,
  formatDayLabel,
  formatBRLNumber,
  Periodo,
} from "@/utils/dateFilter";
import { supabase } from "@/lib/supabase";

const GREEN = "#0DB87E";

const SummaryCard = ({
  label,
  value,
  Icon,
  color,
  negative,
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  color: string;
  negative?: boolean;
}) => {
  const t = useTheme();
  const valueColor = negative && value < 0 ? "#E84040" : t.text;
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: color + "20",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={color} />
      </div>
      <p
        style={{
          fontFamily: "Syne",
          fontSize: 17,
          fontWeight: 700,
          color: valueColor,
          margin: 0,
          marginTop: 8,
        }}
      >
        R$ {formatBRLNumber(value)}
      </p>
      <p
        style={{
          fontFamily: "DM Sans",
          fontSize: 11,
          color: t.muted,
          margin: 0,
          marginTop: 2,
        }}
      >
        {label}
      </p>
    </div>
  );
};

const MiniBars = ({ border, transactions }: { border: string; transactions: Transaction[] }) => {
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const total = transactions.filter(
        (t) =>
          t.type === "entrada" &&
          t.status === "confirmed" &&
          new Date(t.date) >= d &&
          new Date(t.date) < next,
      ).reduce((a, t) => a + t.amount, 0);
      return { date: d, total };
    });
  }, [transactions]);
  const maxVal = Math.max(...last7.map((d) => d.total), 1);
  const W = 100;
  const H = 48;
  const gap = 2;
  const barW = (W - gap * 6) / 7;
  const days = ["D", "S", "T", "Q", "Q", "S", "S"];
  return (
    <div style={{ marginTop: 14 }}>
      <svg
        viewBox={`0 0 ${W} ${H + 10}`}
        width="100%"
        height={H + 14}
        preserveAspectRatio="none"
      >
        {last7.map((d, i) => {
          const h = (d.total / maxVal) * (H - 4);
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              rx={1.5}
              fill={GREEN}
            />
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} stroke={border} strokeWidth={0.5} />
        {last7.map((d, i) => (
          <text
            key={"l" + i}
            x={i * (barW + gap) + barW / 2}
            y={H + 8}
            textAnchor="middle"
            fontSize={4}
            fontFamily="DM Sans"
            fill="#9399AD"
          >
            {days[d.date.getDay()]}
          </text>
        ))}
      </svg>
    </div>
  );
};

const TAB_META: Array<{
  key: TransactionType;
  label: string;
  Icon: LucideIcon;
}> = [
  { key: "entrada", label: "Entradas", Icon: ArrowDownLeft },
  { key: "saida", label: "Saídas", Icon: ArrowUpRight },
  { key: "split", label: "Split", Icon: Divide },
  { key: "sorteio", label: "Sorteios", Icon: Gift },
];

const SPLIT_DISPLAY = [
  { key: "comunidade", label: "Comunidade", Icon: Users, color: "#2B6EE8" },
  { key: "premioTrabalhador", label: "Prêmio Trabalhador", Icon: Gift, color: "#9B59B6" },
  { key: "premioTomador", label: "Prêmio Tomador", Icon: Star, color: "#E84040" },
  { key: "padrinho", label: "Padrinho/Madrinha", Icon: Heart, color: "#0DB87E" },
] as const;

const GerenciarPage = () => {
  const navigate = useNavigate();
  const t = useTheme();
  const user = useCurrentUser();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [activeTab, setActiveTab] = useState<TransactionType>("entrada");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftStart, setDraftStart] = useState<string>("");
  const [draftEnd, setDraftEnd] = useState<string>("");
  const [dbTransactions, setDbTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.uid) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Fetch orders (Ambulantes)
        const { data: pedidos, error: errPed } = await supabase
          .from('pedidos')
          .select('*')
          .eq('prestador_id', user.uid);

        // 2. Fetch diarista cleanings
        const { data: cleanings, error: errClean } = await supabase
          .from('diarista_agendamentos')
          .select('*')
          .eq('diarista_id', user.uid);

        // 3. Fetch mototaxi rides
        const { data: rides, error: errRides } = await supabase
          .from('mototaxi_corridas')
          .select('*')
          .eq('prestador_id', user.uid);

        const list: Transaction[] = [];

        // Add orders (Ambulantes)
        if (pedidos && !errPed) {
          pedidos.forEach(p => {
            const isCompleted = p.status === 'completed';
            const statusMapped = p.status === 'completed' ? 'confirmed' : (p.status === 'cancelled' ? 'cancelled' : 'pending');
            
            list.push({
              id: p.id,
              type: 'entrada',
              date: p.created_at,
              description: 'Venda de Produtos UBT',
              amount: Number(p.total),
              status: statusMapped
            });

            if (isCompleted) {
              list.push(
                { id: `${p.id}-split-comunidade`, type: 'split', date: p.created_at, description: 'Split UBT - Comunidade', amount: +(Number(p.total) * 0.02).toFixed(2), status: 'confirmed', splitDestino: 'comunidade', splitPercent: 2 },
                { id: `${p.id}-split-trabalhador`, type: 'split', date: p.created_at, description: 'Split UBT - Prêmio Trabalhador', amount: +(Number(p.total) * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTrabalhador', splitPercent: 1.5 },
                { id: `${p.id}-split-tomador`, type: 'split', date: p.created_at, description: 'Split UBT - Prêmio Tomador', amount: +(Number(p.total) * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTomador', splitPercent: 1.5 },
                { id: `${p.id}-split-padrinho`, type: 'split', date: p.created_at, description: 'Split UBT - Padrinho/Madrinha', amount: +(Number(p.total) * 0.01).toFixed(2), status: 'confirmed', splitDestino: 'padrinho', splitPercent: 1 }
              );
            }
          });
        }

        // Add diarista cleanings
        if (cleanings && !errClean) {
          cleanings.forEach(c => {
            const dateStr = c.data ? `${c.data}T${c.hora || '08:00'}:00` : new Date().toISOString();
            const statusMapped = c.status === 'completed' || c.status === 'confirmed' ? 'confirmed' : (c.status === 'cancelled' ? 'cancelled' : 'pending');
            const isCompleted = c.status === 'completed' || c.status === 'confirmed';

            list.push({
              id: c.id,
              type: 'entrada',
              date: dateStr,
              description: 'Faxina Residencial UBT',
              amount: Number(c.valor_total),
              status: statusMapped
            });

            if (isCompleted) {
              list.push(
                { id: `${c.id}-split-comunidade`, type: 'split', date: dateStr, description: 'Split UBT - Comunidade', amount: +(Number(c.valor_total) * 0.02).toFixed(2), status: 'confirmed', splitDestino: 'comunidade', splitPercent: 2 },
                { id: `${c.id}-split-trabalhador`, type: 'split', date: dateStr, description: 'Split UBT - Prêmio Trabalhador', amount: +(Number(c.valor_total) * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTrabalhador', splitPercent: 1.5 },
                { id: `${c.id}-split-tomador`, type: 'split', date: dateStr, description: 'Split UBT - Prêmio Tomador', amount: +(Number(c.valor_total) * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTomador', splitPercent: 1.5 },
                { id: `${c.id}-split-padrinho`, type: 'split', date: dateStr, description: 'Split UBT - Padrinho/Madrinha', amount: +(Number(c.valor_total) * 0.01).toFixed(2), status: 'confirmed', splitDestino: 'padrinho', splitPercent: 1 }
              );
            }
          });
        }

        // Add mototaxi rides
        if (rides && !errRides) {
          rides.forEach(r => {
            const statusMapped = r.status === 'completed' ? 'confirmed' : (r.status === 'cancelled' ? 'cancelled' : 'pending');
            const isCompleted = r.status === 'completed';
            const price = Number(r.final_price || r.estimated_price);

            list.push({
              id: r.id,
              type: 'entrada',
              date: r.created_at,
              description: r.type === 'entrega' ? 'Entrega Mototáxi UBT' : 'Corrida Mototáxi UBT',
              amount: price,
              status: statusMapped
            });

            if (isCompleted) {
              list.push(
                { id: `${r.id}-split-comunidade`, type: 'split', date: r.created_at, description: 'Split UBT - Comunidade', amount: +(price * 0.02).toFixed(2), status: 'confirmed', splitDestino: 'comunidade', splitPercent: 2 },
                { id: `${r.id}-split-trabalhador`, type: 'split', date: r.created_at, description: 'Split UBT - Prêmio Trabalhador', amount: +(price * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTrabalhador', splitPercent: 1.5 },
                { id: `${r.id}-split-tomador`, type: 'split', date: r.created_at, description: 'Split UBT - Prêmio Tomador', amount: +(price * 0.015).toFixed(2), status: 'confirmed', splitDestino: 'premioTomador', splitPercent: 1.5 },
                { id: `${r.id}-split-padrinho`, type: 'split', date: r.created_at, description: 'Split UBT - Padrinho/Madrinha', amount: +(price * 0.01).toFixed(2), status: 'confirmed', splitDestino: 'padrinho', splitPercent: 1 }
              );
            }
          });
        }

        // Exits & Draw participations
        list.push(
          { id: 'saida-mock-1', type: 'saida', date: new Date().toISOString(), description: 'Saque PIX para Banco', amount: 150.00, status: 'confirmed' },
          { id: 'saida-mock-2', type: 'saida', date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), description: 'Pagamento de Taxa Mensal', amount: 45.00, status: 'confirmed' },
          { id: 'sorteio-mock-1', type: 'sorteio', date: new Date().toISOString(), description: 'Ticket da Sorte - Prêmio Trabalhador (1/5)', amount: 0, status: 'confirmed', sorteioStatus: 'participando', sorteioData: '01/05/2025' },
          { id: 'sorteio-mock-2', type: 'sorteio', date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), description: 'Ticket da Sorte - Prêmio Tomador (1/11)', amount: 0, status: 'confirmed', sorteioStatus: 'participando', sorteioData: '01/05/2025' }
        );

        setDbTransactions(list);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user.uid]);

  const filtered = useMemo(
    () => filterByPeriod(dbTransactions, periodo, customStart, customEnd),
    [dbTransactions, periodo, customStart, customEnd],
  );
  const entradas = sumByType(filtered, "entrada");
  const saidas = sumByType(filtered, "saida");
  const saldo = entradas - saidas;
  const contribuicoes = sumByType(filtered, "split");

  const counts = {
    entrada: filtered.filter((t) => t.type === "entrada").length,
    saida: filtered.filter((t) => t.type === "saida").length,
    split: filtered.filter((t) => t.type === "split").length,
    sorteio: filtered.filter((t) => t.type === "sorteio").length,
  };

  const tabTxs = filtered
    .filter((tx) => tx.type === activeTab)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const grouped = groupByDay(tabTxs);
  const sortedDays = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const splitTotals = SPLIT_DISPLAY.reduce(
    (acc, s) => {
      acc[s.key] = filtered
        .filter(
          (tr) =>
            tr.type === "split" &&
            tr.splitDestino === s.key &&
            tr.status === "confirmed",
        )
        .reduce((a, tr) => a + tr.amount, 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const participacoes = dbTransactions.filter(
    (tr) => tr.type === "sorteio" && tr.sorteioStatus === "participando",
  ).length;

  const periodLabel = (p: Periodo) =>
    p === "dia" ? "Hoje" : p === "semana" ? "7 dias" : p === "mes" ? "30 dias" : "Intervalo";

  const applyCustom = () => {
    if (draftStart && draftEnd) {
      setCustomStart(new Date(draftStart + "T00:00:00"));
      setCustomEnd(new Date(draftEnd + "T23:59:59"));
      setPeriodo("custom");
    }
    setShowDatePicker(false);
  };

  if (loading) {
    return (
      <div style={{ background: t.bg, minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "Syne", fontSize: 18, color: t.text }}>Carregando dados financeiros...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.bg,
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        paddingBottom: 96,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "20px 24px 0",
          background: t.bg,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>
            Gerenciar
          </h1>
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
            aria-label="Filtros"
          >
            <SlidersHorizontal size={20} color={t.subtle} />
          </button>
        </div>

        {/* Chips */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 8,
            marginTop: 14,
            scrollbarWidth: "none",
          }}
          className="no-scrollbar"
        >
          {(["dia", "semana", "mes", "custom"] as Periodo[]).map((p) => {
            const active = periodo === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (p === "custom") {
                    setShowDatePicker(true);
                  } else {
                    setPeriodo(p);
                  }
                }}
                style={{
                  padding: "7px 18px",
                  borderRadius: 999,
                  flexShrink: 0,
                  cursor: "pointer",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? GREEN : t.surface,
                  color: active ? "#fff" : t.subtle,
                  border: active ? "none" : `1px solid ${t.border}`,
                }}
              >
                {periodLabel(p)}
              </button>
            );
          })}
        </div>

        {/* Summary grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          <SummaryCard label="Entradas" value={entradas} Icon={TrendingUp} color="#0DB87E" />
          <SummaryCard label="Saídas" value={saidas} Icon={TrendingDown} color="#E84040" />
          <SummaryCard label="Saldo líquido" value={saldo} Icon={Wallet} color="#2B6EE8" negative />
          <SummaryCard label="Via split" value={contribuicoes} Icon={Heart} color="#9B59B6" />
        </div>

        <MiniBars border={t.border} transactions={dbTransactions} />

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginTop: 12,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          {TAB_META.map((tab) => {
            const active = activeTab === tab.key;
            const Icon = tab.Icon;
            const count = counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "8px 0 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  textAlign: "center",
                  color: active ? GREEN : t.muted,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={16} />
                  {count > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -12,
                        fontFamily: "DM Sans",
                        fontSize: 9,
                        color: GREEN,
                        background: "rgba(13,184,126,0.12)",
                        borderRadius: 999,
                        padding: "1px 5px",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 3 }}>{tab.label}</div>
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -1,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: GREEN,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {/* Split totals */}
        {activeTab === "split" && tabTxs.length > 0 && (
          <div
            style={{
              background: t.surface,
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
              border: `1px solid ${t.border}`,
            }}
          >
            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Suas contribuições no período
            </p>
            {SPLIT_DISPLAY.map((s) => {
              const Icon = s.Icon;
              return (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                  }}
                >
                  <Icon size={14} color={s.color} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: t.text, flex: 1 }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      color: s.color,
                    }}
                  >
                    R$ {formatBRLNumber(splitTotals[s.key] || 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sorteio next card */}
        {activeTab === "sorteio" && (
          <div
            style={{
              background: t.isDark
                ? "linear-gradient(135deg,#0B1B3E,#1C3261)"
                : "linear-gradient(135deg,#E6FAF4,#F0FFF9)",
              border: "1px solid rgba(13,184,126,0.30)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Trophy size={28} color="#F5A623" />
              <div style={{ flex: 1, textAlign: "right" }}>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted, margin: 0 }}>
                  Próximo sorteio
                </p>
                <p
                  style={{
                    fontFamily: "Syne",
                    fontSize: 20,
                    fontWeight: 700,
                    color: t.text,
                    margin: 0,
                  }}
                >
                  01/05/2025
                </p>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0, marginBottom: 6 }}>
                Suas participações: {participacoes}
              </p>
              <div
                style={{
                  background: t.border,
                  height: 6,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(participacoes * 10, 100)}%`,
                    height: "100%",
                    background: GREEN,
                  }}
                />
              </div>
            </div>
            <p
              style={{
                fontFamily: "Syne",
                fontSize: 24,
                fontWeight: 800,
                color: GREEN,
                textAlign: "center",
                margin: 0,
                marginTop: 14,
              }}
            >
              R$ 10.000
            </p>
          </div>
        )}

        {tabTxs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              paddingTop: 60,
            }}
          >
            <FileX size={48} color={t.muted} />
            <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
              Nenhuma transação
            </p>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: t.subtle, margin: 0 }}>
              Tente selecionar um período maior.
            </p>
          </div>
        ) : (
          sortedDays.map((day, idx) => (
            <div key={day}>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.muted,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginTop: idx === 0 ? 0 : 20,
                  marginBottom: 8,
                }}
              >
                {formatDayLabel(grouped[day][0].date)}
              </p>
              {grouped[day].map((tx: Transaction) => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  onClick={() => navigate(`/app/gerenciar/transacao/${tx.id}`)}
                />
              ))}
            </div>
          ))
        )}
      </div>



      {/* Date picker sheet */}
      <BottomSheet open={showDatePicker} onClose={() => setShowDatePicker(false)}>
        <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
          Selecionar período
        </h3>
        <div style={{ marginTop: 20 }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: t.muted }}>
            De
          </label>
          <input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              background: t.inputBg,
              border: `1px solid ${t.inputBdr}`,
              color: t.text,
              fontFamily: "DM Sans",
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: t.muted }}>
            Até
          </label>
          <input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              background: t.inputBg,
              border: `1px solid ${t.inputBdr}`,
              color: t.text,
              fontFamily: "DM Sans",
              fontSize: 14,
            }}
          />
        </div>
        <button
          type="button"
          onClick={applyCustom}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            background: GREEN,
            color: "#fff",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => {
            setShowDatePicker(false);
            if (periodo === "custom") setPeriodo("mes");
          }}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            background: "transparent",
            color: t.subtle,
            border: `1px solid ${t.border}`,
            fontFamily: "DM Sans",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </BottomSheet>
    </div>
  );
};

export default GerenciarPage;
