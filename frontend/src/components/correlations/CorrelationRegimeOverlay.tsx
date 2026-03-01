import { Loader2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceArea } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useRegimeCorrelation } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

export default function CorrelationRegimeOverlay() {
  const { data, isLoading } = useRegimeCorrelation();

  const points = data?.points ?? [];

  // Build regime bands for background coloring
  const bands: { x1: string; x2: string; color: string }[] = [];
  if (points.length > 0) {
    let bandStart = points[0].date;
    let currentRegime = points[0].regime_name;
    for (let i = 1; i < points.length; i++) {
      if (points[i].regime_name !== currentRegime) {
        bands.push({
          x1: bandStart,
          x2: points[i - 1].date,
          color: REGIME_COLORS[currentRegime] ?? '#6b7280',
        });
        bandStart = points[i].date;
        currentRegime = points[i].regime_name;
      }
    }
    bands.push({
      x1: bandStart,
      x2: points[points.length - 1].date,
      color: REGIME_COLORS[currentRegime] ?? '#6b7280',
    });
  }

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Correlation x Regime Overlay</h3>
        <p className="text-xs text-muted-foreground">Average correlation with regime-colored background</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <>
          {/* Legend */}
          <div className="flex gap-3 mb-3 flex-wrap">
            {Object.entries(REGIME_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.4 }} />
                <span className="text-[10px] text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

                {/* Regime background bands */}
                {bands.map((band, i) => (
                  <ReferenceArea
                    key={i}
                    x1={band.x1}
                    x2={band.x2}
                    fill={band.color}
                    fillOpacity={0.08}
                  />
                ))}

                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return `${date.getFullYear().toString().slice(2)}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                  }}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => v.toFixed(2)}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                        <div className="font-semibold mb-1">{label}</div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Avg Correlation</span>
                          <span className="font-mono font-bold">{pt.avg_correlation.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between gap-4 mt-0.5">
                          <span className="text-muted-foreground">Regime</span>
                          <span className="font-medium" style={{ color: REGIME_COLORS[pt.regime_name] }}>
                            {pt.regime_name}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_correlation"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--primary))', fill: 'hsl(var(--card))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Correlation x Regime Overlay"
          whatItIs="A time series of 63-day average pairwise sector correlation with colored background bands showing the detected market regime at each point in time."
          whyItMatters="This visualization reveals the relationship between correlation and market regimes. Crisis regimes almost always coincide with correlation spikes, while Calm regimes show lower, stable correlation."
          howToRead="The line shows average cross-sector correlation. Background colors show regimes: green = Calm, red = Crisis, orange = Elevated Stress, purple = Transition. Notice how the line rises during red/orange periods."
          actionableInsight="If correlation is rising but the regime is still Calm, it may be a leading indicator of a regime change. This gives you advance warning to adjust positions."
        />
      }
    />
  );
}
