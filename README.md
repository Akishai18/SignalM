# Market Regime Detection & Prediction System

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

## 📖 Overview

**Market Regime** is a full-stack quantitative finance application that identifies distinct market states (Calm, Crisis, Elevated Stress, Transition) from historical equity data and predicts future regime transitions using machine learning. Built with Python, TypeScript, and modern ML frameworks, this system provides real-time regime analysis through an interactive web dashboard backed by a production-ready REST API.

The platform analyzes 500+ S&P 500 constituents (2012-2024) to extract market structure features—realized volatility, cross-sectional correlation, PCA-based dimensionality—and uses unsupervised learning (K-means) to categorize regimes. Four prediction models (Markov chains, Hidden Markov Models, Random Forest, XGBoost) forecast regime transitions at 1-day, 7-day, and 30-day horizons with comprehensive accuracy validation.

**Live Demo:** *(Deployment in progress)*
**API Docs:** http://localhost:8000/docs (when running locally)

---

## 🎯 Key Features

### **End-to-End ML Pipeline**
- ✅ Automated data processing for 500+ equities (2012-2024)
- ✅ Feature engineering: volatility, correlation, PCA metrics
- ✅ Unsupervised regime detection (K-means, K=4)
- ✅ 4 prediction models with honest accuracy evaluation
- ✅ Chronological train/test validation (no data leakage)

### **Production-Ready Backend**
- ✅ FastAPI REST API (10 endpoints)
- ✅ Real-time regime state & predictions
- ✅ Model comparison metrics
- ✅ CORS-enabled for frontend integration
- ✅ Comprehensive error handling

### **Interactive Frontend Dashboard**
- ✅ React + TypeScript with shadcn/ui components
- ✅ Live regime visualization & metrics
- ✅ Model performance comparison table
- ✅ Multi-horizon forecast display
- ✅ Auto-refreshing data (30-60s intervals)

### **Rigorous Evaluation**
- ✅ 99.54% accuracy (Markov baseline)
- ✅ 91.06% accuracy (Random Forest, feature-only)
- ✅ Comprehensive FINDINGS.md analysis
- ✅ 10 prediction visualizations (confusion matrices, timelines)

---

## 🛠 Tech Stack

### **Backend (Python)**
- **Core:** Python 3.9+, NumPy, Pandas
- **ML:** scikit-learn, XGBoost, hmmlearn
- **API:** FastAPI, Uvicorn, Pydantic
- **Analysis:** SciPy, UMAP, Matplotlib, Seaborn

### **Frontend (TypeScript)**
- **Framework:** React 18, TypeScript 5.0, Vite
- **UI:** shadcn/ui, Radix UI, Tailwind CSS
- **Data:** TanStack Query (React Query)
- **Charts:** Recharts
- **Routing:** React Router v6

### **Infrastructure**
- **API Server:** FastAPI + Uvicorn
- **Dev Server:** Vite (HMR)
- **Data Storage:** CSV files (regime_results/)
- **Future:** PostgreSQL, AWS deployment

---

## 🚀 Quick Start

### **Prerequisites**
```bash
# Python 3.9+ and Node.js 18+ required
python --version  # Should be 3.9+
node --version    # Should be 18+
```

### **1. Clone Repository**
```bash
git clone https://github.com/yourusername/market-regime.git
cd market-regime
```

### **2. Backend Setup**
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run regime detection (first time only, ~2-3 minutes)
PYTHONPATH=src python src/regime/run_regime_clustering.py

