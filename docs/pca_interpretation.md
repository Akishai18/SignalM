# 📊 PCA Economic Interpretation Report

*An analysis of the top positive and negative loadings for PC1–PC3, connected to rolling PCA metrics*

---

## 🎯 Key Findings

| Metric | Value | Date |
|--------|-------|------|
| **PC1 Variance Peak** | 52.0% | August 4, 2020 |
| **Minimum Effective Dimension** | 2.686 | July 30, 2020 |

> **Interpretation:** Peak variance concentration on PC1 indicates a highly one-dimensional market (risk-on/off regime). The minimum effective dimension signals a diversification collapse typical of crisis periods.

---

## 📈 Principal Component 1 (PC1)

### Top 20 Positive Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| CCL_vol_252 | 0.2668 | Carnival Corp - 1 year volatility |
| CCL_vol_63 | 0.2310 | Carnival Corp - 3 month volatility |
| CCL_vol_21 | 0.1976 | Carnival Corp - 1 month volatility |
| PARA_vol_252 | 0.1765 | Paramount - 1 year volatility |
| PARA_vol_63 | 0.1539 | Paramount - 3 month volatility |

### Top 20 Negative Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| INCY_vol_252 | -0.1865 | Incyte Corp - 1 year volatility |
| VRTX_vol_252 | -0.1794 | Vertex Pharma - 1 year volatility |
| INCY_vol_63 | -0.1628 | Incyte Corp - 3 month volatility |
| VRTX_vol_63 | -0.1460 | Vertex Pharma - 3 month volatility |
| INCY_vol_21 | -0.1412 | Incyte Corp - 1 month volatility |

### 📊 Feature Composition Analysis

**Positive Loadings:**
- **By Metric:** 🔴 Volatility (17) | 📊 Dispersion (3)
- **By Window:** 📅 252d (8) | 63d (7) | 21d (5)
- **By Sector:** Consumer Cyclical, Communication Services, Technology, Basic Materials, Energy, Financial Services

**Negative Loadings:**
- **By Metric:** 🔴 Volatility (20)
- **By Window:** 📅 252d (9) | 63d (7) | 21d (4)
- **By Sector:** Healthcare (3), Technology (2), Communication Services (2), Consumer Cyclical, Industrials, Energy

### 💡 Economic Interpretation

**PC1: Volatility Regime & Market Stress Factor**

✅ **Key Characteristics:**
- **Volatility-driven factor** — Dominance of volatility features across all time windows
- **Cross-sectional dispersion** — Presence of dispersion features indicates stock-picking vs. index-driven regimes
- **High-vol vs. Low-vol separation** — Positive loadings on high-volatility stocks (travel, entertainment) vs. negative loadings on stable healthcare stocks

🎯 **Market Regime:**
- Captures market-wide stress and volatility spikes
- Separates COVID-impacted sectors (cruise lines, entertainment) from defensive sectors (healthcare, biotech)
- Peak in August 2020 aligns with pandemic volatility

---

## 📈 Principal Component 2 (PC2)

### Top 20 Positive Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| ENPH_vol_252 | 0.3527 | Enphase Energy - 1 year volatility |
| ENPH_vol_63 | 0.2767 | Enphase Energy - 3 month volatility |
| ENPH_vol_21 | 0.2246 | Enphase Energy - 1 month volatility |
| ANET_vol_63 | 0.1344 | Arista Networks - 3 month volatility |
| ANET_vol_252 | 0.1322 | Arista Networks - 1 year volatility |

### Top 20 Negative Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| avg_pairwise_corr_252 | -0.1327 | Average correlation - 1 year |
| HIG_vol_252 | -0.1297 | Hartford Financial - 1 year volatility |
| PHM_vol_252 | -0.1236 | PulteGroup - 1 year volatility |
| FFIV_vol_252 | -0.1162 | F5 Networks - 1 year volatility |
| PHM_vol_63 | -0.1137 | PulteGroup - 3 month volatility |

### 📊 Feature Composition Analysis

**Positive Loadings:**
- **By Metric:** 🔴 Volatility (20)
- **By Window:** 📅 252d (8) | 63d (7) | 21d (5)
- **By Sector:** Technology (3), Healthcare (3), Basic Materials, Energy

**Negative Loadings:**
- **By Metric:** 🔴 Volatility (18) | 🔗 Avg Pairwise Correlation (2)
- **By Window:** 📅 252d (8) | 63d (7) | 21d (5)
- **By Sector:** Financial Services (3), Consumer Cyclical, Technology, Industrials, Communication Services, Healthcare

