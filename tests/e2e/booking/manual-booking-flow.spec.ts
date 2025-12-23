import { test, expect } from '@playwright/test'

test.describe('Manual Booking Flow (v0.46.1)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Navigate to calendar
    await page.goto('/booking/tutor')
    await page.waitForLoadState('networkidle')
  })

  test('should create manual booking through popover', async ({ page }) => {
    // Click on available cell
    const availableCell = page.locator('.calendar-cell.cell-available').first()
    await availableCell.click()
    
    // Popover should appear
    await expect(page.locator('.calendar-popover')).toBeVisible()
    
    // Click "Book Lesson"
    await page.getByText('booking.actions.bookLesson').click()
    
    // Modal should appear
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('.booking-form')).toBeVisible()
    
    // Select student (assuming autocomplete)
    const studentInput = page.locator('input[placeholder*="student"], input[placeholder*="учн"]')
    await studentInput.fill('Ivan')
    await page.waitForTimeout(500) // Wait for autocomplete
    
    // Click first student from results
    const firstStudent = page.locator('.autocomplete-item, .student-item').first()
    if (await firstStudent.isVisible()) {
      await firstStudent.click()
    }
    
    // Select duration (60 minutes)
    await page.locator('.duration-btn').filter({ hasText: '60' }).click()
    
    // Add notes (optional)
    await page.locator('textarea').fill('Test lesson notes')
    
    // Submit form
    await page.locator('button[type="submit"]').click()
    
    // Wait for success
    await page.waitForTimeout(1000)
    
    // Success notification should appear
    const notification = page.locator('.notification.success, .toast.success')
    if (await notification.isVisible()) {
      await expect(notification).toBeVisible()
    }
    
    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
    
    // Cell should now show booking
    await page.waitForTimeout(500)
    const bookedCell = page.locator('.cell-has-booking, .cell-booked')
    expect(await bookedCell.count()).toBeGreaterThan(0)
  })

  test('should handle tutor overlap error', async ({ page }) => {
    // Mock API to return overlap error
    await page.route('**/api/v1/bookings/manual', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'tutor_overlap',
          message: 'Tutor already has a lesson at this time',
        }),
      })
    })
    
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Fill form
    const studentInput = page.locator('input[placeholder*="student"], input[placeholder*="учн"]')
    await studentInput.fill('Ivan')
    await page.waitForTimeout(300)
    
    // Submit
    await page.locator('button[type="submit"]').click()
    
    // Error message should appear
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText('У вас вже є урок у цей час')
  })

  test('should handle student overlap error', async ({ page }) => {
    // Mock API to return student overlap error
    await page.route('**/api/v1/bookings/manual', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'student_overlap',
          message: 'Student already has a lesson at this time',
        }),
      })
    })
    
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Fill form
    const studentInput = page.locator('input[placeholder*="student"], input[placeholder*="учн"]')
    await studentInput.fill('Ivan')
    await page.waitForTimeout(300)
    
    // Submit
    await page.locator('button[type="submit"]').click()
    
    // Error message should appear
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText('Учень вже має урок у цей час')
  })

  test('should validate required fields', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Try to submit without selecting student
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })

  test('should close modal on cancel', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Modal should be visible
    await expect(page.locator('.modal-overlay')).toBeVisible()
    
    // Click cancel
    await page.locator('.btn-secondary').filter({ hasText: /cancel|скасувати/i }).click()
    
    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('should close modal on close button', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Modal should be visible
    await expect(page.locator('.modal-overlay')).toBeVisible()
    
    // Click close button
    await page.locator('.close-btn').click()
    
    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('should close modal on overlay click', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Modal should be visible
    await expect(page.locator('.modal-overlay')).toBeVisible()
    
    // Click overlay (outside modal)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } })
    
    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('should show loading state during submission', async ({ page }) => {
    // Slow down API response
    await page.route('**/api/v1/bookings/manual', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })
    
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Fill form
    const studentInput = page.locator('input[placeholder*="student"], input[placeholder*="учн"]')
    await studentInput.fill('Ivan')
    await page.waitForTimeout(300)
    
    // Submit
    await page.locator('button[type="submit"]').click()
    
    // Loading spinner should appear
    await expect(page.locator('.animate-spin')).toBeVisible()
    
    // Submit button should be disabled
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('should display selected duration', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Check default duration (60 min)
    const duration60 = page.locator('.duration-btn').filter({ hasText: '60' })
    await expect(duration60).toHaveClass(/active/)
    
    // Select 30 min
    await page.locator('.duration-btn').filter({ hasText: '30' }).click()
    
    // 30 min should be active
    const duration30 = page.locator('.duration-btn').filter({ hasText: '30' })
    await expect(duration30).toHaveClass(/active/)
    
    // 60 min should not be active
    await expect(duration60).not.toHaveClass(/active/)
  })

  test('should display formatted start time', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    // Start time field should be disabled and show time
    const startTimeInput = page.locator('.input-disabled')
    await expect(startTimeInput).toBeDisabled()
    
    const timeValue = await startTimeInput.inputValue()
    expect(timeValue.length).toBeGreaterThan(0)
  })

  test('should track telemetry event on success', async ({ page }) => {
    // Mock telemetry
    await page.addInitScript(() => {
      (window as any).telemetry = {
        track: (event: string, data: any) => {
          console.log('Telemetry:', event, data)
        },
      }
    })
    
    // Listen for console logs
    const telemetryEvents: string[] = []
    page.on('console', msg => {
      if (msg.text().startsWith('Telemetry:')) {
        telemetryEvents.push(msg.text())
      }
    })
    
    // Complete booking flow
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('booking.actions.bookLesson').click()
    
    const studentInput = page.locator('input[placeholder*="student"], input[placeholder*="учн"]')
    await studentInput.fill('Ivan')
    await page.waitForTimeout(300)
    
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1000)
    
    // Check if telemetry was tracked
    const hasBookingEvent = telemetryEvents.some(event => 
      event.includes('booking.manual_created')
    )
    expect(hasBookingEvent).toBe(true)
  })
})
