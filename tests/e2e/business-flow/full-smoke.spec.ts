// E2E: Full business smoke test — all critical paths in one run
import { test, expect } from '@playwright/test'
import { loginViaApi } from '../helpers/auth'

const API_BASE = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const TUTOR_EMAIL = process.env.TEST_USER_EMAIL || 'm16@gmail.com'
const TUTOR_PASSWORD = process.env.TEST_USER_PASSWORD || 'demo1234'
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || 's28@gmail.com'
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD || 'demo1234'

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('response', (resp) => {
    if (resp.status() >= 500 && !resp.url().includes('/onboarding')) {
      errors.push(`${resp.status()} ${resp.url()}`)
    }
  })
  return errors
}

async function assertPageRenders(page: import('@playwright/test').Page, minLength = 100) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_000)
  const body = await page.textContent('body')
  expect(body!.length).toBeGreaterThan(minLength)
}

test.describe('Full Business Smoke Test', () => {
  test('student journey: login → marketplace → settings', async ({ page }) => {
    const errors = collectErrors(page)

    await test.step('login as student', async () => {
      await loginViaApi(page, { email: STUDENT_EMAIL, password: STUDENT_PASSWORD })
    })

    await test.step('marketplace renders', async () => {
      await page.goto('/marketplace')
      await assertPageRenders(page)
    })

    await test.step('settings page renders', async () => {
      await page.goto('/settings')
      await assertPageRenders(page)
    })

    await test.step('zero server errors', async () => {
      expect(errors).toHaveLength(0)
    })
  })

  test('tutor journey: login → dashboard → calendar', async ({ page }) => {
    const errors = collectErrors(page)

    await test.step('login as tutor', async () => {
      await loginViaApi(page, { email: TUTOR_EMAIL, password: TUTOR_PASSWORD })
    })

    await test.step('tutor dashboard renders', async () => {
      await page.goto('/dashboard')
      await assertPageRenders(page)
    })

    await test.step('tutor schedule renders', async () => {
      await page.goto('/tutor/schedule')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3_000)
      await assertPageRenders(page)
    })

    await test.step('marketplace renders for tutor', async () => {
      await page.goto('/marketplace')
      await assertPageRenders(page)
    })

    await test.step('zero server errors', async () => {
      expect(errors).toHaveLength(0)
    })
  })

  test('winterboard: create → save → verify → delete (API)', async ({ page }) => {
    const errors = collectErrors(page)

    await test.step('login as tutor', async () => {
      await loginViaApi(page, { email: TUTOR_EMAIL, password: TUTOR_PASSWORD })
    })

    const access = await page.evaluate(() => window.localStorage.getItem('access'))

    await test.step('create session', async () => {
      const resp = await page.request.post(`${API_BASE}/v1/winterboard/sessions/`, {
        headers: { Authorization: `Bearer ${access}` },
        data: { name: `Smoke ${Date.now()}` },
      })
      expect(resp.status()).toBe(201)
    })

    await test.step('list sessions', async () => {
      const resp = await page.request.get(`${API_BASE}/v1/winterboard/sessions/`, {
        headers: { Authorization: `Bearer ${access}` },
      })
      expect(resp.status()).toBe(200)
      const data = await resp.json()
      expect(data.results.length).toBeGreaterThan(0)

      // Cleanup: delete the session we just created
      const lastSession = data.results[0]
      if (lastSession.name.startsWith('Smoke')) {
        await page.request.delete(
          `${API_BASE}/v1/winterboard/sessions/${lastSession.id}/`,
          { headers: { Authorization: `Bearer ${access}` } },
        )
      }
    })

    await test.step('zero server errors', async () => {
      expect(errors).toHaveLength(0)
    })
  })

  test('public pages render without auth', async ({ page }) => {
    const errors = collectErrors(page)

    await test.step('login page renders', async () => {
      await page.goto('/auth/login')
      await assertPageRenders(page)
    })

    await test.step('registration page renders', async () => {
      await page.goto('/start')
      await assertPageRenders(page, 50)
    })

    await test.step('zero server errors', async () => {
      expect(errors).toHaveLength(0)
    })
  })
})
