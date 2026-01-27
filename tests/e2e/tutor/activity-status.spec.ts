import { test, expect } from '@playwright/test'

test.describe('Tutor Activity Status (v0.88.2)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth as tutor
    await page.goto('/login')
    // Note: In real tests, you would login as tutor user
    // For now, we'll mock the API response
  })

  test('CASE A: Activity not required (TRIAL)', async ({ page }) => {
    // Mock API response for TRIAL user
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          is_trial: true,
          trial_ends_at: '2026-02-27T00:00:00Z',
          current_month: '2026-01',
          activity_required: false,
          required_count: 1,
          activity_count: 0,
          meets_requirement: true,
          last_activity_at: null,
          warning_message: null,
        }),
      })
    })

    await page.goto('/dashboard')
    
    // Wait for activity status block to appear
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).toBeVisible()
    
    // Check for "not required" case
    const notRequired = page.locator('[data-test="activity-not-required"]')
    await expect(notRequired).toBeVisible()
    await expect(notRequired).toContainText('Активність не потрібна')
    await expect(notRequired).toContainText('пробному періоді')
  })

  test('CASE B: Activity required but not met', async ({ page }) => {
    // Mock API response for FREE user without activity
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          is_trial: false,
          trial_ends_at: null,
          current_month: '2026-01',
          activity_required: true,
          required_count: 1,
          activity_count: 0,
          meets_requirement: false,
          last_activity_at: null,
          warning_message: 'You need to respond to at least 1 inquiry this month',
        }),
      })
    })

    await page.goto('/dashboard')
    
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).toBeVisible()
    
    // Check for "not met" case
    const notMet = page.locator('[data-test="activity-not-met"]')
    await expect(notMet).toBeVisible()
    await expect(notMet).toContainText('Потрібна активність')
    await expect(notMet).toContainText('0 / 1')
    await expect(notMet).toContainText('запитів студентів')
  })

  test('CASE C: Activity requirement met', async ({ page }) => {
    // Mock API response for FREE user with activity
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          is_trial: false,
          trial_ends_at: null,
          current_month: '2026-01',
          activity_required: true,
          required_count: 1,
          activity_count: 1,
          meets_requirement: true,
          last_activity_at: '2026-01-15T10:30:00Z',
          warning_message: null,
        }),
      })
    })

    await page.goto('/dashboard')
    
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).toBeVisible()
    
    // Check for "met" case
    const met = page.locator('[data-test="activity-met"]')
    await expect(met).toBeVisible()
    await expect(met).toContainText('Вимогу виконано')
    await expect(met).toContainText('1 / 1')
  })

  test('CASE D: Staff exemption granted', async ({ page }) => {
    // Mock API response for user with exemption
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          is_trial: false,
          trial_ends_at: null,
          current_month: '2026-01',
          activity_required: false,
          required_count: 1,
          activity_count: 0,
          meets_requirement: true,
          last_activity_at: null,
          warning_message: null,
          has_exemption: true,
        }),
      })
    })

    await page.goto('/dashboard')
    
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).toBeVisible()
    
    // Check for "exempt" case
    const exempt = page.locator('[data-test="activity-exempt"]')
    await expect(exempt).toBeVisible()
    await expect(exempt).toContainText('Звільнено від вимоги')
  })

  test('Activity status block shows current month', async ({ page }) => {
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'FREE',
          is_trial: true,
          trial_ends_at: null,
          current_month: '2026-01',
          activity_required: false,
          required_count: 1,
          activity_count: 0,
          meets_requirement: true,
          last_activity_at: null,
          warning_message: null,
        }),
      })
    })

    await page.goto('/dashboard')
    
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).toBeVisible()
    await expect(activityBlock).toContainText('2026-01')
  })

  test('Activity status does not show when API fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/v1/marketplace/tutors/me/activity-status', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      })
    })

    await page.goto('/dashboard')
    
    // Activity block should not appear on error
    const activityBlock = page.locator('[data-test="activity-status-block"]')
    await expect(activityBlock).not.toBeVisible()
  })
})
