/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html']] : [['list']],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: DEFAULT_BASE_URL,
    storageState: './tests/e2e/.auth/user.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    extraHTTPHeaders:
      process.env.PLAYWRIGHT_AUTH_TOKEN
        ? {
            Authorization: `Bearer ${process.env.PLAYWRIGHT_AUTH_TOKEN}`,
          }
        : undefined,
  },
  projects: [
    {
      name: 'ui-smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'full-e2e',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_WEB_SERVER === 'none'
      ? undefined
      : {
          command: 'npm run dev -- --host 127.0.0.1 --port 4173',
          url: DEFAULT_BASE_URL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
})
