/**
 * Trust Store Unit Tests v0.66.0
 * 
 * Tests for trustStore actions, optimistic updates, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTrustStore } from '../trustStore'
import { trustApi } from '@/api/trust'
import { UserBannedError, UserBlockedError, RateLimitedError } from '@/utils/errors'
import { BanScope, ReportTargetType, ReportCategory } from '@/types/trust'

vi.mock('@/api/trust')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: vi.fn((err) => {
    throw err
  })
}))

describe('trustStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadBlocks', () => {
    it('loads user blocks successfully', async () => {
      const mockBlocks = [
        {
          id: 'block-1',
          blocked_user_id: 123,
          blocked_user_email: 'user@example.com',
          reason: 'spam',
          created_at: '2026-01-09T06:00:00Z',
        },
      ]

      vi.mocked(trustApi.getBlocks).mockResolvedValue({
        blocks: mockBlocks,
      })

      const store = useTrustStore()
      await store.loadBlocks()

      expect(store.blocks).toEqual(mockBlocks)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('handles load error', async () => {
      const error = new Error('Network error')
      vi.mocked(trustApi.getBlocks).mockRejectedValue(error)

      const store = useTrustStore()

      await expect(store.loadBlocks()).rejects.toThrow()
      expect(store.error).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('loadBanStatus', () => {
    it('loads ban status successfully', async () => {
      const mockBans = [
        {
          scope: BanScope.CONTACTS,
          ends_at: null,
          reason: 'Policy violation',
        },
      ]

      vi.mocked(trustApi.getBanStatus).mockResolvedValue({
        bans: mockBans,
      })

      const store = useTrustStore()
      await store.loadBanStatus()

      expect(store.bans).toEqual(mockBans)
      expect(store.hasActiveBans).toBe(true)
    })
  })

  describe('blockUser', () => {
    it('blocks user with optimistic update', async () => {
      vi.mocked(trustApi.blockUser).mockResolvedValue({ ok: true })
      vi.mocked(trustApi.getBlocks).mockResolvedValue({ blocks: [] })

      const store = useTrustStore()
      const payload = { user_id: 123, reason: 'spam' }

      await store.blockUser(payload)

      expect(trustApi.blockUser).toHaveBeenCalledWith(payload)
      expect(trustApi.getBlocks).toHaveBeenCalled()
    })

    it('reverts optimistic update on error', async () => {
      const error = new Error('Block failed')
      vi.mocked(trustApi.blockUser).mockRejectedValue(error)

      const store = useTrustStore()
      const initialBlocks = [...store.blocks]

      await expect(store.blockUser({ user_id: 123 })).rejects.toThrow()

      expect(store.blocks).toEqual(initialBlocks)
    })
  })

  describe('unblockUser', () => {
    it('unblocks user with optimistic update', async () => {
      vi.mocked(trustApi.unblockUser).mockResolvedValue({ ok: true })

      const store = useTrustStore()
      store.blocks = [
        {
          id: 'block-1',
          blocked_user_id: 123,
          blocked_user_email: 'user@example.com',
          reason: '',
          created_at: '2026-01-09T06:00:00Z',
        },
      ]

      await store.unblockUser(123)

      expect(store.blocks).toHaveLength(0)
      expect(trustApi.unblockUser).toHaveBeenCalledWith({ user_id: 123 })
    })

    it('reverts optimistic update on error', async () => {
      const error = new Error('Unblock failed')
      vi.mocked(trustApi.unblockUser).mockRejectedValue(error)

      const store = useTrustStore()
      const initialBlock = {
        id: 'block-1',
        blocked_user_id: 123,
        blocked_user_email: 'user@example.com',
        reason: '',
        created_at: '2026-01-09T06:00:00Z',
      }
      store.blocks = [initialBlock]

      await expect(store.unblockUser(123)).rejects.toThrow()

      expect(store.blocks).toEqual([initialBlock])
    })
  })

  describe('createReport', () => {
    it('creates report successfully', async () => {
      const mockResponse = {
        ok: true,
        report_id: 'report-1',
      }

      vi.mocked(trustApi.createReport).mockResolvedValue(mockResponse)
      vi.mocked(trustApi.getReports).mockResolvedValue({ reports: [] })

      const store = useTrustStore()
      const payload = {
        target_type: ReportTargetType.INQUIRY,
        target_id: 'inquiry-1',
        category: ReportCategory.SPAM,
        details: 'This is spam',
      }

      const result = await store.createReport(payload)

      expect(result).toEqual(mockResponse)
      expect(trustApi.createReport).toHaveBeenCalledWith(payload)
      expect(trustApi.getReports).toHaveBeenCalled()
    })

    it('handles rate limit error', async () => {
      const error = new RateLimitedError({ retry_after_seconds: 86400 })
      vi.mocked(trustApi.createReport).mockRejectedValue(error)

      const store = useTrustStore()

      await expect(
        store.createReport({
          target_type: ReportTargetType.INQUIRY,
          category: ReportCategory.SPAM,
          details: 'Test',
        })
      ).rejects.toThrow(RateLimitedError)
    })
  })

  describe('helper methods', () => {
    it('checks if user is blocked', () => {
      const store = useTrustStore()
      store.blocks = [
        {
          id: 'block-1',
          blocked_user_id: 123,
          blocked_user_email: 'user@example.com',
          reason: '',
          created_at: '2026-01-09T06:00:00Z',
        },
      ]

      expect(store.isUserBlocked(123)).toBe(true)
      expect(store.isUserBlocked(456)).toBe(false)
    })

    it('checks if user has ban in scope', () => {
      const store = useTrustStore()
      store.bans = [
        {
          scope: BanScope.CONTACTS,
          ends_at: null,
          reason: 'Policy violation',
        },
      ]

      expect(store.hasBanInScope(BanScope.CONTACTS)).toBe(true)
      expect(store.hasBanInScope(BanScope.INQUIRIES)).toBe(false)
    })

    it('checks ALL scope ban', () => {
      const store = useTrustStore()
      store.bans = [
        {
          scope: BanScope.ALL,
          ends_at: null,
          reason: 'Permanent ban',
        },
      ]

      expect(store.hasBanInScope(BanScope.CONTACTS)).toBe(true)
      expect(store.hasBanInScope(BanScope.INQUIRIES)).toBe(true)
    })
  })

  describe('reset', () => {
    it('resets store state', () => {
      const store = useTrustStore()
      store.blocks = [
        {
          id: 'block-1',
          blocked_user_id: 123,
          blocked_user_email: 'user@example.com',
          reason: '',
          created_at: '2026-01-09T06:00:00Z',
        },
      ]
      store.error = 'Some error'

      store.reset()

      expect(store.blocks).toEqual([])
      expect(store.reports).toEqual([])
      expect(store.bans).toEqual([])
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })
})
