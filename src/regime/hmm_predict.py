# Hidden Markov Model (HMM) for regime prediction
# More sophisticated than baseline: learns both transition and emission probabilities
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple

try:
    from hmmlearn import hmm
    HMMLEARN_AVAILABLE = True
except ImportError:
    HMMLEARN_AVAILABLE = False
    print("Warning: hmmlearn not installed. Install with: pip install hmmlearn")


def fit_hmm_to_regimes(
    regime_labels: pd.Series,
    feature_matrix: pd.DataFrame,
    n_regimes: int = 4,
    n_iter: int = 100,
    random_state: int = 42
) -> Dict:
    #Fit Hidden Markov Model to regime sequence.
    #HMM learns:
    #  - Transition probabilities (regime → regime)
    #  - Emission probabilities (regime → observed features)
    #Initialize HMM using K-means regime labels (supervised initialization)
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed. Install with: pip install hmmlearn")
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    # Align feature matrix with regime labels
    common_dates = regime_labels.index.intersection(feature_matrix.index)
    regime_labels_aligned = regime_labels.loc[common_dates]
    feature_matrix_aligned = feature_matrix.loc[common_dates]
    
    # Prepare observations (features) for HMM
    # HMM expects shape (n_samples, n_features)
    observations = feature_matrix_aligned.values
    regime_array = regime_labels_aligned.values
    
    # Initialize HMM parameters from K-means regime labels (supervised initialization)
    # This ensures HMM states align with K-means regimes
    
    # 1. Initialize emission means: mean feature values per K-means regime
    means_init = np.zeros((n_regimes, feature_matrix_aligned.shape[1]))
    for regime in range(n_regimes):
        regime_mask = regime_array == regime
        if regime_mask.sum() > 0:
            means_init[regime] = observations[regime_mask].mean(axis=0)
        else:
            # Fallback: use overall mean
            means_init[regime] = observations.mean(axis=0)
    
    # 2. Initialize emission variances per K-means regime (diagonal covariance)
    # Diagonal covariance has 6 parameters per state vs 21 for full — much more stable
    covars_init = np.zeros((n_regimes, feature_matrix_aligned.shape[1]))
    for regime in range(n_regimes):
        regime_mask = regime_array == regime
        if regime_mask.sum() > 1:
            covars_init[regime] = np.var(observations[regime_mask], axis=0)
        else:
            covars_init[regime] = np.var(observations, axis=0)
    # Regularize: ensure no variance is too small (prevents degenerate emissions)
    covars_init = np.maximum(covars_init, 1e-3)
    
    # 3. Initialize transition matrix: count transitions from K-means labels
    transmat_init = np.zeros((n_regimes, n_regimes))
    for i in range(len(regime_array) - 1):
        from_regime = int(regime_array[i])
        to_regime = int(regime_array[i + 1])
        if 0 <= from_regime < n_regimes and 0 <= to_regime < n_regimes:
            transmat_init[from_regime, to_regime] += 1
    
    # Normalize transition matrix (row-wise probabilities)
    row_sums = transmat_init.sum(axis=1)
    # Handle rows with no transitions: use uniform distribution
    for i in range(n_regimes):
        if row_sums[i] == 0:
            transmat_init[i] = 1.0 / n_regimes  # Uniform transition
        else:
            transmat_init[i] = transmat_init[i] / row_sums[i]
    
    # 4. Initialize start probabilities: frequency of each regime at start
    startprob_init = np.zeros(n_regimes)
    for regime in range(n_regimes):
        startprob_init[regime] = (regime_array == regime).sum() / len(regime_array)
    startprob_init = startprob_init / startprob_init.sum()  # Normalize
    
    # Fit HMM using Gaussian emissions with supervised initialization
    # "diag" covariance: 6 params/state instead of 21 for "full" — avoids degeneracy
    # params="tmc": fix startprob (only affects first obs, collapses under EM on long series)
    model = hmm.GaussianHMM(
        n_components=n_regimes,
        covariance_type="diag",
        n_iter=n_iter,
        random_state=random_state,
        init_params="",  # Don't reinitialize (use our initialization)
        params="tmc"    # Learn: transmat, means, covars (startprob fixed)
    )
    
    # Set initial parameters
    model.startprob_ = startprob_init
    model.transmat_ = transmat_init
    model.means_ = means_init
    model.covars_ = covars_init
    
    # Fit model to observations (will refine parameters)
    model.fit(observations)
    
    # Get learned parameters
    transition_matrix = pd.DataFrame(
        model.transmat_,
        index=range(n_regimes),
        columns=range(n_regimes)
    )
    
    # Get most likely state sequence (Viterbi algorithm)
    most_likely_states = model.predict(observations)
    most_likely_states = pd.Series(most_likely_states, index=common_dates)
    
    # Compute log likelihood
    log_likelihood = model.score(observations)
    
    # Map HMM states to K-means regimes using optimal assignment
    # Create confusion matrix: how often each HMM state corresponds to each K-means regime
    confusion_matrix = np.zeros((n_regimes, n_regimes))
    for i, (hmm_state, km_regime) in enumerate(zip(most_likely_states, regime_labels_aligned)):
        hmm_state = int(hmm_state)
        km_regime = int(km_regime)
        if 0 <= hmm_state < n_regimes and 0 <= km_regime < n_regimes:
            confusion_matrix[hmm_state, km_regime] += 1
    
    # Find optimal 1-to-1 mapping using greedy assignment (maximize overlap)
    # This ensures each HMM state maps to exactly one K-means regime
    state_mapping = {}
    used_km_regimes = set()
    
    # Sort by overlap count (descending) to prioritize best matches
    matches = []
    for hmm_state in range(n_regimes):
        for km_regime in range(n_regimes):
            matches.append((hmm_state, km_regime, confusion_matrix[hmm_state, km_regime]))
    
    matches.sort(key=lambda x: x[2], reverse=True)
    
    # Greedy assignment: assign each HMM state to best available K-means regime
    for hmm_state, km_regime, count in matches:
        if hmm_state not in state_mapping and km_regime not in used_km_regimes:
            state_mapping[hmm_state] = km_regime
            used_km_regimes.add(km_regime)
    
    # Fill in any missing mappings (shouldn't happen, but safety check)
    for hmm_state in range(n_regimes):
        if hmm_state not in state_mapping:
            # Find best available K-means regime
            best_km = None
            best_count = -1
            for km_regime in range(n_regimes):
                if km_regime not in used_km_regimes:
                    if confusion_matrix[hmm_state, km_regime] > best_count:
                        best_count = confusion_matrix[hmm_state, km_regime]
                        best_km = km_regime
            if best_km is not None:
                state_mapping[hmm_state] = best_km
                used_km_regimes.add(best_km)
            else:
                # Last resort: identity mapping
                state_mapping[hmm_state] = hmm_state
    
    return {
        'model': model,
        'transition_matrix': transition_matrix,
        'means': model.means_,  # Mean feature values per regime
        'covariances': model.covars_,  # Covariance matrices per regime
        'startprob': model.startprob_,  # Initial state probabilities
        'most_likely_states': most_likely_states,
        'log_likelihood': log_likelihood,
        'n_regimes': n_regimes,
        'n_features': feature_matrix_aligned.shape[1],
        'state_mapping': state_mapping,  # Maps HMM states to K-means regimes
        'kmeans_labels': regime_labels_aligned  # Store original K-means labels for reference
    }


