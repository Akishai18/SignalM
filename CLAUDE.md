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
- Markov evaluation fixed to use a train-only transition matrix on the held-out 30% (see `docs/ACCURACY_FIX.md`). Saved test accuracy is still ~99.8% because regimes persist; HMM is the ~48% model.
- Branches `whatif` and `more-improvements` are fully merged into main (verified 2026-09-10)
- Git history rewritten 2026-09-11 (`git-filter-repo`): 61 commit messages reworded, one empty commit pruned, root reorganized (AWS scripts in `scripts/aws/`, `ACCURACY_FIX.md` in `docs/`, `.env.example` template). File contents unchanged; commit hashes from before that date no longer resolve.

## Key Architecture Facts (full-repo audit 2026-09-10)
- **Two regime label systems.** Market-wide K4 labels (`regime_results/regime_labels_k4.csv`, 500-stock features, frozen 2024-12-20, mean durations 135-285d) feed `/api/regimes/*`, `/api/pca/*`, model training, and precomputed predictions. Per-index labels (`regime_results/indices/*_regimes.csv`, single-ticker vol/momentum/RSI features, refit daily) feed `/api/indices/*`, the backtester, volatility page, correlation overlay, and transitions. SPY per-index Calm lasts ~15d on average. Per-index cluster ids can permute after a refit; names come from a fixed id→name dict.
- **Frozen vs live.** Models (26 pkl per index: Markov, HMM, RF and XGB at 11 horizons) and `precomputed/*_predictions|_backtest|_trajectory|_accuracy|pca_structure` were generated Feb 25 to Mar 1 2026 on data through 2024-12-20 and are never refreshed. Daily refresh only updates index regimes, transitions, sector correlations, and `regime_with_market_data.csv`.
- **Ensemble.** Backend weights 25% each incl. Markov; frontend `lib/ensemble.ts` reweights HMM 70 / RF 15 / XGB 15 and hides Markov on the Predictions page.
- **Custom uploads** run fresh K-Means with volatility-ranked regime names, Markov-only predictions (1-D HMM if >= 252 rows), stored in Supabase bucket `Datasets`.
- **Timeline.** Research only Dec 23 2025 to Feb 18 2026 (EDA → PCA → UMAP → K-Means → validation → transitions → Markov/HMM). App from Feb 21 2026 (API + Lovable frontend), predictions Feb 26-28, correlations Mar 1, volatility/PCA pages Mar 14, upload Mar 18, backtester Mar 20, live refresh Mar 22, auth Mar 25-27, mobile May 27, AWS Aug 18-30.

## Current Branch
`main`

## Deployment
- **Frontend:** Vercel; resolves backend via `VITE_API_URL` env var (`frontend/src/lib/api.ts`)
- **Backend:** **AWS Lightsail Containers** (`signalm-api`, nano $7/mo; Aug 2026). `Dockerfile` at root, deployed by `.github/workflows/deploy_api.yml` (build → ECR → `lightsail create-container-service-deployment`, OIDC auth). Chosen over ECS Express (~$50/mo ALB overhead) and App Runner (closed to new customers Apr 2026). Guide: `docs/AWS_DEPLOY.md`
- **Data refresh:** `.github/workflows/daily_refresh.yml` commits fresh data weekday mornings, then calls `deploy_api.yml` via workflow_call (GITHUB_TOKEN pushes don't trigger `on: push`) — the redeploy is what serves new data
- API env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Recent Work (as of 2026-08-18)
- **AWS migration prep** (Aug 18): Added `Dockerfile`, `.dockerignore`, `.github/workflows/deploy_api.yml`, `docs/AWS_DEPLOY.md`; chained deploy into `daily_refresh.yml`.

## Earlier Work (2026-04-03)
- **data page updates** (Apr 2): Overhauled all 5 custom dataset dashboard tabs — CustomFactorsTab, CustomPerformanceTab, CustomPredictionsTab, CustomRegimeHistoryTab, CustomRegimeOverviewTab. Also updated `api/utils/file_parser.py`.
- **backtest updates** (Mar 28): Refactored BacktestConfigurator and BacktestSummaryCards components.
- **prediction updates** (Mar 28): Updated CustomHorizonPredictor, added `frontend/src/lib/ensemble.ts`, refactored PredictionsPageNew.
- **route improvements** (Mar 28): Added/updated `frontend/vercel.json` routing rules.
- **auth page improvements** (Mar 27): Major overhaul of `AuthPage.tsx` (login/signup UI).

## Memory Rule
Whenever Claude updates the memory files in `.claude/projects/.../memory/`, it must also update this file to stay in sync.
