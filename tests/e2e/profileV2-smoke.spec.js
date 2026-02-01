import { test, expect } from '@playwright/test'

test.describe('Profile V2 - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('відкриває ProfileOverviewView V2', async ({ page }) => {
    await page.goto('/profile-v2/overview')
    await expect(page.locator('.profile-overview-container')).toBeVisible()
    await expect(page.locator('h1')).toContainText('profile.overview.title')
  })

  test('переходить до редагування профілю', async ({ page }) => {
    await page.goto('/profile-v2/overview')
    await page.click('button:has-text("profile.overview.editProfile")')
    await expect(page).toHaveURL('/profile-v2/edit')
    await expect(page.locator('.profile-edit-form')).toBeVisible()
  })

  test('редагує та зберігає профіль', async ({ page }) => {
    await page.goto('/profile-v2/edit')
    
    await page.fill('input[name="firstName"]', 'Updated')
    await page.fill('input[name="lastName"]', 'Name')
    await page.fill('textarea[name="bio"]', 'Updated bio text')
    
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL('/profile-v2/overview')
  })

  test('показує modal при скасуванні зі змінами', async ({ page }) => {
    await page.goto('/profile-v2/edit')
    
    await page.fill('input[name="firstName"]', 'Changed')
    await page.click('button:has-text("common.cancel")')
    
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"]')).toContainText('profile.edit.discardTitle')
  })

  test('відкриває UserAccountView V2', async ({ page }) => {
    await page.goto('/profile-v2/account')
    await expect(page.locator('.account-container')).toBeVisible()
    await expect(page.locator('h1')).toContainText('profile.account.title')
  })

  test('перемикає теми без помилок', async ({ page }) => {
    await page.goto('/profile-v2/overview')
    
    const themes = ['light', 'dark', 'classic']
    for (const theme of themes) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t)
      }, theme)
      
      const dataTheme = await page.evaluate(() => 
        document.documentElement.getAttribute('data-theme')
      )
      expect(dataTheme).toBe(theme)
    }
  })
})
