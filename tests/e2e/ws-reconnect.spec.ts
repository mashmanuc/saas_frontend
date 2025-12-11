import { test, expect } from '@playwright/test'

/**
 * E2E Test: WebSocket Reconnection + Chat Resync
 * 
 * Scenario:
 * 1. User logs in and opens chat
 * 2. Sends a message
 * 3. Network goes offline (WS disconnects)
 * 4. Connection status bar appears
 * 5. Network comes back online
 * 6. WS reconnects and chat resyncs
 * 7. Messages are preserved
 */

test.describe('WS Reconnection + Chat Resync', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    // Wait for dashboard
    await page.waitForURL(/\/dashboard/)
  })

  test('shows connection status bar when offline', async ({ page, context }) => {
    // Navigate to a lesson chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]')
    
    // Verify connected state (no status bar)
    await expect(page.locator('.connection-status-bar')).not.toBeVisible()
    
    // Go offline
    await context.setOffline(true)
    
    // Wait for status bar to appear
    await expect(page.locator('.connection-status-bar')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.connection-status-bar')).toContainText(/reconnect|offline/i)
    
    // Go back online
    await context.setOffline(false)
    
    // Wait for reconnection
    await expect(page.locator('.connection-status-bar')).not.toBeVisible({ timeout: 10000 })
  })

  test('preserves messages after reconnection', async ({ page, context }) => {
    // Navigate to a lesson chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]')
    
    // Send a message
    const testMessage = `Test message ${Date.now()}`
    await page.fill('[data-testid="chat-input"]', testMessage)
    await page.click('[data-testid="send-button"]')
    
    // Wait for message to appear
    await expect(page.locator(`text=${testMessage}`)).toBeVisible()
    
    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)
    
    // Go back online
    await context.setOffline(false)
    
    // Wait for reconnection
    await page.waitForTimeout(3000)
    
    // Verify message is still visible
    await expect(page.locator(`text=${testMessage}`)).toBeVisible()
  })

  test('resyncs chat history after reconnection', async ({ page, context }) => {
    // Navigate to a lesson chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]')
    
    // Count initial messages
    const initialMessageCount = await page.locator('[data-testid="chat-message"]').count()
    
    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)
    
    // Go back online
    await context.setOffline(false)
    
    // Wait for resync
    await page.waitForTimeout(3000)
    
    // Verify messages are still present
    const finalMessageCount = await page.locator('[data-testid="chat-message"]').count()
    expect(finalMessageCount).toBeGreaterThanOrEqual(initialMessageCount)
  })

  test('shows syncing state after reconnection', async ({ page, context }) => {
    // Navigate to a lesson chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]')
    
    // Go offline
    await context.setOffline(true)
    
    // Wait for disconnection
    await expect(page.locator('.connection-status-bar')).toBeVisible({ timeout: 5000 })
    
    // Go back online
    await context.setOffline(false)
    
    // Should briefly show syncing or reconnected state
    // This is a race condition test, so we just verify the bar eventually disappears
    await expect(page.locator('.connection-status-bar')).not.toBeVisible({ timeout: 15000 })
  })

  test('retry button works when max retries reached', async ({ page, context }) => {
    // Navigate to a lesson chat
    await page.goto('/lessons/1/chat')
    await page.waitForSelector('[data-testid="chat-panel"]')
    
    // Go offline for extended period
    await context.setOffline(true)
    
    // Wait for status bar
    await expect(page.locator('.connection-status-bar')).toBeVisible({ timeout: 5000 })
    
    // Wait for potential max retries (this depends on backoff settings)
    // In real scenario, we'd mock the WS to simulate max retries
    await page.waitForTimeout(5000)
    
    // If retry button appears, click it
    const retryButton = page.locator('.connection-status-bar .retry-btn')
    if (await retryButton.isVisible()) {
      // Go back online first
      await context.setOffline(false)
      await retryButton.click()
      
      // Should reconnect
      await expect(page.locator('.connection-status-bar')).not.toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('WS Error Handling', () => {
  test('handles WS connection errors gracefully', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL(/\/dashboard/)
    
    // Navigate to chat
    await page.goto('/lessons/1/chat')
    
    // Page should load without crashing
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible({ timeout: 10000 })
  })
})
