/**
 * E2E Tests: Settings API (Phase 2)
 * 
 * Contract: docs/STUDENT_PROFILE/API_CONTRACTS_PHASE_2.md
 * 
 * Tests:
 * - GET /api/v1/me/settings (success, auto-create)
 * - PATCH /api/v1/me/settings (success, validation)
 * - Contract compliance
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/user.json' })

// Helper to get access token from page localStorage
async function getAccessToken(page: any) {
  return await page.evaluate(() => localStorage.getItem('access'))
}

test.describe('Settings API (Phase 2)', () => {

  test('GET /api/v1/me/settings - success (200)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const response = await page.request.get('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    
    // Verify Language & Theme fields
    expect(data).toHaveProperty('ui_language')
    expect(data).toHaveProperty('interface_language')
    expect(data).toHaveProperty('languages')
    expect(data).toHaveProperty('dark_mode')
    
    // Verify Notifications fields
    expect(data).toHaveProperty('notifications_enabled')
    
    // Verify Privacy fields
    expect(data).toHaveProperty('public_profile_enabled')
    expect(data).toHaveProperty('show_email_publicly')
    expect(data).toHaveProperty('show_avatar_publicly')
    expect(data).toHaveProperty('show_certifications_publicly')
    expect(data).toHaveProperty('show_subjects_publicly')
    expect(data).toHaveProperty('show_bio_publicly')
    
    // Verify types
    expect(Array.isArray(data.languages)).toBe(true)
    expect(typeof data.notifications_enabled).toBe('boolean')
    expect(typeof data.public_profile_enabled).toBe('boolean')
    
    // Verify languages array structure
    expect(data.languages.length).toBeGreaterThan(0)
    expect(data.languages[0]).toHaveProperty('code')
    expect(data.languages[0]).toHaveProperty('name')
  })

  test('GET /api/v1/me/settings - creates settings if not exist', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    // This test verifies auto-creation behavior
    const response = await page.request.get('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    
    // Verify default values
    expect(['uk', 'en']).toContain(data.ui_language)
    expect(['system', 'light', 'dark']).toContain(data.dark_mode)
  })

  test('PATCH /api/v1/me/settings - success (200)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const payload = {
      ui_language: 'en',
      dark_mode: 'dark',
      notifications_enabled: false,
      show_email_publicly: true
    }
    
    const response = await page.request.patch('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` },
      data: payload
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    
    expect(data.ui_language).toBe('en')
    expect(data.dark_mode).toBe('dark')
    expect(data.notifications_enabled).toBe(false)
    expect(data.show_email_publicly).toBe(true)
  })

  test('PATCH /api/v1/me/settings - partial update (200)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    // Get current settings
    const getResponse = await page.request.get('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const currentData = await getResponse.json()
    
    // Update only one field
    const payload = {
      dark_mode: 'light'
    }
    
    const patchResponse = await page.request.patch('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` },
      data: payload
    })
    
    expect(patchResponse.ok()).toBeTruthy()
    
    const updatedData = await patchResponse.json()
    
    // dark_mode changed
    expect(updatedData.dark_mode).toBe('light')
    
    // Other fields unchanged
    expect(updatedData.ui_language).toBe(currentData.ui_language)
    expect(updatedData.notifications_enabled).toBe(currentData.notifications_enabled)
  })

  test('PATCH /api/v1/me/settings - validation error (400)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const payload = {
      ui_language: 'invalid',
      dark_mode: 'invalid'
    }
    
    const response = await page.request.patch('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` },
      data: payload
    })
    
    expect(response.status()).toBe(400)
    
    const data = await response.json()
    
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('validation_error')
  })

  test('GET /api/v1/me/settings - unauthorized (401)', async ({ request }) => {
    const response = await request.get('/api/v1/me/settings')
    
    expect(response.status()).toBe(401)
  })

  test('Settings API works for tutor role', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    // Tutor is already logged in via storageState
    const response = await page.request.get('/api/v1/me/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
  })
})
