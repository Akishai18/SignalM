import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCALoadings } from '@/hooks/useRegimeData';
import { cn } from '@/lib/utils';

const PC_META = {
  PC1: { label: 'PC1 — Systemic Risk', color: '#06b6d4' },
  PC2: { label: 'PC2 — Idiosyncratic', color: '#8b5cf6' },
  PC3: { label: 'PC3 — Sector', color: '#f59e0b' },
} as const;

const TOP_N_OPTIONS = [5, 10, 15, 20];

function LoadingBar({ value }: { value: number }) {
  const pct = Math.abs(value) * 100;
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: positive ? '#10b981' : '#ef4444',
          }}
        />
      </div>
      <span
        className="font-mono text-[10px] w-12 text-right"
        style={{ color: positive ? '#10b981' : '#ef4444' }}
      >
        {value >= 0 ? '+' : ''}{value.toFixed(3)}
      </span>
    </div>
  );
}

export default function TopLoadingsTable() {
  const [topN, setTopN] = useState(10);
  const { data, isLoading } = usePCALoadings(topN);

  const pcs = ['PC1', 'PC2', 'PC3'] as const;

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Top Feature Loadings per Principal Component</h3>
          <p className="text-xs text-muted-foreground">
            Features with the largest absolute loading on each PC (252-day vol window).
          </p>
        </div>
        {/* Top-N selector */}
        <div className="flex gap-1 ml-4 flex-shrink-0">
          {TOP_N_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                topN === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pcs.map(pc => {
            const items = data.loadings[pc] ?? [];
            const ve = data.variance_explained[pc];
            const meta = PC_META[pc];
            return (
              <div key={pc}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-xs font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  {ve != null && (
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                      {(ve * 100).toFixed(1)}% var
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={item.raw_feature} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground truncate" title={item.feature}>
                        {i + 1}. {item.feature}
                      </span>
                      <LoadingBar value={item.loading} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data</div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Top Feature Loadings"
          whatItIs="Each principal component is a weighted combination of all input features. The loading is the weight (correlation) between a feature and the PC — how much that feature 'loads onto' that component."
          whyItMatters="Loadings reveal what each PC actually measures. If PC1 loads heavily on high-vol stocks across all sectors, it's capturing systemic risk. If PC2 loads on tech vs financials, it's capturing a sector rotation factor."
          howToRead="Bars show absolute magnitude; green = positive loading (feature moves with PC), red = negative (feature moves against PC). Use the top-N buttons to expand or narrow the feature list."
          actionableInsight="When the same stock appears in the top 10 of multiple PCs, that stock is a cross-factor driver. Features with large negative PC1 loadings are natural hedges — they diverge from the market during systemic stress."
        />
      }
    />
  );
}
