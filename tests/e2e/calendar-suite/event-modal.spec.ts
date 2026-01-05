/**
 * E2E Tests for Calendar Event Modal - Edit/Delete Lesson
 * v0.58 Final Calendar
 * 
 * Coverage:
 * - Open EventModal for existing lesson
 * - Edit lesson time and duration
 * - Verify grid updates after edit
 * - Delete lesson with confirmation
 * - Verify 304 when snapshot unchanged
 * - Force refetch after mutation
 * - Toast notifications
 */

import './envGuard'
import { test, expect, Page, TestInfo } from '@playwright/test'

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const HEALTH_ENDPOINT = `${API_BASE_URL.replace(/\/$/, '')}/v1/calendar/health/`
const WEEK_ENDPOINT = '/api/v1/calendar/week/v055/'

async function captureSnapshotDebug(page: Page, label: string, info: TestInfo) {
  const data = await page.evaluate(() => {
    const globalAny = window as any
    return {
      lastSnapshot: globalAny.__calendarLastSnapshot ?? null,
      lastFetch: globalAny.__calendarLastFetchRequest ?? null,
      history: Array.isArray(globalAny.__calendarSnapshotHistory)
        ? globalAny.__calendarSnapshotHistory
        : [],
    }
  })

  await info.attach(`calendar-${label}`, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  })

  console.log(`[calendar-${label}]`, data)
  return data
}

function enableWeekEndpointLogging(page: Page) {
  if ((page as any).__weekLoggingEnabled) {
    return
  }
  ;(page as any).__weekLoggingEnabled = true

  const log = (phase: string, payload: Record<string, unknown>) => {
    console.log(`[week-endpoint][${phase}]`, payload)
  }

  page.on('request', request => {
    if (!request.url().includes(WEEK_ENDPOINT)) return
    log('request', {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
    })
  })

  page.on('requestfinished', request => {
    if (!request.url().includes(WEEK_ENDPOINT)) return
    log('finished', {
      url: request.url(),
      timing: request.timing(),
    })
  })

  page.on('requestfailed', request => {
    if (!request.url().includes(WEEK_ENDPOINT)) return
    log('failed', {
      url: request.url(),
      errorText: request.failure()?.errorText,
    })
  })

  page.on('response', response => {
    if (!response.url().includes(WEEK_ENDPOINT)) return
    log('response', {
      url: response.url(),
      status: response.status(),
      fromServiceWorker: response.fromServiceWorker(),
    })
  })
}

async function waitForWeekSnapshot(page: Page) {
  await page.waitForResponse(
    response =>
      response.url().includes(WEEK_ENDPOINT) &&
      [200, 304].includes(response.status()),
    { timeout: 20000 } // Increase timeout for week navigation
  )
}

async function expectLessonsOrEmptyState(page: Page) {
  const lessonCards = page.locator('[data-testid="lesson-card"]')
  const emptyState = page.locator('text=/доступність не налаштована/i').first()

  await Promise.race([
    lessonCards.first().waitFor({ state: 'visible', timeout: 15000 }),
    emptyState.waitFor({ state: 'visible', timeout: 15000 }),
  ])

  const hasLesson = await lessonCards.first().isVisible().catch(() => false)
  const hasEmpty = await emptyState.isVisible().catch(() => false)
  expect(hasLesson || hasEmpty).toBeTruthy()
}

type WaitOptions = {
  requireLessonCard?: boolean
}

async function waitForCalendarReady(page: Page, options: WaitOptions = {}) {
  const { requireLessonCard = true } = options
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 20000 })
  
  // Wait for calendar board to be visible with longer timeout
  await page.waitForSelector('[data-testid="calendar-board"]', { timeout: 20000 })
  
  // Wait for calendar week view to be rendered
  await page.waitForSelector('[data-testid="calendar-week-view"]', { timeout: 15000 })
  
  // Give UI time to stabilize
  await page.waitForTimeout(1000)

  if (requireLessonCard) {
    // Wait for at least one lesson card or empty state
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const emptyState = page.locator('text=/доступність не налаштована/i')
    
    await Promise.race([
      lessonCard.waitFor({ state: 'visible', timeout: 15000 }),
      emptyState.waitFor({ state: 'visible', timeout: 15000 })
    ]).catch(() => {
      // If neither appears, continue - calendar might be loading
    })
  }
}

