import { test, expect } from '@playwright/test'

/**
 * v0.40.0 - Rate Limit UX Tests
 * Tests rate limit handling with countdown timer
 */

test.describe('Rate Limit UX', () => {
  test('should show rate limit modal with countdown', async ({ page }) => {
    await page.goto('/marketplace/my-profile')

    // Mock 429 rate limit response
    await page.route('**/api/v1/marketplace/me/profile/draft', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'rate_limited',
          message: 'Too many requests',
          retry_after_seconds: 5,
          request_id: 'req-rate-limit-123',
        }),
      })
    })

    // Trigger save that will hit rate limit
    await page.click('[data-testid="save-draft-button"]')

    // Rate limit modal should appear
    await expect(page.locator('text=Rate Limit')).toBeVisible()
    await expect(page.locator('text=Request ID: req-rate-limit-123')).toBeVisible()

    // Countdown should be visible
    await expect(page.locator('text=5')).toBeVisible()

    // Wait for countdown
    await page.waitForTimeout(6000)

    // Try now button should be enabled
    await expect(page.locator('button:has-text("Try Now")')).toBeEnabled()
  })

  test('should emit telemetry events for rate limit', async ({ page }) => {
    const telemetryEvents = []

    await page.route('**/api/v1/telemetry/events', async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() || '{}')
      telemetryEvents.push(...(body.events || []))
      await route.fulfill({ status: 200, body: '{}' })
    })

    await page.goto('/marketplace/my-profile')

    await page.route('**/api/v1/marketplace/me/profile/draft', async (route) => {
      await route.fulfill({
        status: 429,
        body: JSON.stringify({
          error: 'rate_limited',
          retry_after_seconds: 3,
        }),
      })
    })

    await page.click('[data-testid="save-draft-button"]')

    // Wait for telemetry
    await page.waitForTimeout(1000)

    // Check telemetry events
    const rateLimitHit = telemetryEvents.find(e => e.event_type === 'rate_limit_hit')
    expect(rateLimitHit).toBeTruthy()
  })
})
