import { test, expect } from '../fixtures/auth.fixture'
import { generateSlot } from '../utils/slotGenerator'
import { mockSlotApi } from '../mocks/slotApi'

test.describe('Slot Editor Batch Operations', () => {
  test.beforeEach(async ({ page, auth }) => {
    await auth.loginAsTutor()
    await page.goto('/tutor/calendar')
  })

  test('should allow batch editing multiple slots', async ({ page }) => {
    // Mock multiple slots
    const slots = [
      generateSlot({ id: 'slot-1', date: '2024-12-25', start: '09:00', end: '10:00' }),
      generateSlot({ id: 'slot-2', date: '2024-12-26', start: '09:00', end: '10:00' }),
      generateSlot({ id: 'slot-3', date: '2024-12-27', start: '09:00', end: '10:00' })
    ]

    await mockSlotApi(page, {
      getSlots: slots,
      batchEditSlots: {
        success_count: 3,
        error_count: 0,
        results: slots.map(s => ({ ...s, start: '10:00', end: '11:00' }))
      }
    })

    // Select multiple slots
    for (const slot of slots) {
      await page.check(`[data-testid="select-slot-${slot.id}"]`)
    }

    // Click batch edit button
    await page.click('[data-testid="batch-edit-button"]')

    // Verify batch edit modal opens
    await expect(page.locator('[data-testid="batch-edit-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="selected-slots-count"]')).toContainText('3 slots selected')

    // Change time for all selected slots
    await page.selectOption('[data-testid="batch-time-start"]', '10:00')
    await page.selectOption('[data-testid="batch-time-end"]', '11:00')

    // Save batch changes
    await page.click('[data-testid="batch-save"]')

    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('All slots updated successfully')
  })

  test('should handle partial batch success', async ({ page }) => {
    const slots = [
      generateSlot({ id: 'slot-4', date: '2024-12-28', start: '14:00', end: '15:00' }),
      generateSlot({ id: 'slot-5', date: '2024-12-29', start: '14:00', end: '15:00' })
    ]

    await mockSlotApi(page, {
      getSlots: slots,
      batchEditSlots: {
        success_count: 1,
        error_count: 1,
        results: [
          { success: true, slot: { ...slots[0], start: '15:00', end: '16:00' } },
          { success: false, slot: slots[1], error: 'Conflict detected' }
        ]
      }
    })

    // Select slots and start batch edit
    for (const slot of slots) {
      await page.check(`[data-testid="select-slot-${slot.id}"]`)
    }
    await page.click('[data-testid="batch-edit-button"]')

    // Change time and save
    await page.selectOption('[data-testid="batch-time-start"]', '15:00')
    await page.selectOption('[data-testid="batch-time-end"]', '16:00')
    await page.click('[data-testid="batch-save"]')

    // Verify partial success message
    await expect(page.locator('[data-testid="toast-warning"]')).toContainText('Updated 1 of 2 slots')
    
    // Verify error details
    await expect(page.locator('[data-testid="batch-error-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="batch-error-details"]')).toContainText('Conflict detected')
  })

  test('should show conflicts during batch edit', async ({ page }) => {
    const slots = [
      generateSlot({ id: 'slot-6', date: '2024-12-30', start: '10:00', end: '11:00' }),
      generateSlot({ id: 'slot-7', date: '2024-12-31', start: '10:00', end: '11:00' })
    ]

    const conflicts = [
      {
        type: 'booked_overlap',
        severity: 'error',
        message: 'Conflicts with existing booking',
        slotId: 'slot-6'
      }
    ]

    await mockSlotApi(page, {
      getSlots: slots,
      checkBatchConflicts: { has_conflicts: true, conflicts }
    })

    // Select slots and start batch edit
    for (const slot of slots) {
      await page.check(`[data-testid="select-slot-${slot.id}"]`)
    }
    await page.click('[data-testid="batch-edit-button"]')

    // Try to change to conflicting time
    await page.selectOption('[data-testid="batch-time-start"]', '09:30')
    await page.selectOption('[data-testid="batch-time-end"]', '10:30')

    // Verify conflict warning
    await expect(page.locator('[data-testid="batch-conflict-warning"]')).toBeVisible()
    await expect(page.locator('[data-testid="conflicting-slots-list"]')).toContainText('slot-6')
    
    // Verify save is disabled
    await expect(page.locator('[data-testid="batch-save"]')).toBeDisabled()
  })
})

