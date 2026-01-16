/**
 * Unit tests for whiteboardStore v0.87.0 features
 * Tests SafeMode, queue limits, and telemetry integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteboardStore } from '../whiteboardStore'

describe('WhiteboardStore v0.87.0 - SafeMode & Queue Limits', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('SafeMode state', () => {
    it('should initialize with safeMode = false', () => {
      const store = useWhiteboardStore()
      expect(store.safeMode).toBe(false)
    })

    it('should expose SafeMode methods', () => {
      const store = useWhiteboardStore()
      expect(typeof store.checkSafeMode).toBe('function')
      expect(typeof store.enterSafeMode).toBe('function')
      expect(typeof store.exitSafeMode).toBe('function')
    })
  })

  describe('checkSafeMode', () => {
    it('should enter SafeMode when pendingOps exceeds MAX_PENDING_OPS', () => {
      const store = useWhiteboardStore()
      
      // Mock pendingOps with 301 items (exceeds limit of 300)
      const mockOps = new Map()
      for (let i = 0; i < 301; i++) {
        mockOps.set(`op-${i}`, {
          id: `op-${i}`,
          type: 'stroke_add',
          data: {},
          timestamp: Date.now()
        })
      }
      store.pendingOps = mockOps

      // Check SafeMode
      store.checkSafeMode()

      expect(store.safeMode).toBe(true)
    })

    it('should not enter SafeMode when pendingOps is below limit', () => {
      const store = useWhiteboardStore()
      
      // Mock pendingOps with 50 items
      const mockOps = new Map()
      for (let i = 0; i < 50; i++) {
        mockOps.set(`op-${i}`, {
          id: `op-${i}`,
          type: 'stroke_add',
          data: {},
          timestamp: Date.now()
        })
      }
      store.pendingOps = mockOps

      store.checkSafeMode()

      expect(store.safeMode).toBe(false)
    })

    it('should not re-enter SafeMode if already active', () => {
      const store = useWhiteboardStore()
      
      // Manually enter SafeMode
      store.safeMode = true
      const enterSpy = vi.spyOn(store, 'enterSafeMode')

      // Mock high pendingOps
      const mockOps = new Map()
      for (let i = 0; i < 301; i++) {
        mockOps.set(`op-${i}`, { id: `op-${i}`, type: 'stroke_add', data: {} })
      }
      store.pendingOps = mockOps

      store.checkSafeMode()

      // Should not call enterSafeMode again
      expect(enterSpy).not.toHaveBeenCalled()
    })
  })

  describe('enterSafeMode', () => {
    it('should set safeMode to true', async () => {
      const store = useWhiteboardStore()
      
      await store.enterSafeMode()

      expect(store.safeMode).toBe(true)
    })

    it('should request resync if adapter available', async () => {
      const store = useWhiteboardStore()
      
      // Mock realtime adapter with requestResync
      const mockAdapter = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendCursorMove: vi.fn(),
        sendOperation: vi.fn(),
        requestResync: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true),
        getPresence: vi.fn().mockReturnValue([]),
        onPresenceChange: vi.fn(),
        onCursorMove: vi.fn(),
        onOperationAck: vi.fn(),
        onRemoteOperation: vi.fn(),
        onBoardEvent: vi.fn()
      }
      store.setRealtimeAdapter(mockAdapter as any)
      
      // Set active page
      store.activePageId = 'page-123'
      store.lastAckedVersion = 10

      await store.enterSafeMode()

      expect(mockAdapter.requestResync).toHaveBeenCalledWith({
        pageId: 'page-123',
        lastKnownVersion: 10
      })
    })
  })

  describe('exitSafeMode', () => {
    it('should set safeMode to false', () => {
      const store = useWhiteboardStore()
      
      // Enter SafeMode first
      store.safeMode = true

      store.exitSafeMode()

      expect(store.safeMode).toBe(false)
    })

    it('should do nothing if not in SafeMode', () => {
      const store = useWhiteboardStore()
      
      store.safeMode = false
      const consoleSpy = vi.spyOn(console, 'log')

      store.exitSafeMode()

      expect(store.safeMode).toBe(false)
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })

  describe('canEdit computed with SafeMode', () => {
    it('should return false when in SafeMode (even if editor)', () => {
      const store = useWhiteboardStore()
      
      // Set role to editor
      store.myRole = 'editor'
      store.isBoardFrozen = false
      
      // Enter SafeMode
      store.safeMode = true

      expect(store.canEdit).toBe(false)
    })

    it('should return true when not in SafeMode and editor', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'editor'
      store.isBoardFrozen = false
      store.safeMode = false

      expect(store.canEdit).toBe(true)
    })

    it('should prioritize frozen over SafeMode', () => {
      const store = useWhiteboardStore()
      
      store.myRole = 'editor'
      store.isBoardFrozen = true
      store.safeMode = false

      expect(store.canEdit).toBe(false)
    })
  })

  describe('reset with SafeMode', () => {
    it('should reset safeMode to false', () => {
      const store = useWhiteboardStore()
      
      // Enter SafeMode
      store.safeMode = true

      store.reset()

      expect(store.safeMode).toBe(false)
    })
  })

  describe('Integration: SafeMode workflow', () => {
    it('should handle full SafeMode cycle: overflow → enter → resync → exit', async () => {
      const store = useWhiteboardStore()
      
      // Mock adapter
      const mockAdapter = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendCursorMove: vi.fn(),
        sendOperation: vi.fn(),
        requestResync: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true),
        getPresence: vi.fn().mockReturnValue([]),
        onPresenceChange: vi.fn(),
        onCursorMove: vi.fn(),
        onOperationAck: vi.fn(),
        onRemoteOperation: vi.fn(),
        onBoardEvent: vi.fn()
      }
      store.setRealtimeAdapter(mockAdapter as any)
      store.activePageId = 'page-123'

      // 1. Simulate queue overflow
      const mockOps = new Map()
      for (let i = 0; i < 301; i++) {
        mockOps.set(`op-${i}`, { id: `op-${i}`, type: 'stroke_add', data: {} })
      }
      store.pendingOps = mockOps

      // 2. Check triggers SafeMode
      store.checkSafeMode()
      expect(store.safeMode).toBe(true)

      // 3. Resync requested
      await store.enterSafeMode()
      expect(mockAdapter.requestResync).toHaveBeenCalled()

      // 4. Simulate successful resync (clear queue)
      store.pendingOps.clear()
      store.exitSafeMode()

      expect(store.safeMode).toBe(false)
      expect(store.pendingOps.size).toBe(0)
    })
  })
})
