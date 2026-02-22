# Frontend Integration Plan

**Date:** February 20, 2026
**Goal:** Integrate the React/TypeScript frontend with the regime detection & prediction backend

---

## Current State Analysis

### Frontend (React + TypeScript + Vite)
✅ **Built with Loveable**
- Dashboard layout with shadcn/ui components
- Pages: Index, Correlation, Volatility, Factors, Upload, Settings
- Charts: Recharts library
- Data fetching: TanStack Query
- UI: Radix UI + Tailwind CSS

### Backend (Python)
✅ **Regime Detection & Prediction System**
- Regime clustering (K-means, K=4)
- Feature engineering (vol, correlation, PCA)
- 4 prediction models (Markov, HMM, RF, XGBoost)
- Comprehensive evaluation metrics
- 10 visualization outputs

### Gap
❌ No API layer connecting frontend to backend
❌ Frontend using mock/hardcoded data
❌ No real-time regime predictions
❌ No data upload/processing pipeline

---

## Integration Phases

### **Phase 1: API Layer** (Priority: HIGH)
Build FastAPI backend to serve regime data

**Tasks:**
1. Create FastAPI application
2. Endpoints for:
   - GET `/api/regimes/current` - Current regime state
   - GET `/api/regimes/history` - Historical regime labels
   - GET `/api/predictions/forecast` - Future regime predictions (1/7/30d)
   - GET `/api/predictions/comparison` - All 4 models comparison
   - GET `/api/metrics/summary` - Dashboard metrics
   - GET `/api/features/importance` - Feature importances
   - GET `/api/correlations/matrix` - Correlation heatmap data
   - POST `/api/upload/data` - Upload new stock data
   - POST `/api/analysis/run` - Trigger regime analysis
3. CORS configuration for local development
4. Data serialization (pandas → JSON)
5. Error handling & logging

**Files to create:**
- `api/main.py` - FastAPI app
- `api/routes/` - Route modules
- `api/models.py` - Pydantic models
- `api/utils.py` - Helper functions

**Estimated time:** 2-3 hours

---

### **Phase 2: Frontend Data Layer** (Priority: HIGH)
Replace mock data with real API calls

**Tasks:**
1. Create API client (`frontend/src/lib/api.ts`)
2. Define TypeScript types matching backend responses
3. Create TanStack Query hooks:
   - `useCurrentRegime()`
   - `useRegimeHistory()`
   - `usePredictions()`
   - `useMetrics()`
   - `useFeatureImportance()`
4. Replace hardcoded data in components
5. Add loading states & error handling

**Files to modify:**
- `frontend/src/lib/api.ts` (new)
- `frontend/src/hooks/useRegimeData.ts` (new)
- `frontend/src/pages/Index.tsx`
- `frontend/src/components/dashboard/*`

**Estimated time:** 2-3 hours

---

### **Phase 3: Regime Dashboard** (Priority: HIGH)
Show real regime data on dashboard

**Tasks:**
1. Update MetricCard with real metrics:
   - Current regime label (Calm/Crisis/Elevated Stress/Transition)
   - Regime confidence score
   - Days in current regime
   - Next regime prediction
2. Update VolatilityGauge with real regime indicator
3. Add regime timeline chart (actual vs predicted)
4. Update correlation heatmap with real data
5. Add regime transition probability chart

**Components to update:**
- `MetricCard.tsx` - Real regime metrics
- `VolatilityGauge.tsx` - Real regime confidence
- `TimeSeriesChart.tsx` - Add regime overlay
- `CorrelationHeatmap.tsx` - Real correlation data
- Create `RegimeTimeline.tsx` (new)

**Estimated time:** 2-3 hours

---

### **Phase 4: Prediction Dashboard** (Priority: MEDIUM)
Show all 4 prediction models side-by-side

**Tasks:**
1. Create new page: `PredictionsPage.tsx`
2. Components:
   - `ModelComparison.tsx` - Accuracy table (4 models)
   - `PredictionTimeline.tsx` - Predicted vs actual (from visualizations)
   - `ConfusionMatrix.tsx` - Per-model confusion matrices
   - `ConfidenceChart.tsx` - Confidence over time
3. Add route in `App.tsx`
4. Add navigation link in sidebar

