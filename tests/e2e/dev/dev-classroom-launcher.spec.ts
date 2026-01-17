import { test, expect } from '@playwright/test'

test.describe('Dev Classroom Launcher', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/dev/classroom/sessions/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'test-session-1',
              created_at: new Date().toISOString(),
              workspace_id: 'workspace-1',
              is_archived: false,
              is_dev: true,
              origin: 'dev_launcher'
            },
            {
              id: 'test-session-2',
              created_at: new Date(Date.now() - 3600000).toISOString(),
              workspace_id: 'workspace-2',
              is_archived: false,
              is_dev: true,
              origin: 'dev_launcher'
            }
          ])
        })
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-session-id',
            uuid: 'new-session-id',
            workspace_id: 'new-workspace-id',
            created_at: new Date().toISOString(),
            is_dev: true,
            origin: 'dev_launcher'
          })
        })
      }
    })

    await page.route('**/api/v1/classroom/session/*/join/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          session_id: 'test-session-id'
        })
      })
    })

    await page.route('**/api/v1/dev/classroom/sessions/*/archive/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'archived-session',
          is_archived: true,
          archived_at: new Date().toISOString()
        })
      })
    })

    // Navigate to dev launcher
    await page.goto('/dev/classroom')
  })

  test('should render dev launcher page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dev Classroom Launcher')
    await expect(page.locator('.launcher-description')).toBeVisible()
    await expect(page.getByTestId('create-join-btn')).toBeVisible()
  })

  test('should display list of dev sessions', async ({ page }) => {
    await expect(page.locator('.sessions-title')).toContainText('Останні dev-сесії')
    await expect(page.getByTestId('session-test-session-1')).toBeVisible()
    await expect(page.getByTestId('session-test-session-2')).toBeVisible()
  })

  test('should create and join new session', async ({ page }) => {
    const createBtn = page.getByTestId('create-join-btn')
    
    await createBtn.click()
    
    // Should show loading state
    await expect(createBtn).toBeDisabled()
    await expect(createBtn).toContainText('Створюємо')
    
    // Should redirect to classroom (mock navigation)
    await page.waitForTimeout(500)
    
    // Verify token stored in sessionStorage
    const token = await page.evaluate(() => 
      sessionStorage.getItem('devLauncherClassroomToken:new-session-id')
    )
    expect(token).toBe('mock-jwt-token')
  })

  test('should join existing session', async ({ page }) => {
    const joinBtn = page.getByTestId('join-btn-test-session-1')
    
    await joinBtn.click()
    
    // Should show loading state
    await expect(joinBtn).toBeDisabled()
    
    // Verify token stored
    await page.waitForTimeout(500)
    const token = await page.evaluate(() =>
      sessionStorage.getItem('devLauncherClassroomToken:test-session-id')
    )
    expect(token).toBe('mock-jwt-token')
  })

  test('should copy session ID to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-write', 'clipboard-read'])
    
    const copyBtn = page.getByTestId('copy-btn-test-session-1')
    await copyBtn.click()
    
    // Verify toast message
    await expect(page.locator('.toast')).toContainText('ID скопійовано')
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe('test-session-1')
  })

  test('should archive session', async ({ page }) => {
    const archiveBtn = page.getByTestId('archive-btn-test-session-1')
    
    await archiveBtn.click()
    
    // Should show loading state
    await expect(archiveBtn).toBeDisabled()
    
    // Should show success toast
    await expect(page.locator('.toast')).toContainText('Сесію заархівовано')
  })

  test('should display session status badges', async ({ page }) => {
    const session1 = page.getByTestId('session-test-session-1')
    
    await expect(session1.locator('.session-status')).toContainText('Готова')
    await expect(session1.locator('.session-status')).toHaveClass(/session-status--ready/)
  })

  test('should format relative timestamps', async ({ page }) => {
    const session1 = page.getByTestId('session-test-session-1')
    const session2 = page.getByTestId('session-test-session-2')
    
    // First session should show "Щойно" or minutes ago
    await expect(session1.locator('.session-date')).toBeVisible()
    
    // Second session should show "1 год тому"
    await expect(session2.locator('.session-date')).toContainText('год тому')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/v1/dev/classroom/sessions/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' })
        })
      }
    })

    const createBtn = page.getByTestId('create-join-btn')
    await createBtn.click()
    
    // Should show error toast
    await expect(page.locator('.toast')).toContainText('Помилка створення сесії')
  })

  test('should retry on error', async ({ page }) => {
    // Mock initial error
    let requestCount = 0
    await page.route('**/api/v1/dev/classroom/sessions/', async (route) => {
      if (route.request().method() === 'GET') {
        requestCount++
        if (requestCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Server error' })
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
          })
        }
      }
    })

    await page.goto('/dev/classroom')
    
    // Should show error
    await expect(page.locator('.launcher-error')).toBeVisible()
    
    // Click retry
    await page.getByText('Спробувати знову').click()
    
    // Error should disappear
    await expect(page.locator('.launcher-error')).not.toBeVisible()
  })

  test('should respect limit parameter', async ({ page }) => {
    // Create 15 mock sessions
    const mockSessions = Array.from({ length: 15 }, (_, i) => ({
      id: `session-${i}`,
      created_at: new Date().toISOString(),
      workspace_id: `workspace-${i}`,
      is_archived: false,
      is_dev: true,
      origin: 'dev_launcher'
    }))

    await page.route('**/api/v1/dev/classroom/sessions/?limit=10', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSessions.slice(0, 10))
      })
    })

    await page.goto('/dev/classroom')
    
    // Should show only 10 sessions
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems).toHaveCount(10)
  })

  test('should disable actions for archived sessions', async ({ page }) => {
    await page.route('**/api/v1/dev/classroom/sessions/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'archived-session',
              created_at: new Date().toISOString(),
              workspace_id: 'workspace-1',
              is_archived: true,
              is_dev: true,
              origin: 'dev_launcher'
            }
          ])
        })
      }
    })

    await page.goto('/dev/classroom')
    
    const archivedSession = page.getByTestId('session-archived-session')
    
    // Should have archived class
    await expect(archivedSession).toHaveClass(/session-item--archived/)
    
    // Join button should not be visible for archived sessions
    await expect(archivedSession.getByTestId('join-btn-archived-session')).not.toBeVisible()
  })
})
