import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { EquityCurvePoint } from "@/lib/api";

interface Props {
  equityCurve: EquityCurvePoint[];
  rebalanceDates: string[];
}

function formatDollar(v: number): string {
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear().toString().slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EquityCurveChart({ equityCurve, rebalanceDates }: Props) {
  if (equityCurve.length === 0) return null;

  // Recharts reads data directly — no transformation needed since the API
  // already returns {date, value, benchmark} per point.
  const rebalanceSet = new Set(rebalanceDates);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Equity Curve</h3>
        <p className="text-xs text-muted-foreground">Portfolio value vs SPY buy-and-hold · vertical lines = regime change</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Strategy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
          <span className="text-xs text-muted-foreground">SPY B&H</span>
        </div>
        {rebalanceDates.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-[1px] bg-muted-foreground/50 border-l border-dashed border-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">Rebalance</span>
          </div>
        )}
      </div>

      <div className="h-64 cursor-crosshair">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={equityCurve} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatDollar}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            <Tooltip
              cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const portfolio = payload.find((p) => p.dataKey === "value");
                const benchmark = payload.find((p) => p.dataKey === "benchmark");
                const isRebalance = rebalanceSet.has(label as string);
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs min-w-[160px]">
                    <div className="font-semibold mb-1.5 flex items-center gap-1.5">
                      {label}
                      {isRebalance && (
                        <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary font-mono">
                          REBALANCE
                        </span>
                      )}
                    </div>
                    {portfolio && (
                      <div className="flex justify-between gap-4">
                        <span style={{ color: "hsl(var(--primary))" }}>Strategy</span>
                        <span className="font-mono">{formatDollar(portfolio.value as number)}</span>
                      </div>
                    )}
                    {benchmark && (
                      <div className="flex justify-between gap-4">
                        <span className="text-orange-400">SPY B&H</span>
                        <span className="font-mono">{formatDollar(benchmark.value as number)}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Rebalance markers */}
            {rebalanceDates.map((d) => (
              <ReferenceLine
                key={d}
                x={d}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            ))}

            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--primary))", fill: "hsl(var(--card))" }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#fb923c"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: "#fb923c", fill: "hsl(var(--card))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
