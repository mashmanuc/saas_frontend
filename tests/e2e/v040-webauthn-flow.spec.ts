import { test, expect } from '@playwright/test'
import { setupWebAuthnMocks } from './fixtures/webauthn-mocks'

/**
 * v0.40.0 - WebAuthn Flow Tests
 * Tests WebAuthn credential registration, authentication, and management
 */

test.describe('WebAuthn Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup WebAuthn backend mocks
    await setupWebAuthnMocks(page)
    
    // Mock WebAuthn API
    await page.addInitScript(() => {
      // @ts-ignore
      window.PublicKeyCredential = class {
        static async isUserVerifyingPlatformAuthenticatorAvailable() {
          return true
        }
      }

      // @ts-ignore
      navigator.credentials = {
        create: async () => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {
            clientDataJSON: new Uint8Array([5, 6, 7, 8]).buffer,
            attestationObject: new Uint8Array([9, 10, 11, 12]).buffer,
          },
        }),
        get: async () => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {
            clientDataJSON: new Uint8Array([5, 6, 7, 8]).buffer,
            authenticatorData: new Uint8Array([9, 10, 11, 12]).buffer,
            signature: new Uint8Array([13, 14, 15, 16]).buffer,
            userHandle: new Uint8Array([17, 18, 19, 20]).buffer,
          },
        }),
      }
    })

    await page.goto('/auth/login')
  })

  test('should show WebAuthn prompt on login when required', async ({ page }) => {
    // Mock API response with webauthn_required
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          webauthn_required: true,
          session_id: 'test-session-123',
        }),
      })
    })

    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    await page.click('[data-testid="login-submit-button"]')

    // WebAuthn prompt should appear
    await expect(page.locator('text=WebAuthn')).toBeVisible()
  })

  test('should allow fallback to OTP from WebAuthn', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          webauthn_required: true,
          session_id: 'test-session-123',
        }),
      })
    })

    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    await page.click('[data-testid="login-submit-button"]')

    // Click fallback to OTP
    await page.click('text=Use OTP instead')

    // OTP input should appear
    await expect(page.locator('[data-testid="login-otp-input"]')).toBeVisible()
  })

  test('should register new WebAuthn credential', async ({ page }) => {
    // Login first
    await page.goto('/dashboard/profile/security')

    await page.route('**/api/v1/auth/webauthn/register', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'cred-123',
          device_label: 'Test Device',
          last_used_at: Date.now(),
          created_at: Date.now(),
        }),
      })
    })

    // Click enroll button
    await page.click('text=Add Security Key')

    // Enrollment modal should appear
    await expect(page.locator('text=Register WebAuthn')).toBeVisible()

    // Complete enrollment
    await page.fill('[data-testid="device-label-input"]', 'My Security Key')
    await page.click('text=Register')

    // Success message
    await expect(page.locator('text=successfully added')).toBeVisible()
  })

  test('should revoke WebAuthn credential', async ({ page }) => {
    await page.goto('/dashboard/profile/security')

    await page.route('**/api/v1/auth/webauthn/credentials/cred-123/revoke/', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ removed: true }),
      })
    })

    // Click revoke on a credential
    await page.click('[data-testid="webauthn-revoke-cred-123"]')

    // Confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Success message
    await expect(page.locator('text=removed')).toBeVisible()
  })

  test('should handle WebAuthn errors with request_id', async ({ page }) => {
    await page.route('**/api/v1/auth/webauthn/verify', async (route) => {
      await route.fulfill({
        status: 422,
        body: JSON.stringify({
          error: 'webauthn_invalid_assertion',
          message: 'Invalid WebAuthn assertion',
          request_id: 'req-error-123',
        }),
      })
    })

    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    await page.click('[data-testid="login-submit-button"]')

    // Error should show request_id
    await expect(page.locator('text=Request ID: req-error-123')).toBeVisible()
  })
})
