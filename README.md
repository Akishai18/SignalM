# Market Regime & Risk Factor Analyzer

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Active%20Development-orange)

## 📖 Overview
The **Market Regime & Risk Factor Analyzer** is a quantitative research engine designed to deconstruct U.S. equity market behavior. By processing raw S&P 500 constituent data, the system identifies **latent market regimes** (low volatility/bull, high volatility/bear, transition) and quantifies shifting risk factors.

This tool bridges the gap between **raw financial data** and **actionable risk insights**, utilizing linear algebra and statistical modeling to track how correlation structures, volatility patterns, and factor dominance evolve over time.

---

## 🎯 Core Objectives

1. **Data Transformation & Alignment**  
   Convert raw price data into a clean, synchronized return matrix suitable for quantitative analysis

2. **Risk Quantification**  
   Measure market risk through rolling volatility, cross-sectional dispersion, and correlation dynamics

3. **Factor Analysis**  
   Extract dominant risk factors using PCA and track their explanatory power over time

4. **Regime Identification**  
   Detect structural changes in market behavior via statistical and linear-algebraic signals

5. **Extensible Architecture**  
   Build a modular backend suitable for interactive visualization and user-facing analytical tools

---

## 🛠 Tech Stack

* **Core:** Python 3.9+, NumPy, Pandas
* **Statistical Analysis:** SciPy, Scikit-Learn (PCA, Decomposition)
* **Visualization:** Matplotlib, Seaborn
* **Data Processing:** Vectorized operations for high-performance matrix manipulation
* **Future:** React/Next.js frontend for interactive dashboards

---

## 📊 Data Structure

The project uses historical S&P 500 data consisting of:

- **Individual stock prices** (Adjusted Close, OHLC, volume)
- **Index-level S&P 500 prices** for benchmark comparison
- **Company metadata** (sector, industry, market cap classifications)

### Data Transformation Pipeline

Raw data is reshaped into structured matrices:

**Price Matrix:**
$$
P_{t,i} \in \mathbb{R}^{T \times N}
$$
Where $T$ = time periods, $N$ = number of assets

**Log Return Matrix:**
$$
R_{t,i} = \ln(P_{t,i}) - \ln(P_{t-1,i})
$$

This transformation ensures:
- Stationarity for time-series analysis
- Additive properties across time periods
- Normalization of price scales across assets

---

## 🚀 Current Pipeline

### 1. **Data Ingestion & Validation**
- Load raw CSV files (stocks, companies, index data)
- Validate data integrity and format consistency
- Report loading statistics and data dimensions

### 2. **Data Cleaning & Structuring**
- Remove malformed and missing observations
- Handle edge cases (zero prices, gaps, outliers)
- Pivot stock prices into time × asset matrix
- Align timestamps across all assets

### 3. **Return Space Transformation**
- Compute log returns for all assets
- Generate first-order return statistics
- Identify and report dropped observations

### 4. **Exploratory Diagnostics**
- **Distribution Analysis:** Mean returns, volatility, skewness, kurtosis
- **Missing Data Patterns:** Visualize data completeness across time and assets
- **Summary Statistics:** Generate comprehensive descriptive metrics

### 5. **Rolling Risk Analytics**
Compute time-varying metrics over multiple horizons:
- **Volatility** (annualized standard deviation)
- **Correlation matrices** (asset co-movement)
- **Cross-sectional statistics** (market-wide dispersion)

### 6. **Visualization Suite**
- Distribution plots (histograms, Q-Q plots)
- Volatility clustering detection
- Correlation spike analysis
- Rolling statistics dashboards

---

## ⏱️ Rolling Time Windows

Rolling statistics are computed over standard market horizons:

| Window | Trading Days | Period | Use Case |
|--------|--------------|--------|----------|
| **21 days** | ~1 month | Short-term | Tactical risk management |
| **63 days** | ~1 quarter | Medium-term | Earnings cycle analysis |
| **252 days** | ~1 year | Long-term | Strategic positioning |

These windows enable analysis of:
- **Volatility clustering:** Periods of high/low market turbulence
- **Correlation structure:** Evolution of asset relationships
- **Factor stability:** Persistence of dominant risk drivers

---

## 🧮 Quantitative Methodology

### 1. Covariance & Correlation Analysis

To understand market structure, we compute the rolling covariance matrix $\Sigma$ over a window $W$:

$$
\Sigma_W = \frac{1}{W-1} \sum_{t=1}^{W} (R_t - \bar{R})(R_t - \bar{R})^T
$$

The corresponding correlation matrix provides scale-invariant co-movement metrics.

### 2. Factor Decomposition via PCA

We solve the eigenvalue problem for the correlation matrix $C$ to identify dominant risk factors:

$$
C v = \lambda v
$$

Where:
- $\lambda$ (eigenvalues) represents variance explained by each principal component
- $v$ (eigenvectors) defines the factor loadings
- High PC1 variance indicates a correlated "risk-on/risk-off" market regime

### 3. Explained Variance Tracking

The proportion of total variance explained by the first $k$ components:

$$
\text{Explained Variance Ratio} = \frac{\sum_{i=1}^{k} \lambda_i}{\sum_{i=1}^{N} \lambda_i}
$$

A rising PC1 ratio suggests increasing market integration and systemic risk.

### 4. Regime Segmentation (In Progress)

