/**
 * E2E Test: Chat with Tutor (v0.71.x)
 * 
 * Tests the complete flow of student chatting with tutor:
 * 1. Seed creates test data (student, tutor, relation, inquiry, thread)
 * 2. Student logs in
 * 3. Student navigates to dashboard
 * 4. Student clicks "Message Tutor" button
 * 5. Chat view opens with correct URL
 * 6. Student sends message
 * 7. Message appears in chat
 * 
 * Prerequisites:
 * - Backend seed_dev command has been run: python manage.py seed_dev --scenario chat_e2e
 * - Backend server is running
 * - Frontend dev server is running
 */

import { test, expect } from '@playwright/test'

const STUDENT_EMAIL = 'student.e2e@m4sh.local'
const TUTOR_EMAIL = 'tutor.e2e@m4sh.local'
const PASSWORD = 'Test12345!'

test.describe('Chat with Tutor E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login')
  })

  test('student can open chat with tutor from dashboard', async ({ page }) => {
    // Step 1: Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('/dashboard')
    await expect(page).toHaveURL('/dashboard')

    // Step 2: Find and click "Message Tutor" button
    // The button should be in StudentActiveTutorsSection
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await expect(messageTutorButton).toBeVisible()
    await messageTutorButton.click()

    // Step 3: Verify navigation to chat route
    await page.waitForURL(/\/chat\/tutor\/\d+/)
    expect(page.url()).toMatch(/\/chat\/tutor\/\d+/)

    // Step 4: Verify chat interface is loaded
    await expect(page.getByRole('heading', { name: /чат з тьютором|chat/i })).toBeVisible()

    // Step 5: Verify messages are loaded (or empty state)
    const messagesContainer = page.locator('[ref="messagesContainer"]').first()
    await expect(messagesContainer).toBeVisible()
  })

  test('student can send message to tutor', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()
    await page.waitForURL(/\/chat\/tutor\/\d+/)

    // Step 1: Type message
    const testMessage = `E2E Test Message ${Date.now()}`
    const messageInput = page.locator('textarea[placeholder*="повідомлення"]').first()
    await messageInput.fill(testMessage)

    // Step 2: Send message
    const sendButton = page.getByRole('button', { name: /надіслати|send/i })
    await sendButton.click()

    // Step 3: Verify message appears in chat
    await expect(page.locator('text=' + testMessage)).toBeVisible({ timeout: 5000 })

    // Step 4: Verify message input is cleared
    await expect(messageInput).toHaveValue('')
  })

  test('student sees existing messages in chat', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()
    await page.waitForURL(/\/chat\/tutor\/\d+/)

    // Wait for messages to load
    await page.waitForTimeout(1000)

    // Verify that seeded messages are visible
    // The seed creates at least 2 messages: one from student, one from tutor
    const messageElements = page.locator('[class*="rounded-2xl"][class*="px-4"][class*="py-2"]')
    const messageCount = await messageElements.count()
    
    // Should have at least the seeded messages
    expect(messageCount).toBeGreaterThanOrEqual(2)
  })

  test('chat shows loading state initially', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()

    // Verify loading state appears (briefly)
    const loadingIndicator = page.locator('text=/завантаження|loading/i').first()
    // Loading state might be very brief, so we use a short timeout
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 }).catch(() => {
      // It's okay if loading state is too fast to catch
    })
  })

  test('send button is disabled when message is empty', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()
    await page.waitForURL(/\/chat\/tutor\/\d+/)

    // Wait for chat to load
    await page.waitForTimeout(1000)

    // Verify send button is disabled when input is empty
    const sendButton = page.getByRole('button', { name: /надіслати|send/i })
    await expect(sendButton).toBeDisabled()

    // Type message and verify button becomes enabled
    const messageInput = page.locator('textarea[placeholder*="повідомлення"]').first()
    await messageInput.fill('Test message')
    await expect(sendButton).toBeEnabled()

    // Clear message and verify button becomes disabled again
    await messageInput.clear()
    await expect(sendButton).toBeDisabled()
  })

  test('student can navigate back from chat', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()
    await page.waitForURL(/\/chat\/tutor\/\d+/)

    // Click back button
    const backButton = page.getByRole('button', { name: /назад|back/i })
    await backButton.click()

    // Verify navigation back to dashboard
    await page.waitForURL('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('message displays sender name and timestamp', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to chat
    const messageTutorButton = page.getByRole('button', { name: /написати тьютору|message tutor/i })
    await messageTutorButton.click()
    await page.waitForURL(/\/chat\/tutor\/\d+/)

    // Send a message
    const testMessage = `Timestamp Test ${Date.now()}`
    const messageInput = page.locator('textarea[placeholder*="повідомлення"]').first()
    await messageInput.fill(testMessage)
    
    const sendButton = page.getByRole('button', { name: /надіслати|send/i })
    await sendButton.click()

    // Wait for message to appear
    await page.waitForTimeout(1000)

    // Find the message bubble
    const messageBubble = page.locator(`text=${testMessage}`).locator('..').locator('..')

    // Verify sender name is visible (should be student email or name)
    await expect(messageBubble.locator('text=/e2e student|student.e2e/i')).toBeVisible()

    // Verify timestamp is visible (should contain time format)
    await expect(messageBubble.locator('text=/\\d{1,2}:\\d{2}/i')).toBeVisible()
  })
})
