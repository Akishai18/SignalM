/**
 * Index Comparison Grid Component
 * Shows current regime state for all major market indices
 */
import { useIndicesComparison } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { getRegimeColor } from "@/lib/api";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

export function IndexComparisonGrid() {
  const { data: comparison, isLoading, isError } = useIndicesComparison();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
          <CardDescription>Current regime state across major indices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-pulse text-muted-foreground">Loading market data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !comparison) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load market comparison</div>
        </CardContent>
      </Card>
    );
  }

  const { indices } = comparison;

  // Group by category
  const usEquityIndices = indices.filter(idx => idx.symbol.match(/SPY|QQQ|DIA|IWM/));
  const otherIndices = indices.filter(idx => !idx.symbol.match(/SPY|QQQ|DIA|IWM/));

  const RegimeCard = ({ index }: { index: typeof indices[0] }) => {
    const regimeColor = getRegimeColor(index.regime_id);
    const isPositive = index.volatility ? index.volatility < 0.20 : true;

    return (
      <Card className="card-hover hover-border-glow group cursor-pointer">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{index.symbol}</div>
                <div className="text-lg font-semibold group-hover:text-primary transition-colors">{index.name}</div>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
            </div>

            {/* Regime Badge */}
            <div
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all group-hover:scale-105 group-hover:shadow-md"
              style={{
                backgroundColor: `${regimeColor}20`,
                color: regimeColor,
                borderLeft: `3px solid ${regimeColor}`,
              }}
            >
              {index.regime_name}
            </div>

            {/* Price & Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="text-lg font-bold">
                  ${index.price?.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Volatility</div>
                <div className={`text-lg font-bold flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-orange-500'}`}>
                  {index.volatility ? (
                    <>
                      {(index.volatility * 100).toFixed(1)}%
                      {isPositive ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
            </div>

            {/* Update Date */}
            <div className="text-xs text-muted-foreground pt-1">
              Updated {index.date}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Count regimes
  const regimeCounts = indices.reduce((acc, idx) => {
    acc[idx.regime_name] = (acc[idx.regime_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const consensusRegime = Object.entries(regimeCounts).sort((a, b) => b[1] - a[1])[0];

  const frontContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Market Overview</CardTitle>
            <CardDescription>Current regime state across major indices</CardDescription>
          </div>
          {consensusRegime && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Market Consensus</div>
              <div className="text-xl font-bold">{consensusRegime[0]}</div>
              <div className="text-xs text-muted-foreground">
                {consensusRegime[1]}/{indices.length} indices
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* US Equity Indices */}
          {usEquityIndices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">US Equity Markets</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {usEquityIndices.map((index) => (
                  <RegimeCard key={index.symbol} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Other Indices */}
          {otherIndices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Other Markets</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherIndices.map((index) => (
                  <RegimeCard key={index.symbol} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Key Insights:</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {indices.some(idx => idx.regime_name === 'Crisis') && (
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠</span>
                  <span>
                    <strong className="text-foreground">
                      {indices.filter(idx => idx.regime_name === 'Crisis').map(idx => idx.symbol).join(', ')}
                    </strong> {indices.filter(idx => idx.regime_name === 'Crisis').length === 1 ? 'is' : 'are'} in Crisis mode - heightened volatility detected
                  </span>
                </li>
              )}
              {new Set(indices.map(idx => idx.regime_name)).size > 2 && (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    Market divergence detected - indices showing {new Set(indices.map(idx => idx.regime_name)).size} different regime states
                  </span>
                </li>
              )}
              {indices.every(idx => idx.regime_name === 'Calm') && (
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    All indices in Calm regime - stable market conditions across the board
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <EducationCard
      title="Market Overview - Cross-Index Regimes"
      whatItIs="This grid shows the current market regime for multiple indices simultaneously. Each card displays the regime state, current price, and volatility for a different market segment. The 'Market Consensus' shows which regime most indices agree on."
      whyItMatters="Markets don't always move in sync. SPY (large caps) might be calm while IWM (small caps) shows stress. QQQ (tech) could be in crisis while DIA (industrials) is stable. Understanding cross-market divergence helps you spot rotation, sector-specific risks, and opportunities."
      howToRead={`• Regime Badge: Color-coded current regime for each index
• Price: Latest closing price
• Volatility: 252-day rolling volatility (green <20% is healthy)
• Market Consensus: Which regime dominates (${consensusRegime?.[0] || 'N/A'} for ${consensusRegime?.[1] || 0}/${indices.length} indices)

When all indices show the same regime, it's a strong signal. When they diverge, it indicates market uncertainty or sector rotation.`}
      actionableInsight="If small caps (IWM) enter crisis mode while large caps (SPY) stay calm, it often signals economic concerns starting to spread. If tech (QQQ) shows crisis but industrials (DIA) are calm, it might be sector-specific rather than systemic risk."
      variant="success"
    />
  );

  return <FlipCard front={frontContent} back={backContent} />;
}