def predict_regime_probabilities_hmm(
    hmm_model: Dict,
    current_features: np.ndarray,
    horizon: int = 30
) -> pd.DataFrame:
    #Forecast future regime probabilities using HMM.
    #Uses forward algorithm to compute probabilities.
    #Returns predictions mapped to K-means regime IDs
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed")
    
    model = hmm_model['model']
    n_regimes = hmm_model['n_regimes']
    state_mapping = hmm_model.get('state_mapping', {i: i for i in range(n_regimes)})
    
    # Ensure current_features is 2D
    if current_features.ndim == 1:
        current_features = current_features.reshape(1, -1)
    
    # Get current state probabilities (using forward algorithm)
    # Compute probability of being in each state given current observation
    logprob, posteriors = model.score_samples(current_features)
    current_state_probs = posteriors[0]  # Probability distribution over states
    
    # Initialize predictions
    predictions = []
    state_probs = current_state_probs.copy()
    
    for day in range(1, horizon + 1):
        # Update state probabilities using transition matrix
        # P(state_t+1) = P(state_t) × transition_matrix
        state_probs = state_probs @ model.transmat_
        
        # Map HMM state probabilities to K-means regime probabilities
        km_probs = {}
        for hmm_state, prob in enumerate(state_probs):
            km_regime = state_mapping.get(hmm_state, hmm_state)
            if km_regime not in km_probs:
                km_probs[km_regime] = 0.0
            km_probs[km_regime] += prob
        
        # Find most likely K-means regime
        predicted_regime = max(km_probs.items(), key=lambda x: x[1])[0]
        confidence = km_probs[predicted_regime]
        
        row = {
            'day_ahead': day,
            'predicted_regime': predicted_regime,  # K-means regime ID
            'confidence': confidence
        }
        
        # Add probabilities for each K-means regime
        for regime in range(n_regimes):
            row[f'prob_regime_{regime}'] = km_probs.get(regime, 0.0)
        
        predictions.append(row)
    
    return pd.DataFrame(predictions)


