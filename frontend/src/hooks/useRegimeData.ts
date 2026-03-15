/**
 * TanStack Query hooks for regime data fetching
 * Provides caching, auto-refresh, and error handling
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import api, {
  PCAStructureFullResponse,
  PCALoadingsResponse,
  PCAComponentsResponse,
  PCARegimeScoresResponse,
  PCAScatterResponse,
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
  // NEW: Real predictions API types
  PredictionsResponse,
  HorizonPrediction,
  ModelComparisonNew,
  IndicesPredictionsComparison,
  CustomHorizonResponse,
  TrajectoryResponse,
  TransitionMatrixResponse,
  BacktestResponse,
  WhatIfResponse,
  // Correlation types
  SectorMatrixResponse,
  RollingCorrelationResponse,
  RegimeCorrelationResponse,
  PCAStructureResponse,
  SectorPairResponse,
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
  // NEW: Real predictions API
  predictions: (symbol: string) => ['predictions', symbol, 'current'] as const,
  horizonPrediction: (symbol: string, days: number) => ['predictions', symbol, 'horizon', days] as const,
  modelAccuracy: (symbol: string) => ['predictions', symbol, 'accuracy'] as const,
  indicesPredictions: ['predictions', 'indices', 'comparison'] as const,
  customHorizon: (symbol: string, days: number) => ['predictions', symbol, 'custom-horizon', days] as const,
  trajectory: (symbol: string, days: number) => ['predictions', symbol, 'trajectory', days] as const,
  transitions: (symbol: string) => ['predictions', symbol, 'transitions'] as const,
  backtest: (symbol: string) => ['predictions', symbol, 'backtest'] as const,
  whatIf: (symbol: string, params: string) => ['predictions', symbol, 'what-if', params] as const,
  // Correlation page
  sectorMatrix: (window: number, method: string) => ['correlations', 'sector-matrix', window, method] as const,
  rollingCorrelation: ['correlations', 'rolling'] as const,
  regimeCorrelation: ['correlations', 'regime-correlation'] as const,
  pcaStructure: ['correlations', 'pca-structure'] as const,
  sectorPairDetail: (s1: string, s2: string) => ['correlations', 'sector-pair', s1, s2] as const,
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

// ============================================================================
// NEW: Real Predictions API Hooks
// ============================================================================

/**
 * Hook to fetch current predictions for all horizons (1d, 7d, 30d)
 * @param symbol - Index symbol (SPY, QQQ, DIA, IWM)
 * Refetch every minute
 */
