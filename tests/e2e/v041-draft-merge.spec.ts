import { test, expect } from '@playwright/test'

test.describe('v0.41 Draft Merge Flow', () => {
  test('should handle draft conflict with field diff', async ({ page }) => {
    await page.goto('/dashboard/marketplace/profile/edit')
    
    // Edit profile
    await page.fill('input[name="title"]', 'Updated Title')
    
    // Mock 409 conflict response
    await page.route('**/api/v1/marketplace/me/profile/draft', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 409,
          json: {
            conflict: true,
            conflict_fields: ['title', 'bio'],
            server_payload: { title: 'Server Title', bio: 'Server Bio' },
            client_payload: { title: 'Updated Title', bio: 'Client Bio' },
            server_rev: 5,
          },
        })
      }
    })
    
    await page.click('button:has-text("Save")')
    
    // Should show conflict modal
    await expect(page.locator('text=Conflict Detected')).toBeVisible({ timeout: 5000 })
    
    // Should show field diff
    await expect(page.locator('text=title')).toBeVisible()
    await expect(page.locator('text=Server Title')).toBeVisible()
    await expect(page.locator('text=Updated Title')).toBeVisible()
    
    // Choose smart merge
    await page.click('button:has-text("Smart Merge")')
    
    // Should show merge confirmation
    await expect(page.locator('text=Merge Confirmation')).toBeVisible({ timeout: 5000 })
  })

  test('should handle merge confirmation with retry', async ({ page }) => {
    await page.goto('/dashboard/marketplace/profile/edit')
    
    // Trigger merge confirmation modal
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('show-merge-confirmation', {
        detail: {
          mergedFields: [
            { name: 'title', oldValue: 'Old', newValue: 'New' },
          ],
        },
      }))
    })
    
    // Mock error response
    await page.route('**/api/v1/marketplace/me/profile/draft/resolve', async route => {
      await route.fulfill({
        status: 500,
        json: {
          error: 'merge_failed',
          message: 'Merge operation failed',
          request_id: 'req_123',
        },
      })
    })
    
    await page.click('button:has-text("Confirm")')
    
    // Should show error with request_id
    await expect(page.locator('text=Request ID: req_123')).toBeVisible({ timeout: 5000 })
    
    // Should show retry button
    await expect(page.locator('button:has-text("Retry")')).toBeVisible()
  })

  test('should show publish guard when out of sync', async ({ page }) => {
    await page.goto('/dashboard/marketplace/profile/edit')
    
    // Mock publish guard trigger
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('show-publish-guard'))
    })
    
    // Should show publish guard modal
    await expect(page.locator('text=Publish Guard')).toBeVisible({ timeout: 5000 })
    
    // Should show sync button
    await expect(page.locator('button:has-text("Sync Now")')).toBeVisible()
  })
})
