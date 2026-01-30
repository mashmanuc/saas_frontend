import { test, expect } from '@playwright/test'

// Smoke test без global setup та auth state
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Auth Login Render (Smoke)', () => {
  test('рендерить /auth/login без авторизації', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/auth/login')
    
    // Перевіряємо що сторінка завантажилась
    await expect(page).toHaveURL(/\/auth\/login/)
    
    // Перевіряємо наявність форми логіну
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="login-password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-submit-button"]')).toBeVisible()
  })

  test('дозволяє ввести email та password', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/auth/login')
    
    await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 15000 })
    
    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    
    const emailInput = page.locator('[data-testid="login-email-input"]')
    const passwordInput = page.locator('[data-testid="login-password-input"]')
    
    await expect(emailInput).toHaveValue('test@example.com')
    await expect(passwordInput).toHaveValue('password123')
  })

  test('кнопка submit активна', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/auth/login')
    
    await page.waitForSelector('[data-testid="login-submit-button"]', { timeout: 15000 })
    
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).toBeEnabled()
    await expect(submitButton).toBeVisible()
  })
})
