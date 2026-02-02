describe('Tutor Accept Inquiry with Onboarding Allowance', () => {
  beforeEach(() => {
    // Login as tutor
    cy.login('tutor@test.com', 'password')
    
    // Mock accept availability
    cy.intercept('GET', '/api/tutor/accept-availability/', {
      statusCode: 200,
      body: {
        can_accept: true,
        remaining_accepts: 3,
        grace_token: 'mock_token_123',
        expires_at: new Date(Date.now() + 45000).toISOString()
      }
    }).as('getAvailability')
  })
  
  it('should show accept availability badge', () => {
    cy.visit('/inquiries')
    
    cy.wait('@getAvailability')
    
    // Badge should show remaining accepts
    cy.contains('3 accepts available').should('be.visible')
  })
  
  it('should accept inquiry with grace token', () => {
    // Mock open inquiry
    cy.intercept('GET', '/api/inquiries/', {
      statusCode: 200,
      body: {
        results: [
          {
            id: '123',
            message: 'Test inquiry',
            status: 'OPEN'
          }
        ]
      }
    })
    
    // Mock accept
    cy.intercept('POST', '/api/inquiries/123/accept/', (req) => {
      // Verify grace token sent
      expect(req.body).to.have.property('grace_token', 'mock_token_123')
      
      req.reply({
        statusCode: 200,
        body: {
          inquiry_id: '123',
          status: 'accepted',
          accepted_at: new Date().toISOString()
        }
      })
    }).as('acceptInquiry')
    
    cy.visit('/inquiries')
    
    // Click accept
    cy.contains('Accept').click()
    
    cy.wait('@acceptInquiry')
    
    // Success toast
    cy.contains('Inquiry accepted successfully!').should('be.visible')
  })
  
  it('should retry with fresh token if token expired', () => {
    // Mock inquiry
    cy.intercept('GET', '/api/inquiries/', {
      statusCode: 200,
      body: {
        results: [
          {
            id: '123',
            message: 'Test inquiry',
            status: 'OPEN'
          }
        ]
      }
    })
    
    let attemptCount = 0
    
    // First accept fails with expired token
    cy.intercept('POST', '/api/inquiries/123/accept/', (req) => {
      attemptCount++
      
      if (attemptCount === 1) {
        req.reply({
          statusCode: 400,
          body: {
            error: 'Grace token expired'
          }
        })
      } else {
        // Second attempt succeeds
        req.reply({
          statusCode: 200,
          body: {
            inquiry_id: '123',
            status: 'accepted',
            accepted_at: new Date().toISOString()
          }
        })
      }
    }).as('acceptInquiry')
    
    // Fresh availability after retry
    cy.intercept('GET', '/api/tutor/accept-availability/', {
      statusCode: 200,
      body: {
        can_accept: true,
        remaining_accepts: 2,
        grace_token: 'fresh_token_456',
        expires_at: new Date(Date.now() + 45000).toISOString()
      }
    }).as('getFreshAvailability')
    
    cy.visit('/inquiries')
    
    // Click accept
    cy.contains('Accept').click()
    
    // Wait for both attempts
    cy.wait('@acceptInquiry')
    cy.wait('@getFreshAvailability')
    cy.wait('@acceptInquiry')
    
    // Success toast
    cy.contains('Inquiry accepted successfully!').should('be.visible')
  })
  
  it('should disable accept button when remaining=0', () => {
    // Mock availability with 0 remaining
    cy.intercept('GET', '/api/tutor/accept-availability/', {
      statusCode: 200,
      body: {
        can_accept: false,
        remaining_accepts: 0
      }
    })
    
    // Mock inquiry
    cy.intercept('GET', '/api/inquiries/', {
      statusCode: 200,
      body: {
        results: [
          {
            id: '123',
            message: 'Test inquiry',
            status: 'OPEN'
          }
        ]
      }
    })
    
    cy.visit('/inquiries')
    
    // Badge shows 0
    cy.contains('No accepts available').should('be.visible')
    
    // Button disabled
    cy.contains('Accept').should('be.disabled')
  })
  
  it('should track analytics events', () => {
    // Mock inquiry
    cy.intercept('GET', '/api/inquiries/', {
      statusCode: 200,
      body: {
        results: [
          {
            id: '123',
            message: 'Test inquiry',
            status: 'OPEN'
          }
        ]
      }
    })
    
    // Mock accept
    cy.intercept('POST', '/api/inquiries/123/accept/', {
      statusCode: 200,
      body: {
        inquiry_id: '123',
        status: 'accepted',
        accepted_at: new Date().toISOString()
      }
    })
    
    // Spy on gtag
    cy.window().then((win) => {
      cy.spy(win, 'gtag').as('gtag')
    })
    
    cy.visit('/inquiries')
    
    // Badge viewed event
    cy.get('@gtag').should('have.been.calledWith', 'event', 'acceptance_viewed')
    
    // Click accept
    cy.contains('Accept').click()
    
    // Accept used event
    cy.get('@gtag').should('have.been.calledWith', 'event', 'acceptance_used')
  })
})
