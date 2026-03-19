import { Loader2 } from "lucide-react";

interface Props {
  status: string;
  progress: number;
  message: string;
}

export function AnalysisProgressScreen({ status, progress, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-12">
      <div className="relative">
        <Loader2 className="h-14 w-14 text-primary animate-spin" />
        <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold">Analyzing Your Data</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{status}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Feature engineering → K-Means clustering → Markov predictions
      </p>
    </div>
  );
}
