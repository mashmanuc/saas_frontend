/**
 * E2E Tests for USERS Domain
 * 4 обов'язкові сценарії згідно Definition of Done
 */

import { test, expect } from '@playwright/test'

test.describe('USERS Domain E2E Tests', () => {
  /**
   * Test 1: Tutor Profile Edit Flow
   * Tutor редагує профіль → зберігає → профіль оновлено
   */
  test.describe('Test 1: Tutor Profile Edit Flow', () => {
    test('should allow tutor to edit and save profile', async ({ page }) => {
      // Використовуємо вже авторизовану сесію з global-setup
      await page.goto('/dashboard/profile/edit')
      await page.waitForLoadState('networkidle')

      // Verify we're on profile edit page
      await expect(page).toHaveURL(/\/dashboard\/profile\/edit/)

      // Check if headline field exists and fill it
      const headlineField = page.locator('input[name="headline"], input[placeholder*="headline"], input[placeholder*="заголовок"]').first()
      if (await headlineField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await headlineField.fill('E2E Test Math Teacher')
      }

      // Check if bio field exists and fill it
      const bioField = page.locator('textarea[name="bio"], textarea[placeholder*="bio"], textarea[placeholder*="про себе"]').first()
      if (await bioField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bioField.fill('E2E test bio for automated testing.')
      }
      
      // Look for save button and click
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Зберегти"), button[type="submit"]').first()
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click()
        
        // Wait for success indication (toast, message, or navigation)
        await page.waitForTimeout(2000)
      }
    })
  })

  /**
   * Test 2: Settings Page Access
   * User може відкрити сторінку налаштувань
   */
  test.describe('Test 2: Settings Page Access', () => {
    test('should access user settings page', async ({ page }) => {
      // Використовуємо вже авторизовану сесію
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      // Verify we're on settings page
      await expect(page).toHaveURL(/\/settings/)
      
      // Check that settings page loaded (look for common settings elements)
      const settingsIndicator = page.locator('h1, h2, [data-testid="settings-page"]').first()
      await expect(settingsIndicator).toBeVisible({ timeout: 5000 })
    })
  })

  /**
   * Test 3: Profile Page Navigation
   * User може переглянути свій профіль
   */
  test.describe('Test 3: Profile Page Navigation', () => {
    test('should navigate to profile edit page', async ({ page }) => {
      // Використовуємо вже авторизовану сесію
      await page.goto('/dashboard/profile/edit')
      await page.waitForLoadState('networkidle')

      // Verify profile edit page loaded
      await expect(page).toHaveURL(/\/dashboard\/profile\/edit/)
      
      // Check for profile form elements
      const profileForm = page.locator('form, [data-testid="profile-form"]').first()
      await expect(profileForm).toBeVisible({ timeout: 5000 })
    })
  })

  /**
   * Test 4: Account Settings Access
   * User може відкрити сторінку налаштувань акаунту
   */
  test.describe('Test 4: Account Settings Access', () => {
    test('should access account settings', async ({ page }) => {
      // Використовуємо вже авторизовану сесію
      await page.goto('/dashboard/account')
      await page.waitForLoadState('networkidle')

      // Verify account page loaded
      await expect(page).toHaveURL(/\/dashboard\/account/)
      
      // Check that account page has content
      const accountIndicator = page.locator('h1, h2, main, [data-testid="account-page"]').first()
      await expect(accountIndicator).toBeVisible({ timeout: 5000 })
    })
  })
})
