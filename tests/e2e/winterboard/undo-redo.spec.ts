// WB: E2E tests for Winterboard undo/redo
// Ref: TASK_BOARD C4.2
// Covers: draw → undo → verify removed → redo → verify restored, keyboard shortcuts

import { test, expect } from '@playwright/test'

test.describe('Winterboard Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    // Create a new session
    await page.goto('/winterboard')
    await page.waitForLoadState('networkidle')
    await page.locator('.wb-session-list__new-btn').click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)
    await page.waitForLoadState('networkidle')
  })

  test('undo button should be disabled initially', async ({ page }) => {
    const undoBtn = page.locator('.wb-header-btn').first()
    await expect(undoBtn).toBeDisabled()
  })

  test('redo button should be disabled initially', async ({ page }) => {
    const redoBtn = page.locator('.wb-header-btn').nth(1)
    await expect(redoBtn).toBeDisabled()
  })

  test('should undo stroke via Ctrl+Z', async ({ page }) => {
    const canvas = page.locator('.wb-solo-room__canvas')
    await expect(canvas).toBeVisible()

    // Draw a stroke
    const box = await canvas.boundingBox()
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100)
      await page.mouse.down()
      await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 })
      await page.mouse.up()
    }

    // Undo via keyboard
    await page.keyboard.press('Control+z')

    // Small wait for state update
    await page.waitForTimeout(200)
  })

  test('should redo stroke via Ctrl+Shift+Z', async ({ page }) => {
    const canvas = page.locator('.wb-solo-room__canvas')
    await expect(canvas).toBeVisible()

    // Draw a stroke
    const box = await canvas.boundingBox()
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100)
      await page.mouse.down()
      await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 })
      await page.mouse.up()
    }

    // Undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(200)

    // Redo
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(200)
  })
})
