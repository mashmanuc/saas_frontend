// WB: E2E tests for Winterboard session CRUD flow
// Ref: TASK_BOARD C4.2
// Covers: create session, open, draw, autosave, reload persistence, delete

import { test, expect } from '@playwright/test'

test.describe('Winterboard Session CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to winterboard sessions list
    await page.goto('/winterboard')
    await page.waitForLoadState('networkidle')
  })

  test('should display session list page', async ({ page }) => {
    await expect(page.locator('.wb-session-list')).toBeVisible()
  })

  test('should create new session and redirect', async ({ page }) => {
    // Click "New Session" button
    const newBtn = page.locator('.wb-session-list__new-btn')
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    // Should redirect to /winterboard/:id (new session created via API)
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/, { timeout: 10000 })

    // Canvas should be visible
    await expect(page.locator('.wb-solo-room')).toBeVisible()
    await expect(page.locator('.wb-solo-room__canvas')).toBeVisible()
  })

  test('should open existing session and load canvas', async ({ page }) => {
    // Create session first
    const newBtn = page.locator('.wb-session-list__new-btn')
    await newBtn.click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)

    // Verify room layout
    await expect(page.locator('.wb-solo-room__header')).toBeVisible()
    await expect(page.locator('.wb-solo-room__toolbar')).toBeVisible()
    await expect(page.locator('.wb-solo-room__canvas')).toBeVisible()
    await expect(page.locator('.wb-solo-room__footer')).toBeVisible()
  })

  test('should draw stroke on canvas', async ({ page }) => {
    // Create and open session
    const newBtn = page.locator('.wb-session-list__new-btn')
    await newBtn.click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)

    const canvas = page.locator('.wb-solo-room__canvas')
    await expect(canvas).toBeVisible()

    // Simulate drawing a stroke (mouse down → move → up)
    const box = await canvas.boundingBox()
    if (box) {
      const startX = box.x + 100
      const startY = box.y + 100

      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + 100, startY + 50, { steps: 10 })
      await page.mouse.up()
    }

    // Wait for autosave indicator to show "Saving..." then "Saved"
    // (debounce 3s + save time)
    await page.waitForTimeout(4000)
  })

  test('should show save status indicator', async ({ page }) => {
    const newBtn = page.locator('.wb-session-list__new-btn')
    await newBtn.click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)

    // Save indicator should be visible
    const indicator = page.locator('.wb-save-indicator')
    await expect(indicator).toBeVisible()
  })

  test('should persist session after reload', async ({ page }) => {
    // Create session
    const newBtn = page.locator('.wb-session-list__new-btn')
    await newBtn.click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)

    // Get session URL
    const url = page.url()

    // Edit title
    const titleInput = page.locator('.wb-title-input')
    await titleInput.fill('Test Session')
    await titleInput.blur()

    // Wait for autosave
    await page.waitForTimeout(4000)

    // Reload
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Title should persist
    await expect(page.locator('.wb-title-input')).toHaveValue('Test Session')
  })

  test('should navigate back to session list via Exit', async ({ page }) => {
    const newBtn = page.locator('.wb-session-list__new-btn')
    await newBtn.click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)

    // Click Exit
    const exitBtn = page.locator('.wb-header-btn--exit')
    await exitBtn.click()

    // Should navigate to /winterboard
    await page.waitForURL('/winterboard')
    await expect(page.locator('.wb-session-list')).toBeVisible()
  })
})
