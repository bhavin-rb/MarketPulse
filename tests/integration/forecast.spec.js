import { test, expect } from '@playwright/test'

// Helper: type tickers and submit, then wait for charts to be visible.
// Returns when the first .recharts-responsive-container is visible.
async function submitForecast(page, tickerStr) {
  await page.locator('#tickers').fill(tickerStr)
  // Dismiss any autocomplete dropdown so it doesn't intercept the button click
  await page.keyboard.press('Escape')
  await page.locator('button.btn-forecast').click()
  // "Loading..." message confirms the request is in-flight
  await expect(page.locator('.loading-msg')).toBeVisible({ timeout: 5_000 })
  // Wait until the loading message disappears (API call complete)
  await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 110_000 })
}

test.describe('Single-stock forecast — AAPL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await submitForecast(page, 'AAPL')
  })

  test('renders one stock card', async ({ page }) => {
    await expect(page.locator('.stock-card')).toHaveCount(1)
  })

  test('stock card heading shows ticker symbol', async ({ page }) => {
    await expect(page.locator('.stock-card h2').first()).toContainText('AAPL')
  })

  test('LineChart SVG is rendered', async ({ page }) => {
    // Each stock card has two chart sections: LineChart + BarChart
    const lineSvg = page.locator('.chart-section svg').first()
    await expect(lineSvg).toBeVisible()
  })

  test('BarChart SVG is rendered', async ({ page }) => {
    // recharts-responsive-container: 1 per chart (avoids counting inline legend SVGs)
    const charts = page.locator('.recharts-responsive-container')
    await expect(charts).toHaveCount(2) // LineChart + BarChart
  })

  test('no portfolio section for single ticker', async ({ page }) => {
    // "Consolidated Portfolio Forecast" only appears for ≥ 2 tickers
    await expect(page.locator('text=Consolidated Portfolio Forecast')).toHaveCount(0)
  })

  test('Weights tab is disabled for single ticker', async ({ page }) => {
    const weightsTab = page.locator('.tab-button', { hasText: 'Weights' })
    await expect(weightsTab).toBeDisabled()
  })

  test('reset clears results', async ({ page }) => {
    await page.locator('button.btn-reset').click()
    await expect(page.locator('.results')).toHaveCount(0)
    await expect(page.locator('#tickers')).toHaveValue('')
  })
})

test.describe('Multi-stock forecast — AAPL, MSFT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await submitForecast(page, 'AAPL, MSFT')
  })

  test('renders two individual stock cards plus portfolio card', async ({ page }) => {
    // 2 individual stock cards + 1 consolidated portfolio = 3 total
    await expect(page.locator('.stock-card')).toHaveCount(3)
  })

  test('portfolio card is visible', async ({ page }) => {
    await expect(page.locator('text=Consolidated Portfolio Forecast').first()).toBeVisible()
  })

  test('LineChart and BarChart render for each stock', async ({ page }) => {
    // 2 stocks × 2 charts (line+bar) = 4, plus 1 portfolio LineChart = 5 total
    const charts = page.locator('.recharts-responsive-container')
    await expect(charts).toHaveCount(5)
  })

  test('Weights tab is enabled for multiple tickers', async ({ page }) => {
    const weightsTab = page.locator('.tab-button', { hasText: 'Weights' })
    await expect(weightsTab).toBeEnabled()
  })

  test('API response weights sum to 1 for two stocks', async ({ page }) => {
    // Intercept the API response to verify weight values
    const response = await page.evaluate(async () => {
      const res = await fetch('http://localhost:5000/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: ['AAPL', 'MSFT'] }),
      })
      return res.json()
    })
    const total = Object.values(response.weights).reduce((s, w) => s + w, 0)
    expect(total).toBeCloseTo(1, 2)
  })

  test('forecast contains 7 days for each stock', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('http://localhost:5000/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: ['AAPL', 'MSFT'] }),
      })
      return res.json()
    })
    for (const stock of response.stocks) {
      expect(stock.forecast).toHaveLength(7)
    }
  })

  test('switching to Weights tab shows PieChart', async ({ page }) => {
    await page.locator('.tab-button', { hasText: 'Weights' }).click()
    // PieChart is in the Weights tab
    const pieSvg = page.locator('.stock-card svg').last()
    await expect(pieSvg).toBeVisible()
  })

  test('market-cap preset button is visible in Weights tab', async ({ page }) => {
    await page.locator('.tab-button', { hasText: 'Weights' }).click()
    await expect(page.locator('.control-btn', { hasText: 'Market Cap Weight' })).toBeVisible()
  })

  test('market-cap weights sum to 100 percent', async ({ page }) => {
    await page.locator('.tab-button', { hasText: 'Weights' }).click()
    await page.locator('.control-btn', { hasText: 'Market Cap Weight' }).click()

    // Read displayed weight inputs for each ticker
    const inputs = page.locator('.weight-number-input')
    const count = await inputs.count()
    let total = 0
    for (let i = 0; i < count; i++) {
      const val = await inputs.nth(i).inputValue()
      total += parseInt(val, 10)
    }
    // Must sum to exactly 100 (last stock absorbs rounding remainder)
    expect(total).toBe(100)
  })
})

test.describe('API validation', () => {
  test('returns 400 when tickers field is missing', async ({ request }) => {
    const res = await request.post('http://localhost:5000/api/forecast', {
      data: {},
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 400 when tickers list is empty', async ({ request }) => {
    const res = await request.post('http://localhost:5000/api/forecast', {
      data: { tickers: [] },
    })
    expect(res.status()).toBe(400)
  })

  test('returns error for clearly invalid ticker', async ({ request }) => {
    const res = await request.post('http://localhost:5000/api/forecast', {
      data: { tickers: ['ZZZZZ_NOT_A_REAL_TICKER_XYZ'] },
    })
    // 404 (not found) or 500 (data error) are both acceptable; must not be 200
    expect(res.status()).not.toBe(200)
  })
})
