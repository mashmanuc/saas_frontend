import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockRequestUse = vi.fn()
vi.mock('@/utils/apiClient', () => ({
  default: {
    interceptors: {
      request: { use: (...args: any[]) => mockRequestUse(...args) },
      response: { use: vi.fn() },
    },
  },
}))

const mockGetAll = vi.fn()
vi.mock('@/app/queryClient', () => ({
  queryClient: {
    getQueryCache: () => ({
      getAll: mockGetAll,
    }),
  },
}))

const mockSubscribe = vi.fn()
vi.mock('@/services/realtime', () => ({
  realtimeService: {
    subscribe: (...args: any[]) => mockSubscribe(...args),
  },
}))

import {
  initAuditCollector,
  getAuditSnapshot,
  disposeAuditCollector,
} from '../auditCollector'
import { resetNetworkStats, detachNetworkTracker } from '../networkTracker'
import { resetWsStats, teardownWsTracker } from '../wsEventTracker'

describe('auditCollector', () => {
  beforeEach(() => {
    detachNetworkTracker()
    teardownWsTracker()
    resetNetworkStats()
    resetWsStats()
    mockRequestUse.mockReset()
    mockGetAll.mockReset()
    mockSubscribe.mockReset()
    mockSubscribe.mockReturnValue(() => {})
    mockGetAll.mockReturnValue([])
  })

  it('snapshot returns valid structure', () => {
    initAuditCollector()
    const snap = getAuditSnapshot()

    expect(snap).toHaveProperty('requests')
    expect(snap).toHaveProperty('duplicates')
    expect(snap).toHaveProperty('cacheTotal')
    expect(snap).toHaveProperty('cacheFresh')
    expect(snap).toHaveProperty('cacheStale')
    expect(snap).toHaveProperty('cacheHitRate')
    expect(snap).toHaveProperty('wsEventsInWindow')
    expect(snap).toHaveProperty('wsEventsTotal')
    expect(snap).toHaveProperty('status')
    expect(snap).toHaveProperty('timestamp')
    expect(typeof snap.timestamp).toBe('number')
  })

  it('status = ok when all metrics good', () => {
    mockGetAll.mockReturnValue([
      {
        state: { dataUpdatedAt: Date.now() - 5_000, fetchStatus: 'idle' },
        options: { staleTime: 60_000 },
      },
    ])
    initAuditCollector()

    const snap = getAuditSnapshot()
    expect(snap.status).toBe('ok')
    expect(snap.duplicates).toBe(0)
    expect(snap.cacheHitRate).toBe(1)
  })

  it('status = error when duplicates > 0', () => {
    initAuditCollector()

    // Simulate duplicates by calling the captured interceptor
    const interceptorFn = mockRequestUse.mock.calls[0]?.[0]
    if (interceptorFn) {
      // First call — new key
      interceptorFn({ method: 'get', url: '/api/test', params: {} })
      // Second call — same key → duplicate
      interceptorFn({ method: 'get', url: '/api/test', params: {} })
    }

    const snap = getAuditSnapshot()
    expect(snap.duplicates).toBeGreaterThanOrEqual(1)
    expect(snap.status).toBe('error')
  })

  it('status = warn when requests between 15-25', () => {
    initAuditCollector()

    const interceptorFn = mockRequestUse.mock.calls[0]?.[0]
    if (interceptorFn) {
      // Simulate 18 POST requests (no duplicates)
      for (let i = 0; i < 18; i++) {
        interceptorFn({ method: 'post', url: `/api/action/${i}` })
      }
    }

    const snap = getAuditSnapshot()
    expect(snap.requests).toBe(18)
    expect(snap.status).toBe('warn')
  })

  it('status = error when requests > 25', () => {
    initAuditCollector()

    const interceptorFn = mockRequestUse.mock.calls[0]?.[0]
    if (interceptorFn) {
      for (let i = 0; i < 30; i++) {
        interceptorFn({ method: 'post', url: `/api/action/${i}` })
      }
    }

    const snap = getAuditSnapshot()
    expect(snap.requests).toBe(30)
    expect(snap.status).toBe('error')
  })

  it('status = error when cache hit rate < 0.5', () => {
    const now = Date.now()
    mockGetAll.mockReturnValue([
      // All stale
      { state: { dataUpdatedAt: now - 120_000, fetchStatus: 'idle' }, options: { staleTime: 60_000 } },
      { state: { dataUpdatedAt: now - 120_000, fetchStatus: 'idle' }, options: { staleTime: 60_000 } },
      { state: { dataUpdatedAt: now - 120_000, fetchStatus: 'idle' }, options: { staleTime: 60_000 } },
    ])
    initAuditCollector()

    const snap = getAuditSnapshot()
    expect(snap.cacheHitRate).toBe(0)
    expect(snap.status).toBe('error')
  })

  it('disposeAuditCollector cleans up', () => {
    initAuditCollector()
    disposeAuditCollector()
    // Should not throw and snapshot still works with defaults
    const snap = getAuditSnapshot()
    expect(snap.status).toBe('ok')
  })
})
