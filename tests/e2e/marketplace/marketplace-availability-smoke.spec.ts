import { test, expect } from '@playwright/test'

/**
 * Marketplace Availability Smoke Test
 * 
 * Сценарій: студент відкриває профіль тьютора, бачить календар,
 * обирає слот, відкриває TrialRequestModal, сабмітить запит.
 * Перевіряє обробку 409 conflict (slot_unavailable).
 */

test.describe('Marketplace Availability Smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Mock tutor profile API
    await page.route('**/api/v1/marketplace/tutors/tutor-79/', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 79,
          slug: 'tutor-79',
          user: { id: 1, full_name: 'Test Tutor', avatar_url: '' },
          headline: 'Test Tutor',
          bio: 'Test bio',
          photo: '',
          video_intro_url: '',
          education: [],
          experience_years: 5,
          certifications: [],
          subjects: [],
          languages: [],
          country: 'Ukraine',
          timezone: 'Europe/Kyiv',
          hourly_rate: 500,
          currency: 'UAH',
          trial_lesson_price: 250,
          total_lessons: 100,
          total_students: 50,
          average_rating: 4.8,
          total_reviews: 25,
          response_time_hours: 2,
          badges: [],
          is_public: true,
          status: 'approved',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          has_availability: true
        })
      })
    })
  })

  test('calendar loads, slot click opens modal, handles 409 conflict', async ({ page }) => {
    // Логування 409 response для діагностики
    page.on('response', async (resp) => {
      if (resp.status() === 409) {
        console.log('✅ 409 URL:', resp.url())
        const body = await resp.text()
        console.log('✅ 409 BODY:', body)
      }
    })
    // Mock calendar API with stable slots (new contract: 7 cells)
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: '2026-01-06',
          week_end: '2026-01-12',
          horizon_weeks: 4,
          generated_at: '2026-01-05T20:00:00Z',
          cells: [
            {
              date: '2026-01-06',
              day_status: 'working',
              slots: [
                { slot_id: 'sha256:fixed001', start_at: '2026-01-06T10:00:00Z', duration_min: 60, status: 'available' },
                { slot_id: 'sha256:fixed002', start_at: '2026-01-06T11:00:00Z', duration_min: 60, status: 'available' }
              ]
            },
            {
              date: '2026-01-07',
              day_status: 'working',
              slots: [
                { slot_id: 'sha256:fixed003', start_at: '2026-01-07T14:00:00Z', duration_min: 60, status: 'available' }
              ]
            },
            { date: '2026-01-08', day_status: 'working', slots: [] },
            { date: '2026-01-09', day_status: 'working', slots: [] },
            { date: '2026-01-10', day_status: 'working', slots: [] },
            { date: '2026-01-11', day_status: 'off', slots: [] },
            { date: '2026-01-12', day_status: 'off', slots: [] }
          ]
        })
      })
    })
    
    // Mock trial request with 409 conflict
    let trialRequestCalled = false
    await page.route('**/api/v1/marketplace/tutors/*/trial-request/', route => {
      trialRequestCalled = true
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'slot_unavailable' })
      })
    })
    
    const tutorSlug = 'tutor-79'
    await page.goto(`/marketplace/tutors/${tutorSlug}`)
    
    // Дочекатися рендера календаря з data-testid
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    
    // Перевірити, що календар не в loading state
    await expect(page.locator('[data-testid="availability-loading-state"]')).not.toBeVisible()
    
    // Перевірити наявність слотів з data-testid
    const firstSlot = page.locator('[data-testid="marketplace-slot"]').first()
    await expect(firstSlot).toBeVisible()
    
    // Клік по першому доступному слоту
    await firstSlot.click()
    
    // Перевірити, що TrialRequestModal відкрився
    await expect(page.locator('[data-test="trial-modal"]')).toBeVisible({ timeout: 5000 })
    
    // Сабміт форми через data-testid (Варіант Б)
    const submitButton = page.getByTestId('trial-request-submit')
    await expect(submitButton).toBeVisible({ timeout: 3000 })
    await submitButton.click()
    
    // Чекаємо на відповідь API та обробку помилки
    await page.waitForTimeout(2000)
    
    // Перевірити, що модал все ще відкритий (не закрився після помилки)
    await expect(page.locator('[data-test="trial-modal"]')).toBeVisible()
    
    // Перевірити наявність error message або conflict banner
    const hasConflictBanner = await page.locator('.conflict-banner').isVisible().catch(() => false)
    const hasErrorMessage = await page.locator('.error').isVisible().catch(() => false)
    
    expect(hasConflictBanner || hasErrorMessage).toBeTruthy()
    
    console.log('✅ 409 conflict scenario completed', { hasConflictBanner, hasErrorMessage, trialRequestCalled })
  })

  test('calendar navigation works (previous/next week)', async ({ page }) => {
    let requestCount = 0
    
    // Mock calendar API для різних тижнів (new contract)
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      requestCount++
      const weekStart = requestCount === 1 ? '2026-01-06' : '2026-01-13'
      const weekEnd = requestCount === 1 ? '2026-01-12' : '2026-01-19'
      
      // Generate 7 cells
      const cells = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        cells.push({
          date: dateStr,
          day_status: 'working',
          slots: i === 0 ? [
            { slot_id: `sha256:week${requestCount}`, start_at: `${dateStr}T10:00:00Z`, duration_min: 60, status: 'available' }
          ] : []
        })
      }
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: weekStart,
          week_end: weekEnd,
          horizon_weeks: 4,
          generated_at: '2026-01-05T20:00:00Z',
          cells
        })
      })
    })
    
    const tutorSlug = 'tutor-79'
    await page.goto(`/marketplace/tutors/${tutorSlug}`)
    
    await expect(page.locator('[data-testid="tutor-availability-calendar"]')).toBeVisible({ timeout: 10000 })
    
    // Клік по "Next week"
    const nextButton = page.locator('.btn-icon').nth(1)
    await nextButton.click()
    
    // Дочекатися оновлення (другий запит)
    await page.waitForTimeout(1000)
    
    // Перевірити, що було 2 запити
    expect(requestCount).toBe(2)
    
    console.log('✅ Calendar navigation works')
  })

  test('calendar shows error state on API failure', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      route.abort('failed')
    })
    
    const tutorSlug = 'tutor-79'
    await page.goto(`/marketplace/tutors/${tutorSlug}`)
    
    // Перевірити error state з data-testid
    await expect(page.locator('[data-testid="availability-error-state"]')).toBeVisible({ timeout: 10000 })
    
    // Перевірити кнопку "Повторити"
    const retryButton = page.locator('button').filter({ hasText: /повторити|retry/i })
    await expect(retryButton).toBeVisible()
    
    console.log('✅ Error state displayed correctly')
  })

  test('calendar shows empty state when no slots available', async ({ page }) => {
    // Mock empty response (7 cells, no slots)
    await page.route('**/api/v1/marketplace/tutors/*/calendar/**', route => {
      const cells = []
      for (let i = 0; i < 7; i++) {
        const date = new Date('2026-01-06')
        date.setDate(date.getDate() + i)
        cells.push({
          date: date.toISOString().split('T')[0],
          day_status: 'working',
          slots: []
        })
      }
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutor_id: 79,
          timezone: 'Europe/Kyiv',
          week_start: '2026-01-06',
          week_end: '2026-01-12',
          horizon_weeks: 4,
          generated_at: '2026-01-05T20:00:00Z',
          cells
        })
      })
    })
    
    const tutorSlug = 'tutor-79'
    await page.goto(`/marketplace/tutors/${tutorSlug}`)
    
    // Перевірити empty state з data-testid
    await expect(page.locator('[data-testid="availability-empty-state"]')).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Empty state displayed correctly')
  })

  test('calendar respects horizon validation (422 error)', async ({ page }) => {
    // Mock 422 response (beyond 4 weeks)
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
    
    const tutorSlug = 'tutor-79'
    await page.goto(`/marketplace/tutors/${tutorSlug}`)
    
    // Перевірити error state з data-testid
    await expect(page.locator('[data-testid="availability-error-state"]')).toBeVisible({ timeout: 10000 })
    
    // Перевірити текст помилки (має бути з i18n ключа marketplace.calendar.errorHorizon)
    const errorText = await page.locator('[data-testid="availability-error-state"]').textContent()
    expect(errorText).toContain('4')
    
    console.log('✅ Horizon validation error displayed correctly')
  })
})
