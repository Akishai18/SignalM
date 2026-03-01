import { Loader2, Clock } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useTransitionMatrix } from '@/hooks/useRegimeData';

const REGIME_ORDER = ['Calm', 'Crisis', 'Elevated Stress', 'Transition'];

const REGIME_BAR_COLORS: Record<string, string> = {
  'Calm': 'bg-emerald-500',
  'Crisis': 'bg-red-500',
  'Elevated Stress': 'bg-orange-500',
  'Transition': 'bg-purple-500',
};

const REGIME_TEXT_COLORS: Record<string, string> = {
  'Calm': 'text-emerald-500',
  'Crisis': 'text-red-500',
  'Elevated Stress': 'text-orange-500',
  'Transition': 'text-purple-500',
};

const REGIME_BG: Record<string, string> = {
  'Calm': 'bg-emerald-500/10 border-emerald-500/20',
  'Crisis': 'bg-red-500/10 border-red-500/20',
  'Elevated Stress': 'bg-orange-500/10 border-orange-500/20',
  'Transition': 'bg-purple-500/10 border-purple-500/20',
};

interface Props {
  selectedIndex: string;
}

export default function RegimeDurationStats({ selectedIndex }: Props) {
  const { data, isLoading } = useTransitionMatrix(selectedIndex);

  const durations = data?.durations;
  const maxMean = durations
    ? Math.max(...REGIME_ORDER.map(r => durations[r]?.mean_days ?? 0))
    : 1;

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Regime Duration Stats</h3>
          <p className="text-xs text-muted-foreground">How long each regime typically lasts</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : durations ? (
        <div className="space-y-3">
          {REGIME_ORDER.map(regime => {
            const stats = durations[regime];
            if (!stats) return null;
            const barWidth = (stats.mean_days / maxMean) * 100;

            return (
              <div key={regime} className={`group rounded-lg border p-3 hover-lift cursor-pointer ${REGIME_BG[regime]}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${REGIME_TEXT_COLORS[regime]}`}>{regime}</span>
                  <span className="text-xs text-muted-foreground">{stats.total_runs} occurrences</span>
                </div>

                {/* Duration bar */}
                <div className="relative h-5 bg-muted/50 rounded-full mb-2">
                  <div
                    className={`h-5 rounded-full transition-all group-hover:brightness-110 group-hover:shadow-sm ${REGIME_BAR_COLORS[regime]}`}
                    style={{ width: `${barWidth}%`, minWidth: '20px' }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                    avg {stats.mean_days.toFixed(1)} days
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Min: {stats.min_days}d</span>
                  <span>Median: {stats.median_days.toFixed(0)}d</span>
                  <span>Max: {stats.max_days}d</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
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
          title="Regime Duration Statistics"
          whatItIs="Historical statistics showing how long each market regime typically persists. Includes mean, median, min, and max duration in trading days."
          whyItMatters="Duration data helps set expectations. If Calm regimes historically last 50+ days on average, an early exit might signal something unusual. Short-lived regimes like Transition may require faster decision-making."
          howToRead="The bar shows average duration relative to the longest regime. Min/max show the full range. More occurrences (total runs) means more statistical confidence in the averages."
          actionableInsight="If the current regime has persisted longer than its historical max, a transition may be imminent. If it's below the median, expect it to continue."
        />
      }
    />
  );
}