export function usePredictions(
  symbol: string = 'SPY'
): UseQueryResult<PredictionsResponse, Error> {
  return useQuery({
    queryKey: queryKeys.predictions(symbol),
    queryFn: () => api.getPredictions(symbol),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Hook to fetch prediction for specific horizon
 * @param symbol - Index symbol
 * @param days - Prediction horizon (1, 7, or 30)
 */
export function useHorizonPrediction(
  symbol: string,
  days: number
): UseQueryResult<HorizonPrediction, Error> {
  return useQuery({
    queryKey: queryKeys.horizonPrediction(symbol, days),
    queryFn: () => api.getHorizonPrediction(symbol, days),
    staleTime: 60 * 1000, // 1 minute
    enabled: [1, 7, 30].includes(days), // Only fetch for valid horizons
  });
}

/**
 * Hook to fetch model accuracy comparison
 * @param symbol - Index symbol
 */
export function useModelAccuracy(
  symbol: string = 'SPY'
): UseQueryResult<ModelComparisonNew, Error> {
  return useQuery({
    queryKey: queryKeys.modelAccuracy(symbol),
    queryFn: () => api.getModelAccuracy(symbol),
    staleTime: 5 * 60 * 1000, // 5 minutes (accuracy doesn't change often)
  });
}

/**
 * Hook to fetch predictions comparison across all indices
 * Shows regime divergence across SPY, QQQ, DIA, IWM
 * Refetch every minute
 */
export function useIndicesPredictionsComparison(): UseQueryResult<
  IndicesPredictionsComparison,
  Error
> {
  return useQuery({
    queryKey: queryKeys.indicesPredictions,
    queryFn: api.getIndicesPredictionsComparison,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Hook for custom horizon predictions (manual trigger)
 * Call refetch() to trigger the prediction
 */
export function useCustomHorizonPrediction(
  symbol: string,
  days: number
): UseQueryResult<CustomHorizonResponse, Error> {
  return useQuery({
    queryKey: queryKeys.customHorizon(symbol, days),
    queryFn: () => api.getCustomHorizonPrediction(symbol, days),
    enabled: false, // Only fetch when refetch() is called
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useTransitionMatrix(
  symbol: string
): UseQueryResult<TransitionMatrixResponse, Error> {
  return useQuery({
    queryKey: queryKeys.transitions(symbol),
    queryFn: () => api.getTransitions(symbol),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBacktest(
  symbol: string
): UseQueryResult<BacktestResponse, Error> {
  return useQuery({
    queryKey: queryKeys.backtest(symbol),
    queryFn: () => api.getBacktest(symbol),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWhatIfPrediction(
  symbol: string,
  params: { vol_delta: number; corr_delta: number; returns_delta: number; drawdown_delta: number; momentum_delta: number }
): UseQueryResult<WhatIfResponse, Error> {
  return useQuery({
    queryKey: ['predictions', symbol, 'what-if', JSON.stringify(params)] as const,
    queryFn: () => api.getWhatIf(symbol, params),
    enabled: false,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useRegimeTrajectory(
  symbol: string,
  days: number
): UseQueryResult<TrajectoryResponse, Error> {
  return useQuery({
    queryKey: queryKeys.trajectory(symbol, days),
    queryFn: () => api.getTrajectory(symbol, days),
    enabled: false,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Correlation Page Hooks
// ============================================================================

export function useSectorMatrix(
  window: number = 63,
  method: string = 'pearson'
): UseQueryResult<SectorMatrixResponse, Error> {
  return useQuery({
    queryKey: queryKeys.sectorMatrix(window, method),
    queryFn: () => api.getSectorMatrix(window, method),
    staleTime: 2 * 60 * 1000,
  });
}

export function useRollingCorrelation(): UseQueryResult<RollingCorrelationResponse, Error> {
  return useQuery({
    queryKey: queryKeys.rollingCorrelation,
    queryFn: api.getRollingCorrelation,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegimeCorrelation(): UseQueryResult<RegimeCorrelationResponse, Error> {
  return useQuery({
    queryKey: queryKeys.regimeCorrelation,
    queryFn: api.getRegimeCorrelation,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePCAStructure(): UseQueryResult<PCAStructureResponse, Error> {
  return useQuery({
    queryKey: queryKeys.pcaStructure,
    queryFn: api.getPCAStructure,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// PCA Hooks
// ============================================================================

export function usePCAStructureFull(): UseQueryResult<PCAStructureFullResponse, Error> {
  return useQuery({
    queryKey: ['pca', 'structure', 'full'],
    queryFn: api.getPCAStructureFull,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePCALoadings(topN: number = 12): UseQueryResult<PCALoadingsResponse, Error> {
  return useQuery({
    queryKey: ['pca', 'loadings', topN],
    queryFn: () => api.getPCALoadings(topN),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePCAComponents(): UseQueryResult<PCAComponentsResponse, Error> {
  return useQuery({
    queryKey: ['pca', 'components'],
    queryFn: api.getPCAComponents,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePCARegimeScores(): UseQueryResult<PCARegimeScoresResponse, Error> {
  return useQuery({
    queryKey: ['pca', 'regime-scores'],
    queryFn: api.getPCARegimeScores,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePCAScatter(): UseQueryResult<PCAScatterResponse, Error> {
  return useQuery({
    queryKey: ['pca', 'scatter'],
    queryFn: api.getPCAScatter,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSectorPairDetail(
  sector1: string,
  sector2: string
): UseQueryResult<SectorPairResponse, Error> {
  return useQuery({
    queryKey: queryKeys.sectorPairDetail(sector1, sector2),
    queryFn: () => api.getSectorPairDetail(sector1, sector2),
    staleTime: 2 * 60 * 1000,
    enabled: !!sector1 && !!sector2 && sector1 !== sector2,
  });
}
