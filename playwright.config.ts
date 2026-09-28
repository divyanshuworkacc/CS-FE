import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', timeout: 30000, fullyParallel: true, workers: 2,
  use: {
    baseURL: 'http://localhost:5173', ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
})