# Start API server
uvicorn api.main:app --reload --port 8000
```

**Verify:** http://localhost:8000/api/health should return `{"status":"healthy"}`

### **3. Frontend Setup**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Access:** http://localhost:5173 (or http://localhost:8080)

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CSV Data (2012-2024)                     │
│                 500+ S&P 500 Constituents                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Feature Engineering Pipeline                    │
│  - Rolling volatility (252d)                                │
│  - Cross-sectional correlation                              │
│  - PCA eigenvalues & variance explained                     │
│  - Effective dimension (eigenvalue concentration)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Unsupervised Regime Detection (K=4)               │
│  - K-means clustering on normalized features                │
│  - Regimes: Calm, Crisis, Elevated Stress, Transition       │
│  - Validation: persistence, UMAP, economic monotonicity     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Prediction Models (4 methods)                   │
│  1. Markov Chain Baseline (99.54% accuracy)                 │
│  2. Hidden Markov Model (86.33% feature-inferred)           │
│  3. Random Forest (91.06% feature-only)                     │
│  4. XGBoost (81.81% feature-only)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (10 endpoints)              │
│  /api/regimes/current    - Current regime state             │
│  /api/regimes/history    - Historical timeline              │
│  /api/predictions/forecast - 1/7/30-day predictions         │
│  /api/predictions/comparison - Model rankings               │
│  /api/metrics/summary    - Dashboard metrics                │
│  /api/features/importance - Feature rankings                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            React Dashboard (localhost:5173)                  │
│  - Live regime state & confidence                           │
│  - Model comparison table                                   │
│  - Multi-horizon forecasts                                  │
│  - Feature importance charts                                │
│  - Correlation heatmaps                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧮 Regime Detection Methodology

### **Feature Space (6 dimensions)**

| Feature | Description | Formula |
|---------|-------------|---------|
| **avg_vol_252** | Realized volatility (annualized) | σ = √(252 × Var(R)) |
| **vol_dispersion** | Cross-sectional volatility spread | std(σ₁, σ₂, ..., σₙ) |
| **avg_correlation** | Mean pairwise correlation | avg(ρᵢⱼ) for i≠j |
| **pc1_var** | PC1 variance explained | λ₁ / Σλᵢ |
| **cum_var_3** | Cumulative variance (PC1-3) | (λ₁+λ₂+λ₃) / Σλᵢ |
| **effective_dimension** | Eigenvalue concentration | exp(-Σ pᵢlog(pᵢ)) |

Where:
- **R** = daily log returns
- **σᵢ** = volatility of asset i
- **ρᵢⱼ** = correlation between assets i and j
- **λᵢ** = i-th eigenvalue from PCA
- **pᵢ** = normalized eigenvalue (λᵢ / Σλⱼ)

### **Identified Regimes**

| Regime | Label | % of Time | Mean Duration | Characteristics |
|--------|-------|-----------|---------------|-----------------|
| **0** | Calm | 61% | 285 days | Low vol (0.24), low corr (0.28), high dim (4.9) |
| **1** | Crisis | 5% | 156 days | High vol (0.35), high corr (0.45), low dim (3.8) |
| **2** | Elevated Stress | 17% | 142 days | Medium vol (0.28), medium corr (0.35) |
| **3** | Transition | 17% | 135 days | Mixed characteristics, regime shifts |

**Key Finding:** Regimes are highly persistent (280+ day mean duration) with only 15 transitions in 3,264 trading days, creating a fundamental prediction challenge.

---

## 🎯 Prediction Model Results

**Test Period:** 2021-2024 (30% holdout, chronological split)

### **1-Day Horizon Accuracy**

| Rank | Model | Accuracy | Confidence | Why It Works / Fails |
|------|-------|----------|------------|---------------------|
| 🥇 1 | **Markov Chain** | 99.54% | 99.54% | Regimes persist → "predict same" works |
| 🥈 2 | **Random Forest** | 91.06% | 76.65% | Learns from vol dispersion + PCA |
| 🥉 3 | **HMM** | 86.33% | 96.86% | Feature inference harder than labels |
| 4 | **XGBoost** | 81.81% | 88.31% | Overfits on rare regimes (Crisis) |

### **Key Insights from FINDINGS.md**

✅ **Markov baseline is surprisingly effective** due to high regime persistence (280+ day duration)
✅ **Feature-based signals exist** but add only modest value beyond "predict same regime"
✅ **Volatility dispersion** (12.1% importance) and **PCA concentration** (7.8%) are top predictors
✅ **Lagged features** (5-day, 21-day) outperform 1-day lags for detecting regime transitions
⚠️ **Rare regimes hard to predict:** Elevated Stress only 77% avg accuracy (only 7 test samples)

### **Multi-Horizon Performance**

| Horizon | Markov | HMM | Random Forest | XGBoost |
|---------|--------|-----|---------------|---------|
| 1-day   | 99.54% | 86.33% | 91.06% | 81.81% |
| 7-day   | 95.99% | ~92% | 83.21% | 84.76% |
| 30-day  | 92.32% | ~89% | 83.30% | 76.87% |

---

## 📂 Project Structure

```bash
market-regime/
├── api/                           # FastAPI backend
│   ├── main.py                    # API application (10 endpoints)
│   ├── routes/                    # Route modules
│   └── test_api.py                # API testing script
│
├── frontend/                      # React dashboard
│   ├── src/
│   │   ├── pages/                 # Page components
│   │   │   ├── Index.tsx          # Dashboard home
│   │   │   ├── PredictionsPage.tsx # Model comparison
│   │   │   ├── CorrelationPage.tsx
│   │   │   ├── VolatilityPage.tsx
│   │   │   └── FactorsPage.tsx
│   │   ├── components/
│   │   │   ├── dashboard/         # Dashboard components
│   │   │   ├── predictions/       # Prediction components
│   │   │   └── ui/                # shadcn/ui components
│   │   ├── hooks/
│   │   │   └── useRegimeData.ts   # TanStack Query hooks
│   │   ├── lib/
│   │   │   └── api.ts             # API client
│   │   └── App.tsx                # Router config
│   ├── package.json
│   └── vite.config.ts
│
├── src/                           # Python ML pipeline
│   ├── regime/
│   │   ├── run_regime_clustering.py  # Main clustering pipeline
│   │   ├── feature_engineering.py    # Feature computation
│   │   ├── evaluate.py               # Clustering evaluation
│   │   ├── visualize_regimes.py      # Regime visualizations
│   │   ├── transitions.py            # Transition analysis
│   │   ├── predict.py                # Markov baseline
│   │   ├── hmm_predict.py            # HMM predictions
│   │   ├── feature_predict.py        # RF/XGBoost predictions
│   │   ├── evaluate_predictions.py   # Model comparison
│   │   └── compare_predictions.py    # Unified evaluation
│   ├── analyze.py                 # Statistical computations
│   ├── display.py                 # Console output
│   ├── visualize.py               # EDA plots
│   └── main.py                    # Pipeline orchestration
│
├── data/                          # Raw data
│   ├── sp500_stocks.csv           # Historical prices
│   ├── sp500_companies.csv        # Company metadata
│   └── sp500_index.csv            # Index data
│
├── regime_results/                # Output artifacts
│   ├── regime_labels_k4.csv       # Regime assignments
│   ├── regime_features_normalized.csv
│   ├── clustering_evaluation.csv
│   ├── prediction_visualizations/ # 10 model viz PNGs
│   └── regime_transition_analysis/
│
├── pca_data/                      # PCA results
│   ├── pca_components.csv
│   └── pca_loadings.csv
│
├── requirements.txt               # Python dependencies
├── FINDINGS.md                    # Comprehensive results analysis
├── API_README.md                  # API documentation
├── INTEGRATION_COMPLETE.md        # Frontend integration guide
├── PHASE_4_COMPLETE.md            # Prediction dashboard docs
└── README.md                      # This file
```

---

## 🔬 Mathematical Foundation

### **Covariance & Correlation**

Rolling covariance matrix **Σ** over window **W**:

```
Σ_W = (1/(W-1)) × Σ(t=1 to W) [(R_t - R̄)(R_t - R̄)ᵀ]
```

Correlation matrix provides scale-invariant co-movement metrics.

### **Principal Component Analysis (PCA)**

Eigenvalue decomposition of correlation matrix **C**:

```
C × v = λ × v
```

Where:
- **v** = eigenvector (factor loadings)
- **λ** = eigenvalue (variance explained)

**Interpretation:**
- High **λ₁** → correlated "risk-on/risk-off" market
- Rising PC1 ratio → increasing systemic risk

### **Effective Dimension (Participation Ratio)**

Eigenvalue concentration metric:

```
D_eff = exp(-Σ pᵢ log(pᵢ))
```

Where **pᵢ = λᵢ / Σλⱼ** (normalized eigenvalues)

**Interpretation:**
- **D_eff = N** → perfect diversification (all eigenvalues equal)
- **D_eff = 1** → one dominant factor (systemic crisis)

---

## 📈 API Endpoints

### **Regime State**
```bash
GET /api/regimes/current
# Returns: Current regime (Calm/Crisis/etc.), confidence, days in regime

