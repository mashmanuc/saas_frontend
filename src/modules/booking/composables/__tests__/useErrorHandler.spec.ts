import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockTranslate = vi.fn((key: string) => key)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockTranslate,
  }),
}))

import { useErrorHandler } from '../useErrorHandler'

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}))

describe('useErrorHandler', () => {
  beforeEach(() => {
    mockTranslate.mockClear()
  })

  describe('handleErrorWithFields', () => {
    it('should map PAST_TIME to start field error', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            code: 'PAST_TIME',
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors.start).toBeDefined()
      expect(result.shouldShowToast).toBe(false)
    })

    it('should map INVALID_DURATION to durationMin field error', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            code: 'INVALID_DURATION',
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors.durationMin).toBeDefined()
      expect(result.shouldShowToast).toBe(false)
    })

    it('should map INVALID_LESSON_TYPE to lessonType field error', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            code: 'INVALID_LESSON_TYPE',
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors.lessonType).toBeDefined()
      expect(result.shouldShowToast).toBe(false)
    })

    it('should show toast for TIME_OVERLAP error', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 409,
          data: {
            code: 'TIME_OVERLAP',
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors).toEqual({})
      expect(result.shouldShowToast).toBe(true)
    })

    it('should handle error with nested error object', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INVALID_ORDER',
              message: 'Order not found',
            },
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors.orderId).toBeDefined()
      expect(result.shouldShowToast).toBe(false)
    })

    it('should handle HTTP status codes without error code', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 403,
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.shouldShowToast).toBe(true)
      expect(result.message).toBeDefined()
    })

    it('should return empty field errors for unknown error code', () => {
      const { handleErrorWithFields } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            code: 'UNKNOWN_ERROR_CODE',
          },
        },
      }

      const result = handleErrorWithFields(error)

      expect(result.fieldErrors).toEqual({})
      expect(result.shouldShowToast).toBe(true)
    })
  })

  describe('getErrorMessage', () => {
    it('should return translated message for known error code', () => {
      const { getErrorMessage } = useErrorHandler()

      const message = getErrorMessage('PAST_TIME')

      expect(message).toBeDefined()
    })

    it('should return unknown error message for unknown code', () => {
      const { getErrorMessage } = useErrorHandler()

      const message = getErrorMessage('UNKNOWN_CODE')

      expect(message).toBeDefined()
    })
  })

  describe('handleError (legacy)', () => {
    it('should handle error and show toast', () => {
      const { handleError } = useErrorHandler()

      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
            },
          },
        },
      }

      const message = handleError(error)

      expect(message).toBeDefined()
    })
  })
})
