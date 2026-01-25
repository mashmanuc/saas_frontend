import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLimitsStore } from '@/stores/limitsStore'
import type { LimitsResponse } from '@/types/relations'

const apiClientGetMock = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => apiClientGetMock(...args)
  }
}))

describe('limitsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchLimits stores payload and exposes computed helpers', async () => {
    const payload: LimitsResponse = {
      limits: [
        {
          limit_type: 'student_request',
          max_count: 5,
          current_count: 2,
          remaining: 3,
          reset_at: '2026-01-01T00:00:00Z',
          period_days: 30
        },
        {
          limit_type: 'tutor_accept',
          max_count: 10,
          current_count: 10,
          remaining: 0,
          reset_at: '2026-01-10T00:00:00Z',
          period_days: 30
        }
      ]
    }
    apiClientGetMock.mockResolvedValueOnce(payload)

    const store = useLimitsStore()
    await store.fetchLimits()

    expect(apiClientGetMock).toHaveBeenCalledWith('/v1/users/me/limits/')
    expect(store.limits).toHaveLength(2)
    expect(store.studentRequestLimit?.remaining).toBe(3)
    expect(store.tutorAcceptLimit?.remaining).toBe(0)
    expect(store.canPerformAction('student_request')).toBe(true)
    expect(store.canPerformAction('tutor_accept')).toBe(false)
  })

  it('handles fetch errors gracefully', async () => {
    apiClientGetMock.mockRejectedValueOnce(new Error('offline'))

    const store = useLimitsStore()
    await store.fetchLimits()

    expect(store.error).toBe('offline')
    expect(store.isLoading).toBe(false)
  })

  it('getLimitByType returns undefined when limit missing', () => {
    const store = useLimitsStore()
    expect(store.getLimitByType('unknown')).toBeUndefined()
    expect(store.canPerformAction('unknown')).toBe(true)
  })
})
