/**
 * [WB:B11] Visual Regression Tests — Responsive Viewports
 *
 * Captures baseline screenshots for each device mode:
 * - Mobile (375×667): compact toolbar, horizontal layout
 * - Tablet (768×1024): collapsible toolbar, split-view ready
 * - Desktop (1280×800): full toolbar, standard layout
 * - Display (1920×1080): expanded layout, large canvas
 *
 * Ref: winterboard_dev/responsive/PHASE5.md B11
 * Invariants: INV-1 (canvas scale only), INV-3 (single toolbar variant)
 *
 * Run: npx playwright test --config=playwright.visual.config.ts tests/visual/winterboard-responsive-visual.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

// ─── Constants ──────────────────────────────────────────────────────────────

const WB_NEW = '/winterboard/new'

const VIEWPORTS = {
  mobile:  { width: 375, height: 667 },
  tablet:  { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  display: { width: 1920, height: 1080 },
} as const

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mockSessionAPI(page: Page): Promise<void> {
  await page.route('**/api/v1/winterboard/sessions*', (route) => {
    const url = route.request().url()

    if (url.endsWith('/sessions') || url.endsWith('/sessions/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'session-visual-1',
        name: 'Visual Test Session',
        owner_id: 'user-1',
        state: {
          pages: [{ id: 'page-1', name: 'Page 1', strokes: [], shapes: [], texts: [], assets: [] }],
          activePageId: 'page-1',
        },
        page_count: 1,
        thumbnail_url: null,
        rev: 1,
        state_digest: 'abc123',
        last_write_at: null,
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
      }),
    })
  })

  await page.route('**/api/v1/auth/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-1', display_name: 'Visual Tester', role: 'tutor' }),
    }),
  )

  await page.route('**/api/v1/marketplace/me/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-1' }),
    }),
  )

  await page.route('**/api/notifications/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    }),
  )
}

async function waitForBoard(page: Page): Promise<void> {
  // Wait for canvas or board area to appear
  await page.waitForSelector('.wb-canvas, .konvajs-content, canvas, .wb-solo-room__canvas', { timeout: 15_000 })
  // Settle animations
  await page.waitForTimeout(800)
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE VISUAL REGRESSION
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Winterboard Responsive Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await mockSessionAPI(page)
  })

  // ── Mobile ──────────────────────────────────────────────────────────────

  test.describe('Mobile (375×667)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile)
    })

    test('full page layout', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      await expect(page).toHaveScreenshot('responsive-mobile-full.png', { fullPage: true })
    })

    test('toolbar — mobile variant', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const toolbar = page.locator('.wb-toolbar')
      if (await toolbar.isVisible()) {
        await expect(toolbar).toHaveScreenshot('responsive-mobile-toolbar.png')
      }
    })

    test('page footer navigation', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const footer = page.locator('.wb-page-footer, .wb-mobile-page-nav')
      if (await footer.isVisible()) {
        await expect(footer).toHaveScreenshot('responsive-mobile-page-nav.png')
      }
    })

    test('header — compact', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const header = page.locator('.wb-solo-room__header')
      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('responsive-mobile-header.png')
      }
    })
  })

  // ── Tablet ──────────────────────────────────────────────────────────────

  test.describe('Tablet (768×1024)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet)
    })

    test('full page layout', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      await expect(page).toHaveScreenshot('responsive-tablet-full.png', { fullPage: true })
    })

    test('toolbar — tablet variant expanded', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const toolbar = page.locator('.wb-toolbar')
      if (await toolbar.isVisible()) {
        await expect(toolbar).toHaveScreenshot('responsive-tablet-toolbar-expanded.png')
      }
    })

    test('toolbar — tablet variant collapsed', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const toggle = page.locator('.wb-toolbar__toggle')
      if (await toggle.isVisible()) {
        await toggle.click()
        await page.waitForTimeout(400)
        const toolbar = page.locator('.wb-toolbar')
        await expect(toolbar).toHaveScreenshot('responsive-tablet-toolbar-collapsed.png')
      }
    })
  })

  // ── Desktop ─────────────────────────────────────────────────────────────

  test.describe('Desktop (1280×800)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop)
    })

    test('full page layout', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      await expect(page).toHaveScreenshot('responsive-desktop-full.png', { fullPage: true })
    })

    test('toolbar — desktop variant', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const toolbar = page.locator('.wb-toolbar')
      if (await toolbar.isVisible()) {
        await expect(toolbar).toHaveScreenshot('responsive-desktop-toolbar.png')
      }
    })

    test('header with all controls', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const header = page.locator('.wb-solo-room__header')
      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('responsive-desktop-header.png')
      }
    })
  })

  // ── Display ─────────────────────────────────────────────────────────────

  test.describe('Display (1920×1080)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.display)
    })

    test('full page layout', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      await expect(page).toHaveScreenshot('responsive-display-full.png', { fullPage: true })
    })

    test('canvas fills available space', async ({ page }) => {
      await page.goto(WB_NEW)
      await waitForBoard(page)
      const canvasArea = page.locator('.wb-solo-room__canvas')
      if (await canvasArea.isVisible()) {
        await expect(canvasArea).toHaveScreenshot('responsive-display-canvas-area.png')
      }
    })
  })

  // ── Orientation change (tablet) ─────────────────────────────────────────

  test.describe('Tablet Orientation', () => {
    test('portrait → landscape transition', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto(WB_NEW)
      await waitForBoard(page)
      await expect(page).toHaveScreenshot('responsive-tablet-portrait.png', { fullPage: true })

      // Switch to landscape
      await page.setViewportSize({ width: 1024, height: 768 })
      await page.waitForTimeout(500)
      await expect(page).toHaveScreenshot('responsive-tablet-landscape.png', { fullPage: true })
    })
  })
})
