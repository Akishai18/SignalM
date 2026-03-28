import { useState } from "react";
import { Play, Shield, BarChart3, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegimeAllocations = Record<string, Record<string, number>>;

export interface BacktestConfig {
  allocations: RegimeAllocations;
  transaction_cost_bps: number;
  start_date: string | null;
  end_date: string | null;
}

interface BacktestConfiguratorProps {
  onRun: (config: BacktestConfig) => void;
  isLoading?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REGIMES = [
  {
    id: "0", name: "Calm",
    color: "text-emerald-400",
    accentColor: "#10b981",
    borderClass: "border-emerald-500",
    bgClass: "bg-emerald-500/[0.04]",
    tabActive: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    tabInactive: "text-muted-foreground border-border hover:border-emerald-500/30 hover:text-emerald-400/70",
    dotColor: "bg-emerald-400",
  },
  {
    id: "1", name: "Crisis",
    color: "text-red-400",
    accentColor: "#ef4444",
    borderClass: "border-red-500",
    bgClass: "bg-red-500/[0.04]",
    tabActive: "bg-red-500/15 text-red-400 border-red-500/40",
    tabInactive: "text-muted-foreground border-border hover:border-red-500/30 hover:text-red-400/70",
    dotColor: "bg-red-400",
  },
  {
    id: "2", name: "Elevated Stress",
    color: "text-orange-400",
    accentColor: "#f97316",
    borderClass: "border-orange-500",
    bgClass: "bg-orange-500/[0.04]",
    tabActive: "bg-orange-500/15 text-orange-400 border-orange-500/40",
    tabInactive: "text-muted-foreground border-border hover:border-orange-500/30 hover:text-orange-400/70",
    dotColor: "bg-orange-400",
  },
  {
    id: "3", name: "Transition",
    color: "text-purple-400",
    accentColor: "#a855f7",
    borderClass: "border-purple-500",
    bgClass: "bg-purple-500/[0.04]",
    tabActive: "bg-purple-500/15 text-purple-400 border-purple-500/40",
    tabInactive: "text-muted-foreground border-border hover:border-purple-500/30 hover:text-purple-400/70",
    dotColor: "bg-purple-400",
  },
] as const;

const ASSETS = ["SPY", "XLU", "XLK", "XLF", "XLE", "cash"] as const;

const PRESETS: Array<{ label: string; icon: React.ElementType; allocations: RegimeAllocations }> = [
  {
    label: "Equal Weight",
    icon: BarChart3,
    allocations: {
      "0": { SPY: 25, XLU: 25, XLK: 25, XLF: 25 },
      "1": { SPY: 25, XLU: 25, XLK: 25, XLF: 25 },
      "2": { SPY: 25, XLU: 25, XLK: 25, XLF: 25 },
      "3": { SPY: 25, XLU: 25, XLK: 25, XLF: 25 },
    },
  },
  {
    label: "Crisis Shield",
    icon: Shield,
    allocations: {
      "0": { SPY: 90, XLU: 10 },
      "1": { XLU: 80, SPY: 20 },
      "2": { SPY: 60, XLU: 40 },
      "3": { SPY: 70, XLU: 30 },
    },
  },
];

function makeEmptyAllocations(): RegimeAllocations {
  const zero = Object.fromEntries(ASSETS.map((a) => [a, 0]));
  return { "0": { ...zero }, "1": { ...zero }, "2": { ...zero }, "3": { ...zero } };
}

function weightSum(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + (b || 0), 0);
}

// ── Allocation progress bar ───────────────────────────────────────────────────

function AllocationBar({ total, accentColor }: { total: number; accentColor: string }) {
  const over = total > 100;
  const pct = Math.min(total, 100);
  const barColor = over ? "#ef4444" : total === 100 ? "#10b981" : accentColor;

  return (
    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({
  asset,
  value,
  accentColor,
  onChange,
}: {
  asset: string;
  value: number;
  accentColor: string;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-shrink-0">
        {asset}
      </span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-1.5 rounded-full cursor-pointer appearance-none bg-muted/50"
          style={{ accentColor }}
        />
      </div>
      <div className="relative flex-shrink-0 w-[58px]">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 pr-5 text-xs font-mono text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BacktestConfigurator({ onRun, isLoading = false }: BacktestConfiguratorProps) {
  const [allocations, setAllocations] = useState<RegimeAllocations>(makeEmptyAllocations);
  const [costBps, setCostBps] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [activeRegimeId, setActiveRegimeId] = useState("0");

  const dateError = startDate !== "" && endDate !== "" && startDate > endDate;

  function setWeight(regimeId: string, asset: string, raw: string) {
    const val = raw === "" ? 0 : Math.max(0, Math.min(100, Number(raw)));
    setActivePreset(null);
    setAllocations((prev) => ({
      ...prev,
      [regimeId]: { ...prev[regimeId], [asset]: val },
    }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const next = makeEmptyAllocations();
    for (const [id, weights] of Object.entries(preset.allocations)) {
      next[id] = { ...next[id], ...weights };
    }
    setAllocations(next);
    setActivePreset(preset.label);
  }

  function handleClear() {
    setAllocations(makeEmptyAllocations());
    setActivePreset(null);
  }

  function handleRun() {
    const apiAllocations: RegimeAllocations = {};
    for (const [regimeId, weights] of Object.entries(allocations)) {
      const nonZero = Object.fromEntries(
        Object.entries(weights)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => [k, v / 100])
      );
      if (Object.keys(nonZero).length > 0) {
        apiAllocations[regimeId] = nonZero;
      }
    }
    onRun({
      allocations: apiAllocations,
      transaction_cost_bps: costBps,
      start_date: startDate !== "" ? startDate : null,
      end_date: endDate !== "" ? endDate : null,
    });
  }

  const anyOver = REGIMES.some((r) => weightSum(allocations[r.id]) > 100);
  const cannotRun = anyOver || dateError;
  const activeRegime = REGIMES.find((r) => r.id === activeRegimeId)!;
  const activeWeights = allocations[activeRegimeId];
  const activeTotal = weightSum(activeWeights);
  const activeOver = activeTotal > 100;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold tracking-tight">Strategy Configurator</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Set per-regime allocations. Remainder is implicit cash.
        </p>
      </div>

      {/* Preset + Clear row */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.label;
          return (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <preset.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* Regime tab nav */}
      <div className="grid grid-cols-4 gap-1.5">
        {REGIMES.map((regime) => {
          const total = weightSum(allocations[regime.id]);
          const over = total > 100;
          const isActive = regime.id === activeRegimeId;
          return (
            <button
              key={regime.id}
              onClick={() => setActiveRegimeId(regime.id)}
              className={`relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                isActive ? regime.tabActive : regime.tabInactive
              }`}
            >
              <span className="truncate w-full text-center leading-tight text-[11px]">
                {regime.name === "Elevated Stress" ? "Elev. Stress" : regime.name}
              </span>
              <span className={`text-[10px] font-mono tabular-nums ${over ? "text-red-400" : "opacity-60"}`}>
                {total}%
              </span>
              {/* active underline */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ backgroundColor: regime.accentColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active regime panel */}
      <div className={`rounded-xl border ${activeRegime.borderClass} ${activeRegime.bgClass} px-4 pt-4 pb-3`}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold ${activeRegime.color}`}>
            {activeRegime.name}
          </span>
          <span className={`text-xs font-mono tabular-nums font-semibold ${
            activeOver ? "text-red-400" : activeTotal === 100 ? "text-emerald-400" : "text-muted-foreground"
          }`}>
            {activeOver && <span className="mr-1">⚠</span>}
            {activeTotal}%
          </span>
        </div>

        {/* Fill bar */}
        <div className="mb-3">
          <AllocationBar total={activeTotal} accentColor={activeRegime.accentColor} />
        </div>

        {/* Asset rows */}
        <div className="flex flex-col divide-y divide-border/20">
          {ASSETS.map((asset) => (
            <AssetRow
              key={asset}
              asset={asset}
              value={activeWeights[asset]}
              accentColor={activeRegime.accentColor}
              onChange={(raw) => setWeight(activeRegimeId, asset, raw)}
            />
          ))}
        </div>
      </div>

      {/* All-regime summary dots */}
      <div className="flex items-center gap-3 flex-wrap">
        {REGIMES.map((regime) => {
          const total = weightSum(allocations[regime.id]);
          const over = total > 100;
          const full = total === 100;
          return (
            <button
              key={regime.id}
              onClick={() => setActiveRegimeId(regime.id)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${regime.dotColor} ${regime.id === activeRegimeId ? "opacity-100" : "opacity-50"}`} />
              <span className={over ? "text-red-400" : full ? "text-emerald-400" : ""}>
                {regime.name === "Elevated Stress" ? "Elev." : regime.name}: {total}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings row: Transaction cost + Date range */}
      <div className="grid grid-cols-2 gap-3">
        {/* Transaction cost */}
        <div className="rounded-xl border border-border bg-card px-3.5 pt-3 pb-3.5">
          <p className="text-xs font-medium mb-0.5">Transaction Cost</p>
          <p className="text-[10px] text-muted-foreground mb-2.5">Per-rebalance haircut</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.min(costBps, 100)}
              onChange={(e) => setCostBps(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full cursor-pointer appearance-none bg-muted/50"
              style={{ accentColor: "hsl(var(--primary))" }}
            />
            <div className="relative flex-shrink-0 w-[54px]">
              <input
                type="number"
                min={0}
                max={500}
                value={costBps}
                onChange={(e) => setCostBps(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-md border border-border bg-background px-2 py-1 pr-5 text-xs font-mono text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
              />
              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                bp
              </span>
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>

        {/* Date range */}
        <div className="rounded-xl border border-border bg-card px-3.5 pt-3 pb-3.5">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-medium">Date Range</p>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Clear
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mb-2.5">Empty = full history</p>
          <div className="space-y-2">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full rounded-md border bg-background px-2 py-1 text-[11px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 ${
                  dateError ? "border-red-500/60" : "border-border"
                }`}
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full rounded-md border bg-background px-2 py-1 text-[11px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 ${
                  dateError ? "border-red-500/60" : "border-border"
                }`}
              />
            </div>
          </div>
          {dateError && (
            <p className="mt-1.5 text-[10px] text-red-400">⚠ Start must be before end</p>
          )}
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={isLoading || cannotRun}
        title={
          anyOver ? "One or more regimes exceed 100% allocation"
          : dateError ? "Start date must be before end date"
          : undefined
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
        {isLoading ? "Running…" : anyOver ? "Fix allocations to run" : dateError ? "Fix dates to run" : "Run Backtest"}
      </button>
    </div>
  );
}
