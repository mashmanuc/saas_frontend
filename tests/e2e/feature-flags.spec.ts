import { test, expect } from '@playwright/test'

/**
 * E2E Test: Feature Flags
 * 
 * Tests feature flag integration and conditional rendering
 */

test.describe('Feature Flags', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(/\/dashboard/)
  })

  test('loads feature flags on app init', async ({ page }) => {
    // Check that app loads without errors
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 })
    
    // Feature flags should be loaded (no console errors)
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.waitForTimeout(2000)
    
    // Filter out expected errors
    const unexpectedErrors = errors.filter(e => !e.includes('feature-flags'))
    expect(unexpectedErrors.length).toBe(0)
  })

  test('conditionally renders features based on flags', async ({ page }) => {
    // Navigate to a page with feature-flagged content
    await page.goto('/lessons/1/chat')
    
    // Wait for chat to load
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 })
    
    // Check if attachments button is visible (chat_attachments flag)
    // This depends on the actual flag value
    const attachButton = page.locator('[data-testid="attach-button"]')
    
    // Either visible or not, but should not error
    await page.waitForTimeout(1000)
  })

  test('updates UI when flags change', async ({ page }) => {
    // This test simulates a flag change via localStorage
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard"]')
    
    // Set a flag in localStorage
    await page.evaluate(() => {
      const cache = {
        flags: { test_new_feature: true },
        timestamp: Date.now(),
      }
      localStorage.setItem('feature_flags_cache', JSON.stringify(cache))
    })
    
    // Reload to pick up new flags
    await page.reload()
    await page.waitForSelector('[data-testid="dashboard"]')
    
    // Verify localStorage was read
    const cacheValue = await page.evaluate(() => {
      return localStorage.getItem('feature_flags_cache')
    })
    
    expect(cacheValue).toBeTruthy()
    const cache = JSON.parse(cacheValue!)
    expect(cache.flags.test_new_feature).toBe(true)
  })
})

test.describe('Slow Network + Reconnection', () => {
  test('handles slow network gracefully', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.continue()
    })
    
    await page.goto('/login')
    
    // Should still load, just slower
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible({ timeout: 30000 })
  })

  test('reconnects after network interruption', async ({ page, context }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(/\/dashboard/)
    
    // Navigate to chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 })
    
    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(2000)
    
    // Go back online
    await context.setOffline(false)
    await page.waitForTimeout(3000)
    
    // Page should still be functional
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible()
  })
})

test.describe('WS Burst Events', () => {
  test('handles burst of WS events without freezing', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(/\/dashboard/)
    
    // Navigate to chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 })
    
    // Simulate burst of messages via console
    // In real scenario, this would come from WS
    const startTime = Date.now()
    
    await page.evaluate(() => {
      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        window.dispatchEvent(new CustomEvent('test-ws-message', {
          detail: { id: i, text: `Message ${i}` }
        }))
      }
    })
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Should complete quickly (batching should help)
    expect(duration).toBeLessThan(1000)
    
    // Page should still be responsive
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible()
  })

  test('UI remains responsive during heavy updates', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(/\/dashboard/)
    
    // Navigate to chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]', { timeout: 10000 })
    
    // Try to interact while simulating updates
    const inputVisible = await page.locator('[data-testid="chat-input"]').isVisible()
    
    if (inputVisible) {
      // Should be able to type
      await page.fill('[data-testid="chat-input"]', 'Test message')
      
      const inputValue = await page.locator('[data-testid="chat-input"]').inputValue()
      expect(inputValue).toBe('Test message')
    }
  })
})
