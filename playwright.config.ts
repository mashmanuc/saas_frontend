/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  reporter: process.env.CI ? [['list'], ['html']] : [['list']],
  globalSetup: process.env.PLAYWRIGHT_PROJECT === 'ui-smoke' ? undefined : './tests/e2e/global-setup.ts',
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
      testDir: './tests/ui',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: DEFAULT_BASE_URL,
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'full-e2e',
      testMatch: /.*\.spec\.ts/,
      testIgnore: [
        /.*\.smoke\.spec\.ts/,
        'tests/e2e/calendar/**/*.spec.ts',
        'tests/e2e/calendar-suite/**/*.spec.ts',
        'tests/e2e/prod-smoke/**/*.spec.ts',
        'tests/e2e/staff/**/*.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/.auth/user.json',
      },
    },
    {
      name: 'staff-e2e',
      testMatch: ['tests/e2e/staff/**/*.spec.ts'],
      fullyParallel: false,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        // CRITICAL: Staff tests MUST use dedicated staff.json auth state.
        // DO NOT change to user.json or remove storageState.
        // This prevents ENOENT errors and login-form regressions.
        storageState: './tests/e2e/.auth/staff.json',
      },
    },
    {
      name: 'calendar-e2e',
      testMatch: [
        'tests/e2e/calendar/**/*.spec.ts',
        'tests/e2e/calendar-suite/**/*.spec.ts',
      ],
      fullyParallel: false,
      retries: process.env.CI ? 1 : 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || DEFAULT_BASE_URL,
        storageState: './tests/e2e/.auth/user.json',
      },
    },
    {
      name: 'prod-smoke',
      testMatch: ['tests/e2e/prod-smoke/**/*.spec.ts'],
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_WEB_SERVER === 'none'
      ? undefined
      : {
          command: 'npm run dev -- --host 127.0.0.1 --port 5173',
          url: DEFAULT_BASE_URL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          // FE-9: Retry ping to ensure server is ready before tests
          stdout: 'pipe',
          stderr: 'pipe',
        },
})
