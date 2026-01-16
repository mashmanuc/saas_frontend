/**
 * Unit tests for WhiteboardStore v0.86.0 features
 * Tests: roles, moderation, presenter, frozen state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'

describe('WhiteboardStore v0.86.0', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Role & Moderation State', () => {
    it('should initialize with default role state', () => {
      const store = useWhiteboardStore()
      
      expect(store.myRole).toBe('viewer')
      expect(store.isBoardFrozen).toBe(false)
      expect(store.presenterUserId).toBeNull()
      expect(store.followPresenterEnabled).toBe(false)
    })

    it('should compute canEdit correctly for editor', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'editor'
      store.isBoardFrozen = false
      
      expect(store.canEdit).toBe(true)
    })

    it('should compute canEdit correctly for moderator', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'moderator'
      store.isBoardFrozen = false
      
      expect(store.canEdit).toBe(true)
    })

    it('should compute canEdit as false for viewer', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'viewer'
      store.isBoardFrozen = false
      
      expect(store.canEdit).toBe(false)
    })

    it('should compute canEdit as false when board is frozen', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'editor'
      store.isBoardFrozen = true
      
      expect(store.canEdit).toBe(false)
    })

    it('should compute canModerate correctly', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'viewer'
      expect(store.canModerate).toBe(false)
      
      store.myRole = 'editor'
      expect(store.canModerate).toBe(false)
      
      store.myRole = 'moderator'
      expect(store.canModerate).toBe(true)
    })
  })

  describe('Board Frozen Handler', () => {
    it('should update isBoardFrozen when handleBoardFrozen is called', () => {
      const store = useWhiteboardStore()
      
      expect(store.isBoardFrozen).toBe(false)
      
      store.handleBoardFrozen(true)
      expect(store.isBoardFrozen).toBe(true)
      
      store.handleBoardFrozen(false)
      expect(store.isBoardFrozen).toBe(false)
    })

    it('should disable editing when board is frozen', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'editor'
      expect(store.canEdit).toBe(true)
      
      store.handleBoardFrozen(true)
      expect(store.canEdit).toBe(false)
    })
  })

  describe('Presenter Handler', () => {
    it('should update presenterUserId when handlePresenterChanged is called', () => {
      const store = useWhiteboardStore()
      
      expect(store.presenterUserId).toBeNull()
      
      store.handlePresenterChanged('user-123')
      expect(store.presenterUserId).toBe('user-123')
      
      store.handlePresenterChanged(null)
      expect(store.presenterUserId).toBeNull()
    })
  })

  describe('Follow Presenter', () => {
    it('should toggle followPresenterEnabled', () => {
      const store = useWhiteboardStore()
      
      expect(store.followPresenterEnabled).toBe(false)
      
      store.toggleFollowPresenter()
      expect(store.followPresenterEnabled).toBe(true)
      
      store.toggleFollowPresenter()
      expect(store.followPresenterEnabled).toBe(false)
    })
  })

  describe('Moderation Commands', () => {
    it('should not send freeze if not moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendFreeze: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'viewer'
      
      await store.sendFreeze(true)
      
      expect(mockAdapter.sendFreeze).not.toHaveBeenCalled()
    })

    it('should send freeze if moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendFreeze: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'moderator'
      
      await store.sendFreeze(true)
      
      expect(mockAdapter.sendFreeze).toHaveBeenCalledWith(true)
    })

    it('should not send clear page if not moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendClearPage: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'editor'
      store.activePageId = 'page-123'
      
      await store.sendClearPage('page-123')
      
      expect(mockAdapter.sendClearPage).not.toHaveBeenCalled()
    })

    it('should send clear page if moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendClearPage: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'moderator'
      store.activePageId = 'page-123'
      
      await store.sendClearPage('page-123')
      
      expect(mockAdapter.sendClearPage).toHaveBeenCalledWith('page-123')
    })

    it('should not send set presenter if not moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendSetPresenter: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'viewer'
      
      await store.sendSetPresenter('user-456')
      
      expect(mockAdapter.sendSetPresenter).not.toHaveBeenCalled()
    })

    it('should send set presenter if moderator', async () => {
      const store = useWhiteboardStore()
      const mockAdapter = {
        sendSetPresenter: vi.fn()
      }
      
      store.setRealtimeAdapter(mockAdapter as any)
      store.myRole = 'moderator'
      
      await store.sendSetPresenter('user-456')
      
      expect(mockAdapter.sendSetPresenter).toHaveBeenCalledWith('user-456')
    })
  })

  describe('Load Workspace State', () => {
    it('should load workspace state from API', async () => {
      const store = useWhiteboardStore()
      store.workspaceId = 'workspace-123'
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          myRole: 'moderator',
          isFrozen: true,
          presenterUserId: 'user-789'
        })
      })
      
      await store.loadWorkspaceState()
      
      expect(store.myRole).toBe('moderator')
      expect(store.isBoardFrozen).toBe(true)
      expect(store.presenterUserId).toBe('user-789')
    })

    it('should handle API error gracefully', async () => {
      const store = useWhiteboardStore()
      store.workspaceId = 'workspace-123'
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403
      })
      
      await store.loadWorkspaceState()
      
      // Should not throw, state remains default
      expect(store.myRole).toBe('viewer')
      expect(store.isBoardFrozen).toBe(false)
    })
  })

  describe('Reset', () => {
    it('should reset all v0.86.0 state', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'moderator'
      store.isBoardFrozen = true
      store.presenterUserId = 'user-999'
      store.followPresenterEnabled = true
      
      store.reset()
      
      expect(store.myRole).toBe('viewer')
      expect(store.isBoardFrozen).toBe(false)
      expect(store.presenterUserId).toBeNull()
      expect(store.followPresenterEnabled).toBe(false)
    })
  })
})
