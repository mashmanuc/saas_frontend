// Unit tests for subscriptionStore (v0.23.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock payments API
vi.mock('@/modules/payments/api/payments', () => ({
  paymentsApi: {
    getPlans: vi.fn(),
    getCurrentSubscription: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    changePlan: vi.fn(),
    getInvoices: vi.fn(),
    downloadInvoicePdf: vi.fn(),
  },
}))

import { useSubscriptionStore } from '@/modules/payments/stores/subscriptionStore'
import { paymentsApi } from '@/modules/payments/api/payments'

const mockPlan = {
  id: 1,
  name: 'Basic',
  slug: 'basic',
  description: 'Basic plan',
  price: 50000,
  currency: 'UAH',
  interval: 'monthly' as const,
  lessons_per_month: 4,
  features: ['Feature 1', 'Feature 2'],
  is_featured: false,
}

const mockSubscription = {
  id: 1,
  plan: mockPlan,
  status: 'active' as const,
  current_period_start: '2024-12-01T00:00:00Z',
  current_period_end: '2024-12-31T23:59:59Z',
  cancel_at_period_end: false,
  lessons_used_this_period: 2,
}

describe('subscriptionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty plans', () => {
      const store = useSubscriptionStore()
      expect(store.plans).toEqual([])
    })

    it('should have null currentSubscription', () => {
      const store = useSubscriptionStore()
      expect(store.currentSubscription).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('hasActiveSubscription should be true for active', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = mockSubscription
      expect(store.hasActiveSubscription).toBe(true)
    })

    it('hasActiveSubscription should be true for trialing', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = { ...mockSubscription, status: 'trialing' }
      expect(store.hasActiveSubscription).toBe(true)
    })

    it('hasActiveSubscription should be false for cancelled', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = { ...mockSubscription, status: 'cancelled' }
      expect(store.hasActiveSubscription).toBe(false)
    })

    it('currentPlan should return subscription plan', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = mockSubscription
      expect(store.currentPlan).toEqual(mockPlan)
    })

    it('lessonsRemaining should calculate correctly', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = mockSubscription
      expect(store.lessonsRemaining).toBe(2) // 4 - 2
    })

    it('lessonsRemaining should be Infinity for unlimited', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = {
        ...mockSubscription,
        plan: { ...mockPlan, lessons_per_month: 0 },
      }
      expect(store.lessonsRemaining).toBe(Infinity)
    })

    it('featuredPlan should return featured plan', () => {
      const store = useSubscriptionStore()
      store.plans = [
        mockPlan,
        { ...mockPlan, id: 2, is_featured: true },
      ]
      expect(store.featuredPlan?.id).toBe(2)
    })

    it('sortedPlans should sort by price', () => {
      const store = useSubscriptionStore()
      store.plans = [
        { ...mockPlan, id: 1, price: 100000 },
        { ...mockPlan, id: 2, price: 50000 },
        { ...mockPlan, id: 3, price: 75000 },
      ]
      expect(store.sortedPlans[0].id).toBe(2)
      expect(store.sortedPlans[1].id).toBe(3)
      expect(store.sortedPlans[2].id).toBe(1)
    })

    it('isCancelling should reflect cancel_at_period_end', () => {
      const store = useSubscriptionStore()
      store.currentSubscription = {
        ...mockSubscription,
        cancel_at_period_end: true,
      }
      expect(store.isCancelling).toBe(true)
    })
  })

  describe('loadPlans action', () => {
    it('should load plans from API', async () => {
      const store = useSubscriptionStore()
      ;(paymentsApi.getPlans as any).mockResolvedValue([mockPlan])

      await store.loadPlans()

      expect(store.plans).toHaveLength(1)
    })
  })

  describe('loadCurrentSubscription action', () => {
    it('should load subscription from API', async () => {
      const store = useSubscriptionStore()
      ;(paymentsApi.getCurrentSubscription as any).mockResolvedValue(mockSubscription)

      await store.loadCurrentSubscription()

      expect(store.currentSubscription).toEqual(mockSubscription)
    })
  })

  describe('subscribe action', () => {
    it('should create subscription', async () => {
      const store = useSubscriptionStore()
      ;(paymentsApi.createSubscription as any).mockResolvedValue(mockSubscription)

      const result = await store.subscribe(1)

      expect(result).toEqual(mockSubscription)
      expect(store.currentSubscription).toEqual(mockSubscription)
    })
  })

  describe('cancelSubscription action', () => {
    it('should cancel subscription', async () => {
      const store = useSubscriptionStore()
      const cancelled = { ...mockSubscription, cancel_at_period_end: true }
      ;(paymentsApi.cancelSubscription as any).mockResolvedValue(cancelled)

      const result = await store.cancelSubscription(true)

      expect(result.cancel_at_period_end).toBe(true)
      expect(store.currentSubscription?.cancel_at_period_end).toBe(true)
    })
  })

  describe('reactivate action', () => {
    it('should reactivate subscription', async () => {
      const store = useSubscriptionStore()
      const reactivated = { ...mockSubscription, cancel_at_period_end: false }
      ;(paymentsApi.reactivateSubscription as any).mockResolvedValue(reactivated)

      const result = await store.reactivate()

      expect(result.cancel_at_period_end).toBe(false)
    })
  })

  describe('changePlan action', () => {
    it('should change plan', async () => {
      const store = useSubscriptionStore()
      const newPlan = { ...mockPlan, id: 2, name: 'Pro' }
      const updated = { ...mockSubscription, plan: newPlan }
      ;(paymentsApi.changePlan as any).mockResolvedValue(updated)

      const result = await store.changePlan(2)

      expect(result.plan.id).toBe(2)
      expect(store.currentSubscription?.plan.id).toBe(2)
    })
  })

  describe('getPlanById', () => {
    it('should find plan by id', () => {
      const store = useSubscriptionStore()
      store.plans = [mockPlan, { ...mockPlan, id: 2 }]

      expect(store.getPlanById(2)?.id).toBe(2)
    })

    it('should return undefined if not found', () => {
      const store = useSubscriptionStore()
      store.plans = [mockPlan]

      expect(store.getPlanById(999)).toBeUndefined()
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = useSubscriptionStore()
      store.plans = [mockPlan]
      store.currentSubscription = mockSubscription

      store.$reset()

      expect(store.plans).toEqual([])
      expect(store.currentSubscription).toBeNull()
    })
  })
})
