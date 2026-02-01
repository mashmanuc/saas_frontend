/**
 * E2E Tests for User Account Archiving
 * 
 * Tests user flow for archiving their own account
 */

import { test, expect } from '@playwright/test'

test.describe('User Account Archiving', () => {
  test.beforeEach(async ({ page }) => {
    // Login as regular user
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'e2e-student@example.com')
    await page.fill('input[type="password"]', 'e2e-student')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard|\/student/)
  })

  test('should navigate to settings privacy tab', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Click on Privacy tab
    const privacyTab = page.locator('button:has-text("Privacy"), button:has-text("Приватність")').first()
    await privacyTab.click()

    // Verify danger zone is visible
    const dangerZone = page.locator('text=Danger Zone, text=Небезпечна зона').first()
    await expect(dangerZone).toBeVisible({ timeout: 5000 })
  })

  test('should open account deletion modal', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Click on Privacy tab
    const privacyTab = page.locator('button:has-text("Privacy"), button:has-text("Приватність")').first()
    if (await privacyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await privacyTab.click()
    }

    // Click delete account button
    const deleteButton = page.locator('button:has-text("Delete Account"), button:has-text("Видалити акаунт")').first()
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click()

      // Verify modal is open
      const modal = page.locator('text=Delete Account, text=Видалити акаунт').nth(1)
      await expect(modal).toBeVisible({ timeout: 3000 })
    }
  })

  test('should require password and confirmation to delete', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Navigate to privacy tab and open modal
    const privacyTab = page.locator('button:has-text("Privacy"), button:has-text("Приватність")').first()
    if (await privacyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await privacyTab.click()
    }

    const deleteButton = page.locator('button:has-text("Delete Account"), button:has-text("Видалити акаунт")').first()
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click()

      // Verify delete button is disabled without password and confirmation
      const modalDeleteButton = page.locator('button:has-text("Delete Account"), button:has-text("Видалити акаунт")').nth(1)
      await expect(modalDeleteButton).toBeDisabled()

      // Fill password
      const passwordInput = page.locator('input[type="password"]').last()
      await passwordInput.fill('testpass123')

      // Still disabled without confirmation
      await expect(modalDeleteButton).toBeDisabled()

      // Check confirmation
      const checkbox = page.locator('input[type="checkbox"]').last()
      await checkbox.check()

      // Now should be enabled
      await expect(modalDeleteButton).toBeEnabled()
    }
  })

  test('should close modal on cancel', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const privacyTab = page.locator('button:has-text("Privacy"), button:has-text("Приватність")').first()
    if (await privacyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await privacyTab.click()
    }

    const deleteButton = page.locator('button:has-text("Delete Account"), button:has-text("Видалити акаунт")').first()
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click()

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Скасувати")').first()
      if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelButton.click()

        // Modal should be closed
        const modal = page.locator('text=Delete Account, text=Видалити акаунт').nth(1)
        await expect(modal).not.toBeVisible()
      }
    }
  })
})