Market states are identified through:
- **Volatility thresholds:** Persistent high/low volatility periods
- **Factor dominance:** PC1 explanatory power exceeding historical norms
- **Correlation breakpoints:** Structural changes in asset relationships

---

## 📂 Project Structure

```bash
QUANT-PROJECT-1/
├── data/                      # Raw CSV datasets
│   ├── sp500_stocks.csv       # Historical price data
│   ├── sp500_companies.csv    # Company metadata
│   └── sp500_index.csv        # Index-level data
├── src/                       # Core application code
│   ├── analyze.py             # Statistical computations & transformations
│   ├── display.py             # Console output formatting
│   ├── visualize.py           # Plotting and chart generation
│   └── main.py                # Pipeline orchestration
├── archive/                   # Legacy/backup files
├── notebooks/                 # Jupyter notebooks for EDA
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

---

## ⚡ Usage

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/market-regime-analyzer.git
cd market-regime-analyzer
```

### 2. Set Up Environment
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Analysis Pipeline
```bash
# From project root
python src/main.py

# The pipeline will:
# - Load and clean data
# - Compute statistics
# - Generate visualizations
# - Display results in terminal
```

### 4. Customize Analysis (Optional)
```python
# Modify src/main.py to adjust parameters
results = run_full_analysis(
    base_path="data",
    generate_plots=True,      # Set False to skip visualizations
    save_plots_dir="output"   # Specify directory to save plots
)
```

---

## 🔮 Roadmap & Future Enhancements

### ✅ Completed
- [x] Automated ETL pipeline with data validation
- [x] Log-return transformation and cleaning
- [x] Rolling volatility and correlation metrics
- [x] Distribution analysis and summary statistics
- [x] Visualization suite (distributions, rolling metrics)

### 🚧 In Progress
- [ ] **PCA Implementation:** Extract principal components and track variance ratios over time
- [ ] **Factor Analysis:** Compute factor loadings and identify dominant risk drivers
- [ ] **Regime Detection:** Implement statistical tests for structural breaks

### 🔮 Planned
- [ ] **Eigen-Portfolio Construction:** Build portfolios based on principal components
- [ ] **Hidden Markov Models (HMM):** Automated regime labeling using probabilistic models
- [ ] **K-Means Clustering:** Unsupervised grouping of market states
- [ ] **Interactive Web Dashboard:** React/Next.js frontend for real-time exploration
- [ ] **User-Uploaded Datasets:** Support for custom equity universes
- [ ] **Backtesting Framework:** Test regime-based trading strategies
- [ ] **API Development:** RESTful endpoints for programmatic access

---

## 📈 Key Features

### Automated ETL Pipeline
- Robust data ingestion with validation
- Intelligent handling of missing data
- Timestamp alignment across assets
- Outlier detection and treatment

### Comprehensive Risk Analytics
- **Volatility:** Annualized standard deviation with multiple time horizons
- **Correlation:** Full correlation matrices and average pairwise correlation
- **Skewness & Kurtosis:** Tail risk and distribution shape metrics
- **Cross-sectional Dispersion:** Market-wide return variance

### Advanced Visualization
- **Distribution Plots:** Histograms with normal overlays
- **Volatility Clustering:** Time-series plots with regime highlighting
- **Correlation Heatmaps:** Dynamic relationship tracking
- **Rolling Statistics Dashboard:** Multi-metric overview charts

### Modular Architecture
- Clean separation of concerns (ETL, analysis, visualization)
- Extensible design for adding new metrics
- Configurable parameters for flexible analysis
- Production-ready code structure

---

## 🧪 Example Output

```
==================================================
Loading CSV files...
==================================================
✓ Loaded stocks data: (619,040 rows × 8 columns)
✓ Loaded companies data: (503 rows × 9 columns)
✓ Loaded index data: (1,259 rows × 7 columns)

==================================================
Cleaning and Pivoting Data...
==================================================
Initial rows: 619,040
Rows dropped: 12,384
Remaining rows: 606,656
Unique symbols: 503
Unique dates: 1,259

==================================================
Price Matrix P_{t,i} Summary
==================================================
Shape: (1,259 × 503)
Missing values: 2.3%
Date range: 2013-02-08 to 2018-02-07

...
```

---

## 📚 Theoretical Background

This project applies concepts from:
- **Modern Portfolio Theory (MPT):** Markowitz mean-variance optimization
- **Factor Models:** Fama-French, APT (Arbitrage Pricing Theory)
- **Time-Series Econometrics:** GARCH models, structural breaks
- **Multivariate Statistics:** PCA, correlation analysis
- **Machine Learning:** Unsupervised clustering, dimensionality reduction

### Recommended Reading
- *Active Portfolio Management* by Grinold & Kahn
- *Quantitative Equity Portfolio Management* by Qian, Hua & Sorensen
- *Machine Learning for Asset Managers* by Marcos López de Prado
- *Advances in Financial Machine Learning* by Marcos López de Prado

---

## ⚖️ Disclaimer

This project is for **educational and research purposes only**.

It utilizes historical data to explore mathematical and statistical concepts in quantitative finance. This tool is **NOT**:
- Investment advice or recommendations
- A trading signal generator
- A guarantee of future performance
- Suitable for live trading without extensive testing

**Always consult with qualified financial professionals before making investment decisions.**

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for:
- Bug fixes
- New statistical methods
- Additional visualizations
- Documentation improvements
- Performance optimizations

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👤 Author

**Akishai**  
For questions or collaboration inquiries, please open an issue on GitHub.

---