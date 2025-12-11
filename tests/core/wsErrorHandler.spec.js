import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WS_ERROR_CODES,
  parseWsError,
  handleWsError,
  createWsErrorListener,
} from '../../src/core/errors/wsErrorHandler'

// Mock i18n
vi.mock('../../src/i18n', () => ({
  i18n: {
    global: {
      t: (key) => key,
    },
  },
}))

// Mock notify
vi.mock('../../src/utils/notify', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}))

import { notifyError, notifyWarning } from '../../src/utils/notify'

describe('wsErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('WS_ERROR_CODES', () => {
    it('has all expected error codes', () => {
      expect(WS_ERROR_CODES.WS_TIMEOUT).toBeDefined()
      expect(WS_ERROR_CODES.WS_INVALID_CHANNEL).toBeDefined()
      expect(WS_ERROR_CODES.WS_FORBIDDEN).toBeDefined()
      expect(WS_ERROR_CODES.WS_UNAUTHORIZED).toBeDefined()
      expect(WS_ERROR_CODES.WS_RATE_LIMITED).toBeDefined()
      expect(WS_ERROR_CODES.WS_MALFORMED_JSON).toBeDefined()
      expect(WS_ERROR_CODES.WS_SERVER_ERROR).toBeDefined()
    })
  })

  describe('parseWsError', () => {
    it('parses error with code', () => {
      const payload = { code: 'WS_TIMEOUT', detail: 'Connection timed out' }
      const result = parseWsError(payload)
      
      expect(result.code).toBe('WS_TIMEOUT')
      expect(result.isRecoverable).toBe(true)
    })

    it('normalizes code to uppercase', () => {
      const payload = { code: 'ws-forbidden' }
      const result = parseWsError(payload)
      
      expect(result.code).toBe('WS_FORBIDDEN')
      expect(result.isRecoverable).toBe(false)
    })

    it('marks forbidden/unauthorized as non-recoverable', () => {
      expect(parseWsError({ code: 'WS_FORBIDDEN' }).isRecoverable).toBe(false)
      expect(parseWsError({ code: 'WS_UNAUTHORIZED' }).isRecoverable).toBe(false)
      expect(parseWsError({ code: 'WS_TIMEOUT' }).isRecoverable).toBe(true)
    })

    it('handles null payload', () => {
      const result = parseWsError(null)
      
      expect(result.code).toBe('unknown')
      expect(result.isRecoverable).toBe(true)
    })

    it('uses detail as message when code is unknown', () => {
      const payload = { code: 'UNKNOWN_CODE', detail: 'Custom error message' }
      const result = parseWsError(payload)
      
      expect(result.message).toBe('Custom error message')
    })
  })

  describe('handleWsError', () => {
    it('shows error notification for forbidden', () => {
      handleWsError({ code: 'WS_FORBIDDEN' })
      
      expect(notifyError).toHaveBeenCalled()
    })

    it('shows warning notification for unauthorized', () => {
      handleWsError({ code: 'WS_UNAUTHORIZED' })
      
      expect(notifyWarning).toHaveBeenCalled()
    })

    it('shows warning notification for timeout', () => {
      handleWsError({ code: 'WS_TIMEOUT' })
      
      expect(notifyWarning).toHaveBeenCalled()
    })

    it('does not show notification when silent', () => {
      handleWsError({ code: 'WS_FORBIDDEN' }, { silent: true })
      
      expect(notifyError).not.toHaveBeenCalled()
      expect(notifyWarning).not.toHaveBeenCalled()
    })

    it('calls onForbidden callback', () => {
      const onForbidden = vi.fn()
      handleWsError({ code: 'WS_FORBIDDEN' }, { onForbidden, silent: true })
      
      expect(onForbidden).toHaveBeenCalled()
    })

    it('calls onUnauthorized callback', () => {
      const onUnauthorized = vi.fn()
      handleWsError({ code: 'WS_UNAUTHORIZED' }, { onUnauthorized, silent: true })
      
      expect(onUnauthorized).toHaveBeenCalled()
    })

    it('logs invalid channel errors without notification', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      handleWsError({ code: 'WS_INVALID_CHANNEL' })
      
      expect(consoleSpy).toHaveBeenCalled()
      expect(notifyError).not.toHaveBeenCalled()
      expect(notifyWarning).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('createWsErrorListener', () => {
    it('subscribes to error and message events', () => {
      const mockService = {
        on: vi.fn().mockReturnValue(() => {}),
      }
      
      const cleanup = createWsErrorListener(mockService)
      
      expect(mockService.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockService.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(typeof cleanup).toBe('function')
    })

    it('handles error events', () => {
      const handlers = {}
      const mockService = {
        on: vi.fn((event, handler) => {
          handlers[event] = handler
          return () => {}
        }),
      }
      
      createWsErrorListener(mockService)
      
      // Trigger error event
      handlers.error({ type: 'error', error: { code: 'WS_TIMEOUT' } })
      
      expect(notifyWarning).toHaveBeenCalled()
    })

    it('handles message-level errors', () => {
      const handlers = {}
      const mockService = {
        on: vi.fn((event, handler) => {
          handlers[event] = handler
          return () => {}
        }),
      }
      
      createWsErrorListener(mockService)
      
      // Trigger message with error type
      handlers.message({ type: 'error', code: 'WS_FORBIDDEN' })
      
      expect(notifyError).toHaveBeenCalled()
    })
  })
})
