import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import SectorCorrelationHeatmap from '@/components/correlations/SectorCorrelationHeatmap';
import RollingCorrelationChart from '@/components/correlations/RollingCorrelationChart';
import CorrelationRegimeOverlay from '@/components/correlations/CorrelationRegimeOverlay';
import MarketStructureChart from '@/components/correlations/MarketStructureChart';
import SectorPairDrilldown from '@/components/correlations/SectorPairDrilldown';
import CorrelationStats from '@/components/correlations/CorrelationStats';

const WINDOWS = [
  { value: 21, label: '21d' },
  { value: 63, label: '63d' },
  { value: 126, label: '126d' },
  { value: 252, label: '252d' },
];

const METHODS = [
  { value: 'pearson', label: 'Pearson' },
  { value: 'spearman', label: 'Spearman' },
];

const CorrelationPage = () => {
  const [window, setWindow] = useState(63);
  const [method, setMethod] = useState('pearson');

  return (
    <DashboardLayout>
      {/* Sticky header with window/method selectors */}
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Correlation <span className="text-gradient">Matrix</span>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
                Sector ETF correlation analysis with regime context
              </p>
            </div>
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:overflow-visible md:pb-0">
              {/* Window selector */}
              {WINDOWS.map(w => (
                <button
                  key={w.value}
                  onClick={() => setWindow(w.value)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all md:px-3 md:text-sm ${
                    window === w.value
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {w.label}
                </button>
              ))}
              <div className="mx-1 h-6 w-px shrink-0 bg-border" />
              {/* Method selector */}
              {METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all md:px-3 md:text-sm ${
                    method === m.value
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Row 1: Heatmap + Stats sidebar */}
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <SectorCorrelationHeatmap window={window} method={method} />
          </div>
          <div>
            <CorrelationStats window={window} method={method} />
          </div>
        </div>

        {/* Row 2: Rolling Correlation + Regime Overlay */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RollingCorrelationChart />
          <CorrelationRegimeOverlay />
        </div>

        {/* Row 3: Market Structure + Sector Pair Drilldown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <MarketStructureChart />
          <SectorPairDrilldown />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CorrelationPage;