def predict_next_regime_hmm(
    hmm_model: Dict,
    current_features: np.ndarray
) -> Dict:
    #Predict next regime using HMM given current features.
    #Returns predictions mapped to K-means regime IDs
    
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed")
    
    model = hmm_model['model']
    state_mapping = hmm_model.get('state_mapping', {i: i for i in range(hmm_model['n_regimes'])})
    
    # Ensure current_features is 2D
    if current_features.ndim == 1:
        current_features = current_features.reshape(1, -1)
    
    # Get state probabilities given current observation
    logprob, posteriors = model.score_samples(current_features)
    state_probs = posteriors[0]
    
    # Predict next state using transition probabilities
    next_state_probs = state_probs @ model.transmat_
    
    # Get HMM state prediction
    predicted_hmm_state = np.argmax(next_state_probs)
    confidence = next_state_probs[predicted_hmm_state]
    
    # Map to K-means regime ID
    predicted_regime = state_mapping.get(predicted_hmm_state, predicted_hmm_state)
    
    # Map all probabilities to K-means regime IDs
    km_probs = {}
    for hmm_state, prob in enumerate(next_state_probs):
        km_regime = state_mapping.get(hmm_state, hmm_state)
        if km_regime not in km_probs:
            km_probs[km_regime] = 0.0
        km_probs[km_regime] += prob
    
    return {
        'predicted_regime': predicted_regime,  # K-means regime ID
        'predicted_hmm_state': predicted_hmm_state,  # HMM internal state
        'confidence': confidence,
        'probabilities': km_probs,  # Probabilities by K-means regime ID
        'hmm_state_probs': {i: prob for i, prob in enumerate(next_state_probs)},  # HMM internal probabilities
        'current_state_probs': {i: prob for i, prob in enumerate(state_probs)}
    }


