/**
 * Unit tests for whiteboardStore v0.88.0 follow-mode functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'
import type { PresenterPageChangedPayload } from '@/core/whiteboard/adapters/RealtimeAdapter'

describe('whiteboardStore v0.88.0 follow-mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('State initialization', () => {
    it('should initialize with presenterPageId as null', () => {
      const store = useWhiteboardStore()
      expect(store.presenterPageId).toBeNull()
    })

    it('should initialize with isFollowModeActive as false', () => {
      const store = useWhiteboardStore()
      expect(store.isFollowModeActive).toBe(false)
    })
  })

  describe('loadWorkspaceState', () => {
    it('should load presenterPageId from API response', async () => {
      const store = useWhiteboardStore()
      store.workspaceId = 'test-workspace'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          myRole: 'moderator',
          isFrozen: false,
          presenterUserId: 'user-123',
          presenterPageId: 'page-456'
        })
      })

      await store.loadWorkspaceState()

      expect(store.presenterPageId).toBe('page-456')
      expect(store.presenterUserId).toBe('user-123')
      expect(store.myRole).toBe('moderator')
    })

    it('should handle null presenterPageId from API', async () => {
      const store = useWhiteboardStore()
      store.workspaceId = 'test-workspace'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          myRole: 'viewer',
          isFrozen: false,
          presenterUserId: null,
          presenterPageId: null
        })
      })

      await store.loadWorkspaceState()

      expect(store.presenterPageId).toBeNull()
    })
  })

  describe('handlePresenterPageChanged', () => {
    it('should update presenterPageId when payload received', () => {
      const store = useWhiteboardStore()
      const payload: PresenterPageChangedPayload = {
        workspaceId: 'workspace-1',
        presenterUserId: 'user-123',
        pageId: 'page-789',
        ts: Date.now()
      }

      store.handlePresenterPageChanged(payload)

      expect(store.presenterPageId).toBe('page-789')
    })

    it('should NOT auto-switch when follow mode is disabled', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.isFollowModeActive = false

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      const payload: PresenterPageChangedPayload = {
        workspaceId: 'workspace-1',
        presenterUserId: 'user-123',
        pageId: 'page-2',
        ts: Date.now()
      }

      store.handlePresenterPageChanged(payload)

      expect(store.presenterPageId).toBe('page-2')
      expect(switchToPageSpy).not.toHaveBeenCalled()
    })

    it('should auto-switch when follow mode is active and page differs', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.isFollowModeActive = true

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      const payload: PresenterPageChangedPayload = {
        workspaceId: 'workspace-1',
        presenterUserId: 'user-123',
        pageId: 'page-2',
        ts: Date.now()
      }

      store.handlePresenterPageChanged(payload)

      expect(store.presenterPageId).toBe('page-2')
      expect(switchToPageSpy).toHaveBeenCalledWith('page-2')
    })

    it('should NOT auto-switch when already on presenter page', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.isFollowModeActive = true

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      const payload: PresenterPageChangedPayload = {
        workspaceId: 'workspace-1',
        presenterUserId: 'user-123',
        pageId: 'page-1',
        ts: Date.now()
      }

      store.handlePresenterPageChanged(payload)

      expect(store.presenterPageId).toBe('page-1')
      expect(switchToPageSpy).not.toHaveBeenCalled()
    })
  })

  describe('toggleFollowMode', () => {
    it('should toggle isFollowModeActive from false to true', () => {
      const store = useWhiteboardStore()
      store.isFollowModeActive = false

      store.toggleFollowMode()

      expect(store.isFollowModeActive).toBe(true)
    })

    it('should toggle isFollowModeActive from true to false', () => {
      const store = useWhiteboardStore()
      store.isFollowModeActive = true

      store.toggleFollowMode()

      expect(store.isFollowModeActive).toBe(false)
    })

    it('should auto-switch to presenter page when enabling follow mode', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.presenterPageId = 'page-2'
      store.isFollowModeActive = false

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      store.toggleFollowMode()

      expect(store.isFollowModeActive).toBe(true)
      expect(switchToPageSpy).toHaveBeenCalledWith('page-2')
    })

    it('should NOT auto-switch when enabling if already on presenter page', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.presenterPageId = 'page-1'
      store.isFollowModeActive = false

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      store.toggleFollowMode()

      expect(store.isFollowModeActive).toBe(true)
      expect(switchToPageSpy).not.toHaveBeenCalled()
    })

    it('should NOT auto-switch when enabling if presenterPageId is null', () => {
      const store = useWhiteboardStore()
      store.activePageId = 'page-1'
      store.presenterPageId = null
      store.isFollowModeActive = false

      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      store.toggleFollowMode()

      expect(store.isFollowModeActive).toBe(true)
      expect(switchToPageSpy).not.toHaveBeenCalled()
    })
  })

  describe('sendPresenterPageSwitch', () => {
    it('should call adapter sendPresenterPageSwitch method', async () => {
      const store = useWhiteboardStore()
      
      const mockAdapter = {
        sendPresenterPageSwitch: vi.fn().mockResolvedValue(undefined)
      }
      
      store.setRealtimeAdapter(mockAdapter as any)

      await store.sendPresenterPageSwitch('page-123')

      expect(mockAdapter.sendPresenterPageSwitch).toHaveBeenCalledWith('page-123')
    })

    it('should handle adapter without sendPresenterPageSwitch method', async () => {
      const store = useWhiteboardStore()
      
      const mockAdapter = {}
      store.setRealtimeAdapter(mockAdapter as any)

      await expect(store.sendPresenterPageSwitch('page-123')).resolves.not.toThrow()
    })
  })

  describe('reset', () => {
    it('should reset presenterPageId to null', () => {
      const store = useWhiteboardStore()
      store.presenterPageId = 'page-123'

      store.reset()

      expect(store.presenterPageId).toBeNull()
    })

    it('should reset isFollowModeActive to false', () => {
      const store = useWhiteboardStore()
      store.isFollowModeActive = true

      store.reset()

      expect(store.isFollowModeActive).toBe(false)
    })
  })

  describe('Integration: follow mode workflow', () => {
    it('should handle complete follow mode workflow', () => {
      const store = useWhiteboardStore()
      const switchToPageSpy = vi.spyOn(store, 'switchToPage')

      // Initial state
      expect(store.isFollowModeActive).toBe(false)
      expect(store.presenterPageId).toBeNull()

      // Presenter switches to page 1
      store.handlePresenterPageChanged({
        workspaceId: 'ws-1',
        presenterUserId: 'presenter-1',
        pageId: 'page-1',
        ts: Date.now()
      })
      expect(store.presenterPageId).toBe('page-1')
      expect(switchToPageSpy).not.toHaveBeenCalled()

      // User enables follow mode
      store.activePageId = 'page-0'
      store.toggleFollowMode()
      expect(store.isFollowModeActive).toBe(true)
      expect(switchToPageSpy).toHaveBeenCalledWith('page-1')

      // Presenter switches to page 2 - should auto-follow
      switchToPageSpy.mockClear()
      store.activePageId = 'page-1'
      store.handlePresenterPageChanged({
        workspaceId: 'ws-1',
        presenterUserId: 'presenter-1',
        pageId: 'page-2',
        ts: Date.now()
      })
      expect(store.presenterPageId).toBe('page-2')
      expect(switchToPageSpy).toHaveBeenCalledWith('page-2')

      // User disables follow mode
      store.toggleFollowMode()
      expect(store.isFollowModeActive).toBe(false)

      // Presenter switches to page 3 - should NOT auto-follow
      switchToPageSpy.mockClear()
      store.handlePresenterPageChanged({
        workspaceId: 'ws-1',
        presenterUserId: 'presenter-1',
        pageId: 'page-3',
        ts: Date.now()
      })
      expect(store.presenterPageId).toBe('page-3')
      expect(switchToPageSpy).not.toHaveBeenCalled()
    })
  })
})
