/**
 * API Client for Market Regime Dashboard
 * Connects to FastAPI backend (localhost:8000)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

import { getAccessToken } from '@/lib/supabase'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ============================================================================
// TypeScript Types (matching backend Pydantic models)
// ============================================================================

export interface RegimeLabel {
  id: number;
  name: string;
  description: string;
  color: string;
}

export interface CurrentRegime {
  regime_id: number;
  regime_name: string;
  confidence: number;
  days_in_regime: number;
  date: string;
}

export interface RegimeHistoryPoint {
  date: string;
  regime: number;
  regime_name: string;
}

export interface PredictionModel {
  model_name: string;
  accuracy: number;
  confidence: number;
  predicted_regime: number;
  predicted_regime_name: string;
  probabilities: Record<number, number>;
}

export interface ForecastHorizon {
  horizon_days: number;
  predicted_regime: number;
  predicted_regime_name: string;
  confidence: number;
  probabilities: Record<number, number>;
}

export interface Forecast {
  current_regime: CurrentRegime;
  horizons: ForecastHorizon[];
}

// NEW: Real predictions API types
export interface ModelPrediction {
  model_name: string;
  predicted_regime: number;
  predicted_regime_name: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface HorizonPrediction {
  horizon_days: number;
  ensemble: ModelPrediction;
  individual_models: ModelPrediction[];
  weights: Record<string, number>;
}

export interface PredictionsResponse {
  symbol: string;
  current_regime: number | null;
  current_date: string;
  predictions: Record<string, HorizonPrediction>; // "1d", "7d", "30d"
  timestamp: string;
}

export interface ModelAccuracy {
  model_name: string;
  horizon_days: number;
  train_accuracy: number;
  test_accuracy: number | null;
  mean_confidence: number;
}

export interface ModelComparisonNew {
  symbol: string;
  horizons: number[];
  accuracies: ModelAccuracy[];
  best_model_by_horizon: Record<number, string>;
}

export interface IndicesPredictionsComparison {
  indices: Record<string, Record<string, {
    predicted_regime: number;
    predicted_regime_name: string;
    confidence: number;
    probabilities: Record<string, number>;
  }>>;
  timestamp: string;
}

// Custom Horizon Prediction types
export interface CustomHorizonModelMetadata {
  exact_horizon: boolean;
  used_horizon: number;
}

export interface CustomHorizonModelPrediction {
  model_name: string;
  predicted_regime: number;
  predicted_regime_name: string;
  confidence: number;
  probabilities: Record<string, number>;
  metadata: CustomHorizonModelMetadata;
}

export interface CustomHorizonPrediction {
  requested_horizon: number;
  ensemble: {
    model_name: string;
    predicted_regime: number;
    predicted_regime_name: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  individual_models: CustomHorizonModelPrediction[];
  weights: Record<string, number>;
  model_metadata: Record<string, CustomHorizonModelMetadata>;
}

export interface CustomHorizonResponse {
  symbol: string;
  current_regime: number | null;
  current_date: string;
  prediction: CustomHorizonPrediction;
  timestamp: string;
}

// Trajectory types
export interface TrajectoryPoint {
  day: number;
  regime: number;
  regime_name: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface TrajectoryResponse {
  symbol: string;
  max_horizon: number;
  current_regime: number | null;
  points: TrajectoryPoint[];
  timestamp: string;
}

// Transition Matrix types
export interface DurationStats {
  mean_days: number;
  median_days: number;
  min_days: number;
  max_days: number;
  std_days: number;
  total_runs: number;
  total_days: number;
}

export interface TransitionMatrixResponse {
  symbol: string;
  matrix: Record<string, Record<string, number>>;
  counts: Record<string, Record<string, number>>;
  durations: Record<string, DurationStats>;
  common_paths: Array<{ path: string[]; count: number }>;
  timestamp: string;
}

// Backtest types
export interface BacktestPoint {
  date: string;
  rolling_accuracy_1d: number | null;
  rolling_accuracy_7d: number | null;
  rolling_accuracy_30d: number | null;
  confidence_1d: number | null;
  confidence_7d: number | null;
  confidence_30d: number | null;
}

export interface BacktestResponse {
  symbol: string;
  points: BacktestPoint[];
  summary: Record<string, number>;
  timestamp: string;
}

// What-If types
export interface WhatIfModelPrediction {
  model_name: string;
  predicted_regime: number;
  predicted_regime_name: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface WhatIfResponse {
  symbol: string;
  baseline: WhatIfModelPrediction;
  scenario: WhatIfModelPrediction;
  baseline_models: WhatIfModelPrediction[];
  scenario_models: WhatIfModelPrediction[];
  adjustments: Record<string, number>;
  timestamp: string;
}

export interface ModelComparison {
  models: Array<{
    model_name: string;
    accuracy: number;
    confidence: number;
    correct_predictions: number;
    total_predictions: number;
  }>;
  best_model: string;
  insights: string[];
}

export interface DashboardMetrics {
  avg_correlation: number;
  vol_dispersion: number;
  effective_dimension: number;
  current_regime: string;
  regime_confidence: number;
  days_in_regime: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

export interface CorrelationMatrix {
  sectors: string[];
  matrix: number[][];
  timestamp: string;
}

// Correlation page types
export interface SectorMatrixResponse {
  sectors: string[];
  tickers: string[];
  matrix: number[][];
  stats: { mean: number; max: number; min: number; std: number };
  window: number;
  method: string;
  timestamp: string;
}

export interface RollingCorrelationPoint {
  date: string;
  corr_21d: number | null;
  corr_63d: number | null;
  corr_252d: number | null;
}

export interface RollingCorrelationResponse {
  points: RollingCorrelationPoint[];
}

export interface RegimeCorrelationPoint {
  date: string;
  avg_correlation: number;
  regime: number;
  regime_name: string;
}

export interface RegimeCorrelationResponse {
  points: RegimeCorrelationPoint[];
}

export interface PCAStructurePoint {
  date: string;
  pc1_var: number;
  cum_var_3: number;
  effective_dimension: number;
}

export interface PCAStructureResponse {
  points: PCAStructurePoint[];
}

export interface SectorPairPoint {
  date: string;
  correlation: number;
}

export interface SectorPairResponse {
  sector1: string;
  sector1_name: string;
  sector2: string;
  sector2_name: string;
  current_correlation: number | null;
  points: SectorPairPoint[];
}

// ============================================================================
// PCA types
// ============================================================================

export interface PCAStructureFullPoint {
  date: string;
  pc1_var: number;
  pc2_var: number;
  pc3_var: number;
  cum_var_3: number;
  effective_dimension: number;
}

export interface PCAStructureFullResponse {
  points: PCAStructureFullPoint[];
  summary: {
    current_pc1_var: number;
    current_pc2_var: number;
    current_pc3_var: number;
    current_cum_var_3: number;
    current_eff_dim: number;
  };
}

export interface PCALoadingItem {
  feature: string;
  raw_feature: string;
  loading: number;
}

export interface PCALoadingsResponse {
  loadings: Record<string, PCALoadingItem[]>;
  variance_explained: Record<string, number>;
  top_n: number;
  total_features: number;
}

export interface PCAComponentPoint {
  date: string;
  pc1: number | null;
  pc2: number | null;
  pc3: number | null;
  regime: number | null;
  regime_name: string | null;
}

export interface PCAComponentsResponse {
  points: PCAComponentPoint[];
}

export interface PCARegimeScore {
  regime_id: number;
  regime_name: string;
  count: number;
  pc1_mean: number;
  pc1_std: number;
  pc2_mean: number;
  pc2_std: number;
  pc3_mean: number;
  pc3_std: number;
}

export interface PCARegimeScoresResponse {
  regimes: PCARegimeScore[];
}

export interface PCAScatterPoint {
  pc1: number;
  pc2: number;
  pc3: number | null;
  regime: number;
  regime_name: string;
  date: string;
}

export interface PCAScatterResponse {
  points: PCAScatterPoint[];
  variance_explained: Record<string, number>;
}

export interface HealthCheck {
  status: string;
  data_loaded: boolean;
  regime_labels_count: number;
  features_count: number;
  date_range: {
    start: string;
    end: string;
  };
  timestamp: string;
}

export interface SPYDataPoint {
  date: string;
  close: number;
  returns?: number;
  vol_252d?: number;
  regime?: number;
}

export interface SPYHistoryResponse {
  data: SPYDataPoint[];
  count: number;
  timestamp: string;
}

export interface SPYCurrent {
  date: string;
  close: number;
  returns?: number;
  vol_252d?: number;
  timestamp: string;
}

export interface VIXDataPoint {
  date: string;
  close: number;
  regime?: number;
}

export interface VIXHistoryResponse {
  data: VIXDataPoint[];
  count: number;
  timestamp: string;
}

export interface VIXCurrent {
  date: string;
  close: number;
  timestamp: string;
}

export interface RegimePerformance {
  regime_id: number;
  regime_name: string;
  days: number;
  avg_daily_return: number;
  annualized_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_daily_gain: number;
  max_daily_loss: number;
  win_rate: number;
  avg_vix?: number;
}

export interface MergedMarketDataPoint {
  date: string;
  regime?: number;
  spy_close?: number;
  spy_returns?: number;
  spy_vol_252d?: number;
  vix?: number;
}

export interface MergedMarketDataResponse {
  data: MergedMarketDataPoint[];
  count: number;
  timestamp: string;
}

export interface IndexInfo {
  symbol: string;
  name: string;
  description: string;
  category: string;
  color: string;
}

export interface IndexRegime {
  symbol: string;
  name: string;
  regime_id: number;
  regime_name: string;
  date: string;
  price?: number;
  volatility?: number;
}

export interface IndexComparison {
  indices: IndexRegime[];
  timestamp: string;
}

export interface IndexHistoryPoint {
  date: string;
  regime: number | null;
  regime_name: string | null;
  price: number | null;
}

export interface IndexHistoryResponse {
  symbol: string;
  name: string;
  data: IndexHistoryPoint[];
  count: number;
  timestamp: string;
}

// ============================================================================
// API Error Handling
// ============================================================================

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error: ${response.status} ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      // If not JSON, use status text
    }

    throw new APIError(errorMessage, response.status, errorText);
  }

  return response.json();
}

// ============================================================================
// API Client Functions
// ============================================================================

export const api = {
  /**
   * Health check
   */
  async ping(): Promise<{ status: string; service: string; version: string }> {
    const response = await fetch(`${API_BASE_URL}/`);
    return handleResponse(response);
  },

  /**
   * Get all regime labels with metadata
   */
  async getRegimeLabels(): Promise<RegimeLabel[]> {
    const response = await fetch(`${API_BASE_URL}/api/regimes/labels`);
    return handleResponse(response);
  },

  /**
   * Get current regime state
   */
  async getCurrentRegime(): Promise<CurrentRegime> {
    const response = await fetch(`${API_BASE_URL}/api/regimes/current`);
    return handleResponse(response);
  },

  /**
   * Get historical regime labels
   * @param limit - Number of recent points to return (default: 1000)
   */
  async getRegimeHistory(limit: number = 1000): Promise<RegimeHistoryPoint[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/regimes/history?limit=${limit}`
    );
    return handleResponse(response);
  },

  /**
   * Get regime predictions for 1/7/30-day horizons (OLD - mock data)
   * @deprecated Use getPredictions() instead
   */
  async getForecast(): Promise<Forecast> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/forecast`);
    return handleResponse(response);
  },

  /**
   * Get accuracy comparison of all 4 prediction models (OLD - mock data)
   * @deprecated Use getModelAccuracy() instead
   */
  async getModelComparison(): Promise<ModelComparison> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/comparison`);
    return handleResponse(response);
  },

  // ===== NEW: Real Predictions API =====

  /**
   * Get current predictions for all horizons (1d, 7d, 30d)
   * @param symbol - Index symbol (SPY, QQQ, DIA, IWM)
   */
  async getPredictions(symbol: string = 'SPY'): Promise<PredictionsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/current`);
    return handleResponse(response);
  },

  /**
   * Get prediction for specific horizon
   * @param symbol - Index symbol
   * @param days - Prediction horizon (1, 7, or 30)
   */
  async getHorizonPrediction(symbol: string, days: number): Promise<HorizonPrediction> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/horizon/${days}`);
    return handleResponse(response);
  },

  async getCustomHorizonPrediction(symbol: string, days: number): Promise<CustomHorizonResponse> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/horizon-custom/${days}`);
    return handleResponse(response);
  },

  async getTrajectory(symbol: string, days: number): Promise<TrajectoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/trajectory/${days}`);
    return handleResponse(response);
  },

  async getTransitions(symbol: string): Promise<TransitionMatrixResponse> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/transitions`);
    return handleResponse(response);
  },

  async getBacktest(symbol: string, days: number = 252): Promise<BacktestResponse> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/backtest?days=${days}`);
    return handleResponse(response);
  },

  async getWhatIf(symbol: string, params: { vol_delta: number; corr_delta: number; returns_delta: number; drawdown_delta: number; momentum_delta: number }): Promise<WhatIfResponse> {
    const searchParams = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.toString()]))
    );
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/what-if?${searchParams}`);
    return handleResponse(response);
  },

  getExportUrl(symbol: string): string {
    return `${API_BASE_URL}/api/predictions/${symbol}/export`;
  },

  /**
   * Get model accuracy comparison
   * @param symbol - Index symbol
   */
  async getModelAccuracy(symbol: string = 'SPY'): Promise<ModelComparisonNew> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${symbol}/accuracy`);
    return handleResponse(response);
  },

  /**
   * Compare predictions across all indices
   */
  async getIndicesPredictionsComparison(): Promise<IndicesPredictionsComparison> {
    const response = await fetch(`${API_BASE_URL}/api/predictions/compare`);
    return handleResponse(response);
  },

  /**
   * Get summary metrics for dashboard
   */
  async getMetricsSummary(): Promise<DashboardMetrics> {
    const response = await fetch(`${API_BASE_URL}/api/metrics/summary`);
    return handleResponse(response);
  },

  /**
   * Get feature importance for a given model
   * @param model - Model name ('random_forest' or 'xgboost')
   * @param topN - Number of top features to return (default: 10)
   */
  async getFeatureImportance(
    model: 'random_forest' | 'xgboost' = 'random_forest',
    topN: number = 10
  ): Promise<FeatureImportance[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/features/importance?model=${model}&top_n=${topN}`
    );
    return handleResponse(response);
  },

  /**
   * Get correlation matrix for sector/factor analysis
   * @deprecated Use getSectorMatrix instead
   */
  async getCorrelationMatrix(): Promise<CorrelationMatrix> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/sector-matrix`);
    const data = await handleResponse<SectorMatrixResponse>(response);
    return { sectors: data.sectors, matrix: data.matrix, timestamp: data.timestamp };
  },

  async getSectorMatrix(window: number = 63, method: string = 'pearson'): Promise<SectorMatrixResponse> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/sector-matrix?window=${window}&method=${method}`);
    return handleResponse(response);
  },

  async getRollingCorrelation(): Promise<RollingCorrelationResponse> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/rolling`);
    return handleResponse(response);
  },

  async getRegimeCorrelation(): Promise<RegimeCorrelationResponse> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/regime-correlation`);
    return handleResponse(response);
  },

  async getPCAStructure(): Promise<PCAStructureResponse> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/pca-structure`);
    return handleResponse(response);
  },

  async getSectorPairDetail(sector1: string, sector2: string): Promise<SectorPairResponse> {
    const response = await fetch(`${API_BASE_URL}/api/correlations/sector-pair-detail?sector1=${sector1}&sector2=${sector2}`);
    return handleResponse(response);
  },

  async getPCAStructureFull(): Promise<PCAStructureFullResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pca/structure`);
    return handleResponse(response);
  },

  async getPCALoadings(topN: number = 12): Promise<PCALoadingsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pca/loadings?top_n=${topN}`);
    return handleResponse(response);
  },

  async getPCAComponents(): Promise<PCAComponentsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pca/components`);
    return handleResponse(response);
  },

  async getPCARegimeScores(): Promise<PCARegimeScoresResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pca/regime-scores`);
    return handleResponse(response);
  },

  async getPCAScatter(): Promise<PCAScatterResponse> {
    const response = await fetch(`${API_BASE_URL}/api/pca/scatter`);
    return handleResponse(response);
  },

  /**
   * Detailed health check with data status
   */
  async getHealthCheck(): Promise<HealthCheck> {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return handleResponse(response);
  },

  // ========== Market Data Endpoints ==========

  /**
   * Get current SPY price and metrics
   */
  async getSPYCurrent(): Promise<SPYCurrent> {
    const response = await fetch(`${API_BASE_URL}/api/market/spy/current`);
    return handleResponse(response);
  },

  /**
   * Get SPY historical data
   * @param limit - Number of days to fetch (default: 365)
   */
  async getSPYHistory(limit: number = 365): Promise<SPYHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/market/spy/history?limit=${limit}`);
    return handleResponse(response);
  },

  /**
   * Get current VIX level
   */
  async getVIXCurrent(): Promise<VIXCurrent> {
    const response = await fetch(`${API_BASE_URL}/api/market/vix/current`);
    return handleResponse(response);
  },

  /**
   * Get VIX historical data
   * @param limit - Number of days to fetch (default: 365)
   */
  async getVIXHistory(limit: number = 365): Promise<VIXHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/market/vix/history?limit=${limit}`);
    return handleResponse(response);
  },

  /**
   * Get SPY performance metrics by regime
   */
  async getRegimePerformance(): Promise<RegimePerformance[]> {
    const response = await fetch(`${API_BASE_URL}/api/regimes/performance`);
    return handleResponse(response);
  },

  /**
   * Get merged regime + SPY + VIX data
   * @param limit - Number of days to fetch (default: 365)
   */
  async getMergedMarketData(limit: number = 365): Promise<MergedMarketDataResponse> {
    const response = await fetch(`${API_BASE_URL}/api/market/merged?limit=${limit}`);
    return handleResponse(response);
  },

  // ========== Multi-Index Endpoints ==========

  /**
   * Get list of all available indices
   */
  async getIndicesList(): Promise<IndexInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/indices/list`);
    return handleResponse(response);
  },

  /**
   * Get current regime for a specific index
   * @param symbol - Index symbol (e.g., 'SPY', 'QQQ')
   */
  async getIndexCurrentRegime(symbol: string): Promise<IndexRegime> {
    const response = await fetch(`${API_BASE_URL}/api/indices/${symbol}/current`);
    return handleResponse(response);
  },

  /**
   * Get historical regimes for a specific index
   * @param symbol - Index symbol
   * @param limit - Number of days to fetch (default: 365)
   */
  async getIndexHistory(symbol: string, limit: number = 365): Promise<IndexHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/indices/${symbol}/history?limit=${limit}`);
    return handleResponse(response);
  },

  /**
   * Get current regimes for all indices (comparison view)
   */
  async getIndicesComparison(): Promise<IndexComparison> {
    const response = await fetch(`${API_BASE_URL}/api/indices/comparison`);
    return handleResponse(response);
  },

  /**
   * Get performance metrics by regime for a specific index
   * @param symbol - Index symbol (e.g., 'SPY', 'QQQ')
   */
  async getIndexPerformance(symbol: string): Promise<RegimePerformance[]> {
    const response = await fetch(`${API_BASE_URL}/api/indices/${symbol}/performance`);
    return handleResponse(response);
  },

  /**
   * Get merged regime + price + VIX data for a specific index
   * @param symbol - Index symbol
   * @param limit - Number of days to fetch (default: 365)
   */
  async getIndexMergedData(symbol: string, limit: number = 365): Promise<MergedMarketDataResponse> {
    const response = await fetch(`${API_BASE_URL}/api/indices/${symbol}/merged?limit=${limit}`);
    return handleResponse(response);
  },
};

// ============================================================================
// Custom Data Upload API
// ============================================================================

export const customDataApi = {
  async upload(file: File, datasetName: string): Promise<{ session_id: string; status: string; dataset_name: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("dataset_name", datasetName);
    const ah = await authHeaders();
    const response = await fetch(`${API_BASE_URL}/api/custom/upload`, {
      method: "POST",
      headers: ah,  // no Content-Type — browser sets multipart boundary
      body: form,
    });
    return handleResponse(response);
  },

  async getStatus(sessionId: string): Promise<{ status: string; progress_pct: number; message: string; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/status`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getMeta(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/meta`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async listDatasets(ids: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom/list?ids=${encodeURIComponent(ids)}`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async deleteDataset(sessionId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getOverview(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/overview`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getHistory(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/history`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getTransitions(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/transitions`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getPerformance(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/performance`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getFeatures(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/features`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async getPredictions(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/predictions`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async predictHorizon(sessionId: string, horizon: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/predict?horizon=${horizon}`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },

  async predictTrajectory(sessionId: string, horizon: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/custom/${sessionId}/predict/trajectory?horizon=${horizon}`, {
      headers: await authHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Get regime color by ID
 */
export function getRegimeColor(regimeId: number): string {
  const colors: Record<number, string> = {
    0: '#10b981', // green (Calm)
    1: '#ef4444', // red (Crisis)
    2: '#f59e0b', // orange (Elevated Stress)
    3: '#8b5cf6', // purple (Transition)
  };
  return colors[regimeId] || '#6b7280'; // gray fallback
}

/**
 * Get regime name by ID
 */
export function getRegimeName(regimeId: number): string {
  const names: Record<number, string> = {
    0: 'Calm',
    1: 'Crisis',
    2: 'Elevated Stress',
    3: 'Transition',
  };
  return names[regimeId] || 'Unknown';
}

// ── Backtester types ──────────────────────────────────────────────────────────

export interface EquityCurvePoint {
  date: string;
  value: number;
  benchmark: number;
}

export interface BacktestStats {
  total_return_pct: number;
  cagr_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  calmar_ratio: number;
  win_rate_pct: number;
  num_rebalances: number;
  benchmark_total_return_pct: number;
  benchmark_sharpe: number;
}

export interface RegimeBreakdownItem {
  regime_id: number;
  days: number;
  pct_time: number;
  avg_daily_return_pct: number;
  total_contribution_pct: number;
}

export interface BacktestResult {
  equity_curve: EquityCurvePoint[];
  stats: BacktestStats;
  regime_breakdown: RegimeBreakdownItem[];
  rebalance_dates: string[];
  tickers_used: string[];
  date_range: { start: string; end: string };
}

export interface BacktestApiRequest {
  allocations: Record<string, Record<string, number>>;
  transaction_cost_bps: number;
  start_date?: string | null;
  end_date?: string | null;
}

// ── Backtester API ────────────────────────────────────────────────────────────

export const backtesterApi = {
  async runBacktest(req: BacktestApiRequest): Promise<BacktestResult> {
    const response = await fetch(`${API_BASE_URL}/api/backtester/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return handleResponse<BacktestResult>(response);
  },
};

const apiWithCustomData = { ...api, customData: customDataApi };
export default apiWithCustomData;
