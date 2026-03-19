import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisProgressScreen } from "@/components/custom-data/AnalysisProgressScreen";
import { CustomRegimeOverviewTab } from "@/components/custom-data/CustomRegimeOverviewTab";
import { CustomRegimeHistoryTab } from "@/components/custom-data/CustomRegimeHistoryTab";
import { CustomPredictionsTab } from "@/components/custom-data/CustomPredictionsTab";
import { CustomFactorsTab } from "@/components/custom-data/CustomFactorsTab";
import { CustomPerformanceTab } from "@/components/custom-data/CustomPerformanceTab";
import { useCustomDataset } from "@/hooks/useCustomDataset";

export default function DatasetDashboardPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const sid = datasetId ?? "";

  const { data: statusData, isLoading: statusLoading } = useCustomDataset.useStatus(sid);
  const status = statusData?.status ?? "pending";
  const isComplete = status === "complete";

  const { data: overview } = useCustomDataset.useOverview(sid, isComplete);
  const { data: historyData } = useCustomDataset.useHistory(sid, isComplete);
  const { data: transitionsData } = useCustomDataset.useTransitions(sid, isComplete);
  const { data: performanceData } = useCustomDataset.usePerformance(sid, isComplete);
  const { data: featuresData } = useCustomDataset.useFeatures(sid, isComplete);
  const { data: predictionsData } = useCustomDataset.usePredictions(sid, isComplete);

  const datasetName =
    overview?.dataset_name ?? statusData?.message ?? "Dataset";

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/upload")}
            >
              <ArrowLeft className="h-4 w-4" />
              My Data
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{datasetName}</h1>
              {overview?.date_range && (
                <p className="text-xs text-muted-foreground">
                  {overview.date_range.start} → {overview.date_range.end}
                  {overview.tickers?.length > 0 && (
                    <> · {overview.tickers.length} ticker{overview.tickers.length !== 1 ? "s" : ""}</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {statusLoading && (
          <AnalysisProgressScreen status="pending" progress={0} message="Loading…" />
        )}

        {!statusLoading && (status === "pending" || status === "running") && (
          <AnalysisProgressScreen
            status={status}
            progress={statusData?.progress_pct ?? 0}
            message={statusData?.message ?? "Analysis in progress…"}
          />
        )}

        {!statusLoading && status === "error" && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Analysis Failed</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {statusData?.error ?? "An unexpected error occurred."}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/upload")}>
              Back to My Data
            </Button>
          </div>
        )}

        {isComplete && !overview && (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading results…</span>
          </div>
        )}

        {isComplete && overview && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
              <TabsTrigger value="factors">Factors</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CustomRegimeOverviewTab overview={overview} />
            </TabsContent>

            <TabsContent value="history">
              {historyData?.history ? (
                <CustomRegimeHistoryTab
                  history={historyData.history}
                  regimeLabelMap={overview.regime_label_map ?? {}}
                  regimeColorMap={overview.regime_color_map ?? {}}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading history…</p>
              )}
            </TabsContent>

            <TabsContent value="predictions">
              {predictionsData ? (
                <CustomPredictionsTab
                  currentRegime={predictionsData.current_regime}
                  predictions={predictionsData.predictions}
                  regimeLabelMap={predictionsData.regime_label_map ?? {}}
                  regimeColorMap={predictionsData.regime_color_map ?? {}}
                  transitionMatrix={transitionsData?.transition_matrix}
                  transitionCounts={transitionsData?.transition_counts}
                  durations={transitionsData?.durations}
                  sessionId={sid}
                  datasetName={datasetName}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading predictions…</p>
              )}
            </TabsContent>

            <TabsContent value="factors">
              {featuresData?.features ? (
                <CustomFactorsTab
                  features={featuresData.features}
                  regimeColorMap={overview.regime_color_map ?? {}}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading features…</p>
              )}
            </TabsContent>

            <TabsContent value="performance">
              {performanceData?.performance ? (
                <CustomPerformanceTab
                  performance={performanceData.performance}
                  regimeColorMap={overview.regime_color_map ?? {}}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading performance…</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
