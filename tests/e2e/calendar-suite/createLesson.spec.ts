/**
 * E2E Tests for Create Lesson Modal - v0.55
 * 
 * Scope: 2 сценарії (happy path + validation)
 * Data: детерміновані дані через global-setup (e2e_seed_calendar)
 * Передумова: backend працює з E2E_MODE=1, seed виконано в global-setup
 */

import './envGuard'
import { test, expect, type Response } from '@playwright/test'
import { loginViaApi } from '../helpers/auth'

const EVENT_CREATE_ENDPOINT = '/api/v1/calendar/event/create'

async function waitForCalendarReady(page: any) {
  await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="calendar-board"]')).toBeVisible({ timeout: 15000 })
}

/**
 * Відкрити CreateLessonModal через клік по grid cell
 * Використовує data-testid="grid-hour-9" - порожню клітинку БЕЗ accessible slot
 * (години 10,11,14,15,16 мають accessible slots і відкривають SlotEditorModal)
 */
async function openCreateLessonModal(page: any) {
  // Чекаємо на появу календаря
  const calendarBoard = page.locator('[data-testid="calendar-board"]')
  await expect(calendarBoard).toBeVisible({ timeout: 15000 })
  
  // Debug: перевіряємо які grid hours доступні
  const allGridHours = await page.locator('[data-testid^="grid-hour-"]').all()
  const hourIds = await Promise.all(allGridHours.map((el: any) => el.getAttribute('data-testid')))
  console.log('[E2E Debug] Available grid hours:', hourIds.slice(0, 10))
  
  // Debug: перевіряємо grid-hour-9
  const gridHour9 = page.locator('[data-testid="grid-hour-9"]').first()
  const count = await gridHour9.count()
  console.log('[E2E Debug] grid-hour-9 count:', count)
  
  if (count === 0) {
    throw new Error('grid-hour-9 not found! Available hours: ' + hourIds.join(', '))
  }
  
  await expect(gridHour9).toBeVisible({ timeout: 5000 })
  
  // Debug: перевіряємо стан елемента
  const classes = await gridHour9.getAttribute('class')
  console.log('[E2E Debug] grid-hour-9 classes:', classes)
  
  const isDisabled = classes?.includes('is-disabled') || false
  console.log('[E2E Debug] grid-hour-9 is-disabled:', isDisabled)
  
  // Клікаємо
  await gridHour9.scrollIntoViewIfNeeded()
  console.log('[E2E Debug] Clicking grid-hour-9...')
  await gridHour9.click({ force: true })
  console.log('[E2E Debug] Click executed')
  
  // Чекаємо трохи для обробки події
  await page.waitForTimeout(1000)
  
  // Перевіряємо, що модалка відкрилася
  const modal = page.locator('.modal-overlay')
  const modalVisible = await modal.isVisible().catch(() => false)
  console.log('[E2E Debug] Modal visible:', modalVisible)
  
  if (!modalVisible) {
    // Debug: перевіряємо чи є SlotEditorModal замість CreateLessonModal
    const slotEditor = await page.locator('text=Редагувати доступність').isVisible().catch(() => false)
    console.log('[E2E Debug] SlotEditorModal visible:', slotEditor)
    
    // Скріншот для діагностики
    await page.screenshot({ path: 'test-results/debug-modal-not-opened.png' })
  }
  
  await expect(modal).toBeVisible({ timeout: 5000 })
}

/**
 * Вибрати детермінованого студента e2e-student@example.com
 */
async function selectDeterministicStudent(page: any) {
  const searchInput = page.locator('[data-testid="student-search"]')
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.click()
  await searchInput.fill('E2E')

  const dropdown = page.locator('.dropdown-list')
  await expect(dropdown).toBeVisible({ timeout: 5000 })

  const e2eOrderOption = page.locator('[data-testid="order-option"]').filter({ hasText: /E2E/i }).first()
  await expect(e2eOrderOption).toBeVisible({ timeout: 5000 })

  const orderId = await e2eOrderOption.getAttribute('data-order-id')
  console.log('[E2E] Selecting student orderId:', orderId)

  await e2eOrderOption.click()
  await expect(dropdown).toBeHidden({ timeout: 3000 })
  await expect(searchInput).toHaveValue(/E2E/i)
}

async function selectDuration(page: any, minutes: number) {
  const durationBtn = page.locator(`[data-testid="duration-${minutes}"]`)
  await expect(durationBtn).toBeVisible({ timeout: 5000 })
  await durationBtn.click()
  await expect(durationBtn).toHaveClass(/active/)
}

