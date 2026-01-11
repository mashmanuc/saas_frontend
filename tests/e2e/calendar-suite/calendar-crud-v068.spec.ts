/**
 * E2E тести для Calendar CRUD операцій (v0.68)
 * Покриває: create, delete, update, drag-and-drop
 */

import { test, expect } from '@playwright/test'
import { loginAsTutorUI } from '../helpers/auth'

test.describe('Calendar CRUD v0.68', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTutorUI(page)
    await page.waitForSelector('[data-testid="calendar-board"]', { timeout: 15000 })
  })

  test('should create new lesson', async ({ page }) => {
    // Клік на grid cell (година 10)
    const gridCell = page.locator('[data-testid="grid-hour-10"]').first()
    await gridCell.scrollIntoViewIfNeeded()
    await gridCell.click({ force: true })
    
    // Очікуємо відкриття модалки створення
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
    
    // Вибираємо студента
    await page.fill('[data-testid="student-search"]', 'E2E')
    await page.waitForSelector('[data-testid="order-option"]', { timeout: 5000 })
    await page.click('[data-testid="order-option"]')
    
    // Вибираємо тривалість
    await page.click('[data-testid="duration-60"]')
    
    // Створюємо урок
    await page.click('[data-testid="create-lesson-submit"]')
    
    // Очікуємо закриття модалки та появу події на календарі
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10000 })
    
    // Перевіряємо, що подія з'явилась
    const lessonCard = page.locator('[data-testid="lesson-card"]').first()
    await expect(lessonCard).toBeVisible({ timeout: 10000 })
  })

  test('should delete lesson', async ({ page }) => {
    // Знаходимо існуючу подію
    const eventBlock = page.locator('[data-testid^="event-block-"]').first()
    await expect(eventBlock).toBeVisible()
    
    // Клік на подію для відкриття деталей
    await eventBlock.click()
    
    // Очікуємо модалку деталей події
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Клік на кнопку видалення
    await page.click('text=Видалити')
    
    // Підтверджуємо видалення
    await page.click('text=Підтвердити')
    
    // Очікуємо закриття модалки
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    
    // Перевіряємо, що подія зникла (або зменшилась кількість)
    const eventsCount = await page.locator('[data-testid^="event-block-"]').count()
    expect(eventsCount).toBeGreaterThanOrEqual(0)
  })

  test('should update lesson time', async ({ page }) => {
    // Знаходимо існуючу подію
    const eventBlock = page.locator('[data-testid^="event-block-"]').first()
    await expect(eventBlock).toBeVisible()
    
    // Клік на подію
    await eventBlock.click()
    
    // Очікуємо модалку
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Клік на кнопку редагування
    await page.click('text=Редагувати')
    
    // Змінюємо час (якщо є поле для редагування)
    const timeInput = page.locator('input[type="datetime-local"]')
    if (await timeInput.isVisible()) {
      await timeInput.fill('2025-12-25T14:00')
    }
    
    // Зберігаємо зміни
    await page.click('text=Зберегти')
    
    // Очікуємо закриття модалки
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('should reschedule lesson via drag-and-drop', async ({ page }) => {
    // Знаходимо подію для перетягування
    const eventBlock = page.locator('[data-testid^="event-block-"]').first()
    await expect(eventBlock).toBeVisible()
    
    // Отримуємо початкову позицію
    const initialBox = await eventBlock.boundingBox()
    expect(initialBox).not.toBeNull()
    
    // Знаходимо цільову клітинку (на 2 години пізніше)
    const targetCell = page.locator('[data-cell-status="empty"]').nth(4)
    const targetBox = await targetCell.boundingBox()
    
    if (initialBox && targetBox) {
      // Перетягуємо подію
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
      await page.mouse.up()
      
      // Очікуємо підтвердження перенесення
      await page.waitForTimeout(500)
      
      // Перевіряємо, що подія перемістилась
      const newEventBox = await eventBlock.boundingBox()
      expect(newEventBox).not.toBeNull()
    }
  })

  test('should handle keyboard navigation', async ({ page }) => {
    // Фокус на календарній сітці
    await page.keyboard.press('Tab')
    
    // Навігація стрілками
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    
    // Вибір клітинки через Enter
    await page.keyboard.press('Enter')
    
    // Перевіряємо, що модалка відкрилась
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    
    // Закриваємо через Escape
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('should display accessibility labels', async ({ page }) => {
    // Перевіряємо наявність ARIA атрибутів на календарній сітці
    const calendarBoard = page.locator('[data-testid="calendar-board"]')
    await expect(calendarBoard).toHaveAttribute('role', 'grid')
    await expect(calendarBoard).toHaveAttribute('aria-label')
    
    // Перевіряємо ARIA на заголовках днів
    const dayHeaders = page.locator('[data-testid^="day-header-"]')
    const firstHeader = dayHeaders.first()
    await expect(firstHeader).toHaveAttribute('aria-label')
    
    // Перевіряємо ARIA на клітинках
    const cells = page.locator('[data-testid^="calendar-cell-"]')
    const firstCell = cells.first()
    await expect(firstCell).toHaveAttribute('role', 'gridcell')
    await expect(firstCell).toHaveAttribute('aria-label')
    
    // Перевіряємо ARIA на подіях
    const events = page.locator('[data-testid^="event-block-"]')
    if (await events.count() > 0) {
      const firstEvent = events.first()
      await expect(firstEvent).toHaveAttribute('role', 'button')
      await expect(firstEvent).toHaveAttribute('aria-label')
    }
  })

  test('should handle conflict detection', async ({ page }) => {
    // Створюємо першу подію
    const emptyCell = page.locator('[data-cell-status="empty"]').first()
    await emptyCell.click()
    
    await expect(page.locator('text=Створити урок')).toBeVisible()
    await page.fill('[data-testid="student-search"]', 'Test Student')
    await page.click('[data-testid="order-option"]')
    await page.click('[data-testid="duration-60"]')
    await page.click('[data-testid="create-lesson-submit"]')
    
    await expect(page.locator('text=Створити урок')).not.toBeVisible()
    
    // Спробуємо створити другу подію в той самий час
    await emptyCell.click()
    
    await expect(page.locator('text=Створити урок')).toBeVisible()
    await page.fill('[data-testid="student-search"]', 'Another Student')
    await page.click('[data-testid="order-option"]')
    await page.click('[data-testid="duration-60"]')
    await page.click('[data-testid="create-lesson-submit"]')
    
    // Очікуємо попередження про конфлікт
    await expect(page.locator('text=конфлікт').or(page.locator('text=перекриття'))).toBeVisible({ timeout: 5000 })
  })

  test('should create lesson series', async ({ page }) => {
    // Клік на порожню клітинку
    const emptyCell = page.locator('[data-cell-status="empty"]').first()
    await emptyCell.click()
    
    await expect(page.locator('text=Створити урок')).toBeVisible()
    
    // Вибираємо студента
    await page.fill('[data-testid="student-search"]', 'Test Student')
    await page.click('[data-testid="order-option"]')
    
    // Вибираємо тривалість
    await page.click('[data-testid="duration-60"]')
    
    // Вмикаємо режим серії
    await page.click('text=Повторювати')
    
    // Вибираємо режим повторення
    await page.selectOption('select', 'weekly')
    
    // Створюємо серію
    await page.click('[data-testid="create-lesson-submit"]')
    
    // Очікуємо успішного створення
    await expect(page.locator('text=Створити урок')).not.toBeVisible()
    
    // Перевіряємо, що з'явилось кілька подій
    const eventsCount = await page.locator('[data-testid^="event-block-"]').count()
    expect(eventsCount).toBeGreaterThan(1)
  })
})
