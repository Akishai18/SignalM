/**
 * TanStack Query hooks for regime data fetching
 * Provides caching, auto-refresh, and error handling
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import api, {
  RegimeLabel,
  CurrentRegime,
  RegimeHistoryPoint,
  Forecast,
  ModelComparison,
  DashboardMetrics,
  FeatureImportance,
  CorrelationMatrix,
  HealthCheck,
  SPYCurrent,
  SPYHistoryResponse,
  VIXCurrent,
  VIXHistoryResponse,
  RegimePerformance,
  MergedMarketDataResponse,
  IndexInfo,
  IndexRegime,
  IndexComparison,
  IndexHistoryResponse,
} from '@/lib/api';

// Query keys for cache management
export const queryKeys = {
  regimeLabels: ['regimes', 'labels'] as const,
  currentRegime: ['regimes', 'current'] as const,
  regimeHistory: (limit: number) => ['regimes', 'history', limit] as const,
  forecast: ['predictions', 'forecast'] as const,
  modelComparison: ['predictions', 'comparison'] as const,
  metrics: ['metrics', 'summary'] as const,
  featureImportance: (model: string, topN: number) =>
    ['features', 'importance', model, topN] as const,
  correlationMatrix: ['correlations', 'matrix'] as const,
  health: ['health'] as const,
  spyCurrent: ['market', 'spy', 'current'] as const,
  spyHistory: (limit: number) => ['market', 'spy', 'history', limit] as const,
  vixCurrent: ['market', 'vix', 'current'] as const,
  vixHistory: (limit: number) => ['market', 'vix', 'history', limit] as const,
  regimePerformance: ['regimes', 'performance'] as const,
  mergedMarketData: (limit: number) => ['market', 'merged', limit] as const,
  indicesList: ['indices', 'list'] as const,
  indexCurrent: (symbol: string) => ['indices', symbol, 'current'] as const,
  indexHistory: (symbol: string, limit: number) => ['indices', symbol, 'history', limit] as const,
  indicesComparison: ['indices', 'comparison'] as const,
  indexPerformance: (symbol: string) => ['indices', symbol, 'performance'] as const,
  indexMergedData: (symbol: string, limit: number) => ['indices', symbol, 'merged', limit] as const,
};

/**
 * Hook to fetch regime labels
 * Refetch every 5 minutes
 */
