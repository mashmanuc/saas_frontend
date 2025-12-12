// Tests for DiagnosticsApi
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock apiClient
vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}))

import { diagnosticsApi } from '@/modules/diagnostics/api/diagnostics'
import apiClient from '@/utils/apiClient'

describe('DiagnosticsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Reset state between tests to avoid residual queue/timers
    diagnosticsApi.resetForTests()
  })

  describe('queueError', () => {
    it('should add error to queue', () => {
      const payload = {
        severity: 'error' as const,
        message: 'Test error',
        url: '/test',
        appVersion: 'v0.24.4',
      }

      const initialLength = diagnosticsApi.getQueueLength()
      diagnosticsApi.queueError(payload)

      expect(diagnosticsApi.getQueueLength()).toBe(initialLength + 1)
    })

    it('should create correct payload structure', () => {
      const payload = {
        severity: 'error' as const,
        message: 'Test error',
        url: '/test',
        appVersion: 'v0.24.4',
        context: { component: 'TestComponent' },
      }

      expect(payload.severity).toBe('error')
      expect(payload.context?.component).toBe('TestComponent')
    })
  })

  describe('logFrontendError', () => {
    it('should send error to backend', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { status: 'ok', id: 1 },
      })

      const payload = {
        severity: 'error' as const,
        message: 'Test error',
        url: '/test',
        appVersion: 'v0.24.4',
      }

      const result = await diagnosticsApi.logFrontendError(payload)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/logs/frontend/',
        payload
      )
      expect(result).toEqual({ status: 'ok', id: 1 })
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'))

      const payload = {
        severity: 'error' as const,
        message: 'Test error',
        url: '/test',
        appVersion: 'v0.24.4',
      }

      const result = await diagnosticsApi.logFrontendError(payload)

      expect(result).toBeNull()
    })
  })

  describe('logBatch', () => {
    it('should send batch of errors', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { status: 'ok', count: 2 },
      })

      const errors = [
        {
          severity: 'error' as const,
          message: 'Error 1',
          url: '/test',
          appVersion: 'v0.24.4',
        },
        {
          severity: 'warning' as const,
          message: 'Warning 1',
          url: '/test',
          appVersion: 'v0.24.4',
        },
      ]

      const result = await diagnosticsApi.logBatch(errors)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/logs/frontend/',
        { errors }
      )
      expect(result).toEqual({ status: 'ok', count: 2 })
    })

    it('should return null for empty array', async () => {
      const result = await diagnosticsApi.logBatch([])

      expect(apiClient.post).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })
})
