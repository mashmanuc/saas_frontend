import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Create Lesson Modal v0.55.6
 * F13: Complete flow testing
 */

test.describe('Create Lesson Modal - Basic Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Navigate to calendar
    await page.waitForURL('/calendar')
    await expect(page.locator('.calendar-week-view')).toBeVisible()
  })

  test('should create lesson successfully', async ({ page }) => {
    // Step 1: Click on available slot
    const availableSlot = page.locator('.calendar-cell[data-status="available"]').first()
    await availableSlot.click()

    // Step 2: Modal should open
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('#modal-title')).toContainText('Створити урок')

    // Step 3: Search and select student
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    
    // Wait for dropdown
    await expect(page.locator('.dropdown-list')).toBeVisible()
    
    // Select first student
    await page.locator('.dropdown-item').first().click()
    
    // Verify balance badge is shown
    await expect(page.locator('.balance-badge')).toBeVisible()

    // Step 4: Select duration
    await page.locator('button:has-text("60")').click()

    // Step 5: Select regularity
    await page.selectOption('#regularity', 'single')

    // Step 6: Add tutor comment
    await page.fill('#tutor-comment', 'Test lesson')

    // Step 7: Submit form
    await page.click('button[type="submit"]')

    // Step 8: Verify optimistic event appears immediately
    await expect(page.locator('.calendar-event').last()).toBeVisible({ timeout: 1000 })

    // Step 9: Wait for real event to replace optimistic
    await page.waitForResponse(response => 
      response.url().includes('/calendar/event/create') && response.status() === 201
    )

    // Step 10: Verify modal closed
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    // Step 11: Verify event is in calendar
    await expect(page.locator('.calendar-event')).toContainText('Іван')
  })

  test('should validate required fields', async ({ page }) => {
    // Open modal
    await page.locator('.calendar-cell[data-status="available"]').first().click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Try to submit without selecting student
    await page.click('button[type="submit"]')

    // Verify form is not submitted (modal still visible)
    await expect(page.locator('.modal-overlay')).toBeVisible()
    
    // Verify submit button is disabled
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()
  })

  test('should filter students by search query', async ({ page }) => {
    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Марія')
    
    await expect(page.locator('.dropdown-list')).toBeVisible()
    
    // Should show only matching students
    const items = page.locator('.dropdown-item')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Марія')
  })
})

test.describe('Create Lesson Modal - Conflict Warning Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/calendar')
  })

  test('should show conflict warning and allow force create', async ({ page }) => {
    // Mock conflict check response
    await page.route('**/booking/slots/check-conflicts/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          has_conflicts: true,
          conflicts: [
            {
              event_id: 100,
              student_name: 'Петро Іванов',
              start: '2025-01-08T14:00:00+02:00',
              end: '2025-01-08T15:00:00+02:00',
              reason: 'Час перетинається з іншим уроком',
            },
          ],
        }),
      })
    })

    // Open modal and fill form
    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    
    await page.locator('button:has-text("60")').click()

    // Submit - should trigger conflict check
    await page.click('button[type="submit"]')

    // Wait for conflict warning
    await expect(page.locator('.conflict-warning')).toBeVisible()
    await expect(page.locator('.conflict-warning')).toContainText('Петро Іванов')
    await expect(page.locator('.conflict-warning')).toContainText('Час перетинається')

    // Verify two buttons: Cancel and Create Anyway
    await expect(page.locator('.conflict-actions button')).toHaveCount(2)

    // Click "Create Anyway"
    await page.locator('button:has-text("Створити все одно")').click()

    // Should proceed with creation
    await page.waitForResponse(response => 
      response.url().includes('/calendar/event/create')
    )

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('should cancel on conflict warning', async ({ page }) => {
    await page.route('**/booking/slots/check-conflicts/', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          has_conflicts: true,
          conflicts: [
            {
              event_id: 100,
              student_name: 'Test Student',
              start: '2025-01-08T14:00:00+02:00',
              end: '2025-01-08T15:00:00+02:00',
              reason: 'Conflict',
            },
          ],
        }),
      })
    })

    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    await page.locator('button:has-text("60")').click()
    await page.click('button[type="submit"]')

    await expect(page.locator('.conflict-warning')).toBeVisible()

    // Click Cancel
    await page.locator('.conflict-actions button:has-text("Скасувати")').click()

    // Warning should disappear
    await expect(page.locator('.conflict-warning')).not.toBeVisible()

    // Modal should still be open
    await expect(page.locator('.modal-overlay')).toBeVisible()
  })
})

