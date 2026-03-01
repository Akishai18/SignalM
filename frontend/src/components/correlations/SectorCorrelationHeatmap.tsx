import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useSectorMatrix } from '@/hooks/useRegimeData';

function getCellColor(value: number): string {
  // Diverging: red (negative) → gray (0) → cyan (positive)
  if (value >= 0.8) return 'bg-cyan-500/70 text-white';
  if (value >= 0.6) return 'bg-cyan-500/50 text-white';
  if (value >= 0.4) return 'bg-cyan-500/30';
  if (value >= 0.2) return 'bg-cyan-500/15';
  if (value >= 0) return 'bg-muted/20';
  if (value >= -0.2) return 'bg-red-500/15';
  if (value >= -0.4) return 'bg-red-500/30';
  return 'bg-red-500/50 text-white';
}

interface Props {
  window: number;
  method: string;
}

export default function SectorCorrelationHeatmap({ window, method }: Props) {
  const { data, isLoading } = useSectorMatrix(window, method);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const sectors = data?.sectors ?? [];
  const matrix = data?.matrix ?? [];
  const n = sectors.length;

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Sector Correlation Matrix</h3>
        <p className="text-xs text-muted-foreground">
          {n}x{n} pairwise correlation ({method}, {window}-day window)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-72">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : matrix.length > 0 ? (
        <div className="overflow-x-auto">
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: `80px repeat(${n}, 1fr)` }}
          >
            {/* Header */}
            <div />
            {sectors.map((s, ci) => (
              <div
                key={`h-${ci}`}
                className={`text-[9px] font-medium p-1 text-center truncate transition-all ${
                  hoveredCell?.col === ci ? 'text-primary scale-105' : 'text-muted-foreground'
                }`}
              >
                {s}
              </div>
            ))}

            {/* Rows */}
            {sectors.map((rowSector, ri) => (
              <>
                <div
                  key={`rl-${ri}`}
                  className={`text-[9px] font-medium p-1 flex items-center truncate transition-all ${
                    hoveredCell?.row === ri ? 'text-primary scale-105' : 'text-muted-foreground'
                  }`}
                >
                  {rowSector}
                </div>
                {sectors.map((colSector, ci) => {
                  const val = matrix[ri]?.[ci] ?? 0;
                  const isHovered = hoveredCell?.row === ri && hoveredCell?.col === ci;
                  const isHighlighted = hoveredCell?.row === ri || hoveredCell?.col === ci;
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      className={`relative rounded-sm p-1 text-center transition-all cursor-pointer ${getCellColor(val)} ${
                        isHovered
                          ? 'scale-110 shadow-lg z-10 ring-1 ring-primary/40'
                          : isHighlighted
                          ? 'brightness-110'
                          : 'hover:scale-105 hover:shadow-md hover:z-10'
                      }`}
                      onMouseEnter={() => setHoveredCell({ row: ri, col: ci })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="text-[10px] font-mono font-bold">
                        {ri === ci ? '1.00' : val.toFixed(2)}
                      </div>

                      {isHovered && ri !== ci && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-xl text-[10px] whitespace-nowrap z-20 pointer-events-none">
                          <span className="text-primary">{rowSector}</span>
                          <span className="text-muted-foreground mx-1">&times;</span>
                          <span className="text-primary">{colSector}</span>
                          <div className="font-mono font-bold mt-0.5">{val.toFixed(4)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
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
          title="Sector Correlation Matrix"
          whatItIs="A pairwise correlation matrix of 11 S&P 500 sector ETFs computed from log returns. Shows how closely sectors move together over the selected time window."
          whyItMatters="High cross-sector correlation signals systemic risk — when everything moves together, diversification breaks down. Low correlation means sectors are acting independently, which is healthier for portfolio construction."
          howToRead="Cyan = positive correlation, red = negative. Darker shades = stronger. The diagonal is always 1.0. Look for unusual pairs: Energy and Tech are typically less correlated, while Financials and Industrials often move together."
          actionableInsight="If average correlation spikes above 0.6, the market is in a high-correlation regime — often a crisis signal. Use this to adjust position sizing and hedging strategy."
        />
      }
    />
  );
}
