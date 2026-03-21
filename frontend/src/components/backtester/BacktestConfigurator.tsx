import { useState } from "react";
import { Play, Shield, BarChart3, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegimeAllocations = Record<string, Record<string, number>>;

export interface BacktestConfig {
  allocations: RegimeAllocations;
  transaction_cost_bps: number;
  start_date: string | null;   // YYYY-MM-DD or null for full history
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
    accentColor: "#10b981",       // emerald-500
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-500/[0.04]",
  },
  {
    id: "1", name: "Crisis",
    color: "text-red-400",
    accentColor: "#ef4444",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-500/[0.04]",
  },
  {
    id: "2", name: "Elevated Stress",
    color: "text-orange-400",
    accentColor: "#f97316",
    borderClass: "border-l-orange-500",
    bgClass: "bg-orange-500/[0.04]",
  },
  {
    id: "3", name: "Transition",
    color: "text-purple-400",
    accentColor: "#a855f7",
    borderClass: "border-l-purple-500",
    bgClass: "bg-purple-500/[0.04]",
  },
] as const;

const ASSETS = ["SPY", "XLU", "XLK", "XLF", "XLE", "cash"] as const;

// ── Preset strategies ─────────────────────────────────────────────────────────

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

// Every asset starts at 0 so inputs are always controlled (never undefined).
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
    <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}

// ── Asset row (slider + number) ───────────────────────────────────────────────

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
    <div className="flex items-center gap-2 py-1.5">
      {/* Label */}
      <span className="w-8 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
        {asset}
      </span>

      {/* Slider */}
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-1.5 rounded-full cursor-pointer appearance-none bg-muted/60"
          style={{ accentColor }}
        />
      </div>

      {/* Number input */}
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

  // Date validation: only invalid when both are set and start > end
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
      // Convert empty string → null; API expects str | None
      start_date: startDate !== "" ? startDate : null,
      end_date: endDate !== "" ? endDate : null,
    });
  }

  const anyOver = REGIMES.some((r) => weightSum(allocations[r.id]) > 100);
  const cannotRun = anyOver || dateError;

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold tracking-tight">Strategy Configurator</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag sliders or type weights per regime. Remainder is implicit cash.
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
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-sidebar-accent"
              }`}
            >
              <preset.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* Regime sections */}
      <div className="flex flex-col gap-3">
        {REGIMES.map((regime) => {
          const weights = allocations[regime.id];
          const total = weightSum(weights);
          const over = total > 100;
          const full = total === 100;

          return (
            <div
              key={regime.id}
              className={`rounded-r-xl rounded-tl-sm rounded-bl-sm border border-l-[3px] border-border ${regime.borderClass} ${regime.bgClass} px-4 pt-3.5 pb-3`}
            >
              {/* Regime header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-semibold ${regime.color}`}>{regime.name}</span>
                <span
                  className={`text-xs font-mono tabular-nums font-medium ${
                    over ? "text-red-400" : full ? "text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {over && <span className="mr-1 text-red-400">⚠</span>}
                  {total}%
                </span>
              </div>

              {/* Allocation fill bar */}
              <div className="mb-3">
                <AllocationBar total={total} accentColor={regime.accentColor} />
              </div>

              {/* Asset rows */}
              <div className="flex flex-col divide-y divide-border/30">
                {ASSETS.map((asset) => (
                  <AssetRow
                    key={asset}
                    asset={asset}
                    value={weights[asset]}
                    accentColor={regime.accentColor}
                    onChange={(raw) => setWeight(regime.id, asset, raw)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction cost */}
      <div className="rounded-xl border border-border bg-card px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Transaction Cost</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Basis-point haircut applied on each rebalance
            </p>
          </div>
          <div className="relative flex-shrink-0 w-[64px]">
            <input
              type="number"
              min={0}
              max={500}
              value={costBps}
              onChange={(e) => setCostBps(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 pr-7 text-sm font-mono font-semibold text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              bp
            </span>
          </div>
        </div>
        {/* Slider 0–100 bps */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.min(costBps, 100)}
          onChange={(e) => setCostBps(Number(e.target.value))}
          className="w-full h-1.5 rounded-full cursor-pointer appearance-none bg-muted/60"
          style={{ accentColor: "hsl(var(--primary))" }}
        />
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60 font-mono select-none">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Date range */}
      <div className="rounded-xl border border-border bg-card px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Date Range</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Leave empty to use full history
            </p>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 ${
                dateError ? "border-red-500/60" : "border-border"
              }`}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 ${
                dateError ? "border-red-500/60" : "border-border"
              }`}
            />
          </div>
        </div>
        {dateError && (
          <p className="mt-2 text-[11px] text-red-400">
            ⚠ Start date must be on or before end date
          </p>
        )}
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
