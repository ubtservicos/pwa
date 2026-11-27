import {
  BadgeCheck,
  Calendar,
  Car,
  DoorClosed,
  FileCheck2,
  Palette,
  Snowflake,
  Star,
} from "lucide-react";

export interface CarVehicleDetails {
  brand_model?: string | null;
  plate?: string | null;
  carro_photo_url?: string | null;
  carro_interno_photo_url?: string | null;
  cor?: string | null;
  ano?: number | string | null;
  portas?: number | string | null;
  ar_condicionado?: boolean | null;
  cnh_categoria?: string | null;
  possui_ear?: boolean | null;
  alvara_municipal?: string | null;
  vehicle_subtype?: string | null;
}

export interface CarDriverProfile {
  id: string;
  name: string;
  photo?: string;
  plate: string;
  rating: number;
  vehicle: CarVehicleDetails;
}

const SUBTYPE_LABELS: Record<string, string> = {
  padrao: "Padrão",
  conforto: "Conforto",
  comfort: "Conforto",
  executivo: "Executivo",
  suv: "SUV",
  sedan: "Sedan",
  van: "Van",
  bagageiro: "Bagageiro Grande",
};

export function formatCarSubtypeLabel(subtype?: string | null): string {
  const clean = String(subtype || "padrao").trim().toLowerCase();
  if (!clean) return "Padrão";
  if (SUBTYPE_LABELS[clean]) return SUBTYPE_LABELS[clean];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

function cleanInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function cleanBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseSnapshot(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function mergeCarVehicleDetails(
  vehicleSnapshot?: unknown,
  fallbackProfile?: Record<string, unknown> | null,
): CarVehicleDetails {
  const snap = parseSnapshot(vehicleSnapshot);
  const fb = fallbackProfile && typeof fallbackProfile === "object" ? fallbackProfile : {};

  const pickStr = (key: string) => cleanStr(snap[key]) ?? cleanStr(fb[key]);
  const pickInt = (key: string) => cleanInt(snap[key]) ?? cleanInt(fb[key]);
  const pickBool = (key: string) => {
    const s = cleanBool(snap[key]);
    return s !== null ? s : cleanBool(fb[key]);
  };

  return {
    brand_model: pickStr("brand_model"),
    plate: pickStr("plate"),
    carro_photo_url: pickStr("carro_photo_url"),
    carro_interno_photo_url: pickStr("carro_interno_photo_url"),
    cor: pickStr("cor"),
    ano: pickInt("ano"),
    portas: pickInt("portas"),
    ar_condicionado: pickBool("ar_condicionado"),
    cnh_categoria: pickStr("cnh_categoria"),
    possui_ear: pickBool("possui_ear"),
    alvara_municipal: pickStr("alvara_municipal"),
    vehicle_subtype: pickStr("vehicle_subtype") || "padrao",
  };
}

interface CarVehicleDetailsCardProps {
  driver: {
    name?: string;
    plate?: string;
    rating?: number;
    vehicle?: CarVehicleDetails | null;
  };
  compact?: boolean;
  className?: string;
}

export function CarVehicleDetailsCard({
  driver,
  compact = false,
  className = "",
}: CarVehicleDetailsCardProps) {
  const driverName = cleanStr(driver?.name) || "Motorista UBT";
  const initials =
    driverName
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "UB";
  const ratingVal = typeof driver?.rating === "number" && Number.isFinite(driver.rating) ? driver.rating : 5.0;

  const v = driver?.vehicle || {};
  const plateVal = cleanStr(v.plate) || cleanStr(driver?.plate) || "UBT";
  const modelVal = cleanStr(v.brand_model);
  const corVal = cleanStr(v.cor);
  const anoVal = cleanInt(v.ano);
  const portasVal = cleanInt(v.portas);
  const arVal = cleanBool(v.ar_condicionado);
  const cnhCatVal = cleanStr(v.cnh_categoria);
  const earVal = cleanBool(v.possui_ear);
  const alvaraVal = cleanStr(v.alvara_municipal);
  const subtypeLabel = formatCarSubtypeLabel(v.vehicle_subtype);
  const exteriorPhoto = cleanStr(v.carro_photo_url);
  const interiorPhoto = cleanStr(v.carro_interno_photo_url);

  return (
    <div
      data-testid="car-vehicle-details-card"
      className={`rounded-2xl bg-[#121215] border border-zinc-800 p-3.5 ${className}`}
    >
      {/* Cabeçalho Motorista + Modelo + Placa */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,230,118,0.14)", border: "2px solid #00E676" }}
        >
          <span className="font-display font-bold text-white text-[16px]">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display text-[16px] font-bold text-white truncate">{driverName}</p>
          {modelVal && (
            <p className="font-sans text-[12px] font-semibold text-zinc-300 truncate flex items-center gap-1.5 mt-0.5">
              <Car size={13} className="text-[#00E676] shrink-0" />
              <span className="truncate">{modelVal}</span>
            </p>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={11}
                fill={i <= Math.round(ratingVal) ? "#F5A623" : "transparent"}
                style={{ color: "#F5A623" }}
              />
            ))}
            <span className="ml-1 font-sans text-[11px] text-zinc-400">
              {ratingVal.toFixed(1)}
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg font-mono text-[12px] font-bold text-white bg-zinc-900 border border-zinc-700 shrink-0 tracking-wider">
          {plateVal}
        </span>
      </div>

      {/* Fotos do veículo (externa + interna opcional) */}
      {!compact && (exteriorPhoto || interiorPhoto) && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {exteriorPhoto && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 w-28 h-16 shrink-0">
              <img
                src={exteriorPhoto}
                alt={`Foto externa ${modelVal || "do carro"}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-zinc-200">
                Exterior
              </span>
            </div>
          )}
          {interiorPhoto && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 w-28 h-16 shrink-0">
              <img
                src={interiorPhoto}
                alt={`Foto interna ${modelVal || "do carro"}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-zinc-200">
                Interior
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chips de atributos descritivos (somente campos preenchidos) */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
          <Car size={11} />
          {subtypeLabel}
        </span>

        {corVal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
            <Palette size={11} className="text-zinc-400" />
            {corVal}
          </span>
        )}

        {anoVal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
            <Calendar size={11} className="text-zinc-400" />
            {anoVal}
          </span>
        )}

        {portasVal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
            <DoorClosed size={11} className="text-zinc-400" />
            {portasVal} {portasVal === 1 ? "porta" : "portas"}
          </span>
        )}

        {arVal !== null && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              arVal
                ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
          >
            <Snowflake size={11} />
            {arVal ? "Ar-condicionado" : "Sem ar-condicionado"}
          </span>
        )}

        {cnhCatVal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
            <BadgeCheck size={11} className="text-[#00E676]" />
            CNH Cat. {cnhCatVal.toUpperCase()}
          </span>
        )}

        {earVal === true && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <BadgeCheck size={11} />
            EAR
          </span>
        )}

        {alvaraVal && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
            <FileCheck2 size={11} className="text-amber-400" />
            Alvará {alvaraVal}
          </span>
        )}
      </div>
    </div>
  );
}

export default CarVehicleDetailsCard;
