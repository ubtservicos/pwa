import { useState, useEffect } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Gift,
  Star,
  Heart,
  Trophy,
  ChevronDown,
  ChevronUp,
  Flag,
  User,
  Building2,
  LucideIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import PageHeader from "@/components/settings/PageHeader";
import BottomSheet from "@/components/settings/BottomSheet";
import { useSimpleToast } from "@/hooks/useToast2";
import Toast from "@/components/auth/Toast";
import { Transaction } from "@/mocks/transactions";
import { formatTime, formatBRLNumber } from "@/utils/dateFilter";
import { calcSplit, SPLIT_META } from "@/utils/ride";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const GREEN = "#0DB87E";

const SPLIT_ICON_MAP: Record<string, LucideIcon> = {
  User,
  Building2,
  Users,
  Gift,
  Star,
  Heart,
};

const iconForTx = (
  tx: Transaction,
): { Icon: LucideIcon; bg: string; color: string } => {
  if (tx.type === "entrada")
    return { Icon: ArrowDownLeft, bg: "rgba(13,184,126,0.12)", color: "#0DB87E" };
  if (tx.type === "saida")
    return { Icon: ArrowUpRight, bg: "rgba(232,64,64,0.10)", color: "#E84040" };
  if (tx.type === "sorteio")
    return { Icon: Trophy, bg: "rgba(245,166,35,0.12)", color: "#F5A623" };
  switch (tx.splitDestino) {
    case "comunidade":
      return { Icon: Users, bg: "rgba(43,110,232,0.10)", color: "#2B6EE8" };
    case "premioTrabalhador":
      return { Icon: Gift, bg: "rgba(155,89,182,0.10)", color: "#9B59B6" };
    case "premioTomador":
      return { Icon: Star, bg: "rgba(232,64,64,0.10)", color: "#E84040" };
    default:
      return { Icon: Heart, bg: "rgba(13,184,126,0.12)", color: "#0DB87E" };
  }
};

const statusPill = (status: Transaction["status"]) => {
  if (status === "confirmed")
    return {
      label: "Confirmado",
      bg: "rgba(13,184,126,0.10)",
      border: "rgba(13,184,126,0.20)",
      color: "#0DB87E",
    };
  if (status === "pending")
    return {
      label: "Pendente",
      bg: "rgba(245,166,35,0.10)",
      border: "rgba(245,166,35,0.20)",
      color: "#F5A623",
    };
  return {
    label: "Cancelado",
    bg: "rgba(232,64,64,0.08)",
    border: "rgba(232,64,64,0.15)",
    color: "#E84040",
  };
};

const titleFor = (tx: Transaction) =>
  tx.type === "entrada"
    ? "Entrada"
    : tx.type === "saida"
      ? "Saída"
      : tx.type === "split"
        ? "Contribuição"
        : "Sorteio";

const TransacaoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTheme();
  const user = useCurrentUser();
  const [splitOpen, setSplitOpen] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState("");
  const { toast, showToast } = useSimpleToast();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.uid || !id) return;

    const fetchTx = async () => {
      setLoading(true);
      try {
        // Fetch and build the list of transactions
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

        const found = list.find((x) => x.id === id);
        if (found) {
          setTx(found);
        }
      } catch (err) {
        console.error('Error loading transaction details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTx();
  }, [user.uid, id]);

  if (loading) {
    return (
      <div style={{ background: t.bg, minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "Syne", fontSize: 18, color: t.text }}>Carregando detalhes da transação...</p>
      </div>
    );
  }

  if (!tx) return <Navigate to="/app/gerenciar" replace />;

  const { Icon, bg, color } = iconForTx(tx);
  const pill = statusPill(tx.status);

  const valueEl = () => {
    if (tx.type === "sorteio" && tx.sorteioStatus !== "ganhou") {
      return (
        <p
          style={{
            fontFamily: "Syne",
            fontSize: 24,
            fontWeight: 800,
            color: t.muted,
            textAlign: "center",
            margin: 0,
          }}
        >
          —
        </p>
      );
    }
    const isWinner = tx.type === "sorteio" && tx.sorteioStatus === "ganhou";
    const prefix = tx.type === "entrada" || isWinner ? "+ " : tx.type === "saida" ? "- " : "";
    const color2 =
      tx.type === "entrada" || isWinner
        ? isWinner
          ? "#F5A623"
          : "#0DB87E"
        : tx.type === "saida"
          ? "#E84040"
          : "#9B59B6";
    return (
      <p
        style={{
          fontFamily: "Syne",
          fontSize: 32,
          fontWeight: 800,
          color: color2,
          textAlign: "center",
          margin: 0,
        }}
      >
        {prefix}R$ {formatBRLNumber(tx.amount)}
      </p>
    );
  };

  const infoGrid: Array<{ label: string; value: string }> = [
    {
      label: "Data",
      value: new Date(tx.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
    { label: "Horário", value: formatTime(tx.date) },
    {
      label: "Tipo",
      value:
        tx.type === "entrada"
          ? "Recebimento"
          : tx.type === "saida"
            ? "Débito"
            : tx.type === "split"
              ? "Contribuição"
              : "Sorteio",
    },
    { label: "Serviço", value: tx.description },
  ];
  if (tx.type === "entrada") {
    infoGrid.push({ label: "Pagamento", value: "Pix" });
    infoGrid.push({ label: "Duração", value: "~14 min" });
  }
  if (tx.type === "split") {
    infoGrid.push({
      label: "Destinatário",
      value:
        tx.splitDestino === "comunidade"
          ? "Comunidade Profissional"
          : tx.splitDestino === "premioTrabalhador"
            ? "Prêmio Trabalhador"
            : tx.splitDestino === "premioTomador"
              ? "Prêmio Tomador"
              : "Padrinho/Madrinha",
    });
    infoGrid.push({ label: "Percentual", value: `${tx.splitPercent}%` });
  }
  if (tx.type === "sorteio") {
    infoGrid.push({ label: "Data do sorteio", value: tx.sorteioData || "—" });
    infoGrid.push({
      label: "Resultado",
      value:
        tx.sorteioStatus === "ganhou"
          ? "🏆 Vencedor!"
          : tx.sorteioStatus === "participando"
            ? "Participando"
            : "Não contemplado",
    });
  }

  const splitDetail = tx.type === "entrada" ? calcSplit(tx.amount) : null;

  const onSendReport = () => {
    showToast("Relato enviado! Nossa equipe entrará em contato em até 24h.");
    setShowReport(false);
    setReportText("");
  };

  return (
    <div
      style={{
        background: t.bg,
        minHeight: "100svh",
        overflowY: "auto",
        padding: "0 24px 40px",
      }}
    >
      <PageHeader title={titleFor(tx)} onBack={() => navigate(-1)} />

      <div
        style={{
          marginTop: 16,
          background: t.surface,
          borderRadius: 20,
          padding: 24,
          border: `1px solid ${t.border}`,
          boxShadow: t.isDark ? "none" : "0 4px 16px rgba(11,27,62,0.06)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <Icon size={36} color={color} />
        </div>

        <div style={{ marginTop: 16 }}>{valueEl()}</div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <span
            style={{
              fontFamily: "DM Sans",
              fontSize: 11,
              fontWeight: 600,
              color: pill.color,
              background: pill.bg,
              border: `1px solid ${pill.border}`,
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            {pill.label}
          </span>
        </div>

        <div
          style={{
            height: 1,
            background: t.border,
            margin: "20px 0",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {infoGrid.map((g) => (
            <div key={g.label}>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  margin: 0,
                }}
              >
                {g.label}
              </p>
              <p
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 500,
                  color: t.text,
                  margin: 0,
                  marginTop: 2,
                }}
              >
                {g.value}
              </p>
            </div>
          ))}
        </div>

        {splitDetail && (
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={() => setSplitOpen((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                }}
              >
                Como foi dividido
              </span>
              {splitOpen ? (
                <ChevronUp size={16} color={t.muted} />
              ) : (
                <ChevronDown size={16} color={t.muted} />
              )}
            </button>
            {splitOpen && (
              <div style={{ marginTop: 10 }}>
                {SPLIT_META.map((m) => {
                  const pct =
                    m.key === "prestador"
                      ? 90
                      : m.key === "ubt"
                        ? 4
                        : m.key === "comunidade"
                          ? 2
                          : m.key === "padrinho"
                            ? 1
                            : 1.5;
                  const val = splitDetail[m.key];
                  const IconC = SPLIT_ICON_MAP[m.icon];
                  return (
                    <div
                      key={m.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 0",
                      }}
                    >
                      <IconC size={14} color={m.color} />
                      <span
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          color: t.text,
                          flex: 1,
                        }}
                      >
                        {m.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          color: t.muted,
                          marginRight: 8,
                        }}
                      >
                        {pct}%
                      </span>
                      <span
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 13,
                          fontWeight: 600,
                          color: m.color,
                        }}
                      >
                        R$ {formatBRLNumber(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowReport(true)}
        style={{
          marginTop: 24,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 14,
          background: "transparent",
          border: `1px solid ${t.border}`,
          cursor: "pointer",
        }}
      >
        <Flag size={16} color={t.muted} />
        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: t.subtle }}>
          Relatar um problema
        </span>
      </button>

      <BottomSheet open={showReport} onClose={() => setShowReport(false)}>
        <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
          Relatar problema
        </h3>
        <label
          style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 600,
            color: t.muted,
            marginTop: 16,
            display: "block",
          }}
        >
          Descreva o problema
        </label>
        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          placeholder="O que aconteceu com esta transação?"
          style={{
            width: "100%",
            marginTop: 6,
            height: 120,
            resize: "none",
            padding: 14,
            borderRadius: 12,
            background: t.inputBg,
            border: `1px solid ${t.inputBdr}`,
            color: t.text,
            fontFamily: "DM Sans",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={onSendReport}
          style={{
            marginTop: 16,
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
          Enviar relato
        </button>
        <button
          type="button"
          onClick={() => setShowReport(false)}
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

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default TransacaoDetailPage;
