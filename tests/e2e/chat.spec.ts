import { test, expect, Page, BrowserContext } from '@playwright/test'

/**
 * E2E Chat Flow Test
 * Simulates two users (tutor and student) exchanging messages in real-time.
 * Requires backend to be running with WebSocket support.
 */

const TUTOR_CREDENTIALS = {
  email: process.env.E2E_TUTOR_EMAIL || 'tutor@example.com',
  password: process.env.E2E_TUTOR_PASSWORD || 'password123',
}

const STUDENT_CREDENTIALS = {
  email: process.env.E2E_STUDENT_EMAIL || 'student@example.com',
  password: process.env.E2E_STUDENT_PASSWORD || 'password123',
}

const TEST_LESSON_ID = process.env.E2E_LESSON_ID || '1'

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(credentials.email)
  await page.getByLabel(/password/i).fill(credentials.password)
  await page.getByRole('button', { name: /sign in|login|увійти/i }).click()
  await page.waitForURL(/dashboard|lessons|home/i, { timeout: 15_000 })
}

async function navigateToLessonChat(page: Page, lessonId: string) {
  await page.goto(`/lessons/${lessonId}`)
  await expect(page.locator('[data-testid="chat-panel"], .chat-panel, section:has-text("chat")')).toBeVisible({
    timeout: 10_000,
  })
}

async function sendChatMessage(page: Page, text: string) {
  const textarea = page.locator('textarea[placeholder*="message"], textarea[placeholder*="повідомлення"]')
  await textarea.fill(text)
  await textarea.press('Enter')
}

async function waitForMessage(page: Page, text: string, timeout = 10_000) {
  await expect(page.locator(`text="${text}"`).first()).toBeVisible({ timeout })
}

test.describe('Realtime Chat Flow', () => {
  test.skip(
    !process.env.E2E_TUTOR_EMAIL || !process.env.E2E_STUDENT_EMAIL,
    'Skipping: E2E credentials not configured',
  )

  let tutorContext: BrowserContext
  let studentContext: BrowserContext
  let tutorPage: Page
  let studentPage: Page

  test.beforeAll(async ({ browser }) => {
    tutorContext = await browser.newContext()
    studentContext = await browser.newContext()
    tutorPage = await tutorContext.newPage()
    studentPage = await studentContext.newPage()

    await login(tutorPage, TUTOR_CREDENTIALS)
    await login(studentPage, STUDENT_CREDENTIALS)
  })

  test.afterAll(async () => {
    await tutorContext?.close()
    await studentContext?.close()
  })

  test('tutor and student can exchange messages in real-time', async () => {
    const uniqueId = Date.now()
    const tutorMessage = `Hello from tutor ${uniqueId}`
    const studentMessage = `Hello from student ${uniqueId}`

    // Both users navigate to the same lesson chat
    await Promise.all([
      navigateToLessonChat(tutorPage, TEST_LESSON_ID),
      navigateToLessonChat(studentPage, TEST_LESSON_ID),
    ])

    // Tutor sends a message
    await sendChatMessage(tutorPage, tutorMessage)

    // Tutor should see their own message immediately (optimistic)
    await waitForMessage(tutorPage, tutorMessage)

    // Student should receive the message via WebSocket
    await waitForMessage(studentPage, tutorMessage)

    // Student replies
    await sendChatMessage(studentPage, studentMessage)

    // Student should see their own message immediately
    await waitForMessage(studentPage, studentMessage)

    // Tutor should receive the student's message via WebSocket
    await waitForMessage(tutorPage, studentMessage)
  })

  test('message status transitions from sending to delivered', async () => {
    const uniqueId = Date.now()
    const testMessage = `Status test ${uniqueId}`

    await navigateToLessonChat(tutorPage, TEST_LESSON_ID)
    await sendChatMessage(tutorPage, testMessage)

    // Should show "sending" status initially (may be very brief)
    // Then transition to "delivered"
    const statusPill = tutorPage.locator('.status-pill').last()
    await expect(statusPill).toBeVisible({ timeout: 5_000 })

    // Eventually should show delivered status
    await expect(statusPill).toHaveClass(/status-pill--delivered/, { timeout: 10_000 })
  })

  test('chat reconnects and syncs history after connection drop', async () => {
    const uniqueId = Date.now()
    const preDropMessage = `Before drop ${uniqueId}`

    await navigateToLessonChat(tutorPage, TEST_LESSON_ID)
    await sendChatMessage(tutorPage, preDropMessage)
    await waitForMessage(tutorPage, preDropMessage)

    // Simulate network drop by going offline
    await tutorPage.context().setOffline(true)

    // Wait a moment
    await tutorPage.waitForTimeout(2_000)

    // Go back online
    await tutorPage.context().setOffline(false)

    // Wait for reconnection and history sync
    await tutorPage.waitForTimeout(3_000)

    // Message should still be visible after reconnect
    await waitForMessage(tutorPage, preDropMessage)
  })
})
