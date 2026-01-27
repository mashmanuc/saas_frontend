/**
 * E2E Tests for Staff Dashboard v0.88.4
 * 
 * Tests staff post-login redirect and dashboard navigation.
 * Uses staff.json auth state from global-setup (e2e-staff@example.com).
 */
import { test, expect } from '@playwright/test'

test.describe('Staff Dashboard', () => {
  test('should redirect staff to /staff after login', async ({ page }) => {
    // Staff user is already authenticated via storageState (staff.json)
    // Navigate to root and verify redirect to /staff
    await page.goto('/', { waitUntil: 'networkidle' })
    
    // Should be redirected to /staff dashboard
    await expect(page).toHaveURL(/\/staff/, { timeout: 15000 })
    
    // Dashboard should be visible
    await expect(page.locator('[data-testid="staff-dashboard"]')).toBeVisible({ timeout: 10000 })
  })

  test('should not show marketplace links in staff nav', async ({ page }) => {
    await page.goto('/staff', { waitUntil: 'domcontentloaded' })
    
    await expect(page).toHaveURL(/\/staff/)
    
    // Staff nav should be visible
    await expect(page.locator('[data-testid="staff-nav"]')).toBeVisible()
    
    // Should NOT contain marketplace/tutor/student links
    // Check that nav does NOT have these common non-staff links
    const nav = page.locator('[data-testid="staff-nav"]')
    
    // These should NOT exist in staff nav
    await expect(nav.locator('text=/marketplace/i')).not.toBeVisible()
    await expect(nav.locator('text=/catalog/i')).not.toBeVisible()
    await expect(nav.locator('text=/my profile/i')).not.toBeVisible()
    
    // Should have staff-specific links
    await expect(nav.locator('[data-testid="nav-dashboard"]')).toBeVisible()
    await expect(nav.locator('[data-testid="nav-tutor-activity"]')).toBeVisible()
  })

  test('should navigate to tutor activity from dashboard', async ({ page }) => {
    await page.goto('/staff', { waitUntil: 'domcontentloaded' })
    
    await expect(page).toHaveURL(/\/staff/)
    await expect(page.locator('[data-testid="staff-dashboard"]')).toBeVisible()
    
    // Click on tutor activity tile
    const tile = page.locator('[data-testid="tile-tutor-activity"]')
    await expect(tile).toBeVisible()
    await tile.click()
    
    // Should navigate to tutor activity page
    await expect(page).toHaveURL(/\/staff\/tutor-activity/)
  })

  test('should have logout button in staff header', async ({ page }) => {
    await page.goto('/staff', { waitUntil: 'domcontentloaded' })
    
    await expect(page).toHaveURL(/\/staff/)
    
    // Logout button should be visible
    await expect(page.locator('[data-testid="staff-logout-btn"]')).toBeVisible()
  })
})