GET /api/regimes/history?limit=1000
# Returns: Historical regime labels with dates
```

### **Predictions**
```bash
GET /api/predictions/forecast
# Returns: 1/7/30-day predictions with probabilities

GET /api/predictions/comparison
# Returns: All 4 models ranked by accuracy
```

### **Analytics**
```bash
GET /api/metrics/summary
# Returns: Correlation, volatility, dimension metrics

GET /api/features/importance?model=random_forest&top_n=10
# Returns: Top feature importances
```

**Full API Docs:** http://localhost:8000/docs (Swagger UI)

---

## 🎨 Dashboard Features

### **Main Dashboard** (`/`)
- Current regime state (Calm, Crisis, etc.)
- Real-time metrics (correlation, volatility, dimension)
- Regime confidence gauge
- Correlation heatmap
- Top feature importances

### **Predictions Page** (`/predictions`)
- Model comparison table (4 models ranked)
- Multi-horizon forecast cards (1/7/30 days)
- Regime probability distributions
- Key insights from analysis

### **Future Pages**
- Correlation: Time-series correlation analysis
- Volatility: Regime-conditioned volatility
- Factors: PCA loadings visualization

---

## ✅ Completed Features

- [x] **Data Pipeline:** Automated ETL with validation
- [x] **Feature Engineering:** Volatility, correlation, PCA metrics
- [x] **Regime Detection:** K-means clustering (K=4)
- [x] **Validation:** Persistence, UMAP, economic monotonicity
- [x] **Transition Analysis:** Transition matrix, stability metrics
- [x] **Prediction Models:** Markov, HMM, RF, XGBoost
- [x] **Model Evaluation:** Chronological validation, accuracy metrics
- [x] **FastAPI Backend:** 10 REST endpoints
- [x] **React Frontend:** Dashboard + Predictions page
- [x] **Integration:** Frontend ↔ Backend data flow
- [x] **Visualizations:** 10 prediction charts (confusion matrices, timelines)
- [x] **Documentation:** FINDINGS.md, API docs, README

---

## 🚧 In Progress

- [ ] **Prediction Timeline Charts:** Historical predicted vs actual
- [ ] **Confusion Matrix Heatmaps:** Per-model classification errors
- [ ] **Confidence Over Time:** Model uncertainty tracking
- [ ] **Real-Time Data:** Live streaming via Alpha Vantage/Polygon.io
- [ ] **Data Upload:** CSV upload + trigger regime analysis

---

## 🔮 Roadmap

### **Phase 5: Advanced Visualizations**
- [ ] Prediction timeline (Recharts line chart)
- [ ] Interactive confusion matrices
- [ ] Confidence over time charts
- [ ] Per-regime breakdown visualizations

### **Phase 6: Production Deployment**
- [ ] AWS/Vercel deployment
- [ ] PostgreSQL database (historical predictions)
- [ ] Redis caching layer
- [ ] User authentication (Auth0)
- [ ] Rate limiting & monitoring

### **Phase 7: SaaS Features**
- [ ] Email alerts on regime transitions
- [ ] Webhook integrations
- [ ] API subscription tiers
- [ ] Backtesting framework
- [ ] Custom universes (beyond S&P 500)

---

## 📚 Theoretical Background

This project applies concepts from:
- **Modern Portfolio Theory (MPT):** Markowitz optimization
- **Factor Models:** Fama-French, APT
- **Time-Series Econometrics:** Structural breaks, regime switching
- **Multivariate Statistics:** PCA, correlation analysis
- **Machine Learning:** K-means, Random Forest, XGBoost, HMM

### Recommended Reading
- *Active Portfolio Management* by Grinold & Kahn
- *Machine Learning for Asset Managers* by Marcos López de Prado
- *Advances in Financial Machine Learning* by Marcos López de Prado
- *Quantitative Equity Portfolio Management* by Qian, Hua & Sorensen

---

## 🧪 Testing

### **Backend Tests**
```bash
# Test API endpoints
python api/test_api.py

