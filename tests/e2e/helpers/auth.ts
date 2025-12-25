import { Page } from '@playwright/test'

export async function loginAsTutor(page: Page) {
  // Use storageState for authentication
  await page.goto('/auth/login')
  
  // Fill login form
  await page.fill('[data-testid="email-input"]', 'tutor@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-button"]')
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard')
  
  // Navigate to tutor calendar
  await page.goto('/tutor/calendar')
  await page.waitForLoadState('networkidle')
}

export async function loginAsStudent(page: Page) {
  await page.goto('/auth/login')
  
  await page.fill('[data-testid="email-input"]', 'student@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-button"]')
  
  await page.waitForURL('/dashboard')
}
