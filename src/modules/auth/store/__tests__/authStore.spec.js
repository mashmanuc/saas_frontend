/**
 * Unit tests for authStore error handling (v0.82.0)
 * 
 * Тестуємо мапінг кодів помилок з backend на lastErrorCode:
 * - 401 + error='invalid_credentials' → lastErrorCode = 'invalid_credentials'
 * - 429 → lastErrorCode = 'rate_limited'
 * - 401 + error='email_not_verified' → lastErrorCode = 'email_not_verified'
 */

import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../authStore'

describe('authStore.handleError (v0.82.0)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('maps 401 with error=invalid_credentials to lastErrorCode', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 401,
        data: {
          error: 'invalid_credentials',
          message: 'Невірний email або пароль.',
          request_id: 'test-request-123',
        },
      },
    }

    store.handleError(error)

    expect(store.lastErrorCode).toBe('invalid_credentials')
    expect(store.lastRequestId).toBe('test-request-123')
    expect(store.error).toContain('Невірний')
  })

  it('maps 401 with error=email_not_verified to lastErrorCode', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 401,
        data: {
          error: 'email_not_verified',
          message: 'Підтвердіть email для входу.',
          request_id: 'test-request-456',
        },
      },
    }

    store.handleError(error)

    expect(store.lastErrorCode).toBe('email_not_verified')
    expect(store.error).toContain('email')
  })

  it('maps 429 to rate_limited', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 429,
        data: {
          error: 'rate_limited',
          message: 'Забагато запитів. Спробуйте пізніше.',
          request_id: 'test-request-789',
        },
        headers: {
          'retry-after': '60',
        },
      },
    }

    store.handleError(error)

    expect(store.lastErrorCode).toBe('rate_limited')
    expect(store.error).toContain('Забагато')
  })

  it('handles 401 without specific error code as invalid_credentials', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 401,
        data: {
          message: 'Unauthorized',
        },
      },
    }

    store.handleError(error)

    // Fallback до invalid_credentials
    expect(store.lastErrorCode).toBe('invalid_credentials')
  })

  it('clears previous error state before setting new error', () => {
    const store = useAuthStore()
    
    // Встановлюємо попередній стан
    store.lastErrorCode = 'old_error'
    store.lastFieldMessages = { old: ['old message'] }
    store.lastSummary = ['old summary']

    const error = {
      response: {
        status: 401,
        data: {
          error: 'invalid_credentials',
        },
      },
    }

    store.handleError(error)

    // Перевіряємо, що старі дані очищені
    expect(store.lastErrorCode).toBe('invalid_credentials')
    expect(store.lastFieldMessages).toBeNull()
    expect(store.lastSummary).toBeNull()
  })

  it('handles validation errors (422) correctly', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 422,
        data: {
          error: 'validation_failed',
          field_messages: {
            email: ['Введіть email'],
            password: ['Введіть пароль'],
          },
          summary: ['Перевірте поля форми'],
          request_id: 'validation-123',
        },
      },
    }

    store.handleError(error)

    expect(store.lastErrorCode).toBe('validation_failed')
    expect(store.lastFieldMessages).toEqual({
      email: ['Введіть email'],
      password: ['Введіть пароль'],
    })
    expect(store.lastSummary).toEqual(['Перевірте поля форми'])
  })

  it('preserves request_id in error message when available', () => {
    const store = useAuthStore()
    
    const error = {
      response: {
        status: 401,
        data: {
          error: 'invalid_credentials',
          message: 'Test error',
          request_id: 'req-abc-123',
        },
      },
    }

    store.handleError(error)

    expect(store.lastRequestId).toBe('req-abc-123')
    expect(store.error).toContain('req-abc-123')
  })

  it('handles network errors gracefully', () => {
    const store = useAuthStore()
    
    const error = {
      // Немає response (мережева помилка)
      message: 'Network Error',
    }

    store.handleError(error)

    // Має встановити загальну помилку
    expect(store.error).toBeTruthy()
  })
})
