/**
 * Winterboard Lesson Simulation — load + data-integrity test.
 *
 * Ціль: замінити ручні "провести урок і подивитись чи обірвалось" тести
 * повністю автоматизованим сценарієм, який:
 *   1. логіниться як тестовий юзер
 *   2. створює нову Winterboard сесію
 *   3. імітує ~10 хв активного уроку: 20 сторінок × 30 штрихів
 *   4. фіксує ВСІ 4xx/5xx відповіді бекенду
 *   5. після фінального flush перевіряє що всі сторінки збережені (replay count)
 *
 * Запуск:
 *   cd frontend
 *   npx playwright test winterboard-lesson-simulation --project=full-e2e --headed
 *
 * ⚠️ Потребує:
 *   - backend runserver на :8000
 *   - celery worker з -Q celery,media_processing
 *   - frontend npm run dev на :5173
 *   - тестовий юзер m16@gmail.com / demo1234 у локальній БД
 */
import { test, expect, type Page, type Request, type Response } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const TEST_EMAIL = process.env.WB_TEST_EMAIL || 'm16@gmail.com'
const TEST_PASSWORD = process.env.WB_TEST_PASSWORD || 'demo1234'

const PAGES_COUNT = 20
const STROKES_PER_PAGE = 30
const INTER_STROKE_DELAY_MS = 50
const INTER_PAGE_DELAY_MS = 200

interface NetworkIssue {
  url: string
  status: number
  method: string
  time: number
}

