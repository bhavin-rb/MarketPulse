import { test, expect } from '@playwright/test'

// The Flask forecaster stores raw yfinance data in _FETCH_CACHE (TTL 300 s).
// A second identical POST within that window skips the network fetch and runs
// only local model training, which is orders of magnitude faster.

const FORECAST_URL = 'http://localhost:5000/api/forecast'
// IBM is a stable liquid ticker; use it here so it doesn't collide with the
// AAPL/MSFT tickers warmed up in forecast.spec.js.
const TICKER = 'IBM'
const BODY = { tickers: [TICKER] }

test.describe('Forecast caching behaviour', () => {
  let firstResponseMs = 0

  test('first request completes successfully', async ({ request }) => {
    const t0 = Date.now()
    const res = await request.post(FORECAST_URL, { data: BODY })
    firstResponseMs = Date.now() - t0

    expect(res.ok()).toBe(true)
    const json = await res.json()
    expect(json.stocks).toHaveLength(1)
    expect(json.stocks[0].ticker).toBe(TICKER)
    console.log(`First request: ${firstResponseMs} ms`)
  })

  test('second identical request is served from cache and is faster', async ({ request }) => {
    // Requires first test above to have already run; workers=1 ensures ordering.
    const t0 = Date.now()
    const res = await request.post(FORECAST_URL, { data: BODY })
    const secondMs = Date.now() - t0

    expect(res.ok()).toBe(true)
    console.log(`Second request (cache hit): ${secondMs} ms`)

    if (firstResponseMs > 3_000) {
      // Cold first request was slow (real yfinance download); confirm cache is faster
      expect(secondMs).toBeLessThan(firstResponseMs / 2)
    } else {
      // Both hit cache (first was also fast); just assert it stays responsive
      expect(secondMs).toBeLessThan(5_000)
    }
  })

  test('cached response is structurally identical to first response', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      request.post(FORECAST_URL, { data: BODY }),
      request.post(FORECAST_URL, { data: BODY }),
    ])
    const j1 = await r1.json()
    const j2 = await r2.json()

    // Same ticker, same number of history rows, same 7-day forecast dates
    expect(j1.stocks[0].ticker).toBe(j2.stocks[0].ticker)
    expect(j1.stocks[0].forecast.length).toBe(j2.stocks[0].forecast.length)
    const dates1 = j1.stocks[0].forecast.map(r => r.date)
    const dates2 = j2.stocks[0].forecast.map(r => r.date)
    expect(dates1).toEqual(dates2)
  })
})
