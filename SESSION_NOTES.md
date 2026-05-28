# SignalM — Full Project Notes

## What It Is
Full-stack quantitative market regime detection & prediction platform.
Pipeline: Data ingestion → Feature engineering → K-Means clustering → REST API → React dashboard

Live at: **signalm.ca**
Preview link (no account): **signalm.ca/preview/sm2026**

---

## Architecture

### ML Pipeline (`src/`)
- Python, NumPy, Pandas, scikit-learn, XGBoost, hmmlearn
- K-Means K=4 regimes: Calm (61%), Crisis (5%), Elevated Stress (17%), Transition (17%)
- Features: rolling volatility, cross-sectional correlation, PCA metrics (6 dimensions)
- Regimes highly persistent (~280+ day mean duration)
- Chronological 70/30 train/test split — no data leakage
- 4 prediction models: Markov Chain, HMM, Random Forest, XGBoost
- Multi-horizon forecasting: 1, 7, 30 days

### API (`api/`)
- FastAPI, entry at `api/main.py`
- Routers: `backtester`, `correlations`, `custom_data`, `pca`, `predictions`, `refresh_status`
- Auth via Supabase JWT — `api/dependencies/auth.py`
- Storage abstraction via `api/utils/storage.py` (Supabase Storage bucket: "Datasets")
- Custom data pipeline: `api/utils/custom_pipeline.py`

### Frontend (`frontend/`)
- React 18 + TypeScript + Vite, port 8080
- shadcn/ui components, TanStack Query for data fetching
- Auto-refresh 30–60s intervals

### Frontend Pages (`frontend/src/pages/`)
- `Index.tsx` — main dashboard
- `PredictionsPage.tsx` / `PredictionsPageNew.tsx` — regime predictions
- `CorrelationPage.tsx` — sector correlations
- `VolatilityPage.tsx` — volatility analysis
- `FactorsPage.tsx` — PCA factors
- `UploadPage.tsx` — custom data upload + dataset list
- `DatasetDashboardPage.tsx` — custom dataset analysis (5 tabs: Overview, RegimeHistory, Predictions, Performance, Factors)
- `BacktesterPage.tsx` — strategy backtester
- `AuthPage.tsx` — login/signup
- `SettingsPage.tsx` — user settings
- `PreviewEntryPage.tsx` — `/preview/sm2026` magic link, enters demo mode

### Data
- 500+ S&P 500 stocks (2012–2024), sector ETFs, VIX
- Precomputed JSON in `precomputed/`

---

## Deployment

| Layer | Platform | Env Vars |
|-------|----------|----------|
| Frontend | Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD`, `VITE_API_URL` |
| Backend | Render | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

- `SUPABASE_SERVICE_KEY` must be the **service_role** key (not anon key) from Supabase → Settings → API

---

## Custom Dataset System
Users upload CSV/Excel/JSON → backend runs full regime detection pipeline → results stored in Supabase Storage.

**Storage path layout:**
```
{session_id}/raw/original_upload.{ext}
{session_id}/results/analysis_status.json
{session_id}/results/dataset_meta.json
{session_id}/results/regime_labels.csv
{session_id}/results/regime_features.csv
{session_id}/results/regime_label_map.json
{session_id}/results/transition_matrix.json
{session_id}/results/regime_stats.json
{session_id}/results/predictions.json
users/{user_id}/dataset_index.json   ← per-user index for O(1) listing
```

Ownership enforced via `user_id` in `dataset_meta.json`. All endpoints require auth.

---

## Known History / Notable Fixes

- **Markov chain data leakage** — model hit 99.54% accuracy due to contaminated train/test split. Fixed to ~48% realistic with chronological split. Documented in `ACCURACY_FIX.md`.
- **Branch `whatif`** — what-if scenario analysis feature, not yet merged to main.

---

## Git Branches (notable)
- `main` — production
- `more-improvements` — current working branch
- `whatif` — what-if scenario analysis (unmerged)

---

## Recent Work Log

### April 2026 (this session)
- **Cross-device dataset persistence** — datasets now stored in Supabase via per-user index, not localStorage. Any device/browser shows full history on login.
- **Upload auth fix** — added proper error logging to `get_current_user`, force-refresh token if expiring within 60s (`supabase.ts`)
- **Performance fix** — dataset listing was O(N) bucket scan, now O(1) index read

### April 3, 2026
- **data page updates** — Overhauled all 5 custom dataset dashboard tabs + `api/utils/file_parser.py`

### March 28, 2026
- **backtest updates** — Refactored BacktestConfigurator and BacktestSummaryCards
- **prediction updates** — Updated CustomHorizonPredictor, added `frontend/src/lib/ensemble.ts`, refactored PredictionsPageNew
- **route improvements** — Updated `frontend/vercel.json`

### March 27, 2026
- **auth page improvements** — Major overhaul of `AuthPage.tsx`
- **auth/admin** — Admin and guest pages, auth flow

---

## Commands

```bash
# Run backend locally
uvicorn api.main:app --reload --port 8000

# Run frontend locally
cd frontend && npm run dev

# Run ML pipeline
PYTHONPATH=src python src/regime/run_regime_clustering.py
```

---

## LinkedIn Post (Final Draft)

```
Three months in. SignalM is live.

Over the last three months, I've been building SignalM, a quantitative platform and 
forecasting tool that enables users to anticipate market shifts and make decisions 
using their own proprietary investment data.

Markets may seem pseudo-random, but beneath that noise there is structure. They are 
systems that move in regimes, repeating states with patterns that can be identified, 
anticipated, and acted on. Institutional desks have entire quant teams dedicated to 
identifying these states and positioning around them. Independent investors and 
portfolio managers don't have that. SignalM changes that.

Under the hood, it runs an unsupervised ML pipeline with PCA-based feature 
engineering, and statistical models such as Hidden Markov Models, forecasting regime 
transitions at multiple time horizons. I built a custom data pipeline that lets users 
upload their own investment data and run the full regime forecasting pipeline on it — 
your data, your signals.

I've learned more from this project than the last 8 months combined. From 
understanding how HMMs actually learn through the Baum–Welch algorithm, to realizing 
that transition matrices carry much more than just probabilities, and how quantitative 
modelling as a whole is about understanding uncertainty and building systems that 
operate within it.

Now live — check it out:
signalm.ca/preview/sm2026

This is only the start. I'll be continuing to build and scale SignalM — and I'm 
already working on something else. Stay tuned.
```
