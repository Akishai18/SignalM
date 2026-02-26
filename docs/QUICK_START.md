# 🚀 Quick Start Guide

**Run this to get the full stack running:**

---

## Step 1: Start API Server

**Terminal 1:**
```bash
cd /Users/akishai/Downloads/Quant-Project-1

# Start the API server
.venv/bin/uvicorn api.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Test it works:**
```bash
# In another terminal
curl http://localhost:8000/api/health
```

Should return: `{"status":"healthy","data_loaded":true,...}`

---

## Step 2: Start Frontend

**Terminal 2:**
```bash
cd /Users/akishai/Downloads/Quant-Project-1/frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

**Expected output:**
```
  VITE v5.4.19  ready in 543 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 3: Open Browser

Navigate to: **http://localhost:5173**

---

## ⚠️ Common Issues

### Issue: "Failed to Load Data"

**Cause:** Frontend can't connect to API

**Fixes:**

1. **Make sure API is running on port 8000:**
   ```bash
   curl http://localhost:8000/
   ```
   Should return `{"status":"healthy",...}`

2. **Restart frontend dev server:**
   ```bash
   # Stop frontend (Ctrl+C)
   # Then restart
   npm run dev
   ```

3. **Check browser console:**
   - Open DevTools (F12 or Cmd+Option+I)
   - Look for CORS errors or network errors
   - If you see "net::ERR_CONNECTION_REFUSED", API isn't running

4. **Verify .env.local exists:**
   ```bash
   cat frontend/.env.local
   ```
   Should show: `VITE_API_URL=http://localhost:8000`

---

### Issue: API returns 500 error

**Cause:** Data files not found

**Fix:**
```bash
# Check data files exist
ls -l regime_results/regime_labels_k4.csv
ls -l regime_results/regime_features_normalized.csv

# If missing, run regime clustering
PYTHONPATH=src .venv/bin/python src/regime/run_regime_clustering.py
```

---

### Issue: CORS errors in browser

**Cause:** API not allowing frontend origin

**Fix:** Already configured! Check API logs for CORS-related messages.

---

## 🧪 Quick Health Check

**Run these commands to verify everything:**

```bash
# Test 1: API responding
curl http://localhost:8000/

# Test 2: Health check
curl http://localhost:8000/api/health

# Test 3: Current regime
curl http://localhost:8000/api/regimes/current

# Test 4: Dashboard metrics
curl http://localhost:8000/api/metrics/summary
```

All should return JSON responses (no errors).

---

## 📊 What You Should See

**When working correctly:**

1. **API Terminal:**
   ```
   INFO:     127.0.0.1:xxxxx - "GET /api/regimes/current HTTP/1.1" 200 OK
   INFO:     127.0.0.1:xxxxx - "GET /api/metrics/summary HTTP/1.1" 200 OK
   ```

2. **Browser:**
   - Green "Live" indicator (top right)
   - Current regime showing (e.g., "Calm")
   - Real metrics loaded (not "..." or "Loading")
   - No red error messages

3. **Browser Console (F12):**
   - No red errors
   - Should see successful API requests in Network tab

---

## 🎯 Complete Setup (First Time)

**One-time setup if starting fresh:**

```bash
# 1. Install Python dependencies
cd /Users/akishai/Downloads/Quant-Project-1
.venv/bin/pip install -r requirements.txt

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Make sure regime data exists
cd ..
ls regime_results/regime_labels_k4.csv
# If not found, run: PYTHONPATH=src .venv/bin/python src/main.py

# 4. Start both servers (in separate terminals)
# Terminal 1: .venv/bin/uvicorn api.main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev
```

---

## ✅ Success Checklist

- [ ] API responds to `curl http://localhost:8000/`
- [ ] Frontend loads at `http://localhost:5173`
- [ ] Green "Live" indicator showing
- [ ] Current regime displays (e.g., "Calm")
- [ ] Metrics show real numbers (not "...")
- [ ] Correlation heatmap renders
- [ ] Feature importance shows top 5 features
- [ ] Browser console shows no errors

**If all checked, you're good to go!** 🎉

---

## 🆘 Still Not Working?

1. **Check both terminals for errors**
2. **Look at browser console (F12) → Console tab**
3. **Check Network tab for failed requests**
4. **Make sure ports 8000 and 5173 aren't in use:**
   ```bash
   lsof -i :8000
   lsof -i :5173
   ```

If you see the process, kill it and restart:
```bash
kill -9 <PID>
```