def compute_hmm_accuracy(
    hmm_model: Dict,
    feature_matrix: pd.DataFrame,
    regime_labels: pd.Series,
    test_start_idx: Optional[int] = None
) -> Dict:
    #Compute prediction accuracy of HMM on historical data.
    #Uses state mapping to compare HMM predictions to K-means regime labels
    
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed")
    
    if test_start_idx is None:
        test_start_idx = 0
    
    # Align data
    common_dates = regime_labels.index.intersection(feature_matrix.index)
    regime_labels_aligned = regime_labels.loc[common_dates]
    feature_matrix_aligned = feature_matrix.loc[common_dates]
    
    predictions = []
    actuals = []
    
    model = hmm_model['model']
    state_mapping = hmm_model.get('state_mapping', {i: i for i in range(hmm_model['n_regimes'])})

    for i in range(test_start_idx, len(regime_labels_aligned) - 1):
        current_features = feature_matrix_aligned.iloc[i:i+1].values
        actual_next_regime = int(regime_labels_aligned.iloc[i + 1])
        current_regime = int(regime_labels_aligned.iloc[i])  # Actual K-means label (reference only)

        try:
            # Infer current state from features using emission probabilities (forward algorithm)
            # This is what differentiates HMM from baseline
            logprob, posteriors = model.score_samples(current_features)
            current_state_probs = posteriors[0]  # P(state | features)

            # Predict next state using transition probabilities
            next_state_probs = current_state_probs @ model.transmat_

            # Map HMM state probabilities to K-means regimes
            km_next_probs = {}
            for hmm_state, prob in enumerate(next_state_probs):
                km_regime = state_mapping.get(hmm_state, hmm_state)
                if km_regime not in km_next_probs:
                    km_next_probs[km_regime] = 0.0
                km_next_probs[km_regime] += prob

            predicted_regime = max(km_next_probs.items(), key=lambda x: x[1])[0]
            confidence = km_next_probs[predicted_regime]
            
            predictions.append({
                'date': regime_labels_aligned.index[i],
                'current_regime': current_regime,
                'predicted_regime': int(predicted_regime),
                'actual_regime': actual_next_regime,
                'correct': int(predicted_regime) == actual_next_regime,
                'confidence': confidence
            })
            actuals.append(actual_next_regime)
        except Exception as e:
            continue
    
    if len(predictions) == 0:
        return {
            'accuracy': np.nan,
            'total_predictions': 0,
            'correct_predictions': 0,
            'mean_confidence': np.nan
        }
    
    pred_df = pd.DataFrame(predictions)
    
    # Compute accuracy metrics
    accuracy = pred_df['correct'].mean()
    mean_confidence = pred_df['confidence'].mean()
    
    # Per-regime accuracy (based on current regime)
    per_regime_accuracy = {}
    for regime in pred_df['current_regime'].unique():
        regime_mask = pred_df['current_regime'] == regime
        if regime_mask.sum() > 0:
            per_regime_accuracy[regime] = {
                'accuracy': pred_df.loc[regime_mask, 'correct'].mean(),
                'count': regime_mask.sum()
            }
    
    return {
        'accuracy': accuracy,
        'total_predictions': len(predictions),
        'correct_predictions': pred_df['correct'].sum(),
        'mean_confidence': mean_confidence,
        'per_regime_accuracy': per_regime_accuracy,
        'predictions_df': pred_df
    }


