import { test, expect } from '@playwright/test'

test.describe('v0.41 Operator Actions', () => {
  test('should execute operator action with idempotency', async ({ page }) => {
    await page.goto('/dashboard/operator/console')
    
    // Click on operator action
    await page.click('button:has-text("Force Publish")')
    
    // Should show action modal
    await expect(page.locator('text=Force Publish')).toBeVisible({ timeout: 5000 })
    
    // Should show risks
    await expect(page.locator('text=Risks')).toBeVisible()
    
    // Confirm risks checkbox
    await page.check('input[type="checkbox"]#confirm-risks')
    
    // Mock API response with request_id
    await page.route('**/api/v1/operator/actions/*', async route => {
      const headers = route.request().headers()
      
      // Verify idempotency key header
      expect(headers['x-idempotency-key']).toBeTruthy()
      
      await route.fulfill({
        status: 200,
        json: {
          status: 'accepted',
          request_id: 'req_op_123',
        },
      })
    })
    
    // Execute action
    await page.click('button:has-text("Execute")')
    
    // Should show success with request_id
    await expect(page.locator('text=Request ID: req_op_123')).toBeVisible({ timeout: 5000 })
  })

  test('should load telemetry charts with real data', async ({ page }) => {
    await page.goto('/dashboard/operator/console')
    
    // Mock telemetry API
    await page.route('**/api/v1/telemetry/metrics/*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          series: [
            { timestamp: Date.now() - 3600000, event_count: 100 },
            { timestamp: Date.now() - 1800000, event_count: 150 },
            { timestamp: Date.now(), event_count: 200 },
          ],
          meta: {
            min: 100,
            max: 200,
            p95: 195,
          },
        },
      })
    })
    
    // Should show telemetry chart
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
    
    // Should show meta stats
    await expect(page.locator('text=Min:')).toBeVisible()
    await expect(page.locator('text=Max:')).toBeVisible()
    await expect(page.locator('text=P95:')).toBeVisible()
  })

  test('should sync feed with chart datapoint click', async ({ page }) => {
    await page.goto('/dashboard/operator/console')
    
    // Wait for chart to load
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })
    
    // Click on chart datapoint
    await page.click('canvas', { position: { x: 100, y: 100 } })
    
    // Should filter feed by timestamp
    await expect(page.locator('.activity-feed')).toBeVisible({ timeout: 5000 })
  })

  test('should handle rate limit with feature-specific message', async ({ page }) => {
    await page.goto('/dashboard/operator/console')
    
    // Mock 429 rate limit response
    await page.route('**/api/v1/operator/**', async route => {
      await route.fulfill({
        status: 429,
        json: {
          error: 'rate_limited',
          retry_after_seconds: 60,
          request_id: 'req_rate_123',
        },
      })
    })
    
    await page.click('button:has-text("Refresh")')
    
    // Should show rate limit modal
    await expect(page.locator('text=Rate Limit')).toBeVisible({ timeout: 5000 })
    
    // Should show countdown
    await expect(page.locator('.countdown-number')).toBeVisible()
    
    // Should show request_id
    await expect(page.locator('text=Request ID: req_rate_123')).toBeVisible()
  })
})
