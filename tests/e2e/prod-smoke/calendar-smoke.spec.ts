import { test, expect } from '@playwright/test'

const RAW_BASE_URL = process.env.E2E_BASE_URL
const BASE_URL = RAW_BASE_URL?.trim().replace(/\/$/, '')
const TUTOR_CALENDAR_PATH = (process.env.E2E_TUTOR_PATH || '/booking/tutor').trim()

/**
 * Read-only smoke test for production. No mutations.
 * Tests calendar loading and week navigation with real API calls.
 */
test.describe('PROD smoke - Calendar navigation', () => {
  test('calendar loads, navigation buttons work with real API', async ({ page }) => {
    if (!BASE_URL) {
      test.skip(true, 'E2E_BASE_URL not provided - skipping prod-smoke')
    }

    const calendarUrl =
      TUTOR_CALENDAR_PATH.startsWith('/')
        ? `${BASE_URL}${TUTOR_CALENDAR_PATH}`
        : `${BASE_URL}/${TUTOR_CALENDAR_PATH}`

    await page.goto(calendarUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Крок 1: Дочекатися основних елементів календаря
    const board = page.locator('[data-testid="calendar-board"]')
    const weekView = page.locator('[data-testid="calendar-week-view"]')

    await expect(board).toBeVisible({ timeout: 20000 })
    await expect(weekView).toBeVisible({ timeout: 20000 })

    // Крок 2: Перевірити видимість кнопок навігації
    const prevBtn = page.locator('[data-testid="calendar-prev-week"]')
    const nextBtn = page.locator('[data-testid="calendar-next-week"]')

    await expect(prevBtn).toBeVisible({ timeout: 5000 })
    await expect(nextBtn).toBeVisible({ timeout: 5000 })

    // Крок 3: Клік на "next" → чекати справжній API виклик /week/v055/
    const nextWeekPromise = page.waitForResponse(
      response => 
        response.url().includes('/week/v055/') && 
        (response.status() === 200 || response.status() === 304),
      { timeout: 15000 }
    )

    await nextBtn.click()
    await nextWeekPromise

    // Перевірити, що week-view не зник після навігації
    await expect(weekView).toBeVisible({ timeout: 5000 })
    await expect(board).toBeVisible({ timeout: 5000 })

    // Крок 4: Клік на "prev" → аналогічно
    const prevWeekPromise = page.waitForResponse(
      response => 
        response.url().includes('/week/v055/') && 
        (response.status() === 200 || response.status() === 304),
      { timeout: 15000 }
    )

    await prevBtn.click()
    await prevWeekPromise

    // Перевірити, що week-view лишається видимим
    await expect(weekView).toBeVisible({ timeout: 5000 })
    await expect(board).toBeVisible({ timeout: 5000 })
  })
})
