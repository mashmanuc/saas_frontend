import './envGuard'
import { test, expect } from '@playwright/test'

test.describe.skip('Calendar Drag & Drop (legacy TODO)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to calendar page
    await page.goto('/calendar')
    
    // Wait for calendar to load
    await page.waitForSelector('.calendar-board-v2')
  })

  test('should drag event to new time slot', async ({ page }) => {
    // Find an event card
    const eventCard = page.locator('.event-card').first()
    await expect(eventCard).toBeVisible()
    
    // Get initial position
    const initialBox = await eventCard.boundingBox()
    expect(initialBox).not.toBeNull()
    
    // Drag event to new position (2 hours later)
    await eventCard.hover()
    await page.mouse.down()
    await page.mouse.move(initialBox!.x, initialBox!.y + 240) // 240px = 2 hours at 2px/min
    await page.mouse.up()
    
    // Wait for preview to appear
    await expect(page.locator('.preview-slot')).toBeVisible()
    
    // Confirm reschedule
    await page.click('button:has-text("Підтвердити")')
    
    // Wait for refetch
    await page.waitForResponse(response => 
      response.url().includes('/v1/calendar/week/') && response.status() === 200
    )
    
    // Verify event moved
    const newBox = await eventCard.boundingBox()
    expect(newBox!.y).toBeGreaterThan(initialBox!.y)
  })

  test('should show conflicts when dragging to occupied slot', async ({ page }) => {
    const eventCard = page.locator('.event-card').first()
    const secondEvent = page.locator('.event-card').nth(1)
    
    const targetBox = await secondEvent.boundingBox()
    expect(targetBox).not.toBeNull()
    
    // Drag to occupied slot
    await eventCard.hover()
    await page.mouse.down()
    await page.mouse.move(targetBox!.x, targetBox!.y)
    await page.mouse.up()
    
    // Wait for preview error
    await expect(page.locator('.preview-error')).toBeVisible()
    await expect(page.locator('text=конфлікт')).toBeVisible()
    
    // Confirm button should be disabled
    await expect(page.locator('button:has-text("Підтвердити")')).toBeDisabled()
  })

  test('should cancel drag on escape key', async ({ page }) => {
    const eventCard = page.locator('.event-card').first()
    
    await eventCard.hover()
    await page.mouse.down()
    await page.mouse.move(100, 100)
    
    // Press escape
    await page.keyboard.press('Escape')
    
    // Preview should disappear
    await expect(page.locator('.preview-slot')).not.toBeVisible()
  })

  test('should snap to 5-minute intervals', async ({ page }) => {
    const eventCard = page.locator('.event-card').first()
    const initialBox = await eventCard.boundingBox()
    
    // Drag to arbitrary position (not aligned to grid)
    await eventCard.hover()
    await page.mouse.down()
    await page.mouse.move(initialBox!.x, initialBox!.y + 37) // 37px = not aligned
    await page.mouse.up()
    
    // Preview should show snapped time
    const previewSlot = page.locator('.preview-slot')
    await expect(previewSlot).toBeVisible()
    
    // Time should end with :00, :05, :10, etc.
    const previewText = await previewSlot.textContent()
    expect(previewText).toMatch(/:\d[05]/)
  })
})
