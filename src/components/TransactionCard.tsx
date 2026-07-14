import {
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Gift,
  Star,
  Heart,
  Trophy,
  LucideIcon,
} from "lucide-react";
import { Transaction } from "@/mocks/transactions";
import { useTheme } from "@/hooks/useTheme";
import { formatTime, formatBRLNumber } from "@/utils/dateFilter";

interface Props {
  tx: Transaction;
  onClick: () => void;
}

const iconForTx = (
  tx: Transaction,
): { Icon: LucideIcon; bg: string; color: string } => {
  if (tx.type === "entrada")
    return { Icon: ArrowDownLeft, bg: "rgba(13,184,126,0.12)", color: "#0DB87E" };
  if (tx.type === "saida")
    return { Icon: ArrowUpRight, bg: "rgba(232,64,64,0.10)", color: "#E84040" };
  if (tx.type === "sorteio")
    return { Icon: Trophy, bg: "rgba(245,166,35,0.12)", color: "#F5A623" };
  // split
  switch (tx.splitDestino) {
    case "comunidade":
      return { Icon: Users, bg: "rgba(43,110,232,0.10)", color: "#2B6EE8" };
    case "premioTrabalhador":
      return { Icon: Gift, bg: "rgba(155,89,182,0.10)", color: "#9B59B6" };
    case "premioTomador":
      return { Icon: Star, bg: "rgba(232,64,64,0.10)", color: "#E84040" };
    case "padrinho":
    default:
      return { Icon: Heart, bg: "rgba(13,184,126,0.12)", color: "#0DB87E" };
  }
};

const statusPill = (
  status: Transaction["status"],
): { label: string; bg: string; border: string; color: string } => {
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

const valueDisplay = (tx: Transaction, muted: string) => {
  if (tx.type === "entrada")
    return {
      text: `+ R$ ${formatBRLNumber(tx.amount)}`,
      color: "#0DB87E",
      weight: 700,
      font: "Syne",
      size: 15,
    };
  if (tx.type === "saida")
    return {
      text: `- R$ ${formatBRLNumber(tx.amount)}`,
      color: "#E84040",
      weight: 700,
      font: "Syne",
      size: 15,
    };
  if (tx.type === "split")
    return {
      text: `R$ ${formatBRLNumber(tx.amount)}`,
      color: "#9B59B6",
      weight: 600,
      font: "Syne",
      size: 15,
    };
  // sorteio
  if (tx.sorteioStatus === "ganhou")
    return {
      text: `+ R$ ${formatBRLNumber(tx.amount)}`,
      color: "#F5A623",
      weight: 700,
      font: "Syne",
      size: 15,
    };
  return { text: "—", color: muted, weight: 500, font: "DM Sans", size: 15 };
};

const TransactionCard = ({ tx, onClick }: Props) => {
  const t = useTheme();
  const { Icon, bg, color } = iconForTx(tx);
  const pill = statusPill(tx.status);
  const val = valueDisplay(tx, t.muted);
  const isWinner = tx.type === "sorteio" && tx.sorteioStatus === "ganhou";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        background: t.surface,
        borderRadius: 14,
        padding: isWinner ? "26px 16px 16px" : "16px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 14,
        border: isWinner ? "2px solid #F5A623" : `1px solid ${t.border}`,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {isWinner && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            borderRadius: "12px 12px 0 0",
            background: "rgba(245,166,35,0.15)",
            fontFamily: "DM Sans",
            fontSize: 11,
            fontWeight: 700,
            color: "#F5A623",
            textAlign: "center",
            padding: "5px 0",
          }}
        >
          🏆 VENCEDOR
        </div>
      )}

      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 500,
            color: t.text,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tx.description}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          <span
            style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted }}
          >
            {formatTime(tx.date)}
          </span>
          <span
            style={{
              fontFamily: "DM Sans",
              fontSize: 10,
              fontWeight: 600,
              color: pill.color,
              background: pill.bg,
              border: `1px solid ${pill.border}`,
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {pill.label}
          </span>
        </div>
      </div>

      <span
        style={{
          fontFamily: val.font,
          fontSize: val.size,
          fontWeight: val.weight,
          color: val.color,
          flexShrink: 0,
        }}
      >
        {val.text}
      </span>
    </button>
  );
};

export default TransactionCard;
