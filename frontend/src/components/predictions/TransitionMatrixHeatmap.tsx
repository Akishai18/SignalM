import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useTransitionMatrix } from '@/hooks/useRegimeData';

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

const REGIME_COLORS: Record<string, string> = {
  'Calm': 'text-emerald-500',
  'Crisis': 'text-red-500',
  'Elevated Stress': 'text-orange-500',
  'Transition': 'text-purple-500',
};

function getCellColor(value: number): string {
  if (value >= 0.8) return 'bg-red-500/60 text-white';
  if (value >= 0.5) return 'bg-orange-500/40 text-white';
  if (value >= 0.2) return 'bg-yellow-500/30';
  if (value >= 0.1) return 'bg-blue-500/20';
  if (value >= 0.01) return 'bg-blue-500/10';
  return 'bg-muted/30';
}

interface Props {
  selectedIndex: string;
}

export default function TransitionMatrixHeatmap({ selectedIndex }: Props) {
  const { data, isLoading } = useTransitionMatrix(selectedIndex);
  const [hoveredCell, setHoveredCell] = useState<{ from: string; to: string } | null>(null);

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Regime Transition Matrix</h3>
        <p className="text-xs text-muted-foreground">Probability of transitioning from one regime to another</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="overflow-x-auto">
          {/* Header row */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `100px repeat(${REGIME_ORDER.length}, 1fr)` }}>
            <div className="text-[10px] text-muted-foreground font-medium p-1">From ↓ To →</div>
            {REGIME_ORDER.map(to => (
              <div
                key={to}
                className={`text-[10px] font-medium p-1 text-center transition-all ${REGIME_COLORS[to]} ${
                  hoveredCell?.to === to ? 'brightness-150 scale-105' : ''
                }`}
              >
                {to}
              </div>
            ))}

            {/* Data rows */}
            {REGIME_ORDER.map(from => (
              <>
                <div
                  key={`label-${from}`}
                  className={`text-[10px] font-medium p-1 flex items-center transition-all ${REGIME_COLORS[from]} ${
                    hoveredCell?.from === from ? 'brightness-150 scale-105' : ''
                  }`}
                >
                  {from}
                </div>
                {REGIME_ORDER.map(to => {
                  const value = data.matrix[from]?.[to] ?? 0;
                  const count = data.counts[from]?.[to] ?? 0;
                  const isHovered = hoveredCell?.from === from && hoveredCell?.to === to;
                  return (
                    <div
                      key={`${from}-${to}`}
                      className={`relative rounded-md p-2 text-center transition-all cursor-pointer ${getCellColor(value)} ${
                        isHovered ? 'scale-110 shadow-lg z-10 ring-1 ring-primary/40' : 'hover:scale-105 hover:shadow-md hover:z-10'
                      }`}
                      onMouseEnter={() => setHoveredCell({ from, to })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="text-sm font-mono font-bold">{(value * 100).toFixed(1)}%</div>
                      <div className="text-[9px] opacity-60">{count}×</div>

                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-xl text-[10px] whitespace-nowrap z-20 pointer-events-none">
                          <span className={REGIME_COLORS[from]}>{from}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className={REGIME_COLORS[to]}>{to}</span>
                          <div className="font-mono font-bold mt-0.5">{(value * 100).toFixed(1)}% ({count} transitions)</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>

          {/* Common Paths */}
          {data.common_paths.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">Most Common Transitions</div>
              <div className="space-y-1">
                {data.common_paths.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                    <span className="font-mono">
                      {p.path.map((r, j) => (
                        <span key={j}>
                          {j > 0 && <span className="text-muted-foreground mx-1">→</span>}
                          <span className={REGIME_COLORS[r]}>{r}</span>
                        </span>
                      ))}
                    </span>
                    <span className="text-muted-foreground">{p.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          title="Regime Transition Matrix"
          whatItIs="A probability matrix showing how likely each regime is to transition to another. Entry (i,j) means: given we're in regime i, the probability of moving to regime j next."
          whyItMatters="Understanding transition probabilities helps predict what's likely to come next. If Crisis has a high probability of transitioning to Transition, you know a crisis may not end abruptly."
          howToRead="High diagonal values (top-left to bottom-right) mean regimes tend to persist. High off-diagonal values reveal common transition paths. The count below each percentage shows how many times that transition occurred historically."
          actionableInsight="When the current regime has high self-persistence (diagonal > 90%), expect stability. When off-diagonal values are elevated, prepare for a potential regime change."
        />
      }
    />
  );
}
