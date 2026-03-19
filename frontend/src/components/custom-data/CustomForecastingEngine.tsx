import { useState, useCallback, useRef } from "react";
import { Zap, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import api from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "2W", days: 14 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

function formatDays(d: number): string {
  if (d === 1) return "1 day";
  if (d < 7) return `${d} days`;
  if (d === 7) return "1 week";
  if (d < 30) return `${d} days (~${(d / 7).toFixed(1)} weeks)`;
  if (d === 30) return "1 month";
  if (d < 365) return `${d} days (~${(d / 30).toFixed(1)} months)`;
  if (d === 365) return "1 year";
  return `${d} days (~${(d / 365).toFixed(1)} years)`;
}

function formatDayTick(d: number): string {
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

// ── Trajectory chart ──────────────────────────────────────────────────────────

function TrajectoryChart({
  points,
  horizon,
  regimeLabelMap,
  regimeColorMap,
}: {
  points: any[];
  horizon: number;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}) {
  const regimeNames = Object.values(regimeLabelMap);
  const colors = Object.entries(regimeColorMap);

  const chartData = points.map((p) => ({
    day: p.day,
    _predicted: p.regime_name,
    _confidence: p.confidence,
    ...p.probabilities,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 mt-6">
      <div className="mb-3">
        <h4 className="text-sm font-semibold">Regime Probability Trajectory</h4>
        <p className="text-xs text-muted-foreground">
          Predicted regime probabilities day-by-day to {formatDays(horizon)}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {colors.map(([, color], i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{regimeLabelMap[Object.keys(regimeColorMap)[i]]}</span>
          </div>
        ))}
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayTick}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 1]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const pt = points.find((p) => p.day === label);
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                    <div className="font-semibold mb-1">Day {label} ({formatDayTick(label as number)})</div>
                    {pt && (
                      <div className="mb-1.5 text-[10px] text-muted-foreground">
                        Predicted:{" "}
                        <span className="font-medium" style={{ color: pt.color }}>
                          {pt.regime_name}
                        </span>{" "}
                        ({(pt.confidence * 100).toFixed(1)}%)
                      </div>
                    )}
                    <div className="space-y-1">
                      {payload.map((entry) => (
                        <div key={entry.dataKey as string} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.dataKey}</span>
                          </div>
                          <span className="font-mono">{((entry.value as number) * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            {colors.map(([, color], i) => {
              const name = regimeLabelMap[Object.keys(regimeColorMap)[i]];
              return (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  fill={color}
                  stroke={color}
                  fillOpacity={0.75}
                  strokeWidth={0}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  datasetName?: string;
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}

export function CustomForecastingEngine({
  sessionId,
  datasetName,
  regimeLabelMap,
  regimeColorMap,
}: Props) {
  const [days, setDays] = useState(14);
  const [showTrajectory, setShowTrajectory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [trajectory, setTrajectory] = useState<any>(null);
  const [queriedDays, setQueriedDays] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setResult(null);
    setTrajectory(null);
    setQueriedDays(days);

    try {
      const [pred, traj] = await Promise.all([
        api.customData.predictHorizon(sessionId, days),
        showTrajectory ? api.customData.predictTrajectory(sessionId, days) : Promise.resolve(null),
      ]);
      setResult(pred);
      if (traj) setTrajectory(traj);
    } catch {
      // silently ignore aborted requests
    } finally {
      setLoading(false);
    }
  }, [sessionId, days, showTrajectory]);

  const showResults = result && queriedDays === days && !loading;
  const markov = result?.markov;
  const hmm = result?.hmm;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6 space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-3 text-primary">
          <Zap className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Regime Forecasting Engine</h2>
          <p className="text-sm text-muted-foreground">
            Select a timeframe and generate Markov predictions for{" "}
            <span className="text-foreground font-medium">{datasetName ?? "your dataset"}</span>
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Controls */}
        <div className="space-y-5">
          {/* Quick-select presets */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Quick Select
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, days: pd }) => (
                <button
                  key={pd}
                  onClick={() => setDays(pd)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    days === pd
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Forecast Horizon
              </span>
              <span className="text-lg font-bold font-mono text-primary">
                {formatDays(days)}
              </span>
            </div>
            <Slider
              value={[days]}
              onValueChange={([v]) => setDays(v)}
              min={1}
              max={365}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 day</span>
              <span>1 year</span>
            </div>
          </div>

          {/* Trajectory toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setShowTrajectory((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                showTrajectory ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  showTrajectory ? "translate-x-4" : ""
                }`}
              />
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Show regime trajectory chart
            </span>
          </label>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-base transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                Generate Prediction
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Results */}
        <div className="min-h-[200px] flex flex-col">
          {/* Empty state */}
          {!loading && !showResults && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <div className="text-center px-6 py-8">
                <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a horizon and click Generate</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Results will appear here</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]">
              <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Running Markov chain…</p>
              </div>
            </div>
          )}

          {/* Results */}
          {showResults && markov && (
            <div className="space-y-4">
              {/* Primary result card */}
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor: `${regimeColorMap[String(markov.predicted_regime)] ?? "#6b7280"}40`,
                  backgroundColor: `${regimeColorMap[String(markov.predicted_regime)] ?? "#6b7280"}10`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {formatDays(queriedDays!)} Forecast
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: regimeColorMap[String(markov.predicted_regime)] ?? "#6b7280" }}
                    >
                      {markov.predicted_regime_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                    <div className="text-xl font-bold font-mono">
                      {(markov.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${markov.confidence * 100}%`,
                      backgroundColor: regimeColorMap[String(markov.predicted_regime)] ?? "#6b7280",
                    }}
                  />
                </div>
              </div>

              {/* Probability bars */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <div className="text-sm font-medium mb-2">Regime Probabilities</div>
                {Object.entries(markov.probabilities)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([rid, prob]) => {
                    const name = regimeLabelMap[rid] ?? `Regime ${rid}`;
                    const color = regimeColorMap[rid] ?? "#6b7280";
                    return (
                      <div key={rid} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-32 shrink-0">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs" style={{ color }}>{name}</span>
                        </div>
                        <div className="flex-1 bg-muted/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-2.5 rounded-full transition-all"
                            style={{ width: `${(prob as number) * 100}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-xs font-mono w-10 text-right">
                          {((prob as number) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* HMM comparison (if available) */}
              {hmm && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="text-sm font-medium mb-2">Model Comparison</div>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Markov Chain", data: markov, note: `exact ${queriedDays}d` },
                      { label: "HMM", data: hmm, note: result.hmm_note },
                    ].map(({ label, data, note }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{label}</span>
                          {note && (
                            <span className="text-[10px] text-muted-foreground ml-2">({note})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: regimeColorMap[String(data.predicted_regime)] ?? "#6b7280" }}
                          />
                          <span
                            className="font-medium"
                            style={{ color: regimeColorMap[String(data.predicted_regime)] ?? "#6b7280" }}
                          >
                            {data.predicted_regime_name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {(data.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {markov.predicted_regime === hmm.predicted_regime ? (
                    <p className="text-xs text-green-400 mt-2">✓ Models agree</p>
                  ) : (
                    <p className="text-xs text-amber-400 mt-2">⚠ Models disagree — treat with caution</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trajectory chart — full width below */}
      {showResults && showTrajectory && trajectory?.points && (
        <TrajectoryChart
          points={trajectory.points}
          horizon={queriedDays!}
          regimeLabelMap={trajectory.regime_label_map ?? regimeLabelMap}
          regimeColorMap={trajectory.regime_color_map ?? regimeColorMap}
        />
      )}
    </div>
  );
}
