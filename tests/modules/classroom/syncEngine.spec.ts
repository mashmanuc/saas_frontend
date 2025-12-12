import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SyncEngine } from '@/modules/classroom/engine/syncEngine'

// Mock WebSocket constants
const WS_OPEN = 1
const WS_CLOSED = 3

// Mock global WebSocket
vi.stubGlobal('WebSocket', {
  OPEN: WS_OPEN,
  CLOSED: WS_CLOSED,
  CONNECTING: 0,
  CLOSING: 2,
})

describe('SyncEngine', () => {
  let syncEngine: SyncEngine
  let mockSocket: {
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    readyState: number
    onmessage: ((event: MessageEvent) => void) | null
    onopen: (() => void) | null
    onclose: (() => void) | null
    onerror: ((event: Event) => void) | null
  }

  beforeEach(() => {
    syncEngine = new SyncEngine(0)

    mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WS_OPEN,
      onmessage: null,
      onopen: null,
      onclose: null,
      onerror: null,
    }
  })

  afterEach(() => {
    syncEngine.disconnect()
  })

  describe('constructor', () => {
    it('should initialize with default version 0', () => {
      const engine = new SyncEngine()
      expect(engine.getVersion()).toBe(0)
    })

    it('should initialize with provided version', () => {
      const engine = new SyncEngine(10)
      expect(engine.getVersion()).toBe(10)
    })
  })

  describe('setSocket', () => {
    it('should set socket and setup handlers', () => {
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      expect(syncEngine.getSocket()).toBe(mockSocket)
    })
  })

  describe('sendEvent', () => {
    it('should send event when socket is connected', () => {
      syncEngine.setSocket(mockSocket as unknown as WebSocket)
      // Simulate socket open
      mockSocket.onopen?.()

      syncEngine.sendEvent('draw', { x: 10, y: 20 })

      expect(mockSocket.send).toHaveBeenCalled()
      const sentData = JSON.parse(mockSocket.send.mock.calls[0][0])
      expect(sentData.type).toBe('board_event')
      expect(sentData.event_type).toBe('draw')
      expect(sentData.data).toEqual({ x: 10, y: 20 })
    })

    it('should queue events when socket is not connected', () => {
      syncEngine.sendEvent('draw', { x: 10, y: 20 })

      // Event should be queued, not sent
      expect(mockSocket.send).not.toHaveBeenCalled()
    })

    it('should flush pending events when socket connects', () => {
      // Queue some events
      syncEngine.sendEvent('draw', { x: 10, y: 20 })
      syncEngine.sendEvent('erase', { x: 30, y: 40 })

      // Connect socket
      syncEngine.setSocket(mockSocket as unknown as WebSocket)
      // Simulate socket open - this triggers flush
      mockSocket.onopen?.()

      // Events should be flushed
      expect(mockSocket.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('event handling', () => {
    it('should emit board_update on incoming update', () => {
      const handler = vi.fn()
      syncEngine.on('board_update', handler)
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      // Simulate incoming message
      const message = {
        type: 'board_update',
        data: { elements: [] },
        version: 5,
        user_id: 2,
      }

      mockSocket.onmessage?.({
        data: JSON.stringify(message),
      } as MessageEvent)

      expect(handler).toHaveBeenCalledWith(message)
    })

    it('should update version on ack', () => {
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      const message = {
        type: 'ack',
        version: 10,
      }

      mockSocket.onmessage?.({
        data: JSON.stringify(message),
      } as MessageEvent)

      expect(syncEngine.getVersion()).toBe(10)
    })

    it('should emit conflict_resolved on conflict message', () => {
      const handler = vi.fn()
      syncEngine.on('conflict_resolved', handler)
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      const message = {
        type: 'conflict',
        local_version: 5,
        server_version: 7,
        server_state: { elements: [] },
      }

      mockSocket.onmessage?.({
        data: JSON.stringify(message),
      } as MessageEvent)

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('requestFullSync', () => {
    it('should send sync_request message', () => {
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      syncEngine.requestFullSync()

      expect(mockSocket.send).toHaveBeenCalled()
      const sentData = JSON.parse(mockSocket.send.mock.calls[0][0])
      expect(sentData.type).toBe('sync_request')
    })
  })

  describe('disconnect', () => {
    it('should clear socket reference', () => {
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      syncEngine.disconnect()

      // disconnect() clears the socket reference but doesn't call close()
      // (close is expected to be called by the caller if needed)
      expect(syncEngine.getSocket()).toBeNull()
    })
  })

  describe('event listeners', () => {
    it('should add and remove event listeners', () => {
      const handler = vi.fn()

      syncEngine.on('board_update', handler)
      syncEngine.setSocket(mockSocket as unknown as WebSocket)

      // Trigger event
      mockSocket.onmessage?.({
        data: JSON.stringify({ type: 'board_update', data: {}, version: 1, user_id: 1 }),
      } as MessageEvent)

      expect(handler).toHaveBeenCalledTimes(1)

      // Remove listener
      syncEngine.off('board_update', handler)

      // Trigger again
      mockSocket.onmessage?.({
        data: JSON.stringify({ type: 'board_update', data: {}, version: 2, user_id: 1 }),
      } as MessageEvent)

      // Should not be called again
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
