/**
 * E2E tests for Whiteboard SafeMode (v0.87.0)
 * Tests queue overflow detection, SafeMode UI, and recovery flow
 */

import { test, expect } from '@playwright/test'

test.describe('Whiteboard SafeMode v0.87.0', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to classroom with whiteboard
    await page.goto('/classroom/test-classroom-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')
  })

  test('should show SafeMode banner when queue overflows', async ({ page }) => {
    // Simulate queue overflow by mocking store state
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        // Create 301 pending ops
        const mockOps = new Map()
        for (let i = 0; i < 301; i++) {
          mockOps.set(`op-${i}`, {
            id: `op-${i}`,
            type: 'stroke_add',
            data: {},
            timestamp: Date.now()
          })
        }
        store.pendingOps = mockOps
        store.checkSafeMode()
      }
    })

    // Wait for SafeMode banner to appear
    const banner = page.locator('[data-testid="safe-mode-banner"]')
    await expect(banner).toBeVisible()

    // Verify banner content
    await expect(banner).toContainText('Safe Mode Active')
    await expect(banner).toContainText('301 pending operations')
  })

  test('should block drawing in SafeMode', async ({ page }) => {
    // Enter SafeMode
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        store.safeMode = true
      }
    })

    // Wait for SafeMode banner
    await expect(page.locator('[data-testid="safe-mode-banner"]')).toBeVisible()

    // Try to draw on canvas
    const canvas = page.locator('[data-testid="whiteboard-canvas"]')
    await canvas.click({ position: { x: 100, y: 100 } })

    // Verify no stroke was created (canvas should remain empty)
    const strokes = await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      return store?.currentPageData?.strokes?.length || 0
    })
    expect(strokes).toBe(0)
  })

  test('should exit SafeMode after successful resync', async ({ page }) => {
    // Enter SafeMode
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        store.safeMode = true
      }
    })

    // Verify SafeMode is active
    await expect(page.locator('[data-testid="safe-mode-banner"]')).toBeVisible()

    // Simulate successful resync
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        store.pendingOps.clear()
        store.exitSafeMode()
      }
    })

    // Wait for banner to disappear
    await expect(page.locator('[data-testid="safe-mode-banner"]')).not.toBeVisible()

    // Verify drawing is enabled again
    const canEdit = await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      return store?.canEdit
    })
    expect(canEdit).toBe(true)
  })

  test('should show pending ops count in SafeMode banner', async ({ page }) => {
    // Enter SafeMode with specific ops count
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        const mockOps = new Map()
        for (let i = 0; i < 150; i++) {
          mockOps.set(`op-${i}`, { id: `op-${i}`, type: 'stroke_add', data: {} })
        }
        store.pendingOps = mockOps
        store.safeMode = true
      }
    })

    // Verify ops count in banner
    const banner = page.locator('[data-testid="safe-mode-banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('150 pending operations')
  })

  test('should not allow moderation actions in SafeMode (integration with v0.86)', async ({ page }) => {
    // Login as moderator
    await page.goto('/login')
    await page.fill('input[name="email"]', 'moderator@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    await page.goto('/classroom/test-classroom-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Set moderator role and enter SafeMode
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        store.myRole = 'moderator'
        store.safeMode = true
      }
    })

    // Verify moderation controls are still visible (v0.86 feature)
    const moderationControls = page.locator('[data-testid="moderation-controls"]')
    await expect(moderationControls).toBeVisible()

    // But canEdit should be false due to SafeMode
    const canEdit = await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      return store?.canEdit
    })
    expect(canEdit).toBe(false)
  })

  test('should handle SafeMode during reconnection', async ({ page }) => {
    // Simulate network disconnection
    await page.context().setOffline(true)

    // Try to draw (should queue operations)
    const canvas = page.locator('[data-testid="whiteboard-canvas"]')
    for (let i = 0; i < 10; i++) {
      await canvas.click({ position: { x: 100 + i * 10, y: 100 } })
    }

    // Reconnect
    await page.context().setOffline(false)

    // Wait for connection status to update
    await page.waitForSelector('[data-testid="connection-status"][data-status="connected"]', {
      timeout: 5000
    })

    // Verify SafeMode did not activate (ops count below threshold)
    const safeMode = await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      return store?.safeMode
    })
    expect(safeMode).toBe(false)
  })

  test('should display SafeMode banner with correct styling', async ({ page }) => {
    // Enter SafeMode
    await page.evaluate(() => {
      const store = (window as any).__PINIA_STORE__?.whiteboard
      if (store) {
        store.safeMode = true
      }
    })

    const banner = page.locator('[data-testid="safe-mode-banner"]')
    await expect(banner).toBeVisible()

    // Verify banner has correct CSS classes
    await expect(banner).toHaveClass(/safe-mode-banner/)

    // Verify banner position (fixed at top)
    const position = await banner.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        position: styles.position,
        top: styles.top,
        zIndex: styles.zIndex
      }
    })
    expect(position.position).toBe('fixed')
    expect(parseInt(position.zIndex)).toBeGreaterThan(100)
  })
})
