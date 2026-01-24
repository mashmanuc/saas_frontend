/**
 * Inquiry Flow E2E Tests (Phase 1 v0.86)
 * 
 * Smoke tests для основного inquiry flow
 */

import { test, expect } from '@playwright/test'

test.describe('Inquiry Flow - Student', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/student/dashboard')
  })

  test('should display empty state when no inquiries', async ({ page }) => {
    await page.goto('/student/inquiries')
    
    await expect(page.locator('.empty-state')).toBeVisible()
    await expect(page.locator('.empty-state-title')).toContainText('немає запитів')
  })

  test('should open inquiry form modal on tutor profile', async ({ page }) => {
    await page.goto('/marketplace/tutors/1')
    
    await page.click('[data-testid="send-inquiry-button"]')
    
    await expect(page.locator('.modal-container')).toBeVisible()
    await expect(page.locator('.modal-header h2')).toContainText('Надіслати запит')
  })

  test('should validate inquiry form fields', async ({ page }) => {
    await page.goto('/marketplace/tutors/1')
    await page.click('[data-testid="send-inquiry-button"]')
    
    // Try to submit without filling required fields
    await page.click('button[type="submit"]')
    
    // Form should not submit (button disabled or validation error)
    await expect(page.locator('.modal-container')).toBeVisible()
  })

  test('should cancel inquiry successfully', async ({ page }) => {
    await page.goto('/student/inquiries')
    
    // Assume there's at least one OPEN inquiry
    const cancelButton = page.locator('[data-testid="cancel-inquiry-button"]').first()
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
      
      // Wait for refetch
      await page.waitForTimeout(1000)
      
      // Inquiry should be removed or status changed
      await expect(page.locator('.inquiry-card').first()).not.toHaveClass(/status-open/)
    }
  })
})

test.describe('Inquiry Flow - Tutor', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'tutor@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/tutor/dashboard')
  })

  test('should display inquiries inbox', async ({ page }) => {
    await page.goto('/tutor/inquiries')
    
    // Should show either inquiries or empty state
    const hasInquiries = await page.locator('.inquiry-card').count() > 0
    const hasEmptyState = await page.locator('.empty-state').isVisible()
    
    expect(hasInquiries || hasEmptyState).toBeTruthy()
  })

  test('should accept inquiry and show contacts', async ({ page }) => {
    await page.goto('/tutor/inquiries')
    
    const acceptButton = page.locator('[data-testid="accept-inquiry-button"]').first()
    if (await acceptButton.isVisible()) {
      await acceptButton.click()
      
      // Wait for API call
      await page.waitForTimeout(1000)
      
      // Contacts modal should appear
      await expect(page.locator('.modal-container')).toBeVisible()
      await expect(page.locator('.contacts-display')).toBeVisible()
      await expect(page.locator('.contact-item')).toHaveCount(3) // email, phone, telegram
    }
  })

  test('should open reject modal with reason selection', async ({ page }) => {
    await page.goto('/tutor/inquiries')
    
    const rejectButton = page.locator('[data-testid="reject-inquiry-button"]').first()
    if (await rejectButton.isVisible()) {
      await rejectButton.click()
      
      // Reject modal should appear
      await expect(page.locator('.modal-container')).toBeVisible()
      await expect(page.locator('select#reason')).toBeVisible()
      
      // Select reason
      await page.selectOption('select#reason', 'BUSY')
      
      // Submit button should be enabled
      await expect(page.locator('button[type="submit"]')).toBeEnabled()
    }
  })

  test('should require comment when reason is OTHER', async ({ page }) => {
    await page.goto('/tutor/inquiries')
    
    const rejectButton = page.locator('[data-testid="reject-inquiry-button"]').first()
    if (await rejectButton.isVisible()) {
      await rejectButton.click()
      
      // Select OTHER reason
      await page.selectOption('select#reason', 'OTHER')
      
      // Comment field should appear
      await expect(page.locator('textarea#comment')).toBeVisible()
      
      // Submit button should be disabled without comment
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    }
  })
})

test.describe('Error Handling', () => {
  test('should show rate limit error (429)', async ({ page, context }) => {
    // Mock 429 response
    await context.route('**/api/v1/inquiries/**', route => {
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '60' },
        body: JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED' })
      })
    })
    
    await page.goto('/student/inquiries')
    
    // Should show rate limit error
    await expect(page.locator('.error-state.rate-limit')).toBeVisible()
    await expect(page.locator('.retry-info')).toContainText('60')
  })

  test('should show unauthorized error (401)', async ({ page, context }) => {
    // Mock 401 response
    await context.route('**/api/v1/inquiries/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'UNAUTHORIZED' })
      })
    })
    
    await page.goto('/student/inquiries')
    
    // Should show unauthorized error
    await expect(page.locator('.error-state.unauthorized')).toBeVisible()
  })
})