**Files to create:**
- `frontend/src/pages/PredictionsPage.tsx`
- `frontend/src/components/predictions/ModelComparison.tsx`
- `frontend/src/components/predictions/PredictionTimeline.tsx`
- `frontend/src/components/predictions/ConfusionMatrix.tsx`
- `frontend/src/components/predictions/ConfidenceChart.tsx`

**Estimated time:** 3-4 hours

---

### **Phase 5: Data Upload & Processing** (Priority: MEDIUM)
Allow users to upload data and run analysis

**Tasks:**
1. Backend endpoint: `POST /api/upload/data`
2. Backend endpoint: `POST /api/analysis/run`
3. Update `UploadPage.tsx`:
   - File upload UI (drag & drop)
   - CSV validation
   - Progress indicator
   - Result preview
4. Trigger regime analysis after upload
5. Show analysis status (processing → complete)

**Files to modify:**
- `api/routes/upload.py` (new)
- `frontend/src/pages/UploadPage.tsx`
- `frontend/src/components/upload/FileUploader.tsx` (new)

**Estimated time:** 2-3 hours

---

### **Phase 6: Feature Analysis Pages** (Priority: LOW)
Enhance Correlation, Volatility, Factors pages

**Tasks:**
1. **CorrelationPage:**
   - Real correlation matrix over time
   - Correlation distribution chart
   - Top/bottom correlations

2. **VolatilityPage:**
   - Realized volatility timeseries
   - Volatility dispersion chart
   - Regime-conditioned volatility

3. **FactorsPage:**
   - PCA loadings visualization
   - Cumulative variance explained
   - Feature importance by regime

**Files to modify:**
- `frontend/src/pages/CorrelationPage.tsx`
- `frontend/src/pages/VolatilityPage.tsx`
- `frontend/src/pages/FactorsPage.tsx`

**Estimated time:** 3-4 hours

---

### **Phase 7: Polish & UX Improvements** (Priority: LOW)
Improve design and user experience

**Tasks:**
1. Add regime color coding (Calm=green, Crisis=red, etc.)
2. Add tooltips with explanations
3. Improve loading skeletons
4. Add error boundaries
5. Responsive design improvements
6. Dark mode tweaks
7. Add onboarding tour
8. Performance optimization

**Estimated time:** 2-3 hours

---

## Total Estimated Time
- **Phase 1-3 (HIGH):** 6-9 hours → **Core functionality**
- **Phase 4-5 (MEDIUM):** 5-7 hours → **Advanced features**
- **Phase 6-7 (LOW):** 5-7 hours → **Polish**
- **Total:** 16-23 hours (2-3 days of focused work)

---

## Recommended Approach

### **Session 1 (Now): Phase 1 - API Layer**
1. Create FastAPI app structure
2. Build core endpoints (regimes, predictions, metrics)
3. Test endpoints with curl/Postman
4. Document API responses

**Output:** Working API serving regime data

### **Session 2: Phase 2 - Frontend Data Layer**
1. Create API client
2. Add TanStack Query hooks
3. Replace mock data in 2-3 components
4. Test data flow

**Output:** Frontend consuming real data

### **Session 3: Phase 3 - Regime Dashboard**
1. Update all dashboard components
2. Add regime timeline
3. Polish UI

**Output:** Functional regime dashboard

### **Session 4+: Phases 4-7**
1. Build prediction dashboard
2. Add upload functionality
3. Enhance feature pages
4. Polish UX

**Output:** Production-ready application

---

## Technology Stack

### Backend
- **Framework:** FastAPI
- **Data:** pandas, numpy
- **ML:** scikit-learn, xgboost
- **Serialization:** pydantic
- **Server:** uvicorn

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **UI:** shadcn/ui + Radix UI + Tailwind CSS
- **Charts:** Recharts
- **Data Fetching:** TanStack Query
- **Routing:** React Router v6

### Integration
- **API:** RESTful JSON API
- **CORS:** Enabled for localhost:5173
- **Data Format:** JSON (pandas → dict/records)

---

## Next Steps

**I recommend we start with Phase 1 (API Layer) right now.** I'll:
1. Create the FastAPI app structure
2. Build core endpoints to serve regime data
3. Test that it works
4. Then we can assess and move to Phase 2

Sound good?
