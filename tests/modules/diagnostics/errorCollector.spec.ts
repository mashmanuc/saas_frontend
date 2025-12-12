// Tests for ErrorCollector plugin
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock diagnosticsApi
vi.mock('@/modules/diagnostics/api/diagnostics', () => ({
  diagnosticsApi: {
    queueError: vi.fn(),
  },
}))

// Mock useDiagnostics
vi.mock('@/modules/diagnostics/composables/useDiagnostics', () => ({
  useDiagnostics: () => ({
    addLocalLog: vi.fn(),
  }),
}))

import { createErrorCollector, setCurrentRoute } from '@/modules/diagnostics/plugins/errorCollector'
import { diagnosticsApi } from '@/modules/diagnostics/api/diagnostics'

describe('ErrorCollector', () => {
  let errorCollector: ReturnType<typeof createErrorCollector>

  beforeEach(() => {
    vi.clearAllMocks()
    errorCollector = createErrorCollector({ mode: 'console+remote' })
  })

  describe('install', () => {
    it('should set Vue error handler', () => {
      const mockApp = {
        config: {
          errorHandler: null as unknown,
          warnHandler: null as unknown,
          globalProperties: {} as Record<string, unknown>,
        },
        version: '3.5.0',
      }

      errorCollector.install(mockApp as never)

      expect(mockApp.config.errorHandler).toBeDefined()
      expect(typeof mockApp.config.errorHandler).toBe('function')
    })

    it('should expose $diagnostics on globalProperties', () => {
      const mockApp = {
        config: {
          errorHandler: null as unknown,
          warnHandler: null as unknown,
          globalProperties: {} as Record<string, unknown>,
        },
        version: '3.5.0',
      }

      errorCollector.install(mockApp as never)

      expect(mockApp.config.globalProperties.$diagnostics).toBeDefined()
      expect(mockApp.config.globalProperties.$diagnostics.log).toBeDefined()
      expect(mockApp.config.globalProperties.$diagnostics.warn).toBeDefined()
      expect(mockApp.config.globalProperties.$diagnostics.error).toBeDefined()
    })
  })

  describe('handleError', () => {
    it('should queue error to diagnosticsApi', () => {
      errorCollector.handleError('error', 'Test error message', 'stack trace', {
        component: 'TestComponent',
      })

      expect(diagnosticsApi.queueError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          message: 'Test error message',
          stack: 'stack trace',
          context: expect.objectContaining({
            component: 'TestComponent',
          }),
        })
      )
    })

    it('should handle warning severity', () => {
      errorCollector.handleError('warning', 'Test warning', undefined, {})

      expect(diagnosticsApi.queueError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          message: 'Test warning',
        })
      )
    })

    it('should handle info severity', () => {
      errorCollector.handleError('info', 'Test info', undefined, {})

      expect(diagnosticsApi.queueError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'info',
          message: 'Test info',
        })
      )
    })
  })

  describe('ignore patterns', () => {
    it('should ignore ResizeObserver errors', () => {
      errorCollector.handleError(
        'error',
        'ResizeObserver loop limit exceeded',
        undefined,
        {}
      )

      expect(diagnosticsApi.queueError).not.toHaveBeenCalled()
    })

    it('should ignore Loading chunk errors', () => {
      errorCollector.handleError(
        'error',
        'Loading chunk 123 failed',
        undefined,
        {}
      )

      expect(diagnosticsApi.queueError).not.toHaveBeenCalled()
    })

    it('should ignore Network Error', () => {
      errorCollector.handleError('error', 'Network Error', undefined, {})

      expect(diagnosticsApi.queueError).not.toHaveBeenCalled()
    })
  })

  describe('setCurrentRoute', () => {
    it('should update route info', () => {
      setCurrentRoute({
        name: 'test-route',
        path: '/test',
        params: { id: '123' },
        query: { q: 'search' },
      })

      errorCollector.handleError('error', 'Test error', undefined, {})

      expect(diagnosticsApi.queueError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            route: expect.objectContaining({
              name: 'test-route',
              path: '/test',
            }),
          }),
        })
      )
    })
  })

  describe('silent mode', () => {
    it('should not queue errors in silent mode', () => {
      const silentCollector = createErrorCollector({ mode: 'silent' })

      silentCollector.handleError('error', 'Test error', undefined, {})

      expect(diagnosticsApi.queueError).not.toHaveBeenCalled()
    })
  })
})
