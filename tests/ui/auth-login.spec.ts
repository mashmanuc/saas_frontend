import { test, expect } from '@playwright/test'

test.describe('Auth Login Basic Render', () => {
  test('CRITICAL: /auth/login рендериться без авторизації', async ({ page, context }) => {
    // Очищаємо всі cookies та storage
    await context.clearCookies()
    
    // Переходимо на /auth/login
    await page.goto('http://127.0.0.1:5173/auth/login', { waitUntil: 'networkidle' })
    
    // КРОК 1: Перевіряємо URL
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
    
    // КРОК 2: Перевіряємо що форма логіну видима
    const emailInput = page.locator('[data-testid="login-email-input"]')
    const passwordInput = page.locator('[data-testid="login-password-input"]')
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    
    await expect(emailInput).toBeVisible({ timeout: 15000 })
    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()
    
    // КРОК 3: Перевіряємо що inputs працюють
    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    
    await expect(emailInput).toHaveValue('test@example.com')
    await expect(passwordInput).toHaveValue('password123')
    
    // КРОК 4: Перевіряємо що кнопка активна
    await expect(submitButton).toBeEnabled()
  })
})
