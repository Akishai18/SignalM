"""
Precompute all expensive API results as static JSON files.

Run this locally (or in CI) before deploying:
    python scripts/precompute.py

Generates files in precomputed/ that API endpoints serve directly,
eliminating on-the-fly model inference on the production server.
"""
import json
import sys
import os
import time

# Add project root to path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, 'src'))

import pandas as pd
import numpy as np
from datetime import datetime

OUT_DIR = os.path.join(ROOT, 'precomputed')
os.makedirs(OUT_DIR, exist_ok=True)

INDICES = ['SPY', 'QQQ', 'DIA', 'IWM']
REGIME_MAP = {0: 'Calm', 1: 'Crisis', 2: 'Elevated Stress', 3: 'Transition'}


def _save(name: str, data: dict):
    path = os.path.join(OUT_DIR, f'{name}.json')
    with open(path, 'w') as f:
        json.dump(data, f, default=str)
    size_kb = os.path.getsize(path) / 1024
    print(f'  -> {path} ({size_kb:.1f} KB)')


# ============================================================================
# 1. Predictions: current, compare, trajectory, accuracy
# ============================================================================

def precompute_predictions():
    from regime.inference import load_prediction_engine
    from api.routers.predictions import (
        load_current_features, format_model_prediction, get_regime_label_map,
    )

    regime_map = get_regime_label_map()
    compare_data = {}

    for symbol in INDICES:
        t0 = time.time()
        print(f'[predictions] {symbol}...')

        engine = load_prediction_engine(symbol, models_dir='models')
        features, current_regime = load_current_features(symbol)
        current_date = features.index[-1].strftime('%Y-%m-%d')

        # --- current predictions (all horizons) ---
        all_preds = engine.predict_all_horizons(features, current_regime)
        predictions = {}
        for hk, pd_data in all_preds.items():
            ens = format_model_prediction('Ensemble', pd_data['ensemble'], regime_map)
            indiv = [
                format_model_prediction(mn.replace('_', ' ').title(), mp, regime_map)
                for mn, mp in pd_data['individual_models'].items()
                if 'markov' not in mn.lower()
            ]
            predictions[hk] = {
                'horizon_days': int(hk.replace('d', '')),
                'ensemble': ens.model_dump(),
                'individual_models': [m.model_dump() for m in indiv],
                'weights': pd_data['weights'],
            }

        _save(f'{symbol.lower()}_predictions', {
            'symbol': symbol,
            'current_regime': current_regime,
            'current_date': current_date,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat(),
        })

        # --- compare data ---
        compare_data[symbol] = {
            hk: {
                'predicted_regime': pd_data['ensemble']['predicted_regime'],
                'predicted_regime_name': regime_map[pd_data['ensemble']['predicted_regime']],
                'confidence': float(pd_data['ensemble']['confidence']),
                'probabilities': {
                    regime_map[i]: float(p) for i, p in enumerate(pd_data['ensemble']['probabilities'])
                },
            }
            for hk, pd_data in all_preds.items()
        }

        # --- trajectory (30d, 90d, 365d) ---
        for max_days in [30, 90, 365]:
            sample_days = []
            for d in range(1, min(max_days + 1, 31)):
                sample_days.append(d)
            for d in range(33, min(max_days + 1, 91), 3):
                sample_days.append(d)
            for d in range(91, min(max_days + 1, 366), 7):
                sample_days.append(d)
            for d in range(378, max_days + 1, 14):
                sample_days.append(d)
            if max_days not in sample_days:
                sample_days.append(max_days)
            sample_days.sort()

            points = []
            for d in sample_days:
                result = engine.predict_custom_horizon(d, features, current_regime)
                ens = result['ensemble']
                points.append({
                    'day': d,
                    'regime': ens['predicted_regime'],
                    'regime_name': regime_map[ens['predicted_regime']],
                    'confidence': float(ens['confidence']),
                    'probabilities': {regime_map[i]: float(p) for i, p in enumerate(ens['probabilities'])},
                })

            _save(f'{symbol.lower()}_trajectory_{max_days}d', {
                'symbol': symbol,
                'max_horizon': max_days,
                'current_regime': current_regime,
                'points': points,
                'timestamp': datetime.now().isoformat(),
            })

        # --- accuracy ---
        accuracies = []
        best_by_horizon = {}
        for horizon_key, pred_data in all_preds.items():
            h = int(horizon_key.replace('d', ''))
            best_acc = 0
            for mn, mp in pred_data['individual_models'].items():
                acc = float(mp.get('train_accuracy', mp.get('confidence', 0)))
                entry = {
                    'model_name': mn.replace('_', ' ').title(),
                    'horizon_days': h,
                    'train_accuracy': acc,
                    'test_accuracy': None,
                    'mean_confidence': float(mp['confidence']),
                }
                accuracies.append(entry)
                if acc > best_acc:
                    best_acc = acc
                    best_by_horizon[h] = mn.replace('_', ' ').title()

        _save(f'{symbol.lower()}_accuracy', {
            'symbol': symbol,
            'horizons': sorted(best_by_horizon.keys()),
            'accuracies': accuracies,
            'best_model_by_horizon': best_by_horizon,
        })

        print(f'  {symbol} done in {time.time() - t0:.1f}s')

    # --- compare across indices ---
    _save('compare_indices', {
        'indices': compare_data,
        'timestamp': datetime.now().isoformat(),
    })


