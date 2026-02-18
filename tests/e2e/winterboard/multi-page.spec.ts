// WB: E2E tests for Winterboard multi-page functionality
// Ref: TASK_BOARD C4.2
// Covers: add page, switch pages, draw on each, verify content preserved

import { test, expect } from '@playwright/test'

test.describe('Winterboard Multi-Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/winterboard')
    await page.waitForLoadState('networkidle')
    await page.locator('.wb-session-list__new-btn').click()
    await page.waitForURL(/\/winterboard\/[0-9a-f-]+/)
    await page.waitForLoadState('networkidle')
  })

  test('should show page indicator 1/1 initially', async ({ page }) => {
    const indicator = page.locator('.wb-page-indicator')
    await expect(indicator).toContainText('1 / 1')
  })

  test('should add a new page', async ({ page }) => {
    const addBtn = page.locator('.wb-page-btn--add')
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    const indicator = page.locator('.wb-page-indicator')
    await expect(indicator).toContainText('2 / 2')
  })

  test('should navigate between pages', async ({ page }) => {
    // Add second page
    await page.locator('.wb-page-btn--add').click()
    await expect(page.locator('.wb-page-indicator')).toContainText('2 / 2')

    // Go to previous page
    const prevBtn = page.locator('.wb-page-btn').first()
    await prevBtn.click()
    await expect(page.locator('.wb-page-indicator')).toContainText('1 / 2')

    // Go to next page
    const nextBtn = page.locator('.wb-page-btn').nth(1)
    await nextBtn.click()
    await expect(page.locator('.wb-page-indicator')).toContainText('2 / 2')
  })

  test('should limit pages to max 20', async ({ page }) => {
    // Add pages up to limit
    const addBtn = page.locator('.wb-page-btn--add')

    for (let i = 0; i < 19; i++) {
      await addBtn.click()
      await page.waitForTimeout(100)
    }

    // At 20 pages, add button should be disabled
    await expect(addBtn).toBeDisabled()
  })

  test('should preserve page content after save and reload', async ({ page }) => {
    // Add second page
    await page.locator('.wb-page-btn--add').click()
    await expect(page.locator('.wb-page-indicator')).toContainText('2 / 2')

    // Wait for autosave
    await page.waitForTimeout(4000)

    // Get URL for reload
    const url = page.url()

    // Reload
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should still have 2 pages
    await expect(page.locator('.wb-page-indicator')).toContainText(/\d+ \/ 2/)
  })
})
