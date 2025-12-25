import { test, expect } from '@playwright/test'
import { setupWebAuthnMocks } from './fixtures/webauthn-mocks'

test.describe('v0.41 WebAuthn Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Setup WebAuthn backend mocks
    await setupWebAuthnMocks(page)
  })

  test('should complete full WebAuthn login flow with challenge', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
    // Mock WebAuthn API
    await page.evaluate(() => {
      (window.navigator as any).credentials = {
        get: async () => ({
          id: 'credential-id-123',
          rawId: new ArrayBuffer(32),
          response: {
            clientDataJSON: new ArrayBuffer(128),
            authenticatorData: new ArrayBuffer(64),
            signature: new ArrayBuffer(64),
            userHandle: new ArrayBuffer(16),
          },
          type: 'public-key',
        }),
      }
    })
    
    // Submit login
    await page.click('button[type="submit"]')
    
    // Wait for WebAuthn prompt
    await expect(page.locator('text=WebAuthn')).toBeVisible({ timeout: 5000 })
    
    // Click authenticate button
    await page.click('button:has-text("Authenticate")')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('should handle WebAuthn errors with request_id', async ({ page }) => {
    await page.goto('/auth/login')
    
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
    // Mock WebAuthn error
    await page.evaluate(() => {
      (window.navigator as any).credentials = {
        get: async () => {
          throw new Error('webauthn_replay_detected')
        },
      }
    })
    
    await page.click('button[type="submit"]')
    await page.click('button:has-text("Authenticate")')
    
    // Should show error with request_id
    await expect(page.locator('text=Request ID:')).toBeVisible({ timeout: 5000 })
  })

  test('should manage credentials with audit info', async ({ page }) => {
    await page.goto('/dashboard/profile/security')
    
    // Should show credentials list
    await expect(page.locator('text=WebAuthn Credentials')).toBeVisible()
    
    // Click remove on first credential
    await page.click('[data-testid^="webauthn-revoke-"]')
    
    // Confirm removal
    page.on('dialog', dialog => dialog.accept())
    
    // Should show success with request_id
    await expect(page.locator('text=Request ID:')).toBeVisible({ timeout: 5000 })
  })
})
