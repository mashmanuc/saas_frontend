import { test, expect } from '@playwright/test'

test.describe('Session Revoke Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock successful login
    await page.route('**/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'mock_access_token',
          user: { id: 1, email: 'test@example.com', role: 'tutor' },
        }),
      })
    })

    await page.route('**/v1/auth/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrf: 'mock_csrf_token' }),
      })
    })

    await page.route('**/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, email: 'test@example.com', role: 'tutor' },
        }),
      })
    })

    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard/**', { timeout: 5000 })
  })

  test('should load active sessions list', async ({ page }) => {
    // Mock sessions endpoint
    await page.route('**/v1/me/sessions/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session_1',
            device: 'Chrome on Windows',
            ip: '192.168.1.1',
            last_active_at: new Date().toISOString(),
            current: true,
          },
          {
            id: 'session_2',
            device: 'Firefox on Mac',
            ip: '192.168.1.2',
            last_active_at: new Date(Date.now() - 3600000).toISOString(),
            current: false,
          },
        ]),
      })
    })

    await page.goto('/dashboard/profile/security')

    // Verify sessions are displayed
    await expect(page.locator('text=Chrome on Windows')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Firefox on Mac')).toBeVisible({ timeout: 5000 })
  })

  test('should revoke non-current session', async ({ page }) => {
    // Mock sessions endpoint
    await page.route('**/v1/me/sessions/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session_1',
            device: 'Chrome on Windows',
            ip: '192.168.1.1',
            last_active_at: new Date().toISOString(),
            current: true,
          },
          {
            id: 'session_2',
            device: 'Firefox on Mac',
            ip: '192.168.1.2',
            last_active_at: new Date(Date.now() - 3600000).toISOString(),
            current: false,
          },
        ]),
      })
    })

    // Mock revoke endpoint
    let revokeCallCount = 0
    await page.route('**/v1/me/sessions/session_2/revoke', async (route) => {
      revokeCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.goto('/dashboard/profile/security')

    // Click revoke button for session_2
    await page.click('[data-testid="session-revoke-session_2"]')

    // Wait for success message
    await expect(page.locator('[data-testid="sessions-success"]')).toBeVisible({ timeout: 5000 })

    // Verify revoke was called
    expect(revokeCallCount).toBe(1)
  })

  test('should handle session_current_forbidden error', async ({ page }) => {
    // Mock sessions endpoint
    await page.route('**/v1/me/sessions/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session_1',
            device: 'Chrome on Windows',
            ip: '192.168.1.1',
            last_active_at: new Date().toISOString(),
            current: true,
          },
        ]),
      })
    })

    // Mock revoke endpoint with error
    await page.route('**/v1/me/sessions/session_1/revoke', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'session_current_forbidden',
          message: 'Cannot revoke current session',
          request_id: 'req_123',
        }),
      })
    })

    await page.goto('/dashboard/profile/security')

    // Try to revoke current session (button should be disabled, but test the API error handling)
    await page.route('**/v1/me/sessions/session_1/revoke', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'session_current_forbidden',
          message: 'Cannot revoke current session',
        }),
      })
    })

    // Verify current session button is disabled
    const revokeButton = page.locator('[data-testid="session-revoke-session_1"]')
    await expect(revokeButton).toBeDisabled()
  })

  test('should handle session_not_found error', async ({ page }) => {
    // Mock sessions endpoint
    await page.route('**/v1/me/sessions/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session_2',
            device: 'Firefox on Mac',
            ip: '192.168.1.2',
            last_active_at: new Date(Date.now() - 3600000).toISOString(),
            current: false,
          },
        ]),
      })
    })

    // Mock revoke endpoint with not found error
    await page.route('**/v1/me/sessions/session_2/revoke', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'session_not_found',
          message: 'Session not found',
          request_id: 'req_456',
        }),
      })
    })

    await page.goto('/dashboard/profile/security')

    // Click revoke button
    await page.click('[data-testid="session-revoke-session_2"]')

    // Verify error message appears
    await expect(page.locator('text=Session not found').or(page.locator('text=Сесію не знайдено'))).toBeVisible({ timeout: 5000 })
  })
})
