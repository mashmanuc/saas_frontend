import { test, expect } from '@playwright/test'
import { setupWebAuthnMocks } from './fixtures/webauthn-mocks'

test.describe('WebAuthn & MFA Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup WebAuthn mocks
    await setupWebAuthnMocks(page)
    
    // Navigate to login page
    await page.goto('/auth/login')
  })

  test('should show WebAuthn prompt when webauthn_required', async ({ page }) => {
    // Mock login response with webauthn_required
    await page.route('**/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          webauthn_required: true,
          session_id: 'mock_session_123',
        }),
      })
    })

    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Verify WebAuthn prompt appears
    await expect(page.locator('text=WebAuthn')).toBeVisible({ timeout: 5000 })
  })

  test('should fallback to OTP from WebAuthn prompt', async ({ page }) => {
    // Mock login response with webauthn_required
    await page.route('**/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          webauthn_required: true,
          session_id: 'mock_session_123',
        }),
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for WebAuthn prompt
    await expect(page.locator('text=WebAuthn')).toBeVisible({ timeout: 5000 })

    // Click fallback to OTP
    await page.click('text=OTP')

    // Verify OTP input appears
    await expect(page.locator('[data-testid="login-otp-input"]')).toBeVisible({ timeout: 5000 })
  })

  test('should handle MFA step-up flow', async ({ page }) => {
    // Mock login response with mfa_required
    await page.route('**/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mfa_required: true,
          session_id: 'mock_mfa_session',
        }),
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Verify OTP step appears
    await expect(page.locator('[data-testid="login-otp-input"]')).toBeVisible({ timeout: 5000 })
  })

  test('should display session_revoked error and logout', async ({ page }) => {
    // First, mock successful login
    await page.route('**/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'mock_access_token',
          user: { id: 1, email: 'test@example.com', role: 'student' },
        }),
      })
    })

    // Mock CSRF endpoint
    await page.route('**/v1/auth/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrf: 'mock_csrf_token' }),
      })
    })

    // Force refresh endpoint to return session_revoked
    await page.route('**/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'session_revoked',
          message: 'Сесію відкликано.',
          request_id: 'req_refresh_revoked',
        }),
      })
    })

    // Mock /me endpoint
    await page.route('**/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, email: 'test@example.com', role: 'student' },
        }),
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect after login (student role -> /student)
    await page.waitForURL(/\/student(\/|$)/, { timeout: 5000 })

    // Now mock a session_revoked error on next API call
    await page.route('**/v1/**', async (route) => {
      if (route.request().url().includes('/auth/')) {
        await route.continue()
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'session_revoked',
            message: 'Сесію відкликано.',
            request_id: 'req_123',
          }),
        })
      }
    })

    // Trigger an API call that will return session_revoked
    await page.reload()

    // Verify user is logged out (redirected to login)
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })
})
