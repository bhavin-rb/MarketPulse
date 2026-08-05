import { test, expect } from '@playwright/test'

// The three chart components (LineChart, BarChart, PieChart) are imported with
// React.lazy(), meaning their JS chunks are not fetched until the <Suspense>
// boundary is first activated.  Before a forecast is submitted the `data`
// state is null, so the Suspense subtree is never mounted and chart SVGs must
// be absent from the DOM entirely.

test.describe('Chart lazy loading', () => {
  test('no chart SVGs exist on initial page load', async ({ page }) => {
    await page.goto('/')
    // Give React a moment to fully hydrate
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.chart-section svg')).toHaveCount(0)
  })

  test('no recharts containers on initial page load', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // recharts wraps every chart in a div with this class
    await expect(page.locator('.recharts-responsive-container')).toHaveCount(0)
  })

  test('LineChart loads only after forecast completes', async ({ page }) => {
    await page.goto('/')

    // Capture the network requests for chart chunks; lazy loading fires a
    // dynamic import which fetches a JS chunk from the dev server.
    const chartChunkRequests = []
    page.on('request', req => {
      if (req.url().includes('LineChart') || req.url().includes('chunk')) {
        chartChunkRequests.push(req.url())
      }
    })

    // Verify no chart is in the DOM before submission
    await expect(page.locator('.chart-section svg')).toHaveCount(0)

    // Submit a forecast
    await page.locator('#tickers').fill('AAPL')
    await page.keyboard.press('Escape')
    await page.locator('button.btn-forecast').click()
    await expect(page.locator('.loading-msg')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 110_000 })

    // LineChart SVG must now be present
    await expect(page.locator('.chart-section svg').first()).toBeVisible()
  })

  test('BarChart loads together with LineChart after forecast', async ({ page }) => {
    await page.goto('/')
    await page.locator('#tickers').fill('AAPL')
    await page.keyboard.press('Escape')
    await page.locator('button.btn-forecast').click()
    await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 110_000 })

    // Single stock: 1 LineChart + 1 BarChart = 2 chart containers
    await expect(page.locator('.recharts-responsive-container')).toHaveCount(2)
  })

  test('PieChart loads only when Weights tab is activated', async ({ page }) => {
    await page.goto('/')
    await page.locator('#tickers').fill('AAPL, MSFT')
    await page.keyboard.press('Escape')
    await page.locator('button.btn-forecast').click()
    await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 110_000 })

    // The "Portfolio Weights Allocation" card (containing PieChart) is exclusively
    // in the Weights tab — it must NOT exist in the Forecasts tab (default tab).
    const pieSection = page.locator('.stock-card', { hasText: 'Portfolio Weights Allocation' })
    await expect(pieSection).not.toBeVisible()

    // Switch to Weights tab
    await page.locator('.tab-button', { hasText: 'Weights' }).click()

    // PieChart section must now be visible (lazy component loaded on demand)
    await expect(pieSection).toBeVisible()
    await expect(pieSection.locator('.recharts-responsive-container')).toBeVisible()
  })

  test('charts disappear after reset', async ({ page }) => {
    await page.goto('/')
    await page.locator('#tickers').fill('AAPL')
    await page.keyboard.press('Escape')
    await page.locator('button.btn-forecast').click()
    await expect(page.locator('.loading-msg')).not.toBeVisible({ timeout: 110_000 })
    await expect(page.locator('.chart-section svg').first()).toBeVisible()

    await page.locator('button.btn-reset').click()
    await expect(page.locator('.chart-section svg')).toHaveCount(0)
  })
})