export function useRegimeLabels(): UseQueryResult<RegimeLabel[], Error> {
  return useQuery({
    queryKey: queryKeys.regimeLabels,
    queryFn: api.getRegimeLabels,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch current regime state
 * Refetch every 30 seconds (for "real-time" feel)
 */
export function useCurrentRegime(): UseQueryResult<CurrentRegime, Error> {
  return useQuery({
    queryKey: queryKeys.currentRegime,
    queryFn: api.getCurrentRegime,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch regime history
 * @param limit - Number of recent points to fetch (default: 1000)
 */
export function useRegimeHistory(
  limit: number = 1000
): UseQueryResult<RegimeHistoryPoint[], Error> {
  return useQuery({
    queryKey: queryKeys.regimeHistory(limit),
    queryFn: () => api.getRegimeHistory(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch regime forecast (1/7/30-day predictions)
 * Refetch every minute
 */
export function useForecast(): UseQueryResult<Forecast, Error> {
  return useQuery({
    queryKey: queryKeys.forecast,
    queryFn: api.getForecast,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Hook to fetch model comparison
 */
export function useModelComparison(): UseQueryResult<ModelComparison, Error> {
  return useQuery({
    queryKey: queryKeys.modelComparison,
    queryFn: api.getModelComparison,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch dashboard metrics
 * Refetch every 30 seconds
 */
export function useDashboardMetrics(): UseQueryResult<DashboardMetrics, Error> {
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: api.getMetricsSummary,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch feature importance
 * @param model - Model name ('random_forest' or 'xgboost')
 * @param topN - Number of top features to return (default: 10)
 */
export function useFeatureImportance(
  model: 'random_forest' | 'xgboost' = 'random_forest',
  topN: number = 10
): UseQueryResult<FeatureImportance[], Error> {
  return useQuery({
    queryKey: queryKeys.featureImportance(model, topN),
    queryFn: () => api.getFeatureImportance(model, topN),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch correlation matrix
 */
export function useCorrelationMatrix(): UseQueryResult<
  CorrelationMatrix,
  Error
> {
  return useQuery({
    queryKey: queryKeys.correlationMatrix,
    queryFn: api.getCorrelationMatrix,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch health check
 * Useful for connection status indicator
 */
export function useHealthCheck(): UseQueryResult<HealthCheck, Error> {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.getHealthCheck,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    retry: 3, // Retry 3 times on failure
  });
}

// ============================================================================
// Market Data Hooks
// ============================================================================

/**
 * Hook to fetch current SPY price and metrics
 * Refetch every 30 seconds
 */
export function useSPYCurrent(): UseQueryResult<SPYCurrent, Error> {
  return useQuery({
    queryKey: queryKeys.spyCurrent,
    queryFn: api.getSPYCurrent,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch SPY historical data
 * @param limit - Number of days to fetch (default: 365)
 */
export function useSPYHistory(limit: number = 365): UseQueryResult<SPYHistoryResponse, Error> {
  return useQuery({
    queryKey: queryKeys.spyHistory(limit),
    queryFn: () => api.getSPYHistory(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch current VIX level
 * Refetch every 30 seconds
 */
export function useVIXCurrent(): UseQueryResult<VIXCurrent, Error> {
  return useQuery({
    queryKey: queryKeys.vixCurrent,
    queryFn: api.getVIXCurrent,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch VIX historical data
 * @param limit - Number of days to fetch (default: 365)
 */
export function useVIXHistory(limit: number = 365): UseQueryResult<VIXHistoryResponse, Error> {
  return useQuery({
    queryKey: queryKeys.vixHistory(limit),
    queryFn: () => api.getVIXHistory(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch SPY performance metrics by regime
 */
export function useRegimePerformance(): UseQueryResult<RegimePerformance[], Error> {
  return useQuery({
    queryKey: queryKeys.regimePerformance,
    queryFn: api.getRegimePerformance,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch merged regime + SPY + VIX data
 * @param limit - Number of days to fetch (default: 365)
 */
export function useMergedMarketData(limit: number = 365): UseQueryResult<MergedMarketDataResponse, Error> {
  return useQuery({
    queryKey: queryKeys.mergedMarketData(limit),
    queryFn: () => api.getMergedMarketData(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================================================
// Multi-Index Hooks
// ============================================================================

/**
 * Hook to fetch list of all available indices
 */
export function useIndicesList(): UseQueryResult<IndexInfo[], Error> {
  return useQuery({
    queryKey: queryKeys.indicesList,
    queryFn: api.getIndicesList,
    staleTime: 10 * 60 * 1000, // 10 minutes (rarely changes)
  });
}

/**
 * Hook to fetch current regime for a specific index
 * @param symbol - Index symbol (e.g., 'SPY', 'QQQ')
 */
export function useIndexCurrentRegime(symbol: string): UseQueryResult<IndexRegime, Error> {
  return useQuery({
    queryKey: queryKeys.indexCurrent(symbol),
    queryFn: () => api.getIndexCurrentRegime(symbol),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    enabled: !!symbol, // Only run if symbol is provided
  });
}

/**
 * Hook to fetch historical regimes for a specific index
 * @param symbol - Index symbol
 * @param limit - Number of days to fetch (default: 365)
 */
export function useIndexHistory(symbol: string, limit: number = 365): UseQueryResult<IndexHistoryResponse, Error> {
  return useQuery({
    queryKey: queryKeys.indexHistory(symbol, limit),
    queryFn: () => api.getIndexHistory(symbol, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!symbol, // Only run if symbol is provided
  });
}

/**
 * Hook to fetch current regimes for all indices (comparison view)
 * Refetch every 30 seconds
 */
export function useIndicesComparison(): UseQueryResult<IndexComparison, Error> {
  return useQuery({
    queryKey: queryKeys.indicesComparison,
    queryFn: api.getIndicesComparison,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch performance metrics by regime for a specific index
 * @param symbol - Index symbol (e.g., 'SPY', 'QQQ')
 */
export function useIndexPerformance(symbol: string): UseQueryResult<RegimePerformance[], Error> {
  return useQuery({
    queryKey: queryKeys.indexPerformance(symbol),
    queryFn: () => api.getIndexPerformance(symbol),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!symbol, // Only run if symbol is provided
  });
}

/**
 * Hook to fetch merged regime + price + VIX data for a specific index
 * @param symbol - Index symbol
 * @param limit - Number of days to fetch (default: 365)
 */
export function useIndexMergedData(symbol: string, limit: number = 365): UseQueryResult<MergedMarketDataResponse, Error> {
  return useQuery({
    queryKey: queryKeys.indexMergedData(symbol, limit),
    queryFn: () => api.getIndexMergedData(symbol, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!symbol, // Only run if symbol is provided
  });
}

/**
 * Combined hook for dashboard - fetches all necessary data
 * Useful for pages that need multiple data sources
 */
export function useDashboardData() {
  const currentRegime = useCurrentRegime();
  const metrics = useDashboardMetrics();
  const forecast = useForecast();
  const history = useRegimeHistory(365); // Last year
  const health = useHealthCheck();

  return {
    currentRegime,
    metrics,
    forecast,
    history,
    health,
    // Derived states
    isLoading:
      currentRegime.isLoading ||
      metrics.isLoading ||
      forecast.isLoading ||
      history.isLoading,
    isError:
      currentRegime.isError ||
      metrics.isError ||
      forecast.isError ||
      history.isError,
    error:
      currentRegime.error ||
      metrics.error ||
      forecast.error ||
      history.error,
  };
}
