/**
 * Unit tests for trustStore
 * 
 * Tests for trust & safety state management.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTrustStore } from '../trustStore'
import * as trustApi from '../../api/trust'

// Mock trustApi
vi.mock('../../api/trust')

describe('trustStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('state', () => {
    it('should initialize with default state', () => {
      const store = useTrustStore()
      
      expect(store.blocks).toEqual([])
      expect(store.reports).toEqual([])
      expect(store.bans).toEqual([])
      expect(store.appeals).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('fetchBlocks', () => {
    it('should fetch blocked users successfully', async () => {
      const mockBlocks = [
        { id: 1, target_user_id: 123, target_user_name: 'John Doe', reason: 'spam', created_at: '2026-01-01' },
        { id: 2, target_user_id: 456, target_user_name: 'Jane Smith', reason: 'harassment', created_at: '2026-01-02' }
      ]
      
      vi.mocked(trustApi.trustApi.getBlockedUsers).mockResolvedValue(mockBlocks)
      
      const store = useTrustStore()
      await store.fetchBlocks()
      
      expect(store.blocks).toEqual(mockBlocks)
      expect(store.loading).toBe(false)
    })

    it('should handle fetch error', async () => {
      vi.mocked(trustApi.trustApi.getBlockedUsers).mockRejectedValue(new Error('Network error'))
      
      const store = useTrustStore()
      
      await expect(store.fetchBlocks()).rejects.toThrow('Network error')
      expect(store.error).toBe('Network error')
    })
  })

  describe('blockUser', () => {
    it('should block user successfully', async () => {
      const mockBlock = { id: 3, target_user_id: 789, target_user_name: 'Bob Wilson', reason: 'spam', created_at: '2026-01-03' }
      
      vi.mocked(trustApi.trustApi.blockUser).mockResolvedValue(mockBlock)
      
      const store = useTrustStore()
      await store.blockUser(789, 'spam')
      
      expect(store.blocks).toContainEqual(mockBlock)
      expect(trustApi.trustApi.blockUser).toHaveBeenCalledWith({ target_user_id: 789, reason: 'spam' })
    })
  })

  describe('unblockUser', () => {
    it('should unblock user successfully', async () => {
      const store = useTrustStore()
      store.blocks = [
        { id: 1, target_user_id: 123, target_user_name: 'John Doe', reason: 'spam', created_at: '2026-01-01' },
        { id: 2, target_user_id: 456, target_user_name: 'Jane Smith', reason: 'harassment', created_at: '2026-01-02' }
      ]
      
      vi.mocked(trustApi.trustApi.unblockUser).mockResolvedValue(undefined)
      
      await store.unblockUser(1)
      
      expect(store.blocks).toHaveLength(1)
      expect(store.blocks[0].id).toBe(2)
    })
  })

  describe('isBlocked', () => {
    it('should return true for blocked user', () => {
      const store = useTrustStore()
      store.blocks = [
        { id: 1, target_user_id: 123, target_user_name: 'John Doe', reason: 'spam', created_at: '2026-01-01' }
      ]
      
      expect(store.isBlocked(123)).toBe(true)
    })

    it('should return false for non-blocked user', () => {
      const store = useTrustStore()
      store.blocks = [
        { id: 1, target_user_id: 123, target_user_name: 'John Doe', reason: 'spam', created_at: '2026-01-01' }
      ]
      
      expect(store.isBlocked(456)).toBe(false)
    })
  })

  describe('createReport', () => {
    it('should create report successfully', async () => {
      const mockReport = { 
        id: 1, 
        target_type: 'user', 
        target_id: 123, 
        category: 'spam', 
        comment: 'Sending spam messages',
        status: 'pending',
        created_at: '2026-01-01'
      }
      
      vi.mocked(trustApi.trustApi.createReport).mockResolvedValue(mockReport)
      
      const store = useTrustStore()
      const result = await store.createReport('user', 123, 'spam', 'Sending spam messages')
      
      expect(store.reports).toContainEqual(mockReport)
      expect(result).toEqual(mockReport)
    })
  })

  describe('fetchBans', () => {
    it('should fetch active bans', async () => {
      const mockBans = [
        { id: 1, scope: 'inquiries', reason: 'Too many rejections', expires_at: '2026-02-01', is_permanent: false, created_at: '2026-01-01' }
      ]
      
      vi.mocked(trustApi.trustApi.getActiveBans).mockResolvedValue(mockBans)
      
      const store = useTrustStore()
      await store.fetchBans()
      
      expect(store.bans).toEqual(mockBans)
      expect(store.hasActiveBans).toBe(true)
    })
  })

  describe('createAppeal', () => {
    it('should create appeal successfully', async () => {
      const mockAppeal = { 
        id: 1, 
        ban_id: 1, 
        reason: 'I believe this was a mistake', 
        status: 'pending',
        created_at: '2026-01-01'
      }
      
      vi.mocked(trustApi.trustApi.createAppeal).mockResolvedValue(mockAppeal)
      
      const store = useTrustStore()
      await store.createAppeal(1, 'I believe this was a mistake')
      
      expect(store.appeals).toContainEqual(mockAppeal)
    })
  })

  describe('getters', () => {
    it('should return blockedUserIds', () => {
      const store = useTrustStore()
      store.blocks = [
        { id: 1, target_user_id: 123, target_user_name: 'John', reason: 'spam', created_at: '' },
        { id: 2, target_user_id: 456, target_user_name: 'Jane', reason: 'harassment', created_at: '' }
      ]
      
      expect(store.blockedUserIds).toEqual(new Set([123, 456]))
    })

    it('should return activeBanCount', () => {
      const store = useTrustStore()
      store.bans = [
        { id: 1, scope: 'inquiries', reason: 'Violation', expires_at: null, is_permanent: true, created_at: '' }
      ]
      
      expect(store.activeBanCount).toBe(1)
    })

    it('should return pendingAppeals', () => {
      const store = useTrustStore()
      store.appeals = [
        { id: 1, ban_id: 1, reason: 'Mistake', status: 'pending', created_at: '2026-01-01' },
        { id: 2, ban_id: 2, reason: 'Unfair', status: 'rejected', created_at: '2026-01-02' }
      ]
      
      expect(store.pendingAppeals).toHaveLength(1)
      expect(store.pendingAppeals[0].id).toBe(1)
    })

    it('should return activeBansByScope', () => {
      const store = useTrustStore()
      store.bans = [
        { id: 1, scope: 'inquiries', reason: 'Violation', expires_at: null, is_permanent: true, created_at: '' },
        { id: 2, scope: 'inquiries', reason: 'Another', expires_at: null, is_permanent: true, created_at: '' },
        { id: 3, scope: 'messaging', reason: 'Spam', expires_at: null, is_permanent: true, created_at: '' }
      ]
      
      expect(store.activeBansByScope).toEqual({ inquiries: 2, messaging: 1 })
    })
  })

  describe('$reset', () => {
    it('should reset all state', () => {
      const store = useTrustStore()
      store.blocks = [{ id: 1, target_user_id: 123, target_user_name: 'John', reason: 'spam', created_at: '' }]
      store.bans = [{ id: 1, scope: 'all', reason: 'Violation', expires_at: null, is_permanent: true, created_at: '' }]
      store.error = 'Some error'
      
      store.$reset()
      
      expect(store.blocks).toEqual([])
      expect(store.bans).toEqual([])
      expect(store.error).toBeNull()
    })
  })
})