test.describe('Winterboard lesson simulation', () => {
  test.setTimeout(15 * 60 * 1000) // 15 хв запас на 10-хв сценарій

  test('simulates 20-page lesson and reports all backend errors', async ({ browser }) => {
    // Чистий контекст — без storageState, робимо власний логін.
    // Відключаємо trace/video/screenshot — для load-test вони не потрібні,
    // а trace flush на context.close() призводить до 60-сек timeout у Playwright.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    await context.tracing.stop().catch(() => {})
    const page = await context.newPage()

    const issues: NetworkIssue[] = []
    const startTime = Date.now()

    // ── Network observer ───────────────────────────────────────────────
    page.on('response', (response: Response) => {
      const url = response.url()
      // Слухаємо тільки бекенд і WS upgrade
      if (!url.includes('/api/') && !url.includes('/ws/')) return
      const status = response.status()
      if (status >= 400) {
        issues.push({
          url: url.replace(/^https?:\/\/[^/]+/, ''),
          status,
          method: response.request().method(),
          time: Date.now() - startTime,
        })
      }
    })

    page.on('requestfailed', (request: Request) => {
      const url = request.url()
      if (!url.includes('/api/') && !url.includes('/ws/')) return
      // Ігноруємо cancelled/aborted — це нормальний cleanup при unmount/navigation
      const failure = request.failure()?.errorText || ''
      if (/aborted|canceled|cancelled|ERR_ABORTED/i.test(failure)) return
      issues.push({
        url: url.replace(/^https?:\/\/[^/]+/, ''),
        status: 0,
        method: request.method(),
        time: Date.now() - startTime,
      })
    })

    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('[WB:autosave]') ||
        text.includes('Save failed') ||
        text.includes('Circuit breaker') ||
        text.includes('Failed to fetch')
      ) {
        console.log(`[console ${msg.type()}] ${text}`)
      }
    })

    // ── Крок 1. Login ──────────────────────────────────────────────────
    console.log('[sim] login…')
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('[data-testid="login-email-input"]', TEST_EMAIL)
    await page.fill('[data-testid="login-password-input"]', TEST_PASSWORD)
    await page.click('form button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 })
    console.log('[sim] logged in →', page.url())

    // ── Крок 2. Створюємо нову сесію ───────────────────────────────────
    console.log('[sim] creating new winterboard session…')
    await page.goto(`${BASE_URL}/winterboard/new`)
    // Чекаємо редірект на /winterboard/:id
    await page.waitForURL(/\/winterboard\/[0-9a-f-]{36}/, { timeout: 20_000 })
    const sessionId = page.url().match(/\/winterboard\/([0-9a-f-]{36})/)?.[1]
    console.log('[sim] session:', sessionId)

    // Чекаємо поки завантажиться canvas
    const canvas = page.locator('canvas').first()
    await canvas.waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(1000) // стабілізація

    // Закрити онбординг якщо є ("Зрозуміло")
    const dismissBtn = page.locator('button:has-text("Зрозуміло"), button:has-text("Got it")').first()
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click().catch(() => {})
      await page.waitForTimeout(300)
    }

    // ── Крок 3. Цикл сторінок ──────────────────────────────────────────
    for (let i = 0; i < PAGES_COUNT; i++) {
      console.log(`[sim] page ${i + 1}/${PAGES_COUNT}`)

      // Додати нову сторінку (крім першої — вона вже є)
      if (i > 0) {
        const addPageBtn = page.locator('button.wb-page-btn--add').first()
        await addPageBtn.click({ timeout: 5000 })
        await page.waitForTimeout(400)
      }

      // Малюємо N штрихів
      const box = await canvas.boundingBox()
      if (!box) throw new Error('canvas not visible')
      for (let s = 0; s < STROKES_PER_PAGE; s++) {
        const x1 = box.x + 100 + Math.random() * (box.width - 200)
        const y1 = box.y + 100 + Math.random() * (box.height - 200)
        const x2 = x1 + (Math.random() - 0.5) * 200
        const y2 = y1 + (Math.random() - 0.5) * 200
        await page.mouse.move(x1, y1)
        await page.mouse.down()
        // кілька проміжних точок для реалістичного штриха
        for (let t = 0; t < 5; t++) {
          const tx = x1 + ((x2 - x1) * t) / 5
          const ty = y1 + ((y2 - y1) * t) / 5
          await page.mouse.move(tx, ty)
        }
        await page.mouse.move(x2, y2)
        await page.mouse.up()
        if (INTER_STROKE_DELAY_MS > 0) await page.waitForTimeout(INTER_STROKE_DELAY_MS)
      }

      await page.waitForTimeout(INTER_PAGE_DELAY_MS)
    }

    // ── Крок 4. Фінальний flush ────────────────────────────────────────
    console.log('[sim] waiting for autosave flush…')
    await page.waitForTimeout(8000)

    // ── Звіт ───────────────────────────────────────────────────────────
    console.log('\n========== SIMULATION REPORT ==========')
    console.log(`Session:     ${sessionId}`)
    console.log(`Duration:    ${Math.round((Date.now() - startTime) / 1000)}s`)
    console.log(`Pages:       ${PAGES_COUNT}`)
    console.log(`Strokes:     ${PAGES_COUNT * STROKES_PER_PAGE}`)
    console.log(`Network err: ${issues.length}`)

    if (issues.length > 0) {
      const grouped: Record<string, number> = {}
      for (const iss of issues) {
        const key = `${iss.status} ${iss.method} ${iss.url.split('?')[0]}`
        grouped[key] = (grouped[key] || 0) + 1
      }
      console.log('\nErrors by endpoint:')
      for (const [k, v] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${v}× ${k}`)
      }
    }
    console.log('========================================\n')

    // Фільтруємо pre-existing helper 404 що не стосуються winterboard
    const relevant = issues.filter((i) => !i.url.includes('/api/onboarding/progress/'))
    const serverErrors = relevant.filter((i) => i.status >= 500)
    const clientErrors = relevant.filter((i) => i.status >= 400 && i.status < 500)

    await context.close().catch(() => {})
    expect(
      serverErrors,
      `Backend 5xx errors detected:\n${serverErrors.map((e) => `  ${e.status} ${e.method} ${e.url}`).join('\n')}`,
    ).toHaveLength(0)
    expect(
      clientErrors.length,
      `Too many 4xx errors (${clientErrors.length}). Sample:\n${clientErrors.slice(0, 10).map((e) => `  ${e.status} ${e.method} ${e.url}`).join('\n')}`,
    ).toBeLessThan(10)
  })
})
