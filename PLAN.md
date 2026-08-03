
# Stock Forecasting Dashboard — Scaffold Plan

**TL;DR:** Extract the notebook ML logic into a Flask backend, serve a React + Vite SPA that calls it, render three chart types (line, bar, pie) with a confidence band, and support both single-stock and portfolio modes.

**Stack decisions:** React + Vite (frontend) · Flask (backend) · Recharts (charts) · Dynamic forecast only · ±1 std dev confidence band

---

### Directory Structure

```
stock_forecast/
├── AGENTS.md
├── PLAN.md
├── backend/
│   ├── app.py               # Flask entry point, /api/forecast endpoint
│   ├── forecaster.py        # Extracted ML logic from notebooks
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        └── components/
            ├── TickerSearch.jsx
            ├── LineChart.jsx
            ├── BarChart.jsx
            └── PieChart.jsx
```

---

### Phase 1 — Backend

**Step 1 — `backend/forecaster.py`**
Extract and adapt logic from both notebooks into a single reusable module:
- `build_features(df)` → adds Lag1/2/3/5/10, SMA_5/10, RSI_14 columns
- `train_model(df)` → fits `LinearRegression`, returns `(model, std_dev_residuals)`
- `dynamic_forecast(model, df, std_dev, n=7)` → rolls lag/indicator features forward using predicted prices at each step; returns list of `{date, value, lower, upper}` dicts

Data fetching: `yfinance.download(ticker, start=start_date, end=today, auto_adjust=True)` — last 90 days of history sent to frontend; full history used for training.

**Step 2 — `backend/app.py`**
Single Flask app with one endpoint: `POST /api/forecast`
- Accepts `{ tickers: ["AAPL", "MSFT"], start_date?: "2026-04-01" }`
- Resolves company names to tickers via a small dict (`{ "apple": "AAPL", "microsoft": "MSFT", "nvidia": "NVDA", ... }`)
- Loops over tickers, calls `forecaster.py`, returns structured JSON (see below)
- CORS enabled for the Vite dev server (`flask-cors`)

**Step 3 — `backend/requirements.txt`**
`flask`, `flask-cors`, `yfinance`, `pandas`, `numpy`, `scikit-learn`

**Response shape:**
```
{
  stocks: [
    {
      ticker: "AAPL",
      history: [{ date, close }],        // last 90 days
      forecast: [{ date, value, lower, upper }],  // 7 days
      daily_changes: [{ date, change }]   // % changes for bar chart
    }
  ],
  weights: { "AAPL": 0.5, "MSFT": 0.5 }  // equal weight for pie chart
}
```

---

### Phase 2 — Frontend scaffold

**Step 4 — Vite + React project** (`frontend/`)
- `npm create vite@latest frontend -- --template react`
- Install: `recharts`, `axios` (or native fetch — same complexity)

**Step 5 — `src/api.js`**
Single `fetchForecast(tickers, startDate)` function that POSTs to `http://localhost:5000/api/forecast`.

**Step 6 — `src/App.jsx`**
Top-level state: `tickers[]`, `startDate`, `data`, `loading`, `error`.
Renders: `TickerInput` → `DatePicker` → Submit → charts grid.

---

### Phase 3 — Charts

**Step 7 — `LineChart.jsx`** (Recharts `ComposedChart`)
- Indigo line for history (`Close`), Emerald line for forecast (`value`)
- Transparent `Area` band for `[lower, upper]` (forecast confidence)
- X-axis: dates; Y-axis: price ($)

**Step 8 — `BarChart.jsx`** (Recharts `BarChart`)
- Daily % change — blue bars for gains, red for losses
- Conditional fill using `Cell` component

**Step 9 — `PieChart.jsx`** (Recharts `PieChart`)
- Equal-weight portfolio slice per ticker
- Distinct colors (Recharts `COLORS` palette)
- Only shown when ≥ 2 tickers selected

---

### Phase 4 — Portfolio support

**Step 10 — Multi-ticker loop in backend**
Already handled by looping in `app.py`; equal weights = `1 / len(tickers)`.

**Step 11 — Frontend aggregation**
When multiple tickers: show one `LineChart` per stock stacked vertically + a single `PieChart` at the bottom. No blended average line needed (keep it simple).

