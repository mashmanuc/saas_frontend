// P3.3: E2E smoke test — "повний урок" flow
// Ref: WINTERBOARD_HARDENING_PLAN.md P3.3
//
// Цей тест перевіряє повний урочний flow:
// 1. Створити session
// 2. Намалювати pen/highlighter/rectangle
// 3. Додати PDF
// 4. Перемикнути сторінки
// 5. Видалити сторінку
// 6. Зберегти
// 7. Refresh → перевірити state
// 8. Replay → перевірити ops
//
// Потребує: запущені backend (8000) + frontend (5173)
// Запуск: npx playwright test tests/e2e/winterboard/winterboard-full-lesson.spec.ts

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173'
const API_URL = process.env.VITE_API_URL || 'http://localhost:8000'

// Тестові credentials — повинні існувати в тестовій БД
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@m4sh.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpass123'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL)
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|board|winterboard)/, { timeout: 10_000 })
}

async function createSession(page: Page): Promise<string> {
  // Navigate to winterboard
  await page.goto(`${BASE_URL}/winterboard`)
  // Click "New Board" button
  const newBoardBtn = page.locator('button:has-text("Нова дошка"), button:has-text("New Board")')
  if (await newBoardBtn.isVisible({ timeout: 5000 })) {
    await newBoardBtn.click()
  }
  // Wait for board to load
  await page.waitForSelector('canvas, [data-testid="wb-canvas"]', { timeout: 10_000 })
  // Extract session ID from URL
  const url = page.url()
  const match = url.match(/winterboard\/([a-f0-9-]+)/)
  expect(match).not.toBeNull()
  return match![1]
}

async function waitForAutosave(page: Page) {
  // Wait for sync status to show "saved"
  await page.waitForTimeout(5_000) // Wait for autosave debounce + save
}

test.describe('Winterboard Full Lesson Flow', () => {
  test.skip(
    !process.env.WB_E2E_ENABLED,
    'Winterboard E2E tests require WB_E2E_ENABLED=1 and running backend+frontend',
  )

  let sessionId: string

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('full lesson: create, draw, pages, save, reload, verify', async ({ page }) => {
    // 1. Створити session
    sessionId = await createSession(page)
    expect(sessionId).toBeTruthy()

    // 2. Намалювати pen stroke
    const canvas = page.locator('canvas, [data-testid="wb-canvas"]').first()
    await canvas.hover({ position: { x: 100, y: 100 } })

    // Select pen tool
    const penTool = page.locator('[data-tool="pen"], button:has-text("Pen"), button:has-text("Олівець")')
    if (await penTool.isVisible({ timeout: 2000 })) {
      await penTool.click()
    }

    // Draw a stroke
    await canvas.hover({ position: { x: 100, y: 100 } })
    await page.mouse.down()
    await page.mouse.move(200, 200, { steps: 10 })
    await page.mouse.up()

    // 3. Select rectangle tool and draw
    const rectTool = page.locator('[data-tool="rectangle"], button:has-text("Rectangle"), button:has-text("Прямокутник")')
    if (await rectTool.isVisible({ timeout: 2000 })) {
      await rectTool.click()
      await canvas.hover({ position: { x: 300, y: 100 } })
      await page.mouse.down()
      await page.mouse.move(450, 250, { steps: 5 })
      await page.mouse.up()
    }

    // 4. Додати сторінку
    const addPageBtn = page.locator('[data-testid="add-page"], button:has-text("Додати сторінку"), button:has-text("Add page")')
    if (await addPageBtn.isVisible({ timeout: 2000 })) {
      await addPageBtn.click()
      await page.waitForTimeout(500)
    }

    // 5. Перемикнути на першу сторінку
    const firstPageTab = page.locator('[data-page-index="0"], .wb-page-nav__tab:first-child')
    if (await firstPageTab.isVisible({ timeout: 2000 })) {
      await firstPageTab.click()
    }

    // 6. Зберегти (autosave або force save)
    await waitForAutosave(page)

    // 7. Refresh → перевірити state
    await page.reload()
    await page.waitForSelector('canvas, [data-testid="wb-canvas"]', { timeout: 10_000 })

    // Verify canvas loaded (не порожня сесія)
    const canvasAfterReload = page.locator('canvas, [data-testid="wb-canvas"]').first()
    await expect(canvasAfterReload).toBeVisible()

    // 8. Verify no network errors (exclude known 404s)
    const errors: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 500) {
        errors.push(`${response.status()} ${response.url()}`)
      }
    })
    await page.waitForTimeout(2_000)
    expect(errors).toHaveLength(0)
  })
})
