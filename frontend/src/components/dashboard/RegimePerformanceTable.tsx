/**
 * Regime Performance Table Component
 * Shows index performance metrics conditioned on each market regime
 */
import { useIndexPerformance } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Award } from "lucide-react";
import { getRegimeColor } from "@/lib/api";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

interface RegimePerformanceTableProps {
  symbol: string;
}

export function RegimePerformanceTable({ symbol }: RegimePerformanceTableProps) {
  const { data: performance, isLoading, isError } = useIndexPerformance(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance by Regime</CardTitle>
          <CardDescription>SPY returns conditioned on market state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-pulse text-muted-foreground">Loading performance data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !performance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance by Regime</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load performance data</div>
        </CardContent>
      </Card>
    );
  }

  // Sort by Sharpe ratio (best risk-adjusted returns)
  const sortedPerformance = [...performance].sort((a, b) => b.sharpe_ratio - a.sharpe_ratio);
  const bestRegime = sortedPerformance[0];

  const frontContent = (
    <Card className="hover-border-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance by Regime
        </CardTitle>
        <CardDescription>
          {symbol} returns and risk metrics for each market regime
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Performance Table */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Regime</th>
                  <th className="text-right p-3 font-medium">Return</th>
                  <th className="text-right p-3 font-medium">Volatility</th>
                  <th className="text-right p-3 font-medium">Sharpe</th>
                  <th className="text-right p-3 font-medium">Win Rate</th>
                  <th className="text-right p-3 font-medium">Avg VIX</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedPerformance.map((regime) => {
                  const isBest = regime.regime_id === bestRegime.regime_id;
                  const regimeColor = getRegimeColor(regime.regime_id);

                  return (
                    <tr
                      key={regime.regime_id}
                      className={`row-hover ${
                        isBest ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: regimeColor }}
                          />
                          <span className="font-medium">{regime.regime_name}</span>
                          {isBest && (
                            <Award className="h-4 w-4 text-primary" title="Best Sharpe Ratio" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {regime.days} days ({((regime.days / performance.reduce((sum, r) => sum + r.days, 0)) * 100).toFixed(0)}%)
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-semibold ${regime.annualized_return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {regime.annualized_return >= 0 ? '+' : ''}{(regime.annualized_return * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          annualized
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-medium">
                          {(regime.volatility * 100).toFixed(1)}%
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold">
                          {regime.sharpe_ratio.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-medium">
                          {(regime.win_rate * 100).toFixed(1)}%
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-medium">
                          {regime.avg_vix?.toFixed(1) || 'N/A'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Key Insights */}
          <div className="space-y-2 text-sm">
            <div className="font-medium">Key Insights:</div>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">{bestRegime.regime_name}</strong> regime has the best risk-adjusted returns (Sharpe: {bestRegime.sharpe_ratio.toFixed(2)})
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Crisis periods average VIX of {performance.find(r => r.regime_name === 'Crisis')?.avg_vix?.toFixed(1) || 'N/A'} vs {performance.find(r => r.regime_name === 'Calm')?.avg_vix?.toFixed(1) || 'N/A'} in Calm markets
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Transition periods show highest volatility ({(performance.find(r => r.regime_name === 'Transition')?.volatility || 0) * 100}%) with lowest returns
                </span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <EducationCard
      title={`${symbol} Performance by Regime`}
      whatItIs="This table breaks down how the index performed during each market regime historically. It shows returns, volatility, Sharpe ratio (risk-adjusted return), win rate (% of positive days), and average VIX level for each regime."
      whyItMatters="Not all market conditions are equal. Understanding how assets perform in different regimes helps you adjust exposure. Some strategies work great in calm markets but crater in crises. Sharpe ratio tells you which regimes offered the best risk-adjusted opportunities."
      howToRead={`• Return: Annualized return if you only held during this regime
• Volatility: How much daily returns fluctuated (annualized)
• Sharpe Ratio: Return per unit of risk (higher is better)
• Win Rate: What % of days were positive
• Avg VIX: Fear gauge level during this regime

The regime with the trophy (${bestRegime.regime_name}) has the best Sharpe ratio at ${bestRegime.sharpe_ratio.toFixed(2)}. Days column shows how often each regime occurs.`}
      actionableInsight="If crisis regimes have negative returns but short duration, staying invested through them can make sense. If transition regimes have terrible Sharpe ratios, you might want to reduce exposure when you detect regime shifts happening."
      variant="success"
    />
  );

  return <FlipCard front={frontContent} back={backContent} />;
}
