import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-report' }],
    ['list'],
    ['./tests/fixtures/screenshot-reporter.ts'],
  ],
  outputDir: './test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',
    trace: 'on-first-retry',
    screenshot: 'on', // capture screenshot after every test
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npx http-server . -p 5500 -c-1 --silent',
    port: 5500,
    reuseExistingServer: !process.env.CI,
  },
});
