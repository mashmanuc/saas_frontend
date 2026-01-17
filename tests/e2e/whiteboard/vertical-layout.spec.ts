import { test, expect } from '@playwright/test'

test.describe('Whiteboard Vertical Layout (v0.90.0)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/classroom/workspace/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'workspace-1',
          pages: [
            { id: 'page-1', title: 'Page 1', index: 0, version: 1, updatedAt: '2024-01-01T00:00:00Z' },
            { id: 'page-2', title: 'Page 2', index: 1, version: 1, updatedAt: '2024-01-01T00:00:00Z' },
            { id: 'page-3', title: 'Page 3', index: 2, version: 1, updatedAt: '2024-01-01T00:00:00Z' }
          ],
          limits: { maxPages: 10 },
          role: 'editor',
          isFrozen: false,
          presenterUserId: null
        })
      })
    })

    await page.route('**/api/v1/classroom/page/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'page-1',
          state: { strokes: [], assets: [] },
          version: 1
        })
      })
    })
  })

  test('should render vertical stack when feature flag enabled', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token', {
      waitUntil: 'networkidle'
    })

    const verticalStack = page.locator('.page-vertical-stack')
    await expect(verticalStack).toBeVisible()

    const pageItems = page.locator('.page-stack__item')
    await expect(pageItems).toHaveCount(3)
  })

  test('should lazy render pages with IntersectionObserver', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    // First page should be visible immediately
    const firstPage = page.locator('[data-page-id="page-1"]')
    await expect(firstPage).toHaveClass(/page-stack__item--visible/)

    // Scroll to second page
    await page.locator('[data-page-id="page-2"]').scrollIntoViewIfNeeded()
    
    const secondPage = page.locator('[data-page-id="page-2"]')
    await expect(secondPage).toHaveClass(/page-stack__item--visible/)
  })

  test('should smooth scroll to presenter page in follow mode', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    // Enable follow mode
    await page.click('[data-testid="follow-mode-toggle"]')

    // Simulate presenter page change via WebSocket
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('presenter-page-changed', {
        detail: { pageId: 'page-3' }
      }))
    })

    // Should scroll to page 3
    const thirdPage = page.locator('[data-page-id="page-3"]')
    await expect(thirdPage).toBeInViewport()
  })

  test('should toggle TaskDock states: hidden -> peek -> expanded', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    const taskDock = page.locator('.task-dock')
    
    // Initially hidden
    await expect(taskDock).toHaveClass(/task-dock--hidden/)

    // Click toggle to peek
    await page.click('[data-testid="task-dock-toggle"]')
    await expect(taskDock).toHaveClass(/task-dock--peek/)

    // Click toggle to expanded
    await page.click('[data-testid="task-dock-toggle"]')
    await expect(taskDock).toHaveClass(/task-dock--expanded/)

    // Click toggle back to hidden
    await page.click('[data-testid="task-dock-toggle"]')
    await expect(taskDock).toHaveClass(/task-dock--hidden/)
  })

  test('should collapse sidebar when vertical layout enabled', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    const sidebar = page.locator('.classroom-sidebar')
    await expect(sidebar).toHaveClass(/sidebar--collapsed/)
  })

  test('should use CSS grid layout for responsive design', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    const host = page.locator('.classroom-whiteboard-host')
    
    // Desktop: grid with 2 columns
    await page.setViewportSize({ width: 1024, height: 768 })
    const gridTemplate = await host.evaluate((el) => 
      window.getComputedStyle(el).gridTemplateColumns
    )
    expect(gridTemplate).toContain('1fr auto')

    // Mobile: grid with 1 column
    await page.setViewportSize({ width: 375, height: 667 })
    const mobileGridTemplate = await host.evaluate((el) => 
      window.getComputedStyle(el).gridTemplateColumns
    )
    expect(mobileGridTemplate).toBe('1fr')
  })

  test('should show skeleton loader for non-visible pages', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    // Page 3 should not be visible initially
    const thirdPage = page.locator('[data-page-id="page-3"]')
    const skeleton = thirdPage.locator('.skeleton-loader')
    
    await expect(skeleton).toBeVisible()

    // Scroll to page 3
    await thirdPage.scrollIntoViewIfNeeded()
    
    // Skeleton should be replaced with content
    await expect(skeleton).not.toBeVisible()
    const canvas = thirdPage.locator('.page-stack__canvas')
    await expect(canvas).toBeVisible()
  })

  test('should highlight active page', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    const firstPage = page.locator('[data-page-id="page-1"]')
    await expect(firstPage).toHaveClass(/page-stack__item--active/)

    // Click on second page
    await page.locator('[data-page-id="page-2"]').click()

    const secondPage = page.locator('[data-page-id="page-2"]')
    await expect(secondPage).toHaveClass(/page-stack__item--active/)
    await expect(firstPage).not.toHaveClass(/page-stack__item--active/)
  })

  test('should show presenter indicator in follow mode', async ({ page }) => {
    await page.goto('/classroom/lesson/test-session?token=test-token')

    // Enable follow mode
    await page.click('[data-testid="follow-mode-toggle"]')

    // Simulate presenter on page 2
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('presenter-page-changed', {
        detail: { pageId: 'page-2' }
      }))
    })

    const secondPage = page.locator('[data-page-id="page-2"]')
    await expect(secondPage).toHaveClass(/page-stack__item--presenter/)
  })

  test('should fallback to legacy BoardDock when workspace_id missing', async ({ page }) => {
    await page.route('**/api/v1/classroom/session/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uuid: 'session-1',
          workspace_id: null, // No workspace
          status: 'active'
        })
      })
    })

    await page.goto('/classroom/lesson/test-session?token=test-token')

    // Should render legacy BoardDock
    const boardDock = page.locator('.board-dock')
    await expect(boardDock).toBeVisible()

    // Should NOT render vertical stack
    const verticalStack = page.locator('.page-vertical-stack')
    await expect(verticalStack).not.toBeVisible()
  })
})
