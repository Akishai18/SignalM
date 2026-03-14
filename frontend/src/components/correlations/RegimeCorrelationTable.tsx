import { Loader2 } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useRegimeCorrelation } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

export default function RegimeCorrelationTable() {
  const { data, isLoading } = useRegimeCorrelation();

  const points = data?.points ?? [];

  // Group by regime
  const regimeGroups: Record<string, number[]> = {};
  for (const p of points) {
    if (!regimeGroups[p.regime_name]) regimeGroups[p.regime_name] = [];
    regimeGroups[p.regime_name].push(p.avg_correlation);
  }

  const currentCorr = points.length > 0 ? points[points.length - 1].avg_correlation : null;
  const currentRegime = points.length > 0 ? points[points.length - 1].regime_name : null;

  const rows = REGIME_ORDER.map(name => {
    const vals = regimeGroups[name] ?? [];
    const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const std =
      vals.length > 1 && mean != null
        ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
        : null;
    return { name, mean, std, count: vals.length };
  });

  const maxMean = Math.max(...rows.map(r => r.mean ?? 0));

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Correlation by Regime</h3>
        <p className="text-xs text-muted-foreground">
          Historical avg correlation conditioned on market regime
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {rows.map(row => {
              const isCurrentRegime = row.name === currentRegime;
              const color = REGIME_COLORS[row.name] ?? '#6b7280';
              const barWidth = row.mean != null && maxMean > 0 ? (row.mean / maxMean) * 100 : 0;
              const vsCurrent =
                row.mean != null && currentCorr != null ? currentCorr - row.mean : null;

              return (
                <div
                  key={row.name}
                  className={`rounded-lg px-3 py-2.5 border transition-all ${
                    isCurrentRegime
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-transparent bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium">{row.name}</span>
                      {isCurrentRegime && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                          NOW
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {vsCurrent != null && !isCurrentRegime && (
                        <span
                          className={`text-[10px] font-mono ${
                            vsCurrent > 0.01 ? 'text-red-400' : vsCurrent < -0.01 ? 'text-emerald-400' : 'text-muted-foreground'
                          }`}
                        >
                          {vsCurrent > 0 ? '+' : ''}
                          {vsCurrent.toFixed(3)} vs avg
                        </span>
                      )}
                      <span className="font-mono text-sm font-bold">
                        {row.mean != null ? row.mean.toFixed(3) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: color, opacity: 0.65 }}
                    />
                  </div>

                  {row.std != null && (
                    <div className="text-[9px] text-muted-foreground mt-1">
                      ±{row.std.toFixed(3)} std · {row.count.toLocaleString()} days
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {currentCorr != null && (
            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Current avg correlation</span>
              <span className="font-mono text-sm font-bold">{currentCorr.toFixed(4)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Correlation by Regime"
          whatItIs="The historical average pairwise sector correlation for each of the 4 market regimes, computed over the full 2012-2024 dataset. Shows the typical correlation level you'd expect in each regime."
          whyItMatters="Correlation is a defining characteristic of each regime — Crisis regimes systematically have the highest correlation (diversification collapses), while Calm regimes have the lowest. This table gives you a historical benchmark to evaluate the current level."
          howToRead="Each row shows a regime's mean correlation ± std deviation. The 'NOW' badge marks the current regime. The '+/-' delta on each row shows how today's correlation compares to that regime's historical average."
          actionableInsight="If current correlation is well above the Crisis regime average, the market may be in an extreme stress event. If it's below the Calm average, conditions are unusually benign — a good time to take on risk."
        />
      }
    />
  );
}
