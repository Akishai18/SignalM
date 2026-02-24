import { cn } from "@/lib/utils";
import { useCorrelationMatrix } from "@/hooks/useRegimeData";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

function getCorrelationColor(value: number, isDark: boolean = false): string {
  if (value >= 0.7) return isDark ? "bg-neon-cyan/80" : "bg-neon-cyan/70";
  if (value >= 0.5) return isDark ? "bg-neon-green/60" : "bg-neon-green/50";
  if (value >= 0.3) return isDark ? "bg-neon-yellow/50" : "bg-neon-yellow/40";
  return isDark ? "bg-muted/50" : "bg-muted/30";
}

export function CorrelationHeatmap() {
  const { data, isLoading } = useCorrelationMatrix();

  const sectors = data?.sectors || ["Tech", "Fin", "Health", "Energy", "Cons", "Ind"];
  const correlationData = data?.matrix || [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading correlation data...</p>
          </div>
        </div>
      </div>
    );
  }

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 hover-border-glow group">
      <div className="mb-4 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">Sector Correlations</h3>
          <p className="text-sm text-muted-foreground">Rolling 30-day correlation matrix</p>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform">
            <div className="h-3 w-3 rounded bg-neon-cyan/70 group-hover:shadow-md transition-shadow" />
            <span className="text-muted-foreground hover:text-foreground transition-colors">High (≥0.7)</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform">
            <div className="h-3 w-3 rounded bg-neon-green/50 group-hover:shadow-md transition-shadow" />
            <span className="text-muted-foreground hover:text-foreground transition-colors">Medium</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform">
            <div className="h-3 w-3 rounded bg-muted/30 group-hover:shadow-md transition-shadow" />
            <span className="text-muted-foreground hover:text-foreground transition-colors">Low</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div className="w-16 shrink-0" />
            {sectors.map((sector) => (
              <div
                key={sector}
                className="w-16 shrink-0 text-center text-[10px] font-medium text-muted-foreground hover:text-primary py-2 transition-colors cursor-pointer leading-tight"
                title={sector}
              >
                {sector}
              </div>
            ))}
          </div>

          {/* Matrix rows */}
          {correlationData.map((row, i) => (
            <div key={sectors[i]} className="flex">
              <div className="w-16 shrink-0 text-[10px] font-medium text-muted-foreground hover:text-primary flex items-center transition-colors cursor-pointer leading-tight" title={sectors[i]}>
                {sectors[i]}
              </div>
              {row.map((value, j) => (
                <div
                  key={`${i}-${j}`}
                  className={cn(
                    "w-16 h-12 shrink-0 flex items-center justify-center",
                    "text-xs font-mono font-medium transition-all duration-200",
                    "rounded-md m-0.5 cursor-pointer",
                    "hover:scale-105 hover:z-10 hover:shadow-lg",
                    getCorrelationColor(value),
                    i === j && "ring-1 ring-primary/50"
                  )}
                >
                  {value.toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const backContent = (
    <EducationCard
      title="Sector Correlation Matrix"
      whatItIs="This heatmap shows how strongly different market sectors move together over the last 30 days. Correlation ranges from -1 (perfect opposite movement) to +1 (perfect together movement). Higher values (brighter cyan) mean sectors are moving in lockstep."
      whyItMatters="Sector correlations reveal market structure. Low correlations (0.3-0.5) indicate healthy, diversified markets where sectors respond to their own fundamentals. High correlations (>0.7) signal risk-off behavior where macro factors dominate and diversification breaks down."
      howToRead={`• Diagonal cells (highlighted): Always 1.0 - each sector perfectly correlates with itself
• Cyan cells (≥0.7): High correlation - sectors moving together
• Green cells (0.5-0.7): Medium correlation - some co-movement
• Gray cells (<0.5): Low correlation - independent movements

During calm regimes, you'll see more gray/green. During crises, the entire matrix lights up cyan as correlations spike toward 1.`}
      actionableInsight="When correlations suddenly increase across the board, it's often a warning sign that markets are entering a stressed regime. This is when 'flight to quality' happens and sector-specific strategies underperform broad market hedges."
      variant="success"
    />
  );

  return <FlipCard front={frontContent} back={backContent} />;
}