def print_hmm_prediction(
    hmm_model: Dict,
    current_features: np.ndarray,
    current_date: Optional[pd.Timestamp] = None,
    regime_label_map: Optional[Dict] = None,
    horizon: int = 30,
    actual_current_regime: Optional[int] = None
):
    #Print HMM prediction results in formatted output.
    #If actual_current_regime is provided, use it instead of inferring from features
    
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed")
    
    print("\n" + "="*70)
    print("HMM REGIME PREDICTION")
    print("="*70)
    
    if current_date:
        print(f"\nCurrent Date: {current_date.strftime('%Y-%m-%d')}")
    
    # Get current state probabilities
    if current_features.ndim == 1:
        current_features = current_features.reshape(1, -1)
    
    model = hmm_model['model']
    state_mapping = hmm_model.get('state_mapping', {i: i for i in range(hmm_model['n_regimes'])})
    kmeans_labels = hmm_model.get('kmeans_labels', None)
    
    # Use actual K-means label if provided, otherwise infer from features
    if actual_current_regime is not None:
        # Use the actual K-means regime label
        current_state = int(actual_current_regime)
        current_confidence = 1.0  # We know the actual state
        
        # Still compute HMM's inferred state for comparison
        logprob, posteriors = model.score_samples(current_features)
        inferred_state_probs = posteriors[0]
        inferred_km_probs = {}
        for hmm_state, prob in enumerate(inferred_state_probs):
            km_regime = state_mapping.get(hmm_state, hmm_state)
            if km_regime not in inferred_km_probs:
                inferred_km_probs[km_regime] = 0.0
            inferred_km_probs[km_regime] += prob
        inferred_state = max(inferred_km_probs.items(), key=lambda x: x[1])[0]
        inferred_confidence = inferred_km_probs[inferred_state]
        
        print(f"\nActual Current Regime (from K-means): Regime {current_state}")
        if regime_label_map and current_state in regime_label_map:
            print(f"  Label: {regime_label_map[current_state]}")
        print(f"\nHMM Inferred Current State: Regime {inferred_state} ({inferred_confidence:.2%} confidence)")
        if regime_label_map and inferred_state in regime_label_map:
            print(f"  Label: {regime_label_map[inferred_state]}")
        if current_state != inferred_state:
            print(f"  ⚠️  Warning: HMM inference doesn't match actual regime!")
    else:
        # Infer from features (original behavior)
        logprob, posteriors = model.score_samples(current_features)
        current_state_probs = posteriors[0]
        
        # Map HMM state probabilities to K-means regime probabilities
        km_current_probs = {}
        for hmm_state, prob in enumerate(current_state_probs):
            km_regime = state_mapping.get(hmm_state, hmm_state)
            if km_regime not in km_current_probs:
                km_current_probs[km_regime] = 0.0
            km_current_probs[km_regime] += prob
        
        # Find most likely current state (K-means regime)
        current_state = max(km_current_probs.items(), key=lambda x: x[1])[0]
        current_confidence = km_current_probs[current_state]
    
    # For prediction, use the actual current regime if provided
    # Otherwise use inferred state
    if actual_current_regime is not None:
        # Use actual regime for prediction
        # Find which HMM state corresponds to this K-means regime
        reverse_mapping = {v: k for k, v in state_mapping.items()}
        hmm_state_for_current = reverse_mapping.get(current_state, current_state)
        
        # Create a one-hot vector for the current HMM state
        current_hmm_state_probs = np.zeros(hmm_model['n_regimes'])
        current_hmm_state_probs[hmm_state_for_current] = 1.0
        
        # Predict next state using transition probabilities
        next_state_probs = current_hmm_state_probs @ model.transmat_
        
        # Map to K-means regimes
        km_next_probs = {}
        for hmm_state, prob in enumerate(next_state_probs):
            km_regime = state_mapping.get(hmm_state, hmm_state)
            if km_regime not in km_next_probs:
                km_next_probs[km_regime] = 0.0
            km_next_probs[km_regime] += prob
        
        predicted_regime = max(km_next_probs.items(), key=lambda x: x[1])[0]
        confidence = km_next_probs[predicted_regime]
        
        next_day_pred = {
            'predicted_regime': predicted_regime,
            'confidence': confidence,
            'probabilities': km_next_probs
        }
    else:
        # Use inferred state (original behavior)
        current_label = f"Regime {current_state}"
        if regime_label_map and current_state in regime_label_map:
            current_label = f"Regime {current_state} ({regime_label_map[current_state]})"
        
        print(f"\nMost Likely Current State: {current_label} ({current_confidence:.2%} confidence)")
        print(f"\nCurrent State Probabilities:")
        for regime in sorted(km_current_probs.keys()):
            prob = km_current_probs[regime]
            label = f"Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label = f"Regime {regime} ({regime_label_map[regime]})"
            print(f"  {label:<30} {prob:.2%}")
        
        # Next day prediction
        next_day_pred = predict_next_regime_hmm(hmm_model, current_features)
    next_label = f"Regime {next_day_pred['predicted_regime']}"
    if regime_label_map and next_day_pred['predicted_regime'] in regime_label_map:
        next_label = f"Regime {next_day_pred['predicted_regime']} ({regime_label_map[next_day_pred['predicted_regime']]})"
    
    print(f"\n[1] Next Day Prediction:")
    print(f"  Predicted Regime: {next_label}")
    print(f"  Confidence: {next_day_pred['confidence']:.2%}")
    print(f"\n  All Transition Probabilities:")
    for regime, prob in sorted(next_day_pred['probabilities'].items()):
        label = f"Regime {regime}"
        if regime_label_map and regime in regime_label_map:
            label = f"Regime {regime} ({regime_label_map[regime]})"
        print(f"    {label:<30} {prob:.2%}")
    
    # Horizon prediction
    if horizon > 1:
        print(f"\n[2] {horizon}-Day Horizon Prediction Sequence:")
        print("-"*70)
        print(f"{'Day':<6} {'Predicted Regime':<25} {'Confidence':<12} {'Top 2 Probabilities':<30}")
        print("-"*70)
        
        if actual_current_regime is not None:
            # Use actual regime for horizon prediction
            reverse_mapping = {v: k for k, v in state_mapping.items()}
            hmm_state_for_current = reverse_mapping.get(current_state, current_state)
            current_hmm_state_probs = np.zeros(hmm_model['n_regimes'])
            current_hmm_state_probs[hmm_state_for_current] = 1.0
            
            # Predict sequence
            predictions = []
            state_probs = current_hmm_state_probs.copy()
            
            for day in range(1, horizon + 1):
                state_probs = state_probs @ model.transmat_
                
                # Map to K-means regimes
                km_probs = {}
                for hmm_state, prob in enumerate(state_probs):
                    km_regime = state_mapping.get(hmm_state, hmm_state)
                    if km_regime not in km_probs:
                        km_probs[km_regime] = 0.0
                    km_probs[km_regime] += prob
                
                predicted_regime = max(km_probs.items(), key=lambda x: x[1])[0]
                confidence = km_probs[predicted_regime]
                
                predictions.append({
                    'day_ahead': day,
                    'predicted_regime': predicted_regime,
                    'confidence': confidence,
                    **{f'prob_regime_{r}': km_probs.get(r, 0.0) for r in range(hmm_model['n_regimes'])}
                })
            
            sequence = pd.DataFrame(predictions)
        else:
            sequence = predict_regime_probabilities_hmm(hmm_model, current_features, horizon=horizon)
        
        for _, row in sequence.iterrows():
            day = int(row['day_ahead'])
            pred_regime = int(row['predicted_regime'])
            conf = row['confidence']
            
            pred_label = f"Regime {pred_regime}"
            if regime_label_map and pred_regime in regime_label_map:
                pred_label = f"Regime {pred_regime} ({regime_label_map[pred_regime]})"
            
            # Get top 2 probabilities
            probs = {k.replace('prob_regime_', ''): v for k, v in row.items() if k.startswith('prob_regime_')}
            sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)
            top2_str = ", ".join([f"R{int(r)}:{v:.2%}" for r, v in sorted_probs[:2]])
            
            print(f"{day:<6} {pred_label:<25} {conf:<12.2%} {top2_str:<30}")
    
    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("  • HMM learns both transition AND emission probabilities")
    print("  • Uses current features to infer hidden state (regime)")
    print("  • More sophisticated than baseline (uses feature information)")
    print("  • Can detect regime changes based on feature changes")
    print("="*70)
    
    return next_day_pred