# ============================================================================
# 2. Backtest
# ============================================================================

def precompute_backtest():
    from regime.inference import load_prediction_engine
    from api.routers.predictions import load_current_features

    for symbol in INDICES:
        t0 = time.time()
        print(f'[backtest] {symbol}...')

        engine = load_prediction_engine(symbol, models_dir='models')
        features, current_regime = load_current_features(symbol)

        regime_path = f'regime_results/indices/{symbol.lower()}_regimes.csv'
        if not os.path.exists(regime_path):
            regime_path = 'regime_results/regime_labels_k4.csv'
        regime_labels = pd.read_csv(regime_path, index_col=0, parse_dates=True).squeeze()
        if hasattr(regime_labels.index, 'tz') and regime_labels.index.tz is not None:
            regime_labels.index = regime_labels.index.tz_localize(None)

        common_dates = features.index.intersection(regime_labels.index)
        features = features.loc[common_dates]
        regime_labels = regime_labels.loc[common_dates]

        days = 252
        n = min(days, len(common_dates))
        test_dates = common_dates[-n:]
        horizons = [1, 7, 30]
        results = []
        rolling_window = 30

        for date in test_dates:
            point = {'date': date.strftime('%Y-%m-%d')}
            for h in horizons:
                future_idx = common_dates.get_loc(date) + h
                if future_idx >= len(common_dates):
                    point[f'correct_{h}d'] = None
                    point[f'confidence_{h}d'] = None
                    continue
                actual = int(regime_labels.iloc[future_idx])
                try:
                    cur_feat = features.loc[:date]
                    cur_regime = int(regime_labels.loc[date])
                    result = engine.predict_custom_horizon(h, cur_feat, cur_regime)
                    predicted = result['ensemble']['predicted_regime']
                    conf = float(result['ensemble']['confidence'])
                    point[f'correct_{h}d'] = 1 if predicted == actual else 0
                    point[f'confidence_{h}d'] = conf
                except Exception:
                    point[f'correct_{h}d'] = None
                    point[f'confidence_{h}d'] = None
            results.append(point)

        # Rolling accuracy
        points = []
        for i, r in enumerate(results):
            pt = {'date': r['date']}
            for h in horizons:
                ws = max(0, i - rolling_window + 1)
                window_results = [results[j].get(f'correct_{h}d') for j in range(ws, i + 1)]
                valid = [v for v in window_results if v is not None]
                pt[f'rolling_accuracy_{h}d'] = sum(valid) / len(valid) if valid else None
                pt[f'confidence_{h}d'] = r.get(f'confidence_{h}d')
            points.append(pt)

        summary = {}
        for h in horizons:
            all_correct = [r.get(f'correct_{h}d') for r in results if r.get(f'correct_{h}d') is not None]
            summary[f'accuracy_{h}d'] = sum(all_correct) / len(all_correct) if all_correct else 0

        _save(f'{symbol.lower()}_backtest', {
            'symbol': symbol,
            'points': points,
            'summary': summary,
            'timestamp': datetime.now().isoformat(),
        })

        print(f'  {symbol} done in {time.time() - t0:.1f}s')


# ============================================================================
# 3. Transitions
# ============================================================================

