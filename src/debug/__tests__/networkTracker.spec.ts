import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock apiClient as axios-like instance with interceptors
const mockRequestUse = vi.fn()
vi.mock('@/utils/apiClient', () => {
  return {
    default: {
      interceptors: {
        request: { use: (...args: any[]) => mockRequestUse(...args) },
        response: { use: vi.fn() },
      },
    },
  }
})

import {
  attachNetworkTracker,
  getNetworkStats,
  resetNetworkStats,
  detachNetworkTracker,
} from '../networkTracker'

describe('networkTracker', () => {
  let capturedInterceptor: (config: any) => any

  beforeEach(() => {
    detachNetworkTracker()
    mockRequestUse.mockReset()
    mockRequestUse.mockImplementation((fn: any) => {
      capturedInterceptor = fn
    })
  })

  it('counts requests via interceptor', () => {
    attachNetworkTracker()
    expect(mockRequestUse).toHaveBeenCalledTimes(1)

    // Simulate 3 POST requests (no dedup key)
    capturedInterceptor({ method: 'post', url: '/api/v1/auth/login' })
    capturedInterceptor({ method: 'post', url: '/api/v1/auth/login' })
    capturedInterceptor({ method: 'delete', url: '/api/v1/items/1' })

    const stats = getNetworkStats()
    expect(stats.requests).toBe(3)
    expect(stats.duplicates).toBe(0)
  })

  it('detects duplicates — same GET URL+params within window', () => {
    attachNetworkTracker(5_000)

    // First GET — not a duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(0)

    // Second identical GET within window — IS a duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(1)

    // Third identical GET — another duplicate
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    expect(getNetworkStats().duplicates).toBe(2)
  })

  it('different params produce different dedupe keys — no duplicate', () => {
    attachNetworkTracker(5_000)

    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'active' } })
    capturedInterceptor({ method: 'get', url: '/api/v1/relations', params: { status: 'pending' } })

    expect(getNetworkStats().duplicates).toBe(0)
    expect(getNetworkStats().requests).toBe(2)
  })

  it('reset clears counters', () => {
    attachNetworkTracker()

    capturedInterceptor({ method: 'get', url: '/api/v1/test' })
    capturedInterceptor({ method: 'get', url: '/api/v1/test' })
    expect(getNetworkStats().requests).toBe(2)
    expect(getNetworkStats().duplicates).toBe(1)

    resetNetworkStats()
    expect(getNetworkStats().requests).toBe(0)
    expect(getNetworkStats().duplicates).toBe(0)
  })

  it('does not modify request config (returns config as-is)', () => {
    attachNetworkTracker()

    const config = { method: 'get', url: '/test', params: { a: 1 }, headers: { 'X-Custom': 'val' } }
    const configBefore = JSON.stringify(config)
    const result = capturedInterceptor(config)

    expect(result).toBe(config)
    expect(JSON.stringify(result)).toBe(configBefore)
  })

  it('attaches interceptor only once', () => {
    attachNetworkTracker()
    attachNetworkTracker()
    attachNetworkTracker()

    expect(mockRequestUse).toHaveBeenCalledTimes(1)
  })
})
