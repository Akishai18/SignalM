import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, X, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  name: string;
  size: string;
  status: "processing" | "complete" | "error";
  rows?: number;
}

const UploadPage = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([
    { name: "sp500_prices_2024.csv", size: "12.4 MB", status: "complete", rows: 125840 },
    { name: "vix_historical.csv", size: "2.1 MB", status: "complete", rows: 8234 },
  ]);

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Data <span className="text-gradient">Upload</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Import market data for analysis
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Upload area */}
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed p-12 transition-all duration-300",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            // Handle file drop
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Drop your files here
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Support for CSV, Excel, and JSON formats
            </p>
            <Button variant="neon" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Browse Files
            </Button>
          </div>

          {/* Animated border */}
          {isDragging && (
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 animate-pulse-glow opacity-50" />
            </div>
          )}
        </div>

        {/* Sample datasets */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Sample Datasets</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started quickly with pre-loaded market data
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: "S&P 500 Components", period: "2020-2024", size: "45 MB" },
              { name: "VIX Index History", period: "2010-2024", size: "8 MB" },
              { name: "Sector ETFs", period: "2015-2024", size: "32 MB" },
            ].map((dataset) => (
              <button
                key={dataset.name}
                className="text-left p-4 rounded-lg bg-muted/30 hover:bg-muted transition-colors border border-transparent hover:border-primary/20"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{dataset.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dataset.period} • {dataset.size}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Uploaded files */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "rounded-lg p-2",
                      file.status === "complete" && "bg-neon-green/10 text-neon-green",
                      file.status === "processing" && "bg-neon-cyan/10 text-neon-cyan",
                      file.status === "error" && "bg-destructive/10 text-destructive"
                    )}
                  >
                    {file.status === "complete" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <FileSpreadsheet className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.size} {file.rows && `• ${file.rows.toLocaleString()} rows`}
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UploadPage;
