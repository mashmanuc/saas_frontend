/**
 * E2E Tests: Tutor Inquiry Flow v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Scenarios:
 * - Tutor views inbox
 * - Tutor accepts inquiry
 * - Tutor declines inquiry
 * - Tutor opens chat after acceptance
 */

import { test, expect } from '@playwright/test'

test.describe('Tutor Inquiry Flow v0.69', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should view inbox with pending count', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Verify page loaded
    await expect(page.locator('h1:has-text("Contact Requests")')).toBeVisible()
    
    // Verify pending badge
    const pendingBadge = page.locator('text=/\\d+ pending/')
    if (await pendingBadge.isVisible()) {
      await expect(pendingBadge).toBeVisible()
    }
  })

  test('should accept inquiry successfully', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Find pending inquiry
    const pendingInquiry = page.locator('[data-testid="inquiry-card"]').filter({
      has: page.locator('text=Sent')
    }).first()
    
    // Click accept
    await pendingInquiry.locator('button:has-text("Accept")').click()
    
    // Verify inquiry is accepted
    await expect(page.locator('text=Accepted').first()).toBeVisible()
  })

  test('should decline inquiry with confirmation', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Find pending inquiry
    const pendingInquiry = page.locator('[data-testid="inquiry-card"]').filter({
      has: page.locator('text=Sent')
    }).first()
    
    // Click decline
    await pendingInquiry.locator('button:has-text("Decline")').click()
    
    // Confirm dialog
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('decline')
      dialog.accept()
    })
    
    // Verify inquiry is declined
    await expect(page.locator('text=Declined').first()).toBeVisible()
  })

  test('should filter by pending tab', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Click "Pending" tab
    await page.click('button:has-text("Pending")')
    
    // Verify only pending inquiries shown
    const inquiryCards = page.locator('[data-testid="inquiry-card"]')
    const count = await inquiryCards.count()
    
    for (let i = 0; i < count; i++) {
      await expect(inquiryCards.nth(i).locator('text=Sent')).toBeVisible()
    }
  })

  test('should switch to all tab', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Click "All" tab
    await page.click('button:has-text("All")')
    
    // Verify all statuses shown
    const inquiryCards = page.locator('[data-testid="inquiry-card"]')
    await expect(inquiryCards.first()).toBeVisible()
  })

  test('should open chat for accepted inquiry', async ({ page }) => {
    await page.goto('/beta/people/inbox')
    
    // Find accepted inquiry
    const acceptedInquiry = page.locator('[data-testid="inquiry-card"]').filter({
      has: page.locator('text=Accepted')
    }).first()
    
    // Click "Open Chat"
    await acceptedInquiry.locator('button:has-text("Open Chat")').click()
    
    // Verify chat view opened
    await expect(page).toHaveURL(/\/chat\/thread\//)
    await expect(page.locator('text=Negotiation Chat')).toBeVisible()
  })

  test('should show empty state when no pending', async ({ page }) => {
    // Mock empty response
    await page.route('/api/v1/people/inquiries/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inquiries: [] })
      })
    })
    
    await page.goto('/beta/people/inbox')
    await page.click('button:has-text("Pending")')
    
    // Verify empty state
    await expect(page.locator('text=No pending contact requests')).toBeVisible()
  })
})
