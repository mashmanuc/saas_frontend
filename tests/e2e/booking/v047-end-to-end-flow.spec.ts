import { test, expect } from '@playwright/test'

test.describe('v0.47 End-to-End Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Complete booking flow: tutor creates availability → student requests → tutor accepts', async ({ page, context }) => {
    const tutorPage = page
    const studentPage = await context.newPage()

    await test.step('1. Tutor creates availability', async () => {
      await tutorPage.goto('/auth/login')
      await tutorPage.fill('input[name="email"]', 'tutor@test.com')
      await tutorPage.fill('input[name="password"]', 'password123')
      await tutorPage.click('button[type="submit"]')
      
      await tutorPage.waitForURL('/dashboard')
      
      await tutorPage.goto('/tutor/calendar')
      await tutorPage.waitForSelector('.calendar-cell-grid')
      
      const cell = tutorPage.locator('.calendar-cell').filter({ hasText: '09:00' }).first()
      await cell.click()
      
      await tutorPage.waitForSelector('.calendar-popover')
      await tutorPage.click('button:has-text("Set Available")')
      
      await expect(tutorPage.locator('.draft-indicator')).toBeVisible()
      
      await tutorPage.click('button:has-text("Apply Changes")')
      
      await expect(tutorPage.locator('.toast')).toContainText('All changes applied')
    })

    await test.step('2. Student sees calendar', async () => {
      await studentPage.goto('/auth/login')
      await studentPage.fill('input[name="email"]', 'student@test.com')
      await studentPage.fill('input[name="password"]', 'password123')
      await studentPage.click('button[type="submit"]')
      
      await studentPage.waitForURL('/dashboard')
      
      await studentPage.goto('/marketplace/tutors/79')
      await studentPage.waitForSelector('.tutor-calendar-widget')
      
      const availableCell = studentPage.locator('.calendar-cell.available').filter({ hasText: '09:00' }).first()
      await expect(availableCell).toBeVisible()
    })

    await test.step('3. Student sends booking request', async () => {
      const availableCell = studentPage.locator('.calendar-cell.available').filter({ hasText: '09:00' }).first()
      await availableCell.click()
      
      await studentPage.waitForSelector('.booking-request-modal')
      
      await studentPage.selectOption('select[name="duration"]', '60')
      await studentPage.fill('textarea[name="message"]', 'I want to learn Python')
      
      await studentPage.click('button:has-text("Send Request")')
      
      await expect(studentPage.locator('.toast')).toContainText('Request sent')
    })

    await test.step('4. Tutor receives notification', async () => {
      await tutorPage.reload()
      
      const badge = tutorPage.locator('.notifications-badge')
      await expect(badge).toContainText('1')
      
      await tutorPage.goto('/dashboard/booking-requests')
      await tutorPage.waitForSelector('.booking-request-card')
      
      const requestCard = tutorPage.locator('.booking-request-card').first()
      await expect(requestCard).toContainText('student@test.com')
      await expect(requestCard).toContainText('I want to learn Python')
    })

    await test.step('5. Tutor accepts request', async () => {
      const acceptButton = tutorPage.locator('.booking-request-card').first().locator('button:has-text("Accept")')
      await acceptButton.click()
      
      await expect(tutorPage.locator('.toast')).toContainText('Request accepted')
      
      await tutorPage.goto('/tutor/calendar')
      await tutorPage.waitForSelector('.calendar-cell-grid')
      
      const bookedCell = tutorPage.locator('.calendar-cell.booked').filter({ hasText: '09:00' }).first()
      await expect(bookedCell).toBeVisible()
    })

    await test.step('6. Student receives notification and sees lesson', async () => {
      await studentPage.reload()
      
      const notification = studentPage.locator('.notification').filter({ hasText: 'Request accepted' })
      await expect(notification).toBeVisible()
      
      await studentPage.goto('/student/lessons')
      await studentPage.waitForSelector('.lesson-card')
      
      const lessonCard = studentPage.locator('.lesson-card').first()
      await expect(lessonCard).toContainText('09:00')
      await expect(lessonCard).toContainText('tutor@test.com')
    })

    await studentPage.close()
  })

  test('Draft workflow: add multiple patches and apply', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.goto('/tutor/calendar')
    await page.waitForSelector('.calendar-cell-grid')
    
    const cells = page.locator('.calendar-cell').filter({ hasText: /09:00|10:00|11:00/ })
    
    for (let i = 0; i < 3; i++) {
      await cells.nth(i).click()
      await page.waitForSelector('.calendar-popover')
      await page.click('button:has-text("Set Available")')
      await page.waitForTimeout(300)
    }
    
    await expect(page.locator('.draft-toolbar')).toContainText('3 pending changes')
    
    await page.click('button:has-text("Apply Changes")')
    
    await expect(page.locator('.toast')).toContainText('Застосовано 3 змін')
    await expect(page.locator('.draft-toolbar')).not.toBeVisible()
  })

  test('Error handling: booking conflict', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'student@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.goto('/marketplace/tutors/79')
    await page.waitForSelector('.tutor-calendar-widget')
    
    const bookedCell = page.locator('.calendar-cell.booked').first()
    await bookedCell.click()
    
    await page.waitForSelector('.booking-request-modal')
    await page.click('button:has-text("Send Request")')
    
    await expect(page.locator('.toast.error')).toContainText('slot is no longer available')
  })

  test('Accessibility: keyboard navigation', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'tutor@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.goto('/tutor/calendar')
    await page.waitForSelector('.calendar-cell-grid')
    
    const firstCell = page.locator('.calendar-cell').first()
    await firstCell.focus()
    
    await page.keyboard.press('Enter')
    await expect(page.locator('.calendar-popover')).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(page.locator('.calendar-popover')).not.toBeVisible()
  })
})