### 💡 Economic Interpretation

**PC2: Growth vs. Value / Sector Rotation Factor**

✅ **Key Characteristics:**
- **Tech/Energy volatility** — Heavy weighting on renewable energy and technology stocks
- **Negative correlation component** — Inverse relationship with market-wide correlation
- **Growth vs. Defensive separation** — High-growth (tech, clean energy) vs. stable financials and homebuilders

🎯 **Market Regime:**
- Captures growth/value rotation dynamics
- Separates high-beta growth stocks from low-beta value stocks
- Reflects sector-specific momentum and volatility clustering

---

## 📈 Principal Component 3 (PC3)

### Top 20 Positive Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| WMB_vol_252 | 0.2476 | Williams Companies - 1 year volatility |
| WMB_vol_63 | 0.1980 | Williams Companies - 3 month volatility |
| WMB_vol_21 | 0.1681 | Williams Companies - 1 month volatility |
| FCX_vol_63 | 0.1673 | Freeport-McMoRan - 3 month volatility |
| FCX_vol_21 | 0.1593 | Freeport-McMoRan - 1 month volatility |

### Top 20 Negative Loadings

| Feature | Loading | Interpretation |
|---------|---------|----------------|
| META_vol_252 | -0.1453 | Meta Platforms - 1 year volatility |
| META_vol_63 | -0.1316 | Meta Platforms - 3 month volatility |
| META_vol_21 | -0.1090 | Meta Platforms - 1 month volatility |
| FSLR_vol_252 | -0.1077 | First Solar - 1 year volatility |
| EL_vol_252 | -0.1059 | Estée Lauder - 1 year volatility |

### 📊 Feature Composition Analysis

**Positive Loadings:**
- **By Metric:** 🔴 Volatility (18) | 🔗 Avg Pairwise Correlation (1) | 📊 Dispersion (1)
- **By Window:** 📅 252d (8) | 63d (8) | 21d (4)
- **By Sector:** Energy (3), Real Estate (3), Basic Materials, Technology, Industrials

**Negative Loadings:**
- **By Metric:** 🔴 Volatility (20)
- **By Window:** 📅 252d (10) | 63d (6) | 21d (4)
- **By Sector:** Technology (4), Communication Services (3), Consumer Defensive (2), Consumer Cyclical

### 💡 Economic Interpretation

**PC3: Commodities/Real Assets vs. Tech Factor**

✅ **Key Characteristics:**
- **Commodities & Real Assets** — Energy pipelines, mining, real estate dominate positive loadings
- **Market co-movement** — Includes average pairwise correlation (market mode indicator)
- **Cyclical vs. Tech separation** — Traditional cyclicals vs. tech mega-caps

🎯 **Market Regime:**
- Captures commodity cycle and inflation expectations
- Separates "old economy" (energy, materials, real estate) from "new economy" (tech, social media)
- Cyclical vs secular regime, amplified during macro shocks

---

## 🔗 Connection to Rolling PCA Metrics

### 📉 Regime Analysis Using Time Series

**When PC1 Variance Spikes:**
- Market becomes **one-dimensional** (risk-on/off dominates)
- All stocks move together in response to systemic risk
- ⚠️ Check dates near **August 4, 2020** peak

**When Effective Dimension Drops:**
- **Diversification collapse** occurs
- Expect correlation/volatility spikes
- Crisis-like behavior across markets
- ⚠️ Minimum on **July 30, 2020** (COVID crisis period)

**Cumulative Variance (First 3 PCs):**
- High `cum_var_3` → Low market dimensionality
- Few factors explain most variance
- Reduced diversification benefits

---

## 🎓 Summary

This PCA analysis reveals three dominant factors driving S&P 500 dynamics:

1. **PC1: Market Stress & Volatility Regime** (52% variance at peak)
   - Captures systemic risk and volatility spikes
   - Separates COVID-impacted sectors from defensive plays

2. **PC2: Growth vs. Value Rotation**
   - Tech/clean energy vs. traditional financials
   - Sector-specific momentum and style factors

3. **PC3: Commodities vs. Technology**
   - Old economy (energy, materials, real estate) vs. new economy (tech)
   - Inflation/commodity cycle exposure

**Key Insight:** The minimum effective dimension of 2.686 on July 30, 2020, coinciding with PC1's peak, indicates a severe diversification collapse during the pandemic crisis — a period when traditional portfolio diversification strategies failed.

---