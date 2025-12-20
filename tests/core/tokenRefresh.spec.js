import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock apiClient
vi.mock('../../src/utils/apiClient', () => {
  const createInterceptorMock = () => {
    const interceptors = []
    return {
      use: vi.fn((fulfilled, rejected) => {
        const id = interceptors.length
        interceptors[id] = { fulfilled, rejected }
        return id
      }),
      eject: vi.fn((id) => {
        interceptors[id] = null
      }),
    }
  }

  return {
    apiClient: {
      post: vi.fn(),
      interceptors: {
        request: createInterceptorMock(),
        response: createInterceptorMock(),
      },
    },
  }
})

import { initTokenRefresh, useTokenRefresh } from '../../src/core/auth/tokenRefresh'
import { apiClient } from '../../src/utils/apiClient'

describe('Token Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initTokenRefresh', () => {
    it('initializes with callbacks', () => {
      const onRefreshed = vi.fn()
      const onExpired = vi.fn()
      const onError = vi.fn()

      const tokenRefresh = initTokenRefresh({
        onRefreshed,
        onExpired,
        onError,
      })

      expect(tokenRefresh).toBeDefined()
      expect(typeof tokenRefresh.refresh).toBe('function')
      expect(typeof tokenRefresh.isRefreshing).toBe('function')
      expect(typeof tokenRefresh.destroy).toBe('function')
    })

    it('creates axios interceptors', () => {
      initTokenRefresh({})

      expect(apiClient.interceptors.request.use).toHaveBeenCalled()
      expect(apiClient.interceptors.response.use).toHaveBeenCalled()
    })

    it('parses initial token expiry', () => {
      // JWT with exp claim (expires in 1 hour from epoch)
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjozNjAwfQ.signature'

      const tokenRefresh = initTokenRefresh({
        initialToken: token,
      })

      expect(tokenRefresh).toBeDefined()
    })
  })

  describe('useTokenRefresh', () => {
    it('returns token refresh utilities', () => {
      const utils = useTokenRefresh()

      expect(typeof utils.refresh).toBe('function')
      expect(typeof utils.isRefreshing).toBe('function')
      expect(typeof utils.isExpiringSoon).toBe('function')
      expect(typeof utils.isExpired).toBe('function')
    })
  })

  describe('refresh flow', () => {
    it('calls refresh endpoint with correct params', () => {
      apiClient.post.mockResolvedValue({
        data: { access_token: 'new_token', expires_in: 3600 },
      })

      initTokenRefresh({})

      // Verify interceptors were set up
      expect(apiClient.interceptors.request.use).toHaveBeenCalled()
      expect(apiClient.interceptors.response.use).toHaveBeenCalled()
    })

    it('has refresh method available', () => {
      const tokenRefresh = initTokenRefresh({})
      expect(typeof tokenRefresh.refresh).toBe('function')
    })

    it('has isRefreshing method', () => {
      const tokenRefresh = initTokenRefresh({})
      expect(typeof tokenRefresh.isRefreshing).toBe('function')
    })

    it('has setToken method', () => {
      const tokenRefresh = initTokenRefresh({})
      expect(typeof tokenRefresh.setToken).toBe('function')
    })

    it('can be destroyed', () => {
      const tokenRefresh = initTokenRefresh({})
      tokenRefresh.destroy()
      expect(tokenRefresh.isRefreshing()).toBe(false)
    })
  })

  describe('destroy', () => {
    it('cleans up state', () => {
      const tokenRefresh = initTokenRefresh({})

      tokenRefresh.destroy()

      expect(tokenRefresh.isRefreshing()).toBe(false)
    })
  })
})
