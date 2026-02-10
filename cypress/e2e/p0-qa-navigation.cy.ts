/**
 * P0 QA Test — Navigation & Routing
 * Автоматична перевірка tutor/student flows після фіксів
 * 
 * Запуск: npx cypress run --spec "cypress/e2e/p0-qa-navigation.cy.ts"
 */

describe('P0 QA — TopNav Navigation', () => {
  const TUTOR_EMAIL = 'tutor04@example.com' // або створити тестового
  const TUTOR_PASSWORD = 'testpass123'
  
  const STUDENT_EMAIL = 'student01@example.com'
  const STUDENT_PASSWORD = 'testpass123'

  describe('Tutor Flow', () => {
    beforeEach(() => {
      // Login як tutor
      cy.visit('/auth/login')
      cy.get('input[type="email"]').type(TUTOR_EMAIL)
      cy.get('input[type="password"]').type(TUTOR_PASSWORD)
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/tutor')
    })

    it('✅ TopNav показує всі tutor пункти', () => {
      // Перевірка що TopNav існує з navigation
      cy.get('nav').should('exist')
      cy.contains('nav', /Календар|Calendar/).should('be.visible')
      cy.contains('nav', /Запити|Inquiries/).should('be.visible')
      cy.contains('nav', /Уроки|Bookings/).should('be.visible')
      cy.contains('nav', /Чат|Chat/).should('be.visible')
    })

    it('✅ Клік на Calendar — відкривається без 404', () => {
      cy.contains('nav a', /Календар|Calendar/).click()
      cy.url().should('include', '/booking/tutor')
      cy.get('body').should('not.contain', '404')
      cy.get('body').should('not.contain', 'Not Found')
    })

    it('✅ Клік на Inquiries — відкривається без 404', () => {
      cy.contains('nav a', /Запити|Inquiries/).click()
      cy.url().should('include', '/tutor/inquiries')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Bookings — відкривається без 404', () => {
      cy.contains('nav a', /Уроки|Bookings/).click()
      cy.url().should('include', '/bookings')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Chat — відкривається без 404', () => {
      cy.contains('nav a', /Чат|Chat/).click()
      cy.url().should('include', '/chat')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Contacts — відкривається без 404', () => {
      cy.contains('nav a', /Контакти|Contacts/).click()
      cy.url().should('include', '/contacts')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Billing — відкривається без 404', () => {
      cy.contains('nav a', /Оплата|Billing/).click()
      cy.url().should('include', '/billing')
      cy.get('body').should('not.contain', '404')
    })
  })

  describe('Student Flow', () => {
    beforeEach(() => {
      // Login як student
      cy.visit('/auth/login')
      cy.get('input[type="email"]').type(STUDENT_EMAIL)
      cy.get('input[type="password"]').type(STUDENT_PASSWORD)
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/student')
    })

    it('✅ TopNav показує всі student пункти', () => {
      cy.get('nav').should('exist')
      cy.contains('nav', /Маркетплейс|Marketplace/).should('be.visible')
      cy.contains('nav', /Уроки|Bookings/).should('be.visible')
      cy.contains('nav', /Чат|Chat/).should('be.visible')
    })

    it('✅ Клік на Marketplace — відкривається без 404', () => {
      cy.contains('nav a', /Маркетплейс|Marketplace/).click()
      cy.url().should('include', '/marketplace')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Bookings — відкривається без 404', () => {
      cy.contains('nav a', /Уроки|Bookings/).click()
      cy.url().should('include', '/bookings')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Chat — відкривається без 404', () => {
      cy.contains('nav a', /Чат|Chat/).click()
      cy.url().should('include', '/chat')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Contacts — відкривається без 404', () => {
      cy.contains('nav a', /Контакти|Contacts/).click()
      cy.url().should('include', '/contacts')
      cy.get('body').should('not.contain', '404')
    })

    it('✅ Клік на Billing — відкривається без 404', () => {
      cy.contains('nav a', /Оплата|Billing/).click()
      cy.url().should('include', '/billing')
      cy.get('body').should('not.contain', '404')
    })
  })

  describe('Guards — Role Access', () => {
    it('❌ Tutor на student-only route → redirect', () => {
      cy.loginAsTutor() // custom command
      cy.visit('/student') // student dashboard
      cy.url().should('not.include', '/student') // redirect away
    })

    it('❌ Student на tutor-only route → redirect', () => {
      cy.loginAsStudent() // custom command
      cy.visit('/tutor') // tutor dashboard
      cy.url().should('not.include', '/tutor') // redirect away
    })

    it('❌ Student на /booking/tutor (tutor calendar) → redirect', () => {
      cy.loginAsStudent()
      cy.visit('/booking/tutor')
      cy.url().should('not.include', '/booking/tutor')
    })

    it('❌ Tutor на /calendar (student calendar) → redirect', () => {
      cy.loginAsTutor()
      cy.visit('/calendar')
      cy.url().should('not.include', '/calendar')
    })
  })

  describe('No Console Errors', () => {
    it('✅ Немає errors при навігації', () => {
      cy.loginAsTutor()
      
      // Ловимо console errors
      const consoleErrors = []
      cy.on('window:console', (log) => {
        if (log.type === 'error') {
          consoleErrors.push(log.message)
        }
      })

      // Клікаємо по всім пунктам
      cy.contains('nav a', /Календар|Calendar/).click()
      cy.contains('nav a', /Запити|Inquiries/).click()
      cy.contains('nav a', /Уроки|Bookings/).click()
      
      // Перевіряємо що не було critical errors
      cy.wrap(consoleErrors).should('have.length', 0)
    })
  })
})
