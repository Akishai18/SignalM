# Regime Detection & Prediction: Key Findings

**Date:** February 2026
**Author:** Model comparison on S&P 500 constituents (2012-2024)

---

## Executive Summary

Built an end-to-end market regime detection and prediction system on 500+ equities, identifying 4 economically distinct regimes (Calm, Crisis, Elevated Stress, Transition) and comparing multiple forecasting approaches. **Key finding:** Simple Markov chains are surprisingly hard to beat for highly persistent regimes (280+ day mean duration), but feature-based models reveal early warning signals in volatility dispersion and PCA concentration.

---

## 1. Regime Detection (Steps 1-8)

### Approach
- **Feature space:** 6 dimensions (realized volatility, cross-sectional dispersion, pairwise correlation, PCA variance explained, cumulative PC1-3 variance, effective dimensionality)
- **Method:** K-means clustering (K=4) on z-score normalized features
- **Validation:** Persistence diagnostics, UMAP separation, event alignment

### Results
| Regime | Label | Mean Duration | % of Data | Key Characteristics |
|--------|-------|---------------|-----------|---------------------|
| 0 | Calm | 285 days | 61% | Low vol (0.24), low corr (0.28), high effective dim (4.9) |
| 1 | Crisis | 156 days | 5% | High vol (0.35), high corr (0.45), low effective dim (3.8) |
| 2 | Elevated Stress | 142 days | 17% | Medium vol (0.28), medium corr (0.35) |
| 3 | Transition | 135 days | 17% | Mixed characteristics, regime shifts |

**Key Insight:** Regimes are highly persistent (mean duration 280+ days across all regimes), with only 15 transitions in 3264 trading days. This creates a fundamental challenge for prediction models.

---

## 2. Prediction Model Comparison

### Models Tested
1. **Markov Chain Baseline:** Historical transition probabilities only
2. **Hidden Markov Model:** Gaussian emissions + learned transitions
3. **Random Forest:** 36 features (current + lagged + deltas), no current regime
4. **XGBoost:** Same feature set as RF

### Accuracy Results (Test Period: 2021-2024, 30% holdout)

| Horizon | Markov Baseline | HMM | Random Forest | XGBoost |
|---------|-----------------|-----|---------------|---------|
| **1-day** | 99.28% | 99.54%* | **91.06%** | 81.81% |
| **7-day** | 95.99% | 96.70%* | **83.21%** | 84.76% |
| **30-day** | 92.32% | 92.62%* | **83.30%** | 76.87% |

\* *HMM accuracy when using ground-truth current regime; drops to 86.3% when inferring state from features alone.*

### Critical Experiment: With vs. Without Current Regime Features

**Setup:** Train RF/XGBoost twice:
1. **With current regime:** 40 features including one-hot regime indicators
2. **Without current regime:** 36 features (market features only)

**1-Day Accuracy:**
- RF: 99.28% → **91.06%** (-8.2pp when regime removed)
- XGBoost: 99.08% → **81.81%** (-17.3pp when regime removed)

**Feature Importances (1-day horizon, WITHOUT current regime):**

| Rank | Random Forest | XGBoost |
|------|--------------|---------|
| 1 | cum_var_3_lag5 (7.4%) | vol_dispersion_126 (12.1%) |
| 2 | avg_vol_126_lag21 (7.0%) | vol_dispersion_126_lag1 (10.7%) |
| 3 | cum_var_3 (5.8%) | effective_dimension_lag21 (9.0%) |
| 4 | vol_dispersion_126 (5.8%) | cum_var_3_lag5 (7.8%) |

**Interpretation:**
- **With regime features:** Models achieve 99% accuracy but essentially memorize the Markov chain (regime one-hots dominate at 66% total importance for XGBoost)
- **Without regime features:** Models learn from market dynamics (volatility dispersion, lagged PCA concentration) but underperform the simple Markov baseline by 8-17pp
- **Conclusion:** The current regime is by far the strongest predictor. Market features have modest incremental value beyond "stay in the current regime."

---

## 3. What Works and What Doesn't

### ✅ What Works

**Markov Chain Baseline:**
- 99.3% 1-day accuracy, 96% 7-day, 92% 30-day
- Simple, interpretable, hard to beat
- Works well because regimes are extremely persistent

**HMM (when used correctly):**
- 86.3% accuracy inferring state from features alone
- Useful for detecting regime changes early from feature shifts
- More sophisticated than Markov chain but requires careful implementation

