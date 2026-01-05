import './envGuard'
import { test, expect } from '@playwright/test'

test.describe.skip('Calendar No-Show (legacy TODO)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForSelector('.calendar-board-v2')
  })

  test('should mark past lesson as no-show', async ({ page }) => {
    // Click on a past event
    const pastEvent = page.locator('.event-card.is-past').first()
    await pastEvent.click()
    
    // Drawer should open
    await expect(page.locator('.lesson-card-drawer')).toBeVisible()
    
    // No-show button should be visible for past lessons
    const noShowButton = page.locator('button:has-text("Позначити No-show")')
    await expect(noShowButton).toBeVisible()
    
    // Click no-show button
    await noShowButton.click()
    
    // Confirm dialog
    await page.click('button:has-text("OK")')
    
    // Wait for API call
    await page.waitForResponse(response => 
      response.url().includes('/no-show/') && response.status() === 200
    )
    
    // Wait for refetch
    await page.waitForResponse(response => 
      response.url().includes('/v1/calendar/week/') && response.status() === 200
    )
    
    // Drawer should close
    await expect(page.locator('.lesson-card-drawer')).not.toBeVisible()
    
    // Event should now have no-show styling
    await expect(pastEvent).toHaveClass(/is-no-show/)
  })

  test('should not show no-show button for future lessons', async ({ page }) => {
    // Click on a future event (not past)
    const futureEvent = page.locator('.event-card:not(.is-past)').first()
    await futureEvent.click()
    
    // Drawer should open
    await expect(page.locator('.lesson-card-drawer')).toBeVisible()
    
    // No-show button should NOT be visible
    const noShowButton = page.locator('button:has-text("Позначити No-show")')
    await expect(noShowButton).not.toBeVisible()
  })

  test('should show no-show reason selection', async ({ page }) => {
    const pastEvent = page.locator('.event-card.is-past').first()
    await pastEvent.click()
    
    const noShowButton = page.locator('button:has-text("Позначити No-show")')
    await noShowButton.click()
    
    // Reason modal should appear
    await expect(page.locator('.no-show-reason-modal')).toBeVisible()
    
    // Should show reason options
    await expect(page.locator('select[name="reason_id"]')).toBeVisible()
    await expect(page.locator('textarea[name="comment"]')).toBeVisible()
    
    // Select reason and add comment
    await page.selectOption('select[name="reason_id"]', '1')
    await page.fill('textarea[name="comment"]', 'Студент не відповідав на дзвінки')
    
    // Confirm
    await page.click('button:has-text("Підтвердити")')
    
    // Wait for API call with payload
    const response = await page.waitForResponse(response => 
      response.url().includes('/no-show/') && response.status() === 200
    )
    
    const requestBody = await response.request().postDataJSON()
    expect(requestBody).toMatchObject({
      reason_id: 1,
      comment: 'Студент не відповідав на дзвінки'
    })
  })

  test('should display no-show badge on event card', async ({ page }) => {
    // Find no-show event
    const noShowEvent = page.locator('.event-card.is-no-show').first()
    await expect(noShowEvent).toBeVisible()
    
    // Should have strikethrough text
    await expect(noShowEvent).toHaveCSS('text-decoration', /line-through/)
    
    // Should have gray background
    await expect(noShowEvent).toHaveCSS('background-color', 'rgb(117, 117, 117)')
  })
})
