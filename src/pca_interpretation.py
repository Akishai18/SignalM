"""
Generate an economic interpretation report for PC1-PC3 using:
 - src/pca_loadings.csv (features × PCs)
 - pca_data/rolling_pca_metrics.csv (time series of PC variances & eff_dim)

Outputs: pca_interpretation.md in project root (or save_dir if provided).
"""

import os
import re
import numpy as np
import pandas as pd


def parse_feature(name):
    """
    Parse feature name like:
      - 'AAPL_vol_252' -> ('AAPL','vol','252')
      - 'avg_pairwise_corr_252' -> (None,'avg_pairwise_corr','252')
      - 'dispersion_63' -> (None,'dispersion','63')
      - other -> (None, name, None)
    """
    m = re.match(r'^(.+?)_(vol|skew|kurt)_(\d+)$', name)
    if m:
        return m.group(1), m.group(2), int(m.group(3))
    m2 = re.match(r'^(avg_pairwise_corr|dispersion)_(\d+)$', name)
    if m2:
        return None, m2.group(1), int(m2.group(2))
    return None, name, None


def summarize_top_loadings(loadings_df, pc, top_n=20):
    s = loadings_df[pc].dropna()
    top_pos = s.nlargest(top_n)
    top_neg = s.nsmallest(top_n)
    def summarize(series):
        rows = []
        for feat, val in series.items():
            sym, metric, window = parse_feature(feat)
            rows.append({'feature': feat, 'value': float(val), 'symbol': sym, 'metric': metric, 'window': window})
        return pd.DataFrame(rows)
    return summarize(top_pos), summarize(top_neg)


def group_summary(df):
    if df.empty:
        return {}
    by_metric = df['metric'].value_counts().to_dict()
    by_window = df['window'].fillna(-1).astype(int).value_counts().to_dict()
    symbols = df['symbol'].dropna().value_counts().head(10).to_dict()
    return {'by_metric': by_metric, 'by_window': by_window, 'top_symbols': symbols}


