import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCAComponents } from '@/hooks/useRegimeData';
import { cn } from '@/lib/utils';

const PC_CONFIGS = [
  { key: 'pc1' as const, label: 'PC1', color: '#06b6d4' },
  { key: 'pc2' as const, label: 'PC2', color: '#8b5cf6' },
  { key: 'pc3' as const, label: 'PC3', color: '#f59e0b' },
];

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b98120',
  Crisis: '#ef444420',
  'Elevated Stress': '#f59e0b20',
  Transition: '#8b5cf620',
};

const REGIME_BORDER: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

export default function PCTimeSeriesChart() {
  const { data, isLoading } = usePCAComponents();
  const [hiddenPCs, setHiddenPCs] = useState<Set<string>>(new Set());
  const [showRegimes, setShowRegimes] = useState(true);

  const points = data?.points ?? [];

  const togglePC = (key: string) => {
    setHiddenPCs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Build regime bands: contiguous runs of the same regime
  const regimeBands: { x1: string; x2: string; regime: string }[] = [];
  if (points.length > 0) {
    let start = points[0].date;
    let current = points[0].regime_name ?? 'Unknown';
    for (let i = 1; i < points.length; i++) {
      const name = points[i].regime_name ?? 'Unknown';
      if (name !== current) {
        regimeBands.push({ x1: start, x2: points[i - 1].date, regime: current });
        start = points[i].date;
        current = name;
      }
    }
    regimeBands.push({ x1: start, x2: points[points.length - 1].date, regime: current });
  }

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">PC Scores Over Time</h3>
        <p className="text-xs text-muted-foreground">
          Historical trajectory of PC1/PC2/PC3 scores — shows when and how market structure shifts.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {PC_CONFIGS.map(pc => (
          <button
            key={pc.key}
            onClick={() => togglePC(pc.key)}
            className={cn(
              'flex items-center gap-1.5 transition-opacity',
              hiddenPCs.has(pc.key) ? 'opacity-30' : 'opacity-100'
            )}
          >
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pc.color }} />
            <span className="text-xs text-muted-foreground">{pc.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowRegimes(v => !v)}
          className={cn(
            'ml-auto px-2.5 py-1 rounded text-[10px] font-medium border transition-colors',
            showRegimes
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-muted text-muted-foreground border-border'
          )}
        >
          Regimes
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <div className="h-56 cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

              {showRegimes && regimeBands.map((band, i) => (
                <ReferenceArea
                  key={i}
                  x1={band.x1}
                  x2={band.x2}
                  fill={REGIME_COLORS[band.regime] ?? '#6b728020'}
                  stroke={REGIME_BORDER[band.regime] ?? '#6b7280'}
                  strokeOpacity={0.15}
                  strokeWidth={0}
                  ifOverflow="hidden"
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
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs">
                      <div className="font-semibold mb-1">{label}</div>
                      {pt?.regime_name && (
                        <div
                          className="text-[10px] mb-1.5"
                          style={{ color: REGIME_BORDER[pt.regime_name] ?? '#6b7280' }}
                        >
                          {pt.regime_name}
                        </div>
                      )}
                      {PC_CONFIGS.filter(pc => !hiddenPCs.has(pc.key)).map(pc => (
                        <div key={pc.key} className="flex justify-between gap-4">
                          <span style={{ color: pc.color }}>{pc.label}</span>
                          <span className="font-mono font-bold">
                            {pt?.[pc.key] != null ? (pt[pc.key] as number).toFixed(2) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />

              {PC_CONFIGS.map(pc => (
                <Line
                  key={pc.key}
                  type="monotone"
                  dataKey={pc.key}
                  stroke={pc.color}
                  strokeWidth={pc.key === 'pc1' ? 1.5 : 1}
                  dot={false}
                  connectNulls
                  hide={hiddenPCs.has(pc.key)}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: pc.color, fill: 'hsl(var(--card))' }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">No data</div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="PC Scores Over Time"
          whatItIs="The time series of each day's projection onto PC1, PC2, and PC3 — the 'coordinates' of the market in factor space. Colored background bands show the active regime at each point in time."
          whyItMatters="Watching PC1 over time shows when systemic risk spiked — large positive excursions align with crashes and stress events. PC2 and PC3 capture independent sub-factors that can diverge from PC1, signaling rotation rather than pure risk-off."
          howToRead="Click PC labels to toggle individual lines. Toggle Regimes to see regime bands in the background. Spikes in PC1 = systemic stress. Divergence between PC1 and PC2 = market bifurcation (sectors moving independently)."
          actionableInsight="When PC1 breaks above its historical 90th percentile, systemic risk is elevated. If PC2 simultaneously diverges, sector rotation is occurring alongside the systemic move — a more complex environment than pure risk-on/off."
        />
      }
    />
  );
}
