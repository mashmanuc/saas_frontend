/**
 * E2E Tests: Negotiation Chat Flow v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Scenarios:
 * - Send message in active thread
 * - View message history
 * - Handle read-only thread
 * - Optimistic updates
 */

import { test, expect } from '@playwright/test'

test.describe('Negotiation Chat Flow v0.69', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'student@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should send message successfully', async ({ page }) => {
    // Navigate to chat thread
    await page.goto('/chat/thread/thread_123')
    
    // Wait for messages to load
    await page.waitForSelector('textarea[placeholder*="Type a message"]')
    
    // Type message
    const messageText = 'Hello, I am interested in learning math'
    await page.fill('textarea[placeholder*="Type a message"]', messageText)
    
    // Send message
    await page.click('button[type="button"]:has(svg)')
    
    // Verify message appears (optimistic update)
    await expect(page.locator(`text=${messageText}`)).toBeVisible()
  })

  test('should display message history', async ({ page }) => {
    await page.goto('/chat/thread/thread_123')
    
    // Wait for messages to load
    await page.waitForSelector('[data-testid="message"]', { timeout: 5000 })
    
    // Verify messages are displayed
    const messages = page.locator('[data-testid="message"]')
    await expect(messages.first()).toBeVisible()
  })

  test('should handle read-only thread', async ({ page }) => {
    // Mock read-only thread
    await page.route('/api/v1/chat/threads/*/messages/', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messages: [],
            hasMore: false
          })
        })
      }
    })
    
    await page.goto('/chat/thread/thread_readonly')
    
    // Verify read-only badge
    await expect(page.locator('text=Read-only')).toBeVisible()
    
    // Verify message input is disabled or hidden
    const messageInput = page.locator('textarea[placeholder*="Type a message"]')
    await expect(messageInput).not.toBeVisible()
  })

  test('should show optimistic update and replace with server response', async ({ page }) => {
    let requestCount = 0
    
    await page.route('/api/v1/chat/threads/*/messages/', async route => {
      if (route.request().method() === 'POST') {
        requestCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: {
              id: 'msg_server_123',
              threadId: 'thread_123',
              sender: { id: 'student_1', firstName: 'John', lastName: 'Doe', role: 'student' },
              body: 'Test message',
              createdAt: new Date().toISOString(),
              clientMessageId: 'msg_client_123'
            }
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/chat/thread/thread_123')
    
    await page.fill('textarea[placeholder*="Type a message"]', 'Test message')
    await page.click('button[type="button"]:has(svg)')
    
    // Verify message appears
    await expect(page.locator('text=Test message')).toBeVisible()
    
    // Verify API was called
    await page.waitForTimeout(500)
    expect(requestCount).toBe(1)
  })

  test('should remove optimistic message on error', async ({ page }) => {
    await page.route('/api/v1/chat/threads/*/messages/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        })
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/chat/thread/thread_123')
    
    const messageText = 'This will fail'
    await page.fill('textarea[placeholder*="Type a message"]', messageText)
    await page.click('button[type="button"]:has(svg)')
    
    // Wait for error handling
    await page.waitForTimeout(1000)
    
    // Verify message was removed
    const messageCount = await page.locator(`text=${messageText}`).count()
    expect(messageCount).toBe(0)
  })

  test('should navigate back from chat', async ({ page }) => {
    await page.goto('/chat/thread/thread_123')
    
    // Click back button
    await page.click('button:has(svg)')
    
    // Verify navigation
    await expect(page).not.toHaveURL(/\/chat\/thread\//)
  })

  test('should prevent send when message is empty', async ({ page }) => {
    await page.goto('/chat/thread/thread_123')
    
    // Try to click send with empty message
    const sendButton = page.locator('button[type="button"]:has(svg)')
    await expect(sendButton).toBeDisabled()
  })

  test('should enable send when message has content', async ({ page }) => {
    await page.goto('/chat/thread/thread_123')
    
    const sendButton = page.locator('button[type="button"]:has(svg)')
    
    // Initially disabled
    await expect(sendButton).toBeDisabled()
    
    // Type message
    await page.fill('textarea[placeholder*="Type a message"]', 'Hello')
    
    // Now enabled
    await expect(sendButton).toBeEnabled()
  })

  test('should send message with Enter key', async ({ page }) => {
    await page.goto('/chat/thread/thread_123')
    
    const messageText = 'Sent with Enter'
    await page.fill('textarea[placeholder*="Type a message"]', messageText)
    
    // Press Enter
    await page.press('textarea[placeholder*="Type a message"]', 'Enter')
    
    // Verify message appears
    await expect(page.locator(`text=${messageText}`)).toBeVisible()
  })
})
