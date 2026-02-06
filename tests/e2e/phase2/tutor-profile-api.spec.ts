/**
 * E2E Tests: Tutor Profile API (Phase 2)
 * 
 * Contract: docs/STUDENT_PROFILE/API_CONTRACTS_PHASE_2.md
 * 
 * Tests:
 * - GET /api/v1/tutors/me (success, RBAC)
 * - PATCH /api/v1/tutors/me (success, validation, RBAC)
 * - Contract compliance
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/e2e/.auth/user.json' })

// Helper to get access token from page localStorage
async function getAccessToken(page: any) {
  return await page.evaluate(() => localStorage.getItem('access'))
}

test.describe('Tutor Profile API (Phase 2)', () => {

  test('GET /api/v1/tutors/me - success (200)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const response = await page.request.get('/api/v1/tutors/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    
    // Verify User fields
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('email')
    expect(data).toHaveProperty('username')
    expect(data).toHaveProperty('first_name')
    expect(data).toHaveProperty('last_name')
    expect(data).toHaveProperty('phone')
    expect(data).toHaveProperty('timezone')
    expect(data).toHaveProperty('role')
    expect(data.role).toBe('tutor')
    
    // Verify TutorProfile fields
    expect(data).toHaveProperty('headline')
    expect(data).toHaveProperty('bio')
    expect(data).toHaveProperty('subjects')
    expect(data).toHaveProperty('certifications')
    expect(data).toHaveProperty('hourly_rate')
    expect(data).toHaveProperty('experience_years')
    expect(data).toHaveProperty('is_published')
    
    // Verify types
    expect(Array.isArray(data.subjects)).toBe(true)
    expect(Array.isArray(data.certifications)).toBe(true)
    expect(typeof data.is_published).toBe('boolean')
  })

  test('PATCH /api/v1/tutors/me - success (200)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const payload = {
      first_name: 'Updated',
      headline: 'Updated Headline',
      hourly_rate: 400,
      subjects: ['Math', 'Physics', 'Chemistry']
    }
    
    const response = await page.request.patch('/api/v1/tutors/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: payload
    })
    
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    
    expect(data.first_name).toBe('Updated')
    expect(data.headline).toBe('Updated Headline')
    expect(data.hourly_rate).toBe(400)
    expect(data.subjects).toEqual(['Math', 'Physics', 'Chemistry'])
  })

  test('PATCH /api/v1/tutors/me - validation error (400)', async ({ page }) => {
    await page.goto('/')
    const token = await getAccessToken(page)
    
    const payload = {
      phone: 'invalid-phone',
      hourly_rate: -100
    }
    
    const response = await page.request.patch('/api/v1/tutors/me', {
      headers: { Authorization: `Bearer ${token}` },
      data: payload
    })
    
    expect(response.status()).toBe(400)
    
    const data = await response.json()
    
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('validation_error')
    expect(data).toHaveProperty('field_errors')
  })

  test('GET /api/v1/tutors/me - forbidden for student (403)', async ({ request }) => {
    // Login as student via API
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: 's5@gmail.com',
        password: 'password'
      }
    })
    
    const { access } = await loginResponse.json()
    
    const response = await request.get('/api/v1/tutors/me', {
      headers: { Authorization: `Bearer ${access}` }
    })
    
    expect(response.status()).toBe(403)
    
    const data = await response.json()
    
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('not_tutor')
  })

  test('PATCH /api/v1/tutors/me - forbidden for student (403)', async ({ request }) => {
    // Login as student via API
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: 's5@gmail.com',
        password: 'password'
      }
    })
    
    const { access } = await loginResponse.json()
    
    const response = await request.patch('/api/v1/tutors/me', {
      headers: { Authorization: `Bearer ${access}` },
      data: { first_name: 'Test' }
    })
    
    expect(response.status()).toBe(403)
  })

  test('GET /api/v1/tutors/me - unauthorized (401)', async ({ request }) => {
    const response = await request.get('/api/v1/tutors/me')
    
    expect(response.status()).toBe(401)
  })
})
