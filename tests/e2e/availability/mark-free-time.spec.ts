/**
 * E2E Tests for Mark Free Time (v0.55.7)
 * 
 * Tests the availability editor draft mode workflow:
 * - Scenario 1: Tutor adds ≥3 slots → apply → sees toast + updated metric
 * - Scenario 2: Conflict with lesson → 409 → drawer shows cause
 * 
 * Reference: backend/docs/plan/v0.55.7/frontend_task.md, section 8
 */

import { test, expect } from '@playwright/test'

test.describe('Mark Free Time - Availability Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'testpass123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard')
    
    // Navigate to calendar
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
  })

  test('Scenario 1: Successfully add ≥3 slots and apply', async ({ page }) => {
    // Enter availability mode
    await page.click('button:has-text("Mark Free Time")')
    
    // Wait for availability toolbar to appear
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    
    // Verify initial state
    const progressText = await page.locator('.workload-hours').textContent()
    expect(progressText).toBeTruthy()
    
    // Add 3 slots by clicking on empty cells
    // Click on Monday 10:00
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="10"]')
    await page.waitForTimeout(300)
    
    // Click on Monday 14:00
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="14"]')
    await page.waitForTimeout(300)
    
    // Click on Tuesday 11:00
    await page.click('.calendar-grid .day-column:nth-child(2) .time-slot[data-hour="11"]')
    await page.waitForTimeout(300)
    
    // Verify changes summary shows 3 added slots
    await expect(page.locator('.changes-summary')).toContainText('3')
    await expect(page.locator('.changes-summary')).toContainText('added')
    
    // Verify hours delta is positive
    const deltaText = await page.locator('.summary-item.total').textContent()
    expect(deltaText).toContain('+')
    
    // Click save button
    await page.click('button:has-text("Save")')
    
    // Wait for API call to complete
    await page.waitForResponse(response => 
      response.url().includes('/availability/draft/') && 
      response.url().includes('/apply') &&
      response.status() === 200
    )
    
    // Verify success toast appears
    await expect(page.locator('.toast.success')).toBeVisible()
    await expect(page.locator('.toast.success')).toContainText('success')
    
    // Verify toolbar is hidden (exited mode)
    await expect(page.locator('.availability-toolbar')).not.toBeVisible()
    
    // Verify calendar updated with new slots
    await page.waitForTimeout(500)
    const slots = await page.locator('.accessible-slot').count()
    expect(slots).toBeGreaterThanOrEqual(3)
  })

  test('Scenario 2: Conflict with existing lesson shows drawer', async ({ page }) => {
    // Setup: Create a lesson at Monday 10:00 via API
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/calendar/events/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          start: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T10:00:00Z',
          end: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T11:00:00Z',
          studentId: 1,
          status: 'scheduled'
        })
      })
      return response.json()
    })
    
    // Reload calendar to show the lesson
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Enter availability mode
    await page.click('button:has-text("Mark Free Time")')
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    
    // Try to add slot at same time as lesson (Monday 10:00)
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="10"]')
    await page.waitForTimeout(300)
    
    // Verify changes summary shows 1 added slot
    await expect(page.locator('.changes-summary')).toContainText('1')
    
    // Click save button
    await page.click('button:has-text("Save")')
    
    // Wait for 409 Conflict response
    await page.waitForResponse(response => 
      response.url().includes('/availability/draft/') && 
      response.url().includes('/apply') &&
      response.status() === 409
    )
    
    // Verify conflicts drawer appears
    await expect(page.locator('.availability-conflicts-drawer')).toBeVisible()
    
    // Verify conflict details are shown
    await expect(page.locator('.conflict-entry')).toBeVisible()
    await expect(page.locator('.conflict-entry')).toContainText('event_overlap')
    
    // Verify conflict shows student name or lesson info
    const conflictText = await page.locator('.conflict-entry').textContent()
    expect(conflictText).toBeTruthy()
    expect(conflictText.length).toBeGreaterThan(10)
    
    // Close drawer
    await page.click('.availability-conflicts-drawer button:has-text("Close")')
    await expect(page.locator('.availability-conflicts-drawer')).not.toBeVisible()
    
    // Verify still in edit mode (can cancel)
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('.availability-toolbar')).not.toBeVisible()
  })

  test('Scenario 3: Undo/Redo functionality works', async ({ page }) => {
    // Enter availability mode
    await page.click('button:has-text("Mark Free Time")')
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    
    // Add 1 slot
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="10"]')
    await page.waitForTimeout(300)
    
    // Verify undo button is enabled
    await expect(page.locator('button:has-text("Undo")')).toBeEnabled()
    
    // Click undo
    await page.click('button:has-text("Undo")')
    await page.waitForTimeout(200)
    
    // Verify changes summary shows 0 slots
    const summaryVisible = await page.locator('.changes-summary').isVisible()
    if (summaryVisible) {
      await expect(page.locator('.changes-summary')).toContainText('0')
    }
    
    // Verify redo button is enabled
    await expect(page.locator('button:has-text("Redo")')).toBeEnabled()
    
    // Click redo
    await page.click('button:has-text("Redo")')
    await page.waitForTimeout(200)
    
    // Verify changes summary shows 1 slot again
    await expect(page.locator('.changes-summary')).toContainText('1')
  })

  test('Scenario 4: Cancel mode discards changes', async ({ page }) => {
    // Enter availability mode
    await page.click('button:has-text("Mark Free Time")')
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    
    // Add 2 slots
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="10"]')
    await page.waitForTimeout(300)
    await page.click('.calendar-grid .day-column:nth-child(1) .time-slot[data-hour="14"]')
    await page.waitForTimeout(300)
    
    // Verify changes summary shows 2 slots
    await expect(page.locator('.changes-summary')).toContainText('2')
    
    // Click cancel
    await page.click('button:has-text("Cancel")')
    
    // Verify toolbar is hidden
    await expect(page.locator('.availability-toolbar')).not.toBeVisible()
    
    // Verify no new slots were added (calendar unchanged)
    // Re-enter mode to check
    await page.click('button:has-text("Mark Free Time")')
    await expect(page.locator('.availability-toolbar')).toBeVisible()
    
    // Should start with empty draft
    const summaryVisible = await page.locator('.changes-summary').isVisible()
    expect(summaryVisible).toBe(false)
  })
})
