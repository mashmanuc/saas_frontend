import './envGuard'
import { test, expect } from '@playwright/test'

test.describe.skip('Calendar Quick Block (legacy TODO)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForSelector('.calendar-board-v2')
  })

  test('should open quick block modal from header', async ({ page }) => {
    // Click "Відмітити вільний час" button
    const quickBlockButton = page.locator('button:has-text("Відмітити вільний час")')
    await expect(quickBlockButton).toBeVisible()
    await quickBlockButton.click()
    
    // Modal should open
    await expect(page.locator('.quick-block-modal')).toBeVisible()
    await expect(page.locator('h3:has-text("Заблокувати час")')).toBeVisible()
  })

  test('should block time range', async ({ page }) => {
    // Open quick block modal
    await page.click('button:has-text("Відмітити вільний час")')
    
    // Select date
    await page.fill('input[type="date"]', '2025-12-25')
    
    // Select start time
    await page.fill('input[name="start_time"]', '14:00')
    
    // Select end time
    await page.fill('input[name="end_time"]', '16:00')
    
    // Enter reason
    await page.fill('textarea[name="reason"]', 'Особисті справи')
    
    // Submit
    await page.click('button:has-text("Заблокувати")')
    
    // Wait for API call
    await page.waitForResponse(response => 
      response.url().includes('/block-range/') && response.status() === 200
    )
    
    // Wait for refetch
    await page.waitForResponse(response => 
      response.url().includes('/v1/calendar/week/') && response.status() === 200
    )
    
    // Modal should close
    await expect(page.locator('.quick-block-modal')).not.toBeVisible()
    
    // Blocked range should appear on calendar
    const blockedRange = page.locator('.blocked-range').first()
    await expect(blockedRange).toBeVisible()
  })

  test('should validate time range', async ({ page }) => {
    await page.click('button:has-text("Відмітити вільний час")')
    
    // Select date
    await page.fill('input[type="date"]', '2025-12-25')
    
    // Set end time before start time
    await page.fill('input[name="start_time"]', '16:00')
    await page.fill('input[name="end_time"]', '14:00')
    
    // Submit
    await page.click('button:has-text("Заблокувати")')
    
    // Error message should appear
    await expect(page.locator('text=Час закінчення має бути пізніше')).toBeVisible()
    
    // Modal should stay open
    await expect(page.locator('.quick-block-modal')).toBeVisible()
  })

  test('should show blocked range with diagonal stripes', async ({ page }) => {
    // Find blocked range
    const blockedRange = page.locator('.blocked-range').first()
    await expect(blockedRange).toBeVisible()
    
    // Should have diagonal stripes background
    const background = await blockedRange.evaluate(el => 
      window.getComputedStyle(el).backgroundImage
    )
    expect(background).toContain('linear-gradient')
    
    // Should have dashed border
    const borderStyle = await blockedRange.evaluate(el => 
      window.getComputedStyle(el).borderStyle
    )
    expect(borderStyle).toContain('dashed')
  })

  test('should unblock time range', async ({ page }) => {
    // Click on blocked range
    const blockedRange = page.locator('.blocked-range').first()
    await blockedRange.click()
    
    // Context menu should appear
    await expect(page.locator('.context-menu')).toBeVisible()
    
    // Click unblock
    await page.click('button:has-text("Розблокувати")')
    
    // Confirm dialog
    await page.click('button:has-text("Так")')
    
    // Wait for API call
    await page.waitForResponse(response => 
      response.url().includes('/blocked-ranges/') && 
      response.request().method() === 'DELETE' &&
      response.status() === 200
    )
    
    // Wait for refetch
    await page.waitForResponse(response => 
      response.url().includes('/v1/calendar/week/') && response.status() === 200
    )
    
    // Blocked range should disappear
    await expect(blockedRange).not.toBeVisible()
  })

  test('should prevent blocking time with existing lessons', async ({ page }) => {
    await page.click('button:has-text("Відмітити вільний час")')
    
    // Try to block time that has a lesson
    await page.fill('input[type="date"]', '2025-12-24')
    await page.fill('input[name="start_time"]', '10:00')
    await page.fill('input[name="end_time"]', '11:00')
    await page.fill('textarea[name="reason"]', 'Test')
    
    await page.click('button:has-text("Заблокувати")')
    
    // Error should appear
    await expect(page.locator('text=У цей час вже є урок')).toBeVisible()
    
    // Submit button should be disabled
    await expect(page.locator('button:has-text("Заблокувати")')).toBeDisabled()
  })
})
