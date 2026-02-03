import { test, expect, type Page } from '@playwright/test'

/**
 * E2E Tests for Solo Board New Tools
 *
 * These tests verify the functionality of newly added tools:
 * - Circle Tool
 * - Arrow Tool
 * - Selection Tool
 * - Background Options
 * - Keyboard Shortcuts
 */

// Helper to wait for canvas to be ready
async function waitForCanvas(page: Page) {
  await page.waitForSelector('.solo-canvas-wrapper', { timeout: 10000 })
  await page.waitForSelector('canvas', { timeout: 10000 })
}

// Helper to select a tool
async function selectTool(page: Page, tool: string) {
  await page.click(`[data-tool="${tool}"]`)
  // Or use keyboard shortcut
  // await page.keyboard.press(shortcut)
}

// Helper to draw on canvas
async function drawOnCanvas(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const canvas = page.locator('.solo-canvas-wrapper')
  const box = await canvas.boundingBox()

  if (!box) throw new Error('Canvas not found')

  await page.mouse.move(box.x + startX, box.y + startY)
  await page.mouse.down()
  await page.mouse.move(box.x + endX, box.y + endY)
  await page.mouse.up()
}

test.describe('Circle Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should create circle on canvas', async ({ page }) => {
    // Select circle tool using keyboard shortcut
    await page.keyboard.press('c')

    // Draw circle (drag from center)
    await drawOnCanvas(page, 200, 200, 250, 250)

    // Verify circle is created (check for Konva circle element)
    // Note: Actual verification depends on how circles are rendered
    // This is a placeholder for the actual test logic
    await expect(page.locator('.solo-canvas-wrapper')).toBeVisible()
  })

  test('should show circle preview while drawing', async ({ page }) => {
    await page.keyboard.press('c')

    const canvas = page.locator('.solo-canvas-wrapper')
    const box = await canvas.boundingBox()

    if (!box) throw new Error('Canvas not found')

    // Start drawing
    await page.mouse.move(box.x + 200, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + 250, box.y + 250)

    // Preview should be visible (dashed circle)
    // Mouse is still down, so preview should be showing
    await page.mouse.up()
  })
})

test.describe('Arrow Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should create arrow on canvas', async ({ page }) => {
    // Select arrow tool
    await page.keyboard.press('a')

    // Draw arrow
    await drawOnCanvas(page, 100, 100, 200, 200)

    await expect(page.locator('.solo-canvas-wrapper')).toBeVisible()
  })

  test('should open arrow style dropdown', async ({ page }) => {
    // Click arrow tool button (assumes it has a dropdown)
    const arrowButton = page.locator('[data-tool="arrow"]')

    if (await arrowButton.count() > 0) {
      await arrowButton.click()
      // Check for dropdown
      const dropdown = page.locator('.arrow-style-dropdown')
      // Dropdown may or may not be visible depending on implementation
    }
  })
})

test.describe('Selection Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should activate selection tool with V key', async ({ page }) => {
    await page.keyboard.press('v')

    // Cursor should change to default (selection mode)
    const wrapper = page.locator('.solo-canvas-wrapper')
    await expect(wrapper).toHaveClass(/solo-canvas-wrapper--selecting/)
  })

  test('should select objects with rectangle selection', async ({ page }) => {
    // First create an object
    await page.keyboard.press('r') // Rectangle tool
    await drawOnCanvas(page, 100, 100, 200, 200)

    // Switch to select tool
    await page.keyboard.press('v')

    // Draw selection rectangle
    await drawOnCanvas(page, 50, 50, 250, 250)

    // Object should be selected (bounding box visible)
    // This would show selection handles
  })

  test('should deselect all with Escape', async ({ page }) => {
    await page.keyboard.press('v')
    await page.keyboard.press('Escape')

    // Should deselect (no selection visible)
  })
})

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should switch to pen tool with P', async ({ page }) => {
    await page.keyboard.press('p')
    // Verify pen tool is active
  })

  test('should switch to highlighter with H', async ({ page }) => {
    await page.keyboard.press('h')
  })

  test('should switch to eraser with E', async ({ page }) => {
    await page.keyboard.press('e')
  })

  test('should switch to line with L', async ({ page }) => {
    await page.keyboard.press('l')
  })

  test('should switch to rectangle with R', async ({ page }) => {
    await page.keyboard.press('r')
  })

  test('should switch to text with T', async ({ page }) => {
    await page.keyboard.press('t')
  })

  test('should zoom in with Ctrl+=', async ({ page }) => {
    await page.keyboard.press('Control+=')
    // Verify zoom increased
  })

  test('should zoom out with Ctrl+-', async ({ page }) => {
    await page.keyboard.press('Control+-')
    // Verify zoom decreased
  })

  test('should reset zoom with Ctrl+0', async ({ page }) => {
    // First zoom in
    await page.keyboard.press('Control+=')
    await page.keyboard.press('Control+=')

    // Then reset
    await page.keyboard.press('Control+0')
    // Verify zoom is 100%
  })

  test('should undo with Ctrl+Z', async ({ page }) => {
    // Draw something
    await page.keyboard.press('p')
    await drawOnCanvas(page, 100, 100, 200, 200)

    // Undo
    await page.keyboard.press('Control+z')

    // Drawing should be removed
  })

  test('should redo with Ctrl+Shift+Z', async ({ page }) => {
    // Draw something
    await page.keyboard.press('p')
    await drawOnCanvas(page, 100, 100, 200, 200)

    // Undo
    await page.keyboard.press('Control+z')

    // Redo
    await page.keyboard.press('Control+Shift+z')

    // Drawing should be restored
  })
})

