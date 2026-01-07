import { test, expect } from '@playwright/test'

test.describe('Tutor Subjects Edit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tutor
    await page.goto('http://127.0.0.1:5173/login')
    await page.fill('[data-test="login-email"]', 'm3@gmail.com')
    await page.fill('[data-test="login-password"]', 'demo1234')
    await page.click('[data-test="login-submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to profile editor
    await page.goto('http://127.0.0.1:5173/tutor/profile/edit')
    await page.waitForLoadState('networkidle')
  })

  test('should add subject with tags', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    // Verify subject added
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand subject
    await subjectItem.locator('.btn-icon').first().click()
    
    // Select tags
    const firstCheckbox = page.locator('input[type="checkbox"]').first()
    await firstCheckbox.check()
    
    // Add custom text (minimum 300 characters)
    const customText = 'Готую до НМТ за 8 тижнів: індивідуальний план + домашні завдання + контрольні роботи. Пояснюю складні теми простими словами. Допомагаю подолати страх перед екзаменом. Мої учні здають НМТ на 180+ балів. Використовую сучасні методики та авторські матеріали для ефективного навчання та досягнення високих результатів.'
    const textarea = subjectItem.locator('textarea')
    await textarea.fill(customText)
    
    // Save profile
    const saveButton = page.locator('button:has-text("Зберегти")')
    if (await saveButton.isVisible()) {
      await saveButton.click()
      
      // Wait for success
      await page.waitForTimeout(2000)
    }
  })

  test('should remove subject', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Check if subject exists
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    
    if (await subjectItem.isVisible()) {
      // Remove subject
      await subjectItem.locator('.btn-remove').click()
      
      // Verify removed
      await expect(subjectItem).not.toBeVisible()
    }
  })

  test('should validate custom text length', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand subject
    await subjectItem.locator('.btn-icon').first().click()
    
    // Enter short text (< 300 chars)
    const textarea = subjectItem.locator('textarea')
    await textarea.fill('Short text')
    
    // Check for validation error
    const error = page.locator('.field-error:has-text("Мінімум 300 символів")')
    await expect(error).toBeVisible()
  })

  test('should show character count', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand subject
    await subjectItem.locator('.btn-icon').first().click()
    
    // Check character count
    const charCount = subjectItem.locator('.char-count')
    await expect(charCount).toBeVisible()
    await expect(charCount).toContainText('/ 800')
  })

  test('should toggle subject expansion', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand
    await subjectItem.locator('.btn-icon').first().click()
    const details = subjectItem.locator('.subject-details')
    await expect(details).toBeVisible()
    
    // Collapse
    await subjectItem.locator('.btn-icon').first().click()
    await expect(details).not.toBeVisible()
  })

  test('should show empty state when no subjects', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Remove all subjects if any exist
    const removeButtons = page.locator('.btn-remove')
    const count = await removeButtons.count()
    for (let i = 0; i < count; i++) {
      await removeButtons.first().click()
    }
    
    // Check empty state
    const emptyState = page.locator('.empty-state')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText('Ви ще не обрали жодного предмета')
  })

  test('should disable add button when no subject selected', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Check add button is disabled
    const addButton = page.locator('button:has-text("Додати")').first()
    await expect(addButton).toBeDisabled()
  })

  test('should enable add button when subject selected', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Select subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    
    // Check add button is enabled
    const addButton = page.locator('button:has-text("Додати")').first()
    await expect(addButton).toBeEnabled()
  })

  test('should display tag groups', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand subject
    await subjectItem.locator('.btn-icon').first().click()
    
    // Check tag groups are visible
    const tagGroups = page.locator('.tag-group')
    const groupCount = await tagGroups.count()
    expect(groupCount).toBeGreaterThan(0)
  })

  test('should toggle tag selection', async ({ page }) => {
    // Navigate to subjects step
    const subjectsStep = page.locator('text=Предмети та мови')
    if (await subjectsStep.isVisible()) {
      await subjectsStep.click()
    }
    
    // Add subject
    await page.selectOption('[data-test="subject-selector-add"]', { index: 1 })
    await page.click('button:has-text("Додати")')
    
    const subjectItem = page.locator('[data-test^="subject-item-"]').first()
    await expect(subjectItem).toBeVisible()
    
    // Expand subject
    await subjectItem.locator('.btn-icon').first().click()
    
    // Toggle tag
    const checkbox = page.locator('input[type="checkbox"]').first()
    const initialState = await checkbox.isChecked()
    await checkbox.click()
    const newState = await checkbox.isChecked()
    
    expect(newState).toBe(!initialState)
  })
})
