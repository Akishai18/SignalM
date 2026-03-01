import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useSectorPairDetail } from '@/hooks/useRegimeData';

const SECTORS = [
  { ticker: 'XLK', name: 'Technology' },
  { ticker: 'XLF', name: 'Financials' },
  { ticker: 'XLV', name: 'Healthcare' },
  { ticker: 'XLE', name: 'Energy' },
  { ticker: 'XLY', name: 'Consumer Disc' },
  { ticker: 'XLI', name: 'Industrials' },
  { ticker: 'XLP', name: 'Consumer Staples' },
  { ticker: 'XLU', name: 'Utilities' },
  { ticker: 'XLB', name: 'Materials' },
  { ticker: 'XLC', name: 'Communication' },
  { ticker: 'XLRE', name: 'Real Estate' },
];

export default function SectorPairDrilldown() {
  const [sector1, setSector1] = useState('XLK');
  const [sector2, setSector2] = useState('XLE');

  const { data, isLoading } = useSectorPairDetail(sector1, sector2);

  const points = data?.points ?? [];

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Sector Pair Drilldown</h3>
        <p className="text-xs text-muted-foreground">Rolling 63-day correlation between two sectors</p>
      </div>

      {/* Sector selectors */}
      <div className="flex gap-2 mb-3">
        <select
          value={sector1}
          onChange={e => setSector1(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs"
        >
          {SECTORS.map(s => (
            <option key={s.ticker} value={s.ticker} disabled={s.ticker === sector2}>
              {s.ticker} — {s.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground self-center">vs</span>
        <select
          value={sector2}
          onChange={e => setSector2(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs"
        >
          {SECTORS.map(s => (
            <option key={s.ticker} value={s.ticker} disabled={s.ticker === sector1}>
              {s.ticker} — {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Current correlation */}
      {data?.current_correlation != null && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-muted/50 border border-border">
          <span className="text-xs text-muted-foreground">Current:</span>
          <span className={`text-sm font-mono font-bold ${
            data.current_correlation > 0.5 ? 'text-cyan-500' : data.current_correlation < 0 ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {data.current_correlation.toFixed(4)}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-44">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <div className="h-44 cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
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
                domain={[-0.5, 1]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const val = payload[0].value as number;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                      <div className="font-semibold mb-1">{label}</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{data?.sector1_name} vs {data?.sector2_name}</span>
                        <span className="font-mono font-bold">{val.toFixed(4)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="correlation"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#06b6d4', fill: 'hsl(var(--card))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
          Select two different sectors
        </div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Sector Pair Drilldown"
          whatItIs="The rolling 63-day Pearson correlation between two selected sector ETFs. This shows how the relationship between two specific sectors evolves over time."
          whyItMatters="Pair correlations reveal sector-specific dynamics beyond the market average. Energy-Tech decorrelation can signal sector rotation. Sudden correlation spikes between typically uncorrelated sectors suggest systemic stress."
          howToRead="Select two sectors from the dropdowns. The line shows their rolling correlation. Values near 1 = moving together, near 0 = independent, negative = moving opposite. The reference line at 0 helps identify decorrelation."
          actionableInsight="If you hold positions in both sectors, watch for correlation spikes — your diversification benefit may vanish. Negative correlation between sectors can be exploited for hedging."
        />
      }
    />
  );
}
