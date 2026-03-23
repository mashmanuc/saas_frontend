import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock queryClient
const mockGetAll = vi.fn()
vi.mock('@/app/queryClient', () => ({
  queryClient: {
    getQueryCache: () => ({
      getAll: mockGetAll,
    }),
  },
}))

import { inspectQueryCache } from '../cacheInspector'

describe('cacheInspector', () => {
  beforeEach(() => {
    mockGetAll.mockReset()
  })

  it('returns hitRate=1 for empty cache', () => {
    mockGetAll.mockReturnValue([])

    const stats = inspectQueryCache()
    expect(stats).toEqual({ total: 0, fresh: 0, stale: 0, hitRate: 1 })
  })

  it('calculates fresh/stale correctly (only eligible queries with dataUpdatedAt)', () => {
    const now = Date.now()
    mockGetAll.mockReturnValue([
      // Fresh: fetched 10s ago, staleTime 60s, not fetching
      {
        state: { dataUpdatedAt: now - 10_000, fetchStatus: 'idle' },
        options: { staleTime: 60_000 },
      },
      // Stale: fetched 120s ago, staleTime 60s
      {
        state: { dataUpdatedAt: now - 120_000, fetchStatus: 'idle' },
        options: { staleTime: 60_000 },
      },
      // No dataUpdatedAt (never fetched) — NOT eligible for hitRate calc
      {
        state: { dataUpdatedAt: 0, fetchStatus: 'idle' },
        options: { staleTime: 60_000 },
      },
    ])

    const stats = inspectQueryCache()
    expect(stats.total).toBe(3)
    expect(stats.fresh).toBe(1)
    // stale = total - fresh = 3 - 1 = 2
    expect(stats.stale).toBe(2)
    // hitRate = fresh / eligible(2) = 1/2 = 0.5
    expect(stats.hitRate).toBe(0.5)
  })

  it('fresh query that is currently fetching is NOT counted as hit', () => {
    const now = Date.now()
    mockGetAll.mockReturnValue([
      // Fresh by time but currently fetching — will refetch on mount → not a "hit"
      {
        state: { dataUpdatedAt: now - 5_000, fetchStatus: 'fetching' },
        options: { staleTime: 60_000 },
      },
      // Fresh and idle — IS a hit
      {
        state: { dataUpdatedAt: now - 5_000, fetchStatus: 'idle' },
        options: { staleTime: 60_000 },
      },
    ])

    const stats = inspectQueryCache()
    expect(stats.fresh).toBe(1) // only the idle one
    expect(stats.hitRate).toBe(0.5) // 1 hit / 2 eligible
  })

  it('handles error gracefully (returns defaults)', () => {
    mockGetAll.mockImplementation(() => { throw new Error('cache broken') })

    const stats = inspectQueryCache()
    expect(stats).toEqual({ total: 0, fresh: 0, stale: 0, hitRate: 1 })
  })

  it('all queries without dataUpdatedAt → hitRate=0', () => {
    mockGetAll.mockReturnValue([
      { state: { dataUpdatedAt: 0, fetchStatus: 'idle' }, options: {} },
      { state: { dataUpdatedAt: 0, fetchStatus: 'fetching' }, options: {} },
    ])

    const stats = inspectQueryCache()
    expect(stats.total).toBe(2)
    expect(stats.fresh).toBe(0)
    expect(stats.hitRate).toBe(0)
  })
})
