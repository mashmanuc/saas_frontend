import { test, expect } from '@playwright/test'

/**
 * E2E тести для Contact Access Flow
 * Згідно з TZ_QA_CONTACT_ACCESS.md
 */

test.describe('Contact Access Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: очистити стан перед кожним тестом
    await page.goto('http://localhost:5173')
  })

  test('Tutor accepts relation → sees unlock button → unlocks → sees contacts', async ({ page }) => {
    // 1. Login as tutor
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // 2. Navigate to dashboard
    await page.waitForURL('**/dashboard')
    await expect(page).toHaveURL(/.*dashboard/)
    
    // 3. Find invited relation
    const relationCard = page.locator('.relation-card, [data-test*="relation"]').filter({ hasText: 'invited' }).first()
    
    // 4. Accept relation
    await relationCard.locator('button:has-text("Accept"), button:has-text("Прийняти")').click()
    
    // 5. Wait for success notification
    await expect(page.locator('.notification, [role="alert"]').filter({ hasText: /accepted|прийнято/i })).toBeVisible({ timeout: 5000 })
    
    // 6. Verify unlock button appears (NOT contacts)
    await expect(relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")').first()).toBeVisible({ timeout: 3000 })
    
    // 7. Verify contacts are NOT visible yet
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).not.toBeVisible()
    
    // 8. Click unlock
    await relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")').first().click()
    
    // 9. Wait for unlock success notification
    await expect(page.locator('.notification, [role="alert"]').filter({ hasText: /unlocked|відкрито/i })).toBeVisible({ timeout: 5000 })
    
    // 10. Verify contacts are now visible
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).toBeVisible({ timeout: 3000 })
    await expect(relationCard.locator('.contact-item:has-text("📱"), [data-test="contact-phone"]')).toBeVisible()
    await expect(relationCard.locator('.contact-item:has-text("📧"), [data-test="contact-email"]')).toBeVisible()
  })
  
  test('Chat is blocked without ContactAccess', async ({ page }) => {
    // 1. Login as tutor
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 2. Try to navigate to chat without unlock
    await page.goto('http://localhost:5173/chat/student/123')
    
    // 3. Verify chat is blocked
    await expect(page.locator('.chat-access-denied, [data-test="chat-access-denied"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=/contact.*required|потрібно.*контакти/i')).toBeVisible()
  })
  
  test('Revoke hides contacts and blocks chat', async ({ page }) => {
    // 1. Login as tutor
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 2. Find active relation with unlocked contacts
    const relationCard = page.locator('.relation-card, [data-test*="relation"]').filter({ hasText: /active|активний/i }).first()
    
    // 3. Unlock if not already unlocked
    const unlockButton = relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")')
    if (await unlockButton.isVisible()) {
      await unlockButton.click()
      await page.waitForTimeout(1000)
    }
    
    // 4. Verify contacts visible
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).toBeVisible()
    
    // 5. Click revoke
    await relationCard.locator('button:has-text("Revoke"), button:has-text("Відкликати")').click()
    
    // 6. Confirm revoke (if confirmation dialog exists)
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Підтвердити")')
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click()
    }
    
    // 7. Wait for revoke success notification
    await expect(page.locator('.notification, [role="alert"]').filter({ hasText: /revoked|відкликано/i })).toBeVisible({ timeout: 5000 })
    
    // 8. Verify contacts hidden
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).not.toBeVisible()
    
    // 9. Verify chat blocked
    await page.goto('http://localhost:5173/chat/student/123')
    await expect(page.locator('.chat-access-denied, [data-test="chat-access-denied"]')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hard refresh preserves unlock state', async ({ page, context }) => {
    // 1. Login as tutor
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 2. Find relation and unlock
    const relationCard = page.locator('.relation-card, [data-test*="relation"]').first()
    const unlockButton = relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")')
    
    if (await unlockButton.isVisible()) {
      await unlockButton.click()
      await page.waitForTimeout(1000)
    }
    
    // 3. Verify contacts visible
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).toBeVisible()
    
    // 4. Hard refresh
    await page.reload({ waitUntil: 'networkidle' })
    
    // 5. Verify contacts still visible after refresh
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).toBeVisible({ timeout: 5000 })
    await expect(relationCard.locator('.contact-item:has-text("📱"), [data-test="contact-phone"]')).toBeVisible()
  })
  
  test('Accept does NOT automatically unlock contacts', async ({ page }) => {
    // 1. Login as tutor
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 2. Find invited relation
    const relationCard = page.locator('.relation-card, [data-test*="relation"]').filter({ hasText: /invited|запрошений/i }).first()
    
    // 3. Accept relation
    await relationCard.locator('button:has-text("Accept"), button:has-text("Прийняти")').click()
    
    // 4. Wait for accept notification
    await expect(page.locator('.notification, [role="alert"]').filter({ hasText: /accepted|прийнято/i })).toBeVisible({ timeout: 5000 })
    
    // 5. Verify contacts are NOT visible (DDR: Accept ≠ Unlock)
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).not.toBeVisible()
    
    // 6. Verify unlock button IS visible
    await expect(relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")')).toBeVisible()
  })
  
  test('Multiple tutors have isolated contact access', async ({ page, context }) => {
    // 1. Login as tutor1
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor1@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 2. Unlock contacts for student
    const relationCard = page.locator('.relation-card, [data-test*="relation"]').first()
    await relationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")').click()
    await page.waitForTimeout(1000)
    
    // 3. Verify contacts visible for tutor1
    await expect(relationCard.locator('.contacts-display, [data-test="contacts-display"]')).toBeVisible()
    
    // 4. Logout
    await page.locator('button:has-text("Logout"), button:has-text("Вийти"), [data-test="logout"]').click()
    
    // 5. Login as tutor2
    await page.goto('http://localhost:5173/login')
    await page.fill('input[name="email"]', 'tutor2@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    // 6. Find same student relation
    const tutor2RelationCard = page.locator('.relation-card, [data-test*="relation"]').first()
    
    // 7. Verify contacts NOT visible for tutor2 (isolation)
    await expect(tutor2RelationCard.locator('.contacts-display, [data-test="contacts-display"]')).not.toBeVisible()
    
    // 8. Verify unlock button IS visible for tutor2
    await expect(tutor2RelationCard.locator('button:has-text("Unlock"), button:has-text("Відкрити контакти")')).toBeVisible()
  })
})
