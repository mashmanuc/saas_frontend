import { test, expect } from '@playwright/test'

test.describe('Auth Login Render', () => {
  test('рендерить /auth/login без авторизації', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Перевіряємо що сторінка завантажилась
    await expect(page).toHaveURL(/\/auth\/login/)
    
    // Перевіряємо наявність форми логіну
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="login-password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-submit-button"]')).toBeVisible()
    
    // Перевіряємо тексти
    await expect(page.locator('text=Увійти')).toBeVisible()
  })

  test('дозволяє ввести email та password', async ({ page }) => {
    await page.goto('/auth/login')
    
    await page.fill('[data-testid="login-email-input"]', 'test@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password123')
    
    const emailInput = page.locator('[data-testid="login-email-input"]')
    const passwordInput = page.locator('[data-testid="login-password-input"]')
    
    await expect(emailInput).toHaveValue('test@example.com')
    await expect(passwordInput).toHaveValue('password123')
  })

  test('показує кнопку submit', async ({ page }) => {
    await page.goto('/auth/login')
    
    const submitButton = page.locator('[data-testid="login-submit-button"]')
    await expect(submitButton).toBeEnabled()
    await expect(submitButton).toBeVisible()
  })
})
