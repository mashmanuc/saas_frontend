/**
 * E2E Tests for Staff Tutor Activity Management v0.90.0
 *
 * Invariants:
 * - Seed MUST guarantee >= 1 tutor in staff activity-list (verified in global-setup).
 * - Staff tutor activity page MUST render table + >= 1 row (no "skip-pass").
 * - No sleeps/retries in tests; we wait for UI states only.
 */
import { test, expect } from '@playwright/test'

test.describe('Staff Tutor Activity Management', () => {
  test.beforeEach(async ({ page }) => {
    // ----- Diagnostics -----
    page.on('response', r => {
      if (r.url().includes('/api/v1/staff/tutors/activity-list')) {
        console.log('[activity-list]', r.status(), r.url())
      }
    })
    page.on('console', msg => console.log('[console]', msg.type(), msg.text()))
    page.on('pageerror', err => console.log('[pageerror]', err.message))

    // ----- Test-only network stubs to stop background 429 noise -----
    // Purpose: staff-e2e should not be affected by unrelated background polling on app mount.
    //
    // If your real endpoints differ, adjust patterns here (but keep the idea: notifications + billing + entitlements).
    await page.route('**/api/v1/notifications/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unread_count: 0,
          results: [],
        }),
      })
    })

    await page.route('**/api/v1/billing/me**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan_code: 'free',
          display_plan_code: 'free',
          pending_plan_code: null,
          subscription_status: 'ACTIVE',
        }),
      })
    })

    await page.route('**/api/v1/users/me/entitlements/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan_code: 'free',
          display_plan_code: 'free',
          pending_plan_code: null,
          subscription_status: 'ACTIVE',
        }),
      })
    })
  })

  test('should display tutor activity list', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)

    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()

    // Table MUST appear (seed guarantees >=1 tutor)
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible({ timeout: 20000 })

    // Verify at least one tutor row exists
    const rows = page.locator('[data-test^="tutor-row-"]')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })

    // Optional: header structure sanity (avoid brittle i18n text assertions)
    await expect(page.locator('[data-test="tutors-table"]')).toContainText('ID')
  })

  test('should show loading state initially', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
    
    // Either loading or table should be visible quickly
    await expect(
      page.locator('[data-test="loading-state"], [data-test="tutors-table"]')
    ).toBeVisible({ timeout: 10000 })
  })

  test('should open grant exemption modal', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)

    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()

    // Wait for table to be rendered (avoid waitForResponse(200) flake under 429)
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible({ timeout: 20000 })

    const firstGrantBtn = page.locator('[data-test^="grant-exemption-btn-"]').first()
    await expect(firstGrantBtn).toBeVisible({ timeout: 10000 })
    await firstGrantBtn.click()

    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-test="exemption-until-input"]')).toBeVisible()
    await expect(page.locator('[data-test="exemption-reason-input"]')).toBeVisible()
  })

  test('should close modal on cancel', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)

    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible({ timeout: 20000 })

    await page.locator('[data-test^="grant-exemption-btn-"]').first().click()
    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible()

    await page.locator('[data-test="exemption-cancel-btn"]').click()

    await expect(page.locator('[data-test="grant-exemption-modal"]')).not.toBeVisible()
  })

  test('should require reason to submit exemption', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)

    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible({ timeout: 20000 })

    await page.locator('[data-test^="grant-exemption-btn-"]').first().click()
    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible()

    const submitBtn = page.locator('[data-test="exemption-submit-btn"]')
    await expect(submitBtn).toBeDisabled()

    await page.fill('[data-test="exemption-reason-input"]', 'Test exemption reason')
    await expect(submitBtn).toBeEnabled()
  })
})
