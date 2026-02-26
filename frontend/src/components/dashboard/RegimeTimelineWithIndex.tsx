/**
 * Regime Timeline with Index Overlay Component
 * Shows regime changes over time with any index price overlay
 */
import { useIndexMergedData } from "@/hooks/useRegimeData";
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
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

interface RegimeTimelineProps {
  symbol: string;
}

export function RegimeTimelineWithIndex({ symbol }: RegimeTimelineProps) {
  const [timeRange, setTimeRange] = useState<number>(365); // Default: 1 year
  const { data: marketData, isLoading, isError } = useIndexMergedData(symbol, timeRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regime Timeline with {symbol} Overlay</CardTitle>
          <CardDescription>Market regimes and {symbol} performance over time</CardDescription>
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
          <CardTitle>Regime Timeline with {symbol} Overlay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load market data</div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data - use dynamic keys based on symbol
  const symbolLower = symbol.toLowerCase();
  const chartData = marketData.data.map((point: any) => ({
    date: point.date,
    regime: point.regime ?? 0,
    price: point[`${symbolLower}_close`] ?? null,
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
          {data.price && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{symbol}:</span>
              <span className="font-medium">${data.price.toFixed(2)}</span>
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

  const frontContent = (
    <Card className="hover-border-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Regime Timeline with {symbol} Overlay</CardTitle>
            <CardDescription>
              Market regimes and {symbol} performance over time
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
                label={{ value: `${symbol} Price ($)`, angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
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
                dataKey="price"
                stroke="#00d4ff"
                strokeWidth={2}
                dot={false}
                name={`${symbol} Price`}
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
              <span className="text-muted-foreground hover:text-foreground transition-colors">{symbol} Price</span>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t text-center">
            <div>
              <div className="text-2xl font-bold">
                {marketData.data.filter((d: any) => d.regime === 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Calm Days</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {marketData.data.filter((d: any) => d.regime === 1).length}
              </div>
              <div className="text-xs text-muted-foreground">Crisis Days</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                ${marketData.data[marketData.data.length - 1]?.[`${symbolLower}_close`]?.toFixed(2) || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Current {symbol}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <EducationCard
      title="Regime Timeline Chart"
      whatItIs="This chart shows the historical evolution of market regimes (colored bars) overlaid with the index price (cyan line). The background colors represent which regime the market was in on each day. You can adjust the time range to see different periods."
      whyItMatters="Seeing regimes and prices together reveals key patterns: prices often peak before crisis regimes start, crashes happen during crisis periods, and recoveries occur as markets transition back to calm. This helps you understand how regime shifts affect asset prices in real-time."
      howToRead={`• Background bars: Market regime (Green=Calm, Red=Crisis, Yellow=Transition, Blue=Elevated Stress)
• Cyan line: ${symbol} price movement
• Hover over the chart to see exact regime, price, and VIX on any date
• Use time range buttons to zoom in/out

Look for regime changes that coincide with major price moves - these are critical inflection points where portfolio behavior changes dramatically.`}
      actionableInsight="Notice how crisis regimes (red bars) are often preceded by transition periods (yellow). If you see sustained yellow bars appearing, it may signal an upcoming volatility spike - a good time to reduce leverage or add hedges before the crisis hits."
      variant="warning"
    />
  );

  return <FlipCard front={frontContent} back={backContent} />;
}
