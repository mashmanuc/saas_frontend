/**
 * E2E tests for Billing Flow (v0.73.0)
 * 
 * Tests complete billing flow with LiqPay checkout.
 */
import { test, expect } from '@playwright/test'

test.describe('Billing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    // Assume user is logged in for these tests
  })

  test('should display plans page', async ({ page }) => {
    await page.goto('/billing/plans')
    
    // Check page title
    await expect(page.locator('h1')).toContainText('план')
    
    // Check that plans are loaded
    const planCards = page.locator('[data-testid="plan-card"]').or(page.locator('.plan-card')).or(page.locator('article'))
    await expect(planCards.first()).toBeVisible()
  })

  test('should show current plan on billing page', async ({ page }) => {
    await page.goto('/billing')
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Підписка')
    
    // Check current plan is displayed
    await expect(page.getByText(/поточний план/i)).toBeVisible()
  })

  test('should initiate checkout flow', async ({ page }) => {
    // Mock checkout API response
    await page.route('**/api/v1/billing/checkout/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: 'liqpay',
          session_id: 'order_test_123',
          checkout: {
            method: 'POST',
            url: 'https://www.liqpay.ua/api/3/checkout',
            form_fields: {
              data: 'base64_test_data',
              signature: 'base64_test_signature'
            }
          }
        })
      })
    })

    // Intercept form submission to prevent actual navigation
    let formSubmitted = false
    await page.route('https://www.liqpay.ua/api/3/checkout', async route => {
      formSubmitted = true
      await route.fulfill({
        status: 200,
        body: '<html><body>Mock LiqPay Page</body></html>'
      })
    })

    await page.goto('/billing/plans')
    
    // Click upgrade button (assuming PRO plan)
    const upgradeButton = page.locator('button').filter({ hasText: /оновити|upgrade/i }).first()
    await upgradeButton.click()
    
    // Wait a bit for form submission
    await page.waitForTimeout(500)
    
    // Verify checkout was initiated
    expect(formSubmitted).toBe(true)
  })

  test('should handle checkout error gracefully', async ({ page }) => {
    // Mock checkout API error
    await page.route('**/api/v1/billing/checkout/', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'invalid_plan',
            message: 'Invalid plan selected'
          }
        })
      })
    })

    await page.goto('/billing/plans')
    
    // Click upgrade button
    const upgradeButton = page.locator('button').filter({ hasText: /оновити|upgrade/i }).first()
    await upgradeButton.click()
    
    // Check error message is displayed
    await expect(page.getByText(/помилка|error/i)).toBeVisible()
  })

  test('should display subscription status', async ({ page }) => {
    // Mock billing/me API with active subscription
    await page.route('**/api/v1/billing/me/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'PRO',
          subscription: {
            status: 'active',
            current_period_end: '2026-12-31T23:59:59Z',
            cancel_at_period_end: false,
            provider: 'liqpay'
          },
          entitlements: {
            features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
            expires_at: '2026-12-31T23:59:59Z'
          }
        })
      })
    })

    await page.goto('/billing')
    
    // Check subscription status
    await expect(page.getByText(/активна|active/i)).toBeVisible()
    await expect(page.getByText(/liqpay/i)).toBeVisible()
  })

  test('should cancel subscription', async ({ page }) => {
    // Mock billing/me API with active subscription
    await page.route('**/api/v1/billing/me/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'PRO',
          subscription: {
            status: 'active',
            current_period_end: '2026-12-31T23:59:59Z',
            cancel_at_period_end: false
          },
          entitlements: {
            features: ['CONTACT_UNLOCK'],
            expires_at: '2026-12-31T23:59:59Z'
          }
        })
      })
    })

    // Mock cancel API
    await page.route('**/api/v1/billing/cancel/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'cancelled',
          message: 'Subscription will be cancelled at period end'
        })
      })
    })

    await page.goto('/billing')
    
    // Click cancel button
    const cancelButton = page.locator('button').filter({ hasText: /скасувати|cancel/i }).first()
    await cancelButton.click()
    
    // Confirm cancellation if there's a dialog
    const confirmButton = page.locator('button').filter({ hasText: /так|yes|підтвердити|confirm/i })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Check success message or updated status
    await expect(page.getByText(/скасовано|cancelled|успішно|success/i)).toBeVisible()
  })

  test('should show features based on plan', async ({ page }) => {
    // Mock billing/me API with PRO plan
    await page.route('**/api/v1/billing/me/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'PRO',
          subscription: {
            status: 'active',
            current_period_end: '2026-12-31T23:59:59Z',
            cancel_at_period_end: false
          },
          entitlements: {
            features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
            expires_at: '2026-12-31T23:59:59Z'
          }
        })
      })
    })

    await page.goto('/billing')
    
    // Check features are displayed
    await expect(page.getByText(/розблокування контактів|contact unlock/i)).toBeVisible()
    await expect(page.getByText(/необмежені запити|unlimited inquiries/i)).toBeVisible()
  })

  test('should navigate between plans and billing pages', async ({ page }) => {
    await page.goto('/billing')
    
    // Navigate to plans
    const viewPlansButton = page.locator('a, button').filter({ hasText: /переглянути плани|view plans/i }).first()
    await viewPlansButton.click()
    
    await expect(page).toHaveURL(/\/billing\/plans/)
    
    // Navigate back to billing
    const manageBillingButton = page.locator('a, button').filter({ hasText: /керувати підпискою|manage billing/i }).first()
    await manageBillingButton.click()
    
    await expect(page).toHaveURL(/\/billing$/)
  })

  test('should display FREE plan correctly', async ({ page }) => {
    // Mock billing/me API with FREE plan
    await page.route('**/api/v1/billing/me/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          subscription: null,
          entitlements: {
            features: [],
            expires_at: null
          }
        })
      })
    })

    await page.goto('/billing')
    
    // Check FREE plan is displayed
    await expect(page.getByText(/FREE/i)).toBeVisible()
    await expect(page.getByText(/немає активної підписки|no active subscription/i)).toBeVisible()
  })
})
