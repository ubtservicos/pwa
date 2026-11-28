import { ShieldCheck, Sparkles, Store, Truck, MapPin } from "lucide-react";

export interface AmbulanteTrustInfo {
  possuiAlvara?: boolean | null;
  possuiVigilanciaSanitaria?: boolean | null;
  tipoEstrutura?: string | null;
  praiaReferencia?: string | null;
  pontoReferencia?: string | null;
  deliveryFee?: number | null;
  modalidades?: string[] | null;
}

const STRUCTURE_LABELS: Record<string, string> = {
  carrinho: "Carrinho",
  barraca: "Barraca",
  isopor: "Isopor / Térmica",
  ponto_fixo: "Ponto Fixo",
  outro: "Estrutura Ambulante",
};

export function formatTipoEstrutura(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return STRUCTURE_LABELS[key] || raw.trim();
}

export function formatDeliveryFeeLabel(fee?: number | null): string {
  const num = Number(fee ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "Entrega grátis";
  return `Entrega R$ ${num.toFixed(2).replace(".", ",")}`;
}

export function haversineDistanceKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): number | null {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lng1 === null ||
    lng1 === undefined ||
    lat2 === null ||
    lat2 === undefined ||
    lng2 === null ||
    lng2 === undefined
  ) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLng1 = Number(lng1);
  const nLat2 = Number(lat2);
  const nLng2 = Number(lng2);
  if (![nLat1, nLng1, nLat2, nLng2].every(Number.isFinite)) return null;

  const R = 6371;
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLng = ((nLng2 - nLng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistanceLabel(km?: number | null): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function isDeliveryModalidade(modalidade?: string | null): boolean {
  const normalized = String(modalidade || "").trim().toLowerCase();
  return normalized === "entrega" || normalized === "delivery";
}

interface Props {
  info: AmbulanteTrustInfo;
  showDeliveryFee?: boolean;
  showLocation?: boolean;
  compact?: boolean;
}

export default function AmbulanteTrustBadges({
  info,
  showDeliveryFee = true,
  showLocation = true,
  compact = false,
}: Props) {
  const estruturaLabel = formatTipoEstrutura(info.tipoEstrutura);
  const supportsDelivery =
    !info.modalidades ||
    info.modalidades.length === 0 ||
    info.modalidades.some((m) => isDeliveryModalidade(m));

  const badges: Array<{ key: string; label: string; bg: string; border: string; color: string; icon: React.ReactNode }> = [];

  if (info.possuiAlvara) {
    badges.push({
      key: "alvara",
      label: "Alvará Verificado",
      bg: "rgba(13,184,126,0.12)",
      border: "rgba(13,184,126,0.32)",
      color: "#0DB87E",
      icon: <ShieldCheck size={compact ? 11 : 12} />,
    });
  }

  if (info.possuiVigilanciaSanitaria) {
    badges.push({
      key: "vigilancia",
      label: "Vigilância Sanitária",
      bg: "rgba(43,110,232,0.12)",
      border: "rgba(43,110,232,0.32)",
      color: "#60A5FA",
      icon: <Sparkles size={compact ? 11 : 12} />,
    });
  }

  if (estruturaLabel) {
    badges.push({
      key: "estrutura",
      label: estruturaLabel,
      bg: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.12)",
      color: "rgba(255,255,255,0.85)",
      icon: <Store size={compact ? 11 : 12} />,
    });
  }

  if (showDeliveryFee && supportsDelivery) {
    const feeVal = Number(info.deliveryFee ?? 0);
    badges.push({
      key: "delivery_fee",
      label: formatDeliveryFeeLabel(feeVal),
      bg: feeVal <= 0 ? "rgba(13,184,126,0.12)" : "rgba(245,166,35,0.12)",
      border: feeVal <= 0 ? "rgba(13,184,126,0.28)" : "rgba(245,166,35,0.28)",
      color: feeVal <= 0 ? "#0DB87E" : "#F5A623",
      icon: <Truck size={compact ? 11 : 12} />,
    });
  }

  const locationText = [info.praiaReferencia, info.pontoReferencia]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" • ");

  if (badges.length === 0 && (!showLocation || !locationText)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {showLocation && locationText && (
        <div className="flex items-center gap-1 text-[11px] font-sans text-white/70">
          <MapPin size={12} className="text-[#0DB87E] shrink-0" />
          <span className="truncate">{locationText}</span>
        </div>
      )}
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <span
              key={b.key}
              className="inline-flex items-center gap-1 rounded-full font-sans font-semibold"
              style={{
                background: b.bg,
                border: `1px solid ${b.border}`,
                color: b.color,
                padding: compact ? "2px 8px" : "3px 9px",
                fontSize: compact ? 10 : 11,
              }}
            >
              {b.icon}
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
