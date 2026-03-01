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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Correlation <span className="text-gradient">Matrix</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sector ETF correlation analysis with regime context
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Window selector */}
              {WINDOWS.map(w => (
                <button
                  key={w.value}
                  onClick={() => setWindow(w.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    window === w.value
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {w.label}
                </button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              {/* Method selector */}
              {METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

      <div className="p-6 space-y-6">
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
