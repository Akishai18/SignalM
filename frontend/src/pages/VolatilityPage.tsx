import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import VolatilityTimeSeriesChart from '@/components/volatility/VolatilityTimeSeriesChart';
import VolatilityByRegimeChart from '@/components/volatility/VolatilityByRegimeChart';
import RegimeRiskReturnChart from '@/components/volatility/RegimeRiskReturnChart';
import RegimePerformanceTable from '@/components/volatility/RegimePerformanceTable';
import { useMergedMarketData, useVIXCurrent, useDashboardMetrics, useCurrentRegime } from '@/hooks/useRegimeData';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const VOL_WINDOWS = [
  { value: 21, label: '21d' },
  { value: 63, label: '63d' },
  { value: 126, label: '126d' },
  { value: 252, label: '252d' },
];

function computeRollingVol(returns: (number | null)[], w: number): (number | null)[] {
  const result: (number | null)[] = new Array(returns.length).fill(null);
  for (let i = w - 1; i < returns.length; i++) {
    const slice: number[] = [];
    for (let j = i - w + 1; j <= i; j++) {
      if (returns[j] != null) slice.push(returns[j]!);
    }
    if (slice.length < Math.floor(w * 0.8)) continue;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    result[i] = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }
  return result;
}

function StatCard({
  label,
  value,
  sub,
  delta,
  deltaLabel,
  color,
  isLoading,
}: {
  label: string;
  value: string | null;
  sub?: string;
  delta?: number | null;
  deltaLabel?: string;
  color?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      {isLoading ? (
        <div className="flex items-center h-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-bold font-mono" style={color ? { color } : undefined}>
            {value ?? '—'}
          </div>
          {delta != null && (
            <div
              className={`flex items-center gap-0.5 text-xs font-mono mb-0.5 ${
                delta > 0.005 ? 'text-red-400' : delta < -0.005 ? 'text-emerald-400' : 'text-muted-foreground'
              }`}
            >
              {delta > 0.005 ? (
                <TrendingUp className="h-3 w-3" />
              ) : delta < -0.005 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      {deltaLabel && delta != null && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{deltaLabel}</div>
      )}
    </div>
  );
}

const VolatilityPage = () => {
  const [volWindow, setVolWindow] = useState(252);

  const { data: mergedData, isLoading: mergedLoading } = useMergedMarketData(1500);
  const { data: vixCurrent, isLoading: vixLoading } = useVIXCurrent();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: currentRegime } = useCurrentRegime();

  // Compute rolling vol series for selected window from merged data returns
  const volSeries = useMemo(() => {
    const pts = mergedData?.data ?? [];
    if (volWindow === 252) {
      return pts.map(p => p.spy_vol_252d != null ? p.spy_vol_252d * 100 : null);
    }
    const rets = pts.map(p => p.spy_returns ?? null);
    return computeRollingVol(rets, volWindow);
  }, [mergedData, volWindow]);

  const latestVol = volSeries.filter(v => v != null).at(-1) ?? null;
  const nonNull = volSeries.map((v, i) => v != null ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
  const prev = nonNull.length >= 22 ? nonNull.at(-22)?.v ?? null : null;
  const volDelta = latestVol != null && prev != null ? (latestVol - prev) / 100 : null;

  const regimeColor = currentRegime ? REGIME_COLORS[currentRegime.regime_name] : undefined;
  const vixColor = vixCurrent == null ? undefined
    : vixCurrent.close >= 30 ? '#ef4444'
    : vixCurrent.close >= 20 ? '#f59e0b'
    : '#10b981';

  return (
    <DashboardLayout>
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Volatility <span className="text-gradient">Regimes</span>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
                Realized vol, VIX, and regime-conditioned risk analytics
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Vol window selector */}
              <div className="flex items-center gap-1.5">
                {VOL_WINDOWS.map(w => (
                  <button
                    key={w.value}
                    onClick={() => setVolWindow(w.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all md:px-3 md:text-sm ${
                      volWindow === w.value
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* Current regime badge */}
              {currentRegime && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 md:px-3">
                  <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: regimeColor }} />
                  <span className="text-xs font-medium md:text-sm" style={{ color: regimeColor }}>
                    {currentRegime.regime_name}
                  </span>
                  <span className="text-xs text-muted-foreground">· day {currentRegime.days_in_regime}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Row 1: Stat cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          <StatCard
            label={`Realized Volatility (${volWindow}d)`}
            value={latestVol != null ? `${latestVol.toFixed(1)}%` : null}
            sub={`SPY annualized ${volWindow}-day realized vol`}
            delta={volDelta}
            deltaLabel="vs 21 trading days ago"
            isLoading={mergedLoading}
          />
          <StatCard
            label="VIX — Implied Volatility"
            value={vixCurrent ? vixCurrent.close.toFixed(1) : null}
            sub="CBOE fear gauge — options market expectation"
            color={vixColor}
            isLoading={vixLoading}
          />
          <StatCard
            label="Vol Dispersion"
            value={metrics ? metrics.vol_dispersion.toFixed(4) : null}
            sub="Cross-sectional std of 252d vol — K-means feature"
            isLoading={metricsLoading}
          />
        </div>

        {/* Row 2: Full-width time series */}
        <VolatilityTimeSeriesChart volWindow={volWindow} volSeries={volSeries} />

        {/* Row 3: Volatility by regime + Sharpe/win rate */}
        <div className="grid gap-6 lg:grid-cols-2">
          <VolatilityByRegimeChart />
          <RegimeRiskReturnChart />
        </div>

        {/* Row 4: Full performance table */}
        <RegimePerformanceTable />
      </div>
    </DashboardLayout>
  );
};

export default VolatilityPage;
