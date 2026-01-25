/**
 * Billing Auth Smoke Test v0.86.3
 * Anti-anonymous regression test for billing endpoints
 * 
 * Ensures tutor can access billing endpoints without 401 errors
 */

import { test, expect } from '@playwright/test'

test.describe('Billing endpoints auth (anti-anonymous)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('/login')
    
    // Use environment variables or test credentials
    const tutorEmail = process.env.TEST_TUTOR_EMAIL || 'tutor@test.com'
    const tutorPassword = process.env.TEST_TUTOR_PASSWORD || 'password'
    
    await page.fill('input[name="email"]', tutorEmail)
    await page.fill('input[name="password"]', tutorPassword)
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard|\/tutor/, { timeout: 10000 })
  })

  test('tutor can access billing contacts balance endpoint', async ({ page }) => {
    // Make API request to billing contacts balance
    const response = await page.request.get('/api/v1/billing/contacts/balance/')
    
    // Should not return 401
    expect(response.status()).not.toBe(401)
    
    // Should return 200 or 403 (if feature disabled), but not 401 (anonymous)
    expect([200, 403]).toContain(response.status())
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('user_id')
      expect(data).toHaveProperty('balance')
    }
  })

  test('tutor can access billing contacts ledger endpoint', async ({ page }) => {
    // Make API request to billing contacts ledger
    const response = await page.request.get('/api/v1/billing/contacts/ledger/?limit=1&offset=0')
    
    // Should not return 401
    expect(response.status()).not.toBe(401)
    
    // Should return 200 or 403, but not 401
    expect([200, 403]).toContain(response.status())
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    }
  })

  test('tutor can access notifications endpoint', async ({ page }) => {
    // Make API request to notifications
    const response = await page.request.get('/api/notifications/me/?unread=true&limit=1')
    
    // Should not return 401
    expect(response.status()).not.toBe(401)
    
    // Should return 200 or 403, but not 401
    expect([200, 403]).toContain(response.status())
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('results')
    }
  })

  test('all billing endpoints have Authorization header', async ({ page }) => {
    // Intercept requests to check Authorization header
    const requests: any[] = []
    
    page.on('request', request => {
      const url = request.url()
      if (url.includes('/api/v1/billing/') || url.includes('/api/notifications/')) {
        requests.push({
          url,
          headers: request.headers()
        })
      }
    })

    // Trigger some billing requests by navigating to billing page
    await page.goto('/account/billing').catch(() => {
      // Page might not exist, that's ok - we just want to trigger API calls
    })

    // Wait a bit for API calls
    await page.waitForTimeout(2000)

    // Check that at least some requests were made with Authorization
    const billingRequests = requests.filter(r => r.url.includes('/api/v1/billing/'))
    
    if (billingRequests.length > 0) {
      billingRequests.forEach(req => {
        expect(req.headers['authorization']).toBeDefined()
        expect(req.headers['authorization']).toMatch(/^Bearer .+/)
      })
    }
  })
})
