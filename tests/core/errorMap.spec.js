import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseApiError,
  isRetryableError,
  isAuthError,
  formatValidationErrors,
  HTTP_ERROR_MAP,
  API_ERROR_CODES,
} from '../../src/core/errors/errorMap'

// Mock i18n
vi.mock('../../src/i18n', () => ({
  i18n: {
    global: {
      t: (key, params) => {
        if (params) {
          return `${key}:${JSON.stringify(params)}`
        }
        return key
      },
    },
  },
}))

describe('errorMap', () => {
  describe('parseApiError', () => {
    it('handles network error (offline)', () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      
      const error = { code: 'ERR_NETWORK' }
      const result = parseApiError(error)
      
      expect(result.isOffline).toBe(true)
      expect(result.code).toBe('offline')
      expect(result.status).toBeNull()
      
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, writable: true })
    })

    it('handles network error (connection refused)', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      
      const error = { code: 'ECONNREFUSED' }
      const result = parseApiError(error)
      
      expect(result.isOffline).toBe(false)
      expect(result.code).toBe('network_error')
    })

    it('parses new error format v2 with nested error object', () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              detail: 'Invalid input',
              fields: { email: 'Invalid email format' },
            },
          },
        },
      }
      
      const result = parseApiError(error)
      
      expect(result.code).toBe('validation_error')
      expect(result.status).toBe(400)
      expect(result.fieldErrors).toEqual({ email: 'Invalid email format' })
    })

    it('parses legacy error format', () => {
      const error = {
        response: {
          status: 401,
          data: {
            code: 'token_expired',
            detail: 'Token has expired',
          },
        },
      }
      
      const result = parseApiError(error)
      
      expect(result.code).toBe('token_expired')
      expect(result.status).toBe(401)
    })

    it('normalizes error codes to snake_case', () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INVALID-CREDENTIALS',
            },
          },
        },
      }
      
      const result = parseApiError(error)
      
      expect(result.code).toBe('invalid_credentials')
    })

    it('falls back to HTTP status message', () => {
      const error = {
        response: {
          status: 500,
          data: {},
        },
      }
      
      const result = parseApiError(error)
      
      expect(result.code).toBe('http_500')
      expect(result.status).toBe(500)
    })

    it('uses backend detail when code is unknown', () => {
      const error = {
        response: {
          status: 400,
          data: {
            detail: 'Custom error message',
          },
        },
      }
      
      const result = parseApiError(error)
      
      expect(result.message).toBe('Custom error message')
    })
  })

  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      const error = { code: 'ERR_NETWORK' }
      expect(isRetryableError(error)).toBe(true)
    })

    it('returns true for 5xx errors', () => {
      const error = { response: { status: 503 } }
      expect(isRetryableError(error)).toBe(true)
    })

    it('returns true for 429 rate limit', () => {
      const error = { response: { status: 429 } }
      expect(isRetryableError(error)).toBe(true)
    })

    it('returns false for 4xx client errors', () => {
      const error = { response: { status: 400 } }
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('isAuthError', () => {
    it('returns true for 401 status', () => {
      const error = { response: { status: 401, data: {} } }
      expect(isAuthError(error)).toBe(true)
    })

    it('returns true for token_expired code', () => {
      const error = { response: { status: 400, data: { code: 'token_expired' } } }
      expect(isAuthError(error)).toBe(true)
    })

    it('returns false for other errors', () => {
      const error = { response: { status: 400, data: { code: 'validation_error' } } }
      expect(isAuthError(error)).toBe(false)
    })
  })

  describe('formatValidationErrors', () => {
    it('formats array field errors', () => {
      const data = {
        errors: {
          email: ['Invalid email', 'Email already exists'],
          password: ['Too short'],
        },
      }
      
      const result = formatValidationErrors(data)
      
      expect(result.email).toBe('Invalid email')
      expect(result.password).toBe('Too short')
    })

    it('formats string field errors', () => {
      const data = {
        field_errors: {
          email: 'Invalid email',
        },
      }
      
      const result = formatValidationErrors(data)
      
      expect(result.email).toBe('Invalid email')
    })

    it('returns empty object for invalid input', () => {
      expect(formatValidationErrors(null)).toEqual({})
      expect(formatValidationErrors(undefined)).toEqual({})
      expect(formatValidationErrors('string')).toEqual({})
    })
  })
})
