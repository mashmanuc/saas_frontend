/**
 * E2E Tests: Router Redirects (Phase 2)
 * 
 * Tests:
 * - /dashboard/profile → /settings
 * - /dashboard/profile/edit → /settings
 * - /dashboard/profile/security → /settings
 * - /dashboard/profile/activity → /settings
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/user.json' })

test.describe('Router Redirects (Phase 2)', () => {

  test('/dashboard/profile redirects to /settings', async ({ page }) => {
    await page.goto('/dashboard/profile')
    
    await page.waitForURL('/settings')
    
    expect(page.url()).toContain('/settings')
  })

  test('/dashboard/profile/edit redirects to /settings', async ({ page }) => {
    await page.goto('/dashboard/profile/edit')
    
    await page.waitForURL('/settings')
    
    expect(page.url()).toContain('/settings')
  })

  test('/dashboard/profile/security redirects to /settings', async ({ page }) => {
    await page.goto('/dashboard/profile/security')
    
    await page.waitForURL('/settings')
    
    expect(page.url()).toContain('/settings')
  })

  test('/dashboard/profile/activity redirects to /settings', async ({ page }) => {
    await page.goto('/dashboard/profile/activity')
    
    await page.waitForURL('/settings')
    
    expect(page.url()).toContain('/settings')
  })

  test('/settings page loads correctly', async ({ page }) => {
    await page.goto('/settings')
    
    // Wait for tabs to load (using Ukrainian text as seen in error-context)
    await page.waitForSelector('text=Загальні')
    await page.waitForSelector('button:has-text("Сповіщення")')
    await page.waitForSelector('text=Конфіденційність')
    
    // Verify General tab content is visible
    await page.waitForSelector('text=Загальні налаштування')
  })

  test('Settings tabs navigation works', async ({ page }) => {
    await page.goto('/settings')
    
    // Wait for tabs to load
    await page.waitForSelector('text=Загальні')
    
    // Click Notifications tab (translated)
    await page.click('button:has-text("Сповіщення")')
    await page.waitForTimeout(500)
    
    // Click Privacy tab (translated)
    await page.click('text=Конфіденційність')
    await page.waitForTimeout(500)
    
    // Click General tab (translated)
    await page.click('text=Загальні')
    await page.waitForTimeout(500)
    
    // All tabs should be clickable without errors
    expect(page.url()).toContain('/settings')
  })
})