# Test regime clustering
PYTHONPATH=src python src/regime/run_regime_clustering.py

# Test prediction comparison
PYTHONPATH=src python src/regime/compare_predictions.py
```

### **Frontend Tests**
```bash
cd frontend
npm run build        # Production build
npm run preview      # Preview production build
```

---

## ⚖️ Disclaimer

This project is for **educational and research purposes only**.

It utilizes historical data to explore quantitative finance concepts. This tool is **NOT**:
- Investment advice or recommendations
- A trading signal generator
- A guarantee of future performance
- Suitable for live trading without extensive testing

**Always consult with qualified financial professionals before making investment decisions.**

---

## 🤝 Contributing

Contributions welcome! Please feel free to:
- Report bugs via GitHub Issues
- Submit pull requests for new features
- Improve documentation
- Add new prediction models
- Optimize performance

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 👤 Author

**Akishai**

Building quantitative finance tools that bridge machine learning and market analysis.

For questions or collaboration: [Open an issue](https://github.com/yourusername/market-regime/issues)

---

## 🙏 Acknowledgments

- S&P 500 data from publicly available sources
- shadcn/ui for React components
- FastAPI team for excellent API framework
- scikit-learn, XGBoost, hmmlearn contributors

---

**⭐ Star this repo if you find it useful!**

