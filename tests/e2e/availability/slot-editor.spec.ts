import { test, expect } from '../fixtures/auth.fixture'
import { generateSlot } from '../utils/slotGenerator'
import { mockSlotApi } from '../mocks/slotApi'

test.describe('Slot Editor v2.0', () => {
  test.beforeEach(async ({ page, auth }) => {
    await auth.loginAsTutor()
    await page.goto('/tutor/calendar')
  })

  test('should open slot editor when clicking on available slot', async ({ page }) => {
    // Mock slot data
    const mockSlot = generateSlot({
      id: 'slot-123',
      date: '2024-12-25',
      start: '09:00',
      end: '10:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] }
    })

    // Navigate to calendar week view
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()
    
    // Find and click on available slot
    const slotElement = page.locator(`[data-testid="slot-${mockSlot.id}"]`)
    await expect(slotElement).toBeVisible()
    await slotElement.click()

    // Verify slot editor opens
    await expect(page.locator('[data-testid="slot-editor"]')).toBeVisible()
    await expect(page.locator('h3')).toContainText('Edit slot')
    
    // Verify slot info is displayed
    await expect(page.locator('[data-testid="slot-date"]')).toContainText('December 25, 2024')
    await expect(page.locator('[data-testid="slot-status"]')).toContainText('Available')
  })

  test('should allow editing time range', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-456',
      date: '2024-12-26',
      start: '14:00',
      end: '15:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: { ...mockSlot, start: '15:00', end: '16:00' }
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()
    await expect(page.locator('[data-testid="slot-editor"]')).toBeVisible()

    // Change start time
    await page.selectOption('[data-testid="time-start"]', '15:00')
    
    // Change end time
    await page.selectOption('[data-testid="time-end"]', '16:00')

    // Verify save button is enabled
    const saveButton = page.locator('[data-testid="save-slot"]')
    await expect(saveButton).toBeEnabled()

    // Save changes
    await saveButton.click()

    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Slot saved successfully')
    
    // Verify slot is updated
    await expect(page.locator(`[data-testid="slot-${mockSlot.id}"]`)).toContainText('15:00 - 16:00')
  })

  test('should show conflicts when editing overlapping time', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-789',
      date: '2024-12-27',
      start: '10:00',
      end: '11:00',
      status: 'available'
    })

    const conflicts = [
      {
        type: 'booked_overlap',
        severity: 'error',
        message: 'This time conflicts with a booked lesson',
        lessonId: 'lesson-123',
        studentName: 'John Doe'
      }
    ]

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: true, conflicts }
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Try to change to conflicting time
    await page.selectOption('[data-testid="time-start"]', '09:30')
    await page.selectOption('[data-testid="time-end"]', '10:30')

    // Verify conflict warning appears
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible()
    await expect(page.locator('[data-testid="conflict-title"]')).toContainText('Time conflicts')
    await expect(page.locator('[data-testid="conflict-message"]')).toContainText('conflicts with a booked lesson')
    await expect(page.locator('[data-testid="conflict-student"]')).toContainText('John Doe')
    await expect(page.locator('[data-testid="conflict-lesson"]')).toContainText('#lesson-123')

    // Verify save button is disabled due to conflicts
    const saveButton = page.locator('[data-testid="save-slot"]')
    await expect(saveButton).toBeDisabled()

    // Verify resolve anyway option
    await expect(page.locator('[data-testid="resolve-conflicts"]')).toBeVisible()
  })

  test('should show edit strategy options when conflicts exist', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-101',
      date: '2024-12-28',
      start: '13:00',
      end: '14:00',
      status: 'available'
    })

    const conflicts = [
      {
        type: 'template_overlap',
        severity: 'warning',
        message: 'This conflicts with your weekly template'
      }
    ]

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: true, conflicts }
    })

    // Open slot editor and create conflict
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()
    await page.selectOption('[data-testid="time-start"]', '12:00')

    // Verify strategy options appear
    await expect(page.locator('[data-testid="edit-strategy"]')).toBeVisible()
    
    // Verify all strategy options
    await expect(page.locator('[data-testid="strategy-override"]')).toBeVisible()
    await expect(page.locator('[data-testid="strategy-template-update"]')).toBeVisible()
    await expect(page.locator('[data-testid="strategy-user-choice"]')).toBeVisible()

    // Verify strategy descriptions
    await expect(page.locator('[data-testid="override-description"]')).toContainText('Change this slot despite conflicts')
    await expect(page.locator('[data-testid="template-update-description"]')).toContainText('Change availability template')
    await expect(page.locator('[data-testid="user-choice-description"]')).toContainText('Ask how to resolve conflicts')
  })

  test('should show override reason field when override strategy is selected', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-202',
      date: '2024-12-29',
      start: '16:00',
      end: '17:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: true, conflicts: [] }
    })

    // Open slot editor and create conflict
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()
    await page.selectOption('[data-testid="time-start"]', '15:00')

    // Select override strategy
    await page.check('[data-testid="strategy-override"]')

    // Verify override reason field appears
    await expect(page.locator('[data-testid="override-reason"]')).toBeVisible()
    await expect(page.locator('[data-testid="override-reason-textarea"]')).toBeVisible()
    await expect(page.locator('[data-testid="override-reason-textarea"]')).toHaveAttribute('placeholder', 'Enter reason for changing this slot...')
  })

  test('should allow resolving conflicts with override strategy', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-303',
      date: '2024-12-30',
      start: '11:00',
      end: '12:00',
      status: 'available'
    })

    const conflicts = [
      {
        type: 'slot_overlap',
        severity: 'error',
        message: 'Overlaps with another slot'
      }
    ]

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: true, conflicts },
      editSlot: { ...mockSlot, start: '10:00', end: '11:00' }
    })

    // Open slot editor and create conflict
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()
    await page.selectOption('[data-testid="time-start"]', '10:00')

    // Select override strategy
    await page.check('[data-testid="strategy-override"]')
    
    // Add override reason
    await page.fill('[data-testid="override-reason-textarea"]', 'Student requested earlier time')

    // Click resolve anyway
    await page.click('[data-testid="resolve-conflicts"]')

    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Slot saved successfully')
  })

  test('should cancel editing when cancel button is clicked', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-404',
      date: '2024-12-31',
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

    // Change time
    await page.selectOption('[data-testid="time-start"]', '08:00')

    // Click cancel
    await page.click('[data-testid="cancel-edit"]')

    // Verify editor closes
    await expect(page.locator('[data-testid="slot-editor"]')).not.toBeVisible()
    
    // Verify original time is restored
    await expect(page.locator(`[data-testid="slot-${mockSlot.id}"]`)).toContainText('09:00 - 10:00')
  })

  test('should show loading state during save', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-505',
      date: '2025-01-01',
      start: '14:00',
      end: '15:00',
      status: 'available'
    })

    // Mock slow API response
    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: new Promise(resolve => setTimeout(() => resolve({ ...mockSlot }), 2000))
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Change time and save
    await page.selectOption('[data-testid="time-start"]', '13:00')
    await page.click('[data-testid="save-slot"]')

    // Verify loading state
    await expect(page.locator('[data-testid="loading-overlay"]')).toBeVisible()
    await expect(page.locator('[data-testid="loading-text"]')).toContainText('Saving...')
    await expect(page.locator('[data-testid="save-slot"]')).toBeDisabled()
  })

  test('should handle save errors gracefully', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-606',
      date: '2025-01-02',
      start: '10:00',
      end: '11:00',
      status: 'available'
    })

    await mockSlotApi(page, {
      getSlot: mockSlot,
      checkConflicts: { has_conflicts: false, conflicts: [] },
      editSlot: Promise.reject(new Error('Network error'))
    })

    // Open slot editor
    await page.locator(`[data-testid="slot-${mockSlot.id}"]`).click()

    // Change time and save
    await page.selectOption('[data-testid="time-start"]', '09:00')
    await page.click('[data-testid="save-slot"]')

    // Verify error message
    await expect(page.locator('[data-testid="toast-error"]')).toContainText('Failed to save slot')
    
    // Verify editor stays open for retry
    await expect(page.locator('[data-testid="slot-editor"]')).toBeVisible()
  })

  test('should validate time range constraints', async ({ page }) => {
    const mockSlot = generateSlot({
      id: 'slot-707',
      date: '2025-01-03',
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

    // Try to set end time before start time
    await page.selectOption('[data-testid="time-start"]', '11:00')
    await page.selectOption('[data-testid="time-end"]', '10:00')

    // Verify validation error
    await expect(page.locator('[data-testid="time-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="time-error"]')).toContainText('End time cannot be before start time')
    
    // Verify save button is disabled
    await expect(page.locator('[data-testid="save-slot"]')).toBeDisabled()
  })
})