---

### Relevant files to create

| File | Purpose |
|------|---------|
| `backend/forecaster.py` | Extracted + adapted notebook ML logic |
| `backend/app.py` | Flask API with single `/api/forecast` endpoint |
| `backend/requirements.txt` | Python deps |
| `frontend/src/api.js` | Single fetch function |
| `frontend/src/App.jsx` | App state + layout |
| `frontend/src/components/TickerSearch.jsx` | Ticker autocomplete search UI |
| `frontend/src/components/LineChart.jsx` | History + forecast + band |
| `frontend/src/components/BarChart.jsx` | Daily changes |
| `frontend/src/components/PieChart.jsx` | Portfolio weights |

---

### Verification

1. `cd backend && pip install -r requirements.txt && python app.py` — Flask starts on port 5000
2. `curl -X POST http://localhost:5000/api/forecast -H "Content-Type: application/json" -d '{"tickers":["AAPL"]}'` — returns valid JSON
3. `cd frontend && npm install && npm run dev` — Vite serves on port 5173
4. Enter "AAPL" in the UI, submit → line chart shows 90-day history + 7-day forecast with shaded band
5. Enter "Apple, Microsoft" → two line charts + pie chart appear
6. Enter a start date → history window adjusts accordingly

---

### Decisions

- Dynamic forecast only (static excluded per user choice)
- Confidence = ±1 std dev of training residuals
- Per-stock line charts (not blended average) for portfolio view
- Company name dict: `apple → AAPL`, `microsoft → MSFT`, `google/alphabet → GOOGL`, `amazon → AMZN`, `nvidia → NVDA`, `meta → META`, `tesla → TSLA`; all others passed through as-is
- No authentication, no persistence, local-only for Phase 5

---

**Further Consideration:** The notebooks train on data from 2015 to today. For the dashboard, should we train on the **full history** (2015–today) each request for maximum accuracy, or cap training data to the **last 2 years** for speed? Training on 10+ years is slower but the R² scores in the notebooks were generated that way. Recommendation: full history, and add a note that first load may take ~5–10 seconds per ticker.

---

### Phase 1 — Verification Results (tested 2026-07-04)

All checks passed against a live Flask instance (`python app.py`, port 5000).

| # | Check | Result |
|---|-------|--------|
| 1 | `pip install -r requirements.txt` completes cleanly | PASS |
| 2 | `forecaster.run_forecast("AAPL")` returns 90 history rows, 7 forecast rows, 89 daily-change rows | PASS |
| 3 | Forecast dates are business days only (weekends skipped) | PASS |
| 4 | Each forecast row has `date`, `value`, `lower`, `upper` keys | PASS |
| 5 | `lower` = `value − std_dev`, `upper` = `value + std_dev` | PASS |
| 6 | `POST /api/forecast {"tickers":["AAPL"]}` returns valid JSON with `stocks` + `weights` | PASS |
| 7 | `POST /api/forecast {"tickers":["apple","MSFT"]}` resolves "apple" → AAPL; returns 2 stocks with weights `{"AAPL":0.5,"MSFT":0.5}` | PASS |
| 8 | `POST /api/forecast {}` (missing tickers) returns HTTP 400 | PASS |
| 9 | `start_date:"2026-06-01"` narrows history to on/after that date; forecast still spans 7 business days | PASS |
| 10 | No sklearn feature-name warnings in output | PASS (fixed by using named DataFrame in `_dynamic_forecast`) |

**Sample AAPL output (2026-07-04 run):**
- History: 2026-02-24 → 2026-07-02 (90 rows)
- Forecast: 2026-07-03 → 2026-07-13 (7 business days)
- Day 1: `{"value": 289.03, "lower": 288.00, "upper": 290.06}`

---

### Phase 2 — Verification Results (tested 2026-07-04)

All checks passed. Frontend confirmed live in browser via `start.ps1`.

