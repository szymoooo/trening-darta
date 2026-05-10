import { defineConfig, devices } from '@playwright/test';

// In CI we only run chromium (to fit the 15-minute job budget).
// Locally all browsers run by default.
const isCI = !!process.env.CI;

const allProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 45_000,
  reporter: [
    ['html', { outputFolder: 'test-report', open: 'never' }],
    ['list'],
    ['./tests/fixtures/screenshot-reporter.ts'],
  ],
  outputDir: './test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: isCI ? [allProjects[0]] : allProjects,
  webServer: {
    command: 'npx http-server . -p 5500 -c-1 --silent',
    port: 5500,
    reuseExistingServer: !isCI,
  },
});

