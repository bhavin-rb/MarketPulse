# Deployment Guide — MarketPulse

## Project Vision
MarketPulse simplifies portfolio forecasting for analysts and retail investors.  
It provides insights into equal‑weight vs. market‑cap weighting strategies, with speed, accuracy, and usability backed by automated testing.

---

##  Publishing Requirements

### 1. Market Cap Weighting
- `/api/forecast` must return both `weights.equal` and `weights.marketcap`.
- Market cap values are already fetched in `forecaster.py`; integrate them into portfolio weighting logic in `app.py`.
- Frontend toggle must consume these weights directly from the forecast response.
- Portfolio logic must respect whichever weights are active.

### 2. Playwright Integration Tests
- Tests under `tests/integration/` must cover:
  - Launching Flask app and visiting dashboard.
  - Triggering `/api/forecast` with multiple tickers and verifying charts render.
  - Checking caching behavior (cold vs cached response times).
  - Validating lazy loading of charts (LineChart, BarChart, PieChart).
  - Confirming compressed assets (`.gz/.br`) are served in production build.
- All Playwright tests must be run before deployment, and all must pass.
- Minor issues may be fixed automatically, but forecasting logic must not be changed.

### 3. Deployment Notes
- **Platform**: Render (Flask backend + Vite frontend).
- **Ports**: Flask runs on `5000`, Vite dev server on `5173`.
- **Environment Variables**:
  - `FLASK_ENV=production`
  - `PORT=5000`
  - `CACHE_TIMEOUT=300` (matches `_FETCH_CACHE_TTL_SECONDS`)
  - `LOG_LEVEL=INFO`
- **Build Commands**:
  - Backend: `pip install -r requirements.txt`
  - Frontend: `npm install && npm run build`
- **Start Command**:
  ```bash
  gunicorn app:app --bind 0.0.0.0:$PORT