def precompute_transitions():
    from regime.transitions import compute_transition_matrix, compute_regime_durations, find_common_transition_paths

    for symbol in INDICES:
        print(f'[transitions] {symbol}...')
        regime_path = f'regime_results/indices/{symbol.lower()}_regimes.csv'
        if not os.path.exists(regime_path):
            regime_path = 'regime_results/regime_labels_k4.csv'
        regime_labels = pd.read_csv(regime_path, index_col=0, parse_dates=True).squeeze()
        regime_labels = regime_labels.dropna().astype(int)

        trans_matrix, trans_counts = compute_transition_matrix(regime_labels)
        matrix_dict = {}
        counts_dict = {}
        for from_id in trans_matrix.index:
            fn = REGIME_MAP[int(from_id)]
            matrix_dict[fn] = {}
            counts_dict[fn] = {}
            for to_id in trans_matrix.columns:
                tn = REGIME_MAP[int(to_id)]
                matrix_dict[fn][tn] = float(trans_matrix.loc[from_id, to_id])
                counts_dict[fn][tn] = int(trans_counts.loc[from_id, to_id])

        durations_raw = compute_regime_durations(regime_labels)
        durations = {}
        for rid, stats in durations_raw.items():
            name = REGIME_MAP[int(rid)]
            durations[name] = {
                'mean_days': float(stats['mean_days']),
                'median_days': float(stats['median_days']),
                'min_days': int(stats['min_days']),
                'max_days': int(stats['max_days']),
                'std_days': float(stats['std_days']) if not pd.isna(stats['std_days']) else 0.0,
                'total_runs': int(stats['total_runs']),
                'total_days': int(stats['total_days']),
            }

        raw_paths = find_common_transition_paths(regime_labels, max_path_length=3)
        common_paths = [
            {'path': [REGIME_MAP[int(r)] for r in path], 'count': count}
            for path, count in raw_paths[:10]
        ]

        _save(f'{symbol.lower()}_transitions', {
            'symbol': symbol,
            'matrix': matrix_dict,
            'counts': counts_dict,
            'durations': durations,
            'common_paths': common_paths,
            'timestamp': datetime.now().isoformat(),
        })


# ============================================================================
# 4. Correlation endpoints
# ============================================================================

