import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Package,
  RefreshCw,
  Snowflake,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";

type PeriodFilter = "7d" | "30d" | "all";

interface CarroRideRow {
  id: string;
  tomador_id: string | null;
  prestador_id: string | null;
  type: string | null;
  status: string | null;
  estimated_price: number | null;
  final_price: number | null;
  distance_km: number | null;
  duration_min: number | null;
  origin: any;
  destination: any;
  created_at: string;
}

interface PrestadorCarroRow {
  user_id: string;
  plate: string | null;
  model: string | null;
  modalidade: string | null;
  kyc_status: string | null;
  is_online: boolean | null;
  rating: number | null;
  cor?: string | null;
  ano?: number | null;
  portas?: number | null;
  ar_condicionado?: boolean | null;
  vehicle_subtype?: string | null;
  created_at?: string;
}

interface CarroSessionRow {
  user_id: string;
  is_online: boolean | null;
  last_heartbeat?: string | null;
}

interface SplitRow {
  id: string;
  service_id: string | null;
  service_type: string | null;
  total_amount: number | null;
  provider_amount: number | null;
  ubt_amount: number | null;
  status: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
  phone: string | null;
}

interface AssocScopeState {
  isScoped: boolean;
  associacaoId: string | null;
  associacaoNome: string | null;
  motoristaIds: Set<string>;
}

