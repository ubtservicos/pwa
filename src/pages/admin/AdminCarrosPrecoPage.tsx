import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Car,
  CloudRain,
  Clock,
  Info,
  Layers,
  Loader2,
  RotateCcw,
  Save,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  calculateCarroQuote,
  DEFAULT_CARRO_PRICING_CONFIG,
  type CarroPricingConfig,
} from "@/utils/ride";
import {
  fetchCarroPricingConfig,
  saveCarroPricingConfig,
} from "@/services/CarroPricingService";

const fmtBRL = (val: number) =>
  `R$ ${(Number(val) || 0).toFixed(2).replace(".", ",")}`;

const parseDecimalInput = (raw: string): number | null => {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatDraft = (n: number) => String(n).replace(".", ",");

const DEMANDA_PRESETS = [
  { label: "Normal (1.0×)", value: 1.0 },
  { label: "Moderada (1.15×)", value: 1.15 },
  { label: "Alta (1.3×)", value: 1.3 },
  { label: "Pico (1.5×)", value: 1.5 },
];

const HORARIO_PRESETS = [
  { label: "Diurno (1.0×)", value: 1.0 },
  { label: "Rush (1.15×)", value: 1.15 },
  { label: "Noturno (1.2×)", value: 1.2 },
  { label: "Madrugada (1.35×)", value: 1.35 },
];

const CLIMA_PRESETS = [
  { label: "Bom (1.0×)", value: 1.0 },
  { label: "Chuva Leve (1.1×)", value: 1.1 },
  { label: "Chuva Forte (1.25×)", value: 1.25 },
  { label: "Tempestade (1.4×)", value: 1.4 },
];

export default function AdminCarrosPrecoPage() {
  const toast = useAdminToast();
  const [config, setConfig] = useState<CarroPricingConfig>({
    ...DEFAULT_CARRO_PRICING_CONFIG,
  });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Drafts em string para permitir edição livre com vírgula ou ponto sem travar cursor
  const [taxaDraft, setTaxaDraft] = useState(
    formatDraft(DEFAULT_CARRO_PRICING_CONFIG.taxaUnica),
  );
  const [kmDraft, setKmDraft] = useState(
    formatDraft(DEFAULT_CARRO_PRICING_CONFIG.valorPorKm),
  );
  const [gatilhoDraft, setGatilhoDraft] = useState(
    formatDraft(DEFAULT_CARRO_PRICING_CONFIG.kmGatilhoIdaVolta),
  );

  // Simulador
  const [simKm, setSimKm] = useState(6);

  const syncDraftsFromConfig = (cfg: CarroPricingConfig) => {
    setTaxaDraft(formatDraft(cfg.taxaUnica));
    setKmDraft(formatDraft(cfg.valorPorKm));
    setGatilhoDraft(formatDraft(cfg.kmGatilhoIdaVolta));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const stored = await fetchCarroPricingConfig();
      if (!active) return;
      setConfig(stored);
      setUpdatedAt(stored.updatedAt);
      syncDraftsFromConfig(stored);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleTaxaChange = (raw: string) => {
    setTaxaDraft(raw);
    const parsed = parseDecimalInput(raw);
    if (parsed !== null && parsed >= 0) {
      setConfig((prev) => ({ ...prev, taxaUnica: parsed }));
    }
  };

  const handleKmChange = (raw: string) => {
    setKmDraft(raw);
    const parsed = parseDecimalInput(raw);
    if (parsed !== null && parsed >= 0) {
      setConfig((prev) => ({ ...prev, valorPorKm: parsed }));
    }
  };

  const handleGatilhoChange = (raw: string) => {
    setGatilhoDraft(raw);
    const parsed = parseDecimalInput(raw);
    if (parsed !== null && parsed >= 0) {
      setConfig((prev) => ({ ...prev, kmGatilhoIdaVolta: parsed }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveCarroPricingConfig(config);
      setConfig(saved);
      setUpdatedAt(saved.updatedAt);
      syncDraftsFromConfig(saved);
      toast.show("Tarifas da vertical Carros atualizadas com sucesso! ✓");
    } catch (err: any) {
      console.error("Erro ao salvar tarifas de Carros:", err);
      toast.show(
        err?.message || "Erro ao salvar tarifas de Carros no banco de dados.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults: CarroPricingConfig = {
      ...DEFAULT_CARRO_PRICING_CONFIG,
      subtypeMultipliers: { padrao: 1.0 },
    };
    setConfig(defaults);
    syncDraftsFromConfig(defaults);
    toast.show("Valores restaurados para o padrão canônico (clique em Salvar para aplicar).");
  };

  const combinedFactor = useMemo(
    () =>
      Number(
        (
          (config.fatorDemanda || 1) *
          (config.fatorHorario || 1) *
          (config.fatorClima || 1)
        ).toFixed(2),
      ),
    [config.fatorDemanda, config.fatorHorario, config.fatorClima],
  );

  const quote = useMemo(
    () => calculateCarroQuote(simKm, config, "padrao"),
    [simKm, config],
  );

  const subtypesList = useMemo(() => {
    const entries = Object.entries(config.subtypeMultipliers || { padrao: 1.0 });
    return entries.length > 0 ? entries : ([["padrao", 1.0]] as [string, number][]);
  }, [config.subtypeMultipliers]);

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#00E676] animate-spin" />
        <p className="text-sm text-zinc-400">
          Carregando configuração de tarifas de Carros...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-[#09090B] text-zinc-100 space-y-6 max-w-6xl mx-auto">
      {/* Header + Top Save */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#00E676]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-zinc-50 m-0">
                Carros · Tarifas & Preço Dinâmico
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 m-0 mt-0.5">
                Tabela independente (<code>public.carro_pricing_config</code>) — alterações não afetam Mototáxi.
              </p>
            </div>
          </div>
          {updatedAt && (
            <p className="text-[11px] font-mono text-zinc-500 mt-2 mb-0">
              Última atualização:{" "}
              {new Date(updatedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* FÓRMULA CANÔNICA ATIVA — Pílulas com edição direta inline */}
      <div className="rounded-2xl bg-[#121215] border border-emerald-500/35 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00E676]" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#00E676]">
              FÓRMULA CANÔNICA ATIVA (CLIQUE PARA EDITAR)
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">
            Multiplicador Dinâmico Atual:{" "}
            <strong className="text-[#00E676] font-mono">
              {combinedFactor.toFixed(2)}×
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-sm font-mono">
          <span className="text-zinc-400">Preço = (</span>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09090B] border border-zinc-700 focus-within:border-[#00E676]">
            <span className="text-[11px] text-zinc-400">Taxa Única R$</span>
            <input
              aria-label="Fórmula Taxa Única"
              type="text"
              inputMode="decimal"
              value={taxaDraft}
              onChange={(e) => handleTaxaChange(e.target.value)}
              className="w-16 bg-transparent text-[#00E676] font-bold text-sm outline-none text-right"
            />
          </label>

          <span className="text-zinc-400">+ km ×</span>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09090B] border border-zinc-700 focus-within:border-[#00E676]">
            <span className="text-[11px] text-zinc-400">Valor/km R$</span>
            <input
              aria-label="Fórmula Valor por km"
              type="text"
              inputMode="decimal"
              value={kmDraft}
              onChange={(e) => handleKmChange(e.target.value)}
              className="w-16 bg-transparent text-[#00E676] font-bold text-sm outline-none text-right"
            />
          </label>

          <span className="text-zinc-400">) · Gatilho Ida/Volta:</span>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09090B] border border-zinc-700 focus-within:border-[#00E676]">
            <input
              aria-label="Fórmula Gatilho Ida e Volta"
              type="text"
              inputMode="decimal"
              value={gatilhoDraft}
              onChange={(e) => handleGatilhoChange(e.target.value)}
              className="w-14 bg-transparent text-amber-400 font-bold text-sm outline-none text-right"
            />
            <span className="text-[11px] text-zinc-400">km</span>
          </label>

          <span className="text-zinc-400">
            × <strong className="text-[#00E676]">{combinedFactor.toFixed(2)}×</strong>
          </span>
        </div>
      </div>

      {/* Tarifas Base (Cards sincronizados com a fórmula) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <label
            htmlFor="carro-taxa-unica"
            className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-2"
          >
            Taxa Única / Bandeirada (R$)
          </label>
          <input
            id="carro-taxa-unica"
            type="text"
            inputMode="decimal"
            value={taxaDraft}
            onChange={(e) => handleTaxaChange(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#09090B] border border-zinc-700 focus:border-[#00E676] text-lg font-mono font-bold text-zinc-100 outline-none"
          />
          <p className="text-[11px] text-zinc-500 mt-2 mb-0">
            Valor fixo inicial cobrado em toda corrida de carro.
          </p>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <label
            htmlFor="carro-valor-km"
            className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-2"
          >
            Valor por Quilômetro (R$/km)
          </label>
          <input
            id="carro-valor-km"
            type="text"
            inputMode="decimal"
            value={kmDraft}
            onChange={(e) => handleKmChange(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#09090B] border border-zinc-700 focus:border-[#00E676] text-lg font-mono font-bold text-zinc-100 outline-none"
          />
          <p className="text-[11px] text-zinc-500 mt-2 mb-0">
            Tarifa variável multiplicada pela distância da rota.
          </p>
        </div>

        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
          <label
            htmlFor="carro-km-gatilho"
            className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-2"
          >
            Gatilho Ida e Volta (km)
          </label>
          <input
            id="carro-km-gatilho"
            type="text"
            inputMode="decimal"
            value={gatilhoDraft}
            onChange={(e) => handleGatilhoChange(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#09090B] border border-zinc-700 focus:border-[#00E676] text-lg font-mono font-bold text-zinc-100 outline-none"
          />
          <p className="text-[11px] text-zinc-500 mt-2 mb-0">
            Acima desta distância (se &gt; 0), dobra o componente de km para retorno. Use 0 para desativar.
          </p>
        </div>
      </div>

      {/* Multiplicadores Dinâmicos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Demanda */}
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 inline-flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#00E676]" />
              Fator Demanda
            </span>
            <span className="font-mono text-sm font-bold text-[#00E676]">
              {config.fatorDemanda.toFixed(2)}×
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMANDA_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, fatorDemanda: p.value }))
                }
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  Math.abs(config.fatorDemanda - p.value) < 0.01
                    ? "bg-emerald-500/15 border-[#00E676] text-[#00E676]"
                    : "bg-[#09090B] border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horário */}
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Fator Horário
            </span>
            <span className="font-mono text-sm font-bold text-amber-400">
              {config.fatorHorario.toFixed(2)}×
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HORARIO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, fatorHorario: p.value }))
                }
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  Math.abs(config.fatorHorario - p.value) < 0.01
                    ? "bg-amber-500/15 border-amber-400 text-amber-300"
                    : "bg-[#09090B] border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clima */}
        <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 inline-flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-sky-400" />
              Fator Clima
            </span>
            <span className="font-mono text-sm font-bold text-sky-400">
              {config.fatorClima.toFixed(2)}×
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CLIMA_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, fatorClima: p.value }))
                }
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  Math.abs(config.fatorClima - p.value) < 0.01
                    ? "bg-sky-500/15 border-sky-400 text-sky-300"
                    : "bg-[#09090B] border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subtipos de Veículo (subtype_multipliers — Informativo & Expansão Futura) */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base font-bold text-zinc-100 m-0">
              Subtipos de Veículo (<code>subtype_multipliers</code>)
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-300">
            <Info className="w-3.5 h-3.5 text-[#00E676]" />
            Preparado para expansão futura
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-3 mt-0">
          Nesta fase todos os veículos operam sob o multiplicador único <strong>Padrão (1.0×)</strong>. A estrutura JSONB já está persistida para ativar categorias futuras (ex.: Comfort, SUV, Executivo) sem nova migração.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {subtypesList.map(([key, mult]) => (
            <div
              key={key}
              className="px-3.5 py-2 rounded-xl bg-[#09090B] border border-emerald-500/30 flex items-center gap-2.5"
            >
              <span className="text-xs font-bold capitalize text-zinc-100">
                {key === "padrao" ? "Padrão" : key}
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-[#00E676]">
                {Number(mult).toFixed(1)}×
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Simulador Interativo */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#00E676]" />
            <h2 className="font-display text-base font-bold text-zinc-100 m-0">
              Simulador de Corrida · Carros
            </h2>
          </div>
          <span className="font-mono text-sm font-bold text-[#00E676]">
            Distância: {simKm.toFixed(1).replace(".", ",")} km
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={40}
          step={0.5}
          value={simKm}
          onChange={(e) => setSimKm(Number(e.target.value))}
          className="w-full accent-[#00E676] cursor-pointer"
        />

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
            <div className="text-[11px] text-zinc-400 uppercase">
              Valor ao Tomador
            </div>
            <div className="font-display text-2xl font-extrabold text-[#00E676] mt-1">
              {fmtBRL(quote.precoFinal)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              {quote.idaEVoltaAtivada ? "Ida e volta aplicado" : "Tarifa simples"}
            </div>
          </div>
          <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
            <div className="text-[11px] text-zinc-400 uppercase">
              Motorista (90%)
            </div>
            <div className="font-display text-xl font-bold text-zinc-100 mt-1">
              {fmtBRL(quote.repassePrestador)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              Repasse líquido
            </div>
          </div>
          <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
            <div className="text-[11px] text-zinc-400 uppercase">
              Split Plataforma (10%)
            </div>
            <div className="font-display text-xl font-bold text-amber-400 mt-1">
              {fmtBRL(quote.taxaPlataforma)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              7,5% UBT + 2,5% ecossistema
            </div>
          </div>
          <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-3.5">
            <div className="text-[11px] text-zinc-400 uppercase">
              Composição Base
            </div>
            <div className="text-xs text-zinc-300 mt-1.5 space-y-0.5 font-mono">
              <div>Taxa: {fmtBRL(quote.taxaUnica)}</div>
              <div>
                Dist.: {fmtBRL(quote.kmCobrados * quote.valorPorKm)}
              </div>
              <div>Fator: {quote.multiplicadorTotal.toFixed(2)}×</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex justify-end gap-2.5 pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="h-11 px-4 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar Padrão
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-zinc-950 text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Tarifas de Carros
        </button>
      </div>
    </div>
  );
}
