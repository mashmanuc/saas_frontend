/**
 * Unit tests for contactsStore - Phase 2.3
 * 
 * Tests:
 * - Pagination (limit+offset)
 * - afterAcceptRefresh triggers refetch
 * - loadMoreLedger appends correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContactsStore } from '../contactsStore'
import * as billingApi from '@/api/billing'

vi.mock('@/api/billing')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: vi.fn()
}))

describe('contactsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Pagination (INV-1: limit+offset)', () => {
    it('should fetch ledger with limit and offset', async () => {
      const mockLedger = [
        { id: 1, transaction_type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01', inquiry_id: null },
        { id: 2, transaction_type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactLedger).mockResolvedValue(mockLedger)
      
      const store = useContactsStore()
      await store.fetchLedger({ limit: 2, offset: 0, append: false })
      
      expect(billingApi.getContactLedger).toHaveBeenCalledWith(2, 0)
      expect(store.ledger).toEqual(mockLedger)
      expect(store.ledgerOffset).toBe(2)
      expect(store.ledgerHasMore).toBe(true)
    })

    it('should set hasMore to false when fewer items returned than limit', async () => {
      const mockLedger = [
        { id: 1, transaction_type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactLedger).mockResolvedValue(mockLedger)
      
      const store = useContactsStore()
      await store.fetchLedger({ limit: 50, offset: 0, append: false })
      
      expect(store.ledgerHasMore).toBe(false)
    })

    it('should append items when append=true', async () => {
      const firstBatch = [
        { id: 1, transaction_type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01', inquiry_id: null }
      ]
      const secondBatch = [
        { id: 2, transaction_type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactLedger)
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch)
      
      const store = useContactsStore()
      await store.fetchLedger({ limit: 1, offset: 0, append: false })
      await store.fetchLedger({ limit: 1, offset: 1, append: true })
      
      expect(store.ledger).toHaveLength(2)
      expect(store.ledger[0].id).toBe(1)
      expect(store.ledger[1].id).toBe(2)
      expect(store.ledgerOffset).toBe(2)
    })
  })

  describe('resetLedgerAndFetchFirstPage', () => {
    it('should reset ledger state and fetch first page', async () => {
      const mockLedger = [
        { id: 1, transaction_type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactLedger).mockResolvedValue(mockLedger)
      
      const store = useContactsStore()
      store.ledger = [{ id: 999, transaction_type: 'REFUND', delta: 5, balance_after: 5, reason: 'old', created_at: '2025-01-01', inquiry_id: null }]
      store.ledgerOffset = 100
      store.ledgerHasMore = false
      
      await store.resetLedgerAndFetchFirstPage()
      
      expect(store.ledger).toEqual(mockLedger)
      expect(store.ledgerOffset).toBe(1)
      expect(store.ledgerHasMore).toBe(false)
      expect(billingApi.getContactLedger).toHaveBeenCalledWith(50, 0)
    })
  })

  describe('loadMoreLedger', () => {
    it('should not fetch if hasMore is false', async () => {
      const store = useContactsStore()
      store.ledgerHasMore = false
      
      await store.loadMoreLedger()
      
      expect(billingApi.getContactLedger).not.toHaveBeenCalled()
    })

    it('should not fetch if already loading', async () => {
      const store = useContactsStore()
      store.isLoadingLedger = true
      store.ledgerHasMore = true
      
      await store.loadMoreLedger()
      
      expect(billingApi.getContactLedger).not.toHaveBeenCalled()
    })

    it('should fetch next page with append=true', async () => {
      const mockLedger = [
        { id: 2, transaction_type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactLedger).mockResolvedValue(mockLedger)
      
      const store = useContactsStore()
      store.ledgerOffset = 1
      store.ledgerHasMore = true
      
      await store.loadMoreLedger()
      
      expect(billingApi.getContactLedger).toHaveBeenCalledWith(50, 1)
    })
  })

  describe('afterAcceptRefresh (INV-3)', () => {
    it('should refetch balance and reset ledger', async () => {
      const mockBalance = { balance: 5, user_id: 1 }
      const mockLedger = [
        { id: 1, transaction_type: 'DEDUCTION' as const, delta: -1, balance_after: 5, reason: 'contact unlocked', created_at: '2026-01-25', inquiry_id: null }
      ]
      
      vi.mocked(billingApi.getContactBalance).mockResolvedValue(mockBalance)
      vi.mocked(billingApi.getContactLedger).mockResolvedValue(mockLedger)
      
      const store = useContactsStore()
      store.balance = 6
      store.ledger = []
      
      await store.afterAcceptRefresh()
      
      expect(billingApi.getContactBalance).toHaveBeenCalled()
      expect(billingApi.getContactLedger).toHaveBeenCalledWith(50, 0)
      expect(store.balance).toBe(5)
      expect(store.ledger).toEqual(mockLedger)
    })
  })

  describe('fetchBalance', () => {
    it('should fetch and set balance', async () => {
      const mockBalance = { balance: 10, user_id: 1 }
      vi.mocked(billingApi.getContactBalance).mockResolvedValue(mockBalance)
      
      const store = useContactsStore()
      await store.fetchBalance()
      
      expect(store.balance).toBe(10)
      expect(store.isLoadingBalance).toBe(false)
      expect(store.errorBalance).toBeNull()
    })

    it('should handle errors', async () => {
      vi.mocked(billingApi.getContactBalance).mockRejectedValue(new Error('Network error'))
      
      const store = useContactsStore()
      await store.fetchBalance().catch(() => {})
      
      expect(store.errorBalance).toBe('Network error')
      expect(store.isLoadingBalance).toBe(false)
    })
  })

  describe('fetchStats', () => {
    it('should fetch and set stats', async () => {
      const mockStats = { decline_streak: 2, is_blocked_by_decline_streak: false, total_open_inquiries: 3 }
      vi.mocked(billingApi.getInquiryStats).mockResolvedValue(mockStats)
      
      const store = useContactsStore()
      await store.fetchStats()
      
      expect(store.stats).toEqual(mockStats)
      expect(store.declineStreak).toBe(2)
      expect(store.isBlocked).toBe(false)
    })
  })
})
