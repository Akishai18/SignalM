/**
 * Index Time Series Chart
 * Shows price and volatility for any index
 */
import { useIndexMergedData } from "@/hooks/useRegimeData";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface IndexTimeSeriesChartProps {
  symbol: string;
}

export function IndexTimeSeriesChart({ symbol }: IndexTimeSeriesChartProps) {
  const { data: marketData, isLoading, isError } = useIndexMergedData(symbol, 365);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-center h-72">
          <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (isError || !marketData?.data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-center h-72">
          <div className="text-sm text-destructive">Failed to load data</div>
        </div>
      </div>
    );
  }

  // Prepare chart data - sample every 7 days to reduce clutter
  const symbolLower = symbol.toLowerCase();
  const allData = marketData.data
    .filter((_: any, index: number) => index % 7 === 0) // Sample every 7 days
    .map((point: any) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short' }),
      price: point[`${symbolLower}_close`] || 0,
      volatility: (point[`${symbolLower}_vol`] || 0) * 100, // Convert to percentage
    }));

  // Get last 52 points (approximately 1 year of weekly data)
  const chartData = allData.slice(-52);

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover-border-glow group">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
            {symbol} Price & Volatility
          </h3>
          <p className="text-sm text-muted-foreground">12-month historical overview</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded bg-neon-cyan" />
            <span className="text-muted-foreground">Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded bg-neon-magenta/50" />
            <span className="text-muted-foreground">Volatility</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(175, 100%, 50%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(175, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVolatility" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(320, 100%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(320, 100%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="price"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <YAxis
              yAxisId="volatility"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                boxShadow: "0 10px 40px -10px hsl(var(--primary) / 0.2)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: any, name: string) => {
                if (name === 'price') return [`$${value.toFixed(2)}`, `${symbol} Price`];
                if (name === 'volatility') return [`${value.toFixed(1)}%`, 'Volatility'];
                return [value, name];
              }}
            />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="hsl(175, 100%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
              name="price"
            />
            <Area
              yAxisId="volatility"
              type="monotone"
              dataKey="volatility"
              stroke="hsl(320, 100%, 60%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVolatility)"
              name="volatility"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
