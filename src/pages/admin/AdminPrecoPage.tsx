import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bike,
  Calculator,
  Check,
  Clock,
  CloudRain,
  Flame,
  Info,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Zap,
} from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  calculateMototaxiQuote,
  DEFAULT_MOTOTAXI_PRICING_CONFIG,
  formatBRL,
} from "@/utils/ride";
import {
  fetchMototaxiPricingConfig,
  saveMototaxiPricingConfig,
} from "@/services/MototaxiPricingService";

type MultiplierOpt = {
  value: number;
  label: string;
  desc: string;
  accent: string;
};

const DEMANDA_OPTIONS: MultiplierOpt[] = [
  { value: 1.0, label: "Normal", desc: "Fluxo regular de pedidos", accent: "#00E676" },
  { value: 1.3, label: "Alta demanda", desc: "Muitos pedidos simultâneos", accent: "#F59E0B" },
  { value: 1.6, label: "Demanda crítica", desc: "Capacidade máxima da frota", accent: "#EF4444" },
];

const HORARIO_OPTIONS: MultiplierOpt[] = [
  { value: 1.0, label: "Dia normal", desc: "06h–17h dias úteis", accent: "#00E676" },
  { value: 1.2, label: "Horário de pico", desc: "07h–09h e 17h–19h", accent: "#F59E0B" },
  { value: 1.4, label: "Madrugada", desc: "00h–05h todos os dias", accent: "#EF4444" },
];

const CLIMA_OPTIONS: MultiplierOpt[] = [
  { value: 1.0, label: "Tempo bom", desc: "Sem precipitação", accent: "#00E676" },
  { value: 1.2, label: "Chuva", desc: "Chuva leve a moderada", accent: "#38BDF8" },
  { value: 1.5, label: "Tempestade", desc: "Chuva forte ou vendaval", accent: "#EF4444" },
];

const SIMULATOR_PRESETS = [
  { km: 5, label: "5 km — Urbano" },
  { km: 8, label: "8 km — Gatilho" },
  { km: 12, label: "12 km — Praia Afastada / Itamambuca" },
  { km: 20, label: "20 km — Extremo Norte/Sul" },
];