test.describe('Slot Editor Accessibility', () => {
  test.beforeEach(async ({ page, auth }) => {
    await auth.loginAsTutor()
    await page.goto('/tutor/calendar')
  })

  test('should be keyboard navigable', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-a11y',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: { ...mockSlot, start: '10:00', end: '11:00' }
    })

    // Navigate to slot using keyboard
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter') // Open slot editor

    // Verify editor is focused
    await expect(page.locator('[data-testid="slot-editor"]')).toBeVisible()
    await expect(page.locator('[data-testid="time-start"]')).toBeFocused()

    // Navigate time inputs
    await page.keyboard.press('Tab') // End time
    await expect(page.locator('[data-testid="time-end"]')).toBeFocused()
    
    await page.keyboard.press('Tab') // Save button
    await expect(page.locator('[data-testid="save-slot"]')).toBeFocused()

    // Save with keyboard
    await page.keyboard.press('Enter')

    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-aria',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] }
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Verify ARIA labels
    await expect(page.locator('[data-testid="time-start"]')).toHaveAttribute('aria-label', 'Start time')
    await expect(page.locator('[data-testid="time-end"]')).toHaveAttribute('aria-label', 'End time')
    await expect(page.locator('[data-testid="save-slot"]')).toHaveAttribute('aria-label', 'Save slot changes')
    await expect(page.locator('[data-testid="cancel-edit"]')).toHaveAttribute('aria-label', 'Cancel editing')
  })

  test('should announce changes to screen readers', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-sr',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: { ...mockSlot, start: '10:00', end: '11:00' }
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Change time
    await page.selectOption('[data-testid="time-start"]', '10:00')

    // Verify live region announces change
    await expect(page.locator('[data-testid="sr-announcements"]')).toContainText('Start time changed to 10:00')
    
    // Save and verify success announcement
    await page.click('[data-testid="save-slot"]')
    await expect(page.locator('[data-testid="sr-announcements"]')).toContainText('Slot saved successfully')
  })
})

test.describe('Slot Editor Error Handling', () => {
  test.beforeEach(async ({ page, auth }) => {
    await auth.loginAsTutor()
    await page.goto('/tutor/calendar')
  })

  test('should handle network errors gracefully', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-error',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    // Mock network error
    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: Promise.reject({ status: 0, message: 'Network Error' })
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Try to save
    await page.selectOption('[data-testid="time-start"]', '08:00')
    await page.click('[data-testid="save-slot"]')

    // Verify error handling
    await expect(page.locator('[data-testid="toast-error"]')).toContainText('Failed to save slot')
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    
    // Verify retry works
    await mockSlotApi(page, {
      editSlot: { ...mockSlot, start: '08:00', end: '09:00' }
    })
    
    await page.click('[data-testid="retry-button"]')
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Slot saved successfully')
  })

  test('should handle timeout errors', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-timeout',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    // Mock timeout
    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: Promise.reject({ status: 408, message: 'Request timeout' })
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Try to save
    await page.selectOption('[data-testid="time-start"]', '08:00')
    await page.click('[data-testid="save-slot"]')

    // Verify timeout message
    await expect(page.locator('[data-testid="toast-error"]')).toContainText('Request timed out')
    await expect(page.locator('[data-testid="timeout-message"]')).toContainText('Please try again')
  })

  test('should validate slot data before sending', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-validate',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] }
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Try invalid time range
    await page.selectOption('[data-testid="time-start"]', '23:00')
    await page.selectOption('[data-testid="time-end"]', '01:00')

    // Verify client-side validation
    await expect(page.locator('[data-testid="time-error"]')).toContainText('End time cannot be before start time')
    await expect(page.locator('[data-testid="save-slot"]')).toBeDisabled()
    
    // Verify no API call is made
    const apiCalls = await page.evaluate(() => window.__apiCalls || [])
    expect(apiCalls.filter(call => call.url.includes('/edit/'))).toHaveLength(0)
  })
})
