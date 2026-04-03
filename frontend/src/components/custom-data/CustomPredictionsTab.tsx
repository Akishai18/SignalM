import { useState } from "react";
import { TrendingUp, Zap, Clock, Activity, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomForecastingEngine } from "./CustomForecastingEngine";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModelResult {
  predicted_regime: number;
  predicted_regime_name: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface HorizonData extends ModelResult {
  horizon_days: number;
  model: string;
  hmm?: ModelResult;
}

interface DurationEntry {
  name: string;
  mean_days: number;
  median_days: number;
  min_days: number;
  max_days: number;
  total_runs: number;
  total_days: number;
}

interface Props {
  currentRegime: number;
  predictions: Record<string, HorizonData>;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
  transitionMatrix?: Record<string, Record<string, number>>;
  transitionCounts?: Record<string, Record<string, number>>;
  durations?: Record<string, DurationEntry>;
  showBanner?: boolean;
  sessionId?: string;
  datasetName?: string;
}

const HORIZONS = ["1d", "7d", "30d"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function getCellBg(value: number): string {
  if (value >= 0.8) return "bg-red-500/60 text-white";
  if (value >= 0.5) return "bg-orange-500/40 text-white";
  if (value >= 0.2) return "bg-yellow-500/30";
  if (value >= 0.1) return "bg-blue-500/20";
  if (value >= 0.01) return "bg-blue-500/10";
  return "bg-muted/30";
}

// ── Summary metric card ────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <div className="text-muted-foreground/50">{icon}</div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ color: color ?? undefined }}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Horizon card ──────────────────────────────────────────────────────────

function HorizonCard({
  pred,
  currentRegime,
  regimeLabelMap,
  regimeColorMap,
}: {
  horizonKey: string;
  pred: HorizonData;
  currentRegime: number;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}) {
  const hasHmm = !!pred.hmm;
  const hmmAgrees = hasHmm && pred.hmm!.predicted_regime === pred.predicted_regime;
  const willTransition = pred.predicted_regime !== currentRegime;
  const markovColor = regimeColorMap[String(pred.predicted_regime)] ?? "#6b7280";

  const sortedProbs = Object.entries(pred.probabilities).sort(([, a], [, b]) => b - a);

  return (
    <div
      className="rounded-xl border p-5 space-y-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
      style={{
        borderColor: markovColor + "40",
        background: markovColor + "0d",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          {pred.horizon_days}-Day Ahead
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {(pred.confidence * 100).toFixed(0)}% conf.
        </span>
      </div>

      {/* Predicted regime — large */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Markov Chain
        </p>
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: markovColor }} />
          <span className="text-xl font-bold" style={{ color: markovColor }}>
            {pred.predicted_regime_name}
          </span>
          {willTransition && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <TrendingUp className="h-3 w-3" />
              transition
            </span>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-500"
            style={{ width: `${pred.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* HMM agreement badge */}
      {hasHmm && (
        <div className="flex items-center justify-between text-xs border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: regimeColorMap[String(pred.hmm!.predicted_regime)] ?? "#6b7280" }}
            />
            <span className="text-muted-foreground">HMM: {pred.hmm!.predicted_regime_name}</span>
          </div>
          <span className={cn(
            "px-2 py-0.5 rounded-full font-medium text-[10px]",
            hmmAgrees ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
          )}>
            {hmmAgrees ? "✓ agrees" : "⚠ differs"}
          </span>
        </div>
      )}

      {/* Probability bars */}
      <div className="space-y-1.5 border-t border-border/40 pt-3">
        {sortedProbs.map(([rid, prob]) => {
          const color = regimeColorMap[rid] ?? "#6b7280";
          const name = regimeLabelMap[rid] ?? `Regime ${rid}`;
          return (
            <div key={rid} className="flex items-center gap-2 text-xs">
              <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground min-w-0 flex-1">{name}</span>
              <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${prob * 100}%`, backgroundColor: color }}
                />
              </div>
              <span className="font-mono w-10 text-right tabular-nums">{(prob * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transition matrix ─────────────────────────────────────────────────────

function InteractiveTransitionMatrix({
  matrix,
  counts,
  regimeLabelMap,
  regimeColorMap,
}: {
  matrix: Record<string, Record<string, number>>;
  counts?: Record<string, Record<string, number>>;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}) {
  const [hoveredCell, setHoveredCell] = useState<{ from: string; to: string } | null>(null);
  const regimeIds = Object.keys(matrix);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Regime Transition Matrix</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hover cells for details · Row = FROM · Column = TO · Diagonal = persistence
        </p>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `120px repeat(${regimeIds.length}, 1fr)` }}
        >
          <div className="text-[10px] text-muted-foreground font-medium p-1">From ↓ &nbsp; To →</div>
          {regimeIds.map((colId) => (
            <div
              key={colId}
              className={cn("text-[10px] font-medium p-1 text-center transition-all", hoveredCell?.to === colId ? "scale-105" : "")}
              style={{ color: regimeColorMap[colId] ?? "#6b7280" }}
            >
              {regimeLabelMap[colId] ?? `R${colId}`}
            </div>
          ))}
          {regimeIds.map((fromId) => (
            <>
              <div
                key={`label-${fromId}`}
                className={cn("text-[10px] font-medium p-1 flex items-center gap-1.5 transition-all", hoveredCell?.from === fromId ? "scale-105" : "")}
                style={{ color: regimeColorMap[fromId] ?? "#6b7280" }}
              >
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: regimeColorMap[fromId] ?? "#6b7280" }} />
                {regimeLabelMap[fromId] ?? `R${fromId}`}
              </div>
              {regimeIds.map((toId) => {
                const value = matrix[fromId]?.[toId] ?? 0;
                const count = counts?.[fromId]?.[toId] ?? null;
                const isHovered = hoveredCell?.from === fromId && hoveredCell?.to === toId;
                return (
                  <div
                    key={`${fromId}-${toId}`}
                    className={cn(
                      "relative rounded-md p-2 text-center cursor-pointer transition-all",
                      getCellBg(value),
                      isHovered ? "scale-110 shadow-lg z-10 ring-1 ring-primary/40" : "hover:scale-105 hover:shadow-md hover:z-10"
                    )}
                    onMouseEnter={() => setHoveredCell({ from: fromId, to: toId })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <div className="text-sm font-mono font-bold">{(value * 100).toFixed(1)}%</div>
                    {count !== null && <div className="text-[9px] opacity-60">{count}×</div>}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-xl text-[10px] whitespace-nowrap z-20 pointer-events-none">
                        <span style={{ color: regimeColorMap[fromId] ?? "#6b7280" }}>{regimeLabelMap[fromId] ?? fromId}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span style={{ color: regimeColorMap[toId] ?? "#6b7280" }}>{regimeLabelMap[toId] ?? toId}</span>
                        <div className="font-mono font-bold mt-0.5">
                          {(value * 100).toFixed(1)}%{count !== null && ` (${count} transitions)`}
                        </div>
                        {fromId === toId && <div className="text-muted-foreground mt-0.5">persistence</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Duration stats ─────────────────────────────────────────────────────────

function DurationStatsPanel({
  durations,
  regimeLabelMap,
  regimeColorMap,
}: {
  durations: Record<string, DurationEntry>;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}) {
  const entries = Object.entries(durations);
  const maxMean = Math.max(...entries.map(([, d]) => d.mean_days ?? 0), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Regime Duration Stats</h3>
          <p className="text-xs text-muted-foreground">How long each regime typically lasts</p>
        </div>
      </div>
      <div className="space-y-3">
        {entries.map(([rid, d]) => {
          const color = regimeColorMap[rid] ?? "#6b7280";
          const name = regimeLabelMap[rid] ?? d.name ?? `Regime ${rid}`;
          const barPct = (d.mean_days / maxMean) * 100;
          return (
            <div
              key={rid}
              className="group rounded-lg border p-3 hover:scale-[1.01] transition-all cursor-default"
              style={{ borderColor: `${color}30`, backgroundColor: `${color}0d` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color }}>{name}</span>
                <span className="text-xs text-muted-foreground">{d.total_runs} occurrences</span>
              </div>
              <div className="relative h-5 bg-muted/50 rounded-full mb-2 overflow-hidden">
                <div
                  className="h-5 rounded-full transition-all group-hover:brightness-110"
                  style={{ width: `${barPct}%`, minWidth: "20px", backgroundColor: color }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                  avg {d.mean_days.toFixed(1)} days
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Min: {d.min_days}d</span>
                <span>Median: {d.median_days.toFixed(0)}d</span>
                <span>Max: {d.max_days}d</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CustomPredictionsTab({
  currentRegime,
  predictions,
  regimeLabelMap,
  regimeColorMap,
  transitionMatrix,
  transitionCounts,
  durations,
  showBanner = true,
  sessionId,
  datasetName,
}: Props) {
  const currentColor = regimeColorMap[String(currentRegime)] ?? "#6b7280";
  const currentName = regimeLabelMap[String(currentRegime)] ?? `Regime ${currentRegime}`;
  const hasHmm = HORIZONS.some((h) => !!predictions[h]?.hmm);

  const pred1d = predictions["1d"];
  const confidence1d = pred1d?.confidence ?? null;

  // Count how many horizons agree on same regime
  const horizonRegimes = HORIZONS.map((h) => predictions[h]?.predicted_regime).filter((r) => r != null);
  const modeRegime = horizonRegimes.length > 0
    ? horizonRegimes.sort((a, b) =>
        horizonRegimes.filter(v => v === a).length - horizonRegimes.filter(v => v === b).length
      ).pop()
    : null;
  const allAgree = new Set(horizonRegimes).size === 1;

  return (
    <div className="space-y-5">
      {/* Summary metric cards */}
      {showBanner && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            title="Current Regime"
            value={currentName}
            sub="most recent observation"
            icon={<BarChart3 className="h-4 w-4" />}
            color={currentColor}
          />
          <MetricCard
            title="1-Day Prediction"
            value={pred1d?.predicted_regime_name ?? "—"}
            sub={pred1d ? `Markov chain` : undefined}
            icon={<Target className="h-4 w-4" />}
            color={pred1d ? (regimeColorMap[String(pred1d.predicted_regime)] ?? undefined) : undefined}
          />
          <MetricCard
            title="1-Day Confidence"
            value={confidence1d != null ? `${(confidence1d * 100).toFixed(1)}%` : "—"}
            sub="Markov prediction strength"
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            title="Horizon Agreement"
            value={allAgree ? "100%" : `${Math.round((horizonRegimes.filter(r => r === modeRegime).length / horizonRegimes.length) * 100)}%`}
            sub={allAgree ? "all horizons agree" : "horizons diverge"}
            icon={<TrendingUp className="h-4 w-4" />}
            color={allAgree ? "#10b981" : "#f59e0b"}
          />
        </div>
      )}

      {/* HMM notice */}
      {!hasHmm && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">HMM not available</span> — requires ≥252 trading days. Only Markov chain predictions shown.
        </div>
      )}

      {/* Forecast horizon cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Forecast Horizons</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {HORIZONS.map((key) => {
            const pred = predictions[key];
            if (!pred) return null;
            return (
              <HorizonCard
                key={key}
                horizonKey={key}
                pred={pred}
                currentRegime={currentRegime}
                regimeLabelMap={regimeLabelMap}
                regimeColorMap={regimeColorMap}
              />
            );
          })}
        </div>
      </div>

      {/* Forecasting engine */}
      {sessionId && (
        <CustomForecastingEngine
          sessionId={sessionId}
          datasetName={datasetName}
          regimeLabelMap={regimeLabelMap}
          regimeColorMap={regimeColorMap}
        />
      )}

      {/* Transition matrix + duration stats */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        {transitionMatrix && (
          <InteractiveTransitionMatrix
            matrix={transitionMatrix}
            counts={transitionCounts}
            regimeLabelMap={regimeLabelMap}
            regimeColorMap={regimeColorMap}
          />
        )}
        {durations && Object.keys(durations).length > 0 && (
          <DurationStatsPanel
            durations={durations}
            regimeLabelMap={regimeLabelMap}
            regimeColorMap={regimeColorMap}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Forecasts based on transition probabilities fitted to your data.
        {hasHmm
          ? " HMM provides a second opinion using latent state modeling."
          : " Upload ≥252 trading days to unlock HMM cross-validation."}
      </p>
    </div>
  );
}
