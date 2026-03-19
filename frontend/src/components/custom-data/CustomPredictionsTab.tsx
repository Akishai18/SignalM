import { useState } from "react";
import { Calendar, TrendingUp, Zap, Clock } from "lucide-react";
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

// ── Sub-components ────────────────────────────────────────────────────────

function CurrentRegimeBanner({
  regimeId,
  regimeName,
  color,
}: {
  regimeId: number;
  regimeName: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}20` }}>
          <Calendar className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Current Regime</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xl font-bold">{regimeName}</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Regime ID</p>
          <p className="text-xl font-mono font-semibold" style={{ color }}>
            #{regimeId}
          </p>
        </div>
      </div>
    </div>
  );
}

function HorizonCard({
  horizonKey,
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
  const hmmAgrees =
    hasHmm && pred.hmm!.predicted_regime === pred.predicted_regime;
  const willTransition = pred.predicted_regime !== currentRegime;
  const markovColor = regimeColorMap[String(pred.predicted_regime)] ?? "#6b7280";

  // Sort probabilities descending
  const sortedProbs = Object.entries(pred.probabilities).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{pred.horizon_days}-Day Ahead</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {(pred.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Markov prediction */}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
            Markov Chain
          </p>
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: markovColor }}
            />
            <span className="font-semibold text-sm">{pred.predicted_regime_name}</span>
          </div>
        </div>

        {/* HMM prediction (if available) */}
        {hasHmm && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              HMM
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      regimeColorMap[String(pred.hmm!.predicted_regime)] ?? "#6b7280",
                  }}
                />
                <span className="font-semibold text-sm">
                  {pred.hmm!.predicted_regime_name}
                </span>
              </div>
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium",
                  hmmAgrees
                    ? "bg-green-500/15 text-green-400"
                    : "bg-amber-500/15 text-amber-400"
                )}
              >
                {hmmAgrees ? "✓ agrees" : "⚠ differs"}
              </span>
            </div>
          </div>
        )}

        {/* Probability distribution */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Regime Probabilities
          </p>
          {sortedProbs.map(([rid, prob]) => {
            const color = regimeColorMap[rid] ?? "#6b7280";
            const name = regimeLabelMap[rid] ?? `Regime ${rid}`;
            return (
              <div key={rid} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{name}</span>
                  </div>
                  <span className="font-mono font-medium">{(prob * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${prob * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Transition warning */}
        {willTransition && (
          <div className="flex items-center gap-2 text-xs text-amber-400 border-t border-border pt-3">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">Regime transition expected</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelComparisonTable({
  predictions,
  regimeLabelMap,
  regimeColorMap,
}: {
  predictions: Record<string, HorizonData>;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}) {
  const hasHmm = HORIZONS.some((h) => !!predictions[h]?.hmm);
  if (!hasHmm) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/10">
        <h3 className="text-sm font-semibold">Model Comparison</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Markov chain vs Hidden Markov Model across horizons
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20">
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-4 py-2.5 font-medium">Horizon</th>
              <th className="px-4 py-2.5 font-medium">Markov Prediction</th>
              <th className="px-4 py-2.5 font-medium">Markov Confidence</th>
              <th className="px-4 py-2.5 font-medium">HMM Prediction</th>
              <th className="px-4 py-2.5 font-medium">HMM Confidence</th>
              <th className="px-4 py-2.5 font-medium">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {HORIZONS.map((h) => {
              const pred = predictions[h];
              if (!pred) return null;
              const hmm = pred.hmm;
              const markovColor = regimeColorMap[String(pred.predicted_regime)] ?? "#6b7280";
              const hmmColor = hmm
                ? (regimeColorMap[String(hmm.predicted_regime)] ?? "#6b7280")
                : null;
              const agrees = hmm && hmm.predicted_regime === pred.predicted_regime;

              return (
                <tr
                  key={h}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold">
                    {pred.horizon_days}d
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: markovColor }} />
                      {pred.predicted_regime_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {(pred.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    {hmm ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: hmmColor! }} />
                        {hmm.predicted_regime_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {hmm ? `${(hmm.confidence * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {hmm ? (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full font-medium text-[10px]",
                          agrees
                            ? "bg-green-500/15 text-green-400"
                            : "bg-amber-500/15 text-amber-400"
                        )}
                      >
                        {agrees ? "✓ Agree" : "⚠ Differ"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hasHmm && (
        <p className="px-4 py-3 text-xs text-muted-foreground italic">
          HMM requires ≥252 trading days of data.
        </p>
      )}
    </div>
  );
}

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
          style={{
            gridTemplateColumns: `120px repeat(${regimeIds.length}, 1fr)`,
          }}
        >
          {/* Column headers */}
          <div className="text-[10px] text-muted-foreground font-medium p-1">
            From ↓ &nbsp; To →
          </div>
          {regimeIds.map((colId) => (
            <div
              key={colId}
              className={cn(
                "text-[10px] font-medium p-1 text-center transition-all",
                hoveredCell?.to === colId ? "scale-105" : ""
              )}
              style={{ color: regimeColorMap[colId] ?? "#6b7280" }}
            >
              {regimeLabelMap[colId] ?? `R${colId}`}
            </div>
          ))}

          {/* Data rows */}
          {regimeIds.map((fromId) => (
            <>
              <div
                key={`label-${fromId}`}
                className={cn(
                  "text-[10px] font-medium p-1 flex items-center gap-1.5 transition-all",
                  hoveredCell?.from === fromId ? "scale-105" : ""
                )}
                style={{ color: regimeColorMap[fromId] ?? "#6b7280" }}
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: regimeColorMap[fromId] ?? "#6b7280" }}
                />
                {regimeLabelMap[fromId] ?? `R${fromId}`}
              </div>

              {regimeIds.map((toId) => {
                const value = matrix[fromId]?.[toId] ?? 0;
                const count = counts?.[fromId]?.[toId] ?? null;
                const isHovered =
                  hoveredCell?.from === fromId && hoveredCell?.to === toId;

                return (
                  <div
                    key={`${fromId}-${toId}`}
                    className={cn(
                      "relative rounded-md p-2 text-center cursor-pointer transition-all",
                      getCellBg(value),
                      isHovered
                        ? "scale-110 shadow-lg z-10 ring-1 ring-primary/40"
                        : "hover:scale-105 hover:shadow-md hover:z-10"
                    )}
                    onMouseEnter={() => setHoveredCell({ from: fromId, to: toId })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <div className="text-sm font-mono font-bold">
                      {(value * 100).toFixed(1)}%
                    </div>
                    {count !== null && (
                      <div className="text-[9px] opacity-60">{count}×</div>
                    )}

                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-xl text-[10px] whitespace-nowrap z-20 pointer-events-none">
                        <span style={{ color: regimeColorMap[fromId] ?? "#6b7280" }}>
                          {regimeLabelMap[fromId] ?? fromId}
                        </span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span style={{ color: regimeColorMap[toId] ?? "#6b7280" }}>
                          {regimeLabelMap[toId] ?? toId}
                        </span>
                        <div className="font-mono font-bold mt-0.5">
                          {(value * 100).toFixed(1)}%
                          {count !== null && ` (${count} transitions)`}
                        </div>
                        {fromId === toId && (
                          <div className="text-muted-foreground mt-0.5">
                            persistence (stays in regime)
                          </div>
                        )}
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
          <p className="text-xs text-muted-foreground">
            How long each regime typically lasts in your data
          </p>
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
              style={{
                borderColor: `${color}30`,
                backgroundColor: `${color}0d`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color }}>
                  {name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.total_runs} occurrences
                </span>
              </div>

              <div className="relative h-5 bg-muted/50 rounded-full mb-2 overflow-hidden">
                <div
                  className="h-5 rounded-full transition-all group-hover:brightness-110"
                  style={{
                    width: `${barPct}%`,
                    minWidth: "20px",
                    backgroundColor: color,
                  }}
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

  return (
    <div className="space-y-6">
      {/* Current regime banner */}
      {showBanner && (
        <CurrentRegimeBanner
          regimeId={currentRegime}
          regimeName={currentName}
          color={currentColor}
        />
      )}

      {/* HMM availability notice */}
      {!hasHmm && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">HMM not available</span> — requires ≥252
          trading days. Only Markov chain predictions shown.
        </div>
      )}

      {/* Forecast horizon cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Regime Forecast</h3>
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

      {/* Interactive forecasting engine */}
      {sessionId && (
        <CustomForecastingEngine
          sessionId={sessionId}
          datasetName={datasetName}
          regimeLabelMap={regimeLabelMap}
          regimeColorMap={regimeColorMap}
        />
      )}

      {/* Model comparison table (only shown when HMM exists) */}
      <ModelComparisonTable
        predictions={predictions}
        regimeLabelMap={regimeLabelMap}
        regimeColorMap={regimeColorMap}
      />

      {/* Transition matrix + duration stats side by side */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
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
