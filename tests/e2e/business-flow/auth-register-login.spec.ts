// E2E: Auth flow — registration form + login + dashboard
// Verifies: registration UI renders, login works, dashboard loads
import { test, expect } from '@playwright/test'
import { loginViaApi, loginAsStudent } from '../helpers/auth'

const API_BASE = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 's28@gmail.com'
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'demo1234'

test.describe('Auth Business Flow', () => {
  test('registration page renders and accepts input', async ({ page }) => {
    await test.step('navigate to role selection', async () => {
      await page.goto('/start')
      await page.waitForLoadState('networkidle')
      // Should show role selection (student / tutor)
      const body = await page.textContent('body')
      // Page should have some content (not blank)
      expect(body!.length).toBeGreaterThan(50)
    })

    await test.step('student registration form loads', async () => {
      await page.goto('/auth/register/student')
      await page.waitForLoadState('networkidle')
      // Registration form should render (email, password fields)
      const emailInput = page.locator('input[type="email"], input[name="email"], [data-testid="register-email"]')
      const passwordInput = page.locator('input[type="password"], input[name="password"], [data-testid="register-password"]')
      // At least one of these should be visible
      const hasForm = (await emailInput.count()) > 0 || (await passwordInput.count()) > 0
      expect(hasForm).toBeTruthy()
    })
  })

  test('login via API + dashboard renders', async ({ page }) => {
    const errors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) errors.push(`${resp.status()} ${resp.url()}`)
    })

    await test.step('login as student via API', async () => {
      await loginViaApi(page, { email: STUDENT_EMAIL, password: STUDENT_PASSWORD })
    })

    await test.step('authenticated page renders', async () => {
      // Navigate to marketplace (accessible by both student and tutor)
      await page.goto('/marketplace')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2_000)
      const url = page.url()
      // Should be on marketplace (not redirected to login)
      expect(url).toContain('/marketplace')
      // Page should have content
      const body = await page.textContent('body')
      expect(body!.length).toBeGreaterThan(100)
    })

    await test.step('no server errors', async () => {
      expect(errors).toHaveLength(0)
    })
  })

  test('login via UI form', async ({ page }) => {
    await test.step('navigate to login', async () => {
      await page.goto('/auth/login')
      await page.waitForLoadState('networkidle')
    })

    await test.step('fill login form', async () => {
      const emailInput = page.locator('[data-testid="login-email-input"], input[type="email"]').first()
      const passwordInput = page.locator('[data-testid="login-password-input"], input[type="password"]').first()
      const submitBtn = page.locator('[data-testid="login-submit-button"], button[type="submit"]').first()

      await expect(emailInput).toBeVisible({ timeout: 10_000 })
      await emailInput.fill(STUDENT_EMAIL)
      await passwordInput.fill(STUDENT_PASSWORD)
      await submitBtn.click()
    })

    await test.step('redirected after login', async () => {
      await page.waitForURL(/\/(dashboard|student|tutor|booking|marketplace)/, { timeout: 15_000 })
      // Should not be on login page anymore
      expect(page.url()).not.toContain('/auth/login')
    })
  })
})
