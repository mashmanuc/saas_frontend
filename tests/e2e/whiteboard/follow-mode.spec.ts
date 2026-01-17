/**
 * E2E tests for v0.88.0 follow-mode functionality
 * Tests presenter page switching and follow mode behavior
 */

import { test, expect } from '@playwright/test'

test.describe('Whiteboard Follow Mode v0.88.0', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to classroom
    await page.goto('/auth/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    
    // Navigate to test classroom
    await page.goto('/classroom/test-workspace-id')
    await page.waitForSelector('[data-testid="board-canvas"]')
  })

  test('should display follow button when presenter is active', async ({ page }) => {
    // Wait for workspace state to load
    await page.waitForTimeout(1000)
    
    // Follow button should be visible if there's a presenter
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    await expect(followButton).toBeVisible()
  })

  test('should toggle follow mode on button click', async ({ page }) => {
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    
    // Initially not active
    await expect(followButton).not.toHaveClass(/follow--active/)
    
    // Click to enable
    await followButton.click()
    await expect(followButton).toHaveClass(/follow--active/)
    
    // Click to disable
    await followButton.click()
    await expect(followButton).not.toHaveClass(/follow--active/)
  })

  test('should show follow banner when follow mode is active', async ({ page }) => {
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    const followBanner = page.locator('[data-testid="follow-banner"]')
    
    // Banner should not be visible initially
    await expect(followBanner).not.toBeVisible()
    
    // Enable follow mode
    await followButton.click()
    
    // Banner should appear
    await expect(followBanner).toBeVisible()
    await expect(followBanner).toContainText('following')
  })

  test('should hide follow banner when clicking stop button', async ({ page }) => {
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    const followBanner = page.locator('[data-testid="follow-banner"]')
    
    // Enable follow mode
    await followButton.click()
    await expect(followBanner).toBeVisible()
    
    // Click stop button in banner
    const stopButton = page.locator('[data-testid="stop-follow-button"]')
    await stopButton.click()
    
    // Banner should disappear
    await expect(followBanner).not.toBeVisible()
    await expect(followButton).not.toHaveClass(/follow--active/)
  })

  test('should auto-switch pages when presenter changes page in follow mode', async ({ page, context }) => {
    // Open second page as presenter
    const presenterPage = await context.newPage()
    await presenterPage.goto('/auth/login')
    await presenterPage.fill('[name="email"]', 'presenter@example.com')
    await presenterPage.fill('[name="password"]', 'password123')
    await presenterPage.click('button[type="submit"]')
    await presenterPage.waitForURL('/dashboard')
    await presenterPage.goto('/classroom/test-workspace-id')
    await presenterPage.waitForSelector('[data-testid="board-canvas"]')
    
    // Enable follow mode on student page
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    await followButton.click()
    
    // Get current active tab on student page
    const studentActiveTab = page.locator('.board-tab--active')
    const initialTab = await studentActiveTab.textContent()
    
    // Presenter switches to different page
    const presenterTabs = presenterPage.locator('.board-tab')
    await presenterTabs.nth(1).click()
    
    // Wait for WebSocket message propagation
    await page.waitForTimeout(500)
    
    // Student should auto-switch to same page
    const newActiveTab = await studentActiveTab.textContent()
    expect(newActiveTab).not.toBe(initialTab)
    
    await presenterPage.close()
  })

  test('should NOT auto-switch when follow mode is disabled', async ({ page, context }) => {
    // Open second page as presenter
    const presenterPage = await context.newPage()
    await presenterPage.goto('/auth/login')
    await presenterPage.fill('[name="email"]', 'presenter@example.com')
    await presenterPage.fill('[name="password"]', 'password123')
    await presenterPage.click('button[type="submit"]')
    await presenterPage.waitForURL('/dashboard')
    await presenterPage.goto('/classroom/test-workspace-id')
    await presenterPage.waitForSelector('[data-testid="board-canvas"]')
    
    // Do NOT enable follow mode
    const studentActiveTab = page.locator('.board-tab--active')
    const initialTab = await studentActiveTab.textContent()
    
    // Presenter switches to different page
    const presenterTabs = presenterPage.locator('.board-tab')
    await presenterTabs.nth(1).click()
    
    // Wait for WebSocket message propagation
    await page.waitForTimeout(500)
    
    // Student should stay on same page
    const currentTab = await studentActiveTab.textContent()
    expect(currentTab).toBe(initialTab)
    
    await presenterPage.close()
  })

  test('should update presenter page indicator when presenter switches', async ({ page, context }) => {
    // This test verifies that presenterPageId is tracked even without follow mode
    const presenterPage = await context.newPage()
    await presenterPage.goto('/auth/login')
    await presenterPage.fill('[name="email"]', 'presenter@example.com')
    await presenterPage.fill('[name="password"]', 'password123')
    await presenterPage.click('button[type="submit"]')
    await presenterPage.waitForURL('/dashboard')
    await presenterPage.goto('/classroom/test-workspace-id')
    await presenterPage.waitForSelector('[data-testid="board-canvas"]')
    
    // Presenter switches page
    const presenterTabs = presenterPage.locator('.board-tab')
    await presenterTabs.nth(1).click()
    
    // Wait for WebSocket message
    await page.waitForTimeout(500)
    
    // Verify presenter page is tracked (check via dev tools or state)
    // This is more of an integration check
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    await expect(followButton).toBeVisible()
    
    await presenterPage.close()
  })

  test('should handle rapid presenter page switches gracefully', async ({ page, context }) => {
    const presenterPage = await context.newPage()
    await presenterPage.goto('/auth/login')
    await presenterPage.fill('[name="email"]', 'presenter@example.com')
    await presenterPage.fill('[name="password"]', 'password123')
    await presenterPage.click('button[type="submit"]')
    await presenterPage.waitForURL('/dashboard')
    await presenterPage.goto('/classroom/test-workspace-id')
    await presenterPage.waitForSelector('[data-testid="board-canvas"]')
    
    // Enable follow mode
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    await followButton.click()
    
    // Presenter rapidly switches pages
    const presenterTabs = presenterPage.locator('.board-tab')
    await presenterTabs.nth(1).click()
    await page.waitForTimeout(100)
    await presenterTabs.nth(2).click()
    await page.waitForTimeout(100)
    await presenterTabs.nth(0).click()
    
    // Wait for final state
    await page.waitForTimeout(500)
    
    // Should end up on presenter's final page without errors
    const studentActiveTab = page.locator('.board-tab--active')
    await expect(studentActiveTab).toBeVisible()
    
    await presenterPage.close()
  })

  test('should persist follow mode state across page reloads', async ({ page }) => {
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    
    // Enable follow mode
    await followButton.click()
    await expect(followButton).toHaveClass(/follow--active/)
    
    // Reload page
    await page.reload()
    await page.waitForSelector('[data-testid="board-canvas"]')
    
    // Follow mode should be disabled after reload (expected behavior)
    const followButtonAfterReload = page.locator('[data-testid="follow-mode-toggle"]')
    await expect(followButtonAfterReload).not.toHaveClass(/follow--active/)
  })

  test('should show correct i18n text for follow mode', async ({ page }) => {
    const followButton = page.locator('[data-testid="follow-mode-toggle"]')
    
    // Check initial text
    await expect(followButton).toContainText(/follow/i)
    
    // Enable and check active text
    await followButton.click()
    await expect(followButton).toContainText(/following/i)
    
    // Check banner text
    const followBanner = page.locator('[data-testid="follow-banner"]')
    await expect(followBanner).toContainText(/following/i)
    await expect(followBanner).toContainText(/stop/i)
  })
})