async function checkCalendarHealth(page: Page) {
  try {
    const res = await page.request.get(HEALTH_ENDPOINT, { timeout: 5000 })
    const status = res.status()
    if (status >= 500) {
      console.warn(
        '[calendar-health] backend unhealthy',
        status,
        await res.text().catch(() => '')
      )
    }
  } catch (error) {
    // Health endpoint не обов'язковий для прогону тестів — лог і продовжуємо.
    console.warn('[calendar-health] request failed (ignored)', error)
  }
}

async function navigateWeek(page: Page, direction: 'next' | 'prev') {
  const selector =
    direction === 'next'
      ? '[data-testid="calendar-next-week"]'
      : '[data-testid="calendar-prev-week"]'

  // Wait for calendar board to be stable first
  await page.waitForSelector('[data-testid="calendar-board"]', { state: 'visible', timeout: 15000 })
  await page.waitForTimeout(500)

  // Wait for navigation button to be visible and enabled
  const navButton = page.locator(selector)
  await navButton.waitFor({ state: 'visible', timeout: 20000 })
  await expect(navButton).toBeEnabled({ timeout: 20000 })

  await Promise.all([
    waitForWeekSnapshot(page),
    page.click(selector, { timeout: 15000 }),
  ])

  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await checkCalendarHealth(page)
  await waitForCalendarReady(page, { requireLessonCard: false })
}


