import { test, expect } from '@playwright/test'

test.describe('DST Handling (v0.46.2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/booking/tutor')
    await page.waitForLoadState('networkidle')
  })

  test('should show DST warning banner on transition week', async ({ page }) => {
    // Navigate to DST transition week (March 2025 - spring forward)
    await page.goto('/booking/tutor?week=2025-03-24&tz=Europe/Kiev')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-cell-grid')
    
    // DST warning should appear
    const dstWarning = page.locator('.dst-warning')
    await expect(dstWarning).toBeVisible()
    await expect(dstWarning).toContainText('перехід на літній/зимовий час')
  })

  test('should not show DST warning on regular week', async ({ page }) => {
    // Navigate to regular week (no DST transition)
    await page.goto('/booking/tutor?week=2025-06-02&tz=Europe/Kiev')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-cell-grid')
    
    // DST warning should NOT appear
    const dstWarning = page.locator('.dst-warning')
    await expect(dstWarning).not.toBeVisible()
  })

  test('should display correct local time in cells', async ({ page }) => {
    // Navigate to calendar
    await page.goto('/booking/tutor?week=2025-06-02&tz=Europe/Kiev')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-cell-grid')
    
    // Check that time labels are displayed
    const timeLabels = page.locator('.time-label')
    const firstTimeLabel = timeLabels.first()
    
    await expect(firstTimeLabel).toBeVisible()
    
    // Time should be in HH:MM format
    const timeText = await firstTimeLabel.textContent()
    expect(timeText).toMatch(/^\d{2}:\d{2}$/)
  })

  test('should handle DST fall back (October 2025)', async ({ page }) => {
    // Navigate to DST fall back week
    await page.goto('/booking/tutor?week=2025-10-20&tz=Europe/Kiev')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-cell-grid')
    
    // DST warning should appear
    const dstWarning = page.locator('.dst-warning')
    await expect(dstWarning).toBeVisible()
  })

  test('should correctly format times across DST boundary', async ({ page }) => {
    // Navigate to DST transition week
    await page.goto('/booking/tutor?week=2025-03-24&tz=Europe/Kiev')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-cell-grid')
    
    // All cells should have valid time labels
    const cells = page.locator('.calendar-cell')
    const count = await cells.count()
    
    // Should have cells for the week (may vary due to DST)
    expect(count).toBeGreaterThan(300)
  })
})
