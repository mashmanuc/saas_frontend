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
import * as contactsApiModule from '@/modules/contacts/api/contacts'
import * as billingApi from '@/api/billing'
import { queryClient } from '@/app/queryClient'

vi.mock('@/modules/contacts/api/contacts')
vi.mock('@/api/billing')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: vi.fn()
}))
vi.mock('@/app/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() }
}))

describe('contactsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Pagination (INV-1: limit+offset)', () => {
    it('should fetch ledger with limit and offset', async () => {
      const mockResults = [
        { id: 1, type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01' },
        { id: 2, type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger).mockResolvedValue({
        results: mockResults,
        count: 2,
        next: null,
        previous: null,
      })

      const store = useContactsStore()
      await store.fetchLedger({ limit: 2, offset: 0, append: false })

      expect(contactsApiModule.contactsApi.getLedger).toHaveBeenCalledWith({ limit: 2, offset: 0 })
      expect(store.ledger).toEqual(mockResults)
      expect(store.ledgerOffset).toBe(2)
      expect(store.ledgerHasMore).toBe(true)
    })

    it('should set hasMore to false when fewer items returned than limit', async () => {
      const mockResults = [
        { id: 1, type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger).mockResolvedValue({
        results: mockResults,
        count: 1,
        next: null,
        previous: null,
      })

      const store = useContactsStore()
      await store.fetchLedger({ limit: 50, offset: 0, append: false })

      expect(store.ledgerHasMore).toBe(false)
    })

    it('should append items when append=true', async () => {
      const firstBatch = [
        { id: 1, type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01' }
      ]
      const secondBatch = [
        { id: 2, type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger)
        .mockResolvedValueOnce({ results: firstBatch, count: 1, next: null, previous: null })
        .mockResolvedValueOnce({ results: secondBatch, count: 1, next: null, previous: null })

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
      const mockResults = [
        { id: 1, type: 'PURCHASE' as const, delta: 10, balance_after: 10, reason: 'test', created_at: '2026-01-01' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger).mockResolvedValue({
        results: mockResults,
        count: 1,
        next: null,
        previous: null,
      })

      const store = useContactsStore()
      store.ledger = [{ id: 999, type: 'REFUND', delta: 5, balance_after: 5, reason: 'old', created_at: '2025-01-01' }]
      store.ledgerOffset = 100
      store.ledgerHasMore = false

      await store.resetLedgerAndFetchFirstPage()

      expect(store.ledger).toEqual(mockResults)
      expect(store.ledgerOffset).toBe(1)
      expect(store.ledgerHasMore).toBe(false)
      expect(contactsApiModule.contactsApi.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 0 })
    })
  })

  describe('loadMoreLedger', () => {
    it('should not fetch if hasMore is false', async () => {
      const store = useContactsStore()
      store.ledgerHasMore = false

      await store.loadMoreLedger()

      expect(contactsApiModule.contactsApi.getLedger).not.toHaveBeenCalled()
    })

    it('should not fetch if already loading', async () => {
      const store = useContactsStore()
      store.isLoadingLedger = true
      store.ledgerHasMore = true

      await store.loadMoreLedger()

      expect(contactsApiModule.contactsApi.getLedger).not.toHaveBeenCalled()
    })

    it('should fetch next page with append=true', async () => {
      const mockResults = [
        { id: 2, type: 'DEDUCTION' as const, delta: -1, balance_after: 9, reason: 'test', created_at: '2026-01-02' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger).mockResolvedValue({
        results: mockResults,
        count: 1,
        next: null,
        previous: null,
      })

      const store = useContactsStore()
      store.ledgerOffset = 1
      store.ledgerHasMore = true

      await store.loadMoreLedger()

      expect(contactsApiModule.contactsApi.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 1 })
    })
  })

  describe('afterAcceptRefresh (INV-3)', () => {
    it('should invalidate queries and reset ledger', async () => {
      const mockResults = [
        { id: 1, type: 'DEDUCTION' as const, delta: -1, balance_after: 5, reason: 'contact unlocked', created_at: '2026-01-25' }
      ]

      vi.mocked(contactsApiModule.contactsApi.getLedger).mockResolvedValue({
        results: mockResults,
        count: 1,
        next: null,
        previous: null,
      })

      const store = useContactsStore()
      store.balance = 6
      store.ledger = []

      await store.afterAcceptRefresh()

      // Phase 29: balance/stats refetch via TanStack Query invalidation
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['contact-balance'] })
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['contact-stats'] })
      // Ledger still fetched via store (not migrated to Query)
      expect(contactsApiModule.contactsApi.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 0 })
      expect(store.ledger).toEqual(mockResults)
    })
  })

  describe('fetchBalance', () => {
    it('should fetch and set balance', async () => {
      vi.mocked(contactsApiModule.contactsApi.getBalance).mockResolvedValue({
        balance: 10,
        pending_grants: 0,
        last_grant_date: null,
        next_allowance_date: null,
        plan_allowance: 5,
      })

      const store = useContactsStore()
      await store.fetchBalance()

      expect(store.balance).toBe(10)
      expect(store.isLoadingBalance).toBe(false)
      expect(store.errorBalance).toBeNull()
    })

    it('should handle errors', async () => {
      vi.mocked(contactsApiModule.contactsApi.getBalance).mockRejectedValue(new Error('Network error'))

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
