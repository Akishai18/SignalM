/**
 * Regime Timeline with SPY Overlay Component
 * Shows regime changes over time with SPY price overlay
 */
import { useMergedMarketData } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getRegimeColor, getRegimeName } from "@/lib/api";
import { useState } from "react";

export function RegimeTimelineWithSPY() {
  const [timeRange, setTimeRange] = useState<number>(365); // Default: 1 year
  const { data: marketData, isLoading, isError } = useMergedMarketData(timeRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regime Timeline with SPY Overlay</CardTitle>
          <CardDescription>Market regimes and S&P 500 performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !marketData?.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regime Timeline with SPY Overlay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load market data</div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = marketData.data.map((point) => ({
    date: point.date,
    regime: point.regime ?? 0,
    spy: point.spy_close ?? null,
    vix: point.vix ?? null,
    regimeColor: getRegimeColor(point.regime ?? 0),
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const regimeName = getRegimeName(data.regime);

    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <div className="font-medium mb-2">{data.date}</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.regimeColor }}
            />
            <span className="text-muted-foreground">Regime:</span>
            <span className="font-medium">{regimeName}</span>
          </div>
          {data.spy && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">SPY:</span>
              <span className="font-medium">${data.spy.toFixed(2)}</span>
            </div>
          )}
          {data.vix && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">VIX:</span>
              <span className="font-medium">{data.vix.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="hover-border-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Regime Timeline with SPY Overlay</CardTitle>
            <CardDescription>
              Market regimes and S&P 500 performance over time
            </CardDescription>
          </div>
          {/* Time range selector */}
          <div className="flex gap-2">
            {[
              { label: "1M", days: 30 },
              { label: "3M", days: 90 },
              { label: "6M", days: 180 },
              { label: "1Y", days: 365 },
              { label: "2Y", days: 730 },
            ].map((range) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`interactive px-3 py-1 text-xs font-medium rounded-md ${
                  timeRange === range.days
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted hover:bg-primary/10 hover:border-primary/30 border border-transparent"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                }}
                minTickGap={50}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 12 }}
                label={{ value: 'Regime', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickFormatter={(value) => getRegimeName(value).slice(0, 4)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                label={{ value: 'SPY Price ($)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="regime"
                fill="currentColor"
                opacity={0.3}
                name="Regime"
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={payload.regimeColor}
                      opacity={0.3}
                    />
                  );
                }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spy"
                stroke="#00d4ff"
                strokeWidth={2}
                dot={false}
                name="SPY Price"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {[0, 1, 2, 3].map((regimeId) => (
              <div key={regimeId} className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
                <div
                  className="w-4 h-4 rounded transition-all hover:shadow-md"
                  style={{ backgroundColor: getRegimeColor(regimeId), opacity: 0.3 }}
                />
                <span className="text-muted-foreground hover:text-foreground transition-colors">{getRegimeName(regimeId)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
              <div className="w-4 h-0.5 bg-[#00d4ff]" />
              <span className="text-muted-foreground hover:text-foreground transition-colors">SPY Price</span>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t text-center">
            <div>
              <div className="text-2xl font-bold">
                {marketData.data.filter(d => d.regime === 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Calm Days</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {marketData.data.filter(d => d.regime === 1).length}
              </div>
              <div className="text-xs text-muted-foreground">Crisis Days</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                ${marketData.data[marketData.data.length - 1]?.spy_close?.toFixed(2) || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Current SPY</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