def write_interpretation(loadings_path='pca_loadings.csv',
                         metrics_path='pca_data/rolling_pca_metrics.csv',
                         companies_path=None,
                         out_md='pca_interpretation.md',
                         top_n=20):
    # load files
    if not os.path.exists(loadings_path):
        raise FileNotFoundError(loadings_path)
    if not os.path.exists(metrics_path):
        raise FileNotFoundError(metrics_path)

    loadings = pd.read_csv(loadings_path, index_col=0)
    metrics = pd.read_csv(metrics_path, index_col=0, parse_dates=True)

    # optional companies mapping
    sectors = None
    if companies_path and os.path.exists(companies_path):
        comps = pd.read_csv(companies_path)
        if 'Symbol' in comps.columns and 'Sector' in comps.columns:
            sectors = comps.set_index('Symbol')['Sector'].to_dict()

    lines = []
    lines.append("# PCA Economic Interpretation")
    lines.append("")
    lines.append("This report extracts the top positive / negative loadings for PC1–PC3 and ties them to rolling PCA metrics.")
    lines.append("")

    # global metrics evidence
    if 'PC1_var' in metrics.columns:
        p1_max_date = metrics['PC1_var'].idxmax()
        p1_max = metrics['PC1_var'].max()
        lines.append(f"- PC1 variance peak: {p1_max:.3f} on {pd.to_datetime(p1_max_date).date()}")
    if 'eff_dim' in metrics.columns:
        eff_min_date = metrics['eff_dim'].idxmin()
        eff_min = metrics['eff_dim'].min()
        lines.append(f"- Minimum effective dimension: {eff_min:.3f} on {pd.to_datetime(eff_min_date).date()}")
    lines.append("")

    # per PC analysis
    for pc in ['PC1','PC2','PC3']:
        if pc not in loadings.columns:
            continue
        lines.append(f"## {pc} — Top loadings & interpretation")
        lines.append("")
        top_pos_df, top_neg_df = summarize_top_loadings(loadings, pc, top_n=top_n)
        pos_summary = group_summary(top_pos_df)
        neg_summary = group_summary(top_neg_df)

        lines.append(f"Top {top_n} positive loadings (sample):")
        for feat, val in list(loadings[pc].nlargest(5).items()):
            lines.append(f"- {feat}: {val:.4f}")
        lines.append("")
        lines.append(f"Top {top_n} negative loadings (sample):")
        for feat, val in list(loadings[pc].nsmallest(5).items()):
            lines.append(f"- {feat}: {val:.4f}")
        lines.append("")

        # Summaries by metric
        lines.append("Summary of feature types among top loadings:")
        lines.append(f"- Positive loadings by metric: {pos_summary.get('by_metric',{})}")
        lines.append(f"- Negative loadings by metric: {neg_summary.get('by_metric',{})}")
        lines.append(f"- Positive loadings by window (counts): {pos_summary.get('by_window',{})}")
        lines.append(f"- Negative loadings by window (counts): {neg_summary.get('by_window',{})}")

        # If sector mapping available, show top sectors
        if sectors is not None:
            def sectors_for(df):
                syms = df['symbol'].dropna().unique().tolist()
                s_counts = {}
                for s in syms:
                    sec = sectors.get(s)
                    if sec:
                        s_counts[sec] = s_counts.get(sec, 0) + 1
                return s_counts
            lines.append(f"- Positive loadings sectors (counts): {sectors_for(top_pos_df)}")
            lines.append(f"- Negative loadings sectors (counts): {sectors_for(top_neg_df)}")

        # interpret heuristics
        interpretation = []
        # heuristics based on metric composition
        pos_metrics = pos_summary.get('by_metric', {})
        neg_metrics = neg_summary.get('by_metric', {})

        if any(k.startswith('avg_pairwise_corr') or k == 'avg_pairwise_corr' for k in pos_metrics):
            interpretation.append("Positive loadings include average pairwise correlation features → PC captures market-wide co-movement (market mode / risk-on-off).")
        if any(k.startswith('dispersion') or k == 'dispersion' for k in pos_metrics):
            interpretation.append("Positive loadings include dispersion features → PC reflects cross-sectional dispersion regime (stock-picking vs index-driven).")
        vol_count = sum(v for k, v in pos_metrics.items() if k == 'vol')
        if vol_count >= max(1, top_n // 8):
            interpretation.append("Positive loadings overweight volatility features → PC tied to volatility regime (volatility-driven factor).")
        # negative side
        vol_count_neg = sum(v for k, v in neg_metrics.items() if k == 'vol')
        if vol_count_neg >= max(1, top_n // 8):
            interpretation.append("Negative loadings include volatility features (sign opposite) — suggests this PC separates high-vol stocks from low-vol ones.")
        if not interpretation:
            interpretation.append("Mixed feature types — read top features to form hypothesis (sector, volatility, correlation, dispersion).")

        lines.append("")
        lines.append("Interpretation:")
        for it in interpretation:
            lines.append(f"- {it}")
        lines.append("")
        lines.append("---")
        lines.append("")

    # Tie back to rolling metrics
    lines.append("## Tie to rolling PCA metrics")
    lines.append("")
    lines.append("Use the rolling_pca_metrics.csv time series to connect component strength to regimes:")
    lines.append("- When PC1 variance spikes, the market becomes more one-dimensional (risk-on/off). Check dates near the PC1 peak above.")
    lines.append("- When effective dimension drops, diversification collapses — expect correlation/vol spikes and crisis-like behavior.")
    lines.append("- Inspect cum_var_3 to see how much of the system is explained by first three factors (high values → low dimensionality).")
    lines.append("")
    lines.append("## Next steps / checks")
    lines.append("- Inspect the full top_pos / top_neg lists in pca_loadings.csv to label PCs confidently.")
    lines.append("- Map top symbols to sectors (sp500_companies.csv) to detect sector-rotation PCs.")
    lines.append("- Cross-check PC time series (pca_components.csv) against market events (2008, 2020) and rolling metrics.")
    lines.append("")
    lines.append("----")
    lines.append("Generated by src/pca_interpretation.py")

    # write file
    with open(out_md, 'w') as f:
        f.write("\n".join(lines))

    print(f"Wrote interpretation -> {out_md}")


if __name__ == "__main__":
    # default paths assume script run from project root
    write_interpretation(
        loadings_path="pca_data/pca_loadings.csv" if os.path.exists("pca_data/pca_loadings.csv") else "pca_loadings.csv",
        metrics_path="pca_data/rolling_pca_metrics.csv" if os.path.exists("pca_data/rolling_pca_metrics.csv") else "pca_data/rolling_pca_metrics.csv",
        companies_path="data/sp500_companies.csv" if os.path.exists("data/sp500_companies.csv") else ("archive/sp500_companies.csv" if os.path.exists("archive/sp500_companies.csv") else None),
        out_md="pca_interpretation.md",
        top_n=20
    )