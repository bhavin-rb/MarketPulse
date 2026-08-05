import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/integration',
  // Generous timeout: yfinance calls can take 20-30 s on a cold start
  timeout: 120_000,
  expect: { timeout: 90_000 },
  // Run files sequentially so the Flask in-memory cache is shared across tests
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      // Flask backend — Python adds backend/ to sys.path so forecaster imports work
      command: 'python backend/app.py',
      port: 5000,
      timeout: 30_000,
      reuseExistingServer: true,
    },
    {
      command: 'npm --prefix frontend run dev',
      port: 5173,
      timeout: 30_000,
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
