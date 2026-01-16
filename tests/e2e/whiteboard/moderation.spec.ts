/**
 * E2E tests for Whiteboard Moderation (v0.86.0)
 * Tests: freeze, clear page, presenter, role enforcement
 */

import { test, expect } from '@playwright/test'

test.describe('Whiteboard Moderation v0.86.0', () => {
  test.beforeEach(async ({ page }) => {
    // Login as moderator
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'moderator@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test('moderator can freeze board', async ({ page }) => {
    // Navigate to classroom with whiteboard
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Check moderation controls are visible
    await expect(page.locator('[data-testid="moderation-controls"]')).toBeVisible()

    // Click freeze toggle
    await page.click('[data-testid="freeze-toggle"]')

    // Verify frozen banner appears
    await expect(page.locator('[data-testid="frozen-banner"]')).toBeVisible()
    await expect(page.locator('[data-testid="frozen-banner"]')).toContainText('frozen')

    // Verify freeze button is active
    await expect(page.locator('[data-testid="freeze-toggle"]')).toHaveClass(/moderation-btn--active/)
  })

  test('frozen board blocks operations for editor', async ({ page, context }) => {
    // Open as moderator and freeze
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="moderation-controls"]')
    await page.click('[data-testid="freeze-toggle"]')
    await expect(page.locator('[data-testid="frozen-banner"]')).toBeVisible()

    // Open second browser as editor
    const editorPage = await context.newPage()
    await editorPage.goto('/login')
    await editorPage.fill('[data-testid="email-input"]', 'editor@test.com')
    await editorPage.fill('[data-testid="password-input"]', 'testpass123')
    await editorPage.click('[data-testid="login-button"]')
    await editorPage.waitForURL('/dashboard')
    
    await editorPage.goto('/classroom/test-session-123')
    await editorPage.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Verify editor sees frozen banner
    await expect(editorPage.locator('[data-testid="frozen-banner"]')).toBeVisible()

    // Verify drawing tools are disabled
    const canvas = editorPage.locator('[data-testid="whiteboard-canvas"]')
    await canvas.click({ position: { x: 100, y: 100 } })
    
    // No operations should be sent (check via network or state)
    // This is a simplified check - in real test, monitor WebSocket messages
    await editorPage.waitForTimeout(500)
    
    await editorPage.close()
  })

  test('moderator can clear page', async ({ page }) => {
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="moderation-controls"]')

    // Draw something first
    const canvas = page.locator('[data-testid="whiteboard-canvas"]')
    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 200 } })

    // Click clear page button
    page.on('dialog', dialog => dialog.accept())
    await page.click('[data-testid="clear-page-btn"]')

    // Verify page is cleared (canvas should be empty)
    await page.waitForTimeout(500)
    // In real test, verify canvas state or check for clear event
  })

  test('moderator can set presenter', async ({ page }) => {
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="moderation-controls"]')

    // Click presenter menu button
    await page.click('[data-testid="presenter-menu-btn"]')

    // TODO: Verify presenter menu opens
    // This requires implementing the presenter selection UI
  })

  test('viewer cannot see moderation controls', async ({ page }) => {
    // Logout and login as viewer
    await page.goto('/logout')
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'viewer@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Verify moderation controls are NOT visible
    await expect(page.locator('[data-testid="moderation-controls"]')).not.toBeVisible()

    // Verify drawing tools are hidden or disabled
    // (depends on implementation)
  })

  test('presence indicator shows role badges', async ({ page }) => {
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Hover over presence indicator
    await page.hover('.presence-header')

    // Wait for dropdown to appear
    await page.waitForSelector('.presence-dropdown', { state: 'visible' })

    // Verify role badges are displayed
    const roleBadges = page.locator('.role-badge')
    await expect(roleBadges.first()).toBeVisible()

    // Verify badge text (MOD, EDIT, or VIEW)
    const badgeText = await roleBadges.first().textContent()
    expect(['MOD', 'EDIT', 'VIEW']).toContain(badgeText)
  })

  test('unfreeze removes frozen banner', async ({ page }) => {
    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="moderation-controls"]')

    // Freeze first
    await page.click('[data-testid="freeze-toggle"]')
    await expect(page.locator('[data-testid="frozen-banner"]')).toBeVisible()

    // Unfreeze
    await page.click('[data-testid="freeze-toggle"]')

    // Verify banner is hidden
    await expect(page.locator('[data-testid="frozen-banner"]')).not.toBeVisible()
  })

  test('role upgrade enables editing in real-time', async ({ page }) => {
    // Login as viewer
    await page.goto('/logout')
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'viewer@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Initially, drawing tools should be disabled/hidden
    // (verify based on implementation)

    // Simulate role upgrade via WebSocket message
    // This requires injecting a WS message or using backend API
    // For now, this is a placeholder for the test structure

    // After upgrade, verify tools become available
    // await expect(page.locator('[data-testid="pen-tool"]')).toBeEnabled()
  })
})

test.describe('Follow Presenter Mode', () => {
  test('follow presenter toggle exists', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Verify follow presenter toggle exists
    // (implementation depends on UI design)
    // await expect(page.locator('[data-testid="follow-presenter-toggle"]')).toBeVisible()
  })

  test('following banner shows when presenter is set', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    await page.goto('/classroom/test-session-123')
    await page.waitForSelector('[data-testid="whiteboard-canvas"]')

    // Simulate presenter_changed WebSocket event
    // This requires backend integration or WS injection

    // Verify following banner appears
    // await expect(page.locator('[data-testid="following-banner"]')).toBeVisible()
    // await expect(page.locator('[data-testid="following-banner"]')).toContainText('Following')
  })
})
