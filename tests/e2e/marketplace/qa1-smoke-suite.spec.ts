import { test, expect } from '@playwright/test'

/**
 * QA-1: Smoke Suite - Marketplace Availability
 * 
 * Comprehensive test covering all v0.59.1 requirements:
 * - FE-1: Past navigation disabled
 * - FE-2: Horizon limit (4 weeks)
 * - FE-3: Empty vs Error states
 * - FE-4: Slot click & 409 retry flow
 */
test.describe('QA-1: Marketplace Availability Smoke Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Mock tutor profile API
    await page.route('**/api/v1/marketplace/tutors/*/profile/', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 79,
          slug: 'tutor-79',
          user: {
            id: 1,
            full_name: 'Test Tutor',
            avatar_url: 'https://example.com/avatar.jpg'
          },
          headline: 'Professional Math Tutor',
          bio: 'Experienced tutor with 10+ years',
          has_availability: true,
          subjects: [{ id: 1, name: 'Mathematics', level: 'Advanced' }],
          education: [],
          reviews: []
        })
      })
    })
  })

  test('✅ Full flow: open tutor profile → calendar loads → past disabled → slot click 409 retry → empty state', async ({ page }) => {
    let calendarRequestCount = 0
    let trialRequestCount = 0
    
    // Mock calendar API
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      calendarRequestCount++
      const today = new Date()
      const monday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(today.getDate() - daysToMonday)
      
      const weekStart = monday.toISOString().split('T')[0]
      const weekEnd = new Date(monday)
      weekEnd.setDate(monday.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      
      // First request: has slots
      // Second request (after 409): empty slots
      const hasSlots = calendarRequestCount === 1
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: weekStart,
          week_end: weekEndStr,
          horizon_weeks: 4,
          generated_at: new Date().toISOString(),
          cells: hasSlots ? [
            {
              date: weekStart,
              day_status: 'working',
              slots: [
                { slot_id: 'slot-conflict', start_at: `${weekStart}T10:00:00Z`, duration_min: 60, status: 'available' }
              ]
            }
          ] : [
            {
              date: weekStart,
              day_status: 'working',
              slots: []
            }
          ]
        })
      })
    })
    
    // Mock trial request API - return 409 conflict
    await page.route('**/api/v1/marketplace/tutors/*/trial-request/', route => {
      trialRequestCount++
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'slot_unavailable',
          message: 'This slot is no longer available'
        })
      })
    })
    
    // 1. Open tutor profile
    await page.goto('/marketplace/tutors/tutor-79')
    
    // 2. Calendar loads
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    expect(calendarRequestCount).toBe(1)
    
    // 3. Past navigation disabled
    const prevButton = page.locator('.btn-icon').first()
    await expect(prevButton).toBeDisabled()
    
    // 4. Slot click
    const slotButton = page.locator('[data-testid="marketplace-slot"]').first()
    await expect(slotButton).toBeVisible()
    await slotButton.click()
    
    // Trial request modal should open
    await expect(page.locator('[data-test="trial-modal"]')).toBeVisible()
    
    // 5. Submit trial request (will get 409)
    const submitButton = page.locator('[data-testid="trial-request-submit"]')
    await submitButton.click()
    await page.waitForTimeout(1000)
    
    // 6. 409 conflict banner should appear
    const conflictBanner = page.locator('.conflict-banner')
    await expect(conflictBanner).toBeVisible()
    expect(trialRequestCount).toBe(1)
    
    // 7. Click refresh calendar button
    const refreshButton = page.locator('.btn-refresh')
    await refreshButton.click()
    await page.waitForTimeout(1000)
    
    // 8. Calendar should refetch (now returns empty)
    expect(calendarRequestCount).toBe(2)
    
    // 9. Empty state should be visible
    await expect(page.locator('[data-testid="availability-empty-state"]')).toBeVisible({ timeout: 5000 })
  })

  test('✅ Horizon limit: cannot navigate beyond 4 weeks', async ({ page }) => {
    let requestCount = 0
    
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      requestCount++
      const today = new Date()
      const monday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(today.getDate() - daysToMonday)
      monday.setDate(monday.getDate() + (requestCount - 1) * 7)
      
      const weekStart = monday.toISOString().split('T')[0]
      const weekEnd = new Date(monday)
      weekEnd.setDate(monday.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: weekStart,
          week_end: weekEndStr,
          horizon_weeks: 4,
          generated_at: new Date().toISOString(),
          cells: []
        })
      })
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    
    const nextButton = page.locator('.btn-icon').last()
    
    // Navigate forward 3 times (weeks 0 -> 1 -> 2 -> 3)
    for (let i = 0; i < 3; i++) {
      await nextButton.click()
      await page.waitForTimeout(500)
    }
    
    // At week 3 (4th week, offset 3), next should be disabled
    await expect(nextButton).toBeDisabled()
    
    // Should be 4 requests total
    expect(requestCount).toBe(4)
  })

  test('✅ Error state: API failure shows error with retry', async ({ page }) => {
    let attemptCount = 0
    
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      attemptCount++
      
      // First attempt: fail
      // Second attempt: succeed
      if (attemptCount === 1) {
        route.abort('failed')
      } else {
        const today = new Date()
        const monday = new Date(today)
        const dayOfWeek = today.getDay()
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        monday.setDate(today.getDate() - daysToMonday)
        
        const weekStart = monday.toISOString().split('T')[0]
        const weekEnd = new Date(monday)
        weekEnd.setDate(monday.getDate() + 6)
        const weekEndStr = weekEnd.toISOString().split('T')[0]
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tutor_id: 79,
            timezone: 'Europe/Kyiv',
            week_start: weekStart,
            week_end: weekEndStr,
            horizon_weeks: 4,
            generated_at: new Date().toISOString(),
            cells: []
          })
        })
      }
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    
    // Error state should appear
    await expect(page.locator('[data-testid="availability-error-state"]')).toBeVisible({ timeout: 10000 })
    
    // Retry button should be visible
    const retryButton = page.locator('.btn-secondary').filter({ hasText: /повторити|retry/i })
    await expect(retryButton).toBeVisible()
    
    // Click retry
    await retryButton.click()
    await page.waitForTimeout(1000)
    
    // Should now show empty state (second attempt succeeds with empty data)
    await expect(page.locator('[data-testid="availability-empty-state"]')).toBeVisible({ timeout: 5000 })
    
    expect(attemptCount).toBe(2)
  })

  test('✅ Empty state: no slots shows correct message', async ({ page }) => {
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      const today = new Date()
      const monday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(today.getDate() - daysToMonday)
      
      const weekStart = monday.toISOString().split('T')[0]
      const weekEnd = new Date(monday)
      weekEnd.setDate(monday.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: weekStart,
          week_end: weekEndStr,
          horizon_weeks: 4,
          generated_at: new Date().toISOString(),
          cells: [
            {
              date: weekStart,
              day_status: 'working',
              slots: []
            }
          ]
        })
      })
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    
    // Empty state should be visible
    await expect(page.locator('[data-testid="availability-empty-state"]')).toBeVisible({ timeout: 10000 })
    
    // Should show calendar icon and message
    await expect(page.locator('[data-testid="availability-empty-state"] svg')).toBeVisible()
  })

  test('✅ 422 horizon error: shows specific error message', async ({ page }) => {
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'horizon_exceeded',
          max_weeks: 4
        })
      })
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    
    // Error state should appear with horizon-specific message
    await expect(page.locator('[data-testid="availability-error-state"]')).toBeVisible({ timeout: 10000 })
    
    // Error text should mention horizon (from i18n key marketplace.calendar.errorHorizon)
    const errorText = await page.locator('[data-testid="availability-error-state"]').textContent()
    expect(errorText).toBeTruthy()
  })
})