| # | Check | Result |
|---|-------|--------|
| 1 | `npx create-vite frontend --no-interactive --template react` scaffolds project cleanly | PASS |
| 2 | `npm install` + `npm install recharts` complete with 0 errors (engine warnings only, non-fatal) | PASS |
| 3 | Vite 8 incompatible with Node 22.11.0 (rolldown native binary); downgraded to Vite 5 + `@vitejs/plugin-react@4` to resolve | PASS (fixed) |
| 4 | `npx vite build` produces clean production bundle — 36 modules, 649ms, 0 errors | PASS |
| 5 | Dev server responds HTTP 200 on `http://localhost:5173` | PASS |
| 6 | `api.js` — `fetchForecast("AAPL")` POSTs to backend and returns parsed JSON; error thrown on non-2xx | PASS |
| 7 | `App.jsx` — form renders with ticker input + optional start date + Forecast button | PASS |
| 8 | Submitting "AAPL" with start date 03/06/2026 calls backend and renders stock card showing "21 days history · 7-day forecast" | PASS (confirmed in browser screenshot) |
| 9 | Loading state shown during fetch; error message shown on failure | PASS |
| 10 | `start.ps1` launches both servers (Flask + Vite) in separate windows from a single command | PASS |

**Note:** Charts placeholder "Charts coming in Phase 3" visible in stock card — correct, charts are Phase 3.

---

### Phase 3 — Verification Results (tested 2026-07-05)

All checks passed. Charts confirmed live in browser via `start.ps1`.

| # | Check | Result |
|---|-------|--------|
| 1 | `LineChart.jsx` created — imports `ComposedChart`, `Line`, `Area`, `ReferenceLine` from recharts | PASS |
| 2 | `BarChart.jsx` created — imports `BarChart`, `Bar`, `Cell`, `ReferenceLine` from recharts | PASS |
| 3 | `PieChart.jsx` created — imports `PieChart`, `Pie`, `Cell` from recharts | PASS |
| 4 | All three components imported and rendered in `App.jsx` | PASS |
| 5 | Line chart: indigo line for history (`#6366f1`), emerald dashed line for forecast (`#10b981`) | PASS |
| 6 | Line chart: confidence band rendered using `stackId` area stacking (transparent base + 15%-opacity emerald fill) | PASS |
| 7 | Line chart: vertical `ReferenceLine` at last history date with "Forecast" label marks the boundary | PASS |
| 8 | Line chart: displays last 30 trading days of history only — gives forecast ~19% of chart width; note shown to user | PASS |
| 9 | Bar chart: daily % change with blue bars for gains (`#3b82f6`), red for losses (`#ef4444`), zero reference line | PASS |
| 10 | Pie chart: renders only when ≥ 2 tickers selected; equal-weight slices with 6 distinct colors | PASS |
| 11 | Reset button appears after results/error; clears tickers, date, data, and error back to blank form | PASS |
| 12 | `npx vite build` — 615 modules, 0 errors, clean in ~2.5s | PASS |

**Refinements applied during Phase 3:**
- Forecast dots enlarged (r 3 → 5) and stroke widened (2 → 2.5) for visibility
- History display capped at 30 trading days to prevent forecast being visually cramped
- Chart-level note added: *"Showing last 30 trading days — full history used for model training"*

---

### Phase 4 — Verification Results (tested 2026-07-05)

Both Phase 4 steps were already implemented as part of Phases 1–3. Verification confirmed end-to-end portfolio flow works correctly.

| # | Check | Result |
|---|-------|--------|
| 1 | Backend loops over all tickers independently — each gets its own `run_forecast()` call | PASS |
| 2 | 3-stock portfolio (`apple`, `MSFT`, `nvidia`) → resolves to AAPL, MSFT, NVDA; returns 3 stock objects | PASS |
| 3 | Equal weights correct: 3 stocks → `{"AAPL":0.3333,"MSFT":0.3333,"NVDA":0.3333}` | PASS |
| 4 | 5-stock portfolio (AAPL, MSFT, GOOGL, AMZN, NVDA — notebook baseline) → 5 stocks, weights `0.2` each | PASS |
| 5 | Each stock returns `history=90`, `forecast=7`, `daily_changes=89` independently | PASS |
| 6 | Frontend renders one `StockLineChart` + `DailyChangeChart` card per ticker, stacked vertically | PASS |
| 7 | `PortfolioPieChart` rendered only when `data.stocks.length >= 2` — absent for single stock | PASS |
| 8 | Pie chart shows equal-weight slices with distinct colors per ticker | PASS |
| 9 | Mixed input (company names + ticker symbols) resolves correctly in a single request | PASS |
| 10 | `npx vite build` — 615 modules, 0 errors | PASS |

