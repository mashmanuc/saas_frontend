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
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
  await page.goto(baseURL)

  // 4. Записати токени у localStorage (ключі 'access' та 'user', як у authStore)
  // Retry logic для надійності
  let retries = 3
  let storedAccess: string | null = null
  let storedUser: string | null = null
  
  while (retries > 0) {
    await page.evaluate(
      ([token, serializedUser]) => {
        window.localStorage.setItem('access', token)
        window.localStorage.setItem('user', serializedUser)
      },
      [access, JSON.stringify(user)]
    )

    // Перевірити, що токени збереглися
    storedAccess = await page.evaluate(() => window.localStorage.getItem('access'))
    storedUser = await page.evaluate(() => window.localStorage.getItem('user'))
    
    if (storedAccess && storedUser) {
      break // Success
    }
    
    retries--
    if (retries > 0) {
      await page.waitForTimeout(100) // Wait 100ms before retry
    }
  }
  
  if (!storedAccess || !storedUser) {
    // Діагностика: перевірити що взагалі є в localStorage
    const allKeys = await page.evaluate(() => Object.keys(window.localStorage))
    const allValues = await page.evaluate(() => {
      const result: Record<string, string> = {}
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) result[key] = window.localStorage.getItem(key) || ''
      }
      return result
    })
    
    throw new Error(
      `Failed to store auth tokens in localStorage after 3 retries.\n` +
      `Stored access: ${!!storedAccess}, stored user: ${!!storedUser}\n` +
      `All localStorage keys: ${JSON.stringify(allKeys)}\n` +
      `All localStorage values: ${JSON.stringify(allValues, null, 2)}`
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
  
  // Чекаємо на завантаження календаря (використовуємо helper)
  const { waitForCalendarReady } = await import('./waitForCalendar')
  await waitForCalendarReady(page, { timeout: 30000 })
}

/**
 * UI login flow using actual LoginView selectors.
 * Використовується, коли потрібно пройти повний UX (наприклад, smoke тести).
 */
export async function loginAsTutorUI(page: Page, creds: LoginViaApiOptions = {}) {
  const email = creds.email || TEST_USER_EMAIL
  const password = creds.password || TEST_USER_PASSWORD
  const calendarUrl = '/booking/tutor'

  await page.goto(calendarUrl, { waitUntil: 'domcontentloaded' })

  // Якщо вже авторизовані (storageState з global-setup), повертаємось одразу.
  if (!page.url().includes('/login')) {
    await page.waitForSelector('[data-testid="calendar-board"]', { timeout: 15000 }).catch(() => {})
    return
  }

  await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 10000 })
  await page.fill('[data-testid="login-email-input"]', email)
  await page.fill('[data-testid="login-password-input"]', password)
  await Promise.all([
    page.waitForNavigation({ url: /\/(booking\/tutor|dashboard)/ }),
    page.click('[data-testid="login-submit-button"]'),
  ])

  await page.waitForSelector('[data-testid="calendar-board"]', { timeout: 15000 })
}

/**
 * Логін як студент через API і перехід на /dashboard.
 */
export async function loginAsStudent(page: Page, options: LoginViaApiOptions = {}) {
  await loginViaApi(page, options)
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}
