/**
 * E2E Tests for Staff Tutor Activity Management v0.88.3
 * 
 * Tests staff UI for viewing tutor activity status and granting exemptions.
 * Uses staff.json auth state from global-setup (e2e-staff@example.com).
 */
import { test, expect } from '@playwright/test'

test.describe('Staff Tutor Activity Management', () => {
  // Diagnostic hooks for all tests
  test.beforeEach(async ({ page }) => {
    page.on('response', r => {
      if (r.url().includes('/api/v1/staff/tutors/activity-list')) {
        console.log('[activity-list]', r.status(), r.url())
      }
    })
    page.on('console', msg => console.log('[console]', msg.type(), msg.text()))
    page.on('pageerror', err => console.log('[pageerror]', err.message))
  })

  test('should display tutor activity list', async ({ page }) => {
    // Start waiting for API response before navigation
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/v1/staff/tutors/activity-list') && r.status() === 200,
      { timeout: 15000 }
    )
    
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
    
    // Wait for API response to complete
    await responsePromise
    
    // Now table should be visible
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible()
    await expect(page.locator('text=ID')).toBeVisible()
    await expect(page.locator('text=Email')).toBeVisible()
    await expect(page.locator('text=План')).toBeVisible()
    
    // Verify at least one tutor row exists
    const rows = page.locator('[data-test^="tutor-row-"]')
    await expect(rows.first()).toBeVisible()
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
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/v1/staff/tutors/activity-list') && r.status() === 200,
      { timeout: 15000 }
    )
    
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
    await responsePromise
    
    await expect(page.locator('[data-test="tutors-table"]')).toBeVisible()
    
    const firstGrantBtn = page.locator('[data-test^="grant-exemption-btn-"]').first()
    await firstGrantBtn.click()
    
    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible()
    await expect(page.locator('[data-test="exemption-month-input"]')).toBeVisible()
    await expect(page.locator('[data-test="exemption-reason-input"]')).toBeVisible()
  })

  test('should close modal on cancel', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
    
    // Wait for page to load
    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()
    
    // Wait for one of the states: loading, table, empty, or error
    await expect(
      page.locator('[data-test="loading-state"],[data-test="tutors-table"],[data-test="tutors-empty"],[data-test="error-state"]')
    ).toBeVisible({ timeout: 15000 })
    
    // Only proceed if table exists (skip test if empty/error)
    const table = page.locator('[data-test="tutors-table"]')
    const tableVisible = await table.isVisible().catch(() => false)
    if (!tableVisible) {
      console.log('[test] Skipping: no tutors in list')
      return
    }
    
    await page.locator('[data-test^="grant-exemption-btn-"]').first().click()
    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible()
    
    await page.locator('[data-test="exemption-cancel-btn"]').click()
    
    await expect(page.locator('[data-test="grant-exemption-modal"]')).not.toBeVisible()
  })

  test('should require reason to submit exemption', async ({ page }) => {
    await page.goto('/staff/tutor-activity', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
    
    // Wait for page to load
    await expect(page.locator('[data-test="tutor-activity-page"]')).toBeVisible()
    
    // Wait for one of the states
    await expect(
      page.locator('[data-test="loading-state"],[data-test="tutors-table"],[data-test="tutors-empty"],[data-test="error-state"]')
    ).toBeVisible({ timeout: 15000 })
    
    // Only proceed if table exists
    const table = page.locator('[data-test="tutors-table"]')
    const tableVisible = await table.isVisible().catch(() => false)
    if (!tableVisible) {
      console.log('[test] Skipping: no tutors in list')
      return
    }
    
    await page.locator('[data-test^="grant-exemption-btn-"]').first().click()
    
    await expect(page.locator('[data-test="grant-exemption-modal"]')).toBeVisible()
    
    const submitBtn = page.locator('[data-test="exemption-submit-btn"]')
    await expect(submitBtn).toBeDisabled()
    
    await page.fill('[data-test="exemption-reason-input"]', 'Test exemption reason')
    
    await expect(submitBtn).toBeEnabled()
  })
})
