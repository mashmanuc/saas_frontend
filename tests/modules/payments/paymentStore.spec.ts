// Unit tests for paymentStore (v0.23.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock payments API
vi.mock('@/modules/payments/api/payments', () => ({
  paymentsApi: {
    createPaymentIntent: vi.fn(),
    confirmPayment: vi.fn(),
    getPayments: vi.fn(),
    getPayment: vi.fn(),
    requestRefund: vi.fn(),
    getPaymentMethods: vi.fn(),
    addPaymentMethod: vi.fn(),
    removePaymentMethod: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
  },
}))

import { usePaymentStore } from '@/modules/payments/stores/paymentStore'
import { paymentsApi } from '@/modules/payments/api/payments'

const mockPayment = {
  id: 1,
  uuid: 'pay-123456',
  payment_type: 'lesson' as const,
  status: 'completed' as const,
  amount: 50000,
  currency: 'UAH',
  platform_fee: 5000,
  net_amount: 45000,
  description: 'Lesson with John',
  paid_at: '2024-12-10T10:00:00Z',
  created_at: '2024-12-10T09:55:00Z',
}

const mockPaymentMethod = {
  id: 1,
  card_brand: 'visa',
  card_last4: '4242',
  card_exp_month: 12,
  card_exp_year: 2025,
  is_default: true,
}

