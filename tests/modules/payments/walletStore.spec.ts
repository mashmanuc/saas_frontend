// Unit tests for walletStore (v0.23.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock payments API
vi.mock('@/modules/payments/api/payments', () => ({
  paymentsApi: {
    getWallet: vi.fn(),
    getTransactions: vi.fn(),
    getEarningsAnalytics: vi.fn(),
    getPayouts: vi.fn(),
    requestPayout: vi.fn(),
    cancelPayout: vi.fn(),
    updatePayoutSettings: vi.fn(),
  },
}))

import { useWalletStore } from '@/modules/payments/stores/walletStore'
import { paymentsApi } from '@/modules/payments/api/payments'

const mockWallet = {
  balance: 100000,
  pending: 20000,
  total_earned: 500000,
  total_withdrawn: 380000,
  currency: 'UAH',
  can_withdraw: true,
  payout_threshold: 50000,
}

const mockTransaction = {
  id: 1,
  transaction_type: 'earning' as const,
  amount: 50000,
  balance_after: 100000,
  description: 'Lesson with Student',
  created_at: '2024-12-10T10:00:00Z',
}

const mockPayout = {
  id: 1,
  uuid: 'payout-123',
  amount: 50000,
  currency: 'UAH',
  status: 'pending' as const,
  payout_method: 'bank',
  created_at: '2024-12-10T10:00:00Z',
  processed_at: null,
}

describe('walletStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have null wallet', () => {
      const store = useWalletStore()
      expect(store.wallet).toBeNull()
    })

    it('should have empty transactions', () => {
      const store = useWalletStore()
      expect(store.transactions).toEqual([])
    })

    it('should have empty payouts', () => {
      const store = useWalletStore()
      expect(store.payouts).toEqual([])
    })
  })

  describe('computed properties', () => {
    it('balance should return wallet balance', () => {
      const store = useWalletStore()
      store.wallet = mockWallet
      expect(store.balance).toBe(100000)
    })

    it('canWithdraw should reflect wallet state', () => {
      const store = useWalletStore()
      store.wallet = mockWallet
      expect(store.canWithdraw).toBe(true)
    })

    it('pendingPayouts should filter pending', () => {
      const store = useWalletStore()
      store.payouts = [
        { ...mockPayout, id: 1, status: 'pending' },
        { ...mockPayout, id: 2, status: 'completed' },
        { ...mockPayout, id: 3, status: 'approved' },
      ]
      expect(store.pendingPayouts).toHaveLength(2)
    })

    it('completedPayouts should filter completed', () => {
      const store = useWalletStore()
      store.payouts = [
        { ...mockPayout, id: 1, status: 'pending' },
        { ...mockPayout, id: 2, status: 'completed' },
      ]
      expect(store.completedPayouts).toHaveLength(1)
    })
  })

  describe('loadWallet action', () => {
    it('should load wallet from API', async () => {
      const store = useWalletStore()
      ;(paymentsApi.getWallet as any).mockResolvedValue(mockWallet)

      await store.loadWallet()

      expect(store.wallet).toEqual(mockWallet)
    })
  })

  describe('loadTransactions action', () => {
    it('should load transactions from API', async () => {
      const store = useWalletStore()
      const mockResponse = {
        count: 1,
        next: null,
        results: [mockTransaction],
      }
      ;(paymentsApi.getTransactions as any).mockResolvedValue(mockResponse)

      await store.loadTransactions({}, true)

      expect(store.transactions).toHaveLength(1)
    })
  })

  describe('loadAnalytics action', () => {
    it('should load analytics from API', async () => {
      const store = useWalletStore()
      const mockAnalytics = {
        total: 100000,
        average_per_lesson: 50000,
        lessons_count: 2,
        by_period: [],
      }
      ;(paymentsApi.getEarningsAnalytics as any).mockResolvedValue(mockAnalytics)

      await store.loadAnalytics('month')

      expect(store.analytics).toEqual(mockAnalytics)
    })
  })

  describe('requestPayout action', () => {
    it('should create payout and refresh wallet', async () => {
      const store = useWalletStore()
      store.wallet = mockWallet
      ;(paymentsApi.requestPayout as any).mockResolvedValue(mockPayout)
      ;(paymentsApi.getWallet as any).mockResolvedValue({
        ...mockWallet,
        balance: 50000,
      })

      const result = await store.requestPayout(50000)

      expect(result).toEqual(mockPayout)
      expect(store.payouts).toContain(mockPayout)
      expect(store.wallet?.balance).toBe(50000)
    })
  })

  describe('cancelPayout action', () => {
    it('should remove payout and refresh wallet', async () => {
      const store = useWalletStore()
      store.wallet = mockWallet
      store.payouts = [mockPayout]
      ;(paymentsApi.cancelPayout as any).mockResolvedValue(undefined)
      ;(paymentsApi.getWallet as any).mockResolvedValue(mockWallet)

      await store.cancelPayout(1)

      expect(store.payouts).toHaveLength(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const store = useWalletStore()
      store.wallet = mockWallet

      const formatted = store.formatCurrency(100000)

      expect(formatted).toContain('1')
      expect(formatted).toContain('000')
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = useWalletStore()
      store.wallet = mockWallet
      store.transactions = [mockTransaction]
      store.payouts = [mockPayout]

      store.$reset()

      expect(store.wallet).toBeNull()
      expect(store.transactions).toEqual([])
      expect(store.payouts).toEqual([])
    })
  })
})
