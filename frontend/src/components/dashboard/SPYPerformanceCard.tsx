/**
 * SPY Performance Card Component
 * Displays current SPY (S&P 500 ETF) price and performance metrics
 */
import { useSPYCurrent } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export function SPYPerformanceCard() {
  const { data: spyData, isLoading, isError } = useSPYCurrent();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">SPY (S&P 500)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !spyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">SPY (S&P 500)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load SPY data</div>
        </CardContent>
      </Card>
    );
  }

  const { close, returns, vol_252d } = spyData;
  const dailyReturn = returns || 0;
  const volatility = vol_252d || 0;

  const isPositive = dailyReturn >= 0;

  return (
    <Card className="card-hover hover-border-glow group">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 group-hover:scale-110 group-hover:text-primary transition-all" />
          <span className="group-hover:text-primary transition-colors">SPY (S&P 500)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Current Price */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-bold group-hover:scale-105 transition-transform inline-block">${close.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1 group-hover:text-primary/70 transition-colors">
                Latest Close
              </div>
            </div>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'} group-hover:scale-110 transition-transform`}>
              {isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{(dailyReturn * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <div className="text-xs text-muted-foreground">Daily Change</div>
              <div className={`text-lg font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{(dailyReturn * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Volatility (252d)</div>
              <div className="text-lg font-semibold">
                {(volatility * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Volatility Indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Volatility</span>
              <span>{volatility < 0.15 ? 'Low' : volatility < 0.25 ? 'Normal' : 'High'}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  volatility < 0.15
                    ? 'bg-green-500'
                    : volatility < 0.25
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((volatility / 0.5) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Update Time */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            As of {spyData.date}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