**Random Forest (feature-only):**
- 91% 1-day accuracy (best among feature-based models)
- Provides realistic uncertainty estimates (e.g., 37% Transition probability vs. XGBoost's overconfident 5%)
- Top features reveal economically meaningful signals: volatility dispersion, PCA concentration

### ❌ What Doesn't Work

**XGBoost (feature-only):**
- Underperforms RF by 9pp at 1-day horizon (82% vs. 91%)
- Overconfident predictions (88-90% confidence even when wrong)
- Prone to memorizing test period patterns (2021-2024 = mostly Calm)

**Long-horizon prediction (30-day):**
- All models struggle (76-92% accuracy)
- Uncertainty compounds over time
- Rare transitions make learning difficult (only 15 total in dataset)

**Rare regime prediction:**
- Crisis regime: 99% accurate (but only 156 days total, mostly in 2020)
- Elevated Stress: 28.57% RF accuracy (only 7 test samples)
- Transition: 74% RF accuracy (more common but still challenging)

---

## 4. Key Learnings for Practitioners

### Finding 1: Regime Persistence Dominates
With 280+ day mean duration and only 15 transitions, "predict same regime" is ~99% accurate at short horizons. This is the baseline to beat, and it's surprisingly strong.

### Finding 2: Feature-Based Signals Are Modest
Market features (vol, correlation, PCA) add value but don't dramatically outperform the Markov baseline. At 1-day horizon:
- Markov baseline: 99.3%
- Best feature model (RF): 91.1%
- Difference: **8pp gap** reveals limited incremental predictive power

This is economically intuitive: if regime transitions were easily predictable from features, markets would arbitrage that signal away.

### Finding 3: Volatility Dispersion Is Key
When forced to predict from features alone, both RF and XGBoost weight **volatility dispersion** (cross-sectional volatility spread) most heavily. This suggests:
- Rising dispersion → potential regime change (concentration breaking down)
- Falling dispersion → regime stability (market moving together)

### Finding 4: Lagged Features Matter
Lags of 5 and 21 days outperform 1-day lags for cumulative variance and volatility, suggesting regime transitions build over weeks, not days.

### Finding 5: The HMM Challenge
HMMs can infer current state from features (86% accuracy), but this is harder than it looks:
- Requires careful initialization (diagonal covariance, fixed startprob)
- Emission probabilities must be distinct enough to discriminate regimes
- With highly persistent regimes, the model can collapse to memorizing "always predict Calm"

---

## 5. Implications for Practical Use

### For Portfolio Risk Management
- **Use Markov chain as primary signal:** Simple, robust, hard to beat
- **Use feature models for early warnings:** Rising volatility dispersion + falling effective dimension = potential regime shift ahead
- **Combine models:** Markov chain (what regime are we in?) + RF (are features signaling transition?)

### For Tactical Allocation
- Focus on **transition detection** (binary: will regime change?) rather than exact regime prediction
- 7-day forecast is the sweet spot: long enough to be actionable, short enough to be accurate
- Don't overfit to rare regimes (Crisis, Elevated Stress) — they're hard to predict and data-starved

### For Model Development
- **Start simple:** Markov chain is the baseline; only add complexity if it meaningfully beats it
- **Remove the cheat:** Don't include current regime as a feature — it dominates and obscures what features actually contribute
- **Validate honestly:** Chronological train/test split is essential; random shuffling inflates accuracy

---

## 6. Future Work

### High-Priority
1. **Transition detection:** Reframe as binary classification ("will regime change in next H days?") — more balanced, more actionable
2. **Shorter feature windows:** Try 21d/63d instead of 126d to catch earlier signals
3. **Interaction features:** Vol spike × regime, correlation breakout detection

### Medium-Priority
4. **Ensemble approach:** Combine Markov baseline with feature model predictions (weighted by confidence)
5. **Sector-level analysis:** Do sector regimes transition before market-wide regimes?
6. **Dynamic lookback:** Adaptive feature windows based on market volatility

### Lower-Priority
7. **Alternative clustering:** Try GMM, DBSCAN to see if K-means is masking structure
8. **Alternative features:** Order flow imbalance, options skew, credit spreads
9. **Real-time inference:** Deploy as daily dashboard with automated retraining

---

## 7. Conclusion

Built a rigorous regime detection and prediction system that identifies economically meaningful market states. **Main takeaway:** For highly persistent regimes, simple Markov chains are remarkably effective baselines, and feature-based models must be carefully designed to add value beyond "predict same regime." The most useful signals come from volatility dispersion and PCA concentration, which serve as early warnings for regime transitions even when exact timing is unpredictable.

**Bottom line for interviews:** This project demonstrates not just technical implementation (K-means, HMM, RF, XGBoost) but also critical thinking (questioning high accuracy, removing confounding features, interpreting negative results). The ability to say *"my model underperforms the baseline, and here's why that's an important finding"* is more valuable than claiming 99% accuracy without understanding what drives it.

---

## Appendix: Methodological Notes

### Data Quality
- 500+ S&P 500 constituents, daily frequency, 2012-2024
- Missing data handled via forward-fill (conservative)
- PCA performed on rolling 252-day windows

### Validation Approach
- Chronological 70/30 train/test split (no data leakage)
- Out-of-sample validation on 2021-2024 period
- Persistence diagnostics: mean duration, single-day flip rate, regime stability

### Model Hyperparameters
- **Random Forest:** 200 trees, max depth 6, min samples/leaf 10, class_weight='balanced'
- **XGBoost:** 200 boosters, max depth 4, learning rate 0.05, subsample 0.8
- **HMM:** Diagonal covariance, 100 EM iterations, supervised initialization from K-means

### Code Availability
Full implementation at: `/src/regime/` with modular functions for detection, prediction, and validation.
