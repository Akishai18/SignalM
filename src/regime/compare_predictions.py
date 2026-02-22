# Demonstration script: Compare all prediction methods side-by-side
# Run this after training all models to see unified evaluation
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from regime.transitions import compute_transition_statistics
from regime.predict import compute_prediction_accuracy_baseline
from regime.hmm_predict import fit_hmm_to_regimes, compute_hmm_accuracy
from regime.feature_predict import (
    build_prediction_dataset,
    train_all_predictors
)
from regime.evaluate_predictions import (
    compare_all_predictors,
    evaluate_per_regime_performance,
    print_prediction_comparison,
    print_per_regime_comparison,
    compute_transition_detection_metrics,
    print_transition_detection_summary
)
from regime.visualize_regimes import (
    plot_prediction_timeline,
    plot_prediction_confusion_matrix,
    plot_forecast_probabilities,
    plot_confidence_over_time
)
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import os


def main():
    # Load data
    print("Loading data...")
    regime_labels = pd.read_csv('regime_results/regime_labels_k4.csv', index_col=0, parse_dates=True).squeeze()
    feature_df = pd.read_csv('regime_results/regime_features_normalized.csv', index_col=0, parse_dates=True)
    regime_label_map = {0: 'Calm', 1: 'Crisis', 2: 'Elevated Stress', 3: 'Transition'}

    # Compute transition matrix
    print("\nComputing transition statistics...")
    trans_stats = compute_transition_statistics(regime_labels)
    transition_matrix = trans_stats['transition_matrix']

    # 1. Markov Baseline
    print("\n[1/4] Evaluating Markov Chain Baseline...")
    markov_results = compute_prediction_accuracy_baseline(
        regime_labels=regime_labels,
        transition_matrix=transition_matrix,
        test_start_idx=None
    )

    # 2. HMM
    print("\n[2/4] Evaluating Hidden Markov Model...")
    try:
        hmm_model = fit_hmm_to_regimes(
            regime_labels=regime_labels,
            feature_matrix=feature_df,
            n_regimes=4
        )
        hmm_results = compute_hmm_accuracy(
            hmm_model=hmm_model,
            feature_matrix=feature_df,
            regime_labels=regime_labels,
            test_start_idx=None
        )
    except Exception as e:
        print(f"  ⚠ HMM evaluation failed: {e}")
        hmm_results = None

    # 3. Random Forest (feature-only)
    print("\n[3/4] Evaluating Random Forest...")
    prediction_data = build_prediction_dataset(
        feature_matrix=feature_df,
        regime_labels=regime_labels,
        horizons=[1],
        include_current_regime=False
    )
    trained_models = train_all_predictors(prediction_data, train_ratio=0.7)

    rf_results = None
    xgb_results = None

    if 1 in trained_models and 'random_forest' in trained_models[1]['models']:
        rf_results = trained_models[1]['models']['random_forest']['eval']

    # 4. XGBoost (feature-only)
    print("\n[4/4] Evaluating XGBoost...")
    if 1 in trained_models and 'xgboost' in trained_models[1]['models']:
        xgb_results = trained_models[1]['models']['xgboost']['eval']

    # === COMPARISON ===
    print("\n" + "="*70)
    print("UNIFIED PREDICTION EVALUATION")
    print("="*70)

    # Overall comparison
    comparison_df = compare_all_predictors(
        regime_labels=regime_labels,
        transition_matrix=transition_matrix,
        markov_accuracy_results=markov_results,
        hmm_accuracy_results=hmm_results,
        rf_accuracy_results=rf_results,
        xgb_accuracy_results=xgb_results
    )

    print_prediction_comparison(comparison_df, regime_label_map=regime_label_map)

    # Per-regime comparison
    all_results = {}
    if markov_results:
        all_results['Markov'] = markov_results
    if hmm_results:
        all_results['HMM'] = hmm_results
    if rf_results:
        all_results['RF'] = rf_results
    if xgb_results:
        all_results['XGB'] = xgb_results

    per_regime_df = evaluate_per_regime_performance(all_results, regime_label_map)
    print_per_regime_comparison(per_regime_df)

    # Transition detection
    print("\n[Bonus] Transition Detection Analysis...")
    transition_metrics = {}

    if markov_results and 'predictions_df' in markov_results:
        markov_pred_df = markov_results['predictions_df']
        transition_metrics['Markov'] = compute_transition_detection_metrics(
            predictions=markov_pred_df['predicted_regime'],
            actuals=markov_pred_df['actual_regime'],
            regime_labels=regime_labels
        )

    if hmm_results and 'predictions_df' in hmm_results:
        hmm_pred_df = hmm_results['predictions_df']
        transition_metrics['HMM'] = compute_transition_detection_metrics(
            predictions=hmm_pred_df['predicted_regime'],
            actuals=hmm_pred_df['actual_regime'],
            regime_labels=regime_labels
        )

    if rf_results and 'y_pred' in rf_results:
        rf_pred = pd.Series(rf_results['y_pred'], index=regime_labels.index[-len(rf_results['y_pred']):])
        rf_actual = pd.Series(rf_results['y_test'], index=rf_pred.index)
        transition_metrics['RF'] = compute_transition_detection_metrics(
            predictions=rf_pred,
            actuals=rf_actual,
            regime_labels=regime_labels
        )

    if xgb_results and 'y_pred' in xgb_results:
        xgb_pred = pd.Series(xgb_results['y_pred'], index=regime_labels.index[-len(xgb_results['y_pred']):])
        xgb_actual = pd.Series(xgb_results['y_test'], index=xgb_pred.index)
        transition_metrics['XGB'] = compute_transition_detection_metrics(
            predictions=xgb_pred,
            actuals=xgb_actual,
            regime_labels=regime_labels
        )

    if transition_metrics:
        print_transition_detection_summary(transition_metrics)

    # === VISUALIZATIONS ===
    print("\n" + "="*70)
    print("GENERATING PREDICTION VISUALIZATIONS")
    print("="*70)

    viz_dir = 'regime_results/prediction_visualizations'
    os.makedirs(viz_dir, exist_ok=True)

    # 1. Prediction Timeline (Predicted vs Actual)
    print("\n[1/4] Creating prediction timeline plots...")
    timeline_models = []
    if markov_results and 'predictions_df' in markov_results:
        timeline_models.append(('Markov', markov_results['predictions_df']))
    if hmm_results and 'predictions_df' in hmm_results:
        timeline_models.append(('HMM', hmm_results['predictions_df']))
    if rf_results and 'y_pred' in rf_results:
        rf_pred_df = pd.DataFrame({
            'predicted_regime': rf_results['y_pred']
        }, index=regime_labels.index[-len(rf_results['y_pred']):])
        timeline_models.append(('Random Forest', rf_pred_df))
    if xgb_results and 'y_pred' in xgb_results:
        xgb_pred_df = pd.DataFrame({
            'predicted_regime': xgb_results['y_pred']
        }, index=regime_labels.index[-len(xgb_results['y_pred']):])
        timeline_models.append(('XGBoost', xgb_pred_df))

    for model_name, pred_df in timeline_models:
        try:
            fig = plot_prediction_timeline(
                predictions_df=pred_df,
                actual_regimes=regime_labels,
                model_name=model_name,
                regime_label_map=regime_label_map
            )
            filename = f"{viz_dir}/{model_name.lower().replace(' ', '_')}_timeline.png"
            fig.savefig(filename, dpi=150, bbox_inches='tight')
            plt.close(fig)
            print(f"  ✓ Saved {model_name} timeline: {filename}")
        except Exception as e:
            print(f"  ⚠ Failed to create {model_name} timeline: {e}")

    # 2. Confusion Matrices
    print("\n[2/4] Creating confusion matrices...")
    cm_models = []
    if markov_results and 'predictions_df' in markov_results:
        cm_models.append(('Markov',
                          markov_results['predictions_df']['predicted_regime'].values,
                          markov_results['predictions_df']['actual_regime'].values))
    if hmm_results and 'predictions_df' in hmm_results:
        cm_models.append(('HMM',
                          hmm_results['predictions_df']['predicted_regime'].values,
                          hmm_results['predictions_df']['actual_regime'].values))
    if rf_results and 'y_pred' in rf_results:
        cm_models.append(('Random Forest', rf_results['y_pred'], rf_results['y_test']))
    if xgb_results and 'y_pred' in xgb_results:
        cm_models.append(('XGBoost', xgb_results['y_pred'], xgb_results['y_test']))

    for model_name, predictions, actuals in cm_models:
        try:
            fig = plot_prediction_confusion_matrix(
                predictions=predictions,
                actuals=actuals,
                model_name=model_name,
                regime_label_map=regime_label_map
            )
            filename = f"{viz_dir}/{model_name.lower().replace(' ', '_')}_confusion.png"
            fig.savefig(filename, dpi=150, bbox_inches='tight')
            plt.close(fig)
            print(f"  ✓ Saved {model_name} confusion matrix: {filename}")
        except Exception as e:
            print(f"  ⚠ Failed to create {model_name} confusion matrix: {e}")

    # 3. Confidence Over Time
    print("\n[3/4] Creating confidence plots...")
    conf_models = []
    if markov_results and 'predictions_df' in markov_results and 'confidence' in markov_results['predictions_df'].columns:
        conf_models.append(('Markov', markov_results['predictions_df']))
    if hmm_results and 'predictions_df' in hmm_results and 'confidence' in hmm_results['predictions_df'].columns:
        conf_models.append(('HMM', hmm_results['predictions_df']))

    for model_name, pred_df in conf_models:
        try:
            fig = plot_confidence_over_time(
                predictions_df=pred_df,
                model_name=model_name
            )
            filename = f"{viz_dir}/{model_name.lower().replace(' ', '_')}_confidence.png"
            fig.savefig(filename, dpi=150, bbox_inches='tight')
            plt.close(fig)
            print(f"  ✓ Saved {model_name} confidence: {filename}")
        except Exception as e:
            print(f"  ⚠ Failed to create {model_name} confidence plot: {e}")

    # 4. Forecast Probabilities (if available)
    print("\n[4/4] Creating forecast probability plots...")
    # This would require running forecast on current date - skip for now
    print("  ℹ Skipping forecast probabilities (requires current-date inference)")

    print("\n" + "="*70)
    print(f"✓ Visualizations saved to: {viz_dir}/")
    print("="*70)

    print("\n✓ Evaluation complete")


if __name__ == "__main__":
    import sys
    import os
    # Add parent directory to path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    main()
