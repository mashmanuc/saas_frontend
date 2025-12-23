import { test, expect } from '@playwright/test'

test.describe('Error Recovery (v0.46.2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/booking/tutor')
  })

  test('should show error state and retry button on network failure', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/v1/calendar/week*', route => route.abort())
    
    // Reload page to trigger error
    await page.reload()
    
    // Error state should appear
    await expect(page.locator('.error-state')).toBeVisible()
    await expect(page.locator('.error-title')).toContainText('Помилка мережі')
    
    // Retry button should be visible
    const retryButton = page.locator('button:has-text("Повторити")')
    await expect(retryButton).toBeVisible()
  })

  test('should recover from error after retry', async ({ page }) => {
    let requestCount = 0
    
    // Fail first request, succeed on retry
    await page.route('**/api/v1/calendar/week*', route => {
      requestCount++
      if (requestCount === 1) {
        route.abort()
      } else {
        route.continue()
      }
    })
    
    // Reload to trigger error
    await page.reload()
    
    // Wait for error state
    await expect(page.locator('.error-state')).toBeVisible()
    
    // Click retry
    await page.locator('button:has-text("Повторити")').click()
    
    // Calendar should load successfully
    await expect(page.locator('.calendar-cell-grid')).toBeVisible()
    await expect(page.locator('.error-state')).not.toBeVisible()
  })

  test('should show loading skeleton during initial load', async ({ page }) => {
    // Slow down API response
    await page.route('**/api/v1/calendar/week*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })
    
    // Reload page
    await page.reload()
    
    // Skeleton should appear
    await expect(page.locator('.calendar-skeleton')).toBeVisible()
    
    // Wait for calendar to load
    await expect(page.locator('.calendar-cell-grid')).toBeVisible({ timeout: 5000 })
    
    // Skeleton should disappear
    await expect(page.locator('.calendar-skeleton')).not.toBeVisible()
  })

  test('should handle overlap conflict with clear message', async ({ page }) => {
    // Mock overlap error
    await page.route('**/api/v1/bookings/manual', route => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'tutor_overlap',
          message: 'Ви вже маєте урок у цей час',
        }),
      })
    })
    
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    
    // Click "Book Lesson"
    await page.getByText('Забронювати урок').click()
    
    // Fill form
    const studentInput = page.locator('input[placeholder*="учн"]')
    await studentInput.fill('Test Student')
    await page.waitForTimeout(300)
    
    // Submit
    await page.locator('button[type="submit"]').click()
    
    // Error message should appear
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText('вже маєте урок')
  })

  test('should show validation errors inline', async ({ page }) => {
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    
    // Click "Book Lesson"
    await page.getByText('Забронювати урок').click()
    
    // Try to submit without selecting student
    const submitButton = page.locator('button[type="submit"]')
    
    // Button should be disabled
    await expect(submitButton).toBeDisabled()
  })

  test('should display toast notification on success', async ({ page }) => {
    // Mock successful booking
    await page.route('**/api/v1/bookings/manual', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          student: { id: 45, name: 'Test Student' },
          start: '2025-12-23T10:00:00Z',
          end: '2025-12-23T11:00:00Z',
        }),
      })
    })
    
    // Click available cell
    await page.locator('.calendar-cell.cell-available').first().click()
    
    // Click "Book Lesson"
    await page.getByText('Забронювати урок').click()
    
    // Fill form (assuming autocomplete works)
    const studentInput = page.locator('input[placeholder*="учн"]')
    await studentInput.fill('Test')
    await page.waitForTimeout(300)
    
    // Submit
    await page.locator('button[type="submit"]').click()
    
    // Success toast should appear
    await expect(page.locator('.toast.toast-success')).toBeVisible({ timeout: 3000 })
  })

  test('should handle server error gracefully', async ({ page }) => {
    // Mock server error
    await page.route('**/api/v1/calendar/week*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'internal_error',
          detail: 'Server error',
        }),
      })
    })
    
    // Reload page
    await page.reload()
    
    // Error state should appear
    await expect(page.locator('.error-state')).toBeVisible()
  })

  test('should maintain draft patches after error', async ({ page }) => {
    // Add draft patch
    await page.locator('.calendar-cell.cell-available').first().click()
    await page.getByText('Заблокувати час').click()
    
    // Draft toolbar should appear
    await expect(page.locator('.draft-toolbar')).toBeVisible()
    
    // Simulate error on apply
    await page.route('**/api/v1/availability/bulk', route => route.abort())
    
    // Try to apply
    await page.locator('.draft-toolbar button:has-text("Застосувати")').click()
    
    // Error should be shown but draft should remain
    await expect(page.locator('.draft-toolbar')).toBeVisible()
  })
})