describe('paymentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty payments array', () => {
      const store = usePaymentStore()
      expect(store.payments).toEqual([])
    })

    it('should have null currentPayment', () => {
      const store = usePaymentStore()
      expect(store.currentPayment).toBeNull()
    })

    it('should not be loading', () => {
      const store = usePaymentStore()
      expect(store.isLoading).toBe(false)
    })

    it('should not have checkout in progress', () => {
      const store = usePaymentStore()
      expect(store.checkoutInProgress).toBe(false)
    })
  })

  describe('computed properties', () => {
    it('defaultPaymentMethod should return default method', () => {
      const store = usePaymentStore()
      store.paymentMethods = [
        { ...mockPaymentMethod, id: 1, is_default: false },
        { ...mockPaymentMethod, id: 2, is_default: true },
      ]
      expect(store.defaultPaymentMethod?.id).toBe(2)
    })

    it('completedPayments should filter completed', () => {
      const store = usePaymentStore()
      store.payments = [
        { ...mockPayment, id: 1, status: 'completed' },
        { ...mockPayment, id: 2, status: 'pending' },
        { ...mockPayment, id: 3, status: 'completed' },
      ]
      expect(store.completedPayments).toHaveLength(2)
    })

    it('pendingPayments should filter pending/processing', () => {
      const store = usePaymentStore()
      store.payments = [
        { ...mockPayment, id: 1, status: 'pending' },
        { ...mockPayment, id: 2, status: 'processing' },
        { ...mockPayment, id: 3, status: 'completed' },
      ]
      expect(store.pendingPayments).toHaveLength(2)
    })

    it('totalSpent should sum completed payments', () => {
      const store = usePaymentStore()
      store.payments = [
        { ...mockPayment, id: 1, status: 'completed', amount: 10000 },
        { ...mockPayment, id: 2, status: 'completed', amount: 20000 },
        { ...mockPayment, id: 3, status: 'pending', amount: 30000 },
      ]
      expect(store.totalSpent).toBe(30000)
    })
  })

  describe('loadPayments action', () => {
    it('should load payments from API', async () => {
      const store = usePaymentStore()
      const mockResponse = {
        count: 2,
        next: null,
        previous: null,
        results: [mockPayment, { ...mockPayment, id: 2 }],
      }
      ;(paymentsApi.getPayments as any).mockResolvedValue(mockResponse)

      await store.loadPayments({}, true)

      expect(paymentsApi.getPayments).toHaveBeenCalled()
      expect(store.payments).toHaveLength(2)
      expect(store.totalCount).toBe(2)
    })

    it('should append payments when not reset', async () => {
      const store = usePaymentStore()
      store.payments = [mockPayment]
      store.currentPage = 1

      const mockResponse = {
        count: 2,
        next: null,
        results: [{ ...mockPayment, id: 2 }],
      }
      ;(paymentsApi.getPayments as any).mockResolvedValue(mockResponse)

      await store.loadPayments({}, false)

      expect(store.payments).toHaveLength(2)
    })
  })

  describe('loadPaymentMethods action', () => {
    it('should load payment methods from API', async () => {
      const store = usePaymentStore()
      ;(paymentsApi.getPaymentMethods as any).mockResolvedValue([mockPaymentMethod])

      await store.loadPaymentMethods()

      expect(store.paymentMethods).toHaveLength(1)
    })
  })

  describe('initiatePayment action', () => {
    it('should create payment intent', async () => {
      const store = usePaymentStore()
      const mockResponse = {
        payment_id: 1,
        client_secret: 'pi_secret_123',
      }
      ;(paymentsApi.createPaymentIntent as any).mockResolvedValue(mockResponse)

      const result = await store.initiatePayment({
        amount: 50000,
        payment_type: 'lesson',
        booking_id: 1,
      })

      expect(store.checkoutInProgress).toBe(true)
      expect(store.clientSecret).toBe('pi_secret_123')
      expect(store.pendingPaymentId).toBe(1)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('confirmPayment action', () => {
    it('should confirm payment and update state', async () => {
      const store = usePaymentStore()
      store.pendingPaymentId = 1
      ;(paymentsApi.confirmPayment as any).mockResolvedValue(mockPayment)

      const result = await store.confirmPayment('pi_123')

      expect(result).toEqual(mockPayment)
      expect(store.currentPayment).toEqual(mockPayment)
      expect(store.checkoutInProgress).toBe(false)
      expect(store.clientSecret).toBeNull()
      expect(store.pendingPaymentId).toBeNull()
    })

    it('should throw if no pending payment', async () => {
      const store = usePaymentStore()

      await expect(store.confirmPayment('pi_123')).rejects.toThrow('No pending payment')
    })
  })

  describe('addPaymentMethod action', () => {
    it('should add method to list', async () => {
      const store = usePaymentStore()
      ;(paymentsApi.addPaymentMethod as any).mockResolvedValue(mockPaymentMethod)

      await store.addPaymentMethod('pm_123')

      expect(store.paymentMethods).toContain(mockPaymentMethod)
    })
  })

  describe('removePaymentMethod action', () => {
    it('should remove method from list', async () => {
      const store = usePaymentStore()
      store.paymentMethods = [mockPaymentMethod]
      ;(paymentsApi.removePaymentMethod as any).mockResolvedValue(undefined)

      await store.removePaymentMethod(1)

      expect(store.paymentMethods).toHaveLength(0)
    })
  })

  describe('setDefaultMethod action', () => {
    it('should update default flag', async () => {
      const store = usePaymentStore()
      store.paymentMethods = [
        { ...mockPaymentMethod, id: 1, is_default: true },
        { ...mockPaymentMethod, id: 2, is_default: false },
      ]
      ;(paymentsApi.setDefaultPaymentMethod as any).mockResolvedValue({
        ...mockPaymentMethod,
        id: 2,
        is_default: true,
      })

      await store.setDefaultMethod(2)

      expect(store.paymentMethods[0].is_default).toBe(false)
      expect(store.paymentMethods[1].is_default).toBe(true)
    })
  })

  describe('resetCheckout action', () => {
    it('should reset checkout state', () => {
      const store = usePaymentStore()
      store.checkoutInProgress = true
      store.clientSecret = 'secret'
      store.pendingPaymentId = 1

      store.resetCheckout()

      expect(store.checkoutInProgress).toBe(false)
      expect(store.clientSecret).toBeNull()
      expect(store.pendingPaymentId).toBeNull()
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = usePaymentStore()
      store.payments = [mockPayment]
      store.paymentMethods = [mockPaymentMethod]
      store.checkoutInProgress = true

      store.$reset()

      expect(store.payments).toEqual([])
      expect(store.paymentMethods).toEqual([])
      expect(store.checkoutInProgress).toBe(false)
    })
  })
})
