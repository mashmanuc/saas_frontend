/**
 * Unit tests for ClassroomRealtimeAdapter
 * Coverage target: ≥90%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClassroomRealtimeAdapter } from '../ClassroomRealtimeAdapter'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3
  
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: any) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) this.onopen()
    }, 10)
  }
  
  send(data: string) {
    // Mock send
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose()
  }
}

describe('ClassroomRealtimeAdapter', () => {
  let originalWebSocket: any
  
  beforeEach(() => {
    originalWebSocket = global.WebSocket
    global.WebSocket = MockWebSocket as any
  })
  
  afterEach(() => {
    global.WebSocket = originalWebSocket
  })
  
  it('should connect successfully', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    
    expect(adapter.isConnected()).toBe(true)
  })
  
  it('should disconnect successfully', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    adapter.disconnect()
    
    expect(adapter.isConnected()).toBe(false)
  })
  
  it('should return empty presence list initially', () => {
    const adapter = new ClassroomRealtimeAdapter()
    
    const presence = adapter.getPresence()
    
    expect(presence).toEqual([])
  })
  
  it('should handle presence updates', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onPresenceChange(callback)
    await adapter.connect('workspace-123', 'user-456')
    
    // Simulate presence message
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'presence',
        users: [
          { userId: '1', userName: 'User 1', isActive: true, lastSeenAt: Date.now() }
        ]
      })
    })
    
    expect(callback).toHaveBeenCalledWith([
      { userId: '1', userName: 'User 1', isActive: true, lastSeenAt: expect.any(Number) }
    ])
  })
  
  it('should send cursor movements', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    const sendSpy = vi.spyOn(ws, 'send')
    
    adapter.sendCursorMove(100, 200, 'pen', '#000000')
    
    expect(sendSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"cursor_move"')
    )
  })
  
  it('should handle cursor move events', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onCursorMove(callback)
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'cursor_move',
        userId: 'user-1',
        userName: 'Test User',
        x: 100,
        y: 200,
        tool: 'pen',
        color: '#000000',
        timestamp: Date.now()
      })
    })
    
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Test User',
        x: 100,
        y: 200
      })
    )
  })
  
  it('should send board operations', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    const sendSpy = vi.spyOn(ws, 'send')
    
    await adapter.sendOperation({
      type: 'stroke_add',
      pageId: 'page-123',
      data: { points: [[0, 0]] },
      userId: 'user-456',
      timestamp: Date.now(),
      version: 1
    })
    
    expect(sendSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"board_operation"')
    )
  })
  
  it('should handle board operation events', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onOperation(callback)
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'board_operation',
        userId: 'user-1',
        operation: {
          type: 'stroke_add',
          pageId: 'page-123',
          version: 2,
          data: { points: [[0, 0]] }
        }
      })
    })
    
    expect(callback).toHaveBeenCalled()
  })
  
  it('should broadcast page switches', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    const sendSpy = vi.spyOn(ws, 'send')
    
    adapter.broadcastPageSwitch('page-456')
    
    expect(sendSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"page_switch"')
    )
  })
  
  it('should handle page switch events', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onPageSwitch(callback)
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'page_switch',
        userId: 'user-1',
        pageId: 'page-456'
      })
    })
    
    expect(callback).toHaveBeenCalledWith('page-456', 'user-1')
  })
  
  it('should handle version conflicts', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const eventSpy = vi.spyOn(window, 'dispatchEvent')
    
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'version_conflict',
        pageId: 'page-123',
        currentVersion: 5
      })
    })
    
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'whiteboard:version-conflict'
      })
    )
  })
  
  it('should handle errors gracefully', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    
    expect(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: 'error',
          code: 'test_error',
          message: 'Test error message'
        })
      })
    }).not.toThrow()
  })
  
  it('should handle invalid JSON gracefully', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    
    expect(() => {
      ws.onmessage?.({ data: 'invalid json{' })
    }).not.toThrow()
  })
  
  it('should not send messages when disconnected', () => {
    const adapter = new ClassroomRealtimeAdapter()
    
    expect(() => {
      adapter.sendCursorMove(100, 200, 'pen', '#000000')
    }).not.toThrow()
  })
  
  it('should clear presence on disconnect', async () => {
    const adapter = new ClassroomRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    
    const ws = (adapter as any).ws
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'presence',
        users: [{ userId: '1', userName: 'User 1', isActive: true, lastSeenAt: Date.now() }]
      })
    })
    
    adapter.disconnect()
    
    expect(adapter.getPresence()).toEqual([])
  })
})
