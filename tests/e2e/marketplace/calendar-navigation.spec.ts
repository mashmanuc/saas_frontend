import { test, expect } from '@playwright/test'

test.describe('Marketplace Calendar Navigation - FE-1 & FE-2', () => {
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
          headline: 'Test Tutor',
          bio: 'Test bio',
          has_availability: true,
          subjects: [],
          education: [],
          reviews: []
        })
      })
    })
  })

  test('FE-1: Past navigation is disabled at current week', async ({ page }) => {
    let requestCount = 0
    
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      requestCount++
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
              slots: [
                { slot_id: 'slot-1', start_at: `${weekStart}T10:00:00Z`, duration_min: 60, status: 'available' }
              ]
            }
          ]
        })
      })
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    
    // Previous button should be disabled at current week
    const prevButton = page.locator('.btn-icon').first()
    await expect(prevButton).toBeDisabled()
    
    // Click should not trigger API call
    await prevButton.click({ force: true })
    await page.waitForTimeout(500)
    
    expect(requestCount).toBe(1) // Only initial load
  })

  test('FE-1: Past navigation is clamped to current Monday', async ({ page }) => {
    const calls: string[] = []
    
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      const url = new URL(route.request().url())
      const weekStart = url.searchParams.get('start') || url.searchParams.get('week_start')
      calls.push(weekStart || 'unknown')
      
      const today = new Date()
      const monday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(today.getDate() - daysToMonday)
      
      const weekStartStr = monday.toISOString().split('T')[0]
      const weekEnd = new Date(monday)
      weekEnd.setDate(monday.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: weekStartStr,
          week_end: weekEndStr,
          horizon_weeks: 4,
          generated_at: new Date().toISOString(),
          cells: []
        })
      })
    })
    
    await page.goto('/marketplace/tutors/tutor-79')
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    
    // Navigate forward
    const nextButton = page.locator('.btn-icon').last()
    await nextButton.click()
    await page.waitForTimeout(500)
    
    // Try to navigate back twice (should clamp to current Monday)
    const prevButton = page.locator('.btn-icon').first()
    await prevButton.click()
    await page.waitForTimeout(500)
    await prevButton.click()
    await page.waitForTimeout(500)
    
    // Verify all weekStart params are >= current Monday
    const today = new Date()
    const monday = new Date(today)
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    monday.setDate(today.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)
    
    calls.forEach(weekStart => {
      const requestedDate = new Date(weekStart)
      expect(requestedDate.getTime()).toBeGreaterThanOrEqual(monday.getTime())
    })
  })

  test('FE-2: Forward navigation is limited to 4 weeks (horizon)', async ({ page }) => {
    let requestCount = 0
    
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      requestCount++
      const today = new Date()
      const monday = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      monday.setDate(today.getDate() - daysToMonday)
      
      // Add weeks based on request count
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
    
    // At week 3 (4th week, offset 3), next button should be disabled
    await expect(nextButton).toBeDisabled()
    
    // Try to click (should not trigger API call)
    await nextButton.click({ force: true })
    await page.waitForTimeout(500)
    
    // Should be 4 calls total: initial + 3 successful navigations
    expect(requestCount).toBe(4)
  })

  test('FE-2: Previous button is enabled after forward navigation', async ({ page }) => {
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
    
    const prevButton = page.locator('.btn-icon').first()
    const nextButton = page.locator('.btn-icon').last()
    
    // Initially, previous should be disabled
    await expect(prevButton).toBeDisabled()
    
    // Navigate forward
    await nextButton.click()
    await page.waitForTimeout(500)
    
    // Now previous should be enabled
    await expect(prevButton).not.toBeDisabled()
    
    // Click previous should work
    await prevButton.click()
    await page.waitForTimeout(500)
    
    // Should be 3 calls: initial + forward + back
    expect(requestCount).toBe(3)
  })
})
