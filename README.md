# Market Regime & Risk Factor Analyzer

## Overview
This project is a quantitative research and analytics tool designed to study **market structure, risk dynamics, and regime behavior** in U.S. equity markets using S&P 500 constituent data.

The system processes raw equity price data, transforms it into return space, and extracts **rolling risk metrics and latent factors** to analyze how market behavior evolves over time.

---

## Core Objectives
- Convert raw price data into a clean, aligned return matrix  
- Quantify market risk through rolling volatility, correlation, and factor structure  
- Identify changes in market regimes via statistical and linear-algebraic signals  
- Build an extensible backend suitable for interactive visualization and user-facing tools  

---

## Data
The project uses historical S&P 500 data consisting of:
- **Individual stock prices** (Adj Close, OHLC, volume)
- **Index-level S&P 500 prices**
- **Company metadata** (sector, industry, market cap, etc.)

Data is reshaped into:
- **Price matrix**:  
  \[
  P_{t,i} \in \mathbb{R}^{T \times N}
  \]
- **Log return matrix**:  
  \[
  R_{t,i} = \log(P_{t,i}) - \log(P_{t-1,i})
  \]

---

## Current Pipeline
1. Load and validate raw CSV data  
2. Clean missing and malformed observations  
3. Pivot stock prices into a time × asset matrix  
4. Compute log returns  
5. Perform exploratory diagnostics:
   - Return distributions
   - Missing data analysis
6. Compute rolling metrics over multiple horizons

---

## Rolling Time Windows
Rolling statistics are computed over standard market horizons:
- **21 days** — short-term (≈ 1 trading month)
- **63 days** — medium-term (≈ 1 quarter)
- **252 days** — long-term (≈ 1 trading year)

These windows are used to analyze:
- Volatility clustering
- Correlation structure
- Stability of dominant risk factors

---

## Quantitative Methods (Planned & In Progress)
- Rolling volatility & cross-sectional dispersion
- Rolling correlation matrices
- Principal Component Analysis (PCA) on returns
- Explained variance ratios over time
- Regime segmentation using factor dominance
- Comparison of asset-level vs index-level dynamics

---
## Next Steps
- Factor decomposition via rolling PCA
- Market regime labeling
- Interactive visualizations (web UI)
- User-uploaded datasets for custom analysis

---

## Disclaimer
This project is for **educational and research purposes only**.  
It is not intended as investment advice or a trading system.
