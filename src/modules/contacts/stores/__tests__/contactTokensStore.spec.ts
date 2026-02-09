/**
 * Unit tests for contactTokensStore
 * 
 * Tests for contact tokens state management and API integration.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContactTokensStore } from '../contactTokensStore'
import * as contactsApi from '../../api/contacts'

// Mock contactsApi
vi.mock('../../api/contacts')

describe('contactTokensStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('state', () => {
    it('should initialize with default state', () => {
      const store = useContactTokensStore()
      
      expect(store.balance).toBe(0)
      expect(store.ledger).toEqual([])
      expect(store.packages).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('fetchBalance', () => {
    it('should fetch balance successfully', async () => {
      const mockBalance = {
        balance: 5,
        pending_grants: 0,
        last_grant_date: '2026-01-01T00:00:00Z',
        next_allowance_date: '2026-02-01T00:00:00Z',
        plan_allowance: 5
      }
      
      vi.mocked(contactsApi.contactsApi.getBalance).mockResolvedValue(mockBalance)
      
      const store = useContactTokensStore()
      await store.fetchBalance()
      
      expect(store.balance).toBe(5)
      expect(store.pendingGrants).toBe(0)
      expect(store.planAllowance).toBe(5)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should handle fetch error', async () => {
      vi.mocked(contactsApi.contactsApi.getBalance).mockRejectedValue(new Error('Network error'))
      
      const store = useContactTokensStore()
      
      await expect(store.fetchBalance()).rejects.toThrow('Network error')
      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchLedger', () => {
    it('should fetch ledger successfully', async () => {
      const mockLedger = {
        results: [
          { id: 1, type: 'GRANT', amount: 5, balance_after: 5, created_at: '2026-01-01', description: 'Monthly allowance' },
          { id: 2, type: 'DEDUCTION', amount: -1, balance_after: 4, created_at: '2026-01-02', description: 'Contact unlock' }
        ],
        count: 2,
        next: null,
        previous: null
      }
      
      vi.mocked(contactsApi.contactsApi.getLedger).mockResolvedValue(mockLedger)
      
      const store = useContactTokensStore()
      await store.fetchLedger()
      
      expect(store.ledger).toEqual(mockLedger.results)
      expect(store.ledgerCount).toBe(2)
      expect(store.ledgerHasMore).toBe(false)
    })
  })

  describe('purchaseTokens', () => {
    it('should initiate purchase successfully', async () => {
      const mockResponse = { 
        provider: 'liqpay',
        redirect_url: 'https://payment.example.com/checkout',
        order_id: 'order-123'
      }
      
      vi.mocked(contactsApi.contactsApi.purchaseTokens).mockResolvedValue(mockResponse)
      
      const store = useContactTokensStore()
      const result = await store.purchaseTokens('basic', { success: '/success', cancel: '/cancel' })
      
      expect(result.redirectUrl).toBe('https://payment.example.com/checkout')
      expect(result.provider).toBe('liqpay')
    })

    it('should handle purchase error', async () => {
      vi.mocked(contactsApi.contactsApi.purchaseTokens).mockRejectedValue(new Error('Payment error'))
      
      const store = useContactTokensStore()
      
      await expect(store.purchaseTokens('basic', { success: '', cancel: '' })).rejects.toThrow('Payment error')
      expect(store.error).toBe('Payment error')
    })
  })

  describe('getters', () => {
    it('should return hasLowBalance', () => {
      const store = useContactTokensStore()
      
      store.balance = 2
      expect(store.hasLowBalance).toBe(true)
      
      store.balance = 4
      expect(store.hasLowBalance).toBe(false)
    })

    it('should return hasNoTokens', () => {
      const store = useContactTokensStore()
      
      store.balance = 0
      expect(store.hasNoTokens).toBe(true)
      
      store.balance = 1
      expect(store.hasNoTokens).toBe(false)
    })

    it('should return formattedBalance', () => {
      const store = useContactTokensStore()
      store.balance = 1000
      
      expect(store.formattedBalance).toBe('1\u00A0000')
    })
  })

  describe('$reset', () => {
    it('should reset all state', () => {
      const store = useContactTokensStore()
      store.balance = 10
      store.ledger = [{ id: 1, type: 'GRANT' as const, amount: 5, balance_after: 5, created_at: '', description: '' }]
      store.error = 'Some error'
      
      store.$reset()
      
      expect(store.balance).toBe(0)
      expect(store.ledger).toEqual([])
      expect(store.error).toBeNull()
    })
  })
})
