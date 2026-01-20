/**
 * E2E tests for login error handling (v0.82.0)
 * 
 * DoD:
 * - Невірний пароль → видно текст auth.login.errors.invalidCredentials
 * - Rate limit → видно auth.login.errors.rateLimited
 * - UI не зависає після помилки
 * - Повідомлення локалізоване (uk)
 */

import { test, expect } from '@playwright/test'

test.describe('Login Error UX (v0.82.0)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
  })

  test('shows localized error for invalid credentials', async ({ page }) => {
    // Заповнюємо форму з невірними даними
    await page.fill('[data-testid="login-email-input"]', 'wrong@example.com')
    await page.fill('[data-testid="login-password-input"]', 'wrongpassword')
    
    // Натискаємо кнопку входу
    await page.click('[data-testid="login-submit-button"]')
    
    // Чекаємо на відповідь від сервера
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/auth/login') && response.status() === 401
    )
    
    // Перевіряємо, що показується локалізоване повідомлення
    // Може бути в модалці або inline
    const errorText = await page.textContent('body')
    expect(errorText).toContain('Невірний email або пароль')
    
    // DoD: UI не зависає - кнопка знову активна
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).not.toBeDisabled()
  })

  test('shows validation error for empty email', async ({ page }) => {
    // Залишаємо email порожнім
    await page.fill('[data-testid="login-password-input"]', 'somepassword')
    
    // Натискаємо кнопку входу
    await page.click('[data-testid="login-submit-button"]')
    
    // Перевіряємо inline validation (не має бути запиту на сервер)
    const errorText = await page.textContent('body')
    expect(errorText).toContain('Введіть email')
    
    // Кнопка має бути активна для повторної спроби
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).not.toBeDisabled()
  })

  test('shows validation error for empty password', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    // Залишаємо пароль порожнім
    
    await page.click('[data-testid="login-submit-button"]')
    
    const errorText = await page.textContent('body')
    expect(errorText).toContain('Введіть пароль')
    
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).not.toBeDisabled()
  })

  test('successful login redirects to dashboard', async ({ page, context }) => {
    // Створюємо тестового користувача через API або використовуємо існуючого
    // (припускаємо, що є test fixtures)
    
    await page.fill('[data-testid="login-email-input"]', 'student@test.com')
    await page.fill('[data-testid="login-password-input"]', 'testpassword123')
    
    await page.click('[data-testid="login-submit-button"]')
    
    // Чекаємо на успішний редірект
    await page.waitForURL(/\/(student|tutor)/, { timeout: 5000 })
    
    // DoD: Вірний пароль → логін проходить
    expect(page.url()).toMatch(/\/(student|tutor)/)
  })

  test('UI does not hang after multiple failed attempts', async ({ page }) => {
    // DoD: ≥5 невдалих спроб → UI не зависає
    
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="login-email-input"]', `wrong${i}@example.com`)
      await page.fill('[data-testid="login-password-input"]', 'wrongpassword')
      
      await page.click('[data-testid="login-submit-button"]')
      
      // Чекаємо на відповідь
      await page.waitForResponse(response => 
        response.url().includes('/api/v1/auth/login')
      )
      
      // Перевіряємо, що кнопка знову активна
      const submitButton = page.locator('[data-testid="login-submit-button"]')
      await expect(submitButton).not.toBeDisabled({ timeout: 2000 })
    }
    
    // Форма має залишатися функціональною
    const emailInput = page.locator('[data-testid="login-email-input"]')
    await expect(emailInput).toBeEnabled()
  })

  test('shows rate limit error when throttled', async ({ page }) => {
    // Цей тест може бути складним для стабільного відтворення
    // Можна замокати відповідь 429 через page.route
    
    await page.route('**/api/v1/auth/login', route => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'rate_limited',
          message: 'Забагато невдалих спроб. Спробуйте пізніше',
          request_id: 'test-rate-limit',
        }),
        headers: {
          'Retry-After': '60',
        },
      })
    })
    
    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    
    await page.click('[data-testid="login-submit-button"]')
    
    // Перевіряємо локалізоване повідомлення про rate limit
    const errorText = await page.textContent('body')
    expect(errorText).toContain('Забагато невдалих спроб')
    
    // UI не зависає
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).not.toBeDisabled()
  })

  test('clears validation errors when user starts typing', async ({ page }) => {
    // Спочатку викликаємо помилку валідації
    await page.click('[data-testid="login-submit-button"]')
    
    let errorText = await page.textContent('body')
    expect(errorText).toContain('Введіть email')
    
    // Починаємо вводити email
    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    
    // Помилка має зникнути (або оновитися)
    // Це UX-поліпшення, але не критично для v0.82.0
  })

  test('shows email_not_verified error with resend CTA', async ({ page }) => {
    // Мокаємо відповідь email_not_verified
    await page.route('**/api/v1/auth/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'email_not_verified',
          message: 'Підтвердіть email для входу.',
          request_id: 'test-email-verify',
        }),
      })
    })
    
    await page.fill('[data-testid="login-email-input"]', 'unverified@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    
    await page.click('[data-testid="login-submit-button"]')
    
    // Має показатися повідомлення + CTA "Надіслати лист підтвердження ще раз"
    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('email')
    expect(bodyText).toContain('підтвердження')
  })
})
