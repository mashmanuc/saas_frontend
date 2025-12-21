import { test, expect } from '@playwright/test'

test.describe('v0.42 Matches Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
  })

  test('student can create match with tutor', async ({ page }) => {
    await page.fill('input[type="email"]', 'student@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.waitForURL('/student')

    await page.goto('/marketplace')
    await page.click('.tutor-card:first-child')

    await page.click('button:has-text("Message")')

    await expect(page.locator('.match-detail')).toBeVisible()
  })

  test('tutor can accept match request', async ({ page }) => {
    await page.fill('input[type="email"]', 'tutor@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.waitForURL('/tutor')

    await page.goto('/matches')
    await page.click('.tab:has-text("Invitations")')

    await page.click('.match-card:first-child')
    await page.click('button:has-text("Accept")')

    await expect(page.locator('.status-badge.active')).toBeVisible()
  })

  test('messaging flow works', async ({ page }) => {
    await page.fill('input[type="email"]', 'student@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.goto('/matches/test-match-id')
    await page.click('.tab:has-text("Chat")')

    await page.fill('input[type="text"]', 'Hello, when can we start?')
    await page.click('.send-btn')

    await expect(page.locator('.message').last()).toContainText('Hello, when can we start?')
  })

  test('booking flow completes', async ({ page }) => {
    await page.fill('input[type="email"]', 'student@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.goto('/marketplace/tutors/test-tutor')
    
    await page.click('.slot:first-child')
    await page.click('button:has-text("Book Lesson")')

    await page.fill('textarea', 'Looking forward to learning!')
    await page.click('button:has-text("Confirm")')

    await expect(page.locator('.success-icon')).toBeVisible()
  })

  test('availability editor saves changes', async ({ page }) => {
    await page.fill('input[type="email"]', 'tutor@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.goto('/profile/availability')

    await page.click('button:has-text("Add Slot")')
    await page.selectOption('select', 'monday')
    await page.fill('input[type="time"]:first-child', '09:00')
    await page.fill('input[type="time"]:last-child', '10:00')

    await page.click('button:has-text("Save")')

    await expect(page.locator('.slot-row')).toBeVisible()
  })
})
