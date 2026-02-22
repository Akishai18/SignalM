import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

// Sample data
const data = [
  { date: "Jan", sp500: 4200, volatility: 18, correlation: 0.45 },
  { date: "Feb", sp500: 4350, volatility: 22, correlation: 0.52 },
  { date: "Mar", sp500: 4180, volatility: 28, correlation: 0.68 },
  { date: "Apr", sp500: 4420, volatility: 19, correlation: 0.48 },
  { date: "May", sp500: 4280, volatility: 24, correlation: 0.55 },
  { date: "Jun", sp500: 4520, volatility: 16, correlation: 0.42 },
  { date: "Jul", sp500: 4680, volatility: 14, correlation: 0.38 },
  { date: "Aug", sp500: 4550, volatility: 21, correlation: 0.51 },
  { date: "Sep", sp500: 4320, volatility: 32, correlation: 0.72 },
  { date: "Oct", sp500: 4150, volatility: 35, correlation: 0.78 },
  { date: "Nov", sp500: 4480, volatility: 25, correlation: 0.58 },
  { date: "Dec", sp500: 4720, volatility: 17, correlation: 0.44 },
];

export function TimeSeriesChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">S&P 500 Price & Volatility</h3>
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
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
              tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
            />
            <YAxis
              yAxisId="volatility"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
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
            />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="sp500"
              stroke="hsl(175, 100%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
              name="S&P 500"
            />
            <Area
              yAxisId="volatility"
              type="monotone"
              dataKey="volatility"
              stroke="hsl(320, 100%, 60%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVolatility)"
              name="Volatility"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
