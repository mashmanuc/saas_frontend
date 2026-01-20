/**
 * E2E Tests for Marketplace Tutor Onboarding Flow (v0.83.0)
 * 
 * Tests the complete onboarding experience for new tutors:
 * - No 403 errors for new tutors without profiles
 * - Clear "create profile" prompt instead of error messages
 * - Profile creation flow
 * - Profile validation before submission
 * - Submit for review flow
 */

import { test, expect } from '@playwright/test'

test.describe('Tutor Onboarding Flow v0.83.0', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a new tutor (tutor01@example.com from backend fixtures)
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'tutor01@example.com')
    await page.fill('input[name="password"]', 'TutorTest123!')
    await page.click('button[type="submit"]')
    
    // Wait for redirect after login
    await page.waitForURL(/\/tutor\//, { timeout: 10000 })
  })

  test('New tutor sees create profile prompt, not 403 error', async ({ page }) => {
    // Navigate to my profile page
    await page.goto('/marketplace/my-profile')
    
    // Should NOT see error banner with 403 or "contact administrator"
    const errorBanner = page.locator('[data-test="marketplace-profile-error"]')
    await expect(errorBanner).not.toBeVisible()
    
    // Should see create profile prompt
    const createPrompt = page.locator('text=/create.*profile/i')
    await expect(createPrompt).toBeVisible()
    
    // Should NOT see loading spinner indefinitely
    const spinner = page.locator('[data-test="loading-spinner"]')
    await expect(spinner).not.toBeVisible({ timeout: 5000 })
  })

  test('New tutor can create profile successfully', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // Wait for create prompt to appear
    await page.waitForSelector('text=/create.*profile/i', { timeout: 5000 })
    
    // Click create profile button
    await page.click('button:has-text("Create Profile"), button:has-text("Створити профіль")')
    
    // Fill in required fields
    await page.fill('input[name="headline"]', 'Experienced Math Tutor')
    await page.fill('textarea[name="bio"]', 'I have 5 years of experience teaching mathematics to students of all levels.')
    await page.fill('input[name="hourly_rate"]', '50')
    
    // Select at least one subject
    const subjectSelect = page.locator('select[name="subjects"], [data-test="subject-selector"]').first()
    if (await subjectSelect.isVisible()) {
      await subjectSelect.selectOption({ index: 1 })
    }
    
    // Select at least one language
    const languageSelect = page.locator('select[name="languages"], [data-test="language-selector"]').first()
    if (await languageSelect.isVisible()) {
      await languageSelect.selectOption({ label: /english|англійська/i })
    }
    
    // Save profile
    await page.click('button:has-text("Save"), button:has-text("Зберегти")')
    
    // Should see success message or profile editor (not error)
    await expect(page.locator('text=/success|успішно/i, [data-test="marketplace-profile-editor"]')).toBeVisible({ timeout: 10000 })
  })

  test('Cannot submit incomplete profile for review', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // Create minimal profile (missing required fields for submission)
    await page.waitForSelector('text=/create.*profile/i', { timeout: 5000 })
    await page.click('button:has-text("Create Profile"), button:has-text("Створити профіль")')
    
    await page.fill('input[name="headline"]', 'Test Tutor')
    await page.fill('textarea[name="bio"]', 'Test bio')
    await page.fill('input[name="hourly_rate"]', '30')
    
    // Save without photo or complete subjects
    await page.click('button:has-text("Save"), button:has-text("Зберегти")')
    
    // Wait for profile to be created
    await page.waitForTimeout(2000)
    
    // Try to submit for review
    const submitButton = page.locator('button:has-text("Submit"), button:has-text("Надіслати")')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Should see validation error about incomplete profile
      await expect(page.locator('text=/incomplete|неповний/i, text=/required|обов\'язков/i')).toBeVisible({ timeout: 5000 })
    }
  })

  test('Profile validation shows specific missing fields', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // Create profile and try to submit
    await page.waitForSelector('text=/create.*profile/i', { timeout: 5000 })
    await page.click('button:has-text("Create Profile"), button:has-text("Створити профіль")')
    
    await page.fill('input[name="headline"]', 'Test')
    await page.fill('textarea[name="bio"]', 'Bio')
    await page.fill('input[name="hourly_rate"]', '10')
    
    await page.click('button:has-text("Save"), button:has-text("Зберегти")')
    await page.waitForTimeout(2000)
    
    // Try to submit
    const submitButton = page.locator('button:has-text("Submit"), button:has-text("Надіслати")')
    if (await submitButton.isVisible()) {
      await submitButton.click()
      
      // Should see validation banner with field-level errors
      const validationBanner = page.locator('[data-test="marketplace-profile-validation"], .validation-banner')
      if (await validationBanner.isVisible()) {
        const bannerText = await validationBanner.textContent()
        
        // Should mention specific missing fields
        expect(bannerText).toMatch(/photo|фото|subjects|предмет/i)
      }
    }
  })

  test('Student cannot access tutor profile endpoint', async ({ page }) => {
    // Logout current tutor
    await page.goto('/settings/profile')
    await page.click('button:has-text("Logout"), button:has-text("Вийти")')
    
    // Login as student
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'student01@example.com')
    await page.fill('input[name="password"]', 'StudentTest123!')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/\/student\//, { timeout: 10000 })
    
    // Try to access tutor profile page
    await page.goto('/marketplace/my-profile')
    
    // Should see 403 forbidden or redirect (students shouldn't access tutor endpoints)
    await expect(page.locator('text=/forbidden|заборонено|access denied/i, text=/403/i')).toBeVisible({ timeout: 5000 })
  })

  test('Profile status badge shows correct state', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // For new tutor without profile, should not show error
    const errorBanner = page.locator('[data-test="marketplace-profile-error"]')
    await expect(errorBanner).not.toBeVisible()
    
    // After creating profile, should show draft status
    await page.waitForSelector('text=/create.*profile/i', { timeout: 5000 })
    await page.click('button:has-text("Create Profile"), button:has-text("Створити профіль")')
    
    await page.fill('input[name="headline"]', 'Math Tutor')
    await page.fill('textarea[name="bio"]', 'Experienced tutor')
    await page.fill('input[name="hourly_rate"]', '40')
    
    await page.click('button:has-text("Save"), button:has-text("Зберегти")')
    await page.waitForTimeout(2000)
    
    // Should see draft status indicator
    const statusBadge = page.locator('[data-test="profile-status-badge"], .status-badge, text=/draft|чернетка/i')
    await expect(statusBadge.first()).toBeVisible({ timeout: 5000 })
  })

  test('No infinite loading spinner on profile page', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // Loading spinner should disappear within reasonable time
    const spinner = page.locator('[data-test="loading-spinner"]')
    
    // Wait for initial load
    await page.waitForTimeout(1000)
    
    // Spinner should not be visible after loading
    await expect(spinner).not.toBeVisible({ timeout: 5000 })
    
    // Should see either create prompt or profile editor
    const content = page.locator('[data-test="marketplace-profile-editor"], text=/create.*profile/i')
    await expect(content.first()).toBeVisible()
  })

  test('Error messages are user-friendly, not technical', async ({ page }) => {
    await page.goto('/marketplace/my-profile')
    
    // Should NOT see technical error messages
    const technicalErrors = [
      'DoesNotExist',
      'NoneType',
      'AttributeError',
      'KeyError',
      '500 Internal Server Error',
      'Traceback',
      'Exception',
    ]
    
    for (const errorText of technicalErrors) {
      await expect(page.locator(`text="${errorText}"`)).not.toBeVisible()
    }
    
    // Should see user-friendly messages
    const friendlyMessages = page.locator('text=/create.*profile|welcome|get started|почат/i')
    await expect(friendlyMessages.first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Tutor Onboarding - Edge Cases', () => {
  test('Handles network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true)
    
    await page.goto('/marketplace/my-profile')
    
    // Should show network error, not crash
    await expect(page.locator('text=/network|мережа|offline|connection/i')).toBeVisible({ timeout: 10000 })
    
    // Restore connection
    await page.context().setOffline(false)
  })

  test('Handles concurrent profile edits', async ({ page, context }) => {
    // Login in first tab
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'tutor02@example.com')
    await page.fill('input[name="password"]', 'TutorTest123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/tutor\//, { timeout: 10000 })
    
    // Open second tab with same user
    const page2 = await context.newPage()
    await page2.goto('/marketplace/my-profile')
    
    // Both tabs should load without errors
    await expect(page.locator('[data-test="marketplace-profile-error"]')).not.toBeVisible()
    await expect(page2.locator('[data-test="marketplace-profile-error"]')).not.toBeVisible()
    
    await page2.close()
  })
})