function formatDecimalBR(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function parseBRLInput(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function AdminPrecoPage() {
  const toast = useAdminToast();

  // Estado de carregamento & persistência
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Bloco 1 — Tarifa Base (BRL) e Gatilho Ida e Volta (km)
  const [taxaUnicaInput, setTaxaUnicaInput] = useState(
    formatDecimalBR(DEFAULT_MOTOTAXI_PRICING_CONFIG.taxaUnica),
  );
  const [valorPorKmInput, setValorPorKmInput] = useState(
    formatDecimalBR(DEFAULT_MOTOTAXI_PRICING_CONFIG.valorPorKm),
  );
  const [kmGatilhoInput, setKmGatilhoInput] = useState(
    String(DEFAULT_MOTOTAXI_PRICING_CONFIG.kmGatilhoIdaVolta),
  );

  // Bloco 2 — Multiplicadores Dinâmicos
  const [fatorDemanda, setFatorDemanda] = useState(DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorDemanda);
  const [fatorHorario, setFatorHorario] = useState(DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorHorario);
  const [fatorClima, setFatorClima] = useState(DEFAULT_MOTOTAXI_PRICING_CONFIG.fatorClima);

  // Bloco 3 — Simulador Interativo
  const [simDistanceKm, setSimDistanceKm] = useState<number>(5);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await fetchMototaxiPricingConfig();
      setTaxaUnicaInput(formatDecimalBR(cfg.taxaUnica));
      setValorPorKmInput(formatDecimalBR(cfg.valorPorKm));
      setKmGatilhoInput(String(cfg.kmGatilhoIdaVolta));
      setFatorDemanda(cfg.fatorDemanda);
      setFatorHorario(cfg.fatorHorario);
      setFatorClima(cfg.fatorClima);
      setUpdatedAt(cfg.updatedAt);
    } catch (err) {
      console.error("[AdminPrecoPage] Erro ao carregar tarifas:", err);
      toast.show("Erro ao carregar configurações de tarifa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentConfig = useMemo(
    () => ({
      taxaUnica: parseBRLInput(taxaUnicaInput),
      valorPorKm: parseBRLInput(valorPorKmInput),
      kmGatilhoIdaVolta: parseBRLInput(kmGatilhoInput),
      fatorDemanda,
      fatorHorario,
      fatorClima,
    }),
    [taxaUnicaInput, valorPorKmInput, kmGatilhoInput, fatorDemanda, fatorHorario, fatorClima],
  );

  const simQuote = useMemo(
    () => calculateMototaxiQuote(simDistanceKm, currentConfig),
    [simDistanceKm, currentConfig],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveMototaxiPricingConfig(currentConfig);
      setTaxaUnicaInput(formatDecimalBR(saved.taxaUnica));
      setValorPorKmInput(formatDecimalBR(saved.valorPorKm));
      setKmGatilhoInput(String(saved.kmGatilhoIdaVolta));
      setFatorDemanda(saved.fatorDemanda);
      setFatorHorario(saved.fatorHorario);
      setFatorClima(saved.fatorClima);
      setUpdatedAt(saved.updatedAt);
      toast.show("Tarifas e preço dinâmico salvos com sucesso! ✓");
    } catch (err: any) {
      console.error("[AdminPrecoPage] Erro ao salvar tarifas:", err);
      toast.show(err?.message || "Erro ao salvar configuração de preço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50 px-4 sm:px-8 py-7">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-[#00E676]">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold text-zinc-50 tracking-tight m-0">
                    Tarifas & Preço Dinâmico — Mototaxistas
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[#00E676] text-[11px] font-mono uppercase font-bold">
                    Ao Vivo
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 mb-0">
                  Configure a tarifa base em reais, o gatilho automático de ida e volta e os multiplicadores dinâmicos de corrida.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {updatedAt && (
              <span className="hidden md:inline-block text-[11px] font-mono text-zinc-500">
                Atualizado em{" "}
                {new Date(updatedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadConfig()}
              className="h-9 px-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:bg-zinc-900 text-zinc-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#00E676]" : ""}`} />
              Recarregar
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleSave()}
              className="h-9 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Tarifas
            </button>
          </div>
        </div>

        {/* Fórmula Dinâmica ao Vivo — Pílulas Editáveis Inline */}
        <section className="p-5 sm:p-6 rounded-2xl bg-[#121215] border border-zinc-800 shadow-xl flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
              <Zap className="w-3.5 h-3.5 text-[#00E676]" />
              <span>Fórmula Canônica Ativa</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Pencil className="w-3 h-3 text-[#00E676]" />
              Clique nos valores em verde para editar direto na fórmula
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-display text-sm sm:text-base font-bold text-zinc-100 leading-relaxed">
            <span>Preço = [</span>
            <label
              htmlFor="formula-taxa-unica"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-emerald-500/40 focus-within:border-[#00E676] focus-within:ring-1 focus-within:ring-[#00E676]/40 font-mono text-[#00E676] transition-colors cursor-text"
              title="Editar Taxa Única (R$)"
            >
              <span className="text-xs text-zinc-400">R$</span>
              <input
                id="formula-taxa-unica"
                aria-label="Taxa Única na fórmula"
                type="text"
                inputMode="decimal"
                value={taxaUnicaInput}
                onChange={(e) => setTaxaUnicaInput(e.target.value)}
                onBlur={() => setTaxaUnicaInput(formatDecimalBR(parseBRLInput(taxaUnicaInput)))}
                className="w-16 bg-transparent font-mono text-sm sm:text-base font-bold text-[#00E676] outline-none focus:outline-none text-center"
              />
              <Pencil className="w-3 h-3 text-[#00E676]/60 shrink-0" />
            </label>
            <span>+ (</span>
            <label
              htmlFor="formula-valor-km"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-emerald-500/40 focus-within:border-[#00E676] focus-within:ring-1 focus-within:ring-[#00E676]/40 font-mono text-[#00E676] transition-colors cursor-text"
              title="Editar Valor por km (R$)"
            >
              <span className="text-xs text-zinc-400">R$</span>
              <input
                id="formula-valor-km"
                aria-label="Valor por km na fórmula"
                type="text"
                inputMode="decimal"
                value={valorPorKmInput}
                onChange={(e) => setValorPorKmInput(e.target.value)}
                onBlur={() => setValorPorKmInput(formatDecimalBR(parseBRLInput(valorPorKmInput)))}
                className="w-16 bg-transparent font-mono text-sm sm:text-base font-bold text-[#00E676] outline-none focus:outline-none text-center"
              />
              <span className="text-xs text-zinc-400">/km</span>
              <Pencil className="w-3 h-3 text-[#00E676]/60 shrink-0" />
            </label>
            <span>× Km Cobrados)] ×</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 font-mono text-xs text-[#00E676]">
              Demanda {fatorDemanda.toFixed(1)}×
            </span>
            <span>×</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 font-mono text-xs text-[#00E676]">
              Horário {fatorHorario.toFixed(1)}×
            </span>
            <span>×</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 font-mono text-xs text-[#00E676]">
              Clima {fatorClima.toFixed(1)}×
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-sans">
            <span>Gatilho Ida e Volta:</span>
            <label
              htmlFor="formula-km-gatilho"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-700 focus-within:border-[#00E676] font-mono text-zinc-100 cursor-text"
              title="Editar Gatilho de Ida e Volta (km)"
            >
              <input
                id="formula-km-gatilho"
                aria-label="Gatilho de Ida e Volta na fórmula"
                type="text"
                inputMode="decimal"
                value={kmGatilhoInput}
                onChange={(e) => setKmGatilhoInput(e.target.value)}
                className="w-10 bg-transparent font-mono text-xs font-bold text-zinc-100 outline-none focus:outline-none text-center"
              />
              <span className="text-zinc-400">km</span>
            </label>
            {currentConfig.kmGatilhoIdaVolta > 0 ? (
              <span>
                — corridas a partir de{" "}
                <strong className="text-zinc-100">{currentConfig.kmGatilhoIdaVolta} km</strong>{" "}
                cobram 2× a distância (Ida + Volta) · Repasse líquido garantido ao Mototaxista:{" "}
                <strong className="text-[#00E676]">90%</strong>.
              </span>
            ) : (
              <span>
                — regra <strong className="text-amber-400">desativada</strong> (0 km) · Repasse líquido garantido ao Mototaxista:{" "}
                <strong className="text-[#00E676]">90%</strong>.
              </span>
            )}
          </div>
        </section>

        {/* BLOCO 1 — COMPOSIÇÃO DA TARIFA BASE (R$) E REGRA DE IDA E VOLTA */}
        <section className="p-6 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-5">
          <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3">
            <ArrowLeftRight className="w-5 h-5 text-[#00E676]" />
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-zinc-50 m-0">
                1. Composição da Tarifa Base (R$) e Regra de Ida e Volta
              </h2>
              <p className="text-xs text-zinc-400 m-0">
                Valores aplicados automaticamente na cotação de novas corridas no app do passageiro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Taxa Única (R$) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
              <label
                htmlFor="taxa-unica-input"
                className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold"
              >
                Taxa Única (R$)
              </label>
              <div className="flex items-center rounded-xl bg-[#09090B] border border-zinc-800 focus-within:border-[#00E676] px-3.5 transition-colors">
                <span className="font-mono text-sm font-bold text-zinc-400 mr-2">R$</span>
                <input
                  id="taxa-unica-input"
                  type="text"
                  inputMode="decimal"
                  value={taxaUnicaInput}
                  onChange={(e) => setTaxaUnicaInput(e.target.value)}
                  onBlur={() => setTaxaUnicaInput(formatDecimalBR(parseBRLInput(taxaUnicaInput)))}
                  placeholder="4,00"
                  className="flex-1 py-3 bg-transparent font-mono text-lg font-bold text-zinc-50 outline-none"
                />
              </div>
              <span className="text-[11px] text-zinc-500">
                Valor fixo inicial (bandeirada) cobrado em toda corrida.
              </span>
            </div>

            {/* Valor por km rodado (R$) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
              <label
                htmlFor="valor-km-input"
                className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold"
              >
                Valor por km rodado (R$)
              </label>
              <div className="flex items-center rounded-xl bg-[#09090B] border border-zinc-800 focus-within:border-[#00E676] px-3.5 transition-colors">
                <span className="font-mono text-sm font-bold text-zinc-400 mr-2">R$</span>
                <input
                  id="valor-km-input"
                  type="text"
                  inputMode="decimal"
                  value={valorPorKmInput}
                  onChange={(e) => setValorPorKmInput(e.target.value)}
                  onBlur={() => setValorPorKmInput(formatDecimalBR(parseBRLInput(valorPorKmInput)))}
                  placeholder="2,50"
                  className="flex-1 py-3 bg-transparent font-mono text-lg font-bold text-zinc-50 outline-none"
                />
              </div>
              <span className="text-[11px] text-zinc-500">
                Tarifa multiplicada pela quilometragem cobrada.
              </span>
            </div>

            {/* Gatilho de Ida e Volta (km) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
              <label
                htmlFor="km-gatilho-input"
                className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold"
              >
                Gatilho de Ida e Volta (km)
              </label>
              <div className="flex items-center rounded-xl bg-[#09090B] border border-zinc-800 focus-within:border-[#00E676] px-3.5 transition-colors">
                <input
                  id="km-gatilho-input"
                  type="text"
                  inputMode="decimal"
                  value={kmGatilhoInput}
                  onChange={(e) => setKmGatilhoInput(e.target.value)}
                  placeholder="8"
                  className="flex-1 py-3 bg-transparent font-mono text-lg font-bold text-zinc-50 outline-none"
                />
                <span className="font-mono text-sm font-bold text-zinc-400 ml-2">km</span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Use <code className="text-zinc-300">0</code> para desativar a cobrança em dobro.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed">
            <Info className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
            <span>
              A partir desta distância (ex.: Centro → praias afastadas como Itamambuca), o cálculo multiplica a quilometragem por{" "}
              <strong className="text-[#00E676]">2×</strong> para cobrir o retorno vazio do mototaxista.
            </span>
          </div>
        </section>

        {/* BLOCO 2 — MULTIPLICADORES DINÂMICOS (DEMANDA, HORÁRIO E CLIMA) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Zap className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base sm:text-lg font-bold text-zinc-50 m-0">
              2. Multiplicadores Dinâmicos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "Demanda",
                icon: Flame,
                opts: DEMANDA_OPTIONS,
                value: fatorDemanda,
                setter: setFatorDemanda,
              },
              {
                title: "Horário",
                icon: Clock,
                opts: HORARIO_OPTIONS,
                value: fatorHorario,
                setter: setFatorHorario,
              },
              {
                title: "Clima",
                icon: CloudRain,
                opts: CLIMA_OPTIONS,
                value: fatorClima,
                setter: setFatorClima,
              },
            ].map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.title}
                  className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <GroupIcon className="w-4 h-4 text-[#00E676]" />
                      <h3 className="font-display text-sm font-bold text-zinc-100 uppercase tracking-wider m-0">
                        {group.title}
                      </h3>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#00E676]">
                      {group.value.toFixed(1)}×
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {group.opts.map((opt) => {
                      const selected = Math.abs(group.value - opt.value) < 0.001;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => group.setter(opt.value)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                            selected
                              ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.12)]"
                              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/70"
                          }`}
                        >
                          <div
                            className="font-display text-lg font-extrabold min-w-[46px]"
                            style={{ color: selected ? "#00E676" : opt.accent }}
                          >
                            {opt.value.toFixed(1)}×
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-zinc-50">{opt.label}</div>
                            <div className="text-[11px] text-zinc-400 leading-snug">{opt.desc}</div>
                          </div>
                          {selected && (
                            <div className="w-6 h-6 rounded-full bg-[#00E676] text-zinc-950 flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BLOCO 3 — SIMULADOR INTERATIVO DE CORRIDA (TEMPO REAL) */}
        <section className="p-6 rounded-2xl bg-[#121215] border border-zinc-800 shadow-2xl flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Calculator className="w-5 h-5 text-[#00E676]" />
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-zinc-50 m-0">
                  3. Simulador Interativo de Corrida
                </h2>
                <p className="text-xs text-zinc-400 m-0">
                  Teste qualquer distância em tempo real antes de salvar a configuração.
                </p>
              </div>
            </div>

            {simQuote.idaEVoltaAtivada ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/45 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                IDA E VOLTA ATIVADA (2× km — a partir de {currentConfig.kmGatilhoIdaVolta} km)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[#00E676] text-xs font-mono font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5" />
                SOMENTE IDA (1× km)
              </span>
            )}
          </div>

          {/* Slider + Input numérico + Atalhos rápidos */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <span>1 km</span>
                  <span className="text-zinc-100 font-bold text-sm">
                    Distância simulada: <span className="text-[#00E676]">{simDistanceKm} km</span>
                  </span>
                  <span>30 km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={0.5}
                  value={Math.min(30, Math.max(1, simDistanceKm))}
                  onChange={(e) => setSimDistanceKm(Number(e.target.value))}
                  className="w-full accent-[#00E676] cursor-pointer"
                />
              </div>

              <div className="w-36 flex items-center rounded-xl bg-zinc-950 border border-zinc-800 focus-within:border-[#00E676] px-3">
                <input
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={simDistanceKm}
                  onChange={(e) => setSimDistanceKm(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full py-2.5 bg-transparent font-mono text-base font-bold text-zinc-50 outline-none"
                />
                <span className="font-mono text-xs text-zinc-400 ml-1">km</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {SIMULATOR_PRESETS.map((preset) => {
                const isActive = Math.abs(simDistanceKm - preset.km) < 0.01;
                return (
                  <button
                    key={preset.km}
                    type="button"
                    onClick={() => setSimDistanceKm(preset.km)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/15 border-emerald-500 text-[#00E676]"
                        : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resultado Detalhado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="md:col-span-2 p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between gap-3">
              <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                Detalhamento do Cálculo
              </div>
              <div className="space-y-1.5 font-mono text-xs sm:text-sm text-zinc-300">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Taxa Única:</span>
                  <span className="text-zinc-100 font-semibold">{formatBRL(simQuote.taxaUnica)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">
                    Quilometragem ({simQuote.kmCobrados} km × {formatBRL(simQuote.valorPorKm)}):
                  </span>
                  <span className="text-zinc-100 font-semibold">
                    {formatBRL(simQuote.kmCobrados * simQuote.valorPorKm)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Subtotal Base:</span>
                  <span className="text-zinc-100 font-semibold">{formatBRL(simQuote.precoBase)}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-zinc-800 pt-1.5">
                  <span className="text-zinc-400">
                    Multiplicadores ({fatorDemanda.toFixed(1)}× · {fatorHorario.toFixed(1)}× · {fatorClima.toFixed(1)}×):
                  </span>
                  <span className="text-[#00E676] font-bold">
                    {simQuote.multiplicadorTotal.toFixed(2)}×
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950 border border-emerald-500/40 flex flex-col items-center justify-center text-center gap-1.5 shadow-[0_0_24px_rgba(0,230,118,0.08)]">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                Valor Final ao Passageiro
              </span>
              <div className="font-display text-3xl sm:text-4xl font-black text-[#00E676] tracking-tight">
                {formatBRL(simQuote.precoFinal)}
              </div>
              <div className="text-xs text-zinc-300 font-medium mt-1">
                Mototaxista (90%):{" "}
                <strong className="text-zinc-50 font-mono">
                  {formatBRL(simQuote.repasseMototaxista)}
                </strong>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Plataforma (10%): {formatBRL(simQuote.taxaPlataforma)}
              </div>
            </div>
          </div>
        </section>

        {/* Botão Salvar Configuração */}
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void handleSave()}
          className="w-full py-4 px-6 rounded-2xl bg-[#00E676] hover:bg-[#10B981] text-zinc-950 font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(0,230,118,0.28)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-zinc-950" />
              <span>Salvando Configuração...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5 text-zinc-950" />
              <span>Salvar Configuração de Tarifas</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