async function setFutureStartTime(page: any, options?: { daysAhead?: number; hour?: number; minute?: number }) {
  const daysAhead = options?.daysAhead ?? 1
  const hour = options?.hour ?? 12
  const minute = options?.minute ?? 0

  const target = new Date()
  target.setDate(target.getDate() + daysAhead)
  target.setHours(hour, minute, 0, 0)

  const dateStr = target.toISOString().split('T')[0]
  const hourStr = String(hour).padStart(2, '0')
  const minuteStr = String(minute).padStart(2, '0')

  const dateInput = page.locator('[data-testid="start-time-picker"] input[type="date"]')
  await expect(dateInput).toBeVisible({ timeout: 5000 })
  await dateInput.fill(dateStr)

  const hourSelect = page.locator('[data-testid="start-time-picker"] select').first()
  const minuteSelect = page.locator('[data-testid="start-time-picker"] select').nth(1)
  await hourSelect.selectOption(hourStr)
  await minuteSelect.selectOption(minuteStr)

  const invalidTimeWarning = page.locator('.warning-message', { hasText: 'Невірний час' })
  await expect(invalidTimeWarning).toHaveCount(0, { timeout: 5000 })
}

async function logFormDebug(page: any) {
  const studentValue = await page.locator('[data-testid="student-search"]').inputValue().catch(() => '[missing]')
  const activeDuration = await page.locator('.duration-btn.active').first().textContent().catch(() => '[none]')
  const submitDisabled = await page.locator('[data-testid="create-lesson-submit"]').isDisabled().catch(() => true)
  const validationText = await page.locator('.field-error, .warning-message').allTextContents().catch(() => [])
  console.log('[E2E] Debug -> student=', studentValue, '| duration=', activeDuration, '| submitDisabled=', submitDisabled)
  if (validationText.length) {
    console.log('[E2E] Validation hints:', validationText)
  }
}

/**
 * Заповнити форму та створити урок (happy path)
 */
async function submitHappyPath(page: any) {
  await setFutureStartTime(page)
  await selectDeterministicStudent(page)

  await selectDuration(page, 60)
  await logFormDebug(page)

  // Чекаємо на активацію кнопки Submit (orderId + durationMin + start)
  const submitBtn = page.locator('[data-testid="create-lesson-submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 10000 })

  // Створити урок та дочекатися відповіді API
  const createResponsePromise = page.waitForResponse(
    (response: Response) => response.url().includes(EVENT_CREATE_ENDPOINT) && response.status() === 201,
    { timeout: 15000 }
  )
  
  await submitBtn.click()
  await createResponsePromise

  // Перевірити, що модалка закрилася
  await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Перевірити, що форма не дозволяє submit без студента
 */
async function expectValidationError(page: any) {
  const submitBtn = page.locator('[data-testid="create-lesson-submit"]')
  await expect(submitBtn).toBeDisabled()
}

test.describe('Create Lesson Modal v0.55', () => {
  test.beforeEach(async ({ page }) => {
    // Діагностика: логуємо console помилки
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[Browser Error]', msg.text())
      }
    })
    
    // Використовуємо loginViaApi для гарантованої свіжої авторизації
    await loginViaApi(page)
    await page.goto('/booking/tutor', { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Чекаємо на завантаження або показ помилки
    await page.waitForTimeout(2000)
    
    // Перевіряємо чи є календар або помилка
    const hasCalendar = await page.locator('[data-testid="calendar-week-view"]').isVisible().catch(() => false)
    const hasError = await page.locator('.error-message, .error-state').isVisible().catch(() => false)
    
    if (hasError) {
      const errorText = await page.locator('.error-message, .error-state').textContent()
      throw new Error(`Calendar failed to load: ${errorText}`)
    }
    
    if (!hasCalendar) {
      const bodyText = await page.locator('body').textContent()
      console.log('[E2E] Page body:', bodyText?.slice(0, 500))
    }
    
    await waitForCalendarReady(page)
  })

  test('Happy path: create lesson successfully', async ({ page }) => {
    await openCreateLessonModal(page)
    await submitHappyPath(page)
    
    // Перевірити, що урок з'явився в календарі
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    await expect(lessonCard).toBeVisible({ timeout: 10000 })
  })

  test('Validation: cannot submit without student', async ({ page }) => {
    await openCreateLessonModal(page)
    await expectValidationError(page)
  })
})

/**
 * Notes:
 * - Seed виконується в global-setup.ts
 * - Детерміновані дані: tutor m3@gmail.com, student e2e-student@example.com
 * - Доступні слоти: години 10, 11, 14, 15, 16 на 7 днів
 * - Backend повинен працювати з E2E_MODE=1 для синхронного Celery
 */
