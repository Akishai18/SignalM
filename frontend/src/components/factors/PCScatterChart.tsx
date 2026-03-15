import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCAScatter } from '@/hooks/useRegimeData';
import { cn } from '@/lib/utils';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

type PCKey = 'pc1' | 'pc2' | 'pc3';
const AXIS_OPTIONS: { x: PCKey; y: PCKey; label: string }[] = [
  { x: 'pc1', y: 'pc2', label: 'PC1 vs PC2' },
  { x: 'pc1', y: 'pc3', label: 'PC1 vs PC3' },
  { x: 'pc2', y: 'pc3', label: 'PC2 vs PC3' },
];

const PC_COLORS: Record<PCKey, string> = {
  pc1: '#06b6d4',
  pc2: '#8b5cf6',
  pc3: '#f59e0b',
};

export default function PCScatterChart() {
  const { data, isLoading } = usePCAScatter();
  const [axisIdx, setAxisIdx] = useState(0);
  const [hiddenRegimes, setHiddenRegimes] = useState<Set<string>>(new Set());

  const points = data?.points ?? [];
  const ve = data?.variance_explained ?? {};

  const { x: xKey, y: yKey } = AXIS_OPTIONS[axisIdx];

  const toggleRegime = (name: string) => {
    setHiddenRegimes(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const byRegime = REGIME_ORDER.map(name => ({
    name,
    color: REGIME_COLORS[name] ?? '#6b7280',
    hidden: hiddenRegimes.has(name),
    data: points
      .filter(p => p.regime_name === name && p[xKey] != null && p[yKey] != null)
      .map(p => ({ ...p, _x: p[xKey] as number, _y: p[yKey] as number })),
  })).filter(r => r.data.length > 0);

  const xLabel = `${xKey.toUpperCase()} (${ve[xKey.toUpperCase()] != null ? (ve[xKey.toUpperCase()] * 100).toFixed(0) : '?'}% var)`;
  const yLabel = `${yKey.toUpperCase()} (${ve[yKey.toUpperCase()] != null ? (ve[yKey.toUpperCase()] * 100).toFixed(0) : '?'}% var)`;

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">PCA Scatter — Regime Separation</h3>
        <p className="text-xs text-muted-foreground">
          Each point is one trading day. Regimes cluster in distinct regions of PC space.
        </p>
      </div>

      {/* Axis picker */}
      <div className="flex gap-1.5 mb-3">
        {AXIS_OPTIONS.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => setAxisIdx(i)}
            className={cn(
              'px-2.5 py-1 rounded text-[10px] font-medium border transition-colors',
              axisIdx === i
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <>
          {/* Regime toggles */}
          <div className="flex gap-3 mb-3 flex-wrap">
            {byRegime.map(r => (
              <button
                key={r.name}
                onClick={() => toggleRegime(r.name)}
                className={cn(
                  'flex items-center gap-1.5 transition-opacity',
                  r.hidden ? 'opacity-30' : 'opacity-100'
                )}
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="text-[10px] text-muted-foreground">{r.name}</span>
              </button>
            ))}
          </div>

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <ReferenceLine x={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="_x"
                  type="number"
                  name={xKey.toUpperCase()}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 9, fill: PC_COLORS[xKey] }}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  dataKey="_y"
                  type="number"
                  name={yKey.toUpperCase()}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 9, fill: PC_COLORS[yKey] }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs">
                        <div className="font-semibold mb-1" style={{ color: REGIME_COLORS[pt.regime_name] }}>
                          {pt.regime_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground mb-1">{pt.date}</div>
                        <div className="flex justify-between gap-3">
                          <span style={{ color: PC_COLORS[xKey] }}>{xKey.toUpperCase()}</span>
                          <span className="font-mono">{(pt._x as number).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span style={{ color: PC_COLORS[yKey] }}>{yKey.toUpperCase()}</span>
                          <span className="font-mono">{(pt._y as number).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {byRegime.filter(r => !r.hidden).map(r => (
                  <Scatter
                    key={r.name}
                    name={r.name}
                    data={r.data}
                    fill={r.color}
                    fillOpacity={0.5}
                    r={2}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
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
          title="PC1 vs PC2 Regime Scatter"
          whatItIs="A 2D scatter plot of every trading day projected onto two principal components of market structure. Each dot represents one day, colored by its detected market regime."
          whyItMatters="If the 4 regimes truly represent distinct market states, they should form separate clusters in PC space. This chart validates that — Crisis days should occupy a different region than Calm days."
          howToRead="Use the axis buttons to switch between PC pairs. Click regime labels to toggle visibility. Look for color clusters — tight clusters mean the regime is well-defined. Overlap regions represent days when regimes were ambiguous."
          actionableInsight="Days near the boundary between regime clusters are transition points — the highest-uncertainty regime predictions. The more spread a regime's cluster, the more variable its characteristics."
        />
      }
    />
  );
}