const formatBRL = (v: number) =>
  "R$ " +
  (Number(v) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const extractAddress = (geo: any): string => {
  if (!geo) return "Endereço não informado";
  if (typeof geo === "string") return geo;
  return geo.address || geo.label || geo.name || "Ubatuba/SP";
};

export default function AdminCarrosDashboardPage() {
  const toast = useAdminToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rides, setRides] = useState<CarroRideRow[]>([]);
  const [drivers, setDrivers] = useState<PrestadorCarroRow[]>([]);
  const [sessions, setSessions] = useState<CarroSessionRow[]>([]);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [assocScope, setAssocScope] = useState<AssocScopeState>({
    isScoped: false,
    associacaoId: null,
    associacaoNome: null,
    motoristaIds: new Set(),
  });

  const loadData = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);

      try {
        let nextScope: AssocScopeState = {
          isScoped: false,
          associacaoId: null,
          associacaoNome: null,
          motoristaIds: new Set(),
        };

        try {
          if (typeof (supabase as any).rpc === "function") {
            const { data: overview } = await (supabase as any).rpc(
              "admin_get_carro_associacao_overview",
              { p_associacao_id: null },
            );
            if (overview && overview.caller_role === "associacao") {
              const assoc = Array.isArray(overview.associacoes)
                ? overview.associacoes[0]
                : null;
              const ids = new Set<string>(
                (Array.isArray(overview.motoristas) ? overview.motoristas : []).map(
                  (m: any) => String(m.id),
                ),
              );
              nextScope = {
                isScoped: true,
                associacaoId: overview.caller_associacao_id || assoc?.id || null,
                associacaoNome: assoc?.nome || "Associação de Carros",
                motoristaIds: ids,
              };
            }
          }
        } catch {
          // Superadmin / operator sem escopo restrito
        }

        setAssocScope(nextScope);

        const [ridesRes, driversRes, sessionsRes, splitsRes, profilesRes] =
          await Promise.all([
            supabase
              .from("carro_corridas")
              .select(
                "id, tomador_id, prestador_id, type, status, estimated_price, final_price, distance_km, duration_min, origin, destination, created_at",
              )
              .order("created_at", { ascending: false })
              .limit(1000),
            supabase
              .from("prestador_carro")
              .select(
                "user_id, plate, model, modalidade, kyc_status, is_online, rating, cor, ano, portas, ar_condicionado, vehicle_subtype, created_at",
              )
              .order("created_at", { ascending: false }),
            supabase
              .from("carro_sessoes")
              .select("user_id, is_online, last_heartbeat"),
            supabase
              .from("pagamentos_split")
              .select(
                "id, service_id, service_type, total_amount, provider_amount, ubt_amount, status, created_at",
              )
              .eq("service_type", "carro")
              .order("created_at", { ascending: false })
              .limit(1000),
            supabase.from("profiles").select("id, name, phone"),
          ]);

        const rawRides = (ridesRes.data || []) as CarroRideRow[];
        const rawDrivers = (driversRes.data || []) as PrestadorCarroRow[];
        const rawSessions = (sessionsRes.data || []) as CarroSessionRow[];
        const rawSplits = (splitsRes.data || []) as SplitRow[];

        if (nextScope.isScoped) {
          const allowedDrivers = nextScope.motoristaIds;
          const scopedRides = rawRides.filter(
            (r) => r.prestador_id && allowedDrivers.has(r.prestador_id),
          );
          const scopedRideIds = new Set(scopedRides.map((r) => r.id));
          setRides(scopedRides);
          setDrivers(rawDrivers.filter((d) => allowedDrivers.has(d.user_id)));
          setSessions(rawSessions.filter((s) => allowedDrivers.has(s.user_id)));
          setSplits(
            rawSplits.filter(
              (sp) => sp.service_id && scopedRideIds.has(sp.service_id),
            ),
          );
        } else {
          setRides(rawRides);
          setDrivers(rawDrivers);
          setSessions(rawSessions);
          setSplits(rawSplits);
        }

        const pMap = new Map<string, ProfileRow>();
        ((profilesRes.data || []) as ProfileRow[]).forEach((p) =>
          pMap.set(p.id, p),
        );
        setProfiles(pMap);
      } catch (err) {
        console.error("Erro ao carregar Dashboard de Carros:", err);
        toastRef.current.show("Erro ao carregar métricas da vertical Carros.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cutoffMs = useMemo(() => {
    if (period === "all") return 0;
    const days = period === "7d" ? 7 : 30;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [period]);

  const filteredRides = useMemo(() => {
    if (cutoffMs === 0) return rides;
    return rides.filter((r) => new Date(r.created_at).getTime() >= cutoffMs);
  }, [rides, cutoffMs]);

  const filteredSplits = useMemo(() => {
    if (cutoffMs === 0) return splits;
    return splits.filter((s) => new Date(s.created_at).getTime() >= cutoffMs);
  }, [splits, cutoffMs]);

  const kpis = useMemo(() => {
    const totalRides = filteredRides.length;
    const completedRides = filteredRides.filter((r) =>
      ["completed", "finished", "concluida", "paid"].includes(
        String(r.status || "").toLowerCase(),
      ),
    );
    const cancelledRides = filteredRides.filter((r) =>
      ["cancelled", "canceled", "cancelada", "expired"].includes(
        String(r.status || "").toLowerCase(),
      ),
    );
    const inProgressRides = filteredRides.filter((r) =>
      ["searching", "accepted", "arrived", "in_progress", "ongoing"].includes(
        String(r.status || "").toLowerCase(),
      ),
    );

    const passengerCount = filteredRides.filter(
      (r) => String(r.type || "passageiro").toLowerCase() !== "entrega",
    ).length;
    const deliveryCount = filteredRides.filter(
      (r) => String(r.type || "").toLowerCase() === "entrega",
    ).length;

    const settledSplits = filteredSplits.filter((s) =>
      ["approved", "paid", "confirmed", "captured", "authorized"].includes(
        String(s.status || "").toLowerCase(),
      ),
    );

    const gmvFromSplits = settledSplits.reduce(
      (acc, s) => acc + Number(s.total_amount || 0),
      0,
    );
    const providerFromSplits = settledSplits.reduce(
      (acc, s) => acc + Number(s.provider_amount || 0),
      0,
    );
    const ubtFromSplits = settledSplits.reduce(
      (acc, s) => acc + Number(s.ubt_amount || 0),
      0,
    );

    const fallbackGmv = completedRides.reduce(
      (acc, r) => acc + Number(r.final_price ?? r.estimated_price ?? 0),
      0,
    );
    const gmv = gmvFromSplits > 0 ? gmvFromSplits : fallbackGmv;
    const providerPayout =
      providerFromSplits > 0 ? providerFromSplits : gmv * 0.9;
    const ubtRevenue = ubtFromSplits > 0 ? ubtFromSplits : gmv * 0.075;

    const settledCount =
      settledSplits.length > 0 ? settledSplits.length : completedRides.length;
    const ticketMedio = settledCount > 0 ? gmv / settledCount : 0;

    const completionRate =
      totalRides > 0 ? (completedRides.length / totalRides) * 100 : 0;
    const cancellationRate =
      totalRides > 0 ? (cancelledRides.length / totalRides) * 100 : 0;

    const onlineSessionIds = new Set(
      sessions.filter((s) => s.is_online).map((s) => s.user_id),
    );
    const onlineDrivers = drivers.filter(
      (d) => d.is_online || onlineSessionIds.has(d.user_id),
    ).length;
    const approvedDrivers = drivers.filter(
      (d) => d.kyc_status === "approved",
    ).length;
    const pendingDrivers = drivers.filter(
      (d) => d.kyc_status === "pending",
    ).length;

    return {
      totalRides,
      completedCount: completedRides.length,
      cancelledCount: cancelledRides.length,
      inProgressCount: inProgressRides.length,
      passengerCount,
      deliveryCount,
      gmv,
      providerPayout,
      ubtRevenue,
      ticketMedio,
      completionRate,
      cancellationRate,
      onlineDrivers,
      approvedDrivers,
      pendingDrivers,
      totalDrivers: drivers.length,
    };
  }, [filteredRides, filteredSplits, drivers, sessions]);

  const hourlyBars = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}h`,
      count: 0,
    }));
    filteredRides.forEach((r) => {
      const h = new Date(r.created_at).getHours();
      if (Number.isFinite(h) && h >= 0 && h < 24) {
        counts[h].count += 1;
      }
    });
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({
      ...c,
      pct: Math.round((c.count / max) * 100),
    }));
  }, [filteredRides]);

  const topRoutes = useMemo(() => {
    const map = new Map<
      string,
      { route: string; count: number; revenue: number }
    >();
    filteredRides.forEach((r) => {
      const orig = extractAddress(r.origin).split(",")[0].trim();
      const dest = extractAddress(r.destination).split(",")[0].trim();
      const key = `${orig} → ${dest}`;
      const prev = map.get(key) || { route: key, count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += Number(r.final_price ?? r.estimated_price ?? 0);
      map.set(key, prev);
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredRides]);

  const driverStats = useMemo(() => {
    const rideCountByDriver = new Map<string, number>();
    filteredRides.forEach((r) => {
      if (r.prestador_id) {
        rideCountByDriver.set(
          r.prestador_id,
          (rideCountByDriver.get(r.prestador_id) || 0) + 1,
        );
      }
    });
    const onlineSet = new Set(
      sessions.filter((s) => s.is_online).map((s) => s.user_id),
    );
    return drivers.map((d) => {
      const prof = profiles.get(d.user_id);
      return {
        ...d,
        name: prof?.name || `Motorista #${d.user_id.slice(0, 6)}`,
        phone: prof?.phone || "—",
        onlineNow: Boolean(d.is_online || onlineSet.has(d.user_id)),
        ridesInPeriod: rideCountByDriver.get(d.user_id) || 0,
      };
    });
  }, [drivers, filteredRides, sessions, profiles]);

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-7 h-7 text-[#00E676] animate-spin" />
        <p className="text-sm text-zinc-400">
          Carregando Dashboard da vertical Carros...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-[#09090B] text-zinc-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#00E676]" />
            </div>
            <h1 className="font-display text-2xl font-bold text-zinc-50 m-0">
              Carros · Dashboard Operacional
            </h1>
            {assocScope.isScoped && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-[#00E676] border border-emerald-500/30">
                <Building2 className="w-3.5 h-3.5" />
                Visão da Associação · {assocScope.associacaoNome}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 mb-0">
            Indicadores isolados da categoria Carros (corridas, frota credenciada, faturamento GMV e repasse 90%).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["7d", "30d", "all"] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                period === p
                  ? "bg-[#00E676] text-zinc-950 border-[#00E676]"
                  : "bg-[#121215] text-zinc-300 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Todo período"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="h-9 px-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#00E676]" : ""}`}
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>Corridas Carros</span>
            <Activity className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="font-display text-3xl font-extrabold text-zinc-50 mt-2">
            {kpis.totalRides}
          </div>
          <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-emerald-400 font-semibold">
              {kpis.completedCount} concluídas
            </span>
            <span>·</span>
            <span>{kpis.inProgressCount} ativas</span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>Motoristas Frota</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-display text-3xl font-extrabold text-zinc-50 mt-2">
            {kpis.onlineDrivers}
            <span className="text-sm font-medium text-zinc-400 ml-1.5">
              online
            </span>
          </div>
          <div className="text-xs text-zinc-400 mt-1.5">
            <strong className="text-zinc-200">{kpis.approvedDrivers}</strong> aprovados ·{" "}
            <strong className="text-amber-400">{kpis.pendingDrivers}</strong> pendentes KYC
          </div>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>GMV Carros</span>
            <DollarSign className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#00E676] mt-2">
            {formatBRL(kpis.gmv)}
          </div>
          <div className="text-xs text-zinc-400 mt-1.5">
            Ticket médio: <strong className="text-zinc-200">{formatBRL(kpis.ticketMedio)}</strong>
          </div>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>Repasse Motoristas</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2">
            {formatBRL(kpis.providerPayout)}
          </div>
          <div className="text-xs text-zinc-400 mt-1.5">
            90% líquido · Receita UBT: {formatBRL(kpis.ubtRevenue)}
          </div>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>Conclusão / Cancel.</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-display text-3xl font-extrabold text-zinc-50 mt-2">
            {kpis.completionRate.toFixed(1)}%
          </div>
          <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              Cancelamento:{" "}
              <strong className="text-rose-400">
                {kpis.cancellationRate.toFixed(1)}%
              </strong>{" "}
              ({kpis.cancelledCount})
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Hourly demand */}
        <div className="lg:col-span-2 rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00E676]" />
              <h2 className="font-display text-base font-bold text-zinc-100 m-0">
                Demanda por Horário (24h)
              </h2>
            </div>
            <span className="text-xs text-zinc-500">
              Distribuição de chamados Carros
            </span>
          </div>

          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 items-end h-40 pt-4">
            {hourlyBars.map((b) => (
              <div
                key={b.hour}
                className="flex flex-col items-center justify-end h-full gap-1"
                title={`${b.label}: ${b.count} corridas`}
              >
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-[#00E676]/80 hover:bg-[#00E676] transition-all min-h-[4px]"
                    style={{ height: `${Math.max(4, b.pct)}%` }}
                  />
                </div>
                {b.hour % 3 === 0 && (
                  <span className="text-[10px] font-mono text-zinc-500">
                    {b.hour}h
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modalidades & Top Routes */}
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base font-bold text-zinc-100 m-0">
              Modalidades
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Passageiros
              </div>
              <div className="font-display text-2xl font-bold text-zinc-50 mt-1">
                {kpis.passengerCount}
              </div>
            </div>
            <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Entregas
              </div>
              <div className="font-display text-2xl font-bold text-amber-400 mt-1">
                {kpis.deliveryCount}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              <MapPin className="w-3.5 h-3.5 text-[#00E676]" />
              Rotas Mais Frequentes
            </div>
            {topRoutes.length === 0 ? (
              <p className="text-xs text-zinc-500 m-0">
                Nenhuma corrida registrada no período selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {topRoutes.map((rt) => (
                  <div
                    key={rt.route}
                    className="flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-lg bg-[#09090B] border border-zinc-800/80"
                  >
                    <span className="text-zinc-200 truncate">{rt.route}</span>
                    <span className="font-mono font-bold text-[#00E676] shrink-0">
                      {rt.count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base font-bold text-zinc-100 m-0">
              Motoristas de Carros ({driverStats.length})
            </h2>
          </div>
          <span className="text-xs text-zinc-500">
            Tabela independente <code>prestador_carro</code>
          </span>
        </div>

        {driverStats.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Nenhum motorista de carro cadastrado neste escopo ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-950/70 border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Motorista</th>
                  <th className="py-3 px-4">Veículo & Atributos</th>
                  <th className="py-3 px-4">Modalidade</th>
                  <th className="py-3 px-4">KYC</th>
                  <th className="py-3 px-4 text-center">Status Online</th>
                  <th className="py-3 px-4 text-right">Corridas (Período)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {driverStats.map((drv) => (
                  <tr key={drv.user_id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-100">
                        {drv.name}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {drv.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-200 font-medium">
                        {drv.model || "Modelo não informado"}{" "}
                        {drv.plate && (
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 ml-1">
                            {drv.plate}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-zinc-400">
                        {drv.cor && <span>{drv.cor}</span>}
                        {drv.ano && <span>· {drv.ano}</span>}
                        {drv.portas && <span>· {drv.portas}P</span>}
                        {drv.ar_condicionado && (
                          <span className="inline-flex items-center gap-0.5 text-sky-400">
                            · <Snowflake className="w-3 h-3" /> Ar
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-zinc-300">
                      {drv.modalidade || "ambos"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          drv.kyc_status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : drv.kyc_status === "rejected"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {drv.kyc_status === "approved"
                          ? "Aprovado"
                          : drv.kyc_status === "rejected"
                            ? "Reprovado"
                            : "Pendente"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {drv.onlineNow ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-[#00E676]">
                          <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Offline</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-100">
                      {drv.ridesInPeriod}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
