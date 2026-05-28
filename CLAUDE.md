# SignalM — Claude Context

## Project
Full-stack quantitative market regime detection & prediction platform.
Pipeline: Data ingestion → Feature engineering → K-Means clustering → REST API → React dashboard

## Architecture
- **ML Pipeline** (`src/`): Python, NumPy, Pandas, scikit-learn, XGBoost, hmmlearn
- **API** (`api/`): FastAPI, `main.py` entry, routers in `api/routers/` (backtester, correlations, custom_data, pca, predictions, refresh_status)
- **Frontend** (`frontend/`): React 18 + TypeScript + Vite, port 8080, shadcn/ui, TanStack Query
- **Data**: 500+ S&P 500 stocks (2012–2024), sector ETFs, VIX; precomputed JSON in `precomputed/`

## Frontend Pages (`frontend/src/pages/`)
- `Index.tsx` — main dashboard
- `PredictionsPage.tsx` / `PredictionsPageNew.tsx` — regime predictions
- `CorrelationPage.tsx` — sector correlations
- `VolatilityPage.tsx` — volatility analysis
- `FactorsPage.tsx` — PCA factors
- `UploadPage.tsx` — custom data upload
- `DatasetDashboardPage.tsx` — custom dataset analysis (5 tabs)
- `BacktesterPage.tsx` — strategy backtester
- `AuthPage.tsx` — login/signup
- `SettingsPage.tsx` — user settings
- `PreviewEntryPage.tsx` — preview/guest entry

## Core ML
- K-Means K=4 regimes: Calm (61%), Crisis (5%), Elevated Stress (17%), Transition (17%)
- 4 prediction models: Markov Chain, HMM, Random Forest, XGBoost
- Features: rolling volatility, correlation, PCA metrics (6 dimensions)
- Regimes highly persistent (~280+ day mean duration)
- Chronological 70/30 train/test split (no data leakage)

## Known Issues / History
- Markov chain data leakage fixed: 99.54% → ~48% realistic accuracy (see `ACCURACY_FIX.md`)
- Branch `whatif` has what-if scenario analysis feature (not yet merged)

## Current Branch
`more-improvements` (branched from `main`)

## Recent Work (as of 2026-04-03)
- **data page updates** (Apr 2): Overhauled all 5 custom dataset dashboard tabs — CustomFactorsTab, CustomPerformanceTab, CustomPredictionsTab, CustomRegimeHistoryTab, CustomRegimeOverviewTab. Also updated `api/utils/file_parser.py`.
- **backtest updates** (Mar 28): Refactored BacktestConfigurator and BacktestSummaryCards components.
- **prediction updates** (Mar 28): Updated CustomHorizonPredictor, added `frontend/src/lib/ensemble.ts`, refactored PredictionsPageNew.
- **route improvements** (Mar 28): Added/updated `frontend/vercel.json` routing rules.
- **auth page improvements** (Mar 27): Major overhaul of `AuthPage.tsx` (login/signup UI).

## Memory Rule
Whenever Claude updates the memory files in `.claude/projects/.../memory/`, it must also update this file to stay in sync.
