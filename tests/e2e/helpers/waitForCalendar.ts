import { Page, expect } from '@playwright/test'

/**
 * Надійне очікування завантаження календаря.
 * 
 * Проблема: CalendarBoardV2 рендериться умовно - тільки після завершення loading.
 * Тести падають, бо чекають на calendar-board під час loading state.
 * 
 * Рішення: Спочатку чекаємо на зникнення loader, потім на появу board.
 */
export async function waitForCalendarReady(page: Page, options: {
  timeout?: number
  skipLoadingCheck?: boolean
} = {}): Promise<void> {
  const timeout = options.timeout || 30000
  
  try {
    // Крок 1: Чекаємо на зникнення loading state (якщо він є)
    if (!options.skipLoadingCheck) {
      const loadingSelector = '.loading-state'
      const hasLoading = await page.locator(loadingSelector).count() > 0
      
      if (hasLoading) {
        await page.waitForSelector(loadingSelector, { 
          state: 'hidden', 
          timeout: 15000 
        }).catch(() => {
          // Якщо loader не зник за 15s, продовжуємо - можливо його вже немає
        })
      }
    }
    
    // Крок 2: Чекаємо на появу calendar-week-view (wrapper)
    await page.waitForSelector('[data-testid="calendar-week-view"]', { 
      state: 'visible',
      timeout: timeout 
    })
    
    // Крок 3: Чекаємо на появу calendar-board (actual grid)
    await page.waitForSelector('[data-testid="calendar-board"]', { 
      state: 'visible',
      timeout: timeout 
    })
    
    // Крок 4: Перевіряємо що немає error state
    const errorState = page.locator('.error-state')
    const hasError = await errorState.isVisible().catch(() => false)
    
    if (hasError) {
      const errorText = await errorState.textContent()
      throw new Error(`Calendar error state: ${errorText}`)
    }
    
    // Крок 5: Чекаємо на networkidle (всі API calls завершені)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Не критично якщо networkidle не досягнуто
    })
    
  } catch (error: any) {
    // Діагностика: зберігаємо screenshot та HTML для debugging
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    await page.screenshot({ 
      path: `test-results/calendar-wait-failed-${timestamp}.png`,
      fullPage: true 
    }).catch(() => {})
    
    const html = await page.content().catch(() => 'Could not get HTML')
    console.error('Calendar wait failed. Page HTML:', html.substring(0, 500))
    
    throw new Error(`waitForCalendarReady failed: ${error.message}`)
  }
}

/**
 * Чекаємо на завантаження week snapshot API.
 * 
 * Використовується для перевірки що backend відповідає.
 */
export async function waitForWeekSnapshot(page: Page, options: {
  timeout?: number
} = {}): Promise<void> {
  const timeout = options.timeout || 20000
  
  await page.waitForResponse(
    response => 
      response.url().includes('/api/booking/week/') &&
      [200, 304].includes(response.status()),
    { timeout }
  )
}

/**
 * Перевіряємо що calendar board має дані (не порожній).
 */
export async function expectCalendarHasData(page: Page): Promise<void> {
  const board = page.locator('[data-testid="calendar-board"]')
  await expect(board).toBeVisible()
  
  // Перевіряємо що є хоча б один день
  const days = board.locator('[data-day]')
  const dayCount = await days.count()
  
  if (dayCount === 0) {
    throw new Error('Calendar board has no days rendered')
  }
}