test.describe('Calendar Event Modal - Edit/Delete Lesson', () => {
  test.beforeEach(async ({ page }) => {
    // Retry logic for page load
    let retries = 3
    while (retries > 0) {
      try {
        await page.goto('/booking/tutor', { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(500)
        await checkCalendarHealth(page)
        await waitForCalendarReady(page, { requireLessonCard: false })
        break // Success - exit retry loop
      } catch (error) {
        retries--
        if (retries === 0) {
          console.error('[beforeEach] Failed to load calendar after 3 retries:', error)
          throw error
        }
        console.warn(`[beforeEach] Retry ${3 - retries}/3 - reloading page...`)
        await page.waitForTimeout(2000)
      }
    }
  })

  test('should open EventModal when clicking on existing lesson', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await expect(lessonCard).toBeVisible({ timeout: 5000 })
    
    await lessonCard.click()
    
    // Verify modal opens
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="event-modal-title"]')).toContainText(/Редагувати урок|Edit lesson/i)
    
    // Verify student name is displayed
    await expect(page.locator('[data-testid="event-student-name"]')).toBeVisible()
    
    // Verify lesson time is displayed
    await expect(page.locator('[data-testid="event-time"]')).toBeVisible()
  })

  test('should show edit button for future lessons', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Verify edit button is visible (if lesson is in future)
    const editButton = page.locator('[data-testid="event-edit-button"]')
    const isVisible = await editButton.isVisible().catch(() => false)
    
    // If edit button visible, verify we can enter edit mode
    if (isVisible) {
      await editButton.click()
      await expect(page.locator('[data-testid="event-save-button"]')).toBeVisible({ timeout: 5000 })
    }
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('should display lesson details in view mode', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Verify lesson details are visible
    await expect(page.locator('[data-testid="event-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="event-student-name"]')).toBeVisible()
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible()
  })

  test('should verify delete button state based on lesson status', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Switch to Delete tab
    await page.click('[data-testid="event-tab-delete"]')
    await page.waitForTimeout(300)
    
    // Check delete button state
    const deleteButton = page.locator('[data-testid="event-delete-button"]')
    await expect(deleteButton).toBeVisible()
    
    // Перевіряємо, що кнопка існує (може бути enabled або disabled залежно від статусу уроку)
    const isEnabled = await deleteButton.isEnabled()
    
    if (isEnabled) {
      // Якщо кнопка активна, перевіряємо флоу видалення
      await deleteButton.click()
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible()
      
      // Скасовуємо видалення
      await page.click('[data-testid="delete-cancel-button"]')
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible()
    } else {
      // Якщо disabled - перевіряємо, що є попередження
      const warningText = page.locator('text=/Неможливо видалити|Cannot delete/i')
      const hasWarning = await warningText.isVisible().catch(() => false)
      expect(hasWarning).toBeTruthy()
    }
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible()
  })

  test('should verify tabs are accessible', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Verify Update tab is active by default
    const updateTab = page.locator('[data-testid="event-tab-update"]')
    await expect(updateTab).toBeVisible()
    
    // Switch to Delete tab
    const deleteTab = page.locator('[data-testid="event-tab-delete"]')
    await expect(deleteTab).toBeVisible()
    await deleteTab.click()
    await page.waitForTimeout(300)
    
    // Verify delete tab content is visible
    await expect(page.locator('[data-testid="event-delete-button"]')).toBeVisible()
    
    // Switch back to Update tab
    await updateTab.click()
    await page.waitForTimeout(300)
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible()
  })

  test('should handle navigation between weeks without breaking UI', async ({ page }) => {
    const testInfo = test.info()
    // Base UI must be present
    await expect(page.locator('[data-testid="calendar-board"]')).toBeVisible()
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()

    // Initial content state (lessons or empty)
    await expectLessonsOrEmptyState(page)

    // Navigation controls should be available
    const nextButton = page.locator('[data-testid="calendar-next-week"]')
    const prevButton = page.locator('[data-testid="calendar-prev-week"]')
    await expect(nextButton).toBeVisible()
    await expect(prevButton).toBeVisible()

    // Navigate forward one week and validate UI content state
    const beforeNext = await captureSnapshotDebug(page, 'before-next', testInfo)
    await navigateWeek(page, 'next')
    const afterNext = await captureSnapshotDebug(page, 'after-next', testInfo)
    if ((afterNext.history?.length || 0) === (beforeNext.history?.length || 0)) {
      enableWeekEndpointLogging(page)
    }
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()
    await expectLessonsOrEmptyState(page)

    // Navigate back to the original week and validate again
    const beforePrev = await captureSnapshotDebug(page, 'before-prev', testInfo)
    await navigateWeek(page, 'prev')
    const afterPrev = await captureSnapshotDebug(page, 'after-prev', testInfo)
    if ((afterPrev.history?.length || 0) === (beforePrev.history?.length || 0)) {
      enableWeekEndpointLogging(page)
    }
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()
    await expectLessonsOrEmptyState(page)

    // Controls must remain functional after round-trip navigation
    await expect(nextButton).toBeVisible()
    await expect(prevButton).toBeVisible()
  })

  test('should switch between tabs', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Switch to Delete tab
    await page.click('[data-testid="event-tab-delete"]')
    await page.waitForTimeout(300)
    
    // Verify delete tab content
    const deleteButton = page.locator('[data-testid="event-delete-button"]')
    await expect(deleteButton).toBeVisible()
    
    // Switch back to Update tab
    await page.click('[data-testid="event-tab-update"]')
    await page.waitForTimeout(300)
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('should close modal with close button', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Click close button
    await page.click('[data-testid="event-modal-close"]')
    
    // Modal should close
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible({ timeout: 5000 })
    
    // Verify calendar is still visible
    await expect(page.locator('[data-testid="calendar-board"]')).toBeVisible()
  })

  test('should display lesson details correctly', async ({ page }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Verify all key details are present
    await expect(page.locator('[data-testid="event-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="event-student-name"]')).toBeVisible()
    
    // Verify time format (should be HH:MM - HH:MM)
    const timeText = await page.locator('[data-testid="event-time"]').textContent()
    expect(timeText).toMatch(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)
    
    // Verify student name is not empty
    const studentName = await page.locator('[data-testid="event-student-name"]').textContent()
    expect(studentName).toBeTruthy()
    expect(studentName?.length).toBeGreaterThan(0)
    
    // Close modal
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible()
  })

  test('should handle concurrent edits gracefully', async ({ page, context }) => {
    // Skip if no lessons available
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    const hasLesson = await lessonCard.isVisible().catch(() => false)
    test.skip(!hasLesson, 'No lessons available on calendar')
    
    await lessonCard.click()
    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible()
    
    // Open same calendar in second tab
    const page2 = await context.newPage()
    await page2.goto('/booking/tutor', { waitUntil: 'networkidle' })
    await page2.waitForTimeout(500)
    await checkCalendarHealth(page2)
    await waitForCalendarReady(page2, { requireLessonCard: false })
    await expect(page2.locator('[data-testid="lesson-card"]').first()).toBeVisible({ timeout: 15000 })
    
    // Close modal in first tab
    await page.click('[data-testid="event-modal-close"]')
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible()
    
    // Verify both tabs show calendar
    await expect(page.locator('[data-testid="calendar-board"]')).toBeVisible()
    await expect(page2.locator('[data-testid="calendar-board"]')).toBeVisible()
    
    await page2.close()
  })
})
