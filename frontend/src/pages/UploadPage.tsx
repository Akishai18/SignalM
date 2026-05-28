import { useRef, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Database, FolderUp, X, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDatasetStore } from "@/hooks/useDatasetStore";
import { DatasetCard } from "@/components/custom-data/DatasetCard";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const MAX_VISIBLE = 4;

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAllOpen, setShowAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isDemoMode } = useAuth();
  const userId = user?.id ?? (isDemoMode ? 'demo' : 'guest');
  const { datasets, addDataset, removeDataset, updateDataset } = useDatasetStore(userId);

  const visibleDatasets = datasets.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, datasets.length - MAX_VISIBLE);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setUploadError(null);
      setUploading(true);

      const datasetName =
        file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") || "My Dataset";

      try {
        const result = await api.customData.upload(file, datasetName);
        addDataset({
          session_id: result.session_id,
          dataset_name: result.dataset_name,
          original_filename: file.name,
          created_at: new Date().toISOString(),
          status: "running",
        });
        // Poll for completion
        const poll = async () => {
          try {
            const status = await api.customData.getStatus(result.session_id);
            updateDataset(result.session_id, {
              status: status.status as any,
              progress_pct: status.progress_pct,
            });
            if (status.status === "complete") {
              // Fetch meta to get tickers and date range
              const meta = await api.customData.getMeta(result.session_id);
              updateDataset(result.session_id, {
                tickers: meta.tickers,
                date_range: meta.date_range,
              });
            } else if (status.status !== "error") {
              setTimeout(poll, 2000);
            }
          } catch {
            // ignore polling errors
          }
        };
        setTimeout(poll, 2000);
      } catch (err: any) {
        setUploadError(err?.message ?? "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [addDataset, updateDataset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <DashboardLayout>
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              My <span className="text-gradient">Data</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              Upload your own market data for regime analysis
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 p-4 md:gap-6 md:p-6 lg:grid-cols-[55fr_45fr]">
        {/* Left: Upload area */}
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            className={cn(
              "relative rounded-xl border-2 border-dashed p-12 transition-all duration-300 cursor-pointer",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                {uploading ? (
                  <Upload className="h-8 w-8 text-primary animate-bounce" />
                ) : (
                  <FolderUp className="h-8 w-8 text-primary" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {uploading ? "Uploading…" : "Drop your file here"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                CSV (wide/long), Excel .xlsx, or JSON · min 63 trading days · max 200 MB
              </p>
              <Button variant="neon" className="gap-2" disabled={uploading}>
                <FileSpreadsheet className="h-4 w-4" />
                Browse Files
              </Button>
            </div>
            {isDragging && (
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 animate-pulse-glow opacity-50" />
              </div>
            )}
          </div>

          {/* Upload error */}
          {uploadError && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
              {uploadError}
            </div>
          )}

          {/* Format guide */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm">Accepted Formats</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              {[
                { label: "CSV wide", example: "Date, AAPL, MSFT, …" },
                { label: "CSV long", example: "Date, Symbol, Adj Close" },
                { label: "Excel (.xlsx/.xls)", example: "First sheet, same shapes" },
                {
                  label: "JSON records",
                  example: '[{"Date":"2020-01-02","AAPL":296.24}]',
                },
              ].map((f) => (
                <div key={f.label} className="space-y-1">
                  <p className="font-medium text-foreground">{f.label}</p>
                  <p className="font-mono">{f.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sample datasets notice */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm">What gets computed?</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Log returns → rolling volatility &amp; correlation</li>
              <li>Rolling PCA metrics (PC1 var, effective dimension)</li>
              <li>Fresh K-Means (K=4) on your data's feature distributions</li>
              <li>Markov chain transition matrix + 1d/7d/30d predictions</li>
              <li>HMM cross-check (if ≥252 trading days)</li>
            </ul>
          </div>
        </div>

        {/* Right: Dataset list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              My Datasets{" "}
              {datasets.length > 0 && (
                <span className="text-muted-foreground text-sm font-normal">
                  ({datasets.length})
                </span>
              )}
            </h2>
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllOpen(true)}
              >
                <LayoutList className="h-3.5 w-3.5" />
                View all
              </Button>
            )}
          </div>

          {datasets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-2">
              <Database className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No datasets yet. Upload a file to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleDatasets.map((ds) => (
                <DatasetCard
                  key={ds.session_id}
                  dataset={ds}
                  onDelete={removeDataset}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllOpen(true)}
                  className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  +{hiddenCount} more dataset{hiddenCount !== 1 ? "s" : ""} — view all
                </button>
              )}
            </div>
          )}
        </div>

        {/* All datasets overlay */}
        {showAllOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAllOpen(false)}
            />
            <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="font-semibold">All Datasets</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{datasets.length} total</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAllOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3">
                {datasets.map((ds) => (
                  <DatasetCard
                    key={ds.session_id}
                    dataset={ds}
                    onDelete={(id) => { removeDataset(id); if (datasets.length - 1 <= MAX_VISIBLE) setShowAllOpen(false); }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