def precompute_correlations():
    SECTOR_MAP = {
        'XLK': 'Technology', 'XLF': 'Financials', 'XLV': 'Healthcare',
        'XLE': 'Energy', 'XLY': 'Consumer Disc', 'XLI': 'Industrials',
        'XLP': 'Consumer Staples', 'XLU': 'Utilities', 'XLB': 'Materials',
        'XLC': 'Communication', 'XLRE': 'Real Estate',
    }
    TICKERS = list(SECTOR_MAP.keys())

    # Load prices
    frames = {}
    for ticker in TICKERS:
        path = f"data/sectors/{ticker.lower()}_data.csv"
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path, parse_dates=['Date'])
        df['Date'] = pd.to_datetime(df['Date'], utc=True).dt.tz_localize(None)
        df = df.set_index('Date').sort_index()
        frames[ticker] = df['close']
    prices = pd.DataFrame(frames).dropna()
    prices.index = prices.index.normalize()
    returns = np.log(prices).diff().iloc[1:]

    # --- sector-matrix for standard windows ---
    print('[correlations] sector matrices...')
    for window in [21, 63, 126, 252]:
        for method in ['pearson', 'spearman']:
            recent = returns.iloc[-window:] if len(returns) >= window else returns
            corr = recent.corr(method=method)
            tickers_present = [t for t in TICKERS if t in corr.columns]
            sectors = [SECTOR_MAP[t] for t in tickers_present]
            matrix = corr.loc[tickers_present, tickers_present].values
            n = len(tickers_present)
            upper = matrix[np.triu_indices(n, k=1)]

            _save(f'sector_matrix_{window}d_{method}', {
                'sectors': sectors,
                'tickers': tickers_present,
                'matrix': matrix.tolist(),
                'stats': {
                    'mean': float(np.nanmean(upper)),
                    'max': float(np.nanmax(upper)),
                    'min': float(np.nanmin(upper)),
                    'std': float(np.nanstd(upper)),
                },
                'window': window,
                'method': method,
                'timestamp': datetime.now().isoformat(),
            })

    # --- rolling correlation ---
    print('[correlations] rolling...')
    windows = [21, 63, 252]
    rolling_data = {}
    for w in windows:
        corrs = []
        dates = []
        for i in range(w - 1, len(returns)):
            chunk = returns.iloc[i - w + 1:i + 1]
            cm = chunk.corr().values
            n = cm.shape[0]
            ut = cm[np.triu_indices(n, k=1)]
            corrs.append(float(np.nanmean(ut)))
            dates.append(returns.index[i])
        rolling_data[w] = pd.Series(corrs, index=dates)

    cutoff = returns.index[-1] - pd.DateOffset(years=3)
    all_dates = sorted(set().union(*(s.index for s in rolling_data.values())))
    all_dates = [d for d in all_dates if d >= cutoff]

    roll_points = []
    for d in all_dates:
        point = {'date': d.strftime('%Y-%m-%d')}
        for w in windows:
            s = rolling_data[w]
            point[f'corr_{w}d'] = float(s.loc[d]) if d in s.index else None
        roll_points.append(point)

    _save('rolling_correlation', {'points': roll_points})

    # --- regime correlation ---
    print('[correlations] regime overlay...')
    regime_labels = pd.read_csv('regime_results/regime_labels_k4.csv',
                                parse_dates=['Date'], index_col='Date')['regime_k4']
    w = 63
    corr_series = rolling_data[w]
    common = corr_series.index.intersection(regime_labels.index)
    cutoff = common[-1] - pd.DateOffset(years=3)
    common = common[common >= cutoff]

    regime_points = []
    for d in common:
        r = int(regime_labels.loc[d])
        regime_points.append({
            'date': d.strftime('%Y-%m-%d'),
            'avg_correlation': float(corr_series.loc[d]),
            'regime': r,
            'regime_name': REGIME_MAP.get(r, 'Unknown'),
        })

    _save('regime_correlation', {'points': regime_points})

    # --- PCA structure ---
    print('[correlations] PCA structure...')
    pca_df = pd.read_csv('pca_data/rolling_pca_metrics.csv', parse_dates=['Date'], index_col='Date')
    pca_cutoff = pca_df.index[-1] - pd.DateOffset(years=3)
    recent_pca = pca_df[pca_df.index >= pca_cutoff]
    pca_points = [
        {
            'date': d.strftime('%Y-%m-%d'),
            'pc1_var': float(row['PC1_var']),
            'cum_var_3': float(row['cum_var_3']),
            'effective_dimension': float(row['eff_dim']),
        }
        for d, row in recent_pca.iterrows()
    ]
    _save('pca_structure', {'points': pca_points})

    # --- sector pair details (top pairs) ---
    print('[correlations] sector pairs...')
    pairs = [('XLK', 'XLE'), ('XLK', 'XLF'), ('XLE', 'XLF'), ('XLK', 'XLV'),
             ('XLY', 'XLP'), ('XLU', 'XLRE'), ('XLI', 'XLB'), ('XLC', 'XLK'),
             ('XLF', 'XLRE'), ('XLE', 'XLU')]
    for s1, s2 in pairs:
        if s1 not in returns.columns or s2 not in returns.columns:
            continue
        corrs = returns[s1].rolling(63).corr(returns[s2]).dropna()
        cutoff = corrs.index[-1] - pd.DateOffset(years=3)
        recent = corrs[corrs.index >= cutoff]
        points = [{'date': d.strftime('%Y-%m-%d'), 'correlation': float(v)} for d, v in recent.items()]

        _save(f'sector_pair_{s1}_{s2}', {
            'sector1': s1, 'sector1_name': SECTOR_MAP.get(s1, s1),
            'sector2': s2, 'sector2_name': SECTOR_MAP.get(s2, s2),
            'current_correlation': float(recent.iloc[-1]) if len(recent) > 0 else None,
            'points': points,
        })


# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    t_start = time.time()
    print(f'Precomputing all API data into {OUT_DIR}/\n')

    precompute_transitions()
    print()
    precompute_correlations()
    print()
    precompute_predictions()
    print()
    precompute_backtest()

    total = time.time() - t_start
    n_files = len([f for f in os.listdir(OUT_DIR) if f.endswith('.json')])
    print(f'\nDone! {n_files} files generated in {total:.0f}s')
