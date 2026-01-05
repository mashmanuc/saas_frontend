import { Page } from '@playwright/test'

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'm3@gmail.com'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'demo1234'

export interface LoginViaApiOptions {
  email?: string
  password?: string
}

/**
 * Надійна авторизація через API без UI-взаємодій.
 * Логіниться через POST /v1/auth/login, зберігає access + user у localStorage,
 * потім переходить на вказаний URL.
 */
export async function loginViaApi(
  page: Page,
  options: LoginViaApiOptions = {}
): Promise<{ access: string; user: any }> {
  const email = options.email || TEST_USER_EMAIL
  const password = options.password || TEST_USER_PASSWORD

  // 1. Логін через API
  const loginResponse = await page.request.post(`${API_BASE_URL}/v1/auth/login`, {
    data: { email, password }
  })

  if (!loginResponse.ok()) {
    const errorData = await loginResponse.json().catch(() => ({}))
    throw new Error(
      `Login via API failed: ${loginResponse.status()} - ${JSON.stringify(errorData)}`
    )
  }

  const loginData = await loginResponse.json()
  const { access, user, mfa_required, webauthn_required } = loginData

  if (mfa_required || webauthn_required) {
    throw new Error(
      `User ${email} requires MFA/WebAuthn. Please use a test user without 2FA for E2E tests.`
    )
  }

  if (!access || !user) {
    throw new Error('Login response missing access token or user data')
  }

  // 2. Отримати CSRF token (опціонально)
  try {
    await page.request.post(`${API_BASE_URL}/v1/auth/csrf`, {
      headers: { Authorization: `Bearer ${access}` }
    })
  } catch (err) {
    // CSRF може бути не обов'язковим, не ламаємо флоу
  }

  // 3. Перейти на baseURL, щоб прив'язати localStorage до правильного origin
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'
  await page.goto(baseURL)

  // 4. Записати токени у localStorage (ключі 'access' та 'user', як у authStore)
  await page.evaluate(
    ([token, serializedUser]) => {
      window.localStorage.setItem('access', token)
      window.localStorage.setItem('user', serializedUser)
    },
    [access, JSON.stringify(user)]
  )

  // 5. Перевірити, що токени збереглися
  const storedAccess = await page.evaluate(() => window.localStorage.getItem('access'))
  const storedUser = await page.evaluate(() => window.localStorage.getItem('user'))
  
  if (!storedAccess || !storedUser) {
    throw new Error(
      `Failed to store auth tokens in localStorage. Stored access: ${!!storedAccess}, stored user: ${!!storedUser}`
    )
  }

  return { access, user }
}

/**
 * Логін як тьютор через API і перехід на /booking/tutor (календар тьютора).
 */
export async function loginAsTutor(page: Page) {
  await loginViaApi(page)
  await page.goto('/booking/tutor')
  await page.waitForLoadState('networkidle')
}

/**
 * Логін як студент через API і перехід на /dashboard.
 */
export async function loginAsStudent(page: Page, options: LoginViaApiOptions = {}) {
  await loginViaApi(page, options)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}
