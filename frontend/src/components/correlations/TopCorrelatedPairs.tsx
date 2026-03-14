import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useSectorMatrix } from '@/hooks/useRegimeData';

interface Props {
  window: number;
  method: string;
  topN?: number;
}

interface Pair {
  sector1: string;
  sector2: string;
  correlation: number;
}

export default function TopCorrelatedPairs({ window, method, topN = 5 }: Props) {
  const { data, isLoading } = useSectorMatrix(window, method);

  const sectors = data?.sectors ?? [];
  const matrix = data?.matrix ?? [];

  // Extract all unique upper-triangle pairs
  const pairs: Pair[] = [];
  for (let i = 0; i < sectors.length; i++) {
    for (let j = i + 1; j < sectors.length; j++) {
      pairs.push({
        sector1: sectors[i],
        sector2: sectors[j],
        correlation: matrix[i]?.[j] ?? 0,
      });
    }
  }

  pairs.sort((a, b) => b.correlation - a.correlation);
  const highest = pairs.slice(0, topN);
  const lowest = pairs.slice(-topN).reverse();

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Highest & Lowest Correlated Pairs</h3>
        <p className="text-xs text-muted-foreground">
          {window}-day {method} — ranked from {pairs.length} pairs
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : pairs.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Most correlated */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-xs font-semibold text-cyan-500">Most Correlated</span>
            </div>
            <div className="space-y-1.5">
              {highest.map((p, i) => (
                <div
                  key={`h-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-cyan-500/10 px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] text-muted-foreground font-mono w-3 shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium truncate">{p.sector1}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{p.sector2}</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-cyan-500 shrink-0">
                    {p.correlation.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Least correlated */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">Least Correlated</span>
            </div>
            <div className="space-y-1.5">
              {lowest.map((p, i) => (
                <div
                  key={`l-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] text-muted-foreground font-mono w-3 shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium truncate">{p.sector1}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{p.sector2}</div>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold shrink-0 ${
                      p.correlation < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}
                  >
                    {p.correlation.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
          title="Highest & Lowest Correlated Pairs"
          whatItIs="A ranked view of the 5 most and 5 least correlated sector ETF pairs, extracted from the full correlation matrix for the selected window and method."
          whyItMatters="The most correlated pairs lose diversification benefit — holding both gives little protection. The least correlated pairs are natural hedges. When high-correlation pairs spike during stress, diversification breaks down across the board."
          howToRead="Left column (cyan) = pairs moving most in lockstep. Right column (amber) = pairs with the most independence. Negative correlations (red) are rare and represent true natural hedges."
          actionableInsight="If you hold positions in sectors from the 'most correlated' list, you have concentrated regime risk. Consider replacing one with a sector from the 'least correlated' column to improve diversification."
        />
      }
    />
  );
}