def print_hmm_model_summary(
    hmm_model: Dict,
    regime_label_map: Optional[Dict] = None
):
    #Print summary of fitted HMM model parameters.
    
    if not HMMLEARN_AVAILABLE:
        raise ImportError("hmmlearn not installed")
    
    print("\n" + "="*70)
    print("HMM MODEL SUMMARY")
    print("="*70)
    
    transition_matrix = hmm_model['transition_matrix']
    startprob = hmm_model['startprob']
    means = hmm_model['means']
    
    print(f"\nNumber of Regimes (Hidden States): {hmm_model['n_regimes']}")
    print(f"Number of Features: {hmm_model['n_features']}")
    print(f"Log Likelihood: {hmm_model['log_likelihood']:.2f}")
    
    # Transition matrix
    print("\n[1] Learned Transition Matrix:")
    print("-"*70)
    if regime_label_map:
        display_matrix = transition_matrix.copy()
        display_matrix.index = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_matrix.index]
        display_matrix.columns = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_matrix.columns]
        print(display_matrix.to_string())
    else:
        print(transition_matrix.to_string())
    
    # Initial state probabilities
    print("\n[2] Initial State Probabilities:")
    print("-"*70)
    for regime, prob in enumerate(startprob):
        label = f"Regime {regime}"
        if regime_label_map and regime in regime_label_map:
            label = f"Regime {regime} ({regime_label_map[regime]})"
        print(f"  {label:<30} {prob:.2%}")
    
    # Mean feature values per regime (emission means)
    print("\n[3] Emission Means (Average Feature Values per Regime):")
    print("-"*70)
    print("  (HMM learns what feature values are typical for each regime)")
    # This would require feature names - skip for now or add if available
    
    print("\n" + "="*70)
    
    return hmm_model