test.describe('Create Lesson Modal - Error Handling Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/calendar')
  })

  test('should show inline error for INVALID_DURATION', async ({ page }) => {
    // Mock API error response
    await page.route('**/calendar/event/create', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_DURATION',
          message: 'Invalid duration for this order',
        }),
      })
    })

    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    await page.locator('button:has-text("60")').click()
    await page.click('button[type="submit"]')

    // Wait for error response
    await page.waitForResponse(response => 
      response.url().includes('/calendar/event/create') && response.status() === 400
    )

    // Should show inline error under duration field
    await expect(page.locator('.field-error')).toBeVisible()
    await expect(page.locator('.field-error')).toContainText('тривалість')

    // Modal should still be open
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Optimistic event should be removed
    await expect(page.locator('.calendar-event[data-optimistic="true"]')).not.toBeVisible()
  })

  test('should show inline error for PAST_TIME', async ({ page }) => {
    await page.route('**/calendar/event/create', async route => {
      await route.fulfill({
        status: 400,
        body: JSON.stringify({
          code: 'PAST_TIME',
        }),
      })
    })

    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    await page.locator('button:has-text("60")').click()
    await page.click('button[type="submit"]')

    await page.waitForResponse(response => 
      response.url().includes('/calendar/event/create') && response.status() === 400
    )

    // Should show inline error under time field
    const startError = page.locator('.field-error').filter({ hasText: 'час' })
    await expect(startError).toBeVisible()
  })

  test('should show toast for TIME_OVERLAP error', async ({ page }) => {
    await page.route('**/calendar/event/create', async route => {
      await route.fulfill({
        status: 409,
        body: JSON.stringify({
          code: 'TIME_OVERLAP',
        }),
      })
    })

    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    await page.locator('button:has-text("60")').click()
    await page.click('button[type="submit"]')

    await page.waitForResponse(response => 
      response.url().includes('/calendar/event/create') && response.status() === 409
    )

    // Should show toast notification
    await expect(page.locator('.toast-error')).toBeVisible()
    await expect(page.locator('.toast-error')).toContainText('перетинається')
  })

  test('should handle network error gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/calendar/event/create', route => route.abort())

    await page.locator('.calendar-cell[data-status="available"]').first().click()
    
    const searchInput = page.locator('#student-search')
    await searchInput.fill('Іван')
    await page.locator('.dropdown-item').first().click()
    await page.locator('button:has-text("60")').click()
    await page.click('button[type="submit"]')

    // Should show error toast
    await expect(page.locator('.toast-error')).toBeVisible()

    // Optimistic event should be removed
    await expect(page.locator('.calendar-event[data-optimistic="true"]')).not.toBeVisible()

    // Modal should still be open for retry
    await expect(page.locator('.modal-overlay')).toBeVisible()
  })
})

test.describe('Create Lesson Modal - Lesson Type Field', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/calendar')
  })

  test('should show lesson type dropdown when available', async ({ page }) => {
    await page.locator('.calendar-cell[data-status="available"]').first().click()

    // Check if lesson type field is visible
    const lessonTypeField = page.locator('#lesson-type')
    
    if (await lessonTypeField.isVisible()) {
      // Verify options are available
      await expect(lessonTypeField).toBeVisible()
      
      // Select a lesson type
      await lessonTypeField.selectOption({ index: 1 })
      
      // Verify selection
      const selectedValue = await lessonTypeField.inputValue()
      expect(selectedValue).not.toBe('')
    }
  })
})

test.describe('Create Lesson Modal - Student Comment Field', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'tutor@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/calendar')
  })

  test('should allow entering student comment', async ({ page }) => {
    await page.locator('.calendar-cell[data-status="available"]').first().click()

    const studentCommentField = page.locator('#student-comment')
    await expect(studentCommentField).toBeVisible()

    const testComment = 'Підготувати матеріали до уроку'
    await studentCommentField.fill(testComment)

    const value = await studentCommentField.inputValue()
    expect(value).toBe(testComment)
  })
})
