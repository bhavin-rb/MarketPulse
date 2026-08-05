# MarketPulse — Stock Forecast Copilot

MarketPulse was created to simplify portfolio forecasting for both analysts and retail investors.  
It provides clear insights into how portfolios perform under different weighting strategies — equal weight vs. market‑cap weight — while ensuring speed, accuracy, and usability.  
The goal is to make forecasting accessible, transparent, and efficient, backed by automated testing and modern web technologies.

---

##  Features
- **Forecast API** — `/api/forecast` returns portfolio forecasts with both equal and market‑cap weights.
- **Interactive Dashboard** — Ticker search, chart rendering (Line, Bar, Pie).
- **Caching** — Cold requests ~6s, cached requests ~500ms.
- **Lazy Loading** — Charts mount only when needed; PieChart loads on tab switch.
- **Compression** — `.gz` and `.br` assets served in production build.

---

## Integration Tests
Integration tests are implemented with Playwright under `tests/integration/`:
- **[Dashboard tests](ca://s?q=Dashboard_tests_with_Playwright)** — headings, form fields, cold load.
- **[Forecast tests](ca://s?q=Forecast_tests_with_Playwright)** — single/multi‑ticker, chart rendering, API validation, market‑cap weights.
- **[Caching tests](ca://s?q=Caching_tests_with_Playwright)** — cold vs cached response times.
- **[Lazy loading tests](ca://s?q=Lazy_loading_tests_with_Playwright)** — charts mount only when needed.
- **[Compression tests](ca://s?q=Compression_tests_with_Playwright)** — verifies `.gz/.br` assets.

Run tests with:
```bash
npm test

Clone the repo:
git clone https://github.com/bhavin-rb/MarketPulse.git
cd MarketPulse

Install Python dependencies:
pip install -r requirements.txt

Install frontend dependencies:
npm install

Start locally:
./start.ps1
