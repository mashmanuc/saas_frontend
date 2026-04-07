/**
 * Winterboard Multi-User Concurrency Test.
 *
 * Запускає N юзерів паралельно, кожен робить свій урок.
 * Ціль: зловити race conditions, contention у БД (ops_worker, diff, snapshot),
 * throttle crosstalk, WebSocket collision.
 *
 * Кожен юзер має СВОЮ сесію — це не spectating, а незалежні ops streams.
 *
 * Запуск:
 *   cd frontend
 *   npx playwright test winterboard-lesson-multiuser --project=full-e2e
 *
 * Налаштування:
 *   N_USERS, PAGES_PER_USER, STROKES_PER_PAGE — див. константи нижче.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const PASSWORD = 'demo1234'

// Тестові юзери з локальної БД (вже існують)
const USERS = ['m10@gmail.com', 'm11@gmail.com', 'm12@gmail.com', 'm14@gmail.com', 'm15@gmail.com']

const PAGES_PER_USER = 10
const STROKES_PER_PAGE = 20
const INTER_STROKE_DELAY_MS = 40

interface NetworkIssue {
  user: string
  url: string
  status: number
  method: string
  time: number
}

async function runLesson(
  context: BrowserContext,
  email: string,
  issues: NetworkIssue[],
  startTime: number,
): Promise<string | null> {
  const page = await context.newPage()

  page.on('response', (response) => {
    const url = response.url()
    if (!url.includes('/api/') && !url.includes('/ws/')) return
    if (response.status() >= 400) {
      issues.push({
        user: email,
        url: url.replace(/^https?:\/\/[^/]+/, ''),
        status: response.status(),
        method: response.request().method(),
        time: Date.now() - startTime,
      })
    }
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (!url.includes('/api/') && !url.includes('/ws/')) return
    const failure = request.failure()?.errorText || ''
    if (/aborted|canceled|cancelled|ERR_ABORTED/i.test(failure)) return
    issues.push({
      user: email,
      url: url.replace(/^https?:\/\/[^/]+/, ''),
      status: 0,
      method: request.method(),
      time: Date.now() - startTime,
    })
  })

  // Login
  await page.goto(`${BASE_URL}/auth/login`)
  await page.fill('[data-testid="login-email-input"]', email)
  await page.fill('[data-testid="login-password-input"]', PASSWORD)
  await page.click('form button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 20_000 })

  // New session
  await page.goto(`${BASE_URL}/winterboard/new`)
  await page.waitForURL(/\/winterboard\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const sessionId = page.url().match(/\/winterboard\/([0-9a-f-]{36})/)?.[1] || null

  const canvas = page.locator('canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(800)

  // Dismiss onboarding
  const dismissBtn = page.locator('button:has-text("Зрозуміло"), button:has-text("Got it")').first()
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click().catch(() => {})
    await page.waitForTimeout(200)
  }

  // Draw pages
  for (let i = 0; i < PAGES_PER_USER; i++) {
    if (i > 0) {
      await page.locator('button.wb-page-btn--add').first().click({ timeout: 5000 })
      await page.waitForTimeout(300)
    }
    const box = await canvas.boundingBox()
    if (!box) break
    for (let s = 0; s < STROKES_PER_PAGE; s++) {
      const x1 = box.x + 100 + Math.random() * (box.width - 200)
      const y1 = box.y + 100 + Math.random() * (box.height - 200)
      const x2 = x1 + (Math.random() - 0.5) * 150
      const y2 = y1 + (Math.random() - 0.5) * 150
      await page.mouse.move(x1, y1)
      await page.mouse.down()
      for (let t = 0; t < 3; t++) {
        await page.mouse.move(x1 + ((x2 - x1) * t) / 3, y1 + ((y2 - y1) * t) / 3)
      }
      await page.mouse.move(x2, y2)
      await page.mouse.up()
      if (INTER_STROKE_DELAY_MS > 0) await page.waitForTimeout(INTER_STROKE_DELAY_MS)
    }
  }

  await page.waitForTimeout(6000) // flush autosave
  return sessionId
}

test.describe('Winterboard multi-user concurrency', () => {
  test.setTimeout(20 * 60 * 1000)

  test(`${USERS.length} users run lessons simultaneously`, async ({ browser }) => {
    const issues: NetworkIssue[] = []
    const startTime = Date.now()

    // Окремий context для кожного юзера (ізольовані cookies/localStorage)
    const contexts: BrowserContext[] = []
    for (const _ of USERS) {
      contexts.push(await browser.newContext({ storageState: { cookies: [], origins: [] } }))
    }
    // Відключаємо tracing — load test, не debug
    await Promise.all(contexts.map((c) => c.tracing.stop().catch(() => {})))

    console.log(`[multi] starting ${USERS.length} parallel lessons…`)

    const results = await Promise.allSettled(
      USERS.map((email, i) => runLesson(contexts[i], email, issues, startTime)),
    )

    console.log('\n========== MULTI-USER REPORT ==========')
    console.log(`Users:    ${USERS.length}`)
    console.log(`Pages:    ${PAGES_PER_USER} per user (${USERS.length * PAGES_PER_USER} total)`)
    console.log(`Strokes:  ${STROKES_PER_PAGE * PAGES_PER_USER} per user (${USERS.length * STROKES_PER_PAGE * PAGES_PER_USER} total)`)
    console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`)

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`  ✓ ${USERS[i]} → session ${r.value}`)
      } else {
        console.log(`  ✗ ${USERS[i]} → FAILED: ${r.reason}`)
      }
    })

    const relevant = issues.filter((i) => !i.url.includes('/api/onboarding/progress/'))
    console.log(`\nNetwork errors: ${relevant.length}`)

    if (relevant.length > 0) {
      const grouped: Record<string, number> = {}
      for (const iss of relevant) {
        const key = `${iss.status} ${iss.method} ${iss.url.split('?')[0].replace(/[0-9a-f-]{36}/g, '{id}')}`
        grouped[key] = (grouped[key] || 0) + 1
      }
      console.log('\nBy endpoint:')
      for (const [k, v] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${v}× ${k}`)
      }

      // Per-user breakdown
      const perUser: Record<string, number> = {}
      for (const iss of relevant) perUser[iss.user] = (perUser[iss.user] || 0) + 1
      console.log('\nBy user:')
      for (const [u, c] of Object.entries(perUser)) console.log(`  ${c}× ${u}`)
    }
    console.log('========================================\n')

    await Promise.all(contexts.map((c) => c.close().catch(() => {})))

    // Перевірки
    const failed = results.filter((r) => r.status === 'rejected')
    expect(failed, `${failed.length} users failed completely`).toHaveLength(0)

    const serverErrors = relevant.filter((i) => i.status >= 500)
    expect(
      serverErrors,
      `Backend 5xx errors:\n${serverErrors.map((e) => `  [${e.user}] ${e.status} ${e.method} ${e.url}`).join('\n')}`,
    ).toHaveLength(0)

    const clientErrors = relevant.filter((i) => i.status >= 400 && i.status < 500)
    expect(
      clientErrors.length,
      `Too many 4xx errors across ${USERS.length} users: ${clientErrors.length} (limit: ${USERS.length * 3})`,
    ).toBeLessThan(USERS.length * 3)
  })
})
