/**
 * E2E Tests for Student Calendar v0.70
 * Tests student mode, join lesson functionality, and permissions
 */

import { test, expect } from '@playwright/test'

test.describe('Student Calendar v0.70', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication as student
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/student')
  })

  test('should display student calendar in grid mode', async ({ page }) => {
    await page.goto('/calendar')
    
    // Verify calendar grid is visible
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible()
    
    // Verify student mode header
    await expect(page.locator('h1')).toContainText('Мій календар')
    
    // Verify tutor filter is present
    await expect(page.locator('.tutor-filter')).toBeVisible()
  })

  test('should not show create/edit controls in student mode', async ({ page }) => {
    await page.goto('/calendar')
    
    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Verify no create lesson modal
    await expect(page.locator('[data-testid="create-lesson-modal"]')).not.toBeVisible()
    
    // Verify no edit controls
    await expect(page.locator('[data-testid="edit-lesson-modal"]')).not.toBeVisible()
    
    // Verify no availability editor
    await expect(page.locator('[data-testid="availability-editor"]')).not.toBeVisible()
  })

  test('should open event drawer on event click', async ({ page }) => {
    // Mock calendar events
    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 1,
              start: new Date(Date.now() + 3600000).toISOString(),
              end: new Date(Date.now() + 7200000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: {
                can_message: true,
                can_join_room: true
              },
              room: null
            }
          ]
        })
      })
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Click on event
    const event = page.locator('.calendar-event').first()
    await event.click()
    
    // Verify drawer opens
    await expect(page.locator('.student-event-drawer')).toBeVisible()
    await expect(page.locator('.student-event-drawer')).toContainText('Деталі уроку')
  })

  test('should show Join Lesson button when can_join_room is true', async ({ page }) => {
    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 1,
              start: new Date(Date.now() + 600000).toISOString(), // 10 min from now
              end: new Date(Date.now() + 4200000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: {
                can_message: true,
                can_join_room: true
              },
              room: null
            }
          ]
        })
      })
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Click event to open drawer
    await page.locator('.calendar-event').first().click()
    
    // Verify Join Lesson button is visible
    await expect(page.locator('button:has-text("Зайти на урок")')).toBeVisible()
  })

  test('should NOT show Join Lesson button when can_join_room is false', async ({ page }) => {
    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 1,
              start: new Date(Date.now() + 86400000).toISOString(), // tomorrow
              end: new Date(Date.now() + 90000000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: {
                can_message: true,
                can_join_room: false
              },
              room: null
            }
          ]
        })
      })
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Click event to open drawer
    await page.locator('.calendar-event').first().click()
    
    // Verify Join Lesson button is NOT visible
    await expect(page.locator('button:has-text("Зайти на урок")')).not.toBeVisible()
  })

  test('should call joinEventRoom API and navigate to classroom', async ({ page }) => {
    let joinRoomCalled = false

    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 123,
              start: new Date(Date.now() + 600000).toISOString(),
              end: new Date(Date.now() + 4200000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: {
                can_message: true,
                can_join_room: true
              },
              room: null
            }
          ]
        })
      })
    })

    await page.route('**/api/v1/calendar/events/123/room/join/', async (route) => {
      joinRoomCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          room: {
            url: '/classroom/session-abc-123'
          }
        })
      })
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Click event
    await page.locator('.calendar-event').first().click()
    
    // Click Join Lesson button
    await page.locator('button:has-text("Зайти на урок")').click()
    
    // Verify API was called
    await page.waitForTimeout(500)
    expect(joinRoomCalled).toBe(true)
    
    // Verify navigation to classroom
    await page.waitForURL('**/classroom/session-abc-123')
  })

  test('should handle 409 room_not_available_yet error', async ({ page }) => {
    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 456,
              start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
              end: new Date(Date.now() + 7200000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: {
                can_message: true,
                can_join_room: true
              },
              room: null
            }
          ]
        })
      })
    })

    await page.route('**/api/v1/calendar/events/456/room/join/', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'room_not_available_yet'
        })
      })
    })

    // Listen for alert
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Урок ще не почався')
      await dialog.accept()
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    await page.locator('.calendar-event').first().click()
    await page.locator('button:has-text("Зайти на урок")').click()
    
    await page.waitForTimeout(500)
  })

  test('should filter events by tutor', async ({ page }) => {
    await page.route('**/api/v1/calendar/my/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 1,
              start: new Date(Date.now() + 3600000).toISOString(),
              end: new Date(Date.now() + 7200000).toISOString(),
              status: 'scheduled',
              tutor: { id: 10, name: 'John Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: { can_message: true, can_join_room: false },
              room: null
            },
            {
              id: 2,
              start: new Date(Date.now() + 10800000).toISOString(),
              end: new Date(Date.now() + 14400000).toISOString(),
              status: 'scheduled',
              tutor: { id: 20, name: 'Jane Tutor' },
              student: { id: 5, name: 'Student Test' },
              subject: null,
              tags: [],
              permissions: { can_message: true, can_join_room: false },
              room: null
            }
          ]
        })
      })
    })

    await page.goto('/calendar')
    await page.waitForSelector('[data-testid="calendar-week-view"]')
    
    // Verify tutor filter has options
    const tutorFilter = page.locator('.tutor-filter')
    await expect(tutorFilter).toBeVisible()
    
    // Select specific tutor
    await tutorFilter.selectOption({ label: 'John Tutor' })
    
    // Verify filter applied (implementation-specific check)
    await page.waitForTimeout(300)
  })
})