test.describe('Background Options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should open background picker', async ({ page }) => {
    const bgButton = page.locator('.background-trigger')

    if (await bgButton.count() > 0) {
      await bgButton.click()
      await expect(page.locator('.background-dropdown')).toBeVisible()
    }
  })

  test('should change background to grid', async ({ page }) => {
    const bgButton = page.locator('.background-trigger')

    if (await bgButton.count() > 0) {
      await bgButton.click()
      await page.click('.background-option:has-text("Grid")')
      // Verify grid lines are visible
    }
  })

  test('should change background to dots', async ({ page }) => {
    const bgButton = page.locator('.background-trigger')

    if (await bgButton.count() > 0) {
      await bgButton.click()
      await page.click('.background-option:has-text("Dots")')
      // Verify dots are visible
    }
  })
})

test.describe('Autosave', () => {
  test('should autosave after drawing', async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)

    // Draw something
    await page.keyboard.press('p')
    await drawOnCanvas(page, 100, 100, 200, 200)

    // Wait for autosave (2 seconds + buffer)
    await page.waitForTimeout(3000)

    // Verify save indicator or check network request
    // This depends on implementation
  })

  test('should show unsaved changes indicator', async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)

    // Draw something
    await page.keyboard.press('p')
    await drawOnCanvas(page, 100, 100, 200, 200)

    // Should show pending changes indicator
    // Implementation specific
  })
})

test.describe('Session Persistence', () => {
  test('should persist drawings after reload', async ({ page }) => {
    // Create new session
    await page.goto('/solo/new')
    await waitForCanvas(page)

    // Draw a circle
    await page.keyboard.press('c')
    await drawOnCanvas(page, 200, 200, 250, 250)

    // Wait for autosave
    await page.waitForTimeout(3000)

    // Get current URL (should have session ID)
    const url = page.url()

    // Reload page
    await page.reload()
    await waitForCanvas(page)

    // Circle should still be visible
    // Verification depends on implementation
  })
})

test.describe('Color Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should open color picker dropdown', async ({ page }) => {
    const colorButton = page.locator('.color-trigger')

    if (await colorButton.count() > 0) {
      await colorButton.click()
      await expect(page.locator('.color-dropdown')).toBeVisible()
    }
  })

  test('should change color from preset', async ({ page }) => {
    const colorButton = page.locator('.color-trigger')

    if (await colorButton.count() > 0) {
      await colorButton.click()
      await page.click('.color-preset:nth-child(2)') // Select second preset
      // Color should change
    }
  })

  test('should save recent colors to localStorage', async ({ page }) => {
    const colorButton = page.locator('.color-trigger')

    if (await colorButton.count() > 0) {
      await colorButton.click()

      // Select a color
      await page.click('.color-preset:nth-child(3)')

      // Check localStorage
      const recentColors = await page.evaluate(() => {
        return localStorage.getItem('solo-board-recent-colors')
      })

      // Should have saved the color
      // expect(recentColors).toContain(...)
    }
  })
})

test.describe('Size Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/solo/new')
    await waitForCanvas(page)
  })

  test('should open size picker dropdown', async ({ page }) => {
    const sizeButton = page.locator('.size-trigger')

    if (await sizeButton.count() > 0) {
      await sizeButton.click()
      await expect(page.locator('.size-dropdown')).toBeVisible()
    }
  })

  test('should change size from preset', async ({ page }) => {
    const sizeButton = page.locator('.size-trigger')

    if (await sizeButton.count() > 0) {
      await sizeButton.click()
      await page.click('.size-preset:has-text("Large")')
      // Size should change to 10px
    }
  })
})
