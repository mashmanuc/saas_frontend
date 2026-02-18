/// <reference types="node" />
// [WB:B7.2] Playwright Visual Regression — Configuration
// Ref: TASK_BOARD_PHASES.md B7.2, Production Hardening
//
// Separate config for visual regression tests to avoid
// interfering with functional E2E tests.

import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173'

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  // Create baselines on first run
  updateSnapshots: 'missing',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,

  expect: {
    toHaveScreenshot: {
      // 1% pixel diff tolerance (anti-aliasing, font rendering)
      maxDiffPixelRatio: 0.01,
      // Color threshold (0-1, lower = stricter)
      threshold: 0.2,
      // Animation settling time
      animations: 'disabled',
    },
  },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'tests/visual/report' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Consistent rendering
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Europe/Kyiv',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],

  webServer: {
    command: 'npm run preview -- --port 4173',
    url: BASE_URL,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
