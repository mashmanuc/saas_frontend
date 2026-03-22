/**
 * Phase 29 B4: Tests for useUserContextQuery composable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useUserContextQuery } from '@/api/queries/useUserContextQuery'

const mockGet = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
  },
}))

function mountWithQuery(composable: () => any) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  let result: any
  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })

  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })

  return { result, queryClient, wrapper }
}

describe('useUserContextQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({
      entitlements: { plan: 'PRO', features: ['advanced_calendar'], expires_at: null, is_in_grace_period: false, grace_period_until: null },
      limits: { limits: [{ limit_type: 'student_request', max_count: 10, current_count: 5, remaining: 5, reset_at: null, period_days: 30 }] },
      billing: { balance: 100 },
    })
  })

  it('fetches user context and provides convenience accessors', async () => {
    const { result } = mountWithQuery(() => useUserContextQuery())
    expect(result.isLoading.value).toBe(true)
    expect(result.plan).toBeDefined()
    expect(result.entitlements).toBeDefined()
    expect(result.limits).toBeDefined()
    expect(result.billing).toBeDefined()
    expect(result.isPro).toBeDefined()
    expect(result.isFree).toBeDefined()

    await flushPromises()

    expect(mockGet).toHaveBeenCalledWith('/v1/users/me/context/')
    expect(result.plan.value).toBe('PRO')
    expect(result.isPro.value).toBe(true)
    expect(result.isFree.value).toBe(false)
    expect(result.entitlements.value.features).toContain('advanced_calendar')
    expect(result.limits.value).toHaveLength(1)
    expect(result.limits.value[0].limit_type).toBe('student_request')
    expect(result.billing.value.balance).toBe(100)
  })

  it('returns FREE plan defaults before data loads', () => {
    const { result } = mountWithQuery(() => useUserContextQuery())
    expect(result.plan.value).toBe('FREE')
    expect(result.isFree.value).toBe(true)
    expect(result.isPro.value).toBe(false)
    expect(result.entitlements.value).toBeNull()
    expect(result.limits.value).toEqual([])
    expect(result.billing.value).toBeNull()
  })

  it('can be disabled', () => {
    const { result } = mountWithQuery(() => useUserContextQuery({ enabled: false }))
    expect(result.isFetching.value).toBe(false)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('uses staleTime 5 min', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

    let result: any
    mount(defineComponent({
      setup() {
        result = useUserContextQuery()
        return () => h('div')
      },
    }), {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    expect(mockGet).toHaveBeenCalledTimes(1)

    // Query should be fresh — second mount should NOT trigger fetch
    let result2: any
    mount(defineComponent({
      setup() {
        result2 = useUserContextQuery()
        return () => h('div')
      },
    }), {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()
    // Same queryClient, staleTime 5 min → no second network call
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
