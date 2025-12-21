import { test, expect } from '@playwright/test'

test.describe('Auth + Security (smoke)', () => {
  test('login switches to OTP step when API requires MFA', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mfa_required: true, session_id: 'test-mfa-session' }),
      })
    })

    await page.goto('/auth/login')

    await page.getByTestId('login-email-input').fill('mfa.user@example.com')
    await page.getByTestId('login-password-input').fill('password123')
    await page.getByRole('button', { name: /sign in|login|увійти/i }).click()

    await expect(page.getByTestId('login-otp-input')).toBeVisible()
  })

  test('sessions revoke shows success toast/message and reloads list', async ({ page }) => {
    // Must bypass auth guard
    await page.addInitScript(() => {
      window.localStorage.setItem('access', 'test-access-token')
      window.localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, role: 'student', first_name: 'Test', last_name: 'User', email: 'test@example.com' })
      )
    })

    // Mock sessions list
    let revoked = false

    await page.route('**/api/v1/me/sessions/**', async (route) => {
      const url = route.request().url()

      // Revoke
      if (url.includes('/revoke')) {
        revoked = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
        return
      }

      // List sessions
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sess_current',
            device: 'Chrome',
            ip: '127.0.0.1',
            current: true,
            last_active_at: new Date().toISOString(),
          },
          {
            id: 'sess_other',
            device: 'Firefox',
            ip: '10.0.0.2',
            current: false,
            last_active_at: new Date().toISOString(),
          },
        ]),
      })
    })

    // Avoid any backend calls during page boot that might fail in CI.
    await page.route('**/api/v1/realtime/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ws_host: null }),
      })
    })

    // Router guard bootstraps profile store for /dashboard/profile/*
    await page.route('**/api/me/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, role: 'student', first_name: 'Test', last_name: 'User', email: 'test@example.com' },
          profile: {},
          settings: { timezone: 'UTC' },
          avatar_url: null,
        }),
      })
    })

    await page.route('**/api/v1/auth/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrf_token: 'test-csrf' }),
      })
    })

    // We don't need a real login; session page calls are mocked.
    await page.goto('/dashboard/profile/security')

    const otherSessionButton = page.getByTestId('session-revoke-sess_other')
    await expect(otherSessionButton).toBeVisible()
    await otherSessionButton.click()

    await expect(page.getByTestId('sessions-success')).toBeVisible()
    expect(revoked).toBe(true)
  })
})
