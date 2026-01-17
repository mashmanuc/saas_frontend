/**
 * E2E Tests - v0.92.0 Dev Vertical Layout
 * Tests for dev launcher → vertical whiteboard stack flow
 */

import { test, expect } from '@playwright/test'

test.describe('Dev Vertical Layout v0.92.0', () => {
  test.beforeEach(async ({ page }) => {
    // Set feature flag for vertical layout
    await page.addInitScript(() => {
      window.localStorage.setItem('VITE_VERTICAL_LAYOUT', 'true')
    })
  })

  test('dev launcher creates session with vertical layout', async ({ page }) => {
    // Navigate to dev launcher
    await page.goto('/dev/classroom')
    
    // Wait for launcher to load
    await expect(page.locator('h1')).toContainText('Dev Classroom Launcher')
    
    // Create new session
    await page.click('button:has-text("Create & Join")')
    
    // Wait for redirect to lesson room
    await page.waitForURL(/\/classroom\/.*/)
    
    // Verify we're in a dev session (workspace_id starts with dev-workspace-)
    const sessionId = page.url().match(/\/classroom\/([^?]+)/)?.[1]
    expect(sessionId).toBeTruthy()
    
    // Wait for whiteboard to load
    await page.waitForSelector('.classroom-whiteboard-host', { timeout: 10000 })
    
    // Verify vertical layout is active
    const whiteboardHost = page.locator('.classroom-whiteboard-host')
    await expect(whiteboardHost).toHaveClass(/whiteboard-host--vertical/)
    
    // Verify PageVerticalStack is rendered
    const verticalStack = page.locator('.page-vertical-stack')
    await expect(verticalStack).toBeVisible()
    
    // Verify 4 placeholder pages exist
    const pages = page.locator('.page-stack__item')
    await expect(pages).toHaveCount(4)
    
    // Verify page titles
    await expect(pages.nth(0).locator('.page-stack__title')).toContainText('Page 1')
    await expect(pages.nth(1).locator('.page-stack__title')).toContainText('Page 2')
    await expect(pages.nth(2).locator('.page-stack__title')).toContainText('Page 3')
    await expect(pages.nth(3).locator('.page-stack__title')).toContainText('Page 4')
    
    // Verify first page is active
    await expect(pages.nth(0)).toHaveClass(/page-stack__item--active/)
  })

  test('vertical layout does not render VideoDock', async ({ page }) => {
    await page.goto('/dev/classroom')
    await page.click('button:has-text("Create & Join")')
    await page.waitForURL(/\/classroom\/.*/)
    
    // Wait for whiteboard
    await page.waitForSelector('.classroom-whiteboard-host', { timeout: 10000 })
    
    // Verify VideoDock is NOT rendered
    const videoDock = page.locator('.video-dock')
    await expect(videoDock).not.toBeVisible()
  })

  test('vertical stack is scrollable', async ({ page }) => {
    await page.goto('/dev/classroom')
    await page.click('button:has-text("Create & Join")')
    await page.waitForURL(/\/classroom\/.*/)
    
    await page.waitForSelector('.page-vertical-stack', { timeout: 10000 })
    
    const stack = page.locator('.page-vertical-stack')
    
    // Verify stack has overflow-y: auto
    const overflowY = await stack.evaluate(el => window.getComputedStyle(el).overflowY)
    expect(overflowY).toBe('auto')
    
    // Scroll to page 3
    const page3 = page.locator('.page-stack__item').nth(2)
    await page3.scrollIntoViewIfNeeded()
    
    // Verify page 3 is visible
    await expect(page3).toBeInViewport()
  })

  test('production session does not use vertical layout', async ({ page }) => {
    // Mock production session (without dev-workspace- prefix)
    await page.route('**/api/v1/classroom/sessions/*/join/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            uuid: 'prod-session-123',
            session_type: 'lesson',
            status: 'active',
            host: { id: 1, name: 'Teacher', avatar: '' },
            participants: [],
            board_version: 0,
            settings: {
              allow_recording: false,
              auto_save_interval: 60,
              max_participants: 10,
              board_background: '#ffffff',
            },
          },
          token: 'prod-token',
          permissions: { can_draw: true },
          board_state: {},
          participant: { user_id: 1, role: 'host' },
        }),
      })
    })

    await page.goto('/classroom/prod-session-123')
    
    // Wait for room to load
    await page.waitForSelector('.lesson-room', { timeout: 10000 })
    
    // Verify BoardDock is rendered (not ClassroomWhiteboardHost)
    const boardDock = page.locator('.board-dock')
    await expect(boardDock).toBeVisible()
    
    // Verify PageVerticalStack is NOT rendered
    const verticalStack = page.locator('.page-vertical-stack')
    await expect(verticalStack).not.toBeVisible()
    
    // Verify VideoDock IS rendered
    const videoDock = page.locator('.video-dock')
    await expect(videoDock).toBeVisible()
  })

  test('page highlighting on scroll', async ({ page }) => {
    await page.goto('/dev/classroom')
    await page.click('button:has-text("Create & Join")')
    await page.waitForURL(/\/classroom\/.*/)
    
    await page.waitForSelector('.page-vertical-stack', { timeout: 10000 })
    
    const pages = page.locator('.page-stack__item')
    
    // Initially page 1 is active
    await expect(pages.nth(0)).toHaveClass(/page-stack__item--active/)
    
    // Scroll to page 2
    await pages.nth(1).scrollIntoViewIfNeeded()
    await page.waitForTimeout(500) // Wait for intersection observer
    
    // Page 2 should become visible
    await expect(pages.nth(1)).toHaveClass(/page-stack__item--visible/)
  })

  test('dev workspace has full permissions', async ({ page }) => {
    await page.goto('/dev/classroom')
    await page.click('button:has-text("Create & Join")')
    await page.waitForURL(/\/classroom\/.*/)
    
    await page.waitForSelector('.classroom-whiteboard-host', { timeout: 10000 })
    
    // Verify whiteboard is not in readonly mode
    const whiteboardHost = page.locator('.classroom-whiteboard-host')
    await expect(whiteboardHost).not.toHaveClass(/whiteboard-host--readonly/)
    
    // Verify no frozen state
    await expect(whiteboardHost).not.toHaveClass(/whiteboard-host--frozen/)
  })
})