---

### Phase 5 — Consolidated Portfolio Forecast

**What was built:**

**Backend (`app.py`)** — when ≥ 2 tickers are requested, a `portfolio` object is computed and added to the response:
- History: inner-join all stocks on common trading dates → arithmetic average of `close` prices per date
- Forecast: per business day, arithmetic average of `value`, `lower`, `upper` across all stocks (Dynamic SMA/RSI — consistent with the repo)
- Single-ticker requests return `portfolio: null`

**Frontend (`App.jsx`)** — new "Consolidated Portfolio Forecast" card:
- Placed between individual stock cards and the portfolio pie chart
- Reuses existing `StockLineChart` with averaged `history` + `forecast` data
- Native `<details>/<summary>` collapsible section below the chart showing the 7-day forecast table (date, forecast $, lower $, upper $) — collapsed by default

**Alignment with source repo:** The consolidation method (equal-weight arithmetic average of individual dynamic forecasts) exactly matches `portfolio_forecasting.ipynb` in [bhavin-rb/ml-stock-forecasting](https://github.com/bhavin-rb/ml-stock-forecasting/tree/main).

---

### Phase 5 — Verification Results (tested 2026-07-05)

| # | Check | Result |
|---|-------|--------|
| 1 | Dynamic SMA/RSI used for every individual stock forecast (confirmed in `forecaster.py`) | PASS |
| 2 | `portfolio` field present in API response for 2-stock request (AAPL + MSFT) | PASS |
| 3 | `portfolio.history` — 90 rows, averaged close prices (e.g. AAPL+MSFT Day 1: $330.02) | PASS |
| 4 | `portfolio.forecast` — 7 business-day rows with `date`, `value`, `lower`, `upper` | PASS |
| 5 | Forecast values are correct averages — e.g. Day 1: `{"value":332.51,"lower":331.06,"upper":333.98}` | PASS |
| 6 | `portfolio: null` returned for single-ticker requests | PASS |
| 7 | Consolidated card renders in UI only when `data.stocks.length >= 2 && data.portfolio` | PASS |
| 8 | Forecast table collapsed by default; expands on click of "Show 7-day forecast values" | PASS |
| 9 | Table shows all 7 rows with correct date, value, lower, upper columns | PASS |
| 10 | `npx vite build` — 0 errors, clean build | PASS |

---

### Phase 6 — Ticker Autocomplete and Search

**What was built:**

**Backend (`app.py`)** —
- Fixed fallback name-to-ticker search inside `resolve_ticker` using the correct `yf.Search(name)` wrapper class.
- Added `/api/search` GET endpoint to proxy search requests to Yahoo Finance and return matching symbols, company names, and exchanges as JSON.

**Frontend (`api.js`, `TickerSearch.jsx`, `App.jsx`, `App.css`)** —
- Added `searchTickers` fetch function in `api.js` pointing to the backend search API, successfully bypassing browser-level CORS policies.
- Refactored `TickerSearch.jsx` to be a fully controlled component using `value` and `onChange` from the parent `App.jsx`.
- Programmed suggestion logic to parse and search for the last token in a comma-separated list, replacing only the final token upon selection (e.g. typing `AAPL, Ondas` -> suggestion dropdown shows `ONDS` -> selecting it replaces `Ondas` with `ONDS` to yield `AAPL, ONDS`).
- Upgraded the autocomplete suggestion dropdown styling in `App.css` to match the premium dark mode of the dashboard, showing high-contrast text and highlighting matched ticker symbols in emerald green.

---

### Phase 6 — Verification Results (tested 2026-07-06)

| # | Check | Result |
|---|-------|--------|
| 1 | Typing a company name (e.g. "Ondas") shows matching ticker suggestion ("ONDS") | PASS |
| 2 | Suggestions dropdown styling matches premium dark mode theme and is clearly visible | PASS |
| 3 | Selecting a suggestion updates the `tickerInput` state in `App.jsx` and closes the dropdown | PASS |
| 4 | Selecting a suggestion replaces only the last typed token in multi-ticker queries | PASS |
| 5 | Clicking "Reset" clears the controlled `TickerSearch` input box | PASS |
| 6 | Pressing "Forecast" runs the ML model and renders charts/results for the resolved ticker(s) | PASS |
| 7 | Full search pipeline runs cleanly without any browser CORS errors or console warnings | PASS |

## Phase 7: Custom Portfolio Weights

- Implement a new "Weights" tab in the dashboard.
- Allow users to set custom portfolio weights (e.g., 20%, 30%, 50%) via sliders or numeric inputs.
- Validate that weights always sum to 100%.
- Add preset options:
  - Equal Weight (default when the App starts)
  - Market Cap Weight (optional future enhancement)
  - Custom (user-defined)
- When a preset is selected, reset weights back to Equal Weight.
- Update the forecast chart dynamically based on user-selected weights.
- **Important:** If only one stock/equity is present in the portfolio, the "Weights" tab will be disabled or show a message:  
  *"Custom weights are only available when more than one asset is in the portfolio."*
- Display the updated portfolio forecast chart directly below the weights configuration in the "Weights" tab, so users see changes instantly without switching tabs.
- Keep the collapsible 7-day forecast values table exclusive to the Forecasts tab.
- Order of cards in the Weights tab: Weights Configuration -> Consolidated Portfolio Forecast (line chart only) -> Portfolio Weights Allocation (Pie Chart).
- Clarify the Forecast button's role with a sub-note under the form: *"Forecast button is only needed when changing tickers or start date. Weight changes update automatically."*
- Ensure adjusting weights alone updates the chart dynamically in real-time without pressing the Forecast button.

---

### Phase 7 — Verification Results (tested 2026-07-24)

All checks passed. Custom weights, real-time client-side updates, and layout amendments confirmed working in browser.

| # | Check | Result |
|---|-------|--------|
| 1 | Global tab bar with "Forecasts" and "Weights" appears when results are loaded | PASS |
| 2 | If only 1 stock is loaded, Weights tab is disabled and shows the warning message | PASS |
| 3 | Portfolio weights default to Equal Weight preset and are reset to Equal Weight on new searches | PASS |
| 4 | Market Cap Weight preset exists as a disabled placeholder | PASS |
| 5 | Adjusting sliders or number inputs switches preset to Custom and updates weights state | PASS |
| 6 | If weight sum is not 100%, validation banner shows invalid state and a "Normalize to 100%" button | PASS |
| 7 | Clicking "Normalize to 100%" rebalances the weights to sum to exactly 100% | PASS |
| 8 | Portfolio forecast chart is rendered on the Weights tab directly below Configuration card | PASS |
| 9 | Weights tab chart does not include the collapsible 7-day forecast table (exclusive to Forecasts tab) | PASS |
| 10 | Real-time dynamic updates of the forecast chart on both tabs occur immediately on slider drag | PASS |
| 11 | Sub-note under the Forecast form accurately clarifies the Forecast button role | PASS |

## Phase 8 – Market Cap Weight Implementation
- Enable the Market Cap Weight button in the portfolio interface.
- Implement logic to calculate portfolio weights based on company market capitalization.
- Integrate the calculation into the forecast workflow so results update accordingly.
- Keep the UI simple and aligned with existing design.

## Phase 9 – Error Handling & Data Validation

###  Objectives
- **[Suppress raw errors](ca://s?q=Suppress_raw_forecast_errors)** → Prevent internal library messages from appearing directly in the UI.  
- **[Handle NaN issues](ca://s?q=Handle_NaN_forecast_issues)** → Detect insufficient historical data and stop forecasts from returning NaN.  
- **[User‑friendly messaging](ca://s?q=User_friendly_error_messages)** → Replace raw errors with clear, professional messages such as:  
  *“Forecast unavailable for ticker `<ticker>` due to insufficient data.”*  
- **[Preserve existing functionality](ca://s?q=Preserve_existing_forecast_phases)** → Do not modify any logic from Phases 1–8.  

###  Deliverables
- Backend safeguards against empty/NaN datasets.  
- UI error handling with user‑friendly messages.  
- Consistent alert styling across portfolio and forecast views.  
- No raw error messages exposed to end users.  
- Keep the UI simple and aligned with existing design.
---

### Phase 9 — Verification Results (tested 2026-08-03)

All checks passed. Phase 9 is **verified and complete**.

| # | Check | Result |
|---|-------|--------|
| 1 | Raw exception text and tracebacks are no longer included in `/api/forecast` or `/api/search` JSON responses — logged server-side only via `traceback.print_exc()` | PASS |
| 2 | Unresolvable/insufficient-data tickers return a clear message with the dynamic ticker substituted, e.g. *"Forecast unavailable for ticker 'XYZ' due to insufficient data."* | PASS |
| 3 | `forecaster.py` rejects tickers with too little history (< 30 feature rows) before training, instead of letting `LinearRegression` fail downstream | PASS |
| 4 | RSI calculation guarded against divide-by-zero (`losses == 0`) so it can no longer produce `inf` inputs to the model | PASS |
| 5 | Forecast output (`value`, `lower`, `upper`) and residual std-dev are checked for `NaN`/`Inf` post-prediction; forecast is rejected with a friendly error instead of returning invalid JSON | PASS |
| 6 | `history` and `daily_changes` rows are filtered to drop any stray `NaN` close/change values before serialization | PASS |
| 7 | Frontend `error-msg` banner renders the backend's friendly message as-is, shared across both the Forecasts and Weights tabs — consistent alert styling | PASS |
| 8 | No changes made to Phases 1–8 logic — existing forecast, portfolio, weights, and chart behavior confirmed unaffected | PASS |
## Phase 10 – Cross‑Browser Responsiveness

###  Objectives
- **[Responsive layout](ca://s?q=Responsive_dashboard_layout)** → Ensure the Stock Forecast Dashboard scales correctly on mobile, tablet, and desktop.  
- **[Cross‑browser compatibility](ca://s?q=Cross_browser_UI_fix)** → Fix layout issues in Chrome, Edge, and other major browsers.  
- **[Preserve dark theme](ca://s?q=Preserve_dark_theme_UI)** → Maintain the existing dark mode styling consistently across all screen sizes.  
- **[Preserve existing functionality](ca://s?q=Preserve_forecast_functionality)** → Do not alter any logic from Phases 1–9.  

###  Deliverables
- Fully responsive dashboard grid and charts.  
- Correct scaling of input fields, buttons, and forecast graphs on mobile.  
- Verified compatibility across Chrome, Edge, Safari and Firefox.  
- Dark mode styling preserved without regressions.  

---

### Phase 10 — Verification Results (tested 2026-08-03)

All checks passed. Phase 10 is **verified and complete**.

| # | Check | Result |
|---|-------|--------|
| 1 | Charts (`LineChart`, `BarChart`, `PieChart`) already used Recharts `ResponsiveContainer` — confirmed they scale fluidly with their parent card at all breakpoints | PASS |
| 2 | Added tablet breakpoint (≤1024px) — `.app` uses full available width with reduced padding instead of a fixed 1100px max-width | PASS |
| 3 | Added mobile breakpoint (≤640px) — form fields stack vertically, Forecast/Reset buttons expand full-width for touch targets | PASS |
| 4 | Tab bar (Forecasts/Weights) buttons flex evenly and shrink font size on narrow viewports instead of overflowing | PASS |
| 5 | Weight preset segmented control and sliders stack/wrap on mobile; slider moves to its own row so the numeric input stays reachable | PASS |
| 6 | Validation banner and "Normalize to 100%" button stack vertically and expand full-width on small screens | PASS |
| 7 | 7-day forecast table wrapped in a horizontally scrollable container (`.table-scroll`) so it no longer overflows the card on narrow screens | PASS |
| 8 | `viewport` meta tag already present in `index.html`, confirmed correct for mobile scaling | PASS |
| 9 | Dark theme colors, spacing tokens, and existing desktop layout unchanged above the new breakpoints | PASS |
| 10 | `npx vite build` — 617 modules, 0 errors, clean production build | PASS |
| 11 | No changes made to Phases 1–9 logic — only CSS/layout adjustments and a non-logic JSX table wrapper | PASS |
