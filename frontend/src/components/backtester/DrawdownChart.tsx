import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EquityCurvePoint } from "@/lib/api";

interface DrawdownPoint {
  date: string;
  drawdown: number; // always <= 0, expressed as a percentage (e.g. -34.9)
}

interface Props {
  equityCurve: EquityCurvePoint[];
}

/**
 * Compute drawdown at each date by tracking the running peak of portfolio value.
 * runningPeak is updated monotonically as we iterate forward in time.
 * drawdown[i] = (value[i] / runningPeak[i] - 1) * 100  ≤ 0
 */
function computeDrawdown(equityCurve: EquityCurvePoint[]): DrawdownPoint[] {
  let runningPeak = -Infinity;
  return equityCurve.map((point) => {
    runningPeak = Math.max(runningPeak, point.value);
    const drawdown = (point.value / runningPeak - 1) * 100;
    return { date: point.date, drawdown };
  });
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear().toString().slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DrawdownChart({ equityCurve }: Props) {
  if (equityCurve.length === 0) return null;

  const data = computeDrawdown(equityCurve);

  // Y domain: floor at min drawdown with 10% padding so the trough isn't clipped
  const minDD = Math.min(...data.map((d) => d.drawdown));
  const yMin = Math.floor(minDD * 1.1);  // e.g. -34.9 → floor(-38.4) = -39
  const yMax = 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Drawdown from Peak</h3>
        <p className="text-xs text-muted-foreground">
          % decline from the running portfolio high · max: {minDD.toFixed(2)}%
        </p>
      </div>

      <div className="h-48 cursor-crosshair">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>

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
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />

            <Tooltip
              cursor={{ stroke: "#ef4444", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const dd = payload[0]?.value as number;
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                    <div className="font-semibold mb-1">{label}</div>
                    <div className="flex justify-between gap-4">
                      <span className="text-red-400">Drawdown</span>
                      <span className="font-mono text-red-400">{dd.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#drawdownGradient)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: "#ef4444", fill: "hsl(var(--card))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
