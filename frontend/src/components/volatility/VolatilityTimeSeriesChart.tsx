import { useState } from 'react';
import { Loader2, Milestone } from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useMergedMarketData } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<number, string> = {
  0: '#10b981',
  1: '#ef4444',
  2: '#f59e0b',
  3: '#8b5cf6',
};

const REGIME_NAMES: Record<number, string> = {
  0: 'Calm',
  1: 'Crisis',
  2: 'Elevated Stress',
  3: 'Transition',
};

const MARKET_EVENTS = [
  { date: '2018-12-24', label: "Dec'18 Selloff" },
  { date: '2020-03-23', label: 'COVID Crash' },
  { date: '2022-06-16', label: '2022 Bear' },
  { date: '2023-03-10', label: 'SVB Collapse' },
];

// Custom rotated label for event reference lines
const EventLabel = ({ viewBox, label }: { viewBox?: { x: number; y: number; height: number }; label: string }) => {
  if (!viewBox) return null;
  const { x, y, height } = viewBox;
  return (
    <g>
      <text
        x={x + 4}
        y={y + height - 4}
        fill="#9ca3af"
        fontSize={8}
        fontFamily="monospace"
        transform={`rotate(-90, ${x + 4}, ${y + height - 4})`}
        textAnchor="start"
      >
        {label}
      </text>
    </g>
  );
};

interface Props {
  volWindow: number;
  volSeries: (number | null)[];
}

export default function VolatilityTimeSeriesChart({ volWindow, volSeries }: Props) {
  const [showEvents, setShowEvents] = useState(false);
  const { data, isLoading } = useMergedMarketData(1500);

  const rawPoints = data?.data ?? [];

  const chartData = rawPoints.map((p, i) => ({
    date: p.date,
    vol: volSeries[i] != null ? +volSeries[i]!.toFixed(2) : null,
    vix: p.vix ?? null,
    regime: p.regime ?? null,
  })).filter(p => p.vol != null || p.vix != null);

  // Build regime background bands
  type Band = { x1: string; x2: string; regime: number };
  const bands: Band[] = [];
  if (chartData.length > 0) {
    let start = chartData[0].date;
    let cur = chartData[0].regime;
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].regime !== cur) {
        if (cur != null) bands.push({ x1: start, x2: chartData[i - 1].date, regime: cur });
        start = chartData[i].date;
        cur = chartData[i].regime;
      }
    }
    if (cur != null) bands.push({ x1: start, x2: chartData[chartData.length - 1].date, regime: cur });
  }

  // Only show events that fall within the data range
  const dateSet = new Set(chartData.map(p => p.date));
  const visibleEvents = MARKET_EVENTS.filter(e => {
    if (chartData.length === 0) return false;
    return e.date >= chartData[0].date && e.date <= chartData[chartData.length - 1].date;
  });

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Realized Volatility ({volWindow}d) & VIX Over Time
          </h3>
          <p className="text-xs text-muted-foreground">
            {volWindow}-day realized vol vs VIX, shaded by market regime
          </p>
        </div>
        <button
          onClick={() => setShowEvents(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            showEvents
              ? 'bg-primary/15 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <Milestone className="h-3.5 w-3.5" />
          Events
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-72">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              <span className="text-xs text-muted-foreground">Realized Vol ({volWindow}d, %)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-xs text-muted-foreground">VIX</span>
            </div>
            <div className="w-px h-4 bg-border self-center" />
            {Object.entries(REGIME_NAMES).map(([id, name]) => (
              <div key={id} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: REGIME_COLORS[+id], opacity: 0.5 }}
                />
                <span className="text-[10px] text-muted-foreground">{name}</span>
              </div>
            ))}
            {showEvents && (
              <>
                <div className="w-px h-4 bg-border self-center" />
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-px bg-slate-500 border-dashed" />
                  <span className="text-[10px] text-muted-foreground">Market events</span>
                </div>
              </>
            )}
          </div>

          <div className="h-72 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 45, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

                {bands.map((band, i) => (
                  <ReferenceArea
                    key={i}
                    x1={band.x1}
                    x2={band.x2}
                    fill={REGIME_COLORS[band.regime]}
                    fillOpacity={0.08}
                    yAxisId="left"
                  />
                ))}

                {showEvents && visibleEvents.map(event => (
                  <ReferenceLine
                    key={event.date}
                    x={event.date}
                    stroke="#6b7280"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    yAxisId="left"
                    label={(props: any) => <EventLabel {...props} label={event.label} />}
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
                  yAxisId="left"
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: '#06b6d4' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#f97316' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    const nearEvent = MARKET_EVENTS.find(e => Math.abs(
                      new Date(e.date).getTime() - new Date(pt.date).getTime()
                    ) < 5 * 86400000);
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs">
                        <div className="font-semibold mb-1.5">{label}</div>
                        {nearEvent && showEvents && (
                          <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
                            <Milestone className="h-3 w-3" />
                            <span>{nearEvent.label}</span>
                          </div>
                        )}
                        {pt.regime != null && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[pt.regime] }} />
                            <span className="font-medium" style={{ color: REGIME_COLORS[pt.regime] }}>
                              {REGIME_NAMES[pt.regime]}
                            </span>
                          </div>
                        )}
                        {pt.vol != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-cyan-500">Realized Vol</span>
                            <span className="font-mono font-bold">{pt.vol.toFixed(1)}%</span>
                          </div>
                        )}
                        {pt.vix != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-orange-500">VIX</span>
                            <span className="font-mono font-bold">{pt.vix.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="vol"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  connectNulls
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#06b6d4', fill: 'hsl(var(--card))' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vix"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  connectNulls
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#f97316', fill: 'hsl(var(--card))' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-72 text-sm text-muted-foreground">
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
          title="Realized Volatility & VIX"
          whatItIs="The rolling realized volatility of SPY (cyan area) for the selected window plotted alongside VIX (orange line), with background shading showing the active market regime. Toggle 'Events' to overlay key market events."
          whyItMatters="Realized vol and VIX capture volatility from different angles: realized vol looks backward at what happened, VIX is forward-looking. When both spike together, a stress regime is confirmed. Shorter windows (21d) react faster to sudden shocks."
          howToRead="Left axis (cyan) = annualized realized vol %. Right axis (orange) = VIX level. Switch windows in the page header to compare short vs long-run vol. Events toggle adds labeled dashed lines at key market dates."
          actionableInsight="Rising VIX with stable realized vol signals the market is pricing in future stress before it arrives. When realized vol exceeds VIX, current risk may be underpriced. Short windows amplify this divergence signal."
        />
      }
    />
  );
}
