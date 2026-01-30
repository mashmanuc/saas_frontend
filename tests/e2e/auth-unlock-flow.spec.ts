import { test, expect } from '@playwright/test'
import { mockAuthEndpoints } from './fixtures/auth-mocks'

test.describe('Account Unlock Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthEndpoints(page)
    await page.goto('/auth/login')
  })

  test('показує повідомлення про блокування акаунта', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'locked@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    await page.click('[data-testid="login-submit-button"]')

    await expect(page.locator('text=Акаунт заблоковано')).toBeVisible()
    await expect(page.locator('text=Запросити розблокування')).toBeVisible()
  })

  test('дозволяє запросити розблокування', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'locked@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    await page.click('[data-testid="login-submit-button"]')

    await page.click('text=Запросити розблокування')
    
    await expect(page.locator('text=Підтвердження розблокування')).toBeVisible()
  })

  test('повний флоу розблокування акаунта', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'locked@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    await page.click('[data-testid="login-submit-button"]')

    await page.click('text=Запросити розблокування')
    
    await page.fill('[data-testid="unlock-confirm-token-input"]', 'valid-unlock-token')
    await page.click('text=Розблокувати')

    await expect(page.locator('text=Акаунт успішно розблоковано')).toBeVisible()
  })
})

test.describe('MFA Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
  })

  test('показує MFA challenge після логіну', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'mfa-user@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    await page.click('[data-testid="login-submit-button"]')

    await expect(page.locator('text=Підтвердіть вхід')).toBeVisible()
    await expect(page.locator('[data-testid="login-otp-input"]')).toBeVisible()
  })

  test('успішна верифікація MFA коду', async ({ page }) => {
    await page.fill('[data-testid="login-email-input"]', 'mfa-user@example.com')
    await page.fill('[data-testid="login-password-input"]', 'password')
    await page.click('[data-testid="login-submit-button"]')

    await page.fill('[data-testid="login-otp-input"]', '123456')
    await page.click('text=Підтвердити')

    await expect(page).toHaveURL(/\/(tutor|student)/)
  })
})

test.describe('Login with Rate Limiting', () => {
  test('показує повідомлення про rate limiting', async ({ page }) => {
    await page.goto('/auth/login')

    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="login-email-input"]', 'test@example.com')
      await page.fill('[data-testid="login-password-input"]', 'wrong-password')
      await page.click('[data-testid="login-submit-button"]')
      await page.waitForTimeout(500)
    }

    await expect(page.locator('text=Забагато невдалих спроб')).toBeVisible()
  })
})
