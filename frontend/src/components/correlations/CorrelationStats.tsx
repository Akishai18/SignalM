import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { useSectorMatrix } from '@/hooks/useRegimeData';

interface Props {
  window: number;
  method: string;
}

function getCorrelationLevel(mean: number): { label: string; color: string; icon: typeof TrendingUp } {
  if (mean >= 0.6) return { label: 'High', color: 'text-red-500', icon: TrendingUp };
  if (mean >= 0.35) return { label: 'Normal', color: 'text-emerald-500', icon: Minus };
  return { label: 'Low', color: 'text-cyan-500', icon: TrendingDown };
}

export default function CorrelationStats({ window, method }: Props) {
  const { data, isLoading } = useSectorMatrix(window, method);

  const stats = data?.stats;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  const level = getCorrelationLevel(stats.mean);
  const LevelIcon = level.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Correlation Summary</h3>
      </div>

      {/* Correlation regime indicator */}
      <div className="rounded-lg border border-border p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-1">Correlation Regime</div>
        <div className={`flex items-center gap-2 ${level.color}`}>
          <LevelIcon className="h-4 w-4" />
          <span className="text-lg font-bold">{level.label}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          Based on {window}-day {method} avg
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Mean Correlation</span>
          <span className="font-mono font-bold text-sm">{stats.mean.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Max Correlation</span>
          <span className="font-mono font-bold text-sm text-cyan-500">{stats.max.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Min Correlation</span>
          <span className="font-mono font-bold text-sm text-red-500">{stats.min.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Std Deviation</span>
          <span className="font-mono font-bold text-sm">{stats.std.toFixed(4)}</span>
        </div>
      </div>

      {/* Interpretation bar */}
      <div className="pt-2 border-t border-border">
        <div className="text-[10px] text-muted-foreground mb-1.5">Correlation Distribution</div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            className="h-full bg-red-500/60 transition-all"
            style={{ width: `${Math.max(0, (1 - stats.mean) * 50)}%` }}
          />
          <div
            className="h-full bg-cyan-500/60 transition-all"
            style={{ width: `${Math.max(0, stats.mean * 50 + 50)}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>Decorrelated</span>
          <span>Highly Correlated</span>
        </div>
      </div>

      {/* Sector count */}
      <div className="text-[10px] text-muted-foreground">
        {data?.sectors.length ?? 0} sectors &middot; {((data?.sectors.length ?? 0) * ((data?.sectors.length ?? 0) - 1)) / 2} pairs
      </div>
    </div>
  );
}
