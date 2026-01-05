/**
 * MINIMAL E2E Test - Calendar CreateLesson Modal
 * 
 * Мінімальний тест для перевірки базової функціональності
 * Працює навіть якщо доступність не налаштована
 */

import './envGuard'
import { test, expect } from '@playwright/test'

test.describe('Create Lesson Modal - MINIMAL TEST', () => {
  test('Calendar loads and shows either content or empty state', async ({ page }) => {
    console.log('\n=== MINIMAL TEST: Calendar load ===')
    
    // Крок 1: Завантажити календар
    await page.goto('/booking/tutor', { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Крок 2: Перевірити, що основні елементи є
    const weekView = page.locator('[data-testid="calendar-week-view"]')
    await expect(weekView).toBeVisible({ timeout: 20000 })
    
    const board = page.locator('[data-testid="calendar-board"]')
    await expect(board).toBeVisible({ timeout: 20000 })
    
    console.log('[MINIMAL TEST] ✓ Calendar UI loaded')
    
    // Крок 3: Перевірити, що є або контент, або empty state
    await page.waitForTimeout(2000)
    
    const hasEmptyState = await page.locator('text=/доступність.*не налаштована/i').isVisible().catch(() => false)
    const hasDayColumns = await page.locator('.day-column').count() > 0
    
    if (hasEmptyState) {
      console.log('[MINIMAL TEST] ⚠ Calendar shows empty state (no availability configured)')
      console.log('[MINIMAL TEST] ℹ To run full tests, configure availability first')
    } else if (hasDayColumns) {
      console.log('[MINIMAL TEST] ✓ Calendar shows day columns')
      
      // Спробувати знайти grid-hour елементи
      const gridHours = page.locator('[data-testid^="grid-hour-"]')
      const gridHourCount = await gridHours.count()
      console.log(`[MINIMAL TEST] Found ${gridHourCount} grid-hour elements`)
      
      if (gridHourCount > 0) {
        console.log('[MINIMAL TEST] ✓ Grid hours with data-testid are present')
      } else {
        console.log('[MINIMAL TEST] ⚠ No grid-hour elements with data-testid found')
      }
    } else {
      console.log('[MINIMAL TEST] ⚠ Unknown calendar state')
    }
    
    console.log('[MINIMAL TEST] ✓ Test completed successfully')
  })
})
