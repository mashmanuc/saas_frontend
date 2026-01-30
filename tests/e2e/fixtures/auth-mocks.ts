import { Page } from '@playwright/test'

export async function mockAuthEndpoints(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    const request = route.request()
    const postData = request.postDataJSON()
    
    if (postData.email === 'locked@example.com') {
      await route.fulfill({
        status: 423,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'account_locked',
          message: 'Акаунт тимчасово заблоковано',
          details: {
            locked_until: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
      })
    } else if (postData.email === 'mfa-user@example.com') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mfa_required: true,
          session_id: 'test-mfa-session-123',
        }),
      })
    } else if (postData.email === 'test@example.com' && postData.password === 'password') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'test-access-token',
          user: {
            id: 1,
            email: 'test@example.com',
            role: 'student',
            first_name: 'Test',
            last_name: 'User',
          },
        }),
      })
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'invalid_credentials',
          message: 'Невірний email або пароль',
        }),
      })
    }
  })

  await page.route('**/api/v1/auth/mfa/verify', async (route) => {
    const postData = route.request().postDataJSON()
    
    if (postData.otp === '123456') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'test-access-token-mfa',
          user: {
            id: 2,
            email: 'mfa-user@example.com',
            role: 'tutor',
            first_name: 'MFA',
            last_name: 'User',
          },
        }),
      })
    } else {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'mfa_invalid_code',
          message: 'Невірний код підтвердження',
        }),
      })
    }
  })

  await page.route('**/api/v1/auth/request-account-unlock', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
      }),
    })
  })

  await page.route('**/api/v1/auth/confirm-account-unlock', async (route) => {
    const postData = route.request().postDataJSON()
    
    if (postData.token === 'valid-unlock-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
        }),
      })
    } else {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'invalid_token',
          message: 'Невірний або прострочений токен',
        }),
      })
    }
  })

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        csrf: 'test-csrf-token',
      }),
    })
  })

  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        email: 'test@example.com',
        role: 'student',
        first_name: 'Test',
        last_name: 'User',
      }),
    })
  })
}
