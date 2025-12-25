/**
 * WebAuthn Mock Fixtures для E2E тестів
 * Тимчасові моки для endpoints, які не реалізовані у dev backend
 */

import { Page } from '@playwright/test'

export interface WebAuthnMockOptions {
  enabled?: boolean
}

/**
 * Налаштувати WebAuthn моки для сторінки
 */
export async function setupWebAuthnMocks(page: Page, options: WebAuthnMockOptions = {}) {
  const { enabled = true } = options

  if (!enabled) {
    return
  }

  // Mock WebAuthn challenge endpoint
  await page.route('**/api/v1/auth/webauthn/challenge', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challenge: 'mock-challenge-' + Date.now(),
          session_id: 'mock-session-' + Date.now(),
          timeout: 60000,
          user_verification: 'preferred'
        })
      })
    } else {
      await route.continue()
    }
  })

  // Mock WebAuthn credentials endpoint
  await page.route('**/api/v1/auth/webauthn/credentials/**', async (route) => {
    const method = route.request().method()
    
    if (method === 'GET') {
      // List credentials
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          credentials: [
            {
              id: 'mock-credential-1',
              name: 'Test Device',
              created_at: new Date().toISOString(),
              last_used_at: new Date().toISOString()
            }
          ]
        })
      })
    } else if (method === 'DELETE') {
      // Revoke credential
      await route.fulfill({
        status: 204
      })
    } else {
      await route.continue()
    }
  })

  // Mock WebAuthn verify endpoint
  await page.route('**/api/v1/auth/webauthn/verify', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'mock-access-token',
          user: {
            id: 1,
            email: 'm3@gmail.com',
            role: 'tutor'
          }
        })
      })
    } else {
      await route.continue()
    }
  })

  // Mock WebAuthn register endpoint
  await page.route('**/api/v1/auth/webauthn/register', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          credential_id: 'mock-credential-' + Date.now(),
          message: 'WebAuthn credential registered successfully'
        })
      })
    } else {
      await route.continue()
    }
  })

  console.log('[webauthn-mocks] ✓ WebAuthn mocks enabled')
}

/**
 * Відключити WebAuthn моки
 */
export async function disableWebAuthnMocks(page: Page) {
  await page.unroute('**/api/v1/auth/webauthn/**')
  console.log('[webauthn-mocks] ✓ WebAuthn mocks disabled')
}

/**
 * Mock для WebAuthn помилки з request_id
 */
export async function mockWebAuthnError(page: Page, errorCode: string = 'webauthn_failed') {
  await page.route('**/api/v1/auth/webauthn/**', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error_code: errorCode,
        message: 'WebAuthn authentication failed',
        request_id: 'req-error-' + Date.now()
      })
    })
  })
}
