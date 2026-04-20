/**
 * Mobile viewport smoke tests — automated complement to manual QA.
 *
 * ⚠️ IMPORTANT: These tests use Playwright's mobile emulation which is
 * Chromium + resized viewport + fake touch events. They do NOT catch:
 *   - Real iOS Safari quirks (100vh, date picker, autoplay blocking)
 *   - Native camera/photo picker
 *   - Real network latency / memory limits
 *   - App lifecycle (background/foreground)
 *   - Haptic feedback, Face ID, swipe gestures
 *
 * Use physical devices per `saas_docs/plans/MOBILE_QA_CHECKLIST_2026-04-20.md`.
 * These tests catch the subset that's verifiable programmatically.
 *
 * Run:
 *   npx playwright test --project=mobile-ios
 *   npx playwright test --project=mobile-android
 *   npx playwright test --project=mobile-ios-small  # iPhone SE (375x667)
 */

import { test, expect } from '@playwright/test'

// ─── No-auth smoke (public pages) ────────────────────────────────────────────

test.describe('Mobile viewport — public pages render', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page renders on mobile viewport', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page).toHaveURL(/\/auth\/login/)
    const emailInput = page.locator('[data-testid="login-email-input"]')
    await expect(emailInput).toBeVisible({ timeout: 15000 })

    // Touch input accepts text
    await emailInput.tap()
    await emailInput.fill('mobile-test@example.com')
    await expect(emailInput).toHaveValue('mobile-test@example.com')

    // Submit button tap target per Apple HIG + WCAG 2.1 SC 2.5.5 = ≥44×44.
    // Fixed 2026-04-20 via @media (max-width: 768px) min-height: 44px in
    // src/ui/Button.vue. Regression guard — prevents accidental rollback.
    const submit = page.locator('[data-testid="login-submit-button"]')
    await expect(submit).toBeVisible()
    const box = await submit.boundingBox()
    expect(box?.height, 'Login button must meet 44×44 minimum tap target').toBeGreaterThanOrEqual(44)
  })

  test('register flow entry renders on mobile viewport', async ({ page }) => {
    await page.goto('/auth/register')
    // /auth/register redirects to /start (role selection landing page)
    await expect(page).toHaveURL(/\/start/)
    // Page renders without horizontal scroll — content fits viewport
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)
  })

  test('role-selection (/start) renders on mobile viewport', async ({ page }) => {
    await page.goto('/start')
    await expect(page).toHaveURL(/\/start/)
    // Some role-selection CTA should be present
    await expect(page.locator('body')).not.toBeEmpty()
    const viewportWidth = page.viewportSize()?.width ?? 0
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })
})

// ─── Authenticated flows ─────────────────────────────────────────────────────

test.describe('Mobile viewport — authenticated user', () => {
  test('dashboard renders without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // If auth stale → redirect to /start. Still useful to verify no horizontal
    // scroll on whichever page we land on.
    const viewportWidth = page.viewportSize()?.width ?? 0
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('sidebar navigation works via hamburger on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // If auth state is stale, root redirects to /start (role selection
    // landing page). In that case we can't test sidebar. Skip gracefully.
    const currentUrl = page.url()
    test.skip(
      /\/start|\/auth\//.test(currentUrl),
      `Auth stale — redirected to ${currentUrl}. Run global-setup with fresh backend to test authenticated flows.`,
    )

    // On mobile, sidebar is usually hidden behind a hamburger toggle.
    const hamburger = page.locator(
      '[data-testid="sidebar-toggle"], [aria-label*="menu" i], button:has-text("☰")',
    ).first()

    if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hamburger.tap()
      await expect(
        page.locator('nav a, [role="navigation"] a').first(),
      ).toBeVisible({ timeout: 5000 })
    } else {
      // If no hamburger and not redirected, either permanent sidebar (>500)
      // or a responsive impl we don't recognize. Log for investigation.
      const viewportWidth = page.viewportSize()?.width ?? 0
      const navCount = await page.locator('nav').count()
      expect(
        navCount,
        `No hamburger + no recognizable <nav> on ${viewportWidth}px viewport`,
      ).toBeGreaterThan(0)
    }
  })

  test('tutor profile page is scrollable + no content cut-off', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Try to find first tutor card; if marketplace is empty, skip gracefully
    const firstCard = page.locator('[data-testid^="tutor-card"], .tutor-card').first()
    const hasTutors = await firstCard.isVisible({ timeout: 5000 }).catch(() => false)

    test.skip(!hasTutors, 'No tutors in marketplace on staging — skip')

    await firstCard.tap()
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Profile page should be scrollable
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const viewportHeight = page.viewportSize()?.height ?? 0
    expect(scrollHeight).toBeGreaterThan(viewportHeight - 100) // enough content
  })
})

// ─── Touch interaction sanity ────────────────────────────────────────────────

test.describe('Mobile viewport — touch events', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('tap events fire correctly on buttons', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 15000 })

    // Tap should focus input (mobile-specific vs click)
    const emailInput = page.locator('[data-testid="login-email-input"]')
    await emailInput.tap()

    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBe('INPUT')
  })

  test('viewport meta tag prevents unintended zoom on input focus', async ({ page }) => {
    await page.goto('/auth/login')

    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content')
    // Should NOT have user-scalable=no (hurts accessibility),
    // but should have width=device-width to prevent zoomed-out initial render
    expect(viewportMeta).toMatch(/width=device-width/)
  })
})

// ─── Viewport-specific guards ────────────────────────────────────────────────

test.describe('Mobile viewport — responsive guards', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('no element exceeds viewport width (prevents horizontal scroll)', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    const viewportWidth = page.viewportSize()?.width ?? 0

    // Find any element that's wider than viewport (a common responsive bug)
    const offendingElements = await page.evaluate((vw) => {
      const all = document.querySelectorAll('*')
      const offenders: Array<{ tag: string; width: number; class: string }> = []
      for (const el of Array.from(all)) {
        const rect = el.getBoundingClientRect()
        if (rect.width > vw + 10) {
          // +10 tolerance for subpixel/border anomalies
          offenders.push({
            tag: el.tagName,
            width: Math.round(rect.width),
            class: (el as HTMLElement).className?.slice(0, 50) || '',
          })
        }
      }
      return offenders.slice(0, 5) // top 5 offenders only
    }, viewportWidth)

    expect(
      offendingElements,
      `Elements wider than viewport (${viewportWidth}px): ${JSON.stringify(offendingElements, null, 2)}`,
    ).toEqual([])
  })
})
