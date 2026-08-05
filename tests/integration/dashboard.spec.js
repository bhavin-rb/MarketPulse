import { test, expect } from '@playwright/test'

test.describe('Dashboard initial load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page title and heading are visible', async ({ page }) => {
    await expect(page).toHaveTitle(/Quantify|Stock Forecast/i)
    await expect(page.locator('h1')).toContainText('Stock Forecast Dashboard')
  })

  test('subtitle is visible', async ({ page }) => {
    await expect(page.locator('.subtitle')).toContainText('7-day ML forecast')
  })

  test('ticker input and forecast button are present', async ({ page }) => {
    await expect(page.locator('#tickers')).toBeVisible()
    await expect(page.locator('button.btn-forecast')).toBeVisible()
    await expect(page.locator('button.btn-forecast')).toBeEnabled()
  })

  test('optional start-date field is present', async ({ page }) => {
    await expect(page.locator('#start-date')).toBeVisible()
  })

  test('no chart SVGs are present before submitting', async ({ page }) => {
    // Charts are lazy-loaded; nothing should be in DOM on cold load
    await expect(page.locator('.chart-section svg')).toHaveCount(0)
  })

  test('no results section before submitting', async ({ page }) => {
    await expect(page.locator('.results')).toHaveCount(0)
  })

  test('navbar shows System Online status', async ({ page }) => {
    await expect(page.locator('.navbar-status')).toContainText('System Online')
  })
})
