import { useMutation } from "@tanstack/react-query";
import { backtesterApi, type BacktestApiRequest, type BacktestResult } from "@/lib/api";

export function useRunBacktest() {
  return useMutation<BacktestResult, Error, BacktestApiRequest>({
    mutationFn: (req) => backtesterApi.runBacktest(req),
  });
}
