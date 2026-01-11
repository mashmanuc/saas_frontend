/**
 * E2E Tests: Student Inquiry Flow v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Scenarios:
 * - Student creates inquiry
 * - Student views inquiry list
 * - Student cancels inquiry
 * - Student opens chat after acceptance
 */

import { test, expect } from '@playwright/test'

test.describe('Student Inquiry Flow v0.69', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'student@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should create inquiry successfully', async ({ page }) => {
    // Navigate to tutor profile
    await page.goto('/marketplace/tutors/jane-smith')
    
    // Click "Contact" button
    await page.click('button:has-text("Contact")')
    
    // Fill inquiry modal
    await expect(page.locator('text=Send Contact Request')).toBeVisible()
    await page.fill('textarea[id="message"]', 'Hello, I would like to learn mathematics')
    
    // Submit
    await page.click('button:has-text("Send Request")')
    
    // Verify success
    await expect(page.locator('text=Request sent successfully')).toBeVisible()
  })

  test('should view inquiry list', async ({ page }) => {
    await page.goto('/beta/people')
    
    // Verify page loaded
    await expect(page.locator('h1:has-text("My Contact Requests")')).toBeVisible()
    
    // Verify inquiry cards are displayed
    const inquiryCards = page.locator('[data-testid="inquiry-card"]')
    await expect(inquiryCards.first()).toBeVisible()
  })

  test('should cancel pending inquiry', async ({ page }) => {
    await page.goto('/beta/people')
    
    // Find pending inquiry
    const pendingInquiry = page.locator('[data-testid="inquiry-card"]').filter({
      has: page.locator('text=Sent')
    }).first()
    
    // Click cancel
    await pendingInquiry.locator('button:has-text("Cancel")').click()
    
    // Confirm dialog
    page.on('dialog', dialog => dialog.accept())
    
    // Verify inquiry is cancelled
    await expect(pendingInquiry.locator('text=Cancelled')).toBeVisible()
  })

  test('should open chat for accepted inquiry', async ({ page }) => {
    await page.goto('/beta/people')
    
    // Find accepted inquiry
    const acceptedInquiry = page.locator('[data-testid="inquiry-card"]').filter({
      has: page.locator('text=Accepted')
    }).first()
    
    // Click "Open Chat"
    await acceptedInquiry.locator('button:has-text("Open Chat")').click()
    
    // Verify chat view opened
    await expect(page).toHaveURL(/\/chat\/thread\//)
    await expect(page.locator('h1')).toContainText('Jane Smith')
  })

  test('should handle limit_exceeded error gracefully', async ({ page }) => {
    // Mock API to return limit_exceeded
    await page.route('/api/v1/people/inquiries/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'limit_exceeded',
            resetAt: new Date(Date.now() + 3600000).toISOString(),
            limitType: 'daily_inquiries'
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/marketplace/tutors/jane-smith')
    await page.click('button:has-text("Contact")')
    await page.fill('textarea[id="message"]', 'Hello')
    await page.click('button:has-text("Send Request")')
    
    // Verify error message (no upgrade CTA per v0.69 spec)
    await expect(page.locator('text=limit exceeded')).toBeVisible()
    await expect(page.locator('text=upgrade')).not.toBeVisible()
  })

  test('should validate message min length', async ({ page }) => {
    await page.goto('/marketplace/tutors/jane-smith')
    await page.click('button:has-text("Contact")')
    
    // Try to submit empty message
    await page.click('button:has-text("Send Request")')
    
    // Verify validation error
    await expect(page.locator('text=Message must be at least 1 character')).toBeVisible()
  })
})
